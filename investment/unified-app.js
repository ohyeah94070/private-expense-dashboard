const uMoney=(x,c="HKD")=>c==="HKD"||c==="USD"?money(x,c):Number.isFinite(x)?`${x<0?"(":""}${esc(c)} ${new Intl.NumberFormat("en-HK",{minimumFractionDigits:2,maximumFractionDigits:2}).format(Math.abs(x))}${x<0?")":""}`:"—";
const uDate=x=>String(x||"").slice(0,10);
function unifiedControls(){
  if($("broker-filter"))return;
  const host=document.querySelector(".hero > div:last-child");
  host.insertAdjacentHTML("afterbegin",'<label for="broker-filter">Broker</label><select id="broker-filter" aria-label="Broker filter"><option value="ALL">All Brokers</option><option value="IBKR">IBKR</option><option value="Webull">Webull</option></select>');
  $("broker-filter").addEventListener("change",renderUnified);
  document.querySelector('label[for="overview-period"]').textContent="Reporting period";
}
function unifiedPeriod(){return $("overview-period").value||"current"}
function unifiedFilter(){return $("broker-filter")?.value||"ALL"}
function renderUnified(){
  if(!data)return;
  unifiedControls();
  const period=$("overview-period"),before=period.value;
  period.innerHTML='<option value="current">Latest snapshots</option>'+data.reconciliation.map(x=>`<option value="${esc(x.month)}">${esc(x.month)}</option>`).join("");
  period.value=[...period.options].some(x=>x.value===before)?before:"current";
  const p=unifiedPeriod(),f=unifiedFilter(),s=UnifiedPortfolio.summary(data,p,f);
  $("hero-subtitle").textContent=p==="current"?`Latest snapshots · ${s.asOf}`:`${p} · month-end data · ${s.status}`;
  renderUnifiedOverview(p,f,s);
  renderUnifiedHoldings(p,f,s);
  renderUnifiedActivity(f);
  renderMarket();
  if(["overview","holdings","activity","watchlist"].includes(location.hash.slice(1)))showTab(location.hash.slice(1));
  else showTab(activeTab);
}
function metric(label,value,detail="",tone=false){return `<article class="metric"><span>${esc(label)}</span><strong class="${tone?signClass(value):""}">${uMoney(value)}</strong><small>${esc(detail)}</small></article>`}
function renderUnifiedOverview(period,filter,s){
  const rows=UnifiedPortfolio.monthly(data,filter),label=filter==="ALL"?"Portfolio":filter;
  const latest=rows.at(-1),current=period==="current",ytdLabel=current?`2026 YTD P/L · through ${s.latestMonth||"—"}`:"2026 YTD portfolio P/L";
  const timed=current&&filter==="ALL"&&uDate(data.asOf)!==uDate(data.webullCurrent.asOf);
  const navNote=timed?"Indicative sum; broker snapshots have different dates.":current?"Latest broker snapshot.":"Official month-end account value.";
  const realizedDetail=filter==="IBKR"?"IBKR stock trades only":"Unavailable: Webull historical realized P/L incomplete";
  $("unified-overview").innerHTML=`
    <div class="section-title"><div><p class="eyebrow">${esc(label.toUpperCase())} SUMMARY</p><h2>Portfolio summary</h2></div><span class="muted">${esc(s.asOf)}</span></div>
    <div class="metrics overview-metrics">${metric("Total NAV",s.nav,navNote)}${metric("Equity & fund value",s.equity,"HKD equivalent")}${metric("Total cash",s.cash,"HKD equivalent")}${metric("Open position P/L · cumulative",s.unrealized,period==="current"?"Snapshot value":"Webull month-end cost basis missing",true)}${metric("Realized stock P/L · 2026",s.realized,realizedDetail,true)}${metric(ytdLabel,s.ytdPL,current?"Official months only · recorded cash flows":s.status,true)}</div>
    <p class="data-note">${timed?"Current IBKR and Webull snapshots are not synchronized. Combined current NAV is indicative, not a same-time valuation.":""} Realized P/L is not added to cumulative unrealized P/L to calculate portfolio P/L. Dividends, interest, tax, fees and FX also affect account results.</p>
    <article class="panel"><div class="panel-head"><div><p class="eyebrow">OFFICIAL MONTH-END VALUES</p><h2>Monthly portfolio performance</h2></div></div><div class="table-wrap"><table><thead><tr><th>Month</th><th class="numeric">IBKR NAV</th><th class="numeric">Webull NAV</th><th class="numeric">${esc(label)} NAV</th><th class="numeric">Net external funding</th><th class="numeric">${esc(label)} P/L</th><th class="numeric">Return</th><th>Check</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.month)}</td><td class="numeric">${uMoney(r.ibkrNAV)}</td><td class="numeric">${uMoney(r.webullNAV)}</td><td class="numeric"><strong>${uMoney(r.nav)}</strong></td><td class="numeric">${uMoney(r.funding)}</td><td class="numeric ${signClass(r.pl)}"><strong>${uMoney(r.pl)}</strong></td><td class="numeric">${percent(r.monthlyReturn)}</td><td><span class="status ${r.status==="Complete"?"good":"warn"}" title="${esc(r.note)}">${esc(r.status)}</span></td></tr>`).join("")}</tbody></table></div><p class="panel-note">P/L = ending official NAV − previous official NAV − net funding. January starts from both official 31 Dec 2025 NAVs. Return is shown only when monthly funding is zero; cash-flow timing is needed for a reliable Dietz or TWR result. Different broker cash flows are ordinary unless source records show otherwise. “Check” compares calculated and stored amounts.</p></article>
    <div class="panel-grid"><article class="panel"><div class="panel-head"><div><p class="eyebrow">ALLOCATION</p><h2>Where the value sits</h2></div></div><div id="unified-allocation"></div></article><article class="panel"><div class="panel-head"><div><p class="eyebrow">PROFIT & LOSS</p><h2>Portfolio result</h2></div></div><div class="pnl-row"><span>${current?"Latest complete month":"Selected month"}</span><strong>${current?esc(s.lastComplete?.month||"—"):esc(period)}</strong></div><div class="pnl-row pnl-total"><span>Total portfolio P/L</span><strong class="${signClass(current?s.lastComplete?.pl:s.monthlyPL)}">${uMoney(current?s.lastComplete?.pl:s.monthlyPL)}</strong></div><p class="panel-note">Account-level result includes stocks, dividends, interest, tax, fees and FX. Current month P/L awaits both brokers' month-end statements and complete cash flows.</p></article></div>
    <article class="panel"><div class="panel-head"><div><p class="eyebrow">BY SYMBOL</p><h2>Open position P/L</h2></div></div><div class="table-wrap"><table><thead><tr><th>Symbol</th><th class="numeric">Shares</th><th class="numeric">Market value</th><th class="numeric">Cumulative open P/L</th><th>Coverage</th></tr></thead><tbody id="unified-stock-pl"></tbody></table></div><p class="panel-note">Month-end Webull statements do not provide historical cost basis. Current values may use different quote times; stock-level results do not equal account-level monthly P/L.</p></article>`;
  const holdings=UnifiedPortfolio.aggregatePositions(UnifiedPortfolio.positions(data,period,filter));
  const allocated=holdings.filter(x=>Number.isFinite(x.valueHKD));
  const cash=s.cash;
  const all=[...allocated.map(x=>({name:x.symbol,value:x.valueHKD})),...(Number.isFinite(cash)?[{name:"Cash",value:cash}]:[])];
  const total=all.reduce((a,b)=>a+b.value,0);
  $("unified-allocation").innerHTML=all.map(x=>`<div class="allocation-row"><div class="allocation-meta"><b>${esc(x.name)}</b><span>${uMoney(x.value)} <em>${percent(total>0?x.value/total:NaN)}</em></span></div><div class="bar-track"><span style="width:${Math.max(0,Math.min(100,total>0?x.value/total*100:0)).toFixed(1)}%"></span></div></div>`).join("")||'<p class="empty">No allocation data.</p>';
  $("unified-stock-pl").innerHTML=holdings.map(x=>`<tr><td><strong>${esc(x.symbol)}</strong><small> ${esc(x.currency)}</small></td><td class="numeric">${number(x.quantity,2)}</td><td class="numeric">${uMoney(x.marketValue,x.currency)}</td><td class="numeric ${signClass(x.unrealizedPL)}">${uMoney(x.unrealizedPL,x.currency)}</td><td>${Number.isFinite(x.unrealizedPL)?"Available":"Partial"}</td></tr>`).join("")||'<tr><td colspan="5" class="empty">No positions.</td></tr>';
  const open=UnifiedPortfolio.openPositions(data,period,filter),hasOpen=open.some(x=>x.partsOpen.some(p=>Number.isFinite(p.value)));
  const incomplete=open.some(x=>x.coverage==="Partial"),knownOpen=hasOpen?open.reduce((sum,x)=>sum+x.knownOpenHKD,0):NaN;
  if(incomplete&&period!=="current"){
    const kpi=$("unified-overview").querySelector(".overview-metrics .metric:nth-child(4)");
    kpi.querySelector("span").textContent="Known open P/L · partial";
    kpi.querySelector("strong").textContent=uMoney(knownOpen);
    kpi.querySelector("strong").className=signClass(knownOpen);
    kpi.querySelector("small").textContent="Webull historical cost basis missing";
  }
  const stockTable=$("unified-stock-pl").closest("table");
  stockTable.querySelector("thead").innerHTML="<tr><th>Symbol</th><th class='numeric'>IBKR open P/L</th><th class='numeric'>Webull open P/L</th><th class='numeric'>Combined open P/L</th><th>Coverage</th></tr>";
  $("unified-stock-pl").innerHTML=open.map(x=>{
    const broker=b=>x.partsOpen.filter(p=>p.broker===b),value=b=>broker(b).length?broker(b).every(p=>Number.isFinite(p.value))?broker(b).reduce((sum,p)=>sum+p.value,0):NaN:NaN;
    const ibkr=value("IBKR"),webull=value("Webull");
    return `<tr><td><strong>${esc(x.symbol)}</strong> <small>${esc(x.assetType)}</small></td><td class="numeric ${signClass(ibkr)}">${uMoney(ibkr)}</td><td class="numeric ${signClass(webull)}">${uMoney(webull)}</td><td class="numeric ${signClass(x.combinedOpenHKD)}"><strong>${uMoney(x.combinedOpenHKD)}</strong></td><td>${esc(x.coverage)}</td></tr>`;
  }).join("")||'<tr><td colspan="5" class="empty">No positions.</td></tr>';
  const openNote=stockTable.closest(".panel").querySelector(".panel-note");
  openNote.textContent=period==="current"?"Cumulative gain or loss on shares still held. IBKR and Webull snapshots can have different dates; the combined figure is indicative.":"Cumulative gain or loss at this month end, not this month's gain. IBKR uses reconstructed historical cost; Webull statements lack historical cost, so its open P/L and any affected combined row remain unavailable.";
  renderPortfolioResult(period,filter,s);
  const monthlyPanel=$("unified-overview").querySelector(".panel");
  const monthlyBody=monthlyPanel.querySelector("tbody");
  rows.forEach((r,i)=>{const cell=monthlyBody.rows[i]?.cells[6];if(cell){cell.title=r.returnMethod;if(r.returnMethod.startsWith("Estimate"))cell.insertAdjacentHTML("beforeend",'<small class="return-estimate">estimate</small>')}});
  monthlyPanel.querySelector(".panel-note").textContent="P/L = official closing NAV − opening NAV − recorded net funding. Return uses Modified Dietz when dated cash flows are available. June's Webull withdrawal and IBKR deposit are separate recorded flows; their different amounts are normal. The private audit Sheet shows the source records, dated weights and each arithmetic check.";
  $("unified-overview").append(monthlyPanel);
}
function renderPortfolioResult(period,filter,s){
  const month=period==="current"?s.lastComplete?.month:period,breakdown=month?UnifiedPortfolio.resultBreakdown(data,month,filter):null;
  const panel=$("unified-overview").querySelector(".panel-grid .panel:nth-child(2)");
  if(!breakdown){panel.innerHTML='<h2>Portfolio result</h2><p class="empty">No reconciled month available.</p>';return}
  const audit=UnifiedPortfolio.auditMonth(data,month),stockRows=breakdown.stocks.map(x=>`<tr><td>${esc(x.symbol)}</td><td>${esc(x.broker)}</td><td class="numeric ${signClass(x.value)}">${uMoney(x.value)}</td><td>${esc(x.status)}</td></tr>`).join("");
  const checkRows=audit?[["Official NAV sum",audit.checks.combinedNAV],["Monthly P/L source",audit.checks.monthlyPL],["IBKR funding ledger",audit.checks.ibkrFunding],["Webull funding statement",audit.checks.webullFunding],["Webull assets vs NAV",audit.checks.webullAssets],["IBKR reconstructed NAV variance",audit.checks.ibkrReconstructed]]:[];
  panel.innerHTML=`<div class="panel-head"><div><p class="eyebrow">PROFIT & LOSS · ${esc(month)}</p><h2>Portfolio result</h2></div></div><div class="pnl-row pnl-total"><span>Total portfolio P/L</span><strong class="${signClass(breakdown.total)}">${uMoney(breakdown.total)}</strong></div><div class="pnl-row"><span>Known stock P/L</span><strong class="${signClass(breakdown.knownStock)}">${uMoney(breakdown.knownStock)}</strong></div>${breakdown.lines.map(x=>`<div class="pnl-row"><span>${esc(x.label)}</span><strong class="${signClass(x.value)}">${uMoney(x.value)}</strong></div>`).join("")}<div class="pnl-row"><span>Other / unallocated</span><strong class="${signClass(breakdown.other)}">${uMoney(breakdown.other)}</strong></div><p class="panel-note">Other is the residual to official portfolio P/L. It can include fund movement, FX, fees, and stock results with missing cost or trade detail; it is not a separately verified gain.</p><h3 class="result-subhead">Stock P/L by position</h3><div class="table-wrap"><table class="result-table"><thead><tr><th>Symbol</th><th>Broker</th><th class="numeric">Stock P/L HKD</th><th>Basis</th></tr></thead><tbody>${stockRows||'<tr><td colspan="4" class="empty">No stock-level result.</td></tr>'}</tbody></table></div><h3 class="result-subhead">Source checks</h3><div class="result-checks">${checkRows.map(([label,value])=>`<div><span>${esc(label)}</span><strong class="${Number.isFinite(value)&&Math.abs(value)>1?"negative":""}">${uMoney(value)}</strong></div>`).join("")}</div><p class="panel-note">A zero arithmetic check confirms the loaded Sheet values agree; it does not independently certify the source statement. Compare broker NAV and funding with the original statements. ${audit?.note?esc(audit.note):""}</p>`;
}
function renderUnifiedHoldings(period,filter,s){
  const raw=UnifiedPortfolio.positions(data,period,filter),groups=UnifiedPortfolio.aggregatePositions(raw);
  const fx=period==="current"?data.fx:data.history.find(x=>x.month===period)?.fx;
  const cashUSD=Number.isFinite(s.cash)&&fx>0?s.cash/fx:NaN;
  const equity=Number.isFinite(s.equity)&&fx>0?s.equity/fx:NaN,largest=groups[0];
  const rows=groups.map(x=>{
    const weight=Number.isFinite(s.nav)&&s.nav>0?x.valueHKD/s.nav:NaN;
    const price=x.mixedTimes?NaN:x.lastPrice;
    return `<tr><td><details><summary><strong>${esc(x.symbol)}</strong> <small>${esc(x.assetType)}</small></summary><div class="broker-breakdown">${x.parts.map(p=>`${esc(p.broker)} · ${number(p.quantity,2)} shares · cost ${uMoney(p.averageCost,p.currency)} · value ${uMoney(p.marketValue,p.currency)} · open P/L ${uMoney(p.unrealizedPL,p.currency)} · ${esc(p.dataSource)}`).join("<br>")}</div></details></td><td class="numeric">${number(x.quantity,2)}</td><td class="numeric">${uMoney(x.averageCost,x.currency)}</td><td class="numeric">${uMoney(price,x.currency)}</td><td class="numeric">${uMoney(x.marketValue,x.currency)}</td><td class="numeric ${signClass(x.unrealizedPL)}">${uMoney(x.unrealizedPL,x.currency)}</td><td class="numeric">${percent(weight)}</td></tr>`;
  }).join("");
  $("unified-holdings").innerHTML=`<div class="section-title"><div><p class="eyebrow">${period==="current"?"LATEST POSITIONS":"MONTH-END POSITIONS"}</p><h2>Holdings & allocation</h2></div><span class="muted">${esc(s.asOf)}</span></div><div class="metrics holding-metrics">${metric("Equity & funds USD",equity,"Source currency values")}${metric("Cash USD equivalent",cashUSD,"Converted from HKD at IBKR FX")}${metric("Open positions",NaN,`${groups.length} securities`)}${metric("Largest position",NaN,largest?.symbol||"—")}</div><article class="panel"><div class="panel-head"><div><p class="eyebrow">COMBINED HOLDINGS</p><h2>Each holding</h2></div></div><div class="table-wrap"><table><thead><tr><th>Symbol / broker detail</th><th class="numeric">Total shares</th><th class="numeric">Avg cost</th><th class="numeric">Last price</th><th class="numeric">Market value</th><th class="numeric">Open P/L</th><th class="numeric">NAV weight</th></tr></thead><tbody>${rows}<tr class="cash-holding"><td><strong>Cash</strong></td><td class="numeric">—</td><td class="numeric">—</td><td class="numeric">—</td><td class="numeric">${uMoney(cashUSD,"USD")}</td><td class="numeric">—</td><td class="numeric">${percent(Number.isFinite(s.nav)&&s.nav>0?s.cash/s.nav:NaN)}</td></tr></tbody></table></div><p class="panel-note">Click a symbol for broker source detail. Cross-broker consolidation currently uses verified US identifiers for QLD and MU; other same-symbol records remain separate. Historical IBKR holdings are reconstructed; historical Webull cost and open P/L are missing. Current quote times can differ.</p></article>`;
  const k=$("unified-holdings").querySelector(".holding-metrics");k.children[2].querySelector("strong").textContent=number(groups.length);k.children[3].querySelector("strong").textContent=largest?.symbol||"—";
}
function renderUnifiedActivity(filter){
  const host=$("unified-activity"),old={month:host.querySelector("#activity-month")?.value||"",type:host.querySelector("#activity-type")?.value||"",search:host.querySelector("#activity-symbol")?.value||""};
  const searchFocused=document.activeElement?.id==="activity-symbol",caret=searchFocused?document.activeElement.selectionStart:0;
  const rows=UnifiedPortfolio.activities(data,filter),months=[...new Set(rows.map(x=>x.date.slice(0,7)))].sort().reverse();
  const types=[...new Set(rows.map(x=>x.type))].sort();
  const selected=rows.filter(x=>(!old.month||x.date.startsWith(old.month))&&(!old.type||x.type===old.type)&&(!old.search||`${x.symbol} ${x.description}`.toUpperCase().includes(old.search.toUpperCase())));
  host.innerHTML=`<div class="section-title"><div><p class="eyebrow">UNIFIED ACTIVITY</p><h2>Trades & cash</h2></div><span class="muted">${selected.length} of ${rows.length} available records</span></div><article class="panel"><div class="panel-head"><div><p class="eyebrow">ACTIVITY LEDGER</p><h2>All available activity</h2></div><div class="filters"><select id="activity-month"><option value="">All months</option>${months.map(m=>`<option value="${esc(m)}" ${old.month===m?"selected":""}>${esc(m)}</option>`).join("")}</select><select id="activity-type"><option value="">All types</option>${types.map(t=>`<option value="${esc(t)}" ${old.type===t?"selected":""}>${esc(t)}</option>`).join("")}</select><input id="activity-symbol" type="search" placeholder="Search symbol" value="${esc(old.search)}" aria-label="Search symbol"></div></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Broker</th><th>Type</th><th>Symbol</th><th>Description</th><th class="numeric">Quantity</th><th class="numeric">Price</th><th class="numeric">Cash effect</th><th>Currency</th><th>Detail</th></tr></thead><tbody>${selected.map(x=>`<tr><td>${esc(x.date)}</td><td>${esc(x.broker)}</td><td>${esc(x.type)}</td><td>${esc(x.symbol||"—")}</td><td>${esc(x.description)}</td><td class="numeric">${number(x.quantity,2)}</td><td class="numeric">${uMoney(x.price,x.currency)}</td><td class="numeric ${signClass(x.amount)}">${uMoney(x.amount,x.currency)}</td><td>${esc(x.currency)}</td><td><details><summary>View</summary><div class="broker-breakdown">ID: ${esc(x.id)}<br>Source: ${esc(x.source)}<br>Fee: ${uMoney(x.fee,x.currency)}<br>Realized P/L: ${uMoney(x.realizedPL,x.currency)}<br>Status: ${esc(x.status)}</div></details></td></tr>`).join("")||'<tr><td colspan="10" class="empty">No matching activity.</td></tr>'}</tbody></table></div><p class="panel-note">Webull OpenAPI executions cover available 2026 records; its complete cash ledger and all itemized fees remain unavailable. Statement monthly totals are shown below without invented transaction dates. A buy is a cash-to-stock exchange, not a loss; sell proceeds are not realized profit.</p></article><article class="panel"><div class="panel-head"><div><p class="eyebrow">WEBULL STATEMENTS</p><h2>Monthly cash summary</h2></div></div><div class="table-wrap"><table><thead><tr><th>Month</th><th class="numeric">Deposits</th><th class="numeric">Withdrawals</th><th class="numeric">Dividends</th><th class="numeric">Fees / tax</th><th>Source</th></tr></thead><tbody>${filter==="IBKR"?'<tr><td colspan="6" class="empty">Choose All Brokers or Webull.</td></tr>':data.webullMonthly.filter(x=>x.month.startsWith("2026-")).map(x=>`<tr><td>${esc(x.month)}</td><td class="numeric">${uMoney(x.deposits)}</td><td class="numeric">${uMoney(x.withdrawals)}</td><td class="numeric">${uMoney(x.dividends)}</td><td class="numeric">${uMoney(x.fees)}</td><td>${esc(x.statement||"—")}</td></tr>`).join("")}</tbody></table></div></article>`;
  for(const id of ["activity-month","activity-type","activity-symbol"])$(id).addEventListener(id==="activity-symbol"?"input":"change",()=>renderUnifiedActivity(unifiedFilter()));
  if(searchFocused){$("activity-symbol").focus();$("activity-symbol").setSelectionRange(caret,caret)}
}
