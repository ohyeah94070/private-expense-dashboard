const assert=require("node:assert/strict");
const U=require("./unified.js");
const M=require("./model.js");

const base={
 officialThrough:"2026-02",
 asOf:"2026-02-28",metrics:{totalHKD:130},webullCurrent:{nav:115,asOf:"2026-02-28"},
 months:[{month:"2026-01",deposits:10,withdrawals:0}],
 history:[
  {month:"2026-01",openingNAV:100,officialNAV:120,netFundingHKD:10,totalPL:10},
  {month:"2026-02",officialNAV:130,netFundingHKD:0,totalPL:10}
 ],
 webullMonthly:[
  {month:"2025-12",nav:100,statement:"Official statement"},
  {month:"2026-01",nav:110,deposits:0,withdrawals:0,funding:0,pl:10,statement:"Official statement"},
  {month:"2026-02",nav:115,deposits:0,withdrawals:0,funding:0,pl:5,statement:"Official statement"}
 ],
 reconciliation:[
  {month:"2026-01",ibkrNAV:120,webullNAV:110,ibkrFunding:10,webullFunding:0,ibkrPL:10,webullPL:10,check:0},
  {month:"2026-02",ibkrNAV:130,webullNAV:115,ibkrFunding:0,webullFunding:0,ibkrPL:10,webullPL:5,check:0}
 ],
 cash:[{id:"I1",date:"2026-01-10",type:"DEPOSIT",currency:"HKD",amount:10}],
 fundingDetail:[{month:"2026-01",date:"2026-01-10",broker:"IBKR",type:"DEPOSIT",amount:10,source:"Cash Ledger ID I1",id:"I1",treatment:"Recorded broker cash flow"}]
};
const clone=()=>structuredClone(base);
const month=(d,key="2026-02")=>U.monthly(d).find(x=>x.month===key);

// The original seven assessment cases: complete input, unknown funding, missing NAV,
// month gap, offsetting broker flows, empty ledger, and ordinary trading/income.
assert.equal(month(base).status,"Complete");
assert.equal(month(base,"2026-01").status,"Complete");
assert.equal(U.monthly(base,"IBKR")[1].status,"Complete");
assert.equal(U.monthly(base,"Webull")[1].status,"Complete");
assert.equal(month(base).pl,15);
assert.equal(month(base).funding,0); // Zero is supported by signed-off official monthly categories.
let d=clone();d.webullMonthly[2].funding=NaN;
assert.equal(month(d).status,"Incomplete");assert.ok(Number.isNaN(month(d).funding));assert.equal(month(d).pl,15);
d=clone();d.history[1].officialNAV=NaN;
assert.equal(month(d).status,"Incomplete");
d=clone();d.reconciliation.splice(0,1);d.reconciliation[0].ibkrPL=30;d.reconciliation[0].webullPL=15;
assert.equal(month(d).status,"Incomplete");
d=clone();d.history[1].netFundingHKD=5;d.webullMonthly[2].withdrawals=-5;d.webullMonthly[2].funding=-5;
d.history[1].totalPL=5;d.webullMonthly[2].pl=10;
Object.assign(d.reconciliation[1],{ibkrFunding:5,webullFunding:-5,ibkrPL:5,webullPL:10});
d.cash.push({id:"I2",date:"2026-02-10",type:"DEPOSIT",currency:"HKD",amount:5});
d.fundingDetail.push({month:"2026-02",date:"2026-02-10",broker:"IBKR",type:"DEPOSIT",amount:5,source:"Cash Ledger ID I2",id:"I2",treatment:"Recorded broker cash flow"},
 {month:"2026-02",date:"2026-02-11",broker:"Webull",type:"WITHDRAWAL",amount:-5,source:"Official statement p. 3",id:"W2",treatment:"Recorded broker withdrawal"});
assert.equal(month(d).pl,15);assert.equal(month(d).status,"Incomplete");
d.fundingDetail.slice(-2).forEach(x=>x.treatment="Verified external cash flow");
assert.equal(month(d).status,"Complete"); // Independently classified external legs may offset.
d=clone();d.cash=[];
assert.equal(month(d,"2026-01").status,"Incomplete");
d=clone();d.trades=[{date:"2026-02-10",side:"BUY",netCash:-20,commission:1}];
d.cash.push({id:"D1",date:"2026-02-11",type:"DIVIDEND",currency:"USD",amount:2},
 {id:"T1",date:"2026-02-12",type:"TAX",currency:"USD",amount:-0.3});
assert.equal(month(d).status,"Complete");assert.equal(month(d).pl,15);

// Boundary cases for source, classification, sign-off, and existing reconciliation.
d=clone();d.fundingDetail=[];
assert.equal(month(d,"2026-01").status,"Incomplete");
d=clone();d.fundingDetail.push({month:"2026-02",date:"2026-02-12",broker:"Webull",type:"UNKNOWN",amount:0,source:"PDF",id:"W3",treatment:"REVIEW"});
assert.equal(month(d).status,"Incomplete");
d=clone();d.webullMonthly[2].statement="API estimate";
assert.equal(month(d).status,"Incomplete");
d=clone();d.officialThrough="2026-01";
assert.equal(month(d).status,"Preliminary");
d=clone();d.reconciliation[1].check=2;
assert.equal(month(d).status,"Incomplete");
d=clone();d.reconciliation[1].ibkrPL=0;
assert.equal(month(d).status,"Reconciliation required");
d=clone();d.reconciliation[1].ibkrNAV=131;
assert.equal(month(d).status,"Reconciliation required");
d=clone();d.fundingDetail=undefined;
assert.equal(month(d).status,"Incomplete");
console.log("monthly Complete/Official gate: 7 core and 8 boundary fixtures passed");

const ytd=d=>U.summary(d,"current");
assert.equal(ytd(base).ytdPL,35);assert.equal(ytd(base).ytdStatus,"Complete");
assert.equal(U.summary(base,"2026-01").ytdStatus,"Complete");
d=clone();d.officialThrough="2026-01";
assert.equal(ytd(d).ytdPL,35);assert.equal(ytd(d).ytdStatus,"Preliminary");
d=clone();d.fundingDetail=[];
assert.equal(ytd(d).ytdPL,35);assert.equal(ytd(d).ytdStatus,"Incomplete");
d=clone();d.reconciliation[0].note="Unknown funding";
assert.equal(ytd(d).ytdStatus,"Incomplete");
d=clone();d.reconciliation.splice(0,1);
assert.ok(Number.isNaN(ytd(d).ytdPL));assert.equal(ytd(d).ytdStatus,"Missing");
d=clone();d.reconciliation[1].ibkrFunding=NaN;
assert.ok(Number.isNaN(ytd(d).ytdPL));assert.equal(ytd(d).ytdStatus,"Missing");
const legacy=M.accountYTD(base,U.monthly(base,"IBKR"));
assert.equal(legacy.status,"Complete");assert.equal(legacy.funding,10);assert.equal(legacy.total,20);
d=clone();d.months=[];
assert.equal(M.accountYTD(d,U.monthly(d,"IBKR")).status,"Incomplete");
assert.ok(Number.isNaN(M.accountYTD(d,U.monthly(d,"IBKR")).funding));
d=clone();d.officialThrough="2026-01";
assert.ok(Number.isNaN(M.accountYTD(d,U.monthly(d,"IBKR")).total));
console.log("YTD status propagation: complete, mixed, missing, and empty-ledger fixtures passed");
