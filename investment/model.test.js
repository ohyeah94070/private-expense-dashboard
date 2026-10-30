const assert = require("node:assert/strict");
const {parse,monthlyBreakdown,accountYTD,stockBreakdown,holdingsForPeriod,cashUSDForPeriod,parseMarket} = require("./model.js");
const p = Array.from({length:19},()=>({values:[]}));
p[0].values=[["As-of date","Broker","Symbol","Shares","Currency","Average cost","Last price","Market value","Unrealized P/L"],["2026-10-27","IBKR","QLD",326,"USD",63,88,28688,8000]];
p[1].values=[["Trade date","Broker","Asset class","Symbol","Side","Quantity","Price","Currency","Commission","Net cash impact","Trade ID","Realized P/L"],["2026-06-08","IBKR","STK","QLD","SELL",100,90,"USD",1,8999,"T1",3000]];
p[2].values=[["Report date","Broker","Type","Currency","Amount","Related symbol","Description","Transaction ID","Settlement date"],["2026-07-02","IBKR","WITHDRAWAL","HKD",-15000,"","Transfer","C1","2026-07-02"]];
p[3].values=[["Month","Trades","Deposits HKD","Withdrawals HKD","Dividends USD","Interest USD","Tax USD","Realized P/L USD"],["2026-06",1,40000,0,20,0,-5,3000]];
[597130,590167,6962,80970,104951,1903,-2,-534,7.8455].forEach((v,i)=>p[i+4].values=[[v]]);
p[13].values=[["Month",...Array(13).fill("")],["2026-01",0,0,0,7.8,0,0,375010.79,0,0,6412.59,30000,375010.79,338598.2]];
p[15].values=[["Month"],["2025-12",621171.87],["2026-01",631843.56,0,0,0,0,0,0,0,10671.69,7.8137,0,0,0,0,0,0,"https://drive.google.com/file/d/example/view"]];
p[16].values=[["Month"],["2026-01","STOCK","VOO","Vanguard",43,700,30100,"USD",235000]];
p[17].values=[["Metric","Value"],["Snapshot UTC","2026-10-29T00:00:00Z"],["Account value",614354.68],["Market value",546959.99],["Cash",67394.69],["Cumulative unrealized P/L",105957.52],["API snapshot","https://drive.google.com/file/d/example/view"],[],["Symbol"],["VOO","EQUITY",43,"USD",436.64,707.91,30440.13,11662.37]];
p[18].values=[["Month"],["2026-01",375010.79,631843.56,1006854.35,30000,0,30000,6412.59,10671.69,17084.28,0]];
const result=parse({valueRanges:p});
assert.equal(result.positions.length,1);
assert.equal(result.trades[0].realized,3000);
assert.equal(result.cash[0].amount,-15000);
assert.equal(result.metrics.totalHKD,597130);
assert.equal(result.fx,7.8455);
assert.equal(result.watchlist,undefined);
assert.equal(result.history[0].openingNAV,338598.2);
assert.equal(result.webullMonthly[1].pl,10671.69);
assert.equal(result.webullCurrent.positions[0].unrealized,11662.37);
assert.equal(result.reconciliation[0].check,0);
const ytd=accountYTD({asOf:"2026-10-28",metrics:{totalHKD:604839.18},history:[{month:"2026-01",openingNAV:338598.1999599248}],months:[
  {month:"2026-01",deposits:30000,withdrawals:0},{month:"2026-06",deposits:40000,withdrawals:0},
  {month:"2026-07",deposits:0,withdrawals:-15000},{month:"2026-11",deposits:999999,withdrawals:0}
]});
assert.ok(Math.abs(ytd.total-(604839.18-338598.1999599248-55000))<0.001);
const breakdown=monthlyBreakdown([
  {month:"2026-01",unrealizedHKD:81463.64,totalPL:NaN,fx:7.8},
  {month:"2026-02",unrealizedHKD:67611.26,totalPL:-13550.23,fx:7.82}
],[{month:"2026-02",realized:0,dividends:0,interest:0,tax:4.72}],"2026-02");
assert.ok(breakdown.endUnrealized>0 && breakdown.changeUnrealized<0 && breakdown.total<0);
assert.ok(Math.abs(breakdown.changeUnrealized+breakdown.realized+breakdown.dividends+breakdown.interest+breakdown.tax+breakdown.other-breakdown.total)<0.001);
assert.ok(Number.isNaN(monthlyBreakdown([{month:"2026-01",unrealizedHKD:81463.64,totalPL:NaN,fx:7.8}],[],"2026-01").changeUnrealized));
const stock=stockBreakdown({
  fx:7.8,positions:[],history:[{month:"2026-01",fx:7.8},{month:"2026-02",fx:7.8}],
  valuations:[{month:"2026-01",symbol:"QLD",shares:10,unrealized:100},{month:"2026-02",symbol:"QLD",shares:10,unrealized:80}],
  trades:[{date:"2026-02-10",asset:"STK",symbol:"QLD",currency:"USD",realized:5}],
  cash:[{date:"2026-02-15",type:"DIVIDEND",symbol:"QLD",currency:"USD",amount:2}]
},"2026-02")[0];
assert.equal(stock.open,-156);
assert.equal(stock.realized,39);
assert.equal(stock.income,15.6);
assert.equal(stock.total,-101.4);
const historicalHoldings=holdingsForPeriod({positions:result.positions,valuations:[
  {month:"2026-02",symbol:"QLD",shares:464,close:67.99,marketValue:31547.36,costBasis:23001.25,unrealized:8546.11},
  {month:"2026-02",symbol:"QQQ",shares:0,close:607.29,marketValue:0,costBasis:0,unrealized:0}
]},"2026-02");
assert.equal(historicalHoldings.length,1);
assert.equal(historicalHoldings[0].shares,464);
assert.equal(historicalHoldings[0].lastPrice,67.99);
assert.equal(historicalHoldings[0].averageCost,23001.25/464);
assert.equal(holdingsForPeriod({positions:result.positions,valuations:[]},"current")[0].shares,326);
assert.ok(Math.abs(cashUSDForPeriod(result,"current")-6962/7.8455)<0.0001);
assert.ok(Math.abs(cashUSDForPeriod({history:[{month:"2026-02",cashUSD:100,cashHKD:780,fx:7.8}]},"2026-02")-200)<0.0001);
const quoteRows=[["Symbol","Name","Price","1D %","1W %","52W High","52W Low","Updated At","P/E (Google)"],
  ["INDEXSP:.INX","S&P 500",7722.6,0.006,0.0013,7844.52,6316.91,"2026-10-27 16:48"],
  ["NASDAQ:SOXX","SOXX",511.06,"",0.0221,655.95,260.44,"2026-10-27 16:00"],
  ["NASDAQ:MU","MU",928.76,0,0.0365,1255,192.59,"2026-10-01 16:00",12.02],
  ["NASDAQ:ZERO","Missing",0,0,0,0,0,"2026-10-27 16:00"]];
const quotes=parseMarket(quoteRows,Date.UTC(2026,9,28));
assert.equal(quotes[0].day,0.006);
assert.equal(quotes[0].week,0.0013);
assert.ok(Number.isNaN(quotes[0].pe));
assert.ok(Number.isNaN(quotes[1].day));
assert.ok(Number.isNaN(quotes[2].price));
assert.ok(Number.isNaN(quotes[2].pe));
assert.equal(quotes[2].stale,true);
assert.ok(Number.isNaN(quotes[3].price));
assert.equal(quotes[3].day,0);
console.log("model parsing passed");
