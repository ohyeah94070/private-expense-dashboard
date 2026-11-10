const LiquidityChart = (() => {
  const money = value => (value < 0 ? "−" : "") + "HK$" + Math.round(Math.abs(value)).toLocaleString("en-HK");
  const escape = value => String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  function scenario(model, amount, effectiveMonth) {
    const outflow = Math.max(0, Math.min(100000, Number(amount) || 0));
    return model.rows.map(row => ({...row,
      adjustedBeginning:row.beginning - (row.month > effectiveMonth ? outflow : 0),
      stressOutflow:row.month === effectiveMonth ? -outflow : 0,
      adjusted:row.ending - (row.month >= effectiveMonth ? outflow : 0)}));
  }
  function niceStep(raw) {
    const power = 10 ** Math.floor(Math.log10(raw || 1));
    return [1,2,2.5,5,10].map(x=>x*power).find(x=>x>=raw) || 10*power;
  }
  function chart(model, rows, viewportWidth=820, months=12) {
    const visibleRows=rows.slice(0,[3,6,12].includes(months)?months:12);
    const data=[{month:new Date(Date.UTC(1899,11,30)+model.asOf*86400000).toISOString().slice(0,7),ending:model.opening,adjusted:model.opening,actual:true},...visibleRows];
    const width=Math.max(640, viewportWidth, 130 + (data.length-1)*55), height=344;
    const left=82,right=28,top=28,bottom=50,plotWidth=width-left-right,plotHeight=height-top-bottom;
    const values=data.flatMap(x=>[x.ending,x.adjusted]);
    const min=Math.min(...values),max=Math.max(...values);
    const padding=Math.max((max-min)*.12,Math.max(Math.abs(min),Math.abs(max),1)*.02,1000);
    const paddedLow=min-padding,paddedHigh=Math.max(max+padding,min<0?padding:-Infinity);
    const step=niceStep((paddedHigh-paddedLow)/6);
    const low=Math.floor(paddedLow/step)*step,high=Math.ceil(paddedHigh/step)*step;
    const x=i=>left+i*plotWidth/Math.max(1,data.length-1);
    const y=v=>top+(high-v)/(high-low)*plotHeight;
    const path=key=>data.map((row,i)=>(i?"L":"M")+x(i).toFixed(1)+" "+y(row[key]).toFixed(1)).join(" ");
    const ticks=[];for(let value=low;value<=high+step/2;value+=step)ticks.push(value);
    const grid=ticks.map(value=>"<g class='lc-grid"+(value===0?" lc-zero":"")+"'><line x1='"+left+"' x2='"+(width-right)+"' y1='"+y(value)+"' y2='"+y(value)+"'/><text x='"+(left-12)+"' y='"+(y(value)+4)+"' text-anchor='end'>"+escape(money(value))+"</text></g>").join("");
    const every=Math.max(1,Math.ceil(data.length/10));
    const labels=data.map((row,i)=>i===0||i===data.length-1||i%every===0?"<text class='lc-month' x='"+x(i)+"' y='"+(height-19)+"' text-anchor='middle'>"+escape(row.month)+"</text>":"").join("");
    const points=data.map((row,i)=>"<g class='lc-point"+(row.actual?" lc-actual":"")+(row.adjusted<0?" lc-below":"")+"' data-point='"+i+"' tabindex='0' role='button' aria-label='"+escape(row.month+" "+(row.actual?"actual":"forecast")+" liquidity "+money(row.adjusted))+"'><circle class='lc-dot' cx='"+x(i)+"' cy='"+y(row.adjusted)+"' r='"+(row.actual?6:4)+"'/><circle class='lc-hit' cx='"+x(i)+"' cy='"+y(row.adjusted)+"' r='15'/></g>").join("");
    const zeroY=Math.max(top,Math.min(height-bottom,y(0)));
    const svg="<svg viewBox='0 0 "+width+" "+height+"' width='"+width+"' height='"+height+"' role='img' aria-label='Actual liquidity and baseline and stress forecasts by month'><defs><clipPath id='lc-negative-clip'><rect x='0' y='"+zeroY+"' width='"+width+"' height='"+(height-bottom-zeroY)+"'/></clipPath></defs>"+grid+"<path class='lc-baseline' d='"+path("ending")+"'/><path class='lc-scenario' d='"+path("adjusted")+"'/><path class='lc-scenario-negative' clip-path='url(#lc-negative-clip)' d='"+path("adjusted")+"'/>"+labels+points+"</svg>";
    return "<div class='lc-scroll'><div class='lc-canvas' style='width:"+width+"px'>"+svg+"<div class='lc-tooltip' hidden></div></div></div>";
  }
  function tooltip(model, rows, index) {
    if (index===0) return "<b>Actual · "+escape(new Date(Date.UTC(1899,11,30)+model.asOf*86400000).toISOString().slice(0,7))+"</b><div>Ending liquidity <strong>"+money(model.opening)+"</strong></div>";
    const row=rows[index-1];
    return "<b>Forecast · "+escape(row.month)+"</b>"+
      "<div>Beginning liquidity <strong>"+money(row.adjustedBeginning)+"</strong></div>"+
      "<div>Budget cash flow <strong>"+money(row.regular)+"</strong></div>"+
      "<div>One-off cash flow <strong>"+money(row.oneOff)+"</strong></div>"+
      (row.stressOutflow ? "<div>Extra cash outflow <strong>"+money(row.stressOutflow)+"</strong></div>" : "")+
      "<div>Baseline ending <strong>"+money(row.ending)+"</strong></div>"+
      "<div>Scenario ending <strong>"+money(row.adjusted)+"</strong></div>";
  }
  return {scenario,chart,tooltip};
})();
if (typeof module !== "undefined") module.exports=LiquidityChart;
