/* Overview only; Holdings and Trades & Cash are left for later phases. */
(function (root, factory) {
  const api = factory(root.OverviewModel, root.V2Data);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.OverviewUI = api;
})(typeof window !== "undefined" ? window : globalThis, function (Model, V2) {
  "use strict";
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[char]));
  const money = (value, currency) => Number.isFinite(value) ? `${value < 0 ? "(" : ""}${currency === "HKD" ? "HK$" : "US$"}${new Intl.NumberFormat("en-HK", {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(Math.abs(value))}${value < 0 ? ")" : ""}` : "—";
  const number = value => Number.isFinite(value) ? new Intl.NumberFormat("en-HK", {maximumFractionDigits: 2}).format(value) : "—";
  const percent = value => Number.isFinite(value) ? new Intl.NumberFormat("en-HK", {style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2}).format(value) : "—";
  const tone = value => Number.isFinite(value) ? value < 0 ? "negative" : value > 0 ? "positive" : "" : "";
  let data = null, bound = false, allocationSelection = new Set(), pnlSelection = new Set();
  const currency = () => $("currency-select").value;
  const period = () => $("overview-period").value;
  const broker = () => $("overview-broker").value;

  function populatePeriods() {
    const old = period();
    $("overview-period").innerHTML = '<option value="current">Current / Latest</option>' + Model.periodMonths(data).map(month => `<option value="${month}">${month}</option>`).join("");
    $("overview-period").value = [...$("overview-period").options].some(option => option.value === old) ? old : "current";
    const months = Model.pnlMonths(data), latest = months.at(-1) || "";
    for (const id of ["pnl-start", "pnl-end"]) {
      $(id).min = months[0] || "";
      $(id).max = latest;
      if (!months.includes($(id).value)) $(id).value = latest;
    }
  }
  function populateSymbols() {
    const old = $("pnl-symbol").value;
    const symbols = [...new Set(data.pnl.filter(row => {
      const month = row.date?.slice(0, 7);
      return month && month >= $("pnl-start").value && month <= $("pnl-end").value &&
        ($("pnl-broker").value === "ALL" || row.broker === $("pnl-broker").value);
    }).map(row => row.symbol).filter(Boolean))].sort();
    $("pnl-symbol").innerHTML = '<option value="ALL">All</option>' + symbols.map(symbol => `<option value="${escape(symbol)}">${escape(symbol)}</option>`).join("");
    $("pnl-symbol").value = symbols.includes(old) ? old : "ALL";
  }
  function renderSummary() {
    const s = Model.summary(data, period(), broker(), currency());
    $("summary-nav").textContent = money(s.nav, currency());
    $("summary-equity").textContent = money(s.equity, currency());
    $("summary-cash").textContent = money(s.cash, currency());
    $("summary-asof").textContent = period() === "current" ? `As of ${data.current[0]?.date || "—"}` : `${period()} month end`;
    $("hero-subtitle").textContent = period() === "current" ? `Current positions · ${data.current[0]?.date || "—"}` : `${period()} · historical positions`;
    $("summary-nav-note").textContent = currency();
    $("summary-equity-note").textContent = `${currency()} equivalent · stocks, ETFs, MMF`;
    $("summary-cash-note").textContent = `${currency()} equivalent`;
  }
  function renderAllocation(reset = false) {
    if (!$('allocation-rows')) return;
    const rows = Model.allocation(data, period(), broker(), currency());
    if (reset) allocationSelection = new Set(rows.map(row => row.id));
    $("allocation-scope").textContent = `${period() === "current" ? "Current" : period()} · ${broker() === "ALL" ? "All brokers" : broker()}`;
    $("allocation-rows").innerHTML = rows.map(row => `<tr><td><input type="checkbox" data-allocation-id="${escape(row.id)}" ${allocationSelection.has(row.id) ? "checked" : ""} aria-label="Select ${escape(row.broker)} ${escape(row.symbol || row.assetType)}"></td><td>${escape(row.broker)}</td><td>${escape(row.assetType)}</td><td><strong>${escape(row.symbol || (row.assetType.toLowerCase() === "cash" ? `${row.sourceCurrency} cash` : row.assetType))}</strong></td><td>${escape(row.sourceCurrency)}</td><td class="numeric ${tone(row.value)}">${money(row.value, currency())}</td><td class="numeric">${percent(row.weight)}</td></tr>`).join("") || '<tr><td colspan="7" class="empty">No positions for this period and broker.</td></tr>';
    $("allocation-total").textContent = money(Model.selectedTotal(rows, allocationSelection), currency());
    $("allocation-percent-total").textContent = percent(Model.selectedWeight(rows, allocationSelection));
    $("allocation-all").checked = rows.length > 0 && rows.every(row => allocationSelection.has(row.id));
    $("allocation-all").indeterminate = rows.some(row => allocationSelection.has(row.id)) && !$("allocation-all").checked;
  }
  function renderPnL(reset = false) {
    const rows = Model.pnlRows(data, $("pnl-start").value, $("pnl-end").value, $("pnl-broker").value, $("pnl-symbol").value, currency());
    if (reset) pnlSelection = new Set(rows.map(row => row.id));
    $("pnl-currency-note").textContent = `Amounts shown in ${currency()}; Currency is each row's original currency.`;
    $("pnl-rows").innerHTML = rows.map(row => `<tr><td><input type="checkbox" data-pnl-id="${row.id}" ${pnlSelection.has(row.id) ? "checked" : ""} aria-label="Select ${escape(row.date)} ${escape(row.symbol)}"></td><td>${escape(row.date)}</td><td>${escape(row.broker)}</td><td>${escape(row.symbol)}</td><td>${escape(row.sourceCurrency)}</td>${Model.PNL_FIELDS.map(field => `<td class="numeric ${tone(row.amounts[field])}">${money(row.amounts[field], currency())}</td>`).join("")}</tr>`).join("") || '<tr><td colspan="14" class="empty">No P&amp;L rows for these filters.</td></tr>';
    const totals = Model.pnlTotals(rows, pnlSelection);
    Model.PNL_FIELDS.forEach((field, index) => { $(`pnl-total-${index}`).textContent = money(totals[field], currency()); });
    $("pnl-all").checked = rows.length > 0 && rows.every(row => pnlSelection.has(row.id));
    $("pnl-all").indeterminate = rows.some(row => pnlSelection.has(row.id)) && !$("pnl-all").checked;
  }
  function renderOpen() {
    const rows = Model.openPositions(data, period(), broker(), currency());
    $("open-pl-rows").innerHTML = rows.map(row => `<tr><td><strong>${escape(row.symbol || "—")}</strong></td><td>${escape(row.assetType)}</td><td class="numeric ${tone(row.ibkr)}">${money(row.ibkr, currency())}</td><td class="numeric ${tone(row.webull)}">${money(row.webull, currency())}</td><td class="numeric ${tone(row.combined)}"><strong>${money(row.combined, currency())}</strong></td></tr>`).join("") || '<tr><td colspan="5" class="empty">No open positions.</td></tr>';
    $("open-pl-note").textContent = period() === "current" ? "Current Positions Unrealized P&L, converted from each row's original currency." : "Positions Open Position P&L (USD), converted using that month's FX. Missing source values remain —.";
  }
  function chart(rows, showPnl) {
    if (!rows.length) return '<p class="empty">No history in this date range.</p>';
    const valid = rows.filter(row => Number.isFinite(row.nav));
    if (!valid.length && !showPnl) return '<p class="empty">No historical NAV values in this date range.</p>';
    const width = 900, height = 280, left = 75, right = showPnl ? 78 : 25, top = 38, bottom = 48;
    const dates = rows.map(row => Date.parse(`${row.date}T00:00:00Z`));
    const first = dates[0], last = dates.at(-1), span = last - first;
    const x = index => span ? left + (dates[index] - first) * (width - left - right) / span : (left + width - right) / 2;
    const navValues = valid.map(row => row.nav);
    const navLow = Math.min(0, ...navValues), navHigh = Math.max(1, ...navValues, navLow + 1);
    const y = value => top + (navHigh - value) * (height - top - bottom) / (navHigh - navLow);
    const compact = value => escape(new Intl.NumberFormat("en-HK", {notation: "compact", maximumFractionDigits: 1}).format(value));
    const navTicks = [0, 0.5, 1].map(frac => { const value = navLow + frac * (navHigh - navLow); return `<line x1="${left}" y1="${y(value)}" x2="${width - right}" y2="${y(value)}" stroke="#e3ecee"/><text x="${left - 8}" y="${y(value) + 4}" text-anchor="end">${compact(value)}</text>`; }).join("");
    const labelIndexes = [0];
    for (let i = 1; i < rows.length - 1; i++) if (x(i) - x(labelIndexes.at(-1)) >= 105 && x(rows.length - 1) - x(i) >= 75) labelIndexes.push(i);
    if (rows.length > 1 && x(rows.length - 1) - x(labelIndexes.at(-1)) >= 75) labelIndexes.push(rows.length - 1);
    const labels = labelIndexes.map(index => { const d = new Date(dates[index]); const label = new Intl.DateTimeFormat("en-US", {month: "short", year: "2-digit", timeZone: "UTC"}).format(d); return `<text x="${x(index).toFixed(1)}" y="${height - 13}" text-anchor="middle">${escape(label)}</text>`; }).join("");
    let paths = [], segment = [];
    rows.forEach((row, index) => { if (Number.isFinite(row.nav)) segment.push(`${x(index).toFixed(1)},${y(row.nav).toFixed(1)}`); else if (segment.length) { paths.push(segment); segment = []; } });
    if (segment.length) paths.push(segment);
    const line = paths.map(points => points.length > 1 ? `<polyline points="${points.join(" ")}" fill="none" stroke="#0e7d6c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` : "").join("");
    const dots = rows.map((row, index) => Number.isFinite(row.nav) ? `<circle cx="${x(index).toFixed(1)}" cy="${y(row.nav).toFixed(1)}" r="3.2" fill="#0e7d6c"><title>${escape(row.date)} NAV: ${money(row.nav, currency())}</title></circle>` : "").join("");
    let bars = "", pnlTicks = "";
    if (showPnl) {
      const pnlValues = rows.map(row => row.pnl).filter(Number.isFinite);
      const limit = Math.max(1, ...pnlValues.map(Math.abs));
      const py = value => top + (limit - value) * (height - top - bottom) / (2 * limit);
      const barWidth = Math.min(30, Math.max(8, (width - left - right) / Math.max(rows.length, 1) * 0.45));
      bars = rows.map((row, index) => Number.isFinite(row.pnl) ? `<rect x="${(x(index) - barWidth / 2).toFixed(1)}" y="${Math.min(py(0), py(row.pnl)).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${Math.max(1, Math.abs(py(row.pnl) - py(0))).toFixed(1)}" fill="${row.pnl < 0 ? "#c56570" : "#85b8cf"}" opacity="0.8"><title>${escape(row.date)} Monthly P&amp;L: ${money(row.pnl, currency())}</title></rect>` : "").join("");
      pnlTicks = [-limit, 0, limit].map(value => `<text x="${width - right + 8}" y="${py(value) + 4}">${compact(value)}</text>`).join("");
    }
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Historical NAV${showPnl ? " and Monthly P&L" : ""} in ${currency()}" preserveAspectRatio="xMidYMid meet"><g class="chart-axis"><text x="${left}" y="17">NAV (${currency()})</text>${showPnl ? `<text x="${width - right + 8}" y="17">P&amp;L (${currency()})</text>` : ""}${navTicks}${pnlTicks}${labels}</g>${bars}${line}${dots}</svg>`;
  }
  function renderPerformance() {
    const all = Model.performance(data, broker(), currency());
    const rows = Model.performanceRange(all, $("history-range").value, $("history-start").value, $("history-end").value);
    $("nav-chart").innerHTML = chart(rows, $("history-pnl").checked);
    $("performance-rows").innerHTML = rows.map(row => `<tr><td>${row.month}</td><td class="numeric">${money(row.nav, currency())}</td><td class="numeric ${tone(row.pnl)}">${money(row.pnl, currency())}</td></tr>`).join("") || '<tr><td colspan="3" class="empty">No historical months.</td></tr>';
  }
  function renderMarket() {
    $("market-rows").innerHTML = data.market.map(row => `<tr>${V2.SCHEMAS.market.map((name, index) => `<td class="${index > 1 && index !== 7 ? "numeric" : ""}">${index === 0 ? "<strong>" : ""}${row.raw[name] == null || row.raw[name] === "" ? "—" : escape(row.raw[name])}${index === 0 ? "</strong>" : ""}</td>`).join("")}</tr>`).join("") || '<tr><td colspan="16" class="empty">No Market Watch rows.</td></tr>';
  }
  function renderAll(reset = false) {
    if (!data) return;
    renderSummary();
    renderAllocation(reset);
    renderPnL(reset);
    renderOpen();
    renderPerformance();
    renderMarket();
  }
  function bind() {
    if (bound) return;
    bound = true;
    $("overview-period").addEventListener("change", () => { renderSummary(); renderAllocation(true); renderOpen(); });
    $("overview-broker").addEventListener("change", () => { renderSummary(); renderAllocation(true); renderOpen(); renderPerformance(); });
    $("currency-select").addEventListener("change", () => renderAll());
    for (const id of ["pnl-start", "pnl-end", "pnl-broker"]) $(id).addEventListener("change", () => { populateSymbols(); renderPnL(true); });
    $("pnl-symbol").addEventListener("change", () => renderPnL(true));
    $("history-range").addEventListener("change", () => {
      document.querySelectorAll(".history-custom").forEach(element => { element.hidden = $("history-range").value !== "CUSTOM"; });
      renderPerformance();
    });
    for (const id of ["history-start", "history-end", "history-pnl"]) $(id).addEventListener("change", renderPerformance);
    if ($("allocation-all")) $("allocation-all").addEventListener("change", event => {
      const rows = Model.allocation(data, period(), broker(), currency());
      allocationSelection = event.target.checked ? new Set(rows.map(row => row.id)) : new Set();
      renderAllocation();
    });
    if ($("allocation-rows")) $("allocation-rows").addEventListener("change", event => {
      const id = event.target.dataset.allocationId;
      if (!id) return;
      if (event.target.checked) allocationSelection.add(id); else allocationSelection.delete(id);
      renderAllocation();
    });
    $("pnl-all").addEventListener("change", event => {
      const rows = Model.pnlRows(data, $("pnl-start").value, $("pnl-end").value, $("pnl-broker").value, $("pnl-symbol").value, currency());
      pnlSelection = event.target.checked ? new Set(rows.map(row => row.id)) : new Set();
      renderPnL();
    });
    $("pnl-rows").addEventListener("change", event => {
      const id = event.target.dataset.pnlId;
      if (!id) return;
      if (event.target.checked) pnlSelection.add(id); else pnlSelection.delete(id);
      renderPnL();
    });
  }
  function mount(next) {
    data = next;
    bind();
    populatePeriods();
    populateSymbols();
    const dates = Model.performance(data).map(row => row.date);
    for (const id of ["history-start", "history-end"]) { $(id).min = dates[0] || ""; $(id).max = dates.at(-1) || ""; }
    if (!$("history-start").value) $("history-start").value = dates[0] || "";
    if (!$("history-end").value) $("history-end").value = dates.at(-1) || "";
    renderAll(true);
  }
  function clear() {
    data = null;
    allocationSelection.clear();
    pnlSelection.clear();
    for (const id of ["summary-nav", "summary-equity", "summary-cash", "allocation-total", "allocation-percent-total", ...Model.PNL_FIELDS.map((_, i) => `pnl-total-${i}`)]) if ($(id)) $(id).textContent = "—";
    for (const id of ["allocation-rows", "pnl-rows", "open-pl-rows", "performance-rows", "market-rows", "nav-chart"]) if ($(id)) $(id).innerHTML = "";
  }
  return Object.freeze({mount, clear, renderAll});
});
