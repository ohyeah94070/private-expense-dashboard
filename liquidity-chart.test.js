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
assert.match(svg,/lc-zero/);
assert.match(svg,/lc-baseline/);
assert.match(svg,/lc-scenario/);
assert.match(svg,/data-point='0'/);
assert.match(Chart.tooltip(model,stressed,2),/Extra cash outflow/);
assert.match(Chart.tooltip(model,stressed,2),/Beginning liquidity/);
const negative=Chart.scenario(model,100000,"2026-12");
assert(negative[1].adjusted<0);
assert.match(Chart.chart(model,negative),/lc-below/);
assert.match(Chart.chart(model,negative),/lc-scenario-negative/);
console.log("Liquidity chart scenarios and negative display passed");
