/* Current Positions Holdings table and donut. */
(function (root, factory) {
  const api = factory(root.HoldingsModel, root.V2Data);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.HoldingsUI = api;
})(typeof window !== "undefined" ? window : globalThis, function (Model, V2) {
  "use strict";
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[char]));
  const money = (value, currency) => Number.isFinite(value) ? `${value < 0 ? "(" : ""}${currency === "HKD" ? "HK$" : "US$"}${new Intl.NumberFormat("en-HK", {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(Math.abs(value))}${value < 0 ? ")" : ""}` : "—";
  const number = value => Number.isFinite(value) ? new Intl.NumberFormat("en-HK", {maximumFractionDigits: 4}).format(value) : "—";
  const percent = value => Number.isFinite(value) ? new Intl.NumberFormat("en-HK", {style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2}).format(value) : "—";
  const tone = value => Number.isFinite(value) ? value < 0 ? "negative" : value > 0 ? "positive" : "" : "";
  const palette = ["#0d826f", "#2b8ba3", "#5a78b8", "#8769a8", "#bb7595", "#d18a58", "#a7a247", "#438c68", "#5588a1", "#8176b6", "#c27074", "#8b9a58"];
  let data = null, selected = new Set(), bound = false;
  const currency = () => $("currency-select").value;
  const broker = () => $("holdings-broker").value;
  const displayHKD = value => currency() === "HKD" ? value : V2.convert(data, value, "HKD", "USD", data.currentMonth);

  function renderTable(rows) {
    $("holdings-asof").textContent = `As of ${data.current[0]?.date || "—"}`;
    $("holdings-rows").innerHTML = rows.map(row => `<tr><td><input type="checkbox" data-holding-id="${row.id}" ${selected.has(row.id) ? "checked" : ""} aria-label="Select ${escape(row.broker)} ${escape(row.symbol || row.assetType)}"></td><td>${escape(row.broker)}</td><td>${escape(row.assetType)}</td><td><strong>${escape(row.symbol || (row.assetType.toLowerCase() === "cash" ? `Cash (${row.sourceCurrency})` : "—"))}</strong></td><td>${escape(row.sourceCurrency)}</td><td class="numeric">${number(row.quantity)}</td><td class="numeric">${money(row.avgCost, currency())}</td><td class="numeric">${money(row.currentPrice, currency())}</td><td class="numeric ${tone(row.value)}">${money(row.value, currency())}</td><td class="numeric ${tone(row.openPL)}">${money(row.openPL, currency())}</td><td class="numeric">${percent(row.weight)}</td></tr>`).join("") || '<tr><td colspan="11" class="empty">No current holdings for this broker.</td></tr>';
    $("holdings-total").textContent = money(Model.selectedTotal(rows, selected), currency());
    $("holdings-all").checked = rows.length > 0 && rows.every(row => selected.has(row.id));
    $("holdings-all").indeterminate = rows.some(row => selected.has(row.id)) && !$("holdings-all").checked;
    $("holdings-note").textContent = `Market value, average cost, price, and open P/L come from Current Positions. Amounts are shown in ${currency()}; quantity stays in its source unit. Weight uses full filtered NAV.`;
  }
  function renderDonut(rows) {
    const chart = Model.donut(data, rows, selected, broker(), currency());
    if (chart.missing || !Number.isFinite(chart.positiveTotalHKD) || chart.positiveTotalHKD <= 0) {
      $("holdings-chart").innerHTML = '<div class="donut-empty">—</div>';
      $("holdings-chart-note").textContent = chart.missing ? "Market value or FX is missing; chart slices are unavailable." : "No positive assets to draw.";
      $("holdings-legend").innerHTML = "";
      $("holdings-offsets").innerHTML = "";
      return;
    }
    const positive = chart.entries.filter(entry => entry.positiveHKD > 0);
    const colors = new Map(positive.map((entry, index) => [entry.key, palette[index % palette.length]]));
    const radius = 78, circumference = 2 * Math.PI * radius;
    let offset = 0;
    const arcs = chart.slices.map(slice => {
      const length = slice.angleShare * circumference;
      const html = `<circle cx="110" cy="110" r="${radius}" fill="none" stroke="${slice.selected ? colors.get(slice.key) : "#cbd5da"}" stroke-width="34" stroke-dasharray="${length.toFixed(5)} ${(circumference - length).toFixed(5)}" stroke-dashoffset="${(-offset).toFixed(5)}" transform="rotate(-90 110 110)"><title>${escape(slice.label)} · ${slice.selected ? "selected" : "not selected"} · ${money(displayHKD(slice.valueHKD), currency())}</title></circle>`;
      offset += length;
      return html;
    }).join("");
    $("holdings-chart").innerHTML = `<svg viewBox="0 0 220 220" role="img" aria-label="Positive assets by share of positive asset total"><circle cx="110" cy="110" r="${radius}" fill="none" stroke="#e8eff1" stroke-width="34"/>${arcs}<text x="110" y="104" text-anchor="middle" class="donut-center-label">POSITIVE ASSETS</text><text x="110" y="126" text-anchor="middle" class="donut-center-value">${escape(money(chart.positiveTotal, currency()))}</text></svg>`;
    $("holdings-chart-note").textContent = `Circle angles use positive assets ${money(chart.positiveTotal, currency())}. Percentages below use full net NAV ${money(chart.nav, currency())}. Gray arcs are unselected positive holdings.`;
    $("holdings-legend").innerHTML = positive.map(entry => {
      const state = entry.unselectedHKD > 0 ? entry.selectedHKD > 0 ? "Partly unselected" : "Unselected" : "Selected";
      const swatch = entry.selectedHKD > 0 && entry.unselectedHKD > 0 ? `linear-gradient(90deg, ${colors.get(entry.key)} 50%, #cbd5da 50%)` : entry.selectedHKD > 0 ? colors.get(entry.key) : "#cbd5da";
      return `<div class="donut-legend-row"><span class="donut-swatch" style="background:${swatch}"></span><div><strong>${escape(entry.label)}</strong><small>${escape(state)} · ${percent(entry.weight)} of net NAV</small></div><b>${money(displayHKD(entry.positiveHKD), currency())}</b></div>`;
    }).join("");
    const negatives = chart.entries.filter(entry => entry.negativeHKD < 0);
    $("holdings-offsets").innerHTML = `<div class="donut-offset-title">Net NAV and negative offsets</div><div class="donut-offset-row"><strong>Full net NAV</strong><b>${money(chart.nav, currency())}</b></div>${negatives.map(entry => `<div class="donut-offset-row"><span>${escape(entry.label)}${entry.negativeUnselectedHKD < 0 ? " · unselected" : ""} <small>${percent(entry.negativeWeight)} of net NAV</small></span><b class="negative">${money(displayHKD(entry.negativeHKD), currency())}</b></div>`).join("")}`;
  }
  function render() {
    if (!data) return;
    const rows = Model.rows(data, broker(), currency());
    renderTable(rows);
    renderDonut(rows);
  }
  function bind() {
    if (bound) return;
    bound = true;
    $("holdings-broker").addEventListener("change", render);
    $("currency-select").addEventListener("change", render);
    $("holdings-all").addEventListener("change", event => {
      for (const row of Model.rows(data, broker(), currency())) {
        if (event.target.checked) selected.add(row.id); else selected.delete(row.id);
      }
      render();
    });
    $("holdings-rows").addEventListener("change", event => {
      const id = event.target.dataset.holdingId;
      if (!id) return;
      if (event.target.checked) selected.add(id); else selected.delete(id);
      render();
    });
  }
  function mount(next) {
    data = next;
    selected = new Set(next.current.map((_, index) => `holding:${index}`));
    bind();
    render();
  }
  function clear() {
    data = null;
    selected.clear();
    $("holdings-asof").textContent = "";
    $("holdings-total").textContent = "—";
    for (const id of ["holdings-rows", "holdings-chart", "holdings-legend", "holdings-offsets"]) $(id).innerHTML = "";
  }
  return Object.freeze({mount, clear, render});
});
