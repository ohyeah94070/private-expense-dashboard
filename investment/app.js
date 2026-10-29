const BROKERAGE_SHEET = "17026aWw5dDT3-bh9i_W8VMkIzW8K0EQYiWeIUtICYA0";
const GOOGLE_CLIENT_ID = "110894641783-ranndo8u0vmmbq0c59g2vehma2vla4g6.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const PORTFOLIO_RANGES = [
  "'Positions'!A4:I1000", "'Trades'!A4:L1000", "'Cash Ledger'!A4:I1000",
  "'Monthly Activity'!A4:H100", "'Dashboard'!A6", "'Dashboard'!C6",
  "'Dashboard'!E6", "'Dashboard'!A10", "'Dashboard'!C10", "'Dashboard'!E10",
  "'Dashboard'!G10", "'Dashboard'!I10", "'README'!B18",
  "'Monthly Summary'!A1:N100", "'Monthly Valuation'!A1:I100",
  "'Webull Monthly'!A1:R100", "'Webull Holdings'!A1:I200",
  "'Webull Current'!A1:I50", "'Broker Reconciliation'!A1:L100"
];
const MARKET_RANGE = ["'Market Watch'!A1:H9"];
const MARKET_ITEMS = [
  ["INDEXSP:.INX","S&P 500 Index"],["INDEXNASDAQ:NDX","Nasdaq 100 Index"],
  ["NASDAQ:SOXX","SOXX"],["NASDAQ:SMH","SMH"],["NYSEARCA:SPY","SPY"],
  ["NASDAQ:NVDA","NVDA"],["NASDAQ:GOOGL","GOOGL"],["NASDAQ:MU","MU"]
];
const $ = id => document.getElementById(id);
const esc = x => String(x ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money = (x, ccy="HKD") => Number.isFinite(x) ? `${x<0?"(":""}${ccy==="HKD"?"HK$":"$"}${new Intl.NumberFormat("en-HK",{minimumFractionDigits:2,maximumFractionDigits:2}).format(Math.abs(x))}${x<0?")":""}` : "—";
const number = (x, decimals=0) => Number.isFinite(x) ? new Intl.NumberFormat("en-HK",{minimumFractionDigits:decimals,maximumFractionDigits:decimals}).format(x) : "—";
const percent = x => Number.isFinite(x) ? new Intl.NumberFormat("en-HK",{style:"percent",maximumFractionDigits:2,minimumFractionDigits:1}).format(x) : "—";
const signClass = x => Number.isFinite(x) ? (x < 0 ? "negative" : x > 0 ? "positive" : "") : "";
let tokenClient, token, data, marketRows=[], marketStatus="Connect Google to load market quotes.", activeTab="overview", epoch=0;

$("connect").addEventListener("click", connect);
$("refresh").addEventListener("click", () => token ? load() : connect());
$("disconnect").addEventListener("click", disconnect);
document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));
document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => showTab(b.dataset.go)));
for(const id of ["trade-asset","trade-search"]) $(id).addEventListener(id.endsWith("search")?"input":"change", renderTrades);
for(const id of ["cash-type","cash-search"]) $(id).addEventListener(id.endsWith("search")?"input":"change", renderCash);
$("overview-period").addEventListener("change", render);
$("monthly-bars").addEventListener("click", event => {
  const card=event.target.closest("[data-month]");
  if(card) { $("overview-period").value=card.dataset.month; render(); }
});
$("open-snapshot").addEventListener("click", async()=>{
  $("snapshot-error").textContent="";
  try {
    const recoveryKey=$("snapshot-open-key").value.trim();
    if(!/^[A-Za-z]{12}$/.test(recoveryKey)) throw new Error("Enter the 12-letter recovery key (case-sensitive).");
    const result=await Snapshot.unlock(recoveryKey);
    data=PortfolioModel.parse(result.raw);
    if(!data.positions.length) throw new Error("Saved snapshot has no positions.");
    $("snapshot-open-key").value="";
    $("setup").hidden=true; $("app").hidden=false; $("disconnect").hidden=false;
    $("refresh").hidden=false; $("refresh").textContent="Connect Google";
    $("snapshot-banner").hidden=false;
    $("snapshot-date").textContent="Saved "+new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Hong_Kong"}).format(new Date(result.createdAt))+" HKT · data may be out of date";
    $("sync-status").textContent="Saved snapshot";
    marketRows=[]; marketStatus="Market quotes require Google sign-in; saved snapshots contain portfolio data only.";
    render();
  } catch(e) { $("snapshot-error").textContent=e.name==="OperationError"?"Incorrect recovery key.":e.message; }
});

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
    marketRows=[]; marketStatus="Loading market quotes…";
    $("setup").hidden=true; $("app").hidden=false;
    $("snapshot-banner").hidden=true;
    $("refresh").hidden=false; $("disconnect").hidden=false;
    $("refresh").textContent="Refresh";
    $("sync-status").textContent="Refreshed "+new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Hong_Kong",hour:"2-digit",minute:"2-digit"}).format(new Date())+" HKT";
    render();
    try {
      const result=await batchGet(BROKERAGE_SHEET,MARKET_RANGE,accessToken);
      if(current!==epoch) return;
      marketRows=PortfolioModel.parseMarket(result.valueRanges?.[0]?.values||[]);
      const available=marketRows.filter(row=>Number.isFinite(row.price)).length;
      marketStatus=available?`${available} of ${MARKET_ITEMS.length} quotes available · Google Finance via your private Sheet · quotes may be delayed up to 20 minutes.`:"No current market quotes available; missing or stale values are hidden.";
    } catch(error) {
      if(current!==epoch) return;
      marketRows=[]; marketStatus="Market quotes unavailable. Portfolio data remains available.";
    }
    renderMarket();
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
  ++epoch; token=undefined; data=undefined; marketRows=[];
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
  const selector=$("overview-period"),prior=selector.value;
  selector.innerHTML='<option value="current">Current position + 2026 activity</option>'+data.history.map(x=>`<option value="${esc(x.month)}">${esc(x.month)}</option>`).join("");
  selector.value=[...selector.options].some(x=>x.value===prior)?prior:"current";
  const selected=data.history.find(x=>x.month===selector.value),fx=selected?.fx??data.fx;
  const ytd=PortfolioModel.accountYTD(data);
  $("hero-subtitle").textContent=selected?`${selected.month} month end · official IBKR account value; shares and cash reconstructed`:`IBKR positions ${data.asOf || "—"} · Webull API ${data.webullCurrent.asOf.slice(0,10)||"—"}`;
  $("total-value").textContent=selected?money(selected.totalHKD):money(data.metrics.totalHKD);
  $("equity-value").textContent=selected?money(selected.equityHKD):money(data.metrics.equityHKD);
  $("cash-value").textContent=selected?money(selected.cashTotalHKD):money(data.metrics.cashHKD);
  $("unrealized-value").textContent=selected?money(selected.unrealizedHKD):money(data.metrics.unrealizedHKD);
  $("unrealized-label").textContent=selected?"Open stock P/L · Month end":"Open stock P/L · Cumulative";
  $("realized-label").textContent=selected?"Realized stock P/L · this month":"Realized stock P/L · 2026 YTD";
  $("realized-value").textContent=selected?money(selected.realizedUSD*fx):money(data.metrics.realizedHKD);
  $("period-pnl").textContent=selected?money(selected.totalPL):money(ytd.total);
  $("period-pnl").className=signClass(selected?selected.totalPL:ytd.total);
  $("period-pnl-label").textContent=selected?"Total P/L · this month":"Total P/L · 2026 YTD";
  $("unrealized-value").className=signClass(selected?selected.unrealizedHKD:data.metrics.unrealizedHKD);
  $("realized-value").className=signClass(selected?selected.realizedUSD*fx:data.metrics.realizedHKD);
  $("overview-note").textContent=selected?"Account value and monthly P/L use IBKR's official month-end NAV. January starts from the official 31 Dec 2025 NAV. Equity, cash and open stock P/L are reconstructed; July and August FX and QLD cost basis are anchored to IBKR statements. Other months remain estimates.":`Account value, equity and cash come from the ${data.asOf||"latest"} IBKR account snapshot. 2026 YTD P/L = current account value − official 31 Dec 2025 NAV − recorded 2026 net funding. Open stock P/L is cumulative since purchase, including shares owned before 2026.`;
  renderBrokerReconciliation(); renderWebullCurrent(); renderAllocation(); renderPnL(); renderStockPnL(); renderMonthlyBars(); renderHoldings(); renderWebullHoldings(); renderMonthly(); renderWebullCash(); renderTrades(); renderCash(); renderMarket();
  if(["overview","holdings","activity","watchlist"].includes(location.hash.slice(1))) showTab(location.hash.slice(1));
  else showTab(activeTab);
}
function renderBrokerReconciliation() {
  const rows=data.reconciliation,latest=rows.at(-1);
  $("combined-nav").textContent=money(latest?.combinedNAV);
  $("combined-month").textContent=latest?`${latest.month} · latest month reconciled by both brokers`:"";
  $("ibkr-month-nav").textContent=money(latest?.ibkrNAV);
  $("webull-month-nav").textContent=money(latest?.webullNAV);
  $("broker-reconciliation-rows").innerHTML=rows.map(x=>`<tr><td>${esc(x.month)}${x.note?" <span title=\""+esc(x.note)+"\">ⓘ</span>":""}</td><td class="numeric">${money(x.ibkrNAV)}</td><td class="numeric">${money(x.webullNAV)}</td><td class="numeric"><strong>${money(x.combinedNAV)}</strong></td><td class="numeric ${signClass(x.ibkrPL)}">${money(x.ibkrPL)}</td><td class="numeric ${signClass(x.webullPL)}">${money(x.webullPL)}</td><td class="numeric ${signClass(x.combinedPL)}"><strong>${money(x.combinedPL)}</strong></td><td class="numeric ${signClass(x.combinedFunding)}">${money(x.combinedFunding)}</td><td class="numeric ${signClass(x.check)}">${money(x.check)}</td></tr>`).join("")||'<tr><td colspan="9" class="empty">No broker reconciliation yet.</td></tr>';
}
function renderWebullCurrent() {
  const w=data.webullCurrent;
  $("webull-current-nav").textContent=money(w.nav);
  $("webull-current-cash").textContent=money(w.cash);
  $("webull-current-open").textContent=money(w.unrealized);
  $("webull-current-open").className=signClass(w.unrealized);
  $("webull-current-note").textContent=`Snapshot ${w.asOf||"unavailable"}. This is newer than the latest reconciled statement and is shown separately. Cumulative unrealized P/L is the current open-position balance, not this month's profit.`;
}
function renderWebullHoldings() {
  const period=$("overview-period").value,current=period==="current";
  const rows=current?data.webullCurrent.positions.map(x=>({period:"Current",symbol:x.symbol,type:x.type,shares:x.shares,price:x.price,marketValue:x.marketValue,unrealized:x.unrealized,currency:x.currency})):data.webullHoldings.filter(x=>x.month===period).map(x=>({...x,period:x.month,unrealized:NaN}));
  $("webull-holding-rows").innerHTML=rows.map(x=>`<tr><td>${esc(x.period)}</td><td><strong>${esc(x.symbol)}</strong></td><td>${esc(x.type)}</td><td class="numeric">${number(x.shares,2)}</td><td class="numeric">${money(x.price,x.currency)}</td><td class="numeric">${money(x.marketValue,x.currency)}</td><td class="numeric ${signClass(x.unrealized)}">${money(x.unrealized,x.currency)}</td></tr>`).join("")||'<tr><td colspan="7" class="empty">No Webull holdings for this period.</td></tr>';
  $("webull-holdings-note").textContent=current?`API positions as of ${data.webullCurrent.asOf}. Open P/L uses API cost basis.`:"Month-end quantities, prices and values come from Webull statements. Historical open P/L is unavailable because those statements do not provide cost basis; the monthly account P/L above uses official NAV.";
}
function renderWebullCash() {
  $("webull-cash-rows").innerHTML=data.webullMonthly.map(x=>`<tr><td>${esc(x.month)}</td><td class="numeric">${money(x.deposits)}</td><td class="numeric ${signClass(x.withdrawals)}">${money(x.withdrawals)}</td><td class="numeric ${signClass(x.dividends)}">${money(x.dividends)}</td><td class="numeric ${signClass(x.fees)}">${money(x.fees)}</td><td class="numeric ${signClass(x.other)}">${money(x.other)}</td><td>${x.statement?`<a href="${esc(x.statement)}" target="_blank" rel="noopener noreferrer">Open ↗</a>`:"—"}</td></tr>`).join("");
}
function renderAllocation() {
  const period=$("overview-period").value;
  const holdings=period==="current"?[...data.positions].filter(x=>x.shares>0).sort((a,b)=>b.marketValue-a.marketValue):data.valuations.filter(x=>x.month===period&&x.shares>0).map(x=>({symbol:x.symbol,marketValue:x.marketValue})).sort((a,b)=>b.marketValue-a.marketValue);
  const total=holdings.reduce((s,x)=>s+(Number.isFinite(x.marketValue)?x.marketValue:0),0);
  $("allocation").innerHTML=holdings.map(x=>{
    const share=total>0 ? x.marketValue/total : 0;
    const width=Math.max(2,Math.min(100,share*100));
    return `<div class="allocation-row"><div class="allocation-meta"><b>${esc(x.symbol)}</b><span>${money(x.marketValue,"USD")} <em>${percent(share)}</em></span></div><div class="bar-track"><span style="width:${width.toFixed(2)}%"></span></div></div>`;
  }).join("") || `<p class="empty">No positions available.</p>`;
}
function renderPnL() {
  const m=data.metrics;
  const period=$("overview-period").value;
  let items,note,total,balance="",context="";
  if(period==="current") {
    const ytd=PortfolioModel.accountYTD(data);
    items=[["Latest account value",ytd.closing],["Opening NAV · 31 Dec 2025",-ytd.opening],["Net funding · 2026",-ytd.funding]];
    total=ytd.total;
    const components=[["Realized stock P/L · 2026",m.realizedHKD],["Open stock P/L · cumulative",m.unrealizedHKD],["Dividends · 2026",m.dividendsHKD],["Interest · 2026",m.interestHKD],["Withholding tax · 2026",m.taxHKD]];
    context=`<p class="pnl-scope">DETAIL · DIFFERENT TIME PERIODS, NOT ADDED ABOVE</p>`+components.map(([label,val])=>`<div class="pnl-row"><span>${esc(label)}</span><strong class="${signClass(val)}">${money(val)}</strong></div>`).join("");
    note="2026 YTD account P/L uses IBKR account value after recorded deposits and withdrawals. Open stock P/L includes gains on shares purchased before 2026, so it is shown separately.";
  } else if(period==="2026-01") {
    const row=data.history.find(x=>x.month===period);
    items=[["Month-end account value",row.totalHKD],["Opening NAV · 31 Dec 2025",-row.openingNAV],["Net funding · January",-row.netFundingHKD]];
    total=row.totalPL;
    balance=`<div class="pnl-balance"><span>Open stock P/L · cumulative at month end</span><strong class="${signClass(row.unrealizedHKD)}">${money(row.unrealizedHKD)}</strong></div>`;
    note="January account P/L uses IBKR's official 31 Dec 2025 opening NAV. A December stock-level unrealized balance is not available for a reliable January stock breakdown.";
  } else {
    const result=PortfolioModel.monthlyBreakdown(data.history,data.months,period);
    items=[["Change in unrealized stock P/L",result.changeUnrealized],["Realized stock P/L",result.realized],["Dividends",result.dividends],["Interest",result.interest],["Withholding tax",result.tax],["FX, fees & valuation difference",result.other]];
    total=result.total;
    balance=`<div class="pnl-balance"><span>Open stock P/L · cumulative at month end<br><small>Gain or loss on shares still held</small></span><strong class="${signClass(result.endUnrealized)}">${money(result.endUnrealized)}</strong></div><p class="pnl-scope">THIS MONTH'S CHANGE</p>`;
    note="Monthly P/L uses the change in unrealized P/L since the prior month, plus realized results, income and FX/valuation difference. The cumulative balance above is context, not a separate monthly gain.";
  }
  $("pnl-breakdown").innerHTML=balance+items.map(([label,val])=>`<div class="pnl-row"><span>${esc(label)}</span><strong class="${signClass(val)}">${money(val)}</strong></div>`).join("")+`<div class="pnl-row pnl-total"><span>${period==="current"?"Total P/L · 2026 YTD":"Total P/L this month · after funding"}</span><strong class="${signClass(total)}">${money(total)}</strong></div>`+context;
  $("pnl-note").textContent=note;
}
function renderStockPnL() {
  const period=$("overview-period").value, current=period==="current";
  const rows=PortfolioModel.stockBreakdown(data,period).sort((a,b)=>Math.abs(current?b.open:b.total)-Math.abs(current?a.open:a.total));
  $("stock-pl-title").textContent=current?"Stock P/L by symbol · current & 2026":"Stock P/L by symbol · "+period;
  $("stock-pl-head").innerHTML=current?"<tr><th>Symbol</th><th class='numeric'>Open P/L cumulative</th><th class='numeric'>Realized 2026 YTD</th><th class='numeric'>Dividends & tax 2026 YTD</th></tr>":"<tr><th>Symbol</th><th class='numeric'>Unrealized change</th><th class='numeric'>Realized</th><th class='numeric'>Dividends & tax</th><th class='numeric'>Stock P/L this month</th></tr>";
  $("stock-pl-rows").innerHTML=rows.map(x=>`<tr><td><strong>${esc(x.symbol)}</strong></td><td class="numeric ${signClass(x.open)}">${money(x.open)}</td><td class="numeric ${signClass(x.realized)}">${money(x.realized)}</td><td class="numeric ${signClass(x.income)}">${money(x.income)}</td>${current?"":`<td class="numeric ${signClass(x.total)}"><strong>${money(x.total)}</strong></td>`}</tr>`).join("")||`<tr><td colspan="${current?4:5}" class="empty">No stock P/L records.</td></tr>`;
  $("stock-pl-note").textContent=current?"Open P/L is cumulative on shares still held. Realized P/L and dividends/tax cover 2026; these columns have different time scopes and are not added together.":period==="2026-01"?"January stock P/L needs a December opening unrealized balance. Realized results and dividends/tax are still shown.":"This month's stock P/L = change in unrealized P/L + realized trades + dividends and related tax. Account total P/L also includes interest and FX/valuation differences.";
}
function renderMonthlyBars() {
  const max=Math.max(1,...data.history.map(m=>Number.isFinite(m.totalPL)?Math.abs(m.totalPL):0));
  $("monthly-bars").innerHTML=data.history.map(m=>{
    const amount=m.totalPL, width=Number.isFinite(amount)?Math.max(3,Math.abs(amount)/max*100):0;
    return `<button class="month-result ${signClass(amount)}" type="button" data-month="${esc(m.month)}"><span>${esc(m.month)}</span><strong>${money(amount)}</strong><span class="month-result-track"><i style="width:${width.toFixed(1)}%"></i></span></button>`;
  }).join("") || `<p class="empty">No monthly P/L available.</p>`;
}
function renderMarket() {
  const bySymbol=new Map(marketRows.map(row=>[row.symbol,row]));
  const marketPercent=value=>Number.isFinite(value)?new Intl.NumberFormat("en-HK",{style:"percent",minimumFractionDigits:2,maximumFractionDigits:2}).format(value):"—";
  const changeClass=value=>Number.isFinite(value)?value>0?"up":value<0?"down":"flat":"";
  $("market-rows").innerHTML=MARKET_ITEMS.map(([symbol,label])=>{
    const row=bySymbol.get(symbol),[exchange,ticker]=symbol.split(":"),url=`https://www.google.com/finance/quote/${encodeURIComponent(ticker)}:${encodeURIComponent(exchange)}`;
    const detail=symbol.startsWith("INDEX")?symbol:(row?.name||symbol);
    const price=row?.price,high=row?.high,low=row?.low;
    const validRange=Number.isFinite(price)&&Number.isFinite(high)&&Number.isFinite(low)&&high>low&&low>0;
    const progress=validRange?Math.max(0,Math.min(100,(price-low)/(high-low)*100)):0;
    return `<tr><td class="market-symbol"><a href="${url}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a><small>${esc(detail)}</small></td><td class="numeric market-quote">${Number.isFinite(price)?number(price,2):"—"}<small>${symbol.startsWith("INDEX")?"points":"USD"}</small></td><td class="numeric market-change ${changeClass(row?.day)}">${marketPercent(row?.day)}</td><td class="numeric market-change ${changeClass(row?.week)}">${marketPercent(row?.week)}</td><td class="market-range-cell"><div class="market-range-values"><span>${Number.isFinite(low)?number(low,2):"—"}</span><span>${Number.isFinite(high)?number(high,2):"—"}</span></div><div class="market-range-track">${validRange?`<i style="left:${progress.toFixed(1)}%"></i>`:""}</div></td><td class="market-updated">${row?.updatedAt?esc(row.updatedAt):"—"}</td></tr>`;
  }).join("");
  const latest=marketRows.map(row=>row.updatedAt).filter(Boolean).sort().at(-1);
  $("market-updated").textContent=latest?`Latest source quote: ${latest}`:"Quote time unavailable";
  $("market-status").textContent=marketStatus;
}
function renderHoldings() {
  const period=$("overview-period").value, current=period==="current";
  const holdings=PortfolioModel.holdingsForPeriod(data,period);
  const cashUSD=PortfolioModel.cashUSDForPeriod(data,period);
  const total=holdings.reduce((s,x)=>s+(Number.isFinite(x.marketValue)?x.marketValue:0),0);
  $("position-count").textContent=number(holdings.length);
  $("holding-total").textContent=money(total,"USD");
  $("holding-cash").textContent=money(cashUSD,"USD");
  $("largest-symbol").textContent=holdings[0]?.symbol||"—";
  $("largest-weight").textContent=holdings[0]&&total>0?`${percent(holdings[0].marketValue/total)} of equity value`:"";
  $("holdings-scope").textContent=current?"CURRENT POSITIONS":"MONTH-END POSITIONS";
  $("holding-asof").textContent=current?(data.asOf?`As of ${data.asOf}`:""):`${period} month end`;
  $("holding-price-head").textContent=current?"Last price":"Month-end close";
  $("holdings-note").textContent=current?"IBKR stock prices and unrealized P/L come from the latest IBKR snapshot. Cash is converted to USD using the displayed portfolio FX rate.":"Historical IBKR shares and cost bases are reconstructed from trades; closing prices come from IBKR daily history. Values are estimates until reconciled with monthly statements.";
  const stockRows=holdings.map(x=>`<tr><td>${esc(x.broker)}</td><td><strong>${esc(x.symbol)}</strong></td><td class="numeric">${number(x.shares)}</td><td class="numeric">${money(x.averageCost,"USD")}</td><td class="numeric">${money(x.lastPrice,"USD")}</td><td class="numeric">${money(x.marketValue,"USD")}</td><td class="numeric ${signClass(x.unrealized)}">${money(x.unrealized,"USD")}</td><td class="numeric">${total>0?percent(x.marketValue/total):"—"}</td></tr>`).join("");
  const cashRow=`<tr class="cash-holding"><td>IBKR</td><td><strong>Cash</strong><small>USD equivalent</small></td><td class="numeric">—</td><td class="numeric">—</td><td class="numeric">—</td><td class="numeric"><strong>${money(cashUSD,"USD")}</strong></td><td class="numeric">—</td><td class="numeric">—</td></tr>`;
  $("holding-rows").innerHTML=stockRows+cashRow;
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
