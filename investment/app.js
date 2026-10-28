const BROKERAGE_SHEET = "17026aWw5dDT3-bh9i_W8VMkIzW8K0EQYiWeIUtICYA0";
const GOOGLE_CLIENT_ID = "110894641783-ranndo8u0vmmbq0c59g2vehma2vla4g6.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const PORTFOLIO_RANGES = [
  "'Positions'!A4:I1000", "'Trades'!A4:L1000", "'Cash Ledger'!A4:I1000",
  "'Monthly Activity'!A4:H100", "'Dashboard'!A6", "'Dashboard'!C6",
  "'Dashboard'!E6", "'Dashboard'!A10", "'Dashboard'!C10", "'Dashboard'!E10",
  "'Dashboard'!G10", "'Dashboard'!I10", "'README'!B18"
];
const $ = id => document.getElementById(id);
const esc = x => String(x ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money = (x, ccy="HKD") => Number.isFinite(x) ? `${x<0?"(":""}${ccy==="HKD"?"HK$":"$"}${new Intl.NumberFormat("en-HK",{minimumFractionDigits:2,maximumFractionDigits:2}).format(Math.abs(x))}${x<0?")":""}` : "—";
const number = (x, decimals=0) => Number.isFinite(x) ? new Intl.NumberFormat("en-HK",{minimumFractionDigits:decimals,maximumFractionDigits:decimals}).format(x) : "—";
const percent = x => Number.isFinite(x) ? new Intl.NumberFormat("en-HK",{style:"percent",maximumFractionDigits:2,minimumFractionDigits:1}).format(x) : "—";
const signClass = x => Number.isFinite(x) ? (x < 0 ? "negative" : x > 0 ? "positive" : "") : "";
let tokenClient, token, data, activeTab="overview", epoch=0;

$("connect").addEventListener("click", connect);
$("refresh").addEventListener("click", () => token ? load() : connect());
$("disconnect").addEventListener("click", disconnect);
document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));
document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => showTab(b.dataset.go)));
for(const id of ["trade-asset","trade-search"]) $(id).addEventListener(id.endsWith("search")?"input":"change", renderTrades);
for(const id of ["cash-type","cash-search"]) $(id).addEventListener(id.endsWith("search")?"input":"change", renderCash);

function setError(message) { $("connect-error").textContent = message; }
function connect() {
  const clientId = GOOGLE_CLIENT_ID;
  setError("");
  if (!window.google?.accounts?.oauth2) return setError("Google sign-in is still loading. Try again in a moment.");
  tokenClient = google.accounts.oauth2.initTokenClient({client_id:clientId,scope:SCOPE,callback:async result => {
    if (result.error || !result.access_token) return setError("Google sign-in did not complete. Check the selected account and OAuth settings.");
    token = result.access_token;
    await load();
  }});
  tokenClient.requestAccessToken({prompt:""});
}

