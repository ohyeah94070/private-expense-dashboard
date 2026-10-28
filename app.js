const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const RANGES = ["Stmt!A1:U54", "Budget!A1:J38", "'Income & Transfers'!A1:O300", "'Large exp.'!A1:C500", "'Ex. Rate'!A1:D400"];
const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const num = value => value === "" || value == null ? NaN : Number(value);
const valueAt = (rows,r,c) => num(rows[r]?.[c]);
const serialDate = n => new Date(Date.UTC(1899,11,30) + n * 86400000);
const dateLabel = n => Number.isFinite(n) ? new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(serialDate(n)) : "—";
const monthKey = n => Number.isFinite(n) ? serialDate(n).toISOString().slice(0,7) : "";
const monthLabel = n => Number.isFinite(n) ? new Intl.DateTimeFormat("en-GB",{month:"short",year:"numeric",timeZone:"UTC"}).format(serialDate(n)) : "—";
const fmt = value => {
  if (!Number.isFinite(value)) return "—";
  const absolute = Math.abs(value) < .005 ? 0 : Math.abs(value);
  const shown = "HK$" + new Intl.NumberFormat("en-HK",{maximumFractionDigits:0}).format(absolute);
  return value < -.005 ? "(" + shown + ")" : shown;
};
const fmtOriginal = (value,ccy) => {
  if (!Number.isFinite(value)) return "—";
  const shown = esc(ccy || "") + " " + new Intl.NumberFormat("en-HK",{maximumFractionDigits:2}).format(Math.abs(value));
  return value < 0 ? "(" + shown + ")" : shown;
};
const nowHK = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Hong_Kong",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const dayNow = Math.floor((Date.parse(nowHK + "T00:00:00Z") - Date.UTC(1899,11,30))/86400000);
let tokenClient, accessToken, raw = {}, periods = [], budgetRows = [], events = [], activeTab = "overview", loadEpoch = 0;

$("client-id").value = localStorage.getItem("expense-google-client-id") || "";
$("sheet-id").value = localStorage.getItem("expense-sheet-id") || "";

$("connect").addEventListener("click", () => {
  const clientId = $("client-id").value.trim(), sheetId = $("sheet-id").value.trim();
  $("connect-error").textContent = "";
  if (!clientId.endsWith(".apps.googleusercontent.com")) return error("Enter a valid Google OAuth client ID.");
  if (!/^[A-Za-z0-9_-]{20,}$/.test(sheetId)) return error("Enter a valid spreadsheet ID.");
  if (!window.google?.accounts?.oauth2) return error("Google sign-in is still loading. Try again.");
  localStorage.setItem("expense-google-client-id",clientId);
  localStorage.setItem("expense-sheet-id",sheetId);
  tokenClient = google.accounts.oauth2.initTokenClient({client_id:clientId,scope:SCOPE,callback:async result => {
    if (result.error || !result.access_token) return error("Google authorization failed. Check your account and OAuth settings.");
    accessToken = result.access_token;
    await loadData();
  }});
  tokenClient.requestAccessToken({prompt:""});
});
$("refresh").addEventListener("click",async () => { if (accessToken) await loadData(); else $("connect").click(); });
$("disconnect").addEventListener("click",() => {
  const tokenToRevoke = accessToken;
  loadEpoch++;
  accessToken = undefined; raw = {}; periods = []; events = [];
  $("dashboard").replaceChildren();
  $("dashboard").hidden = true; $("setup").hidden = false; $("sync-time").textContent = "Disconnected";
  if (tokenToRevoke && window.google?.accounts?.oauth2) {
    let reloaded = false;
    const finish = () => { if (!reloaded) { reloaded = true; window.location.reload(); } };
    google.accounts.oauth2.revoke(tokenToRevoke, finish);
    setTimeout(finish, 3000);
  } else window.location.reload();
});
$("period").addEventListener("change", () => { $("spend-window").value = "period"; renderAll(); });
document.querySelectorAll(".tab").forEach(button => button.addEventListener("click",() => setTab(button.dataset.tab)));
document.querySelectorAll("[data-go]").forEach(button => button.addEventListener("click",() => setTab(button.dataset.go)));
$("asset-group").addEventListener("change",renderAssets);
$("asset-search").addEventListener("input",renderAssetRows);
$("asset-category").addEventListener("change",renderAssetRows);
$("asset-type").addEventListener("change",renderAssetRows);
$("clear-assets").addEventListener("click",() => { $("asset-search").value=""; $("asset-category").value=""; $("asset-type").value=""; renderAssetRows(); });
$("spend-window").addEventListener("change",renderSpending);
$("event-group").addEventListener("change",renderSpending);
$("event-search").addEventListener("input",renderEventRows);
$("event-category").addEventListener("change",renderEventRows);
$("clear-events").addEventListener("click",() => { $("event-search").value=""; $("event-category").value=""; renderEventRows(); });
$("budget-month").addEventListener("change",renderBudget);

