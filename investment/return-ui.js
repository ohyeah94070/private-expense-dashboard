(function (root) {
  "use strict";
  const $ = id => document.getElementById(id);
  let data, bound = false, expanded = new Set();
  const closedMonth = () => { const parts = new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Hong_Kong", year:"numeric",month:"2-digit"}).format(new Date()); const [year,month]=parts.split("-").map(Number); return new Date(Date.UTC(year,month-1,0)).toISOString().slice(0,7); };
  const money = value => Number.isFinite(value) ? `${value<0?'(':''}HK$${new Intl.NumberFormat("en-HK", {minimumFractionDigits:2,maximumFractionDigits:2}).format(Math.abs(value))}${value<0?')':''}` : "N/A";
  const percent = value => Number.isFinite(value) ? `${(value*100).toFixed(2)}%` : "N/A";
  const tone = value => Number.isFinite(value) ? value<0?"negative":value>0?"positive":"" : "";
  const selectedSeries = () => ["portfolio","qqq","voo"].filter(name => $("compare-"+name).checked);
  function comparisonMonths() {
    const benchmark = new Map((data.benchmark||[]).map(row => [row.month,row]));
    return (data.returns||[]).filter(row => row.month<=closedMonth()).map(row => ({month:row.month,
      portfolio:ReturnModel.status(data,row,closedMonth())==="Preliminary"?row.return:null,
      pnl:ReturnModel.status(data,row,closedMonth())==="Preliminary"?row.pnl:null,
      qqq:benchmark.get(row.month)?.qqq ?? null,voo:benchmark.get(row.month)?.voo ?? null}));
  }
  function comparisonYears(months) {
    return [...new Set(months.map(row=>row.month.slice(0,4)))].sort().map(year => {
      const entries=months.filter(row=>row.month.startsWith(year+"-"));
      const end=entries.at(-1)?.month;
      const result=ReturnModel.period(data,end?.endsWith("-12")?"Annual":"YTD",end,closedMonth());
      const compound=name=>entries.length && entries[0].month===year+"-01" && entries.every((row,index)=>row.month===`${year}-${String(index+1).padStart(2,"0")}` && Number.isFinite(row[name])) ? entries.reduce((product,row)=>product*(1+row[name]),1)-1:null;
      return {year,end,portfolio:result.return,qqq:compound("qqq"),voo:compound("voo"),pnl:result.pnl,months:entries};
    });
  }
  function comparisonChart(months, years) {
    const yearly=$("comparison-chart-mode").value==="Yearly", selected=selectedSeries();
    const rows=(yearly?years.filter(row=>$("comparison-year").value==="ALL"||row.year===$("comparison-year").value).map(row=>({label:row.end?.endsWith("-12")?row.year:row.year+" YTD",date:row.end,...Object.fromEntries(selected.map(name=>[name,row[name]]))})):months.filter(row=>$("comparison-year").value==="ALL"||row.month.startsWith($("comparison-year").value+"-")).map(row=>({label:row.month,date:row.month,...Object.fromEntries(selected.map(name=>[name,row[name]]))})));
    const values=rows.flatMap(row=>selected.map(name=>row[name]).filter(Number.isFinite));
    if (!rows.length || !selected.length || !values.length) { $("comparison-chart").innerHTML='<p class="empty">No returns for these filters.</p>'; return; }
    const w=900,h=280,l=70,r=25,t=30,b=48, limit=Math.max(.01,...values.map(Math.abs));
    const x=i=>l+(w-l-r)*(i+.5)/rows.length, y=v=>t+(limit-v)*(h-t-b)/(2*limit);
    const colors={portfolio:"#0e7d6c",qqq:"#275a78",voo:"#8769a8"}, labels={portfolio:"My Portfolio",qqq:"QQQ",voo:"VOO"};
    const ticks=[-limit,0,limit].map(v=>`<line x1="${l}" y1="${y(v)}" x2="${w-r}" y2="${y(v)}" stroke="#e3ecee"/><text x="${l-8}" y="${y(v)+4}" text-anchor="end">${percent(v)}</text>`).join("");
    const paths=selected.map(name=>{let parts=[],current=[];rows.forEach((row,i)=>{if(Number.isFinite(row[name]))current.push(`${x(i)},${y(row[name])}`);else if(current.length){parts.push(current);current=[];}});if(current.length)parts.push(current);return parts.map(points=>`<polyline points="${points.join(" ")}" fill="none" stroke="${colors[name]}" stroke-width="2.5"/>`).join("");}).join("");
    const dots=selected.map(name=>rows.map((row,i)=>Number.isFinite(row[name])?`<circle cx="${x(i)}" cy="${y(row[name])}" r="4" fill="${colors[name]}"><title>${row.date} · ${labels[name]} ${percent(row[name])}</title></circle>`:"").join("")).join("");
    const axis=rows.map((row,i)=>i%Math.max(1,Math.ceil(rows.length/9))===0?`<text x="${x(i)}" y="${h-12}" text-anchor="middle">${row.label}</text>`:"").join("");
    $("comparison-chart").innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Monthly or yearly return comparison"><g class="chart-axis">${ticks}${axis}</g>${paths}${dots}</svg><div class="value-legend">${selected.map(name=>`<span style="color:${colors[name]}">● ${labels[name]}</span>`).join("")}</div>`;
  }
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
    const months=comparisonMonths(),years=comparisonYears(months),choice=$("comparison-year").value||"ALL",period=$("comparison-period").value||"Annual",selected=selectedSeries();
    const visible=years.filter(row=>choice==="ALL"||row.year===choice);
    const cell=(name,value)=>`<td class="numeric comparison-${name} ${tone(value)}" ${selected.includes(name)?"":"hidden"}>${percent(value)}</td>`;
    let total=0,count=0;
    $("annual-rows").innerHTML=visible.map(year=>{
      if(Number.isFinite(year.pnl)){total+=year.pnl;count++;}
      const monthly=period==="Monthly"||expanded.has(year.year);
      const main=period==="Monthly"?"":`<tr><td><button type="button" class="year-toggle" data-year="${year.year}" aria-expanded="${monthly}">${monthly?"▾":"▸"} ${year.year}${year.end?.endsWith("-12")?"":" YTD"}</button></td>${cell("portfolio",year.portfolio)}${cell("qqq",year.qqq)}${cell("voo",year.voo)}<td class="numeric ${tone(year.pnl)}">${money(year.pnl)}</td></tr>`;
      const detail=monthly?year.months.map(row=>`<tr class="comparison-month"><td>${row.month}</td>${cell("portfolio",row.portfolio)}${cell("qqq",row.qqq)}${cell("voo",row.voo)}<td class="numeric ${tone(row.pnl)}">${money(row.pnl)}</td></tr>`).join(""):"";
      return main+detail;
    }).join("") || '<tr><td colspan="5" class="empty">No periods for these filters.</td></tr>';
    for(const name of ["portfolio","qqq","voo"]) document.querySelectorAll?.(`.comparison-${name}`).forEach(el=>{el.hidden=!selected.includes(name);});
    $("annual-pnl-total").textContent=money(count?total:null);
    $("annual-pnl-total").className=`numeric ${count?(total<0?'negative':total>0?'positive':''):''}`.trim();
    comparisonChart(months,years);
  }
  function mount(next) {
    data=next;const months=(data.returns||[]).map(x=>x.month).filter(x=>x<=closedMonth());const last=months.at(-1)||"";
    $("return-year").innerHTML=[...new Set(months.map(x=>x.slice(0,4)))].map(y=>`<option value="${y}">${y}</option>`).join("");
    $("return-year").value=last.slice(0,4);$("return-month").innerHTML=Array.from({length:12},(_,i)=>String(i+1).padStart(2,"0")).map(m=>`<option value="${m}">${m}</option>`).join("");$("return-month").value=last.slice(5);
    const years=[...new Set(months.map(month=>month.slice(0,4)))];const previous=$("comparison-year").value;
    $("comparison-year").innerHTML='<option value="ALL">All Years</option>'+years.map(year=>`<option value="${year}">${year}</option>`).join("");
    $("comparison-year").value=years.includes(previous)?previous:"ALL";
    if(!bound){bound=true;for(const id of ["return-period","return-year","return-month"])$(id).addEventListener("change",renderSummary);for(const id of ["history-range","history-start","history-end","history-pnl","history-return","history-ytd","currency-select","overview-broker"])$(id).addEventListener("change",renderHistory);for(const id of ["comparison-year","comparison-chart-mode","compare-portfolio","compare-qqq","compare-voo"])$(id).addEventListener("change",renderAnnual);$("comparison-period").addEventListener("change",()=>{if($( "comparison-period").value==="All")expanded=new Set([...new Set((data.returns||[]).map(row=>row.month.slice(0,4)))]);else if($("comparison-period").value==="Annual")expanded.clear();renderAnnual();});$("annual-rows").addEventListener("click",event=>{const year=event.target.closest("[data-year]")?.dataset.year;if(!year)return;if(expanded.has(year))expanded.delete(year);else expanded.add(year);renderAnnual();});}
    renderSummary();renderHistory();renderAnnual();
  }
  function clear(){data=null;expanded.clear();for(const id of ["return-pnl","return-value","return-nav","annual-pnl-total"])$(id).textContent="—";$("annual-pnl-total").className="numeric";$("return-note").textContent="";$("annual-rows").innerHTML="";$("comparison-chart").innerHTML="";}
  root.ReturnUI={mount,clear};
})(typeof window!=="undefined"?window:globalThis);
