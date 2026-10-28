# Investment Review

Read-only investment dashboard for one private Google Sheet and online market data:

- Brokerage Portfolio Tracker: positions, trades, non-trade cash ledger, monthly activity, and dashboard totals.
- TradingView Market Data widget: online prices for the eight tracked symbols in an isolated iframe. It does not read US Markets Tracker or store quote history on Google Drive.

The site uses the Google Sheets API in the visitor's browser with the `spreadsheets.readonly` scope. It shares the public Google OAuth client ID and website origin used by Finance Review, so visitors only need to select **Connect Google account**. Tokens remain in memory. The public repository contains no account rows, report XML, access token, or private key. Only a Google account already permitted to read Brokerage Portfolio Tracker can load the private data.

Open the page and select **Connect Google account**. Use **Refresh** to read the current Sheet values. New IBKR/Webull reports must first be imported into Brokerage Portfolio Tracker; uploading a raw file alone does not update its calculated tables. TradingView controls quote refresh and may display delayed exchange data.

The main HKD figures are read directly from Brokerage Portfolio Tracker's Dashboard. The site does not independently recompute those headline values. The source sheet uses one reference FX rate, combines equity and cash snapshots with different as-of dates, and does not calculate an exact YTD return. TradingView's embedded quotes cannot be used by the site's JavaScript to calculate personal P/L.

The P/L selector shows the sum of current unrealized P/L and 2026 realized components, or a selected month's realized P/L, dividends, interest and tax from Monthly Activity. Monthly totals do not include mark-to-market gains on open positions. Accurate monthly total return and month-end holdings require monthly IBKR Flex statement sections or an equivalent historical broker snapshot.

## Encrypted GitHub snapshot

The site can encrypt the currently read brokerage sheet in the browser and update `investment/snapshot.enc.json` in this repository. The user enters a 20+ character recovery key and a fine-grained GitHub personal access token with Contents write permission for this one repository. The token and key stay in browser memory and are never committed or put in URL parameters. Each successful Google refresh in the same tab updates the encrypted file. On another computer, use the recovery key to unlock the latest snapshot without Google sign-in. Creating the first snapshot and each new browser session requires entering the key and token; the browser cannot silently write to GitHub without a credential. Keep the recovery key safe: losing it makes the snapshot unreadable. The encrypted snapshot is publicly downloadable but has no plaintext account data.

Local checks: `node --check app.js`, `node --check model.js`, `node model.test.js`.
