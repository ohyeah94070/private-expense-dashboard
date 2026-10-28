import { createSign } from "node:crypto";
import { spawn } from "node:child_process";

const scopes = "https://www.googleapis.com/auth/spreadsheets.readonly";
const ranges = ["Stmt!A1:U54", "Budget!A1:J100", "'Income & Transfers'!A1:O300", "'Large exp.'!A1:C500"];
const sheetId = process.env.EXPENSE_SHEET_ID;
const account = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "null");
if (!/^[A-Za-z0-9_-]{20,}$/.test(sheetId || "") || !account?.client_email || !account?.private_key || !/^[A-Z]{12}$/.test(process.env.EXPENSE_SNAPSHOT_KEY || "")) {
  throw new Error("Missing or invalid backup secrets");
}

const now = Math.floor(Date.now()/1000);
const encode = object => Buffer.from(JSON.stringify(object)).toString("base64url");
const unsigned = encode({alg:"RS256",typ:"JWT"})+"."+encode({iss:account.client_email,scope:scopes,aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600});
const signer = createSign("RSA-SHA256");
signer.update(unsigned); signer.end();
const assertion = unsigned+"."+signer.sign(account.private_key).toString("base64url");
const tokenResponse = await fetch("https://oauth2.googleapis.com/token",{
  method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion})
});
if (!tokenResponse.ok) throw new Error("Google service-account authorization failed ("+tokenResponse.status+")");
const {access_token:token} = await tokenResponse.json();
if (!token) throw new Error("Google did not return an access token");

const query = new URLSearchParams({valueRenderOption:"UNFORMATTED_VALUE",majorDimension:"ROWS"});
ranges.forEach(range => query.append("ranges",range));
const sheetResponse = await fetch("https://sheets.googleapis.com/v4/spreadsheets/"+sheetId+"/values:batchGet?"+query,{
  headers:{Authorization:"Bearer "+token},cache:"no-store"
});
if (!sheetResponse.ok) throw new Error("Private Sheet read failed ("+sheetResponse.status+")");
const data = await sheetResponse.json();
if (data.valueRanges?.length !== ranges.length) throw new Error("Sheet response is incomplete");
const raw = Object.fromEntries(data.valueRanges.map((item,i) => [ranges[i].split("!")[0].replaceAll("'",""),item.values || []]));
if (!raw.Stmt?.length || !raw.Budget?.length) throw new Error("Required Sheet data is empty");

const child = spawn(process.execPath,["scripts/build-snapshot.mjs"],{stdio:["pipe","inherit","inherit"],env:process.env});
child.stdin.end(JSON.stringify({raw}));
const exitCode = await new Promise((resolve,reject) => {child.on("error",reject);child.on("close",resolve);});
if (exitCode !== 0) throw new Error("Snapshot encryption failed");
console.log("Encrypted backup built from the private Sheet.");
