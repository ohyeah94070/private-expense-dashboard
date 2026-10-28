const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const RANGES = ["Stmt!A1:U54", "Budget!A1:J38", "'Income & Transfers'!A1:O300", "'Large exp.'!A1:C300", "'Ex. Rate'!A1:D400"];
const $ = (id) => document.getElementById(id);
const money = (n) => Number.isFinite(n) ? new Intl.NumberFormat("zh-HK", {style:"currency",currency:"HKD",maximumFractionDigits:0}).format(n) : "—";
const num = (x) => typeof x === "number" ? x : (x === "" || x == null ? NaN : Number(x));
const serialDate = (n) => new Date(Date.UTC(1899,11,30) + n * 86400000);
const dateLabel = (n) => Number.isFinite(n) ? new Intl.DateTimeFormat("zh-HK",{year:"numeric",month:"short",day:"numeric",timeZone:"UTC"}).format(serialDate(n)) : "—";
const monthKey = (n) => Number.isFinite(n) ? serialDate(n).toISOString().slice(0,7) : "";
const dayNow = Math.floor((Date.now() - Date.UTC(1899,11,30))/86400000);
let tokenClient, accessToken, raw, periods = [], budgetRows = [];

$("client-id").value = localStorage.getItem("expense-google-client-id") || "";
$("sheet-id").value = localStorage.getItem("expense-sheet-id") || "";

