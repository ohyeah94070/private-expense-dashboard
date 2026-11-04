const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const SourceRanges = require("./source-ranges.js");
const RealSourceModel = require("./source-model.js");

const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {id,hidden:false,value:"",textContent:"",innerHTML:"",
    listeners:{},classList:{toggle(){}},addEventListener(name,handler){this.listeners[name]=handler},
    querySelectorAll(){return []},replaceChildren(){},insertAdjacentHTML(){}});
  return elements.get(id);
}
const document = {getElementById:element,querySelectorAll:()=>[]};
const planRows = [["Date","Event","Category","Estimated Cost","Paid / Saved","Remaining","Include?","Notes"],
  [45001,"Trip","Taiwan",5,0,5,true,""]];
let failPlans = false, requested = [];
const arrays = new Map(SourceRanges.tabs.map(name=>[name,name==="Future One-off Plans"?planRows:[]]));
const fetch = async url => {
  const parsed = new URL(url);
  if (parsed.pathname.endsWith("values:batchGet")) {
    requested=parsed.searchParams.getAll("ranges");
    return {ok:true,json:async()=>({valueRanges:SourceRanges.tabs.map(name=>({range:requested[SourceRanges.tabs.indexOf(name)],values:arrays.get(name)}))})};
  }
  return {ok:true,json:async()=>({sheets:SourceRanges.tabs.map(title=>({properties:{title,gridProperties:{columnCount:title==="Future One-off Plans"?8:10}}}))})};
};
let oauthConfig;
const google={accounts:{oauth2:{initTokenClient(config){oauthConfig=config;return {requestAccessToken(){config.callback({access_token:"test-token"})}}}}}};
const empty=()=>Object.assign([],{issues:[]});
const SourceModel={...RealSourceModel,budget:()=>({budgetRows:[{month:45000}],issues:[]}),
  plans:(rows,months)=>failPlans?(()=>{throw new Error("Missing source headers")})():RealSourceModel.plans(rows,months),
  expenses:empty,income:empty,exchangeRates:()=>({issues:[],summary:[],date:45030})};
const context=vm.createContext({document,window:{google},google,fetch,URL,URLSearchParams,Intl,Date,Math,Number,String,
  SourceRanges,SourceModel,StatementModel:{parse:()=>[{end:45030}]},setTimeout});
vm.runInContext(fs.readFileSync("app.js","utf8"),context);
vm.runInContext("extract=()=>{};renderAll=()=>{};",context);
async function settle() { for(let i=0;i<5;i++) await new Promise(resolve=>setImmediate(resolve)); }
(async()=>{
  element("connect").listeners.click(); await settle();
  assert.equal(oauthConfig.scope,"https://www.googleapis.com/auth/spreadsheets.readonly");
  assert(requested.includes("'Future One-off Plans'!A:H"));
  assert.equal(element("dashboard").hidden,false);
  assert.equal(element("connect-error").textContent,"");
  failPlans=true;
  await vm.runInContext("loadData()",context);
  assert.equal(element("dashboard").hidden,false,"a broken detail source must not hide Statement pages");
  assert.match(element("data-status").textContent,/Future One-off Plans unavailable \/ Incomplete/);
  console.log("One-click OAuth and separate plan range load passed");
})().catch(error=>{console.error(error);process.exitCode=1});
