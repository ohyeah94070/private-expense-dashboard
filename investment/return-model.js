/* Compound only complete, consecutive Monthly Return rows from the Master. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ReturnModel = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const next = month => new Date(Date.UTC(+month.slice(0, 4), +month.slice(5), 1)).toISOString().slice(0, 7);
  function status(data, row, closedMonth) {
    if (!row || row.month > closedMonth) return "Pending";
    if (!data.positions.some(position => position.date?.slice(0, 7) === row.month)) return "Pending";
    return [row.beginning, row.ending, row.flow, row.weightedFlow, row.pnl, row.return].every(Number.isFinite) && row.beginning + row.weightedFlow > 0 ? "Preliminary" : "N/A";
  }
  function period(data, mode, selected, closedMonth) {
    const rows = (data.returns || []).slice().sort((a, b) => a.month.localeCompare(b.month));
    const latest = rows.filter(row => status(data, row, closedMonth) === "Preliminary").at(-1)?.month;
    const end = selected || latest;
    if (!end) return {status: "N/A", pnl: null, return: null, ending: null, start: null, end: null};
    const start = mode === "Monthly" ? end : (mode === "YTD" || mode === "Annual") ? `${end.slice(0, 4)}-01` : mode === "1Y" ?
      new Date(Date.UTC(+end.slice(0, 4), +end.slice(5) - 12, 1)).toISOString().slice(0, 7) : "2022-01";
    const byMonth = new Map(rows.map(row => [row.month, row]));
    const selectedRows = [];
    for (let month = start; month <= end; month = next(month)) selectedRows.push(byMonth.get(month));
    const states = selectedRows.map(row => status(data, row, closedMonth));
    const valid = (mode !== "1Y" || selectedRows.length === 12) && (mode !== "Annual" || end.endsWith("-12")) && states.every(state => state === "Preliminary");
    const endRow = byMonth.get(end);
    return {status: valid ? "Preliminary" : states.includes("Pending") ? "Pending" : "N/A", start, end,
      pnl: valid ? selectedRows.reduce((sum, row) => sum + row.pnl, 0) : null,
      return: valid ? selectedRows.reduce((product, row) => product * (1 + row.return), 1) - 1 : null,
      ending: status(data, endRow, closedMonth) === "Preliminary" ? endRow.ending : null};
  }
  return Object.freeze({status, period});
});
