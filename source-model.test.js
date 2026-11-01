const assert = require("node:assert/strict");
const SourceModel = require("./source-model.js");

const budgetHeaders = ["Monthly Surplus","Total Expenses","Planned Events","Other Regular","Routine","Housing","Income","Month","Actual vs Budget","Actual Savings"];
const planHeaders = ["Event","Date","Notes","Include?","Remaining","Paid / Saved","Estimated Cost","Category"];
const budget = [["Title"],[],budgetHeaders,[12,8,2,0,3,3,20,45000,"",""],[],["Future One-off Plans"],planHeaders,["Trip",45030,"Later",true,5,"",5,"Travel"]];
const result=SourceModel.budget(budget);
assert.equal(result.budgetRows.length,1);
assert.equal(result.budgetRows[0].surplus,12);
assert.equal(result.budgetRows[0].expenses,8);
assert.equal(result.budgetPlans[0].event,"Trip");
assert.equal(result.budgetPlans[0].included,true);

const income=[[],["HKD Amount","Account Out / Source","Date","Description","Account In / Benefit"],[20,"Income | Salary |  |  | HKD",45010,"Pay","Asset | Cash | Bank |  | HKD"],[10,"Asset | Cash",45011,"Transfer","Asset | Cash | Bank |  | HKD"]];
assert.deepEqual(SourceModel.income(income).map(x=>[x.description,x.amount,x.type,x.account]),[["Pay",20,"Salary","Bank"]]);
const expenses=[[],["Amount","Item","Date"],[-5,"Trip",45012]];
assert.deepEqual(SourceModel.expenses(expenses).map(x=>[x.description,x.amount]),[["Trip",-5]]);
console.log("Budget and ledger label mapping passed");
