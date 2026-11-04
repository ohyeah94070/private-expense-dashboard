const assert = require("node:assert/strict");
const SourceModel = require("./source-model.js");

const bh=["Monthly Surplus","Total Expenses","Planned Events","Other Regular","Routine","Housing","Income","Month","Actual vs Budget","Actual Savings"];
const totalRow=[];totalRow[7]="1-Month Total";
const budget=[[],[],bh,[12,8,2,0,3,3,20,45000,"",""],totalRow];
const parsed=SourceModel.budget(budget);
assert.equal(parsed.budgetRows.length,1);
assert.equal(parsed.budgetRows[0].surplus,12);

const ph=["Event","Date","Notes","Include?","Remaining","Paid / Saved","Estimated Cost","Category"];
const plans=[[],ph,["Trip",45030,"Later",true,5,"",5,"Travel"]];
const result=SourceModel.plans(plans,parsed.budgetRows);
assert.equal(result[0].event,"Trip");
assert.equal(result[0].included,true);
assert.equal(result[0].category,"Travel");

const income=[[],["HKD Amount","Account Out / Source","Date","Description","Account In / Benefit"],
  [20,"Income | Salary |  |  | HKD",45010,"Pay","Asset | Cash | Bank |  | HKD"],
  [10,"Asset | Cash | Bank |  | HKD",45011,"Transfer","Asset | Cash | Bank |  | HKD"]];
assert.deepEqual(SourceModel.income(income).map(x=>[x.description,x.amount,x.type,x.account]),[["Pay",20,"Salary","Bank"]]);
const incomeWithLookup=structuredClone(income);incomeWithLookup.push(Array(18).fill(""));incomeWithLookup.at(-1)[17]="Income | Other |  |  | HKD";
assert.equal(SourceModel.income(incomeWithLookup).issues.length,0);
const expenses=[[],["Amount","Item","Date","Note","Category"],[-5,"Trip",45012,"Note","Travel"],[-2,"Unknown",45013,"",""]];
const exp=SourceModel.expenses(expenses);
assert.deepEqual(exp.map(x=>[x.description,x.amount,x.category]),[["Unknown",-2,"—"],["Trip",-5,"Travel"]]);
assert.equal(exp.issues.length,0);
const badCategory=structuredClone(expenses);badCategory[3][4]="Unlisted";
assert.equal(SourceModel.expenses(badCategory)[0].category,"Unlisted");
assert.equal(SourceModel.expenses(badCategory)[0].amount,-2);
const extraCategory=SourceModel.expenses(expenses);
assert.equal(extraCategory[1].category,"Travel");
const unknownHeader=structuredClone(budget);unknownHeader[2][11]="New financial column";
assert.equal(SourceModel.budget(unknownHeader).issues[0].severity,"incomplete");
const outside=structuredClone(plans);outside[2][1]=50000;
assert.match(SourceModel.plans(outside,parsed.budgetRows).issues[0].section,/Outside/);
const badCheckbox=structuredClone(plans);badCheckbox[2][3]="Maybe";
assert.equal(SourceModel.plans(badCheckbox,parsed.budgetRows).issues.some(x=>x.column==="Include?"),true);
const insertedBudget=structuredClone(budget);insertedBudget.unshift([]);
assert.equal(SourceModel.budget(insertedBudget).budgetRows[0].income,20);
const missingMonth=structuredClone(budget);missingMonth[3][7]="";
assert.throws(()=>SourceModel.budget(missingMonth),/no valid months/);
const duplicateMonth=structuredClone(budget);duplicateMonth.splice(4,0,structuredClone(budget[3]));
assert.throws(()=>SourceModel.budget(duplicateMonth),/Duplicate Budget month/);
const missingHeader=structuredClone(budget);missingHeader[2][6]="";
assert.throws(()=>SourceModel.budget(missingHeader),/missing or duplicated/);
const duplicateHeader=structuredClone(budget);duplicateHeader[2][11]="Income";
assert.throws(()=>SourceModel.budget(duplicateHeader),/duplicated/);
const newPlan=structuredClone(plans);newPlan.push(["Education plan",45030,"",false,12,"",12,"Tax"]);
assert.equal(SourceModel.plans(newPlan,parsed.budgetRows).length,2);
assert.equal(SourceModel.plans(newPlan,parsed.budgetRows)[1].included,false);
const unknownPlan=structuredClone(plans);unknownPlan[2][7]="New category";
assert.equal(SourceModel.plans(unknownPlan,parsed.budgetRows)[0].category,"New category");
assert.equal(SourceModel.plans(unknownPlan,parsed.budgetRows).issues.some(x=>x.column==="Category"),false);
const atFirstRow=[["Date","Event","Category","Estimated Cost","Paid / Saved","Remaining","Include?","Notes"],
  [45030,"Trip","Taiwan",5,0,5,true,""]];
