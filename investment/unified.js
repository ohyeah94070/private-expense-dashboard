(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;root.UnifiedPortfolio=api})(typeof window!=="undefined"?window:globalThis,function(){
const ok=Number.isFinite, add=xs=>xs.every(ok)?xs.reduce((a,b)=>a+b,0):NaN, include=(b,f)=>f==="ALL"||b===f;
const hkdRate=(ccy,usdHkd)=>ccy==="HKD"?1:ccy==="USD"&&usdHkd>0?usdHkd:NaN;
// Explicitly verified US identities. Unmapped ticker collisions stay broker-specific.
// QLD: https://www.proshares.com/globalassets/proshares/fact-sheet/prosharesfactsheetqld.pdf
// MU: https://investors.micron.com/static-files/de4cc557-90c7-4927-9295-60440b0a8cba
const knownUS={QLD:"74347R206",MU:"595112103"};
function positions(d,period="current",filter="ALL"){
 const current=period==="current", wm=d.webullMonthly.find(x=>x.month===period),fx=current?d.fx:wm?.fx, ih=d.history.find(x=>x.month===period),out=[];
 if(include("IBKR",filter)) for(const x of current?d.positions:d.valuations.filter(x=>x.month===period).map(x=>({symbol:x.symbol,shares:x.shares,currency:"USD",averageCost:x.shares>0?x.costBasis/x.shares:NaN,lastPrice:x.close,marketValue:x.marketValue,unrealized:x.unrealized,asOf:period}))) if(x.shares>0) out.push({broker:"IBKR",accountId:"IBKR",symbol:x.symbol,assetType:"STOCK",currency:x.currency||"USD",quantity:x.shares,averageCost:x.averageCost,costBasis:x.averageCost*x.shares,lastPrice:x.lastPrice,marketValue:x.marketValue,unrealizedPL:x.unrealized,valueHKD:x.marketValue*hkdRate(x.currency||"USD",current?d.fx:ih?.fx),valuationDate:current?x.asOf:period,dataSource:current?"IBKR snapshot":"IBKR reconstructed month end"});
 if(include("Webull",filter)) for(const x of current?d.webullCurrent.positions.map(x=>({...x,type:x.type==="EQUITY"?"STOCK":x.type,averageCost:x.cost,lastPrice:x.price,valueHKD:x.marketValue*hkdRate(x.currency,fx)})):d.webullHoldings.filter(x=>x.month===period).map(x=>({...x,averageCost:NaN,lastPrice:x.price,unrealized:NaN,valueHKD:x.hkd}))) if(x.shares>0) out.push({broker:"Webull",accountId:"Webull HK",symbol:x.symbol,securityName:x.name||x.symbol,assetType:x.type||"STOCK",currency:x.currency,quantity:x.shares,averageCost:x.averageCost,costBasis:x.averageCost*x.shares,lastPrice:x.lastPrice,marketValue:x.marketValue,unrealizedPL:x.unrealized,valueHKD:x.valueHKD,valuationDate:current?d.webullCurrent.asOf:period,dataSource:current?"Webull OpenAPI":"Webull official statement"});
 return out;
}
function aggregatePositions(positions){const groups=new Map();for(const p of positions){const verified=p.assetType==="STOCK"&&p.currency==="USD"?knownUS[p.symbol]:undefined;const key=verified?`CUSIP:${verified}`:[p.broker,p.assetType,p.currency,p.symbol].join("|");if(!groups.has(key))groups.set(key,{key,symbol:p.symbol,assetType:p.assetType,currency:p.currency,quantity:0,marketValue:0,valueHKD:0,parts:[],identity:verified||"Broker-specific"});const g=groups.get(key);g.parts.push(p);g.quantity+=p.quantity;g.marketValue+=p.marketValue;g.valueHKD+=p.valueHKD}return [...groups.values()].map(g=>{g.costBasis=add(g.parts.map(x=>x.costBasis));g.averageCost=ok(g.costBasis)?g.costBasis/g.quantity:NaN;g.unrealizedPL=add(g.parts.map(x=>x.unrealizedPL));g.lastPrice=g.parts.every(x=>x.lastPrice===g.parts[0].lastPrice)?g.parts[0].lastPrice:NaN;g.mixedTimes=new Set(g.parts.map(x=>x.valuationDate)).size>1;return g}).sort((a,b)=>b.valueHKD-a.valueHKD)}
function weightedFunding(d,month,filter,funding,brokerFunding){
 if(!ok(funding))return {weighted:NaN,method:"Missing funding"};
 const [year,monthNumber]=month.split("-").map(Number),days=new Date(Date.UTC(year,monthNumber,0)).getUTCDate();
 const ibkrRows=d.cash.filter(x=>["DEPOSIT","WITHDRAWAL"].includes(x.type)&&x.date.slice(0,7)===month);
 const webullMonth=d.webullMonthly.find(x=>x.month===month);
 const webullGross=ok(webullMonth?.deposits)&&ok(webullMonth?.withdrawals)?Math.abs(webullMonth.deposits)+Math.abs(webullMonth.withdrawals):NaN;
 if(funding===0&&(filter==="IBKR"?ibkrRows.length===0:filter==="Webull"?webullGross===0:ibkrRows.length===0&&webullGross===0))return {weighted:0,method:"No external funding"};
 const valid=ibkrRows.every(x=>x.currency==="HKD"&&ok(x.amount)&&/^\d{4}-\d{2}-\d{2}$/.test(x.date));
 const ibkrSum=valid?ibkrRows.reduce((s,x)=>s+x.amount,0):NaN;
 const statementWebull=webullMonth?.funding;
 const webullKnown=ok(statementWebull)&&Math.abs(statementWebull-(brokerFunding?.webull??NaN))<0.1;
 const ibkrKnown=valid&&Math.abs(ibkrSum-(brokerFunding?.ibkr??NaN))<0.1;
 if(ibkrKnown&&(filter==="IBKR"||filter==="ALL"&&webullKnown&&webullGross===0)){
   const weighted=ibkrRows.reduce((s,x)=>s+x.amount*(days-Number(x.date.slice(8))+1)/days,0);
   return {weighted,method:"Modified Dietz · dated IBKR flows"};
 }
 return {weighted:funding/2,method:"Estimate · undated funding at mid-month"};
}
function monthly(d,filter="ALL"){const opening={IBKR:d.history.find(x=>x.month==="2026-01")?.openingNAV,Webull:d.webullMonthly.find(x=>x.month==="2025-12")?.nav};const pick=(r,a,b)=>filter==="IBKR"?r[a]:filter==="Webull"?r[b]:add([r[a],r[b]]);return d.reconciliation.map((r,i)=>{const nav=pick(r,"ibkrNAV","webullNAV"),funding=pick(r,"ibkrFunding","webullFunding"),prior=i?pick(d.reconciliation[i-1],"ibkrNAV","webullNAV"):filter==="IBKR"?opening.IBKR:filter==="Webull"?opening.Webull:add([opening.IBKR,opening.Webull]);const pl=ok(nav)&&ok(prior)&&ok(funding)?nav-prior-funding:NaN;const priorPL=pick(r,"ibkrPL","webullPL"),check=ok(pl)&&ok(priorPL)?pl-priorPL:NaN;const weight=weightedFunding(d,r.month,filter,funding,{ibkr:r.ibkrFunding,webull:r.webullFunding});const capital=prior+weight.weighted;return {month:r.month,ibkrNAV:r.ibkrNAV,webullNAV:r.webullNAV,nav,funding,pl,monthlyReturn:ok(pl)&&ok(capital)&&capital>0?pl/capital:NaN,returnMethod:weight.method,check,status:!ok(nav)||!ok(prior)||!ok(funding)?"Missing":r.note||!ok(check)||Math.abs(check)>0.1?"Reconciliation required":"Complete",note:r.note||""}})}
function monthlyStocks(d,month,filter="ALL"){
  const result=[],hi=d.history.findIndex(x=>x.month===month),h=d.history[hi],prior=d.history[hi-1];
  if(include("IBKR",filter)&&h){
    const vals=d.valuations.filter(x=>x.month===month||x.month===prior?.month);
    const trades=d.trades.filter(x=>x.asset==="STK"&&x.date.slice(0,7)===month);
    const symbols=new Set([...vals.filter(x=>x.shares>0).map(x=>x.symbol),...trades.map(x=>x.symbol)]);
    for(const symbol of symbols){
      const now=vals.filter(x=>x.month===month&&x.symbol===symbol),before=vals.filter(x=>x.month===prior?.month&&x.symbol===symbol);
      const end=now.length?add(now.map(x=>x.unrealized))*h.fx:0,begin=prior?(before.length?add(before.map(x=>x.unrealized))*prior.fx:0):NaN;
      const realized=add(trades.filter(x=>x.symbol===symbol).map(x=>x.realized*hkdRate(x.currency,h.fx)));
      result.push({broker:"IBKR",symbol,value:ok(end)&&ok(begin)&&ok(realized)?end-begin+realized:NaN,status:prior?"Reconstructed":"Missing opening stock basis",source:"IBKR monthly valuation + trade P/L"});
    }
  }
  const wi=d.webullMonthly.findIndex(x=>x.month===month),w=d.webullMonthly[wi],wp=d.webullMonthly[wi-1];
  if(include("Webull",filter)&&w){
    const all=d.webullHoldings.filter(x=>x.type==="STOCK"&&(x.month===month||x.month===wp?.month));
    const fills=[...new Map((d.webullExecutions||[]).filter(x=>x.date.slice(0,7)===month).map(x=>[x.id,x])).values()];
    const symbols=new Set([...all.map(x=>x.symbol),...fills.map(x=>x.symbol)]);
    for(const symbol of symbols){
      const now=all.filter(x=>x.month===month&&x.symbol===symbol),before=all.filter(x=>x.month===wp?.month&&x.symbol===symbol),tx=fills.filter(x=>x.symbol===symbol);
      const endQ=now.reduce((s,x)=>s+x.shares,0),beginQ=before.reduce((s,x)=>s+x.shares,0);
      const tradeQ=tx.reduce((s,x)=>s+(x.side==="BUY"?x.quantity:-x.quantity),0);
      const quantityCheck=wp&&Math.abs(endQ-beginQ-tradeQ)<0.0001;
      const end=add(now.map(x=>x.hkd)),begin=add(before.map(x=>x.hkd));
      const cash=add(tx.map(x=>x.amount*hkdRate(x.currency,w.fx)));
      const value=quantityCheck&&ok(end)&&ok(begin)&&ok(cash)?end-begin+cash:NaN;
      result.push({broker:"Webull",symbol,value,status:!quantityCheck?"Missing executions":tx.length?"Estimated trade FX":"Statement movement",source:"Webull month-end holdings + filled API executions",quantityCheck});
    }
  }
  return result;
}
function resultBreakdown(d,month,filter="ALL"){
  const official=monthly(d,filter).find(x=>x.month===month),stocks=monthlyStocks(d,month,filter);
  const ih=d.history.find(x=>x.month===month),ia=(d.months||[]).find(x=>x.month===month),w=d.webullMonthly.find(x=>x.month===month);
  const lines=[];
  if(include("IBKR",filter)){
    lines.push({label:"IBKR dividends",value:ok(ia?.dividends)&&ok(ih?.fx)?ia.dividends*ih.fx:NaN});
    lines.push({label:"IBKR interest",value:ok(ia?.interest)&&ok(ih?.fx)?ia.interest*ih.fx:NaN});
    lines.push({label:"IBKR withholding tax",value:ok(ia?.tax)&&ok(ih?.fx)?ia.tax*ih.fx:NaN});
  }
  if(include("Webull",filter)){
    lines.push({label:"Webull net dividends",value:w?.dividends});
    lines.push({label:"Webull interest",value:w?.interest});
    lines.push({label:"Webull fees & tax",value:w?.fees});
  }
  const knownStock=stocks.filter(x=>ok(x.value)).reduce((s,x)=>s+x.value,0);
  const knownIncome=lines.filter(x=>ok(x.value)).reduce((s,x)=>s+x.value,0);
  const other=ok(official?.pl)?official.pl-knownStock-knownIncome:NaN;
  return {month,total:official?.pl,stocks,lines,knownStock,other,partial:stocks.some(x=>!ok(x.value))||lines.some(x=>!ok(x.value)),check:official?.check};
}
function openPositions(d,period="current",filter="ALL"){
  const current=period==="current",ih=d.history.find(x=>x.month===period),w=d.webullMonthly.find(x=>x.month===period);
  return aggregatePositions(positions(d,period,filter)).map(g=>{
    const parts=g.parts.map(p=>({broker:p.broker,value:p.unrealizedPL*hkdRate(p.currency,p.broker==="IBKR"?(current?d.fx:ih?.fx):(current?d.fx:w?.fx)),source:p.dataSource}));
    const known=parts.filter(p=>ok(p.value)).reduce((s,p)=>s+p.value,0);
    return {...g,partsOpen:parts,knownOpenHKD:known,combinedOpenHKD:add(parts.map(p=>p.value)),coverage:parts.every(p=>ok(p.value))?g.mixedTimes?"Mixed dates":"Complete":"Partial"};
  });
}
function auditMonth(d,month){
  const r=d.reconciliation.find(x=>x.month===month),h=d.history.find(x=>x.month===month),w=d.webullMonthly.find(x=>x.month===month);
  if(!r)return null;
  const ledgerFunding=d.cash.filter(x=>x.date.slice(0,7)===month&&["DEPOSIT","WITHDRAWAL"].includes(x.type)&&x.currency==="HKD").reduce((s,x)=>s+x.amount,0);
  const checks={
    combinedNAV:ok(r.combinedNAV)?r.combinedNAV-r.ibkrNAV-r.webullNAV:NaN,
    monthlyPL:monthly(d,"ALL").find(x=>x.month===month)?.check,
    ibkrFunding:ok(r.ibkrFunding)?r.ibkrFunding-ledgerFunding:NaN,
    webullFunding:ok(w?.funding)?r.webullFunding-w.funding:NaN,
    webullAssets:ok(w?.nav)?w.nav-w.cash-w.stocks-w.funds-(w.amc||0):NaN,
    ibkrReconstructed:ok(h?.officialNAV)&&ok(h?.reconstructedNAV)?h.officialNAV-h.reconstructedNAV:NaN
  };
  return {month,checks,sourceStatus:r.note?"Reconciliation required":"Complete",note:r.note||""};
}
function summary(d,period="current",filter="ALL"){const current=period==="current",h=d.history.find(x=>x.month===period),w=d.webullMonthly.find(x=>x.month===period),rows=monthly(d,filter),month=rows.find(x=>x.month===period),pick=(a,b)=>filter==="IBKR"?a:filter==="Webull"?b:add([a,b]);return {nav:pick(current?d.metrics.totalHKD:h?.totalHKD,current?d.webullCurrent.nav:w?.nav),equity:pick(current?d.metrics.equityHKD:h?.equityHKD,current?d.webullCurrent.market:ok(w?.stocks)&&ok(w?.funds)?w.stocks+w.funds:NaN),cash:pick(current?d.metrics.cashHKD:h?.cashTotalHKD,current?d.webullCurrent.cash:w?.cash),unrealized:pick(current?d.metrics.unrealizedHKD:h?.unrealizedHKD,current?d.webullCurrent.unrealized:NaN),realized:filter==="IBKR"?(current?d.metrics.realizedHKD:h?.realizedUSD*h?.fx):NaN,monthlyPL:month?.pl,ytdPL:add(rows.filter(x=>current||x.month<=period).map(x=>x.pl)),month,lastComplete:rows.filter(x=>x.status==="Complete").at(-1),latestMonth:rows.at(-1)?.month,status:current?"Partial":month?.status||"Missing",asOf:current?`IBKR ${d.asOf||"unknown"}; Webull ${d.webullCurrent.asOf||"unknown"}`:`${period} month end`}}
function activities(d,filter="ALL"){const out=[];if(include("IBKR",filter)){for(const t of d.trades)out.push({id:`IBKR:T:${t.id}`,broker:"IBKR",date:t.date,type:t.asset==="CASH"?"FX":t.side,symbol:t.symbol,description:t.asset==="CASH"?"FX trade":"Stock execution",quantity:t.quantity,price:t.price,currency:t.currency,amount:t.netCash,fee:t.commission,realizedPL:t.realized,source:"IBKR trade record",status:"Complete"});for(const c of d.cash)out.push({id:`IBKR:C:${c.id}`,broker:"IBKR",date:c.date,settlementDate:c.settlement,type:c.type==="TAX"?"WITHHOLDING_TAX":c.type,symbol:c.symbol,description:c.description,quantity:NaN,price:NaN,currency:c.currency,amount:c.amount,source:"IBKR cash ledger",status:"Complete"})}if(include("Webull",filter))for(const e of d.webullExecutions||[])out.push({id:`Webull:E:${e.id}`,broker:"Webull",date:e.date.slice(0,10),time:e.date,type:e.side,symbol:e.symbol,description:"Webull OpenAPI execution",quantity:e.quantity,price:e.price,currency:e.currency,amount:e.amount,source:e.source,status:"Partial"});const unique=new Map();for(const x of out)if(!unique.has(x.id))unique.set(x.id,x);return [...unique.values()].sort((a,b)=>(b.time||b.date).localeCompare(a.time||a.date))}
return {positions,aggregatePositions,monthly,summary,activities,monthlyStocks,resultBreakdown,openPositions,auditMonth};
});
