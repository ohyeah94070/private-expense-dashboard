const StatementModel = (() => {
  const number = value => value === "" || value == null ? NaN : Number(value);
  const cell = (rows, row, column) => number(rows[row]?.[column]);
  const label = value => String(value ?? "").trim();
  const sum = values => values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
  const close = (actual, expected) => Number.isFinite(actual) && Math.abs(actual - expected) < 0.05;
  const describe = (section, tag, row, column, amount) =>
    `Stmt / ${section}, row ${row}, column ${column}, Tag '${tag || "(blank)"}', amount ${Number.isFinite(amount) ? amount : "—"}`;

  function parse(rows, todaySerial) {
    if (!rows?.length) throw new Error("Statement data is empty.");
    const head = rows.findIndex(values => ["Cat 1","Cat 2","Cat 3","Cat 4","CCY"].every(name => values.includes(name)));
    if (head < 1) throw new Error("Statement position headers are missing.");
    const headers = rows[head], columns = {};
    for (const name of ["Cat 1","Cat 2","Cat 3","Cat 4","CCY"]) {
      const matches = headers.flatMap((value, index) => label(value) === name ? [index] : []);
      if (matches.length !== 1) throw new Error(`Statement header '${name}' is missing or duplicated.`);
      columns[name] = matches[0];
    }
    const first = columns["Cat 1"], second = columns["Cat 2"];
    const dateRows = [];
    for (let row = 0; row < head; row++) if (rows[row].some((value, column) => label(headers[column]) === "Ori. CCY Amt" && number(value) > 20000)) dateRows.push(row);
    if (dateRows.length !== 1) throw new Error("Statement balance date row is missing or duplicated.");
    const completedColumns = rows[dateRows[0]].flatMap((value,column) =>
      label(headers[column]) === "Ori. CCY Amt" && number(value) <= todaySerial && Number.isFinite(number(value)) ? [column + 1] : []);
    const sampleAmount = values => {
      return number(values[completedColumns.at(-1)]);
    };
    const anchor = (tag, from = head + 1) => {
      const matches = rows.flatMap((values, index) => index >= from && label(values[first]) === tag && !label(values[second]) ? [index] : []);
      if (matches.length !== 1) throw new Error(`Statement section '${tag}' is missing or duplicated.`);
      return matches[0];
    };
    const balance = anchor("Balance Sheet Overview"), incomeStart = anchor("Income", balance + 1), expenseStart = anchor("Expense", incomeStart + 1);
    const savingsEnd = anchor("Net Income/(Loss)", expenseStart + 1);
    const sections = [
      {name:"Balance", start:balance + 1, end:incomeStart, tags:["Asset","Liabilities","NAV"], extras:["Cash","Investment","Others","MPF","Liquidity"]},
      {name:"Income", start:incomeStart, end:expenseStart, tags:["Income","Salary","Investment","MPF","Other Income"], extras:[]},
      {name:"Expense", start:expenseStart, end:savingsEnd + 1, tags:["Expense","Large","Housing","Routine","Net Income/(Loss)"], extras:[]}
    ];
    const found = {};
    for (const section of sections) {
      for (let row = section.start; row < section.end; row++) {
        const values = rows[row], a = label(values[first]), b = label(values[second]);
        if (!a && !b) continue;
        const tag = a || b;
        const useAs = section.tags.includes(tag) ? tag : section.extras.includes(tag) ? "Ignore" : "";
        if (!useAs) throw new Error("Incomplete / Needs Review: " + describe(section.name,tag,row + 1,a ? "Cat 1" : "Cat 2",sampleAmount(values)));
        if (useAs === "Ignore") continue;
        if (!section.tags.includes(useAs)) throw new Error(`Invalid Statement tag '${tag}' in ${section.name}.`);
        if (found[useAs] !== undefined) throw new Error(`Duplicate Statement tag '${useAs}' in ${section.name}.`);
        found[useAs] = row;
      }
      for (const tag of section.tags) if (found[tag] === undefined) throw new Error(`Missing Statement tag '${tag}' in ${section.name}.`);
    }
    headers.forEach((value,column) => {
      if (label(value) !== "Ori. CCY Amt") return;
      if (label(headers[column + 1]) !== "HKD") throw new Error(`Incomplete Statement: HKD column is missing beside snapshot column ${column + 1}.`);
      const dateValue=rows[dateRows[0]][column];
      if (label(dateValue) && !Number.isFinite(number(dateValue))) throw new Error(`Incomplete Statement: invalid balance date in column ${column + 1}.`);
    });
    const dates = rows[dateRows[0]].flatMap((value, column) => label(headers[column]) === "Ori. CCY Amt" && label(headers[column + 1]) === "HKD" && Number.isFinite(number(value)) ? [{column, date:number(value)}] : []);
    if (dates.length < 2) throw new Error("Statement needs at least two balance dates.");
    const positionRows = [];
    for (let row = head + 1; row < balance; row++) {
      const values = rows[row], tag = label(values[first]), category = label(values[second]);
      if (!tag && !values.some(value => label(value))) continue;
      const type = ["Asset","Liabilities"].includes(tag) ? tag : "";
      if (!type) throw new Error("Incomplete / Needs Review: " + describe("Positions",tag,row + 1,"Cat 1",sampleAmount(values)));
      const known = type === "Asset" ? ["Cash","Investment","Others","MPF"] : ["Credit Card","TW"];
      if (!known.includes(category)) throw new Error("Incomplete / Needs Review: new Cat 2 needs a formula review: " + describe("Positions",category,row + 1,"Cat 2",sampleAmount(values)));
      if (type !== "Ignore") positionRows.push({values, sourceRow:row + 1, type});
    }
    const periods = [];
    for (let i = 1; i < dates.length; i++) {
      const {column, date:end} = dates[i], {column:priorColumn, date:start} = dates[i - 1];
      if (end > todaySerial || end === start) continue;
      if (column !== priorColumn + 2 || end < start) throw new Error(`Incomplete Statement period at balance date ${end}: date columns or order changed.`);
      const hkdColumn = column + 1;
      const positions = positionRows.map(({values, sourceRow, type}) => ({
        type, category:label(values[second]), account:label(values[columns["Cat 3"]]), holding:label(values[columns["Cat 4"]]), ccy:label(values[columns.CCY]),
        original:number(values[column]), hkd:number(values[hkdColumn]), previous:number(values[priorColumn + 1]), sourceRow
      }));
      if (!positions.some(position => Number.isFinite(position.hkd))) throw new Error(`Incomplete Statement positions at balance date ${end}.`);
      const period = {col:column,start,end,days:Math.round(end - start),positions,
        assets:cell(rows,found.Asset,hkdColumn),liabilities:cell(rows,found.Liabilities,hkdColumn),nav:cell(rows,found.NAV,hkdColumn),navChange:cell(rows,found.NAV,column),
        income:cell(rows,found.Income,hkdColumn),salary:cell(rows,found.Salary,hkdColumn),investment:cell(rows,found.Investment,hkdColumn),mpf:cell(rows,found.MPF,hkdColumn),otherIncome:cell(rows,found["Other Income"],hkdColumn),
        expense:cell(rows,found.Expense,hkdColumn),large:cell(rows,found.Large,hkdColumn),housing:cell(rows,found.Housing,hkdColumn),routine:cell(rows,found.Routine,hkdColumn),savings:cell(rows,found["Net Income/(Loss)"],hkdColumn)};
      if (!close(period.assets,sum(positions.filter(x => x.type === "Asset").map(x => x.hkd))) ||
          !close(period.liabilities,sum(positions.filter(x => x.type === "Liabilities").map(x => x.hkd))) ||
          !close(period.nav,period.assets + period.liabilities) ||
          !close(period.navChange,period.income + period.expense) ||
          !close(period.income,sum([period.salary,period.investment,period.mpf,period.otherIncome])) ||
          !close(period.expense,sum([period.large,period.housing,period.routine])) ||
          !close(period.savings,period.salary + period.expense)) {
        throw new Error("Incomplete Statement: totals do not reconcile for balance date " + end + ".");
      }
      periods.push(period);
    }
    return periods;
  }
  return {parse};
})();
if (typeof module !== "undefined") module.exports = StatementModel;
