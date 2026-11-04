const SourceModel = (() => {
  const number = value => value === "" || value == null ? NaN : Number(value);
  const text = value => String(value ?? "").trim();
  const issue = (severity, sheet, section, tag, row, column, amount) => ({severity,sheet,section,tag,row,column,amount});
  function headers(rows, names) {
    const matches = rows.flatMap((values,index) => names.every(name => values.includes(name)) ? [index] : []);
    if (matches.length !== 1) throw new Error(`Source header row for ${names.join(", ")} is missing or duplicated.`);
    const row=matches[0],column={};
    for (const name of names) {
      const hits=rows[row].flatMap((value,index) => text(value) === name ? [index] : []);
      if (hits.length !== 1) throw new Error(`Source header '${name}' is missing or duplicated at row ${row+1}.`);
      column[name]=hits[0];
    }
    return {row,column};
  }
  function exchangeRates(rateRows,feedRows,today) {
    const names=["Date","TWDHKD","USDHKD","CNYHKD","TWD Source Date","USD Source Date","CNY Source Date","TWD Status","USD Status","CNY Status"];
    if (names.some((name,i)=>text(rateRows[0]?.[i])!==name)) throw new Error("Ex. Rate headers are missing or moved.");
    const issues=[],dates=new Set(),records=[];
    rateRows[0].slice(10).forEach((value,index)=>{if(text(value))issues.push(issue("incomplete","Ex. Rate","Header",text(value),1,"column "+(index+11),NaN));});
    for(let i=1;i<rateRows.length;i++){
      const row=rateRows[i],date=number(row[0]);
      if (!Number.isFinite(date)) {if(row.some(value=>text(value))) issues.push(issue("incomplete","Ex. Rate","Date","invalid",i+1,"A",NaN));continue;}
      if (dates.has(date)) throw new Error(`Duplicate Ex. Rate date at row ${i+1}.`);
      dates.add(date);
      if (records.length&&date<=records.at(-1).date) issues.push(issue("incomplete","Ex. Rate","Date","out of order",i+1,"A",date));
      if(date>today)continue;
      for(let j=1;j<4;j++)if(!Number.isFinite(number(row[j]))||number(row[j])<=0)
        issues.push(issue("incomplete","Ex. Rate",names[j],"Missing",i+1,names[j],number(row[j])));
      records.push({date,row,sourceRow:i+1});
    }
    if(!records.length)throw new Error("Ex. Rate has no past or current rates.");
    const latest=records.at(-1),summary=[];
    if(today-latest.date>1)issues.push(issue("warning","Ex. Rate","Date","latest row is old",latest.sourceRow,"Date",latest.date));
    for(let j=0;j<3;j++){
      const dateCol=j*2,rateCol=dateCol+1,quotes=[],seen=new Set();
      const validHeader=text(feedRows[0]?.[dateCol])==="Date"&&text(feedRows[0]?.[rateCol])==="Close";
      if(!validHeader){issues.push(issue("warning","FX Feed",names[j+1],"feed unavailable",1,"Date/Close",NaN));continue;}
      feedRows.slice(1).forEach((row,index)=>{
        const date=Math.floor(number(row[dateCol])),rate=number(row[rateCol]);
        if(!Number.isFinite(date)||date>today)return;
        if(seen.has(date))issues.push(issue("warning","FX Feed",names[j+1],"duplicate quote date",index+2,"Date",date));
        seen.add(date);
        const weekday=(new Date(Date.UTC(1899,11,30)+date*86400000).getUTCDay()+6)%7<5;
        if(weekday){
          if(Number.isFinite(rate)&&rate>0)quotes.push({date,rate});
          else issues.push(issue("warning","FX Feed",names[j+1],"invalid quote",index+2,"Close",rate));
        }
      });
      quotes.sort((a,b)=>a.date-b.date);
      const source=quotes.filter(q=>q.date<=latest.date).at(-1);
      if(!source){issues.push(issue("warning","FX Feed",names[j+1],"no valid quote",latest.sourceRow,"Date/Close",NaN));continue;}
      for(const record of records){
        const status=text(record.row[7+j]),sourceDate=number(record.row[4+j]);
        if(!["Fixed","Live","Carried","Missing"].includes(status)||
          status==="Missing"&&Number.isFinite(number(record.row[j+1]))&&number(record.row[j+1])>0||
          Number.isFinite(sourceDate)&&sourceDate>record.date||
          status==="Live"&&Number.isFinite(sourceDate)&&sourceDate!==record.date||
          status==="Live"&&!Number.isFinite(sourceDate)&&record.date>=quotes[0].date||
          status==="Carried"&&(!Number.isFinite(sourceDate)||sourceDate>=record.date))
          issues.push(issue("incomplete","Ex. Rate",names[j+1],"status/source date",record.sourceRow,names[4+j],number(record.row[j+1])));
      }
      for(const record of records){
        if(record.date<quotes[0].date)continue;
        const quote=quotes.filter(q=>q.date<=record.date).at(-1);
        if(quote&&Number.isFinite(number(record.row[j+1]))&&Math.abs(number(record.row[j+1])-quote.rate)>1e-7)
          issues.push(issue("warning","Ex. Rate",names[j+1],"differs from feed; review fixed override",record.sourceRow,names[j+1],number(record.row[j+1])));
      }
    }
    for(let j=0;j<3;j++){
      const status=text(latest.row[7+j]),sourceDate=number(latest.row[4+j]);
      summary.push({currency:names[j+1],status,sourceDate});
      if(Number.isFinite(sourceDate)&&today-sourceDate>7)
        issues.push(issue("warning","Ex. Rate",names[j+1],"stale source",latest.sourceRow,names[4+j],sourceDate));
    }
    return {issues,summary,date:latest.date};
  }
  function budget(rows) {
    const h=headers(rows,["Month","Income","Housing","Routine","Other Regular","Planned Events","Total Expenses","Monthly Surplus","Actual Savings","Actual vs Budget"]);
    const c=h.column,issues=[],budgetRows=[],seen=new Set();
    rows[h.row].forEach((value,column)=>{
      const tag=text(value);
      if (tag && !Object.hasOwn(c,tag)) issues.push(issue("incomplete","Budget","Monthly Header",tag,h.row+1,"column "+(column+1),NaN));
    });
    const total=rows.findIndex((r,i)=>i>h.row && /^\d+-Month Total$/.test(text(r[c.Month])));
    if (total<0) throw new Error("Budget month total row is missing.");
    rows.slice(h.row+1,total).forEach((row,index)=>{
      const sourceRow=h.row+index+2,month=number(row[c.Month]);
      if (!Number.isFinite(month)) {
        issues.push(issue("incomplete","Budget","Months",text(row[c.Month]),sourceRow,"Month",NaN));return;
      }
      if (seen.has(month)) throw new Error(`Duplicate Budget month at row ${sourceRow}.`);
      seen.add(month);
      const x={month,income:number(row[c.Income]),housing:number(row[c.Housing]),routine:number(row[c.Routine]),other:number(row[c["Other Regular"]]),
        events:number(row[c["Planned Events"]]),expenses:number(row[c["Total Expenses"]]),surplus:number(row[c["Monthly Surplus"]]),
        actual:number(row[c["Actual Savings"]]),variance:number(row[c["Actual vs Budget"]])};
      for (const key of ["income","housing","routine","other","events","expenses","surplus"])
        if (!Number.isFinite(x[key])) issues.push(issue("incomplete","Budget","Months",key,sourceRow,key,x[key]));
      budgetRows.push(x);
    });
    if (!budgetRows.length) throw new Error("Budget has no valid months.");
    for(let i=1;i<budgetRows.length;i++){
      const a=new Date(Date.UTC(1899,11,30)+budgetRows[i-1].month*86400000);
      const b=new Date(Date.UTC(1899,11,30)+budgetRows[i].month*86400000);
      if ((b.getUTCFullYear()-a.getUTCFullYear())*12+b.getUTCMonth()-a.getUTCMonth()!==1)
        issues.push(issue("incomplete","Budget","Months","month sequence",h.row+i+2,"Month",budgetRows[i].month));
    }
    if (Number(text(rows[total][c.Month]).split("-")[0])!==budgetRows.length)
      issues.push(issue("incomplete","Budget","Months","total count",total+1,"Month",budgetRows.length));
    return {budgetRows,issues};
  }
  function plans(rows,budgetRows) {
    const h=headers(rows,["Date","Event","Category","Estimated Cost","Paid / Saved","Remaining","Include?","Notes"]);
    const c=h.column,issues=[],result=[];
    const start=budgetRows[0]?.month,last=budgetRows.at(-1)?.month;
    const finalMonth=new Date(Date.UTC(1899,11,30)+last*86400000);
    const lastDate=Math.floor((Date.UTC(finalMonth.getUTCFullYear(),finalMonth.getUTCMonth()+1,1)-Date.UTC(1899,11,30))/86400000);
    rows.slice(h.row+1).forEach((row,index)=>{
      if (![c.Date,c.Event,c.Category,c["Estimated Cost"]].some(col=>text(row[col]))) return;
      const sourceRow=h.row+index+2,date=number(row[c.Date]),event=text(row[c.Event]),category=text(row[c.Category]),estimated=number(row[c["Estimated Cost"]]);
      if (!Number.isFinite(date)||!event||!Number.isFinite(estimated)) {
        issues.push(issue("incomplete","Future One-off Plans","Entries",event,sourceRow,"Date/Event/Estimated Cost",estimated));return;
      }
      if (date<start||date>=lastDate) issues.push(issue("warning","Future One-off Plans","Outside 60 months",event,sourceRow,"Date",estimated));
      const check=row[c["Include?"]];
      if (![true,false,"TRUE","FALSE","",undefined,null].includes(check))
        issues.push(issue("incomplete","Future One-off Plans","Entries",event,sourceRow,"Include?",estimated));
      const remaining=number(row[c.Remaining]);
      if (!Number.isFinite(remaining)) issues.push(issue("incomplete","Future One-off Plans","Entries",event,sourceRow,"Remaining",estimated));
      result.push({date,event,category:category||"—",estimated,
        paid:number(row[c["Paid / Saved"]]),remaining,
        included:row[c["Include?"]]===true||text(row[c["Include?"]]).toUpperCase()==="TRUE",notes:text(row[c.Notes])});
    });
    result.sort((a,b)=>a.date-b.date);
    result.issues=issues;
    return result;
  }
  function income(rows) {
    const h=headers(rows,["Date","Description","Account In / Benefit","Account Out / Source","HKD Amount"]);
    const c=h.column,issues=[],entries=[];
    rows.slice(h.row+1).forEach((row,index)=>{
      if (!Object.values(c).some(column=>text(row[column]))) return;
      const sourceRow=h.row+index+2,date=number(row[c.Date]),amount=number(row[c["HKD Amount"]]),tag=text(row[c["Account Out / Source"]]);
      if (!Number.isFinite(date)||!Number.isFinite(amount)||!tag) {
        issues.push(issue("incomplete","Income & Transfers","Source",tag,sourceRow,"Account Out / Source",amount));return;
      }
      const parts=tag.split("|").map(text);
      if (parts.length===5&&["Asset","Liabilities"].includes(parts[0])) return;
      if (parts.length!==5||parts[0]!=="Income"||!["Salary","Other"].includes(parts[1])) {
        issues.push(issue("incomplete","Income & Transfers","Source",tag,sourceRow,"Account Out / Source",amount));return;
      }
      entries.push({date,description:text(row[c.Description]),amount,type:parts[1],
        account:text(row[c["Account In / Benefit"]]).split("|")[2]?.trim()||"Other"});
    });
    entries.sort((a,b)=>b.date-a.date);
    entries.issues=issues;
    return entries;
  }
  function expenses(rows) {
    const h=headers(rows,["Date","Item","Amount","Category","Note"]);
    const c=h.column,issues=[],entries=[];
    rows.slice(h.row+1).forEach((row,index)=>{
      if (!row.some(value=>text(value))) return;
      const sourceRow=h.row+index+2,date=number(row[c.Date]),description=text(row[c.Item]),amount=number(row[c.Amount]),category=text(row[c.Category]);
      if (!Number.isFinite(date)||!description||!Number.isFinite(amount)) {
        issues.push(issue("incomplete","Large exp.","Item",description,sourceRow,"Date/Item/Amount",amount));return;
      }
      entries.push({date,description,amount,category:category||"—",note:text(row[c.Note]),sourceRow});
    });
    entries.sort((a,b)=>b.date-a.date);
    entries.issues=issues;
    return entries;
  }
  return {budget,plans,income,expenses,exchangeRates};
})();
if (typeof module !== "undefined") module.exports=SourceModel;
