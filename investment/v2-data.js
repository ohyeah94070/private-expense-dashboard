/* Read-only presentation adapter for the V2 Master Spreadsheet. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.V2Data = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const SHEET_ID = "1FBXMRVSJZFZGjG4K_62nRxuhaTYTt-wvscYNPaxcxeA";
  const RANGES = Object.freeze([
    "'Current Positions'!A1:S1000", "'Positions'!A1:Q1000",
    "'Monthly P&L'!A1:M2000", "'Trades'!A1:Q1001",
    "'Cash Ledger'!A1:I1000", "'Market Watch'!A1:P1000", "'Monthly Return'!A1:G100"
  ]);
  const SCHEMAS = Object.freeze({
    current: ["As of Date", "Broker", "Asset Type", "Symbol", "Currency", "Quantity", "Avg Cost", "Current Price", "Market Value", "Unrealized P&L", "Realized P&L", "Dividend", "Interest", "Commission", "Fee", "Tax", "Other Income/Expense", "Monthly P&L", "FX to HKD"],
    positions: ["Statement Date", "Broker", "Asset Type", "Symbol", "Quantity / Amount", "Currency", "Statement Closing Price (USD)", "FX to HKD", "Market Value HKD", "Prior Statement Date", "Period Net Movement", "Prior Qty / Amount", "Rebuilt Qty / Amount", "Difference", "Open Position P&L (USD)", "Reconciliation", "Corporate Action Qty Δ"],
    pnl: ["Date", "Broker", "Symbol", "Currency", "Realized P&L", "Unrealized P&L", "Dividend", "Interest", "Commission", "Fee", "Tax", "Other Income/Expense", "Monthly P&L"],
    trades: ["Trade Date", "Broker", "Symbol", "Action", "Quantity", "Price", "Currency", "Gross Amount", "Commission / Fee", "Net Cash Impact", "Quantity After Trade", "Avg Cost Before Trade", "Avg Cost After Trade", "Realized P&L", "Source", "Status", "Review Notes"],
    cash: ["Date", "Broker", "Event Type", "Description", "Currency", "Cash Change", "Source", "Status", "Notes"],
    market: ["Symbol", "Name", "Price", "1D %", "1W %", "52W High", "52W Low", "Updated At", "P/E (Google)", "Drawdown From High (5Y)", "Max DD Strength (5Y)", "Current DD Strength", "Strength Percentile", "Price vs 50D MA", "Price vs 100D MA", "Price vs 200D MA"],
    returns: ["Month", "Beginning NAV (HKD)", "Ending NAV (HKD)", "Net External Flow (HKD)", "Weighted External Flow (HKD)", "Monthly P&L (HKD)", "Monthly Return (%)"]
  });
  const clean = value => String(value ?? "").replace(/^\uFEFF/, "").trim();
  function amount(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    let s = clean(value);
    if (!s || s === "—" || s === "-") return null;
    const negative = /^\(.*\)$/.test(s);
    if (negative) s = s.slice(1, -1).trim();
    if (!/^[+-]?(?:\d+(?:,\d{3})*|\d*)(?:\.\d+)?$/.test(s) || !/\d/.test(s)) return null;
    const n = Number(s.replace(/,/g, ""));
    return Number.isFinite(n) ? (negative ? -n : n) : null;
  }
  function date(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000);
      return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    }
    const s = clean(value);
    const match = /^(\d{4})[-/]([01]?\d)[-/]([0-3]?\d)/.exec(s);
    if (!match) return null;
    const y = Number(match[1]), m = Number(match[2]), day = Number(match[3]);
    const d = new Date(Date.UTC(y, m - 1, day));
    return d.getUTCFullYear() === y && d.getUTCMonth() === m - 1 && d.getUTCDate() === day ? d.toISOString().slice(0, 10) : null;
  }
  const month = value => date(value)?.slice(0, 7) ?? null;
  function table(values, schema, label) {
    if (!Array.isArray(values) || !values.length) throw new Error(`${label}: missing header`);
    const columns = new Map();
    values[0].forEach((header, index) => {
      const name = clean(header);
      if (name) {
        if (columns.has(name)) throw new Error(`${label}: duplicate header ${name}`);
        columns.set(name, index);
      }
    });
    for (const name of schema) if (!columns.has(name)) throw new Error(`${label}: missing header ${name}`);
    return values.slice(1).flatMap((row, index) => {
      if (!Array.isArray(row)) return [];
      const first = clean(row[columns.get(schema[0])]), second = clean(row[columns.get(schema[1])]);
      if (label.includes("Market Watch")) return first ? [Object.fromEntries(schema.map(name => [name, row[columns.get(name)] ?? null]))] : [];
      // Formula-filled blank rows (especially Trades) may contain zeroes beyond columns A:B.
      if (!first && !second) return [];
      if (!first || (!second && !label.includes("Monthly Return"))) throw new Error(`${label}: missing date or broker on row ${index + 2}`);
      return [Object.fromEntries(schema.map(name => [name, row[columns.get(name)] ?? null]))];
    });
  }
  const numberFields = (row, names) => Object.fromEntries(names.map(name => [name, amount(row[name])]));
  const identity = row => ({broker: clean(row.Broker), symbol: clean(row.Symbol), currency: clean(row.Currency)});
  const requiredDate = (value, label) => {
    const parsed = date(value);
    if (!parsed) throw new Error(`${label}: invalid date`);
    return parsed;
  };
  function parse(response) {
    const ranges = response?.valueRanges;
    if (!Array.isArray(ranges) || ![RANGES.length, RANGES.length - 1].includes(ranges.length)) throw new Error("V2 Master: incomplete response");
    const legacy = ranges.length === RANGES.length - 1;
    const parsed = ranges.map((entry, index) => table(entry?.values, Object.values(SCHEMAS)[index], RANGES[index]));
    const [c, p, m, t, l, w, r] = legacy ? [...parsed, []] : parsed;
    const current = c.map(row => ({date: requiredDate(row["As of Date"], "Current Positions"), assetType: clean(row["Asset Type"]), ...identity(row),
      ...numberFields(row, ["Quantity", "Avg Cost", "Current Price", "Market Value", "Unrealized P&L", "Realized P&L", "Dividend", "Interest", "Commission", "Fee", "Tax", "Other Income/Expense", "Monthly P&L", "FX to HKD"])}));
    const positions = p.map(row => ({date: requiredDate(row["Statement Date"], "Positions"), assetType: clean(row["Asset Type"]), ...identity(row),
      ...numberFields(row, ["Quantity / Amount", "Statement Closing Price (USD)", "FX to HKD", "Market Value HKD", "Open Position P&L (USD)"])}));
    const pnl = m.map(row => ({date: requiredDate(row.Date, "Monthly P&L"), ...identity(row),
      ...numberFields(row, SCHEMAS.pnl.slice(4))}));
    const trades = t.map(row => ({date: requiredDate(row["Trade Date"], "Trades"), ...identity(row), action: clean(row.Action),
      ...numberFields(row, ["Quantity", "Price", "Gross Amount", "Commission / Fee", "Net Cash Impact", "Quantity After Trade", "Avg Cost Before Trade", "Avg Cost After Trade", "Realized P&L"]),
      source: clean(row.Source), status: clean(row.Status), reviewNotes: clean(row["Review Notes"])}));
    const cash = l.map(row => ({date: requiredDate(row.Date, "Cash Ledger"), broker: clean(row.Broker), eventType: clean(row["Event Type"]),
      description: clean(row.Description), currency: clean(row.Currency), cashChange: amount(row["Cash Change"]),
      source: clean(row.Source), status: clean(row.Status), notes: clean(row.Notes)}));
    const returns = r.map(row => ({month: requiredDate(row.Month, "Monthly Return").slice(0, 7),
      beginning: amount(row["Beginning NAV (HKD)"]), ending: amount(row["Ending NAV (HKD)"]),
      flow: amount(row["Net External Flow (HKD)"]), weightedFlow: amount(row["Weighted External Flow (HKD)"]),
      pnl: amount(row["Monthly P&L (HKD)"]), return: amount(row["Monthly Return (%)"])}));
    const market = w.map(row => ({symbol: clean(row.Symbol), name: clean(row.Name), raw: Object.fromEntries(SCHEMAS.market.map(name => [name, row[name]])), price: amount(row.Price),
      day: amount(row["1D %"]), week: amount(row["1W %"]), high: amount(row["52W High"]), low: amount(row["52W Low"]),
      updatedAt: clean(row["Updated At"]), pe: amount(row["P/E (Google)"])})).filter(row => row.symbol);
    const currentMonth = current.length && current.every(row => row.date === current[0].date) ? current[0].date?.slice(0, 7) : null;
    return {source: SHEET_ID, current, positions, pnl, trades, cash, returns, market, currentMonth};
  }
  function fx(data, targetMonth) {
    if (!/^\d{4}-\d{2}$/.test(targetMonth ?? "")) return null;
    const historical = data.positions.filter(row => row.date?.slice(0, 7) === targetMonth && row.currency === "USD");
    const source = historical.length ? historical : targetMonth === data.currentMonth ? data.current.filter(row => row.currency === "USD") : [];
    if (!source.length) return null;
    const rates = source.map(row => row["FX to HKD"]);
    return rates.every(rate => typeof rate === "number" && rate > 0 && Math.abs(rate - rates[0]) < 1e-9) ? rates[0] : null;
  }
  function convert(data, value, from, to, targetMonth) {
    if (value == null || !Number.isFinite(value) || !["HKD", "USD"].includes(from) || !["HKD", "USD"].includes(to)) return null;
    if (from === to) return value;
    const rate = fx(data, targetMonth);
    return rate == null ? null : from === "USD" ? value * rate : value / rate;
  }
  function sumRequired(values) {
    return values.length && values.every(Number.isFinite) ? values.reduce((a, b) => a + b, 0) : null;
  }
  function nav(data, period = "current", broker = "ALL", currency = "HKD") {
    const rows = (period === "current" ? data.current : data.positions.filter(row => row.date?.slice(0, 7) === period))
      .filter(row => broker === "ALL" || row.broker === broker);
    if (period === "current" && (!data.currentMonth || (rows.some(row => row.currency === "USD") && fx(data, data.currentMonth) == null))) return null;
    const hkd = rows.map(row => period === "current"
      ? ["HKD", "USD"].includes(row.currency) && row["Market Value"] != null && row["FX to HKD"] != null && row["FX to HKD"] > 0 ? row["Market Value"] * row["FX to HKD"] : null
      : row["Market Value HKD"]);
    const total = sumRequired(hkd);
    return currency === "HKD" ? total : currency === "USD" ? convert(data, total, "HKD", "USD", period === "current" ? data.currentMonth : period) : null;
  }
  function monthlyPnl(data, targetMonth, broker = "ALL", currency = "HKD") {
    const rows = data.pnl.filter(row => row.date?.slice(0, 7) === targetMonth && (broker === "ALL" || row.broker === broker));
    return sumRequired(rows.map(row => convert(data, row["Monthly P&L"], row.currency, currency, targetMonth)));
  }
  return Object.freeze({SHEET_ID, RANGES, SCHEMAS, clean, amount, date, month, table, parse, fx, convert, nav, monthlyPnl});
});