function error(message) { $("connect-error").textContent=message; }
function setTab(tab) {
  activeTab = tab;
  document.querySelectorAll(".tab").forEach(button => button.classList.toggle("active",button.dataset.tab===tab));
  document.querySelectorAll(".view").forEach(view => view.hidden = view.id !== "view-"+tab);
}
async function loadData() {
  const epoch = loadEpoch, token = accessToken;
  error("Loading sheet data…");
  const query = new URLSearchParams({valueRenderOption:"UNFORMATTED_VALUE",majorDimension:"ROWS"});
  RANGES.forEach(range => query.append("ranges",range));
  try {
    const sheetId = localStorage.getItem("expense-sheet-id");
    const response = await fetch("https://sheets.googleapis.com/v4/spreadsheets/"+sheetId+"/values:batchGet?"+query,{headers:{Authorization:"Bearer "+token},cache:"no-store"});
    if (!response.ok) throw new Error(response.status===403 ? "This account cannot read the sheet, or Sheets API is not enabled." : "Sheet request failed ("+response.status+").");
    const data = await response.json();
    if (epoch !== loadEpoch) return;
    raw = Object.fromEntries(data.valueRanges.map((item,i) => [RANGES[i].split("!")[0].replaceAll("'",""),item.values || []]));
    extract();
    $("setup").hidden = true; $("dashboard").hidden = false; error("");
    $("sync-time").textContent = "Updated " + new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Hong_Kong"}).format(new Date()) + " HKT";
    renderAll();
  } catch(e) { if (epoch === loadEpoch) error(e.message || "Unable to load sheet data."); }
}
function extract() {
  const s = raw.Stmt || [], oldEnd = periods[Number($("period").value)]?.end;
  periods = [];
  for (let col=7;col<=19;col+=2) {
    const end=valueAt(s,0,col), start=valueAt(s,0,col-2);
    const hasBalance = s.slice(2,27).some(row => row[col] !== undefined && row[col] !== "");
    if (!Number.isFinite(end) || end>dayNow || !hasBalance) continue;
    const h=col+1;
    const positions=s.slice(2,27).map((row,i) => ({
      type:String(row[0]||""),category:String(row[1]||""),account:String(row[2]||""),holding:String(row[3]||""),ccy:String(row[4]||""),
      original:num(row[col]),hkd:num(row[h]),previous:num(row[col-1]),sourceRow:i+3
    })).filter(x=>x.type==="Asset" || x.type==="Liabilities");
    periods.push({col,start,end,label:dateLabel(end),days:Math.round(end-start),positions,
      assets:valueAt(s,30,h),liabilities:valueAt(s,35,h),nav:valueAt(s,36,h),navChange:valueAt(s,36,col),
      expense:valueAt(s,47,h),large:valueAt(s,49,h),housing:valueAt(s,50,h),routine:valueAt(s,51,h),savings:valueAt(s,53,h),
      salary:valueAt(s,42,h),investment:valueAt(s,43,h),mpf:valueAt(s,44,h),otherIncome:valueAt(s,45,h)});
  }
  const b=raw.Budget||[];
  budgetRows=b.slice(4,28).filter(row=>Number.isFinite(num(row[0]))).map(row=>({month:num(row[0]),income:num(row[1]),housing:num(row[2]),routine:num(row[3]),other:num(row[4]),events:num(row[5]),expenses:num(row[6]),surplus:num(row[7]),actual:num(row[8])}));
  events=(raw["Large exp."]||[]).slice(1).filter(row=>Number.isFinite(num(row[0]))&&Number.isFinite(num(row[2]))).map(row=>({date:num(row[0]),description:String(row[1]||""),amount:num(row[2]),category:suggestCategory(String(row[1]||""))})).sort((a,b)=>b.date-a.date);
  const selector=$("period");
  selector.innerHTML=periods.map((p,i)=>"<option value='"+i+"'>"+esc(p.label)+"</option>").join("");
  selector.value=String(Math.max(0,periods.findIndex(x=>x.end===oldEnd) >= 0 ? periods.findIndex(x=>x.end===oldEnd) : periods.length-1));
  const months=[...new Set(events.map(e=>monthKey(e.date)))].sort().reverse();
  $("spend-window").innerHTML="<option value='period'>Selected reconciliation period</option>"+months.map(m=>"<option value='"+m+"'>"+esc(new Intl.DateTimeFormat("en-GB",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(m+"-01T00:00:00Z")))+"</option>").join("");
  $("spend-window").value="period";
  $("budget-month").innerHTML=budgetRows.map((row,i)=>"<option value='"+i+"'>"+esc(monthLabel(row.month))+"</option>").join("");
  const currentBudget=budgetRows.findIndex(row=>monthKey(row.month)===nowHK.slice(0,7));
  $("budget-month").value=String(Math.max(0,currentBudget));
  const categories=[...new Set(periods.flatMap(p=>p.positions.map(x=>x.category)))].filter(Boolean).sort();
  $("asset-category").innerHTML="<option value=''>All categories</option>"+categories.map(c=>"<option value='"+esc(c)+"'>"+esc(c)+"</option>").join("");
  const eventCategories=[...new Set(events.map(e=>e.category))].sort();
  $("event-category").innerHTML="<option value=''>All suggested categories</option>"+eventCategories.map(c=>"<option value='"+esc(c)+"'>"+esc(c)+"</option>").join("");
}
function selected() { return periods[Number($("period").value)]; }
function isFullMonth(p) {
  const s=serialDate(p.start),e=serialDate(p.end);
  const last=new Date(Date.UTC(s.getUTCFullYear(),s.getUTCMonth()+1,0)).getUTCDate();
  const endLast=new Date(Date.UTC(e.getUTCFullYear(),e.getUTCMonth()+1,0)).getUTCDate();
  return s.getUTCDate()===last && e.getUTCDate()===endLast && e.getUTCFullYear()*12+e.getUTCMonth()===s.getUTCFullYear()*12+s.getUTCMonth()+1;
}
function renderAll() {
  const p=selected();
  if (!p) { $("dashboard").hidden=true; error("No completed balance snapshots are available."); return; }
  $("period-subtitle").textContent=dateLabel(p.start)+" → "+p.label+" · "+p.days+" days";
  renderOverview(p);renderAssets();renderSpending();renderBudget();
}
function totals(items,key) {
  const result=new Map();
  items.forEach(item=>{const label=key(item)||"Other"; result.set(label,(result.get(label)||0)+(Number.isFinite(item.hkd)?item.hkd:0));});
  return [...result].map(([label,value])=>({label,value})).sort((a,b)=>Math.abs(b.value)-Math.abs(a.value));
}
function barRows(items,maxValue,{click,colors=[]}={}) {
  if (!items.length) return "<div class='empty'>No data for this selection.</div>";
  const max=Math.max(1,maxValue||Math.max(...items.map(x=>Math.abs(x.value))));
  return items.map((x,i)=>"<div class='bar-row"+(click?" clickable":"")+"' "+(click?"data-group='"+esc(x.label)+"'":"")+"><span class='bar-label' title='"+esc(x.label)+"'>"+esc(x.label)+"</span><div class='bar-track'><div class='bar-fill "+(colors[i%colors.length]||"")+"' style='width:"+Math.max(0,Math.min(100,Math.abs(x.value)/max*100))+"%'></div></div><strong>"+fmt(x.value)+"</strong></div>").join("");
}
function renderOverview(p) {
  $("nav").textContent=fmt(p.nav);$("nav-change").textContent="Change since prior snapshot: "+fmt(p.navChange);
  $("total-assets").textContent=fmt(p.assets);$("total-liabilities").textContent=fmt(p.liabilities);
  $("expense").textContent=fmt(p.expense);$("expense-caption").textContent=p.days+"-day reconciliation period";
  const assetGroups=totals(p.positions.filter(x=>x.type==="Asset"),x=>x.category);
  $("allocation-summary").innerHTML=barRows(assetGroups,p.assets,{colors:["","blue","gold","purple"]})+"<div class='summary-total'><span>Gross assets</span><strong>"+fmt(p.assets)+"</strong></div>";
  const parts=[{label:"Large expenses",value:p.large},{label:"Housing",value:p.housing},{label:"Routine / unitemized",value:p.routine}].filter(x=>Number.isFinite(x.value));
  $("expense-summary").innerHTML=barRows(parts,Math.abs(p.expense),{colors:["coral","gold","slate"]})+"<div class='summary-total'><span>Reconciled expense</span><strong>"+fmt(p.expense)+"</strong></div>";
  $("period-chart").innerHTML=periods.map((x,i)=>"<button type='button' class='period-tile "+(x.end===p.end?"selected":"")+"' data-period='"+i+"'><b>"+esc(x.label)+"</b><span>"+x.days+" days · "+esc(dateLabel(x.start))+" start</span><strong>"+fmt(x.expense)+"</strong></button>").join("");
  $("period-chart").querySelectorAll("[data-period]").forEach(button=>button.addEventListener("click",()=>{ $("period").value=button.dataset.period;$("spend-window").value="period";renderAll(); }));
}
function renderAssets() {
  const p=selected();if(!p)return;
  $("asset-asof").textContent="As of "+p.label;
  $("asset-gross").textContent=fmt(p.assets);$("asset-debt").textContent=fmt(p.liabilities);$("asset-net").textContent=fmt(p.nav);
  const mode=$("asset-group").value;
  const key=x=>mode==="account"?x.account:mode==="currency"?x.ccy:x.category;
  const assetGroups=totals(p.positions.filter(x=>x.type==="Asset"),key);
  $("asset-groups").innerHTML=barRows(assetGroups,p.assets,{click:true,colors:["","blue","gold","purple","slate"]})+"<p class='mini-note'>Click a group to filter the positions table.</p>";
  $("asset-groups").querySelectorAll("[data-group]").forEach(row=>row.addEventListener("click",()=>{
    const group=row.dataset.group;
    if(mode==="category"){$("asset-category").value=group;$("asset-search").value="";}
    else {$("asset-category").value="";$("asset-search").value=group;}
    $("asset-type").value="Asset";renderAssetRows();
  }));
  const changes=totals(p.positions.filter(x=>x.type==="Asset"),x=>x.category).map(group=>({
    label:group.label,
    value:p.positions.filter(x=>x.type==="Asset"&&x.category===group.label).reduce((sum,x)=>sum+(Number.isFinite(x.hkd)?x.hkd:0)-(Number.isFinite(x.previous)?x.previous:0),0)
  })).sort((a,b)=>Math.abs(b.value)-Math.abs(a.value));
  changes.push({label:"Liabilities",value:p.positions.filter(x=>x.type==="Liabilities").reduce((sum,x)=>sum+(Number.isFinite(x.hkd)?x.hkd:0)-(Number.isFinite(x.previous)?x.previous:0),0)});
  $("asset-movement").innerHTML=changes.map(x=>"<div class='detail-line'><span>"+esc(x.label)+"</span><strong class='"+(x.value<0?"negative":"positive")+"'>"+fmt(x.value)+"</strong></div>").join("");
  renderAssetRows();
}
function renderAssetRows() {
  const p=selected();if(!p)return;
  const search=$("asset-search").value.toLowerCase().trim(),category=$("asset-category").value,type=$("asset-type").value;
  const list=p.positions.filter(x=>(!category||x.category===category)&&(!type||x.type===type)&&(!search||[x.account,x.holding,x.category,x.ccy].join(" ").toLowerCase().includes(search))).sort((a,b)=>Math.abs(b.hkd||0)-Math.abs(a.hkd||0));
  $("holding-count").textContent=list.length+" positions";
  $("asset-rows").innerHTML=list.map(x=>"<tr><td><span class='tag "+(x.type==="Liabilities"?"debt":"")+"'>"+esc(x.type)+"</span></td><td>"+esc(x.category)+"</td><td>"+esc(x.account)+"</td><td>"+esc(x.holding||"—")+"</td><td>"+esc(x.ccy)+"</td><td class='numeric'>"+fmtOriginal(x.original,x.ccy)+"</td><td class='numeric'>"+fmt(x.hkd)+"</td><td class='numeric "+(x.hkd-x.previous<0?"negative":"positive")+"'>"+fmt(Number.isFinite(x.previous)?x.hkd-x.previous:NaN)+"</td></tr>").join("") || "<tr><td colspan='8' class='empty'>No matching positions.</td></tr>";
}
function suggestCategory(text) {
  const t=text.toLowerCase();
  if(/trip|travel|japan|hotel|flight|旅遊|酒店|機票|日幣|潮汕|台中|台灣旅/.test(t))return "Travel";
  if(/sofa|rent|house|home|bed|mattress|router|dyson|dehumidifier|moving|agent fee|新房|床|搬家/.test(t))return "Home & moving";
  if(/gift|birthday|airpod|longchamp|女友|禮物|生日/.test(t))return "Gifts";
  if(/chiro|health|irestore|healthcare|醫/.test(t))return "Health";
  if(/dinner|vegan|餐|飯/.test(t))return "Dining";
  if(/老媽|保險|insurance|family|媽媽/.test(t))return "Family & insurance";
  return "Other";
}
function visibleEvents() {
  const p=selected(),windowValue=$("spend-window").value;
  return events.filter(e=>windowValue==="period" ? e.date>p.start&&e.date<=p.end : monthKey(e.date)===windowValue);
}
function renderSpending() {
  const p=selected();if(!p)return;
  $("spend-total").textContent=fmt(p.expense);$("spend-span").textContent=dateLabel(p.start)+" → "+p.label+" · "+p.days+" days";
  $("spend-housing").textContent=fmt(p.housing);$("spend-routine").textContent=fmt(p.routine);
  const parts=[{label:"Large expenses",value:p.large},{label:"Housing",value:p.housing},{label:"Routine / unitemized",value:p.routine}].filter(x=>Number.isFinite(x.value));
  $("spend-components").innerHTML=barRows(parts,Math.abs(p.expense),{colors:["coral","gold","slate"]})+"<div class='summary-total'><span>Total</span><strong>"+fmt(p.expense)+"</strong></div>";
  const list=visibleEvents(),mode=$("event-group").value;
  const grouped=new Map();
  list.forEach(e=>{const key=mode==="month"?monthLabel(e.date):e.category;grouped.set(key,(grouped.get(key)||0)+e.amount)});
  const groups=[...grouped].map(([label,value])=>({label,value})).sort((a,b)=>Math.abs(b.value)-Math.abs(a.value));
  $("event-groups").innerHTML=barRows(groups,null,{click:true,colors:["coral","gold","blue","purple"]})+"<div class='summary-total'><span>Logged entries</span><strong>"+fmt(list.reduce((sum,e)=>sum+e.amount,0))+"</strong></div>";
  $("event-groups").querySelectorAll("[data-group]").forEach(row=>row.addEventListener("click",()=>{
    if(mode==="category")$("event-category").value=row.dataset.group;
    else {$("spend-window").value=monthKey(list.find(e=>monthLabel(e.date)===row.dataset.group)?.date);renderSpending();return;}
    renderEventRows();
  }));
  if($("spend-window").value==="period"&&Number.isFinite(p.large)) {
    const logged=list.reduce((sum,e)=>sum+e.amount,0),difference=p.large-logged;
    $("event-groups").insertAdjacentHTML("beforeend","<p class='mini-note'>Logged entries vs Statement large-expense adjustment: "+fmt(difference)+" difference. Dates and manual adjustments may not align.</p>");
  }
  renderEventRows();
}
function renderEventRows() {
  const search=$("event-search").value.toLowerCase().trim(),category=$("event-category").value;
  const list=visibleEvents().filter(e=>(!category||e.category===category)&&(!search||e.description.toLowerCase().includes(search)));
  $("event-count").textContent=list.length+" entries · "+fmt(list.reduce((sum,e)=>sum+e.amount,0));
  $("event-rows").innerHTML=list.map(e=>"<tr><td>"+esc(dateLabel(e.date))+"</td><td title='"+esc(e.description)+"'>"+esc(e.description)+"</td><td><span class='tag'>"+esc(e.category)+"</span></td><td class='numeric'>"+fmt(e.amount)+"</td></tr>").join("") || "<tr><td colspan='4' class='empty'>No matching expense entries.</td></tr>";
}
function renderBudget() {
  const b=budgetRows[Number($("budget-month").value)],p=selected();if(!b)return;
  $("budget-income").textContent=fmt(b.income);$("budget-expenses").textContent=fmt(b.expenses);$("budget-surplus").textContent=fmt(b.surplus);
  const categories=[{label:"Housing",value:b.housing},{label:"Routine",value:b.routine},{label:"Other regular",value:b.other},{label:"Planned events",value:b.events}].filter(x=>Number.isFinite(x.value)&&x.value!==0);
  $("budget-categories").innerHTML=barRows(categories,b.expenses,{colors:["gold","slate","blue","coral"]})+"<div class='summary-total'><span>Total planned expenses</span><strong>"+fmt(b.expenses)+"</strong></div>";
  const actual=periods.find(x=>isFullMonth(x)&&monthKey(x.end)===monthKey(b.month));
  $("budget-actual").innerHTML=actual ? "<div class='detail-line'><span>Actual savings</span><strong>"+fmt(actual.savings)+"</strong></div><div class='detail-line'><span>Planned surplus</span><strong>"+fmt(b.surplus)+"</strong></div><div class='detail-line'><span>Variance</span><strong>"+fmt(actual.savings-b.surplus)+"</strong></div>" : "<div class='status-box'>No completed month-end to month-end reconciliation for "+esc(monthLabel(b.month))+". A partial or cross-month snapshot cannot be compared with a full calendar-month budget.</div>";
  $("budget-rows").innerHTML=budgetRows.map((x,i)=>"<tr class='clickable' data-budget='"+i+"'><td>"+esc(monthLabel(x.month))+"</td><td class='numeric'>"+fmt(x.income)+"</td><td class='numeric'>"+fmt(x.housing)+"</td><td class='numeric'>"+fmt(x.routine)+"</td><td class='numeric'>"+fmt(x.events)+"</td><td class='numeric'>"+fmt(x.expenses)+"</td><td class='numeric'>"+fmt(x.surplus)+"</td></tr>").join("");
  $("budget-rows").querySelectorAll("[data-budget]").forEach(row=>row.addEventListener("click",()=>{$("budget-month").value=row.dataset.budget;renderBudget();}));
}
