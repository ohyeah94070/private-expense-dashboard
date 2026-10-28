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
  function parseMarket(values, now=Date.now()) {
    return values.slice(1).filter(row=>text(row[0])).map(row=>{
      const updatedAt=text(row[7]);
      const date=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(updatedAt)?Date.parse(updatedAt.slice(0,10)+"T00:00:00Z"):NaN;
      const fresh=Number.isFinite(date)&&date<=now+86400000&&now-date<=7*86400000;
      const metric=index=>fresh?n(row[index]):NaN;
      const positive=index=>metric(index)>0?metric(index):NaN;
      let high=positive(5),low=positive(6);
      if(high<low) high=low=NaN;
      return {symbol:text(row[0]),name:text(row[1]),price:positive(2),day:metric(3),week:metric(4),high,low,updatedAt:fresh?updatedAt:"",stale:!fresh};
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
      equityHKD:n(r[5]),cashTotalHKD:n(r[6]),totalHKD:n(r[12])||n(r[7]),unrealizedHKD:n(r[8]),
      realizedUSD:n(r[9]),totalPL:n(r[10]),netFundingHKD:n(r[11])
    }));
    const valuations=rows(p[14]).slice(1).filter(r=>/^\d{4}-\d{2}$/.test(text(r[0]))).map(r=>({
      month:text(r[0]),symbol:text(r[1]),shares:n(r[2]),close:n(r[3]),marketValue:n(r[4]),
      costBasis:n(r[7]),unrealized:n(r[8])
    }));
    return {
      positions, trades, cash, months, history, valuations,
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

  return { parse, monthlyBreakdown, stockBreakdown, holdingsForPeriod, parseMarket };
});
