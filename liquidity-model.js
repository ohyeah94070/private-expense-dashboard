const LiquidityModel = (() => {
  const month = serial => new Date(Date.UTC(1899, 11, 30) + serial * 86400000).toISOString().slice(0, 7);
  const monthEnd = key => { const [year, m] = key.split("-").map(Number); return Math.floor((Date.UTC(year, m, 0) - Date.UTC(1899, 11, 30)) / 86400000); };
  function liquidity(period) {
    const relevant = period.positions.filter(p => p.type === "Asset" && p.category === "Cash" && p.ccy === "HKD" || p.type === "Liabilities" && p.category === "Credit Card");
    if (relevant.some(p => !Number.isFinite(p.hkd))) throw new Error("Completed cash or credit card balance is missing.");
    return relevant.reduce((sum, p) => sum + p.hkd, 0);
  }
  function forecast(periods, budgetRows, plans) {
    const latest = periods.at(-1);
    if (!latest) throw new Error("No completed balance snapshot.");
    const opening = liquidity(latest), settledThrough = month(latest.end);
    const rows = [], details = [];
    let beginning = opening;
    for (const budget of budgetRows) {
      const key = month(budget.month);
      if (key <= settledThrough) continue;
      const included = plans.filter(p => p.included && month(p.date) === key);
      // Budget Planned Events is already the included sum from Future One-off Plans.
      const oneOff = -budget.events;
      const regular = budget.income - budget.housing - budget.routine - budget.other;
      const ending = beginning + regular + oneOff;
      rows.push({month:key, beginning, regular, oneOff, ending, target:budget.surplus,
        actual:Number.isFinite(budget.actual) && latest.end >= monthEnd(key) ? budget.actual : NaN,
        variance:Number.isFinite(budget.variance) && latest.end >= monthEnd(key) ? budget.variance : NaN,
        status:"Forecast"});
      details.push(...included.map(p => ({...p, month:key})));
      beginning = ending;
    }
    const savings = budgetRows.map(budget => {
      const key=month(budget.month), settled=latest.end >= monthEnd(key);
      const actual=settled && Number.isFinite(budget.actual) ? budget.actual : NaN;
      return {month:key,target:budget.surplus,actual,
        variance:Number.isFinite(actual) ? actual-budget.surplus : NaN,
        status:!Number.isFinite(actual)?"Pending":actual<0?"Negative Savings":actual<budget.surplus?"Below Target":"On Target"};
    });
    return {opening, asOf:latest.end, rows, details, savings};
  }
  return {liquidity, forecast};
})();
if (typeof module !== "undefined") module.exports = LiquidityModel;
