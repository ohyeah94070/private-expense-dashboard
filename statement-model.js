const StatementModel = (() => {
  const number = value => value === "" || value == null ? NaN : Number(value);
  const cell = (rows, row, column) => number(rows[row]?.[column]);
  const label = value => String(value ?? "").trim();
  const sum = values => values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
  const close = (actual, expected) => Number.isFinite(actual) && Math.abs(actual - expected) < 0.05;

  function parse(rows, todaySerial) {
    if (!rows?.length) throw new Error("Statement data is empty.");
    const find = (start, first, second) => {
      const row = rows.findIndex((values, index) => index >= start && label(values[0]) === first && (second === undefined || label(values[1]) === second));
      if (row < 0) throw new Error(`Statement row '${first}${second ? " / " + second : ""}' is missing.`);
      return row;
    };
    const balance = find(2, "Balance Sheet Overview");
    const asset = find(balance + 1, "Asset", "");
    const liabilities = find(asset + 1, "Liabilities", "");
    const nav = find(liabilities + 1, "NAV", "");
    const income = find(nav + 1, "Income", "");
    const salary = find(income + 1, "", "Salary");
    const investment = find(salary + 1, "", "Investment");
    const mpf = find(investment + 1, "", "MPF");
    const otherIncome = find(mpf + 1, "", "Other Income");
    const expense = find(otherIncome + 1, "Expense", "");
    const large = find(expense + 1, "", "Large");
    const housing = find(large + 1, "", "Housing");
    const routine = find(housing + 1, "", "Routine");
    const savings = find(routine + 1, "Net Income/(Loss)", "");
    const dates = (rows[0] || []).flatMap((value, column) => Number.isFinite(number(value)) ? [{column, date:number(value)}] : []);
    const positionRows = rows.slice(2, balance).map((values, index) => ({values, sourceRow:index + 3}))
      .filter(({values}) => ["Asset", "Liabilities"].includes(label(values[0])));
    const periods = [];
    for (let i = 1; i < dates.length; i++) {
      const {column, date:end} = dates[i], {column:priorColumn, date:start} = dates[i - 1];
      if (column !== priorColumn + 2 || end <= start || end > todaySerial) continue;
      const hkdColumn = column + 1;
      const positions = positionRows.map(({values, sourceRow}) => ({
        type:label(values[0]), category:label(values[1]), account:label(values[2]), holding:label(values[3]), ccy:label(values[4]),
        original:number(values[column]), hkd:number(values[hkdColumn]), previous:number(values[priorColumn + 1]), sourceRow
      }));
      if (!positions.some(position => Number.isFinite(position.hkd))) continue;
      const period = {col:column,start,end,days:Math.round(end - start),positions,
        assets:cell(rows,asset,hkdColumn),liabilities:cell(rows,liabilities,hkdColumn),nav:cell(rows,nav,hkdColumn),navChange:cell(rows,nav,column),
        income:cell(rows,income,hkdColumn),salary:cell(rows,salary,hkdColumn),investment:cell(rows,investment,hkdColumn),mpf:cell(rows,mpf,hkdColumn),otherIncome:cell(rows,otherIncome,hkdColumn),
        expense:cell(rows,expense,hkdColumn),large:cell(rows,large,hkdColumn),housing:cell(rows,housing,hkdColumn),routine:cell(rows,routine,hkdColumn),savings:cell(rows,savings,hkdColumn)};
      if (!close(period.assets,sum(positions.filter(x => x.type === "Asset").map(x => x.hkd))) ||
          !close(period.liabilities,sum(positions.filter(x => x.type === "Liabilities").map(x => x.hkd))) ||
          !close(period.nav,period.assets + period.liabilities) ||
          !close(period.navChange,period.income + period.expense) ||
          !close(period.income,sum([period.salary,period.investment,period.mpf,period.otherIncome])) ||
          !close(period.expense,sum([period.large,period.housing,period.routine])) ||
          !close(period.savings,period.salary + period.expense)) {
        throw new Error("Statement totals do not reconcile for balance date " + end + ". Check the Sheet before showing this period.");
      }
      periods.push(period);
    }
    return periods;
  }
  return {parse};
})();
if (typeof module !== "undefined") module.exports = StatementModel;
