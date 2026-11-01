const SourceModel = (() => {
  const number = value => value === "" || value == null ? NaN : Number(value);
  const text = value => String(value ?? "").trim();
  function headers(rows, names, start = 0) {
    const row = rows.findIndex((values, index) => index >= start && names.every(name => values.includes(name)));
    if (row < 0) throw new Error("Missing source headers: " + names.join(", "));
    return {row, column:Object.fromEntries(names.map(name => [name,rows[row].indexOf(name)]))};
  }
  function budget(rows) {
    const monthly = headers(rows,["Month","Income","Housing","Routine","Other Regular","Planned Events","Total Expenses","Monthly Surplus","Actual Savings","Actual vs Budget"]);
    const plans = headers(rows,["Date","Event","Category","Estimated Cost","Paid / Saved","Remaining","Include?","Notes"],monthly.row + 1);
    const c=monthly.column, p=plans.column;
    const budgetRows=rows.slice(monthly.row + 1,plans.row).filter(row => Number.isFinite(number(row[c.Month]))).map(row => ({
      month:number(row[c.Month]),income:number(row[c.Income]),housing:number(row[c.Housing]),routine:number(row[c.Routine]),other:number(row[c["Other Regular"]]),
      events:number(row[c["Planned Events"]]),expenses:number(row[c["Total Expenses"]]),surplus:number(row[c["Monthly Surplus"]]),actual:number(row[c["Actual Savings"]]),variance:number(row[c["Actual vs Budget"]])
    }));
    const budgetPlans=rows.slice(plans.row + 1).filter(row => Number.isFinite(number(row[p.Date])) && text(row[p.Event])).map(row => ({
      date:number(row[p.Date]),event:text(row[p.Event]),category:text(row[p.Category]) || "Other",estimated:number(row[p["Estimated Cost"]]),
      paid:number(row[p["Paid / Saved"]]),remaining:number(row[p.Remaining]),included:row[p["Include?"]]===true || text(row[p["Include?"]]).toUpperCase()==="TRUE",notes:text(row[p.Notes])
    })).sort((a,b)=>a.date-b.date);
    return {budgetRows,budgetPlans};
  }
  function income(rows) {
    const h=headers(rows,["Date","Description","Account In / Benefit","Account Out / Source","HKD Amount"]),c=h.column;
    return rows.slice(h.row + 1).filter(row => Number.isFinite(number(row[c.Date])) && Number.isFinite(number(row[c["HKD Amount"]])) && text(row[c["Account Out / Source"]]).startsWith("Income |"))
      .map(row => ({date:number(row[c.Date]),description:text(row[c.Description]),amount:number(row[c["HKD Amount"]]),
        type:text(row[c["Account Out / Source"]]).split("|")[1]?.trim() || "Other",account:text(row[c["Account In / Benefit"]]).split("|")[2]?.trim() || "Other"}))
      .sort((a,b)=>b.date-a.date);
  }
  function expenses(rows) {
    const h=headers(rows,["Date","Item","Amount"]),c=h.column;
    return rows.slice(h.row + 1).filter(row => Number.isFinite(number(row[c.Date])) && Number.isFinite(number(row[c.Amount])))
      .map(row => ({date:number(row[c.Date]),description:text(row[c.Item]),amount:number(row[c.Amount])})).sort((a,b)=>b.date-a.date);
  }
  return {budget,income,expenses};
})();
if (typeof module !== "undefined") module.exports = SourceModel;
