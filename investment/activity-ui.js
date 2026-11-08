/* Independent Trades and Cash Ledger tables with shared filters. */
(function (root, factory) {
  const api = factory(root.ActivityModel, root.V2Data);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ActivityUI = api;
})(typeof window !== "undefined" ? window : globalThis, function (Model, V2) {
  "use strict";
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const text = value => value == null || value === "" ? "—" : escape(value);
  const num = value => Number.isFinite(value) ? new Intl.NumberFormat("en-HK", {maximumFractionDigits: 6}).format(value) : "—";
  const money = (value, currency) => Number.isFinite(value) ? `${value < 0 ? "(" : ""}${currency === "HKD" ? "HK$" : "US$"}${new Intl.NumberFormat("en-HK", {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(Math.abs(value))}${value < 0 ? ")" : ""}` : "—";
  let data = null, tradesSelected = new Set(), cashSelected = new Set(), bound = false;
  const currency = () => $("currency-select").value;
  function cell(value, original, sourceCurrency) {
    const hint = Number.isFinite(original) ? ` title="Original ${escape(sourceCurrency)} ${escape(num(original))}"` : "";
    return `<td class="numeric"${hint}>${money(value, currency())}</td>`;
  }
  function tradeRow(row) {
    const c = row.converted;
    return `<tr><td><input type="checkbox" data-trade-id="${row.id}" ${tradesSelected.has(row.id) ? "checked" : ""} aria-label="Select trade ${escape(row.date)} ${escape(row.symbol)}"></td><td>${text(row.date)}</td><td>${text(row.broker)}</td><td>${text(row.symbol)}</td><td>${text(row.action)}</td><td class="numeric">${num(row.Quantity)}</td>${cell(c.Price, row.Price, row.currency)}<td>${text(row.currency)}</td>${cell(c["Gross Amount"], row["Gross Amount"], row.currency)}${cell(c["Commission / Fee"], row["Commission / Fee"], row.currency)}${cell(c["Net Cash Impact"], row["Net Cash Impact"], row.currency)}<td class="numeric">${num(row["Quantity After Trade"])}</td>${cell(c["Avg Cost Before Trade"], row["Avg Cost Before Trade"], row.currency)}${cell(c["Avg Cost After Trade"], row["Avg Cost After Trade"], row.currency)}${cell(c["Realized P&L"], row["Realized P&L"], row.currency)}<td>${text(row.source)}</td><td>${text(row.status)}</td><td>${text(row.reviewNotes)}</td></tr>`;
  }
  function cashRow(row) {
    return `<tr><td><input type="checkbox" data-cash-id="${row.id}" ${cashSelected.has(row.id) ? "checked" : ""} aria-label="Select cash ${escape(row.date)} ${escape(row.eventType)}"></td><td>${text(row.date)}</td><td>${text(row.broker)}</td><td>${text(row.eventType)}</td><td>${text(row.description)}</td><td>${text(row.currency)}</td>${cell(row.converted["Cash Change"], row.cashChange, row.currency)}<td>${text(row.source)}</td><td>${text(row.status)}</td><td>${text(row.notes)}</td></tr>`;
  }
  function render() {
    if (!data) return;
    const start = $("activity-start").value, end = $("activity-end").value, broker = $("activity-broker").value;
    const trades = Model.visible(data, "trades", start, end, broker, currency());
    const cash = Model.visible(data, "cash", start, end, broker, currency());
    $("trades-rows").innerHTML = trades.map(tradeRow).join("") || '<tr><td colspan="18" class="empty">No trades in this range.</td></tr>';
    $("cash-rows").innerHTML = cash.map(cashRow).join("") || '<tr><td colspan="10" class="empty">No cash records in this range.</td></tr>';
    $("trades-total").textContent = money(Model.selectedTotal(trades, tradesSelected, "Net Cash Impact"), currency());
    $("cash-total").textContent = money(Model.selectedTotal(cash, cashSelected, "Cash Change"), currency());
    for (const [id, rows, selected] of [["trades-all", trades, tradesSelected], ["cash-all", cash, cashSelected]]) {
      $(id).checked = rows.length > 0 && rows.every(row => selected.has(row.id));
      $(id).indeterminate = rows.some(row => selected.has(row.id)) && !$(id).checked;
    }
    $("activity-count").textContent = `${trades.length} trades · ${cash.length} cash records`;
    $("activity-note").textContent = `Amounts shown in ${currency()}; hover over an amount for its Master original. Missing source amounts or monthly FX display — and make the affected selected total unavailable. Trade and cash totals are separate; FX Conversion is a cash event, not investment income.`;
  }
  function bind() {
    if (bound) return;
    bound = true;
    for (const id of ["activity-start", "activity-end", "activity-broker", "currency-select"]) $(id).addEventListener("change", render);
    for (const [all, body, type] of [["trades-all", "trades-rows", "trades"], ["cash-all", "cash-rows", "cash"]]) {
      $(all).addEventListener("change", event => {
        const rows = Model.visible(data, type, $("activity-start").value, $("activity-end").value, $("activity-broker").value, currency());
        const selected = type === "trades" ? tradesSelected : cashSelected;
        for (const row of rows) if (event.target.checked) selected.add(row.id); else selected.delete(row.id);
        render();
      });
      $(body).addEventListener("change", event => {
        const id = event.target.dataset[type === "trades" ? "tradeId" : "cashId"];
        if (!id) return;
        const selected = type === "trades" ? tradesSelected : cashSelected;
        if (event.target.checked) selected.add(id); else selected.delete(id);
        render();
      });
    }
  }
  function mount(next) {
    data = next;
    tradesSelected = new Set(next.trades.map((_, index) => `trades:${index}`));
    cashSelected = new Set(next.cash.map((_, index) => `cash:${index}`));
    bind();
    render();
  }
  function clear() {
    data = null;
    tradesSelected.clear(); cashSelected.clear();
    for (const id of ["trades-rows", "cash-rows"]) $(id).innerHTML = "";
    for (const id of ["trades-total", "cash-total"]) $(id).textContent = "—";
    $("activity-count").textContent = "";
    $("activity-note").textContent = "";
  }
  return Object.freeze({mount, clear, render});
});
