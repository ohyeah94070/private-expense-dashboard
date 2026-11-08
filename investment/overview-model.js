/* Overview presentation sums only V2 Master values; no cost or P/L reconstruction. */
(function (root, factory) {
  const api = factory(root.V2Data || (typeof require === "function" ? require("./v2-data.js") : null));
  if (typeof module === "object" && module.exports) module.exports = api;
  root.OverviewModel = api;
})(typeof window !== "undefined" ? window : globalThis, function (V2) {
  "use strict";
  const PNL_FIELDS = Object.freeze(V2.SCHEMAS.pnl.slice(4));
  const sum = values => values.length && values.every(Number.isFinite) ? values.reduce((a, b) => a + b, 0) : null;
  const periodMonths = data => [...new Set(data.positions.map(row => row.date?.slice(0, 7)).filter(Boolean))].sort();
  const pnlMonths = data => [...new Set(data.pnl.map(row => row.date?.slice(0, 7)).filter(Boolean))].sort();
  const allMonths = data => [...new Set([...periodMonths(data), ...pnlMonths(data)])].sort();
  const rowsFor = (data, period, broker = "ALL") => (period === "current" ? data.current : data.positions.filter(row => row.date?.slice(0, 7) === period))
    .map((row, index) => ({row, index})).filter(({row}) => broker === "ALL" || row.broker === broker);
  function rowHKD(data, period, row) {
    if (period !== "current") return row["Market Value HKD"];
    const value = row["Market Value"], rate = row["FX to HKD"];
    if (!["HKD", "USD"].includes(row.currency) || value == null || rate == null || rate <= 0) return null;
    if (row.currency === "USD" && V2.fx(data, data.currentMonth) == null) return null;
    return value * rate;
  }
  function displayed(data, hkd, currency, period) {
    return currency === "HKD" ? hkd : V2.convert(data, hkd, "HKD", currency, period === "current" ? data.currentMonth : period);
  }
  function allocation(data, period = "current", broker = "ALL", currency = "HKD") {
    const navHKD = V2.nav(data, period, broker, "HKD");
    return rowsFor(data, period, broker).map(({row, index}) => {
      const hkd = rowHKD(data, period, row);
      return {id: `${period}:${index}`, broker: row.broker, assetType: row.assetType, symbol: row.symbol,
        sourceCurrency: row.currency, valueHKD: hkd, value: displayed(data, hkd, currency, period),
        weight: hkd != null && navHKD != null && navHKD > 0 ? hkd / navHKD : null};
    });
  }
  function selectedTotal(rows, selectedIds) {
    const selected = rows.filter(row => selectedIds.has(row.id));
    return rows.length && !selected.length ? 0 : sum(selected.map(row => row.value));
  }
  function summary(data, period = "current", broker = "ALL", currency = "HKD") {
    const rows = rowsFor(data, period, broker);
    const category = type => {
      const selected = rows.filter(({row}) => type === "cash" ? row.assetType.toLowerCase() === "cash" : ["stock", "etf", "mmf"].includes(row.assetType.toLowerCase()));
      return displayed(data, sum(selected.map(({row}) => rowHKD(data, period, row))), currency, period);
    };
    const unknown = rows.some(({row}) => !["stock", "etf", "mmf", "cash"].includes(row.assetType.toLowerCase()));
    return {nav: V2.nav(data, period, broker, currency), equity: unknown ? null : category("equity"), cash: category("cash")};
  }
  function pnlRows(data, start, end, broker = "ALL", symbol = "ALL", currency = "HKD") {
    return data.pnl.map((row, index) => ({row, index})).filter(({row}) => {
      const month = row.date?.slice(0, 7);
      return month && month >= start && month <= end && (broker === "ALL" || row.broker === broker) &&
        (symbol === "ALL" || row.symbol === symbol);
    }).map(({row, index}) => ({id: `pnl:${index}`, date: row.date, broker: row.broker, symbol: row.symbol,
      sourceCurrency: row.currency, amounts: Object.fromEntries(PNL_FIELDS.map(field =>
        [field, V2.convert(data, row[field], row.currency, currency, row.date.slice(0, 7))]))}));
  }
  function pnlTotals(rows, selectedIds) {
    const selected = rows.filter(row => selectedIds.has(row.id));
    return Object.fromEntries(PNL_FIELDS.map(field => [field, rows.length && !selected.length ? 0 : sum(selected.map(row => row.amounts[field]))]));
  }
  function openPositions(data, period = "current", broker = "ALL", currency = "HKD") {
    const groups = new Map();
    for (const {row} of rowsFor(data, period, broker)) {
      if (row.assetType.toLowerCase() === "cash") continue;
      const key = `${row.assetType}|${row.symbol}`;
      if (!groups.has(key)) groups.set(key, {symbol: row.symbol, assetType: row.assetType, byBroker: new Map()});
      const raw = period === "current" ? row["Unrealized P&L"] : row["Open Position P&L (USD)"];
      const from = period === "current" ? row.currency : "USD";
      const value = V2.convert(data, raw, from, currency, period === "current" ? data.currentMonth : period);
      const group = groups.get(key), prior = group.byBroker.get(row.broker) || [];
      prior.push(value);
      group.byBroker.set(row.broker, prior);
    }
    return [...groups.values()].map(group => {
      const ibkr = group.byBroker.has("IBKR") ? sum(group.byBroker.get("IBKR")) : null;
      const webull = group.byBroker.has("Webull HK") ? sum(group.byBroker.get("Webull HK")) : null;
      const combined = sum([...group.byBroker.values()].flat());
      return {symbol: group.symbol, assetType: group.assetType, ibkr, webull, combined};
    }).sort((a, b) => a.symbol.localeCompare(b.symbol));
  }
  function performance(data, broker = "ALL", currency = "HKD") {
    return allMonths(data).map(month => ({month, nav: V2.nav(data, month, broker, currency), pnl: V2.monthlyPnl(data, month, broker, currency)}));
  }
  return Object.freeze({PNL_FIELDS, periodMonths, pnlMonths, allMonths, allocation, selectedTotal, summary, pnlRows, pnlTotals, openPositions, performance});
});
