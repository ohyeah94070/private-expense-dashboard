/* Holdings presentation uses Current Positions only. */
(function (root, factory) {
  const api = factory(root.V2Data || (typeof require === "function" ? require("./v2-data.js") : null),
    root.OverviewModel || (typeof require === "function" ? require("./overview-model.js") : null));
  if (typeof module === "object" && module.exports) module.exports = api;
  root.HoldingsModel = api;
})(typeof window !== "undefined" ? window : globalThis, function (V2, Overview) {
  "use strict";
  const sum = values => values.length && values.every(Number.isFinite) ? values.reduce((a, b) => a + b, 0) : null;
  function rows(data, broker = "ALL", currency = "HKD") {
    const allocation = new Map(Overview.allocation(data, "current", broker, currency).map(row => [Number(row.id.split(":")[1]), row]));
    const combinedNavHKD = V2.nav(data, "current", "ALL", "HKD");
    return data.current.map((source, index) => ({source, index})).filter(({source}) => broker === "ALL" || source.broker === broker).map(({source, index}) => {
      const base = allocation.get(index);
      const convert = value => V2.convert(data, value, source.currency, currency, data.currentMonth);
      return {...base, id: `holding:${index}`, weight: Number.isFinite(base.valueHKD) && Number.isFinite(combinedNavHKD) && combinedNavHKD > 0 ? base.valueHKD / combinedNavHKD : null,
        quantity: source["Quantity"], avgCost: convert(source["Avg Cost"]),
        currentPrice: convert(source["Current Price"]), openPL: convert(source["Unrealized P&L"]), date: source.date};
    });
  }
  function selectedTotal(visibleRows, selectedIds) { return visibleRows.length ? Overview.selectedTotal(visibleRows, selectedIds) : 0; }
  function selectedOpenPL(visibleRows, selectedIds) {
    return visibleRows.filter(row => selectedIds.has(row.id) && Number.isFinite(row.openPL))
      .reduce((total, row) => total + row.openPL, 0);
  }
  function selectedWeight(visibleRows, selectedIds) { return Overview.selectedWeight(visibleRows, selectedIds); }
  function groupKey(row) {
    const type = row.assetType.toLowerCase();
    if (type === "cash") return {key: `cash:${row.sourceCurrency}`, label: `Cash (${row.sourceCurrency})`, category: "cash"};
    if (type === "mmf") return row.symbol ? {key: `mmf:${row.symbol}`, label: `MMF (${row.symbol})`, category: "mmf"}
      : {key: `mmf:unknown:${row.id}`, label: `MMF (symbol — · ${row.broker})`, category: "mmf"};
    return row.symbol ? {key: `symbol:${row.symbol}`, label: row.symbol, category: "asset"}
      : {key: `unknown:${row.id}`, label: `${row.assetType} (symbol — · ${row.broker})`, category: "asset"};
  }
  function donut(data, visibleRows, selectedIds, broker = "ALL", currency = "HKD") {
    const navHKD = V2.nav(data, "current", broker, "HKD");
    const groups = new Map();
    let missing = false;
    for (const row of visibleRows) {
      const {key, label, category} = groupKey(row);
      if (!groups.has(key)) groups.set(key, {key, label, category, selectedHKD: 0, unselectedHKD: 0,
        negativeSelectedHKD: 0, negativeUnselectedHKD: 0, negativeHKD: 0, brokers: new Set()});
      const group = groups.get(key);
      group.brokers.add(row.broker);
      if (!Number.isFinite(row.valueHKD)) { missing = true; continue; }
      if (row.valueHKD < 0) {
        group.negativeHKD += row.valueHKD;
        if (selectedIds.has(row.id)) group.negativeSelectedHKD += row.valueHKD;
        else group.negativeUnselectedHKD += row.valueHKD;
      }
      else if (selectedIds.has(row.id)) group.selectedHKD += row.valueHKD;
      else group.unselectedHKD += row.valueHKD;
    }
    const entries = [...groups.values()].map(group => ({...group, brokers: [...group.brokers], positiveHKD: group.selectedHKD + group.unselectedHKD,
      weight: navHKD != null && navHKD > 0 ? (group.selectedHKD + group.unselectedHKD) / navHKD : null,
      negativeWeight: navHKD != null && navHKD > 0 ? group.negativeHKD / navHKD : null}));
    const positiveTotalHKD = sum(entries.filter(group => group.positiveHKD > 0).map(group => group.positiveHKD));
    const negativeCashHKD = entries.filter(group => group.category === "cash").reduce((total, group) => total + group.negativeHKD, 0);
    const otherNegativeHKD = entries.filter(group => group.category !== "cash").reduce((total, group) => total + group.negativeHKD, 0);
    const slices = missing || positiveTotalHKD == null || positiveTotalHKD <= 0 ? [] : entries.flatMap(group => [
      group.selectedHKD > 0 ? {key: group.key, label: group.label, selected: true, valueHKD: group.selectedHKD, angleShare: group.selectedHKD / positiveTotalHKD} : null,
      group.unselectedHKD > 0 ? {key: group.key, label: group.label, selected: false, valueHKD: group.unselectedHKD, angleShare: group.unselectedHKD / positiveTotalHKD} : null
    ].filter(Boolean));
    return {entries, slices, navHKD, nav: currency === "HKD" ? navHKD : V2.convert(data, navHKD, "HKD", "USD", data.currentMonth),
      positiveTotalHKD, positiveTotal: currency === "HKD" ? positiveTotalHKD : V2.convert(data, positiveTotalHKD, "HKD", "USD", data.currentMonth),
      negativeCashHKD, negativeCash: currency === "HKD" ? negativeCashHKD : V2.convert(data, negativeCashHKD, "HKD", "USD", data.currentMonth),
      otherNegativeHKD, otherNegative: currency === "HKD" ? otherNegativeHKD : V2.convert(data, otherNegativeHKD, "HKD", "USD", data.currentMonth), missing};
  }
  return Object.freeze({rows, selectedTotal, selectedOpenPL, selectedWeight, groupKey, donut});
});
