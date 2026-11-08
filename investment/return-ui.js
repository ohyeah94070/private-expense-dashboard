(function (root) {
  "use strict";
  const $ = id => document.getElementById(id);
  let data, bound = false;
  const closedMonth = () => { const parts = new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Hong_Kong", year:"numeric",month:"2-digit"}).format(new Date()); const [year,month]=parts.split("-").map(Number); return new Date(Date.UTC(year,month-1,0)).toISOString().slice(0,7); };
  const money = value => Number.isFinite(value) ? `HK$${new Intl.NumberFormat("en-HK", {minimumFractionDigits:2,maximumFractionDigits:2}).format(value)}` : "N/A";
  const percent = value => Number.isFinite(value) ? `${(value*100).toFixed(2)}%` : "N/A";
  function renderSummary() {
    const end = `${$("return-year").value}-${$("return-month").value}`;
    const result = ReturnModel.period(data, $("return-period").value, end, closedMonth());
    $("return-pnl").textContent = money(result.pnl);
    $("return-value").textContent = percent(result.return);
    $("return-nav").textContent = money(result.ending);
    $("return-note").textContent = `${result.start || "—"} to ${result.end || "—"} · ${result.status}${$("return-period").value === "YTD" && end.slice(0,4) === closedMonth().slice(0,4) ? " · YTD" : ""}. Compounded returns require every month in the period.`;
  }
  function renderHistory() {
    const all = (data.returns || []).map(row => ({...row, date: new Date(Date.UTC(+row.month.slice(0,4),+row.month.slice(5),0)).toISOString().slice(0,10), status: ReturnModel.status(data,row,closedMonth())}));
    const rows = OverviewModel.performanceRange(all,$("history-range").value,$("history-start").value,$("history-end").value);
    $("performance-rows").innerHTML = rows.map(row => `<tr><td>${row.month}</td><td class="numeric">${row.status === "Preliminary" ? money(row.ending) : "—"}</td><td class="numeric">${row.status === "Preliminary" ? money(row.pnl) : "—"}</td><td class="numeric">${row.status === "Preliminary" ? percent(row.return) : "N/A"}</td><td>${row.status}</td></tr>`).join("");
    const showPnl = $("history-pnl").checked, showReturn = $("history-return").checked;
    if (!rows.length || (!showPnl && !showReturn)) { $("nav-chart").innerHTML = '<p class="empty">No series selected or no months in this range.</p>'; return; }
    const w=900,h=290,l=85,r=85,t=35,b=50, pw=w-l-r, ph=h-t-b;
    const values=rows.filter(x=>x.status==="Preliminary");
    const pl=Math.max(1,...values.map(x=>Math.abs(x.pnl))), rl=Math.max(.01,...values.map(x=>Math.abs(x.return)));
    const x=i=>l+pw*(i+.5)/rows.length, py=v=>t+ph*(pl-v)/(2*pl), ry=v=>t+ph*(rl-v)/(2*rl);
    const bars=showPnl?rows.map((row,i)=>row.status==="Preliminary"?`<rect x="${x(i)-Math.min(25,pw/rows.length*.35)}" y="${Math.min(py(0),py(row.pnl))}" width="${Math.min(50,pw/rows.length*.7)}" height="${Math.max(1,Math.abs(py(row.pnl)-py(0)))}" fill="${row.pnl<0?'#c56570':'#85b8cf'}"><title>${row.month} · P&amp;L ${money(row.pnl)} · Return ${percent(row.return)}</title></rect>`:"").join(""):"";
    let segments=[],current=[]; rows.forEach((row,i)=>{if(showReturn&&row.status==="Preliminary")current.push(`${x(i)},${ry(row.return)}`);else if(current.length){segments.push(current);current=[];}});if(current.length)segments.push(current);
    const line=segments.map(points=>`<polyline points="${points.join(' ')}" fill="none" stroke="#0e7d6c" stroke-width="2.5"/>`).join("");
    const dots=showReturn?rows.map((row,i)=>row.status==="Preliminary"?`<circle cx="${x(i)}" cy="${ry(row.return)}" r="3" fill="#0e7d6c"><title>${row.month} · P&amp;L ${money(row.pnl)} · Return ${percent(row.return)}</title></circle>`:"").join(""):"";
    const labels=rows.map((row,i)=>i%Math.max(1,Math.ceil(rows.length/8))===0?`<text x="${x(i)}" y="${h-12}" text-anchor="middle">${row.month}</text>`:"").join("");
    $("nav-chart").innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Monthly P and L in HKD on left axis and return percentage on right axis"><g class="chart-axis"><text x="${l}" y="18">P&amp;L (HKD)</text><text x="${w-r}" y="18" text-anchor="end">Return (%)</text>${[-1,0,1].map(v=>`<text x="${l-8}" y="${py(v*pl)+4}" text-anchor="end">${Math.round(v*pl).toLocaleString()}</text><text x="${w-r+8}" y="${ry(v*rl)+4}">${(v*rl*100).toFixed(1)}%</text>`).join("")}${labels}</g>${bars}${line}${dots}</svg>`;
  }
  function mount(next) {
    data=next;const months=(data.returns||[]).map(x=>x.month).filter(x=>x<=closedMonth());const last=months.at(-1)||"";
    $("return-year").innerHTML=[...new Set(months.map(x=>x.slice(0,4)))].map(y=>`<option value="${y}">${y}</option>`).join("");
    $("return-year").value=last.slice(0,4);$("return-month").innerHTML=Array.from({length:12},(_,i)=>String(i+1).padStart(2,"0")).map(m=>`<option value="${m}">${m}</option>`).join("");$("return-month").value=last.slice(5);
    if(!bound){bound=true;for(const id of ["return-period","return-year","return-month"])$(id).addEventListener("change",renderSummary);for(const id of ["history-range","history-start","history-end","history-pnl","history-return","currency-select","overview-broker"])$(id).addEventListener("change",renderHistory);}
    renderSummary();renderHistory();
  }
  function clear(){data=null;for(const id of ["return-pnl","return-value","return-nav"])$(id).textContent="—";$("return-note").textContent="";}
  root.ReturnUI={mount,clear};
})(typeof window!=="undefined"?window:globalThis);
