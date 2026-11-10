const assert=require("node:assert/strict");
const Chart=require("./liquidity-chart.js");
const model={asOf:46326,opening:61068.7058676,rows:[
  {month:"2026-11",beginning:61068.7058676,regular:25600,oneOff:0,ending:86668.7058676},
  {month:"2026-12",beginning:86668.7058676,regular:25600,oneOff:-63479,ending:48789.7058676},
  {month:"2027-01",beginning:48789.7058676,regular:25600,oneOff:0,ending:74389.7058676}
]};
const zero=Chart.scenario(model,0,"2026-12");
assert(zero.every(x=>x.adjusted===x.ending));
const stressed=Chart.scenario(model,20000,"2026-12");
assert.equal(stressed[0].adjusted,model.rows[0].ending);
assert.equal(stressed[1].adjusted,model.rows[1].ending-20000);
assert.equal(stressed[2].adjusted,model.rows[2].ending-20000);
assert.equal(stressed[1].adjustedBeginning,model.rows[1].beginning);
assert.equal(stressed[2].adjustedBeginning,model.rows[2].beginning-20000);
assert.equal(model.opening,61068.7058676,"actual must remain unchanged");
assert.equal(model.rows[1].ending,48789.7058676,"baseline must remain unchanged");
const svg=Chart.chart(model,stressed);
assert.doesNotMatch(svg,/lc-grid lc-zero/,"positive view does not force a zero tick");
assert.match(svg,/lc-baseline/);
assert.match(svg,/lc-scenario/);
assert.match(svg,/data-point='0'/);
assert.match(Chart.tooltip(model,stressed,2),/Extra cash outflow/);
assert.match(Chart.tooltip(model,stressed,2),/Beginning liquidity/);
const negative=Chart.scenario(model,100000,"2026-12");
assert(negative[1].adjusted<0);
assert.match(Chart.chart(model,negative),/lc-below/);
assert.match(Chart.chart(model,negative),/lc-scenario-negative/);
assert.match(Chart.chart(model,negative),/lc-grid lc-zero/,"negative view shows the zero line");
const longModel={...model,rows:Array.from({length:15},(_,i)=>({month:new Date(Date.UTC(2026,10+i,1)).toISOString().slice(0,7),beginning:61000+i*10000,regular:10000,oneOff:0,ending:71000+i*10000}))};
const longRows=Chart.scenario(longModel,0,"2026-12");
const pointCount=html=>(html.match(/class='lc-point/g)||[]).length;
const topTick=html=>Math.max(...[...html.matchAll(/class='lc-grid[^']*'[\s\S]*?<text[^>]*>([^<]+)<\/text>/g)].map(x=>Number(x[1].replace(/[^\d.-]/g,""))));
const view3=Chart.chart(longModel,longRows,820,3),view6=Chart.chart(longModel,longRows,820,6),view12=Chart.chart(longModel,longRows,820,12);
assert.equal(pointCount(view3),4);
assert.equal(pointCount(view6),7);
assert.equal(pointCount(view12),13);
assert.equal(pointCount(Chart.chart(longModel,longRows)),13,"12M is the default");
assert(topTick(view3)<topTick(view6) && topTick(view6)<topTick(view12),"axis follows visible points");
assert.equal(longRows.length,15,"chart range does not truncate forecast data");
console.log("Liquidity chart scenarios and negative display passed");
