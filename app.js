const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const GOOGLE_CLIENT_ID = "110894641783-ranndo8u0vmmbq0c59g2vehma2vla4g6.apps.googleusercontent.com";
const EXPENSE_SHEET_ID = "1ymBBV_MGJcTopCtnykOYac8qvKeesDh_4kMUFr-9aAE";
const SOURCE_TABS = SourceRanges.tabs;
const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
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
let tokenClient, accessToken, raw = {}, periods = [], budgetRows = [], budgetPlans = [], events = [], incomeEntries = [], sourceFailures = {}, activeTab = "overview", loadEpoch = 0;

$("connect").addEventListener("click", () => {
  $("connect-error").textContent = "";
  if (!window.google?.accounts?.oauth2) return error("Google sign-in is still loading. Try again.");
  tokenClient = google.accounts.oauth2.initTokenClient({client_id:GOOGLE_CLIENT_ID,scope:SCOPE,callback:async result => {
    if (result.error || !result.access_token) return error("Google sign-in did not complete. Check the selected account and OAuth settings.");
    accessToken = result.access_token;
    await loadData();
  },error_callback:result => error(result?.type==="popup_closed" ? "Google sign-in was cancelled." : "Google sign-in could not open. Allow pop-ups and try again.")});
  tokenClient.requestAccessToken({prompt:""});
});
$("refresh").addEventListener("click",async () => { if (accessToken) await loadData(); else $("connect").click(); });
$("disconnect").addEventListener("click",() => {
  const tokenToRevoke = accessToken;
  loadEpoch++;
  accessToken = undefined; raw = {}; periods = []; budgetRows = []; budgetPlans = []; events = []; incomeEntries = []; sourceFailures = {};
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
$("income-group").addEventListener("change",renderSpending);
$("income-search").addEventListener("input",renderIncomeRows);
$("income-type").addEventListener("change",renderIncomeRows);
$("income-account").addEventListener("change",renderIncomeRows);
$("clear-income").addEventListener("click",() => { $("income-search").value=""; $("income-type").value=""; $("income-account").value=""; renderIncomeRows(); });
$("event-group").addEventListener("change",renderSpending);
$("event-search").addEventListener("input",renderEventRows);
$("event-category").addEventListener("change",renderEventRows);
$("clear-events").addEventListener("click",() => { $("event-search").value=""; $("event-category").value=""; renderEventRows(); });
$("budget-month").addEventListener("change",() => { $("plan-scope").value="month"; renderBudget(); });
$("plan-scope").addEventListener("change",renderBudgetPlans);
$("plan-search").addEventListener("input",renderBudgetPlans);
$("plan-category").addEventListener("change",renderBudgetPlans);
$("plan-status").addEventListener("change",renderBudgetPlans);
$("clear-plans").addEventListener("click",() => { $("plan-scope").value="all"; $("plan-search").value=""; $("plan-category").value=""; $("plan-status").value=""; renderBudgetPlans(); });

function error(message) { $("connect-error").textContent=message; }
function setTab(tab) {
  activeTab = tab;
  document.querySelectorAll(".tab").forEach(button => button.classList.toggle("active",button.dataset.tab===tab));
  document.querySelectorAll(".view").forEach(view => view.hidden = view.id !== "view-"+tab);
}
async function loadData() {
  const epoch = loadEpoch, token = accessToken;
  error("Loading sheet data…");
  try {
    const base = "https://sheets.googleapis.com/v4/spreadsheets/" + EXPENSE_SHEET_ID;
    const metadata = await fetch(base + "?fields=sheets(properties(title,gridProperties(columnCount)))",{headers:{Authorization:"Bearer "+token},cache:"no-store"});
    if (!metadata.ok) throw new Error(metadata.status===401 ? "Google access expired. Connect again." : "Unable to read spreadsheet tabs (" + metadata.status + ").");
    const sheets = new Map((await metadata.json()).sheets.map(sheet => [sheet.properties.title,sheet.properties]));
    for (const name of SOURCE_TABS) if (!sheets.has(name)) throw new Error("Required source tab is missing: " + name);
    const names = SOURCE_TABS;
    const query = new URLSearchParams({valueRenderOption:"UNFORMATTED_VALUE",majorDimension:"ROWS"});
    names.forEach(name => query.append("ranges",SourceRanges.range(name,sheets.get(name).gridProperties.columnCount)));
    const response = await fetch(base+"/values:batchGet?"+query,{headers:{Authorization:"Bearer "+token},cache:"no-store"});
    if (!response.ok) throw new Error(response.status===401 ? "Google access expired. Connect again." : response.status===403 ? "This account cannot read the sheet, or Sheets API is not enabled." : "Sheet request failed ("+response.status+").");
    const data = await response.json();
    if (epoch !== loadEpoch) return;
    if (data.valueRanges?.length !== names.length) throw new Error("Sheet response did not include every requested source range.");
    const nextRaw = Object.fromEntries(data.valueRanges.map((item,i) => [names[i],item.values || []]));
    const nextPeriods = StatementModel.parse(nextRaw.Stmt,dayNow);
    if (!nextPeriods.length) throw new Error("No completed balance periods are available in Statement.");
    const nextBudget = SourceModel.budget(nextRaw.Budget);
    const nextFailures = {};
    const detail = (name,parse) => {
      try {
        const result=parse(), incomplete=result.issues.filter(x=>x.severity==="incomplete");
        if (incomplete.length) throw new Error(incomplete.length+" incomplete row(s): "+incomplete.slice(0,3).map(formatIssue).join("; "));
        return result;
      } catch(e) { nextFailures[name]=e.message; const unavailable=[]; unavailable.issues=[]; return unavailable; }
    };
    const nextPlans = detail("Future One-off Plans",()=>SourceModel.plans(nextRaw["Future One-off Plans"],nextBudget.budgetRows));
    const nextEvents = detail("Large exp.",()=>SourceModel.expenses(nextRaw["Large exp."]));
    const nextIncome = detail("Income & Transfers",()=>SourceModel.income(nextRaw["Income & Transfers"]));
    const nextFx = SourceModel.exchangeRates(nextRaw["Ex. Rate"],nextRaw["FX Feed"],dayNow);
    const issues = [...nextBudget.issues,...nextPlans.issues,...nextEvents.issues,...nextIncome.issues,...nextFx.issues];
    const incomplete = nextBudget.issues.concat(nextFx.issues).filter(item => item.severity === "incomplete");
    if (incomplete.length) throw new Error("Incomplete / Needs Review ("+incomplete.length+"): "+incomplete.slice(0,5).map(formatIssue).join("; "));
    raw = nextRaw;
    sourceFailures=nextFailures;
    extract(nextPeriods,nextBudget,nextPlans,nextEvents,nextIncome);
    const fxStatus="FX "+dateLabel(nextFx.date)+": "+nextFx.summary.map(x=>x.currency+" "+x.status+(Number.isFinite(x.sourceDate)?" ("+dateLabel(x.sourceDate)+")":"")).join("; ");
    const failed=Object.entries(nextFailures).map(([name,message])=>name+" unavailable / Incomplete: "+message);
    $("data-status").textContent = fxStatus+(failed.length?"\n"+failed.join("\n"):"")+(issues.length ? "\nNeeds Review ("+issues.length+" warning"+(issues.length===1?"":"s")+"): \n"+issues.map(formatIssue).join("\n") : "");
    $("setup").hidden = true; $("dashboard").hidden = false; $("refresh").hidden = false; $("disconnect").hidden = false; error("");
    $("sync-time").title = "";
    $("sync-time").textContent = "Updated " + new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Hong_Kong"}).format(new Date()) + " HKT";
    renderAll();
  } catch(e) { if (epoch === loadEpoch) { const message=e.message || "Unable to load sheet data."; error("Sheet data load failed: " + message); $("dashboard").hidden=true; $("setup").hidden=false; $("sync-time").textContent="Data load failed"; $("sync-time").title=message; } }
}
function formatIssue(item) { return item.sheet+" / "+item.section+", row "+item.row+", column "+item.column+", '"+(item.tag||"(blank)")+"', amount "+(Number.isFinite(item.amount)?item.amount:"—"); }
function extract(parsedPeriods,parsedBudget,parsedPlans,parsedEvents,parsedIncome) {
  const oldEnd = periods[Number($("period").value)]?.end;
  periods = parsedPeriods.map(period => ({...period,label:dateLabel(period.end)}));
  budgetRows=parsedBudget.budgetRows;
  budgetPlans=parsedPlans;
  events=parsedEvents;
  incomeEntries=parsedIncome;
  const selector=$("period");
  selector.innerHTML=periods.map((p,i)=>"<option value='"+i+"'>"+esc(p.label)+"</option>").join("");
  selector.value=String(Math.max(0,periods.findIndex(x=>x.end===oldEnd) >= 0 ? periods.findIndex(x=>x.end===oldEnd) : periods.length-1));
  const months=[...new Set([...events,...incomeEntries].map(e=>monthKey(e.date)))].sort().reverse();
  $("spend-window").innerHTML="<option value='period'>Selected reconciliation period</option>"+months.map(m=>"<option value='"+m+"'>"+esc(new Intl.DateTimeFormat("en-GB",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(m+"-01T00:00:00Z")))+"</option>").join("");
  $("spend-window").value="period";
  $("budget-month").innerHTML=budgetRows.map((row,i)=>"<option value='"+i+"'>"+esc(monthLabel(row.month))+"</option>").join("");
  const currentBudget=budgetRows.findIndex(row=>monthKey(row.month)===nowHK.slice(0,7));
  $("budget-month").value=String(Math.max(0,currentBudget));
  const planCategories=[...new Set(budgetPlans.map(x=>x.category))].sort();
  $("plan-category").innerHTML="<option value=''>All categories</option>"+planCategories.map(x=>"<option value='"+esc(x)+"'>"+esc(x)+"</option>").join("");
  const categories=[...new Set(periods.flatMap(p=>p.positions.map(x=>x.category)))].filter(Boolean).sort();
  $("asset-category").innerHTML="<option value=''>All categories</option>"+categories.map(c=>"<option value='"+esc(c)+"'>"+esc(c)+"</option>").join("");
  const eventCategories=[...new Set(events.map(e=>e.category))].sort();
  $("event-category").innerHTML="<option value=''>All categories</option>"+eventCategories.map(c=>"<option value='"+esc(c)+"'>"+esc(c)+"</option>").join("");
  const incomeTypes=[...new Set(incomeEntries.map(e=>e.type))].sort(), incomeAccounts=[...new Set(incomeEntries.map(e=>e.account))].sort();
  $("income-type").innerHTML="<option value=''>All income types</option>"+incomeTypes.map(x=>"<option value='"+esc(x)+"'>"+esc(x)+"</option>").join("");
  $("income-account").innerHTML="<option value=''>All accounts</option>"+incomeAccounts.map(x=>"<option value='"+esc(x)+"'>"+esc(x)+"</option>").join("");
}
function selected() { return periods[Number($("period").value)]; }
function renderAll() {
  const p=selected();
  if (!p) { $("dashboard").hidden=true; error("No completed balance snapshots are available."); return; }
  $("period-subtitle").textContent=dateLabel(p.start)+" → "+p.label+" · "+p.days+" days";
  renderOverview(p);renderAssets();renderSpending();renderBudget();renderLiquidity();
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
  $("overview-income").textContent=fmt(p.income);
  $("overview-net-change").textContent=fmt(p.navChange);
  $("overview-core-savings").textContent=fmt(p.savings);
  $("expense").textContent=fmt(p.expense);$("expense-caption").textContent=p.days+"-day reconciliation period";
  const assetGroups=totals(p.positions.filter(x=>x.type==="Asset"),x=>x.category);
  $("allocation-summary").innerHTML=barRows(assetGroups,p.assets,{colors:["","blue","gold","purple"]})+"<div class='summary-total'><span>Gross assets</span><strong>"+fmt(p.assets)+"</strong></div>";
  const parts=[{label:"Large expenses",value:p.large},{label:"Housing",value:p.housing},{label:"Routine / residual",value:p.routine}].filter(x=>Number.isFinite(x.value));
  $("expense-summary").innerHTML=barRows(parts,Math.abs(p.expense),{colors:["coral","gold","slate"]})+"<div class='summary-total'><span>Reconciled expense</span><strong>"+fmt(p.expense)+"</strong></div>";
  $("period-chart").innerHTML=periods.map((x,i)=>"<button type='button' class='period-tile "+(x.end===p.end?"selected":"")+"' data-period='"+i+"'><b>"+esc(x.label)+"</b><span>"+x.days+" days · "+esc(dateLabel(x.start))+" start</span><strong>"+fmt(x.expense)+"</strong></button>").join("");
  const history=[{label:dateLabel(periods[0].start),nav:periods[0].nav-periods[0].navChange},...periods.map(x=>({label:x.label,nav:x.nav}))];
  const netValues=history.map(x=>x.nav), netLow=Math.min(...netValues), netSpan=Math.max(...netValues)-netLow||1;
  const netPoints=history.map((x,i)=>`${20+i*760/Math.max(1,history.length-1)},${155-(x.nav-netLow)/netSpan*125}`).join(" ");
  $("net-worth-history").innerHTML="<div class='liquidity-chart'><svg viewBox='0 0 800 180' role='img' aria-label='Historical net worth'><polyline points='"+netPoints+"' fill='none' stroke='#14816c' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/></svg><div class='chart-labels'><span>"+esc(history[0].label)+" · "+fmt(history[0].nav)+"</span><span>"+esc(history.at(-1).label)+" · "+fmt(history.at(-1).nav)+"</span></div></div>";
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
function visibleEvents() {
  const p=selected(),windowValue=$("spend-window").value;
  return events.filter(e=>windowValue==="period" ? e.date>p.start&&e.date<=p.end : monthKey(e.date)===windowValue);
}
function visibleIncomeEntries() {
  const p=selected(),windowValue=$("spend-window").value;
  return incomeEntries.filter(e=>windowValue==="period" ? e.date>p.start&&e.date<=p.end : monthKey(e.date)===windowValue);
}
function renderSpending() {
  const p=selected();if(!p)return;
  $("income-total").textContent=fmt(p.income);$("income-span").textContent=dateLabel(p.start)+" → "+p.label+" · "+p.days+" days";
  $("income-salary").textContent=fmt(p.salary);$("income-other").textContent=fmt(p.otherIncome);
  $("spend-total").textContent=fmt(p.expense);$("spend-span").textContent=dateLabel(p.start)+" → "+p.label+" · "+p.days+" days";
  $("spend-net-change").textContent=fmt(p.navChange);$("spend-core-savings").textContent=fmt(p.savings);
  const incomeParts=[{label:"Salary",value:p.salary},{label:"Investment result",value:p.investment},{label:"MPF result",value:p.mpf},{label:"Other income",value:p.otherIncome}].filter(x=>Number.isFinite(x.value));
  $("income-components").innerHTML=barRows(incomeParts,Math.abs(p.income),{colors:["","blue","purple","gold"]})+"<div class='summary-total'><span>Statement income</span><strong>"+fmt(p.income)+"</strong></div>";
  const parts=[{label:"Large expenses",value:p.large},{label:"Housing",value:p.housing},{label:"Routine / residual",value:p.routine}].filter(x=>Number.isFinite(x.value));
  $("spend-components").innerHTML=barRows(parts,Math.abs(p.expense),{colors:["coral","gold","slate"]})+"<div class='summary-total'><span>Total</span><strong>"+fmt(p.expense)+"</strong></div>";
  const receipts=visibleIncomeEntries(),incomeMode=$("income-group").value,incomeGrouped=new Map();
  receipts.forEach(e=>{const key=incomeMode==="account"?e.account:e.type;incomeGrouped.set(key,(incomeGrouped.get(key)||0)+e.amount);});
  const incomeGroups=[...incomeGrouped].map(([label,value])=>({label,value})).sort((a,b)=>Math.abs(b.value)-Math.abs(a.value));
  $("income-groups").innerHTML=sourceFailures["Income & Transfers"] ? "<div class='status-box'>Income detail unavailable / Incomplete: "+esc(sourceFailures["Income & Transfers"])+"</div>" : barRows(incomeGroups,null,{click:true,colors:["","blue","gold"]})+"<div class='summary-total'><span>Logged income entries</span><strong>"+fmt(receipts.reduce((sum,e)=>sum+e.amount,0))+"</strong></div>";
  $("income-groups").querySelectorAll("[data-group]").forEach(row=>row.addEventListener("click",()=>{
    if(incomeMode==="account"){$("income-account").value=row.dataset.group;$("income-type").value="";}
    else {$("income-type").value=row.dataset.group;$("income-account").value="";}
    renderIncomeRows();
  }));
  const list=visibleEvents(),mode=$("event-group").value;
  const grouped=new Map();
  list.forEach(e=>{const key=mode==="month"?monthLabel(e.date):e.category;grouped.set(key,(grouped.get(key)||0)+e.amount)});
  const groups=[...grouped].map(([label,value])=>({label,value})).sort((a,b)=>Math.abs(b.value)-Math.abs(a.value));
  $("event-groups").innerHTML=sourceFailures["Large exp."] ? "<div class='status-box'>Large expense detail unavailable / Incomplete: "+esc(sourceFailures["Large exp."])+"</div>" : barRows(groups,null,{click:true,colors:["coral","gold","blue","purple"]})+"<div class='summary-total'><span>Logged entries</span><strong>"+fmt(list.reduce((sum,e)=>sum+e.amount,0))+"</strong></div>";
  $("event-groups").querySelectorAll("[data-group]").forEach(row=>row.addEventListener("click",()=>{
    if(mode==="category")$("event-category").value=row.dataset.group;
    else {$("spend-window").value=monthKey(list.find(e=>monthLabel(e.date)===row.dataset.group)?.date);renderSpending();return;}
    renderEventRows();
  }));
  if(!sourceFailures["Large exp."]&&$("spend-window").value==="period"&&Number.isFinite(p.large)) {
    const logged=list.reduce((sum,e)=>sum+e.amount,0),difference=p.large-logged;
    $("event-groups").insertAdjacentHTML("beforeend","<p class='mini-note'>Logged entries vs Statement large-expense adjustment: "+fmt(difference)+" difference. Dates and manual adjustments may not align.</p>");
  }
  renderIncomeRows();
  renderEventRows();
}
function renderIncomeRows() {
  if(sourceFailures["Income & Transfers"]) {$("income-count").textContent="Incomplete";$("income-rows").innerHTML="<tr><td colspan='5' class='empty'>Income detail unavailable.</td></tr>";return;}
  const search=$("income-search").value.toLowerCase().trim(),type=$("income-type").value,account=$("income-account").value;
  const list=visibleIncomeEntries().filter(e=>(!type||e.type===type)&&(!account||e.account===account)&&(!search||[e.description,e.account,e.type].join(" ").toLowerCase().includes(search)));
  $("income-count").textContent=list.length+" entries · "+fmt(list.reduce((sum,e)=>sum+e.amount,0));
  $("income-rows").innerHTML=list.map(e=>"<tr><td>"+esc(dateLabel(e.date))+"</td><td title='"+esc(e.description)+"'>"+esc(e.description)+"</td><td><span class='tag'>"+esc(e.type)+"</span></td><td>"+esc(e.account)+"</td><td class='numeric'>"+fmt(e.amount)+"</td></tr>").join("") || "<tr><td colspan='5' class='empty'>No matching income entries.</td></tr>";
}
function renderEventRows() {
  if(sourceFailures["Large exp."]) {$("event-count").textContent="Incomplete";$("event-rows").innerHTML="<tr><td colspan='4' class='empty'>Large expense detail unavailable.</td></tr>";return;}
  const search=$("event-search").value.toLowerCase().trim(),category=$("event-category").value;
  const list=visibleEvents().filter(e=>(!category||e.category===category)&&(!search||e.description.toLowerCase().includes(search)));
  $("event-count").textContent=list.length+" entries · "+fmt(list.reduce((sum,e)=>sum+e.amount,0));
  $("event-rows").innerHTML=list.map(e=>"<tr><td>"+esc(dateLabel(e.date))+"</td><td title='"+esc(e.description)+"'>"+esc(e.description)+"</td><td><span class='tag'>"+esc(e.category)+"</span></td><td class='numeric'>"+fmt(e.amount)+"</td></tr>").join("") || "<tr><td colspan='4' class='empty'>No matching expense entries.</td></tr>";
}
function renderBudget() {
  const b=budgetRows[Number($("budget-month").value)];if(!b)return;
  $("budget-income").textContent=fmt(b.income);$("budget-expenses").textContent=fmt(b.expenses);$("budget-surplus").textContent=fmt(b.surplus);
  const categories=[{label:"Housing",value:b.housing},{label:"Routine",value:b.routine},{label:"Other regular",value:b.other},{label:"Planned events",value:b.events}].filter(x=>Number.isFinite(x.value)&&x.value!==0);
  $("budget-categories").innerHTML=barRows(categories,b.expenses,{colors:["gold","slate","blue","coral"]})+"<div class='summary-total'><span>Total planned expenses</span><strong>"+fmt(b.expenses)+"</strong></div>";
  const saving=LiquidityModel.forecast(periods,budgetRows,budgetPlans).savings.find(x=>x.month===monthKey(b.month));
  $("budget-actual").innerHTML=Number.isFinite(saving?.actual) ? "<div class='detail-line'><span>Actual savings</span><strong>"+fmt(saving.actual)+"</strong></div><div class='detail-line'><span>Planned surplus</span><strong>"+fmt(b.surplus)+"</strong></div><div class='detail-line'><span>Actual vs budget</span><strong>"+fmt(saving.variance)+"</strong></div><div class='detail-line'><span>Status</span><strong>"+esc(saving.status)+"</strong></div>" : "<div class='status-box'>Actual savings pending for "+esc(monthLabel(b.month))+".</div>";
  $("budget-rows").innerHTML=budgetRows.map((x,i)=>"<tr class='clickable' data-budget='"+i+"'><td>"+esc(monthLabel(x.month))+"</td><td class='numeric'>"+fmt(x.income)+"</td><td class='numeric'>"+fmt(x.housing)+"</td><td class='numeric'>"+fmt(x.routine)+"</td><td class='numeric'>"+fmt(x.events)+"</td><td class='numeric'>"+fmt(x.expenses)+"</td><td class='numeric'>"+fmt(x.surplus)+"</td></tr>").join("");
  $("budget-rows").querySelectorAll("[data-budget]").forEach(row=>row.addEventListener("click",()=>{$("budget-month").value=row.dataset.budget;$("plan-scope").value="month";renderBudget();}));
  renderBudgetPlans();
}
function renderLiquidity() {
  const model=LiquidityModel.forecast(periods,budgetRows,budgetPlans);
  $("liquidity-current").textContent=fmt(model.opening);
  $("liquidity-asof").textContent="As of "+dateLabel(model.asOf);
  $("liquidity-projected").textContent=fmt(model.rows.at(-1)?.ending ?? model.opening);
  $("liquidity-projection-date").textContent=model.rows.length ? "Through "+model.rows.at(-1).month : "No upcoming Budget months";
  $("liquidity-rows").innerHTML=model.rows.map(x=>"<tr><td>"+esc(x.month)+" <span class='tag'>Forecast</span></td><td class='numeric'>"+fmt(x.beginning)+"</td><td class='numeric'>"+fmt(x.regular)+"</td><td class='numeric'>"+fmt(x.oneOff)+"</td><td class='numeric'>"+fmt(x.ending)+"</td></tr>").join("") || "<tr><td colspan='5' class='empty'>No upcoming Budget months.</td></tr>";
  const chartRows=[{month:monthKey(model.asOf),ending:model.opening},...model.rows];
  const values=chartRows.map(x=>x.ending), low=Math.min(...values), high=Math.max(...values), span=high-low||1;
  const points=chartRows.map((x,i)=>`${20+i*760/Math.max(1,chartRows.length-1)},${155-(x.ending-low)/span*125}`).join(" ");
  $("liquidity-chart").innerHTML="<svg viewBox='0 0 800 180' role='img' aria-label='Monthly projected ending liquidity'><polyline points='"+points+"' fill='none' stroke='#14816c' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/></svg><div class='chart-labels'><span>"+esc(chartRows[0].month)+" Actual</span><span>"+esc(chartRows.at(-1).month)+" Forecast</span></div>";
  const shown=model.savings.filter(x=>x.month>=monthKey(model.asOf)).slice(0,12);
  $("liquidity-savings").innerHTML=shown.map(x=>"<tr><td>"+esc(x.month)+"</td><td class='numeric'>"+fmt(x.target)+"</td><td class='numeric'>"+(Number.isFinite(x.actual)?fmt(x.actual):"Pending")+"</td><td class='numeric'>"+fmt(x.variance)+"</td><td>"+esc(x.status)+"</td></tr>").join("");
  $("liquidity-plans").innerHTML=sourceFailures["Future One-off Plans"] ? "<tr><td colspan='4' class='empty'>Plan detail unavailable; forecast uses Budget Planned Events.</td></tr>" : model.details.map(x=>"<tr><td>"+esc(dateLabel(x.date))+"</td><td>"+esc(x.event)+"</td><td>"+esc(x.category)+"</td><td class='numeric'>"+fmt(-x.estimated)+"</td></tr>").join("") || "<tr><td colspan='4' class='empty'>No included future one-off plans.</td></tr>";
}
function renderBudgetPlans() {
  if(sourceFailures["Future One-off Plans"]) {$("plan-count").textContent="Incomplete";$("plan-rows").innerHTML="<tr><td colspan='8' class='empty'>Future One-off Plans unavailable: "+esc(sourceFailures["Future One-off Plans"])+"</td></tr>";return;}
  const b=budgetRows[Number($("budget-month").value)];if(!b)return;
  const scope=$("plan-scope").value,search=$("plan-search").value.toLowerCase().trim(),category=$("plan-category").value,status=$("plan-status").value;
  const list=budgetPlans.filter(x=>(scope==="all"||monthKey(x.date)===monthKey(b.month))&&(!category||x.category===category)&&(!status||(status==="included"?x.included:!x.included))&&(!search||[x.event,x.category,x.notes].join(" ").toLowerCase().includes(search)));
  $("plan-count").textContent=list.length+" plans";
  $("plan-rows").innerHTML=list.map(x=>"<tr><td>"+esc(dateLabel(x.date))+"</td><td>"+esc(x.event)+"</td><td><span class='tag'>"+esc(x.category)+"</span></td><td class='numeric'>"+fmt(x.estimated)+"</td><td class='numeric'>"+fmt(x.paid)+"</td><td class='numeric'>"+fmt(x.remaining)+"</td><td>"+(x.included?"Yes":"No")+"</td><td>"+esc(x.notes||"—")+"</td></tr>").join("") || "<tr><td colspan='8' class='empty'>No one-off plans match these filters.</td></tr>";
}
