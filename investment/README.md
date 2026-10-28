# Investment Review

Read-only GitHub Pages investment dashboard. The browser signs in to the private Brokerage Portfolio Tracker Google Sheet; no broker credentials are embedded in the public website.

## Data sources

- Current portfolio, trades, cash activity: IBKR records imported into the private Sheet. Webull is pending.
- Historical month-end account value: IBKR PortfolioAnalyst daily NAV, sampled on the last trading day of each month and stored in `Monthly Summary!M2:M10`.
- Historical QLD, QQQ and SPYM closes: IBKR historical daily bars. The month-end share counts, cash and cost bases are still reconstructed from transactions in the Sheet; these are estimates until reconciled with IBKR statements.
- Watchlist: direct market-page links. The public static website cannot call IBKR's authenticated market-data API itself; doing so would expose brokerage credentials. There is no TradingView widget or quote archive.

The Overview period selector uses IBKR official month-end NAV for Total Account Value. Stock value, cash and unrealized P/L remain reconstructed estimates. Monthly total P/L subtracts recorded net funding from the change in official NAV; it may differ from IBKR's performance reports because of FX timing and unrecorded flows. January has no prior-month opening value.

The P/L panel distinguishes the **month-end unrealized stock P/L balance** from its **change during the month**. A positive balance can fall during a losing month. The monthly breakdown shows realized stock P/L, dividends, interest, tax and an FX/fees/valuation reconciliation amount; these sum to monthly total P/L. The Overview monthly cards show each completed month's funding-adjusted result, not trade counts.

## Encrypted GitHub snapshot

`investment/snapshot.enc.json` is an encrypted point-in-time copy of the private Sheet. The website opens it with a recovery key when Google access is unavailable. The ciphertext is public, but the key is not stored in the repository. Google sign-in does not itself refresh this GitHub file; an authorized update must republish it.

Local checks: `node --check app.js`, `node --check model.js`, `node model.test.js`.
