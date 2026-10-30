const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const model=require("./model.js");
const elements=new Map();
const document={
  getElementById(id){if(!elements.has(id))elements.set(id,{addEventListener(){},textContent:"",innerHTML:"",hidden:false});return elements.get(id);},
  querySelectorAll(){return []}
};
const context=vm.createContext({document,window:{},location:{hash:""},PortfolioModel:model,Intl,URLSearchParams,Date,Number,Math,setTimeout});
vm.runInContext(fs.readFileSync(require.resolve("./app.js"),"utf8"),context);
const rows=model.parseMarket([
  ["Symbol","Name","Price","1D %","1W %","52W High","52W Low","Updated At"],
  ["INDEXSP:.INX","S&P 500 Index",7722.6,0.006,0.0013,7844.52,6316.91,"2026-10-27 16:48"],
  ["NASDAQ:SOXX","SOXX",511.06,"",0.0221,655.95,260.44,"2026-10-27 16:00"],
  ["NASDAQ:MSFT","Microsoft",524.23,-0.0111,-0.0005,551.15,349.2,"2026-10-27 16:00"]
],Date.UTC(2026,9,28));
context.testRows=rows;
vm.runInContext("marketRows=testRows; marketStatus='3 of 3 quotes available'; renderMarket()",context);
const html=elements.get("market-rows").innerHTML;
assert.match(html,/7,722\.60/);
assert.match(html,/0\.60%/);
assert.match(html,/0\.13%/);
assert.match(html,/2\.21%/);
assert.match(html,/\.INX:INDEXSP/);
assert.match(html,/market-change ">—<\/td>/);
assert.equal((html.match(/<tr>/g)||[]).length,3);
assert.match(html,/Microsoft/);
assert.match(html,/MSFT:NASDAQ/);
assert.match(html,/market-range-track/);
assert.equal(elements.get("market-status").textContent,"3 of 3 quotes available");
assert.equal(vm.runInContext("MARKET_RANGE[0]",context),"'Market Watch'!A1:H50");
const portfolio={valueRanges:Array.from({length:15},()=>({values:[]}))};
portfolio.valueRanges[0].values=[["As-of date","Broker","Symbol","Shares","Currency","Average cost","Last price","Market value","Unrealized P/L"],["2026-10-28","IBKR","QLD",1,"USD",100,110,110,10]];
portfolio.valueRanges[4].values=[[1000]];
context.fetch=async()=>++context.fetchCount===1?{ok:true,json:async()=>portfolio}:{ok:false,status:404};
context.fetchCount=0;
vm.runInContext("token='test'; renderUnified=()=>{}",context);
(async()=>{
  await vm.runInContext("load()",context);
  assert.equal(vm.runInContext("data.positions.length",context),1);
  assert.match(elements.get("market-status").textContent,/unavailable/);
  assert.equal(elements.get("setup").hidden,true);
  console.log("market rendering and failure isolation passed");
})().catch(error=>{console.error(error);process.exitCode=1});
