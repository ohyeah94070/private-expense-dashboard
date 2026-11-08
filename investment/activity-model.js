/* Trades and Cash Ledger presentation; original financial values come from V2Data. */
(function (root, factory) {
  const api = factory(root.V2Data || (typeof require === "function" ? require("./v2-data.js") : null));
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ActivityModel = api;
})(typeof window !== "undefined" ? window : globalThis, function (V2) {
  "use strict";
  const tradeMoney = ["Price", "Gross Amount", "Commission / Fee", "Net Cash Impact", "Avg Cost Before Trade", "Avg Cost After Trade", "Realized P&L"];
  const cashMoney = ["Cash Change"];
  function visible(data, type, start = "", end = "", broker = "ALL", currency = "HKD") {
    const source = type === "trades" ? data.trades : type === "cash" ? data.cash : [];
    const names = type === "trades" ? tradeMoney : cashMoney;
    return source.map((row, index) => ({row, index}))
      .filter(({row}) => (!start || row.date >= start) && (!end || row.date <= end) && (broker === "ALL" || row.broker === broker))
      .map(({row, index}) => ({...row, id: `${type}:${index}`, converted: Object.fromEntries(names.map(name => {
        const raw = type === "trades" ? row[name] : row.cashChange;
        return [name, V2.convert(data, raw, row.currency, currency, row.date.slice(0, 7))];
      }))}));
  }
  function selectedTotal(rows, selected, field) {
    const values = rows.filter(row => selected.has(row.id)).map(row => row.converted[field]);
    return values.every(Number.isFinite) ? values.reduce((sum, value) => sum + value, 0) : null;
  }
  return Object.freeze({visible, selectedTotal, tradeMoney, cashMoney});
});
