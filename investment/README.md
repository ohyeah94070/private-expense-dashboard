# Investment Review

Read-only investment dashboard for one private Google Sheet and online market data:

- Brokerage Portfolio Tracker: positions, trades, non-trade cash ledger, monthly activity, and dashboard totals.
- TradingView Market Data widget: online prices for the eight tracked symbols in an isolated iframe. It does not read US Markets Tracker or store quote history on Google Drive.

The site uses the Google Sheets API in the visitor's browser with the `spreadsheets.readonly` scope. It shares the public Google OAuth client ID and website origin used by Finance Review, so visitors only need to select **Connect Google account**. Tokens remain in memory. The public repository contains no account rows, report XML, access token, or private key. Only a Google account already permitted to read Brokerage Portfolio Tracker can load the private data.

Open the page and select **Connect Google account**. Use **Refresh** to read the current Sheet values. New IBKR/Webull reports must first be imported into Brokerage Portfolio Tracker; uploading a raw file alone does not update its calculated tables. TradingView controls quote refresh and may display delayed exchange data.

The main HKD figures are read directly from Brokerage Portfolio Tracker's Dashboard. The site does not independently recompute those headline values. The source sheet uses one reference FX rate, combines equity and cash snapshots with different as-of dates, and does not calculate an exact YTD return. TradingView's embedded quotes cannot be used by the site's JavaScript to calculate personal P/L.

The Overview period selector shows current values or a completed 2026 month. `Monthly Valuation` holds reconstructed month-end shares, Alpaca SIP closing prices, cost basis and unrealized P/L. `Monthly Summary` holds reconstructed USD/HKD cash balances, ECB month-end FX, total value and funding-adjusted monthly P/L. January has no total P/L because December opening value is missing. Reconstructions assume no unrecorded trades, share changes or cash flows; month-end IBKR Flex statements should be used to reconcile them.

## Encrypted GitHub snapshot

The GitHub repository contains `investment/snapshot.enc.json`, an encrypted point-in-time copy of the brokerage Sheet values. The website opens it with a recovery key when Google access is unavailable. The ciphertext is publicly downloadable, but the key is not stored in the repository. Refreshing it requires an authorized update to GitHub; signing in to Google on the public website alone cannot write to GitHub. Keep the recovery key safe: losing it makes the snapshot unreadable.

Local checks: `node --check app.js`, `node --check model.js`, `node model.test.js`.
