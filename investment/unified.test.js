const assert=require("node:assert/strict");
const U=require("./unified.js");
const d={fx:7.8,asOf:"2026-10-27",metrics:{totalHKD:1800,equityHKD:1560,cashHKD:240,unrealizedHKD:156,realizedHKD:40},positions:[{asOf:"2026-10-27",symbol:"MU",shares:10,currency:"USD",averageCost:8,lastPrice:10,marketValue:100,unrealized:20},{asOf:"2026-10-27",symbol:"AAPL",shares:2,currency:"USD",averageCost:30,lastPrice:35,marketValue:70,unrealized:10}],history:[{month:"2026-01",openingNAV:1000,totalHKD:1200,equityHKD:1000,cashTotalHKD:200,unrealizedHKD:80,realizedUSD:0,fx:7.8},{month:"2026-02",totalHKD:1300,equityHKD:1100,cashTotalHKD:200,unrealizedHKD:90,realizedUSD:0,fx:7.8}],valuations:[],webullMonthly:[{month:"2025-12",nav:1000},{month:"2026-01",nav:1100,stocks:1000,funds:0,cash:100,fx:7.8},{month:"2026-02",nav:1200,stocks:1100,funds:0,cash:100,fx:7.8}],webullHoldings:[],webullCurrent:{asOf:"2026-10-29T15:00:00Z",nav:2000,market:1600,cash:400,unrealized:78,positions:[{symbol:"MU",type:"EQUITY",shares:5,currency:"USD",cost:6,price:10,marketValue:50,unrealized:20},{symbol:"TSM",type:"EQUITY",shares:3,currency:"USD",cost:9,price:10,marketValue:30,unrealized:3}]},reconciliation:[{month:"2026-01",ibkrNAV:1200,webullNAV:1100,ibkrFunding:0,webullFunding:0,ibkrPL:200,webullPL:100},{month:"2026-02",ibkrNAV:1300,webullNAV:1200,ibkrFunding:50,webullFunding:-50,ibkrPL:50,webullPL:150,note:"Transfer linkage unverified"}],trades:[{id:"T1",date:"2026-10-01",asset:"STK",side:"BUY",symbol:"MU",quantity:10,price:8,currency:"USD",netCash:-80,commission:1,realized:0}],cash:[{id:"C1",date:"2026-10-02",type:"DIVIDEND",symbol:"MU",description:"Dividend",currency:"USD",amount:2},{id:"C2",date:"2026-10-03",type:"TAX",symbol:"MU",description:"Tax",currency:"USD",amount:-0.3},{id:"C3",date:"2026-10-04",type:"DEPOSIT",symbol:"",description:"Funding",currency:"HKD",amount:100}],webullExecutions:[{id:"E1",date:"2026-10-05T15:00:00Z",symbol:"MU",side:"BUY",quantity:5,price:6,currency:"USD",amount:-30,source:"API"},{id:"E1",date:"2026-10-05T15:00:00Z",symbol:"MU",side:"BUY",quantity:5,price:6,currency:"USD",amount:-30,source:"API"}]};
const p=U.positions(d,"current"),g=U.aggregatePositions(p),mu=g.find(x=>x.symbol==="MU");
const converted=U.positions({...d,positions:[{asOf:"2026-10-27",symbol:"HKTEST",shares:2,currency:"HKD",averageCost:50,lastPrice:60,marketValue:120,unrealized:20},{asOf:"2026-10-27",symbol:"JPTEST",shares:1,currency:"JPY",averageCost:100,lastPrice:110,marketValue:110,unrealized:10}]},"current","IBKR");
assert.equal(converted[0].valueHKD,120);assert.ok(Number.isNaN(converted[1].valueHKD));
assert.equal(mu.quantity,15);assert.equal(mu.costBasis,110);assert.equal(mu.averageCost,110/15);assert.equal(mu.marketValue,150);assert.equal(mu.unrealizedPL,40);
assert.equal(g.find(x=>x.symbol==="AAPL").parts.length,1);assert.equal(g.find(x=>x.symbol==="TSM").parts.length,1);
assert.equal(U.summary(d,"current").cash,640);assert.equal(U.summary(d,"current","IBKR").cash,240);assert.equal(U.summary(d,"current","Webull").cash,400);
assert.equal(U.summary(d,"current").nav,3800);
assert.equal(U.summary(d,"current").ytdPL,500);
assert.equal(U.monthly(d)[0].nav,2300);assert.equal(U.monthly(d)[0].pl,300);assert.equal(U.monthly(d)[0].monthlyReturn,0.15);
assert.equal(U.monthly(d)[1].funding,0);assert.equal(U.monthly(d)[1].pl,200);assert.equal(U.monthly(d)[1].status,"Reconciliation required");
assert.ok(Math.abs(U.monthly(d,"IBKR")[1].monthlyReturn-50/1225)<1e-10);
assert.match(U.monthly(d,"IBKR")[1].returnMethod,/Estimate/);
const dated={...d,cash:[...d.cash,{id:"D1",date:"2026-02-23",type:"DEPOSIT",currency:"HKD",amount:50}]};
const expectedWeight=50*(28-23+1)/28;
assert.ok(Math.abs(U.monthly(dated,"IBKR")[1].monthlyReturn-50/(1200+expectedWeight))<1e-10);
assert.match(U.monthly(dated,"IBKR")[1].returnMethod,/Modified Dietz/);
const offset={...d,webullMonthly:d.webullMonthly.map(x=>x.month==="2026-02"?{...x,deposits:100,withdrawals:-100,funding:0}:x)};
assert.match(U.monthly(offset)[1].returnMethod,/Estimate/);
const stockData={...d,months:[],webullHoldings:[
 {month:"2025-12",type:"STOCK",symbol:"VOO",shares:10,hkd:780},
 {month:"2026-01",type:"STOCK",symbol:"VOO",shares:10,hkd:858},
 {month:"2026-02",type:"STOCK",symbol:"VOO",shares:5,hkd:468},
 {month:"2026-02",type:"STOCK",symbol:"QLD",shares:5,hkd:468}
],webullExecutions:[
 {id:"S1",date:"2026-02-10",symbol:"VOO",side:"SELL",quantity:5,price:10,currency:"USD",amount:50},
 {id:"B1",date:"2026-02-11",symbol:"QLD",side:"BUY",quantity:5,price:10,currency:"USD",amount:-50}
]};
const stockRows=U.monthlyStocks(stockData,"2026-02","Webull");
assert.equal(stockRows.find(x=>x.symbol==="VOO").value,0);
assert.equal(stockRows.find(x=>x.symbol==="QLD").value,78);
assert.equal(U.monthlyStocks(stockData,"2026-01","Webull")[0].value,78);
assert.ok(Number.isNaN(U.openPositions(stockData,"2026-02","Webull")[0].combinedOpenHKD));
assert.equal(U.resultBreakdown(stockData,"2026-02","Webull").knownStock,78);
const missingFills={...stockData,webullExecutions:[]};
assert.ok(Number.isNaN(U.monthlyStocks(missingFills,"2026-02","Webull")[0].value));
assert.equal(U.resultBreakdown(missingFills,"2026-02","Webull").partial,true);
const auditData={...d,reconciliation:d.reconciliation.map(x=>({...x,combinedNAV:x.ibkrNAV+x.webullNAV}))};
assert.equal(U.auditMonth(auditData,"2026-01").checks.combinedNAV,0);
const acts=U.activities(d);assert.equal(acts.length,5);assert.equal(acts[0].broker,"Webull");assert.equal(acts.at(-1).type,"BUY");assert.equal(acts.find(x=>x.type==="DIVIDEND").amount,2);assert.equal(acts.find(x=>x.type==="WITHHOLDING_TAX").amount,-0.3);
assert.equal(U.activities(d,"Webull").length,1);assert.equal(U.activities(d,"IBKR").length,4);
const partial={...d,webullCurrent:{...d.webullCurrent,unrealized:NaN}};assert.ok(Number.isNaN(U.summary(partial,"current").unrealized));
console.log("unified portfolio aggregation passed");
module.exports=d;