assert.equal(SourceModel.plans(atFirstRow,parsed.budgetRows)[0].category,"Taiwan");
assert.throws(()=>SourceModel.plans([["Date","Event","Category","Estimated Cost","Paid / Saved","Remaining","Include?","Notes"],
  ["Date","Event","Category","Estimated Cost","Paid / Saved","Remaining","Include?","Notes"]],parsed.budgetRows),/duplicated/);
assert.equal(SourceModel.plans(unknownPlan,parsed.budgetRows)[0].category,"New category");
assert.equal(SourceModel.plans(unknownPlan,parsed.budgetRows).issues.some(x=>x.column==="Category"),false);
const rates=[["Date","TWDHKD","USDHKD","CNYHKD","TWD Source Date","USD Source Date","CNY Source Date","TWD Status","USD Status","CNY Status"],
  [45000,.24,7.8,1.1,,,,"Fixed","Fixed","Fixed"],
  [45001,.25,7.81,1.11,45001,45001,45001,"Live","Live","Live"],
  [45002,.25,7.81,1.11,45001,45001,45001,"Carried","Carried","Carried"]];
const feed=[["Date","Close","Date","Close","Date","Close"],[45001.9,.25,45001.9,7.81,45001.9,1.11]];
const fx=SourceModel.exchangeRates(rates,feed,45002);
assert.equal(fx.issues.length,0);
assert.deepEqual(fx.summary.map(x=>[x.status,x.sourceDate]),[["Carried",45001],["Carried",45001],["Carried",45001]]);
const archived=structuredClone(rates);archived[3][7]="Fixed";archived[3][8]="Fixed";archived[3][9]="Fixed";
assert.equal(SourceModel.exchangeRates(archived,feed,45002).issues.length,0);
assert.equal(SourceModel.exchangeRates(archived,feed,45002).summary[0].status,"Fixed");
const stale=SourceModel.exchangeRates(rates,feed,45010);
assert.equal(stale.issues.filter(x=>x.tag==="stale source").length,3);
const missingRate=structuredClone(rates);missingRate[3][1]=0;
assert.equal(SourceModel.exchangeRates(missingRate,feed,45002).issues.some(x=>x.severity==="incomplete"),true);
const futureFeed=structuredClone(feed);futureFeed[1][0]=45003.9;
assert.equal(SourceModel.exchangeRates(rates,futureFeed,45002).issues.some(x=>x.tag==="no valid quote"),true);
const invalidFeed=structuredClone(feed);invalidFeed[1][1]=0;
assert.equal(SourceModel.exchangeRates(rates,invalidFeed,45002).issues.some(x=>x.tag==="invalid quote"),true);
const badSource=structuredClone(rates);badSource[3][4]=45003;
assert.equal(SourceModel.exchangeRates(badSource,feed,45002).issues.some(x=>x.tag==="status/source date"),true);
const badStatus=structuredClone(rates);badStatus[3][7]="Other";
assert.equal(SourceModel.exchangeRates(badStatus,feed,45002).issues.some(x=>x.severity==="incomplete"),true);
const duplicateRateDate=structuredClone(rates);duplicateRateDate.push(structuredClone(rates[3]));
assert.throws(()=>SourceModel.exchangeRates(duplicateRateDate,feed,45002),/Duplicate Ex. Rate date/);
console.log("Budget, plans, income and expense header mapping passed");
