# Investment Review

Read-only investment dashboard for one private Google Sheet and online market data:

- Brokerage Portfolio Tracker: positions, trades, non-trade cash ledger, monthly activity, and dashboard totals.
- TradingView Market Data widget: online prices for the eight tracked symbols. It does not read US Markets Tracker or store quote history on Google Drive.

The site uses the Google Sheets API in the visitor's browser with the `spreadsheets.readonly` scope. It asks for the Google OAuth client ID used by the existing Finance Review site; on the same GitHub Pages origin, it can reuse that site's saved client ID. Tokens remain in memory. The public repository contains no account rows, report XML, access token, or private key. Only a Google account already permitted to read Brokerage Portfolio Tracker can load the private data.

Open the page and select **Connect Google account**. Use **Refresh** to read the current Sheet values. New IBKR/Webull reports must first be imported into Brokerage Portfolio Tracker; uploading a raw file alone does not update its calculated tables. TradingView controls quote refresh and may display delayed exchange data.

The main HKD figures are read directly from Brokerage Portfolio Tracker's Dashboard. The site does not independently recompute those headline values. The source sheet uses one reference FX rate, combines equity and cash snapshots with different as-of dates, and does not calculate an exact YTD return. TradingView's embedded quotes cannot be used by the site's JavaScript to calculate personal P/L.

Local checks: `node --check app.js`, `node --check model.js`, `node model.test.js`.
