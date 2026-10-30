(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PortfolioModel = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const n = value => value === "" || value == null ? NaN : Number(value);
  const rows = item => item?.values || [];
  const value = item => n(rows(item)[0]?.[0]);
  const text = value => String(value ?? "").trim();
  function monthlyBreakdown(history, activity, month) {
    const index=history.findIndex(x=>x.month===month);
    if(index<0) return null;
    const row=history[index], prior=history[index-1], flows=activity.find(x=>x.month===month);
    const fx=row.fx;
    const changeUnrealized=prior ? row.unrealizedHKD-prior.unrealizedHKD : NaN;
    const realized=(flows?.realized??0)*fx;
    const dividends=(flows?.dividends??0)*fx;
    const interest=(flows?.interest??0)*fx;
    const tax=(flows?.tax??0)*fx;
    const known=changeUnrealized+realized+dividends+interest+tax;
    return {total:row.totalPL,endUnrealized:row.unrealizedHKD,changeUnrealized,realized,dividends,interest,tax,other:Number.isFinite(row.totalPL)&&Number.isFinite(known)?row.totalPL-known:NaN};
  }
  function accountYTD(data) {
    const opening=data.history.find(x=>x.month==="2026-01")?.openingNAV;
    const closing=data.metrics.totalHKD;
    const through=data.asOf.slice(0,7);
    const funding=data.months.filter(x=>x.month.startsWith("2026-")&&x.month<=through).reduce((sum,x)=>sum+x.deposits+x.withdrawals,0);
    return {opening,closing,funding,total:Number.isFinite(opening)&&Number.isFinite(closing)?closing-opening-funding:NaN};
  }
  function stockBreakdown(data, period) {
    const current=period==="current";
    const index=data.history.findIndex(x=>x.month===period);
    const month=data.history[index], prior=data.history[index-1];
    const fx=current?data.fx:month?.fx;
    const symbols=new Set();
    const holdings=current?data.positions:data.valuations.filter(x=>x.month===period||x.month===prior?.month);
    for(const row of holdings) if(row.symbol&&(current?row.shares>0:row.shares>0||row.unrealized!==0)) symbols.add(row.symbol);
    for(const trade of data.trades) if(trade.asset==="STK"&&(current||trade.date.slice(0,7)===period)) symbols.add(trade.symbol);
    for(const cash of data.cash) if(["DIVIDEND","TAX"].includes(cash.type)&&(current||cash.date.slice(0,7)===period)&&cash.symbol) symbols.add(cash.symbol);
    return [...symbols].sort().map(symbol=>{
      const open=current?data.positions.filter(x=>x.symbol===symbol).reduce((s,x)=>s+x.unrealized,0)*fx:(()=>{
        const atEnd=data.valuations.filter(x=>x.month===period&&x.symbol===symbol).reduce((s,x)=>s+x.unrealized,0)*fx;
        const before=prior?data.valuations.filter(x=>x.month===prior.month&&x.symbol===symbol).reduce((s,x)=>s+x.unrealized,0)*prior.fx:NaN;
        return atEnd-before;
      })();
      const realized=data.trades.filter(x=>x.asset==="STK"&&x.symbol===symbol&&(current||x.date.slice(0,7)===period)).reduce((s,x)=>s+x.realized*(x.currency==="USD"?fx:1),0);
      const income=data.cash.filter(x=>x.symbol===symbol&&["DIVIDEND","TAX"].includes(x.type)&&(current||x.date.slice(0,7)===period)).reduce((s,x)=>s+x.amount*(x.currency==="USD"?fx:1),0);
      return {symbol,open,realized,income,total:open+realized+income};
    });
  }
  function holdingsForPeriod(data, period) {
    const holdings=period==="current"?data.positions:data.valuations.filter(x=>x.month===period).map(x=>({
      asOf:period,broker:"IBKR",symbol:x.symbol,shares:x.shares,currency:"USD",
      averageCost:x.shares>0?x.costBasis/x.shares:NaN,lastPrice:x.close,
      marketValue:x.marketValue,unrealized:x.unrealized
    }));
    return holdings.filter(x=>x.shares>0).sort((a,b)=>b.marketValue-a.marketValue);
  }
  function cashUSDForPeriod(data, period) {
    if(period==="current") return data.fx>0?data.metrics.cashHKD/data.fx:NaN;
    const month=data.history.find(x=>x.month===period);
    return month?.fx>0?month.cashUSD+month.cashHKD/month.fx:NaN;
  }
  function parseMarket(values, now=Date.now()) {
    return values.slice(1).filter(row=>text(row[0])).map(row=>{
      const updatedAt=text(row[7]);
      const date=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(updatedAt)?Date.parse(updatedAt.slice(0,10)+"T00:00:00Z"):NaN;
      const fresh=Number.isFinite(date)&&date<=now+86400000&&now-date<=7*86400000;
      const metric=index=>fresh?n(row[index]):NaN;
      const positive=index=>metric(index)>0?metric(index):NaN;
      let high=positive(5),low=positive(6);
      if(high<low) high=low=NaN;
      return {symbol:text(row[0]),name:text(row[1]),price:positive(2),day:metric(3),week:metric(4),high,low,pe:positive(8),updatedAt:fresh?updatedAt:"",stale:!fresh};
    });
  }
  function parse(portfolio) {
    const p = portfolio.valueRanges || [];
    const positions = rows(p[0]).slice(1).filter(r => text(r[2])).map(r => ({
      asOf: text(r[0]), broker: text(r[1]), symbol: text(r[2]), shares: n(r[3]),
      currency: text(r[4]), averageCost: n(r[5]), lastPrice: n(r[6]),
      marketValue: n(r[7]), unrealized: n(r[8])
    }));
    const trades = rows(p[1]).slice(1).filter(r => text(r[0]) && text(r[10])).map(r => ({
      date: text(r[0]), broker: text(r[1]), asset: text(r[2]), symbol: text(r[3]),
      side: text(r[4]), quantity: n(r[5]), price: n(r[6]), currency: text(r[7]),
      commission: n(r[8]), netCash: n(r[9]), id: text(r[10]), realized: n(r[11])
    }));
    const cash = rows(p[2]).slice(1).filter(r => text(r[0]) && text(r[7])).map(r => ({
      date: text(r[0]), broker: text(r[1]), type: text(r[2]), currency: text(r[3]),
      amount: n(r[4]), symbol: text(r[5]), description: text(r[6]),
      id: text(r[7]), settlement: text(r[8])
    }));
    const months = rows(p[3]).slice(1).filter(r => /^\d{4}-\d{2}$/.test(text(r[0]))).map(r => ({
      month: text(r[0]), trades: n(r[1]), deposits: n(r[2]), withdrawals: n(r[3]),
      dividends: n(r[4]), interest: n(r[5]), tax: n(r[6]), realized: n(r[7])
    }));
    const history=rows(p[13]).slice(1).filter(r=>/^\d{4}-\d{2}$/.test(text(r[0]))).map(r=>({
      month:text(r[0]),equityUSD:n(r[1]),cashUSD:n(r[2]),cashHKD:n(r[3]),fx:n(r[4]),
      equityHKD:n(r[5]),cashTotalHKD:n(r[6]),totalHKD:n(r[12])||n(r[7]),reconstructedNAV:n(r[7]),officialNAV:n(r[12]),unrealizedHKD:n(r[8]),
      realizedUSD:n(r[9]),totalPL:n(r[10]),netFundingHKD:n(r[11]),openingNAV:n(r[13])
    }));
    const valuations=rows(p[14]).slice(1).filter(r=>/^\d{4}-\d{2}$/.test(text(r[0]))).map(r=>({
      month:text(r[0]),symbol:text(r[1]),shares:n(r[2]),close:n(r[3]),marketValue:n(r[4]),
      costBasis:n(r[7]),unrealized:n(r[8])
    }));
    const webullMonthly=rows(p[15]).slice(1).filter(r=>/^\d{4}-\d{2}$/.test(text(r[0]))).map(r=>({
      month:text(r[0]),nav:n(r[1]),cash:n(r[2]),stocks:n(r[3]),funds:n(r[4]),amc:n(r[5]),
      deposits:n(r[6]),withdrawals:n(r[7]),funding:n(r[8]),pl:n(r[9]),fx:n(r[10]),
      dividends:n(r[11]),fees:n(r[12]),interest:n(r[13]),other:n(r[14]),statement:text(r[17]),withdrawalDate:text(r[18])
    }));
    const webullHoldings=rows(p[16]).slice(1).filter(r=>/^\d{4}-\d{2}$/.test(text(r[0]))).map(r=>({
      month:text(r[0]),type:text(r[1]),symbol:text(r[2]),name:text(r[3]),shares:n(r[4]),
      price:n(r[5]),marketValue:n(r[6]),currency:text(r[7]),hkd:n(r[8])
    }));
    const currentRows=rows(p[17]);
    const webullCurrent={asOf:text(currentRows[1]?.[1]),nav:n(currentRows[2]?.[1]),
      market:n(currentRows[3]?.[1]),cash:n(currentRows[4]?.[1]),unrealized:n(currentRows[5]?.[1]),
      source:text(currentRows[6]?.[1]),positions:currentRows.slice(9).filter(r=>text(r[0])).map(r=>({
        symbol:text(r[0]),type:text(r[1]),shares:n(r[2]),currency:text(r[3]),
        cost:n(r[4]),price:n(r[5]),marketValue:n(r[6]),unrealized:n(r[7])
      }))};
    const reconciliation=rows(p[18]).slice(1).filter(r=>/^\d{4}-\d{2}$/.test(text(r[0]))).map(r=>({
      month:text(r[0]),ibkrNAV:n(r[1]),webullNAV:n(r[2]),combinedNAV:n(r[3]),
      ibkrFunding:n(r[4]),webullFunding:n(r[5]),combinedFunding:n(r[6]),
      ibkrPL:n(r[7]),webullPL:n(r[8]),combinedPL:n(r[9]),check:n(r[10]),note:text(r[11])
    }));
    const webullExecutions=rows(p[19]).slice(1).filter(r=>text(r[0])&&text(r[1])).map(r=>({
      id:text(r[0]),date:text(r[1]),symbol:text(r[2]),side:text(r[3]),
      quantity:n(r[4]),price:n(r[5]),currency:text(r[6]),amount:n(r[7]),status:text(r[8]),source:text(r[9])
    }));
    return {
      positions, trades, cash, months, history, valuations,
      webullMonthly,webullHoldings,webullCurrent,reconciliation,webullExecutions,
      fx: value(p[12]),
      metrics: {
        totalHKD: value(p[4]), equityHKD: value(p[5]), cashHKD: value(p[6]),
        unrealizedHKD: value(p[7]), realizedHKD: value(p[8]),
        dividendsHKD: value(p[9]), interestHKD: value(p[10]), taxHKD: value(p[11])
      },
      asOf: positions[0]?.asOf || "",
      cashThrough: cash.reduce((last, r) => r.date > last ? r.date : last, "")
    };
  }

  return { parse, monthlyBreakdown, accountYTD, stockBreakdown, holdingsForPeriod, cashUSDForPeriod, parseMarket };
});