async function batchGet(sheetId, ranges, accessToken) {
  const q = new URLSearchParams({valueRenderOption:"UNFORMATTED_VALUE",majorDimension:"ROWS"});
  ranges.forEach(r => q.append("ranges",r));
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?${q}`,{
    headers:{Authorization:`Bearer ${accessToken}`},cache:"no-store"
  });
  if (!response.ok) {
    const why = response.status===403 ? "The Google account cannot read one of the private sheets, or the Sheets API is not enabled." :
      response.status===401 ? "Google access expired. Connect again." : `Google Sheets request failed (${response.status}).`;
    throw new Error(why);
  }
  return response.json();
}

async function load() {
  const current=++epoch, accessToken=token;
  $("sync-status").textContent = "Loading sheets…";
  setError("");
  try {
    const portfolio = await batchGet(BROKERAGE_SHEET,PORTFOLIO_RANGES,accessToken);
    if (current!==epoch) return;
    const next = PortfolioModel.parse(portfolio);
    if (!next.positions.length || !Number.isFinite(next.metrics.totalHKD)) throw new Error("The brokerage sheet did not return its expected position and dashboard data.");
    data=next;
    $("setup").hidden=true; $("app").hidden=false;
    $("refresh").hidden=false; $("disconnect").hidden=false;
    $("sync-status").textContent="Refreshed "+new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Hong_Kong",hour:"2-digit",minute:"2-digit"}).format(new Date())+" HKT";
    render();
  } catch(e) {
    if (current!==epoch) return;
    const message=e.message || "Could not load the sheets.";
    if (data) $("sync-status").textContent="Refresh failed · showing previous data";
    else { $("sync-status").textContent="Not connected"; setError(message); }
    if (data) alert(message);
  }
}

function disconnect() {
  const old=token;
  ++epoch; token=undefined; data=undefined;
  const finish=()=>location.reload();
  if(old && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(old,finish);
  setTimeout(finish,1200);
}
function showTab(name) {
  activeTab=name;
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
  document.querySelectorAll(".view").forEach(v=>v.hidden=v.id!==`view-${name}`);
  location.hash=name;
}
function render() {
  $("hero-subtitle").textContent=`IBKR positions ${data.asOf || "—"} · Cash activity through ${data.cashThrough || "—"} · Webull data pending`;
  $("total-value").textContent=money(data.metrics.totalHKD);
  $("equity-value").textContent=money(data.metrics.equityHKD);
  $("unrealized-value").textContent=money(data.metrics.unrealizedHKD);
  $("realized-value").textContent=money(data.metrics.realizedHKD);
  $("unrealized-value").className=signClass(data.metrics.unrealizedHKD);
  $("realized-value").className=signClass(data.metrics.realizedHKD);
  $("overview-note").textContent=`Top values match the Brokerage Portfolio Tracker Dashboard. USD amounts are shown in HKD using its reference rate (${number(data.fx,4)} HKD per USD). Equity and cash snapshots have different dates; this is not a YTD return.`;
  renderAllocation(); renderPnL(); renderMonthlyBars(); renderHoldings(); renderMonthly(); renderTrades(); renderCash();
  if(["overview","holdings","activity","watchlist"].includes(location.hash.slice(1))) showTab(location.hash.slice(1));
  else showTab(activeTab);
}
function renderAllocation() {
  const holdings=[...data.positions].filter(x=>x.shares>0).sort((a,b)=>b.marketValue-a.marketValue);
  const total=holdings.reduce((s,x)=>s+(Number.isFinite(x.marketValue)?x.marketValue:0),0);
  $("allocation").innerHTML=holdings.map(x=>{
    const share=total>0 ? x.marketValue/total : 0;
    const width=Math.max(2,Math.min(100,share*100));
    return `<div class="allocation-row"><div class="allocation-meta"><b>${esc(x.symbol)}</b><span>${money(x.marketValue,"USD")} <em>${percent(share)}</em></span></div><div class="bar-track"><span style="width:${width.toFixed(2)}%"></span></div></div>`;
  }).join("") || `<p class="empty">No positions available.</p>`;
}
function renderPnL() {
  const m=data.metrics;
  const items=[["Realized stock P/L · 2026",m.realizedHKD],["Unrealized position P/L · current",m.unrealizedHKD],["Dividends · 2026",m.dividendsHKD],["Interest · 2026",m.interestHKD],["Withholding tax · 2026",m.taxHKD]];
  $("pnl-breakdown").innerHTML=items.map(([label,val])=>`<div class="pnl-row"><span>${esc(label)}</span><strong class="${signClass(val)}">${money(val)}</strong></div>`).join("");
}
function renderMonthlyBars() {
  const max=Math.max(1,...data.months.map(m=>Number.isFinite(m.trades)?m.trades:0));
  $("monthly-bars").innerHTML=data.months.map(m=>`<div class="month-bar"><span>${esc(m.month)}</span><div class="bar-track"><i style="height:${Math.max(0,Math.min(100,(m.trades||0)/max*100)).toFixed(1)}%"></i></div><b>${number(m.trades)}</b></div>`).join("") || `<p class="empty">No monthly activity available.</p>`;
}
function renderHoldings() {
  const holdings=[...data.positions].filter(x=>x.shares>0).sort((a,b)=>b.marketValue-a.marketValue);
  const total=holdings.reduce((s,x)=>s+(Number.isFinite(x.marketValue)?x.marketValue:0),0);
  $("position-count").textContent=number(holdings.length);
  $("holding-total").textContent=money(total,"USD");
  $("largest-symbol").textContent=holdings[0]?.symbol||"—";
  $("largest-weight").textContent=holdings[0]&&total>0?`${percent(holdings[0].marketValue/total)} of equity value`:"";
  $("holding-asof").textContent=data.asOf?`As of ${data.asOf}`:"";
  $("holding-rows").innerHTML=holdings.map(x=>`<tr><td>${esc(x.broker)}</td><td><strong>${esc(x.symbol)}</strong></td><td class="numeric">${number(x.shares)}</td><td class="numeric">${money(x.averageCost,"USD")}</td><td class="numeric">${money(x.lastPrice,"USD")}</td><td class="numeric">${money(x.marketValue,"USD")}</td><td class="numeric ${signClass(x.unrealized)}">${money(x.unrealized,"USD")}</td><td class="numeric">${total>0?percent(x.marketValue/total):"—"}</td></tr>`).join("") || `<tr><td colspan="8" class="empty">No positions available.</td></tr>`;
}
function renderMonthly() {
  $("month-rows").innerHTML=data.months.map(m=>`<tr><td>${esc(m.month)}</td><td class="numeric">${number(m.trades)}</td><td class="numeric">${money(m.deposits)}</td><td class="numeric ${signClass(m.withdrawals)}">${money(m.withdrawals)}</td><td class="numeric">${money(m.dividends,"USD")}</td><td class="numeric ${signClass(m.interest)}">${money(m.interest,"USD")}</td><td class="numeric ${signClass(m.tax)}">${money(m.tax,"USD")}</td><td class="numeric ${signClass(m.realized)}">${money(m.realized,"USD")}</td></tr>`).join("") || `<tr><td colspan="8" class="empty">No monthly data available.</td></tr>`;
  $("trade-count").textContent=number(data.trades.length);
  $("dividend-value").textContent=money(data.metrics.dividendsHKD);
  $("interest-tax-value").textContent=money(data.metrics.interestHKD+data.metrics.taxHKD);
  $("activity-coverage").textContent=data.months.length?`${data.months[0].month} to ${data.months.at(-1).month}`:"";
}
function renderTrades() {
  if(!data) return;
  const q=$("trade-search").value.trim().toUpperCase(),asset=$("trade-asset").value;
  const selected=data.trades.filter(x=>(!asset||x.asset===asset)&&(!q||x.symbol.toUpperCase().includes(q))).sort((a,b)=>b.date.localeCompare(a.date));
  $("trade-rows").innerHTML=selected.map(x=>`<tr><td>${esc(x.date)}</td><td>${esc(x.broker)}</td><td><strong>${esc(x.symbol)}</strong></td><td><span class="badge">${esc(x.side)}</span></td><td class="numeric">${number(x.quantity,2)}</td><td class="numeric">${number(x.price,4)}</td><td>${esc(x.currency)}</td><td class="numeric">${number(x.commission,2)}</td><td class="numeric ${signClass(x.realized)}">${money(x.realized,x.currency==="USD"?"USD":"HKD")}</td></tr>`).join("") || `<tr><td colspan="9" class="empty">No matching trades.</td></tr>`;
  $("trade-result").textContent=`${selected.length} of ${data.trades.length} executions shown · FX trades are included.`;
}
function renderCash() {
  if(!data) return;
  const q=$("cash-search").value.trim().toUpperCase(),type=$("cash-type").value;
  const selected=data.cash.filter(x=>(!type||x.type===type)&&(!q||`${x.description} ${x.symbol}`.toUpperCase().includes(q))).sort((a,b)=>b.date.localeCompare(a.date));
  $("cash-rows").innerHTML=selected.map(x=>`<tr><td>${esc(x.date)}</td><td><span class="badge">${esc(x.type)}</span></td><td>${esc(x.currency)}</td><td class="numeric ${signClass(x.amount)}">${money(x.amount,x.currency)}</td><td>${esc(x.symbol)||"—"}</td><td>${esc(x.description)}</td><td>${esc(x.settlement)}</td></tr>`).join("") || `<tr><td colspan="7" class="empty">No matching cash records.</td></tr>`;
  $("cash-result").textContent=`${selected.length} of ${data.cash.length} non-trade cash records shown.`;
}
