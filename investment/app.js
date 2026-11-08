/* V2-only browser entry point. */
const GOOGLE_CLIENT_ID = "110894641783-ranndo8u0vmmbq0c59g2vehma2vla4g6.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const $ = id => document.getElementById(id);
let tokenClient, token, data = null, epoch = 0;

$("connect").addEventListener("click", connect);
$("refresh").addEventListener("click", () => token ? load() : connect());
$("disconnect").addEventListener("click", disconnect);
document.querySelectorAll(".tab").forEach(button => button.addEventListener("click", () => showTab(button.dataset.tab)));

function setError(message) { $("connect-error").textContent = message; }
function showTab(name) {
  if (!["overview", "profits", "holdings", "activity", "market"].includes(name)) name = "overview";
  document.querySelectorAll(".tab").forEach(button => button.classList.toggle("active", button.dataset.tab === name));
  document.querySelectorAll(".view").forEach(view => view.hidden = view.id !== `view-${name}`);
  location.hash = name;
}
function clearFinancialDisplay(message) {
  data = null;
  if (typeof OverviewUI !== "undefined") OverviewUI.clear();
  if (typeof ReturnUI !== "undefined") ReturnUI.clear();
  if (typeof HoldingsUI !== "undefined") HoldingsUI.clear();
  if (typeof ActivityUI !== "undefined") ActivityUI.clear();
  $("app").hidden = true;
  $("setup").hidden = false;
  $("sync-status").textContent = token ? "V2 load failed" : "Not connected";
  $("refresh").hidden = !token;
  $("disconnect").hidden = !token;
  setError(message);
}
function connect() {
  setError("");
  if (!window.google?.accounts?.oauth2) return setError("Google sign-in is still loading. Try again in a moment.");
  tokenClient = google.accounts.oauth2.initTokenClient({client_id: GOOGLE_CLIENT_ID, scope: SCOPE, callback: async result => {
    if (result.error || !result.access_token) return clearFinancialDisplay("Google sign-in did not complete. Check the selected account and OAuth settings.");
    token = result.access_token;
    await load();
  }});
  tokenClient.requestAccessToken({prompt: ""});
}
async function batchGet(accessToken) {
  const q = new URLSearchParams({valueRenderOption: "UNFORMATTED_VALUE", majorDimension: "ROWS"});
  V2Data.RANGES.forEach((range, index) => { if (index !== 5) q.append("ranges", range); });
  const marketQ = new URLSearchParams({valueRenderOption: "FORMATTED_VALUE", majorDimension: "ROWS", ranges: V2Data.RANGES[5]});
  const options = {
    headers: {Authorization: `Bearer ${accessToken}`}, cache: "no-store"
  };
  const [response, marketResponse] = await Promise.all([
    fetch(`https://sheets.googleapis.com/v4/spreadsheets/${V2Data.SHEET_ID}/values:batchGet?${q}`, options),
    fetch(`https://sheets.googleapis.com/v4/spreadsheets/${V2Data.SHEET_ID}/values:batchGet?${marketQ}`, options)
  ]);
  const failed = !response.ok ? response : !marketResponse.ok ? marketResponse : null;
  if (failed) {
    const why = failed.status === 403 ? "The Google account cannot read the V2 Master, or the Sheets API is not enabled." :
      failed.status === 401 ? "Google access expired. Connect again." : `V2 Master request failed (${failed.status}).`;
    throw new Error(why);
  }
  const [financial, market] = await Promise.all([response.json(), marketResponse.json()]);
  return {valueRanges: [...(financial.valueRanges || []).slice(0, 5), ...(market.valueRanges || []), ...(financial.valueRanges || []).slice(5)]};
}
async function load() {
  const request = ++epoch;
  $("sync-status").textContent = "Loading V2 Master…";
  setError("");
  try {
    const next = V2Data.parse(await batchGet(token));
    if (request !== epoch) return;
    if (!next.current.length && !next.positions.length) throw new Error("V2 Master has no positions to display.");
    data = next;
    OverviewUI.mount(data);
    ReturnUI.mount(data);
    HoldingsUI.mount(data);
    ActivityUI.mount(data);
    $("setup").hidden = true;
    $("app").hidden = false;
    $("refresh").hidden = false;
    $("disconnect").hidden = false;
    $("sync-status").textContent = "V2 Master loaded";
    showTab(location.hash.slice(1));
  } catch (error) {
    if (request !== epoch) return;
    clearFinancialDisplay(error.message || "Could not load V2 Master.");
  }
}
function disconnect() {
  const old = token;
  ++epoch;
  token = undefined;
  clearFinancialDisplay("");
  if (old && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(old, () => {});
}
