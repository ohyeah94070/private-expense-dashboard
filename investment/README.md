# Investment Review

## Unified portfolio (2026-10-30)

The active UI reads the existing private Sheet through Google OAuth with the `spreadsheets.readonly` scope. `model.js` parses source tabs, `unified.js` normalizes positions and activity and calculates broker-filtered monthly results, and `unified-app.js` renders Overview, Holdings and Trades & Cash. Watchlist remains on its separate best-effort quote request. The old broker-specific markup is hidden for compatibility and is not rendered.

Source flow: IBKR snapshot, trade and cash rows; Webull OpenAPI current snapshot and filled executions; Webull official month-end statements; private Google Sheet; browser-side normalization and aggregation. `Webull Executions` stores only filled/partially filled API executions with unique execution IDs, source links and gross cash effects. It does not contain a Webull cash ledger, fees or realized profit. The daily Webull archive automation updates this tab and `Webull Current`; statement month-end tabs remain manually reconciled.

Monthly portfolio P/L = current official month-end NAV − previous official month-end NAV − net portfolio funding. January starts from the official 2025-12-31 NAV of each broker. IBKR↔Webull transfers cancel when both legs appear in the two broker funding totals; June's linkage is still flagged for reconciliation. Monthly return is calculated as P/L / opening NAV only when net funding is zero. With nonzero funding, daily flow timing is unavailable, so return is `—` rather than an unsupported TWR or Modified Dietz estimate. Historical Webull cost basis and realized P/L are unavailable, so historical combined stock-level P/L is marked partial. Current IBKR and Webull snapshots may be from different dates, so their combined NAV is explicitly labeled indicative.

Holdings use HKD for NAV and weights; row values remain in source currency, currently USD. Cross-broker consolidation requires matching asset type/currency and a verified identity mapping. QLD CUSIP 74347R206 is documented by [ProShares](https://www.proshares.com/globalassets/proshares/fact-sheet/prosharesfactsheetqld.pdf); MU CUSIP 595112103 is documented in [Micron investor filings](https://investors.micron.com/static-files/de4cc557-90c7-4927-9295-60440b0a8cba). Other same-symbol records remain separate until their identity is verified. Average cost uses total cost basis / total shares. Missing cost or FX remains missing.

Run `node model.test.js`, `node unified.test.js`, `node market.test.js` and `node ui.test.js` to check parsing, aggregation, quote isolation, and desktop/mobile rendering. The UI test uses a synthetic fixture and local Chrome. Google OAuth sign-in and live Sheets refresh require a signed-in browser check after deployment.

Read-only GitHub Pages investment dashboard. The browser signs in to the private Brokerage Portfolio Tracker Google Sheet; no broker credentials are embedded in the public website.

## Data sources

- Current IBKR portfolio, trades, and cash activity: IBKR records in the private Sheet. Current Webull value, cash, positions, and cumulative unrealized P/L: read-only Webull OpenAPI snapshot in `Webull Current`.
- Webull official month-end NAV, statement cash categories, and historical holdings: unlocked monthly statements in the private `微牛 Webull/原始结单` Google Drive folder, summarized in `Webull Monthly` and `Webull Holdings`.
- `Broker Reconciliation` keeps IBKR and Webull month-end NAV, funding, and P/L in separate columns, with a combined check. The latest common reconciled month is September 2026. October API values are displayed separately because they are not an official month-end result.
- Historical month-end account value: IBKR PortfolioAnalyst daily NAV, sampled on the last trading day of each month and stored in `Monthly Summary!M2:M10`.
- Historical QLD, QQQ and SPYM closes: IBKR historical daily bars. The month-end share counts, cash and cost bases are still reconstructed from transactions in the Sheet; these are estimates until reconciled with IBKR statements.
- Market Watch: eight quotes from the private `Market Watch` Sheet, using GOOGLEFINANCE for real S&P 500 and Nasdaq 100 indices plus six ETFs/stocks. The website reads this range separately through the existing read-only Google OAuth session, so a quote failure cannot block the brokerage dashboard. There is no TradingView widget, extra quote API, database or quote archive.

The Sheet calculates price, 1D change, 52-week high/low and quote time automatically. 1D is `GOOGLEFINANCE(...,"changepct")/100`, stored as a fraction; the website formats it as a percentage once. The 1W formula uses the latest quote date and the close from five earlier trading sessions. It was verified through the Sheets API on 28 Oct 2026 for all eight symbols. Google documents historical GOOGLEFINANCE values as unsupported through the Sheets API, so this formula is a best-effort dependency: if Google stops returning it, the website shows `—` rather than an invented value. Quotes older than seven calendar days are hidden.

The Overview period selector uses IBKR official month-end NAV for Total Account Value. Stock value, cash and unrealized P/L are reconstructed, with July/August FX and QLD cost basis reconciled to IBKR statements. Monthly total P/L subtracts recorded net funding from the change in official NAV. January uses IBKR's official 31 Dec 2025 opening NAV of HK$338,598.20, including holdings from before 2026. The current 2026 YTD total uses the latest Sheet account snapshot minus that opening NAV and recorded 2026 funding.

The P/L panel distinguishes the **month-end cumulative open stock P/L balance** from its **change during the month**. A positive balance can fall during a losing month. For February onward, the monthly breakdown shows realized stock P/L, dividends, interest, tax and an FX/fees/valuation reconciliation amount; these sum to monthly total P/L. January instead shows the official opening NAV, closing NAV and funding because a December stock-level unrealized balance is unavailable.

Labels use **this month** for monthly flows and changes, **2026 YTD** for the available calendar-year records, and **cumulative open-position P/L** for gains on shares still held since their purchase. The available records do not support a true account-lifetime P/L label.

The Overview stock P/L table attributes each completed month's stock result to symbols: change in open-position unrealized P/L, realized trades, and dividends net of related tax. The current view keeps open-position P/L separate from 2026 realized and income values. Stock totals need not equal total account P/L because interest and FX/valuation differences are account-level items. January has no December opening unrealized balance, so its stock P/L change is unavailable.

The Holdings tab follows the reporting period. Current uses the latest IBKR position snapshot, with QLD cost price corrected to the 31 Aug 2026 and 27 Oct 2026 statements because the IBKR position API's average price differs. A completed month uses reconstructed month-end shares, IBKR historical close, cost basis and unrealized P/L from `Monthly Valuation`. August's open stock P/L now matches the official statement at HK$67,727.99; earlier cost bases remain estimates anchored to that statement.

Local checks: `node --check app.js`, `node --check model.js`, `node model.test.js`.
