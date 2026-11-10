const assert = require("node:assert/strict");
const {liquidity, forecast} = require("./liquidity-model.js");
const end = Math.floor((Date.UTC(2026,10,0)-Date.UTC(1899,11,30))/86400000);
const nov = end+1, dec = Math.floor((Date.UTC(2026,11,1)-Date.UTC(1899,11,30))/86400000);
const base={end,positions:[
  {type:"Asset",category:"Cash",ccy:"HKD",hkd:100000},
  {type:"Asset",category:"Cash",ccy:"TWD",hkd:20000},
  {type:"Asset",category:"Cash",ccy:"CNY",hkd:5000},
  {type:"Liabilities",category:"Credit Card",ccy:"HKD",hkd:-20000},
  {type:"Liabilities",category:"Credit Card",ccy:"CNY",hkd:-3000},
  {type:"Asset",category:"Investment",ccy:"HKD",hkd:1000000},
  {type:"Asset",category:"MPF",hkd:200000},
  {type:"Liabilities",category:"TW",hkd:-5000}
]};
assert.equal(liquidity(base),77000);
const changed=structuredClone(base); changed.positions[0].hkd+=5000; assert.equal(liquidity(changed),82000);
changed.positions[1].hkd+=7000; changed.positions[2].hkd-=2000; assert.equal(liquidity(changed),82000);
changed.positions[3].hkd-=7000; assert.equal(liquidity(changed),75000);
changed.positions[4].hkd-=1000; assert.equal(liquidity(changed),74000);
changed.positions[7].hkd-=10000; assert.equal(liquidity(changed),74000);
changed.positions[5].hkd+=50000; assert.equal(liquidity(changed),74000);
changed.positions[0].hkd-=30000; changed.positions[5].hkd+=30000; assert.equal(liquidity(changed),44000);
// A credit card purchase reduces the signed card balance once; repayment shifts cash to the card balance.
const purchase=structuredClone(base);purchase.positions[3].hkd-=1000;assert.equal(liquidity(purchase),76000);
purchase.positions[0].hkd-=1000;purchase.positions[3].hkd+=1000;assert.equal(liquidity(purchase),76000);
const budgets=[{month:nov,income:46500,housing:12800,routine:8100,other:0,events:0,surplus:25600,actual:0},
  {month:dec,income:46500,housing:12800,routine:8100,other:0,events:20000,surplus:5600,actual:NaN}];
const plans=[{date:dec,event:"Trip",category:"Travel",estimated:20000,included:true},
  {date:dec,event:"Excluded",category:"Other",estimated:10000,included:false}];
const result=forecast([base],budgets,plans);
assert.equal(result.rows.length,2);
assert.deepEqual(result.rows.map(x=>x.ending),[102600,108200]);
assert.equal(result.rows[1].oneOff,-20000);
assert.equal(result.details.length,1);
assert.equal(result.savings[0].status,"Pending","future zero must not be shown as actual");
const settled={...base,end:Math.floor((Date.UTC(2026,11,0)-Date.UTC(1899,11,30))/86400000)};
assert.equal(forecast([settled],budgets,plans).savings[0].actual,0,"settled zero is actual");
const below=structuredClone(budgets);below[0].actual=100;
assert.equal(forecast([settled],below,plans).savings[0].status,"Below Target");
below[0].actual=-100;
assert.equal(forecast([settled],below,plans).savings[0].status,"Negative Savings");
console.log("Liquidity and savings scenarios passed");
