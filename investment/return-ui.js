(function (root) {
  "use strict";
  const $ = id => document.getElementById(id);
  let data, bound = false;
  const closedMonth = () => { const parts = new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Hong_Kong", year:"numeric",month:"2-digit"}).format(new Date()); const [year,month]=parts.split("-").map(Number); return new Date(Date.UTC(year,month-1,0)).toISOString().slice(0,7); };
  const money = value => Number.isFinite(value) ? `${value<0?'(':''}HK$${new Intl.NumberFormat("en-HK", {minimumFractionDigits:2,maximumFractionDigits:2}).format(Math.abs(value))}${value<0?')':''}` : "N/A";
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
    $("performance-rows").innerHTML = rows.map(row => `<tr><td>${row.month}</td><td class="numeric">${row.status === "Preliminary" ? money(row.ending) : "—"}</td><td class="numeric">${row.status === "Preliminary" ? money(row.pnl) : "—"}</td><td class="numeric">${row.status === "Preliminary" ? percent(row.return) : "N/A"}</td></tr>`).join("");
    const showPnl = $("history-pnl").checked, showReturn = $("history-return").checked, showYtd = $("history-ytd").checked;
    if (!rows.length || (!showPnl && !showReturn && !showYtd)) { $("nav-chart").innerHTML = '<p class="empty">No series selected or no months in this range.</p>'; return; }
    const ytd = new Map(all.map(row => [row.month, ReturnModel.period(data,"YTD",row.month,closedMonth()).return]));
    const tooltip=row=>`${row.month}${showPnl&&row.status==='Preliminary'?' · P&L '+money(row.pnl):''}${showReturn&&row.status==='Preliminary'?' · Monthly Return '+percent(row.return):''}${showYtd&&Number.isFinite(ytd.get(row.month))?' · YTD Return '+percent(ytd.get(row.month)):''}`;
    const w=900,h=290,l=85,r=85,t=35,b=50, pw=w-l-r, ph=h-t-b;
    const values=rows.filter(x=>x.status==="Preliminary");
    const pl=Math.max(1,...values.map(x=>Math.abs(x.pnl))), rl=Math.max(.01,...values.map(x=>Math.abs(x.return)),...rows.map(x=>Math.abs(ytd.get(x.month))).filter(Number.isFinite));
    const x=i=>l+pw*(i+.5)/rows.length, py=v=>t+ph*(pl-v)/(2*pl), ry=v=>t+ph*(rl-v)/(2*rl);
    const bars=showPnl?rows.map((row,i)=>row.status==="Preliminary"?`<rect x="${x(i)-Math.min(25,pw/rows.length*.35)}" y="${Math.min(py(0),py(row.pnl))}" width="${Math.min(50,pw/rows.length*.7)}" height="${Math.max(1,Math.abs(py(row.pnl)-py(0)))}" fill="${row.pnl<0?'#c56570':'#85b8cf'}"><title>${tooltip(row)}</title></rect>`:"").join(""):"";
    let segments=[],current=[]; rows.forEach((row,i)=>{if(showReturn&&row.status==="Preliminary")current.push(`${x(i)},${ry(row.return)}`);else if(current.length){segments.push(current);current=[];}});if(current.length)segments.push(current);
    const line=segments.map(points=>`<polyline points="${points.join(' ')}" fill="none" stroke="#0e7d6c" stroke-width="2.5"/>`).join("");
    const dots=showReturn?rows.map((row,i)=>row.status==="Preliminary"?`<circle cx="${x(i)}" cy="${ry(row.return)}" r="3" fill="#0e7d6c"><title>${tooltip(row)}</title></circle>`:"").join(""):"";
    let ytdSegments=[],ytdPoints=[];rows.forEach((row,i)=>{if(i&&row.month.slice(0,4)!==rows[i-1].month.slice(0,4)&&ytdPoints.length){ytdSegments.push(ytdPoints);ytdPoints=[];}const v=ytd.get(row.month);if(showYtd&&Number.isFinite(v))ytdPoints.push(`${x(i)},${ry(v)}`);else if(ytdPoints.length){ytdSegments.push(ytdPoints);ytdPoints=[];}});if(ytdPoints.length)ytdSegments.push(ytdPoints);
    const ytdLine=ytdSegments.map(points=>`<polyline points="${points.join(' ')}" fill="none" stroke="#8769a8" stroke-width="2.5"/>`).join("");
    const ytdDots=showYtd?rows.map((row,i)=>Number.isFinite(ytd.get(row.month))?`<circle cx="${x(i)}" cy="${ry(ytd.get(row.month))}" r="3" fill="#8769a8"><title>${tooltip(row)}</title></circle>`:"").join(""):"";
    const labels=rows.map((row,i)=>i%Math.max(1,Math.ceil(rows.length/8))===0?`<text x="${x(i)}" y="${h-12}" text-anchor="middle">${row.month}</text>`:"").join("");
    $("nav-chart").innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Monthly P and L in HKD on left axis and returns on right axis"><g class="chart-axis"><text x="${l}" y="18">P&amp;L (HKD)</text><text x="${w-r}" y="18" text-anchor="end">Return (%)</text>${[-1,0,1].map(v=>`<text x="${l-8}" y="${py(v*pl)+4}" text-anchor="end">${Math.round(v*pl).toLocaleString()}</text><text x="${w-r+8}" y="${ry(v*rl)+4}">${(v*rl*100).toFixed(1)}%</text>`).join("")}${labels}</g>${bars}${line}${dots}${ytdLine}${ytdDots}</svg><div class="value-legend">${showPnl?'<span style="color:#85b8cf">■ Monthly P&amp;L</span>　':''}${showReturn?'<span style="color:#0e7d6c">● Monthly Return</span>　':''}${showYtd?'<span style="color:#8769a8">● YTD Return</span>':''}</div>`;
  }
  function renderAnnual(){
    const years=[...new Set((data.returns||[]).map(row=>row.month.slice(0,4)))].sort();
    let total=0, count=0;
    $("annual-rows").innerHTML=years.map(year=>{
      const end=year===closedMonth().slice(0,4)?closedMonth():`${year}-12`;
      const result=ReturnModel.period(data,end.endsWith('-12')?'Annual':'YTD',end,closedMonth());
      if(Number.isFinite(result.pnl)){total+=result.pnl;count++;}
      return `<tr><td>${year} ${end.endsWith('-12')?'Annual':'YTD'}</td><td class="numeric ${result.pnl<0?'negative':result.pnl>0?'positive':''}">${money(result.pnl)}</td><td class="numeric ${result.return<0?'negative':result.return>0?'positive':''}">${percent(result.return)}</td></tr>`;
    }).join('');
    $("annual-pnl-total").textContent=money(count?total:null);
    $("annual-pnl-total").className=`numeric ${count?(total<0?'negative':total>0?'positive':''):''}`.trim();
  }
  function mount(next) {
    data=next;const months=(data.returns||[]).map(x=>x.month).filter(x=>x<=closedMonth());const last=months.at(-1)||"";
    $("return-year").innerHTML=[...new Set(months.map(x=>x.slice(0,4)))].map(y=>`<option value="${y}">${y}</option>`).join("");
    $("return-year").value=last.slice(0,4);$("return-month").innerHTML=Array.from({length:12},(_,i)=>String(i+1).padStart(2,"0")).map(m=>`<option value="${m}">${m}</option>`).join("");$("return-month").value=last.slice(5);
    if(!bound){bound=true;for(const id of ["return-period","return-year","return-month"])$(id).addEventListener("change",renderSummary);for(const id of ["history-range","history-start","history-end","history-pnl","history-return","history-ytd","currency-select","overview-broker"])$(id).addEventListener("change",renderHistory);}
    renderSummary();renderHistory();renderAnnual();
  }
  function clear(){data=null;for(const id of ["return-pnl","return-value","return-nav","annual-pnl-total"])$(id).textContent="—";$("annual-pnl-total").className="numeric";$("return-note").textContent="";}
  root.ReturnUI={mount,clear};
})(typeof window!=="undefined"?window:globalThis);