$("connect").addEventListener("click", () => {
  const clientId = $("client-id").value.trim();
  const sheetId = $("sheet-id").value.trim();
  $("connect-error").textContent = "";
  if (!clientId.endsWith(".apps.googleusercontent.com")) { $("connect-error").textContent = "請填入有效的 Google OAuth Client ID。"; return; }
  if (!/^[A-Za-z0-9_-]{20,}$/.test(sheetId)) { $("connect-error").textContent = "請填入有效的 Google 試算表 ID。"; return; }
  if (!window.google?.accounts?.oauth2) { $("connect-error").textContent = "Google 登入程式尚未載入，請稍後重試。"; return; }
  localStorage.setItem("expense-google-client-id", clientId);
  localStorage.setItem("expense-sheet-id", sheetId);
  tokenClient = google.accounts.oauth2.initTokenClient({client_id:clientId,scope:SCOPE,callback:async ({access_token,error}) => {
    if (error || !access_token) { $("connect-error").textContent = "Google 授權失敗。請確認網站網址已加入 OAuth JavaScript 來源。"; return; }
    accessToken = access_token;
    await loadData();
  }});
  tokenClient.requestAccessToken({prompt:"consent"});
});
$("refresh").addEventListener("click", async () => { if (accessToken) await loadData(); else $("connect").click(); });
$("disconnect").addEventListener("click", () => {
  if (accessToken && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(accessToken, () => {});
  accessToken = undefined; raw = undefined; periods = [];
  $("dashboard").hidden = true; $("setup").hidden = false; $("sync-time").textContent = "已登出";
});
$("period").addEventListener("change", render);

async function loadData() {
  $("connect-error").textContent = "讀取中…";
  const params = new URLSearchParams({valueRenderOption:"UNFORMATTED_VALUE",majorDimension:"ROWS"});
  for (const range of RANGES) params.append("ranges",range);
  try {
    const sheetId = localStorage.getItem("expense-sheet-id");
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?${params}`,{headers:{Authorization:`Bearer ${accessToken}`},cache:"no-store"});
    if (!response.ok) throw new Error(response.status === 403 ? "此 Google 帳戶沒有讀取權，或 Sheets API 尚未啟用。" : `讀取失敗 (${response.status})`);
    const json = await response.json();
    raw = Object.fromEntries(json.valueRanges.map((item,i) => [RANGES[i].split("!")[0].replaceAll("'",""),item.values || []]));
    extract();
    $("setup").hidden = true; $("dashboard").hidden = false;
    $("connect-error").textContent = "";
    $("sync-time").textContent = `更新於 ${new Intl.DateTimeFormat("zh-HK",{hour:"2-digit",minute:"2-digit"}).format(new Date())}`;
    render();
  } catch (error) { $("connect-error").textContent = error.message; }
}

function cell(rows,row,col) { return num(rows[row]?.[col]); }
function extract() {
  const s = raw.Stmt || [];
  periods = [];
  for (let dateCol=7;dateCol<=19;dateCol+=2) {
    const end = cell(s,0,dateCol), start = cell(s,0,dateCol-2);
    const snapshot = s.slice(2,27).some(row => row[dateCol] !== undefined && row[dateCol] !== "");
    if (!Number.isFinite(end) || end>dayNow || !snapshot) continue;
    const outCol = dateCol+1;
    periods.push({end,start,label:dateLabel(end),expense:cell(s,47,outCol),large:cell(s,49,outCol),housing:cell(s,50,outCol),routine:cell(s,51,outCol),savings:cell(s,53,outCol),nav:cell(s,36,outCol),salary:cell(s,42,outCol),investment:cell(s,43,outCol),mpf:cell(s,44,outCol),otherIncome:cell(s,45,outCol),movement:cell(s,36,dateCol)});
  }
  const b = raw.Budget || [];
  budgetRows = b.slice(4,28).filter(row => Number.isFinite(num(row[0]))).map(row => ({month:num(row[0]),income:num(row[1]),housing:num(row[2]),routine:num(row[3]),other:num(row[4]),events:num(row[5]),expenses:num(row[6]),surplus:num(row[7]),actual:num(row[8])}));
  const selector = $("period"), old = selector.value;
  selector.innerHTML = periods.map((p,i) => `<option value="${i}">${p.label}</option>`).join("");
  selector.value = old && Number(old)<periods.length ? old : String(Math.max(0,periods.length-1));
}

function render() {
  const p = periods[Number($("period").value)];
  if (!p) { $("dashboard").innerHTML = "<p>目前沒有可分析的已完成對帳期間。</p>"; return; }
  const b = budgetRows.find(row => monthKey(row.month) === monthKey(p.end));
  $("expense").textContent = money(-p.expense);
  $("savings").textContent = money(p.savings);
  $("variance").textContent = b && Number.isFinite(b.surplus) ? money(p.savings-b.surplus) : "—";
  $("nav").textContent = money(p.nav);
  $("asof").textContent = `截至 ${p.label}`;
  $("expense-caption").textContent = `${dateLabel(p.start)} 至 ${p.label} · ${Math.round(p.end-p.start)} 天`;
  renderTrend(); renderBridge(p); renderBudget(p,b); renderTable(); renderHealth(p);
}

function renderTrend() {
  const valid = periods.filter(p => Number.isFinite(p.expense) && Number.isFinite(p.savings));
  const max = Math.max(1,...valid.flatMap(p => [Math.abs(p.expense),Math.abs(p.savings)]));
  const w = 900,h=235,left=55,bottom=186,step=(w-left-20)/Math.max(1,valid.length);
  const bars = valid.map((p,i) => { const x=left+i*step+step*.2, bw=Math.min(32,step*.22); const eh=Math.abs(p.expense)/max*135,sh=Math.abs(p.savings)/max*135; return `<g><rect x="${x}" y="${bottom-eh}" width="${bw}" height="${eh}" rx="4" fill="#cf745f"><title>${p.label} 花費 ${money(-p.expense)}</title></rect><rect x="${x+bw+5}" y="${bottom-sh}" width="${bw}" height="${sh}" rx="4" fill="#6a9a70"><title>${p.label} 儲蓄 ${money(p.savings)}</title></rect><text x="${x+bw}" y="212" text-anchor="middle" font-size="11" fill="#688071">${new Intl.DateTimeFormat("zh-HK",{month:"short",timeZone:"UTC"}).format(serialDate(p.end))}</text></g>`; }).join("");
  $("trend").innerHTML = `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><line x1="${left}" y1="${bottom}" x2="${w-10}" y2="${bottom}" stroke="#b9cbbb"/><text x="0" y="${bottom}" fill="#708676" font-size="11">0</text><text x="0" y="50" fill="#708676" font-size="11">${Math.round(max/1000)}k</text>${bars}</svg>`;
}
function renderBridge(p) {
  const rows = [["淨值變動",p.movement],["薪金收入",-p.salary],["投資收益調整",-p.investment],["強積金收益調整",-p.mpf],["其他收入",-p.otherIncome],["推算花費",p.expense]];
  $("bridge").innerHTML = rows.map(([label,value]) => `<div class="bridge-row"><span>${label}</span><strong>${money(value)}</strong></div>`).join("");
}
function renderBudget(p,b) {
  if (!b) { $("budget").innerHTML = "<p class='footnote'>這個對帳期間沒有對應的月度預算。預算自 2026 年 10 月開始。</p>"; return; }
  const actual = -p.expense, planned = b.expenses, max=Math.max(actual,planned,1);
  $("budget").innerHTML = [["預算總支出",planned,""],["推算實際花費",actual,"actual"]].map(([label,value,cls]) => `<div class="budget-item"><div class="label"><span>${label}</span><b>${money(value)}</b></div><div class="track"><div class="fill ${cls}" style="width:${Math.min(100,Math.max(0,value/max*100))}%"></div></div></div>`).join("");
}
function renderTable() {
  $("period-rows").innerHTML = periods.map(p => `<tr><td>${p.label}</td><td>${money(-p.expense)}</td><td>${money(-p.large)}</td><td>${money(-p.housing)}</td><td>${money(-p.routine)}</td><td>${money(p.savings)}</td></tr>`).join("");
}
function renderHealth(p) {
  const rate = raw["Ex. Rate"] || [];
  let lastRate = NaN;
  for (const row of rate.slice(1)) if (Number.isFinite(num(row[0])) && [1,2,3].every(i => num(row[i])>0)) lastRate = num(row[0]);
  const gaps = periods.filter(x => [x.expense,x.savings,x.nav].some(v => !Number.isFinite(v))).length;
  const items = [
    {ok:gaps===0,title:gaps===0?"已完成期間可計算":"有期間含公式錯誤",detail:gaps===0?"已完成對帳期間的主要數字皆可讀取。":`${gaps} 個期間的花費、儲蓄或淨值缺少有效數字。`},
    {ok:lastRate>=dayNow-3,title:"匯率更新",detail:Number.isFinite(lastRate)?`最新完整匯率日期：${dateLabel(lastRate)}。` : "找不到完整匯率。"},
    {ok:Number.isFinite(p.expense) && Number.isFinite(p.savings),title:"當期對帳",detail:"網站直接呈現 Stmt 的推算結果，未自行改寫原始公式。"}
  ];
  $("health").innerHTML = items.map(x => `<div class="health-item ${x.ok?"ok":"warn"}"><b>${x.ok?"✓":"!"} ${x.title}</b><span>${x.detail}</span></div>`).join("");
}
