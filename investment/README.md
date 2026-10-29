# Investment Review

Read-only GitHub Pages investment dashboard. The browser signs in to the private Brokerage Portfolio Tracker Google Sheet; no broker credentials are embedded in the public website.

## Data sources

- Current portfolio, trades, cash activity: IBKR records imported into the private Sheet. Webull is pending.
- Historical month-end account value: IBKR PortfolioAnalyst daily NAV, sampled on the last trading day of each month and stored in `Monthly Summary!M2:M10`.
- Historical QLD, QQQ and SPYM closes: IBKR historical daily bars. The month-end share counts, cash and cost bases are still reconstructed from transactions in the Sheet; these are estimates until reconciled with IBKR statements.
- Market Watch: eight quotes from the private `Market Watch` Sheet, using GOOGLEFINANCE for real S&P 500 and Nasdaq 100 indices plus six ETFs/stocks. The website reads this range separately through the existing read-only Google OAuth session, so a quote failure cannot block the brokerage dashboard. There is no TradingView widget, extra quote API, database or quote archive.

The Sheet calculates price, 1D change, 52-week high/low and quote time automatically. 1D is `GOOGLEFINANCE(...,"changepct")/100`, stored as a fraction; the website formats it as a percentage once. The 1W formula uses the latest quote date and the close from five earlier trading sessions. It was verified through the Sheets API on 28 Oct 2026 for all eight symbols. Google documents historical GOOGLEFINANCE values as unsupported through the Sheets API, so this formula is a best-effort dependency: if Google stops returning it, the website shows `—` rather than an invented value. Quotes older than seven calendar days are hidden. Offline encrypted portfolio snapshots do not contain market quotes.

The Overview period selector uses IBKR official month-end NAV for Total Account Value. Stock value, cash and unrealized P/L are reconstructed, with July/August FX and QLD cost basis reconciled to IBKR statements. Monthly total P/L subtracts recorded net funding from the change in official NAV. January uses IBKR's official 31 Dec 2025 opening NAV of HK$338,598.20, including holdings from before 2026. The current 2026 YTD total uses the latest Sheet account snapshot minus that opening NAV and recorded 2026 funding.

The P/L panel distinguishes the **month-end cumulative open stock P/L balance** from its **change during the month**. A positive balance can fall during a losing month. For February onward, the monthly breakdown shows realized stock P/L, dividends, interest, tax and an FX/fees/valuation reconciliation amount; these sum to monthly total P/L. January instead shows the official opening NAV, closing NAV and funding because a December stock-level unrealized balance is unavailable.

Labels use **this month** for monthly flows and changes, **2026 YTD** for the available calendar-year records, and **cumulative open-position P/L** for gains on shares still held since their purchase. The available records do not support a true account-lifetime P/L label.

The Overview stock P/L table attributes each completed month's stock result to symbols: change in open-position unrealized P/L, realized trades, and dividends net of related tax. The current view keeps open-position P/L separate from 2026 realized and income values. Stock totals need not equal total account P/L because interest and FX/valuation differences are account-level items. January has no December opening unrealized balance, so its stock P/L change is unavailable.

The Holdings tab follows the reporting period. Current uses the latest IBKR position snapshot, with QLD cost price corrected to the 31 Aug 2026 and 27 Oct 2026 statements because the IBKR position API's average price differs. A completed month uses reconstructed month-end shares, IBKR historical close, cost basis and unrealized P/L from `Monthly Valuation`. August's open stock P/L now matches the official statement at HK$67,727.99; earlier cost bases remain estimates anchored to that statement.

## Encrypted GitHub snapshot

`investment/snapshot.enc.json` is an encrypted point-in-time copy of the private Sheet. The website opens it with a case-sensitive 12-letter recovery key when Google access is unavailable. The ciphertext is public, but the key is not stored in the repository. A daily Codex automation reads the private Sheet, encrypts it with the locally DPAPI-protected key, and publishes changes to GitHub. It runs on this Windows computer and requires its Google Drive connection and Git push access; opening the website does not itself write to GitHub.

Local checks: `node --check app.js`, `node --check model.js`, `node model.test.js`.
