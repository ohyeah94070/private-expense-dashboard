# Finance Review

Interactive GitHub Pages dashboard for the private “Finance — Expense Review & Improved Reconciliation” Google Sheet. No financial rows, OAuth access tokens, or client secrets are committed.

## Sources

- **Stmt:** snapshot positions and labeled asset, liability, NAV, income, expense, and salary-less-expense totals. The dashboard locates headers and labels, checks uniqueness, and reconciles each completed period before displaying it. Position `Cat 1` must be `Asset` or `Liabilities`; new `Cat 2` categories require a review of the Sheet's finance formulas.
- **Budget:** 60 monthly rows, with dates and planned figures read by headers. Monthly Planned Events comes from the separate `Future One-off Plans` sheet; the website does not recalculate it.
- **Future One-off Plans:** Date, Event, Category, Estimated Cost, Paid / Saved, Remaining, Include?, and Notes. The checkbox controls inclusion in Budget. Plans outside the 60-month window are flagged.
- **Income & Transfers:** itemized income. Transfers are excluded from the income log.
- **Large exp.:** Date, Item, Amount, Category, and Note. The website displays any nonblank Category exactly as entered; blank is shown as `—`. The list never recalculates Statement Expense.

`Settings!A2:A100` is the shared dropdown suggestion list on a hidden tab. The Category dropdowns in `Future One-off Plans` and `Large exp.` reference it, but allow new text. To add a suggested category, unhide Settings, enter it in the next empty A cell, then hide the tab again. The dashboard does not use a category whitelist; any entered Category appears in the detail, filter, and chart after refresh. `Other` is used only when explicitly entered. `Qingyuan` is confirmed as `Travel` in the Sheet.

`Ex. Rate` is the only visible exchange-rate table and the official source consumed by Statement and Income & Transfers. The hidden `FX Feed` tab supplies recent historical GOOGLEFINANCE quotes. Moving those historical formulas into `Ex. Rate` returned `#N/A` through the Sheets API, so the helper tab remains. Recent `Ex. Rate` rates now use one formula per day and currency; weekend and holiday formulas carry the latest valid earlier weekday quote. Columns E:G show the quote source dates and H:J show Fixed, Live, Carried or Missing. Earlier fixed rates keep blank source-date cells because their original quote dates were not recorded. The older individual formulas in rows 310–318 also lack a recorded source date.

Confirmed 14–31 October 2026 rates and source dates in `Ex. Rate!B319:G336` are archived as fixed values. The older individual formulas in rows 310–318 remain live because their source dates are unrecorded. To archive other confirmed past dates, select the relevant `Ex. Rate` B:G cells, copy, then **Paste special → Values only** onto the same cells. This preserves each rate and its quote source date; the H:J status formulas switch to Fixed. Do not paste into A or H:J. There is no daily automation or write access from the website.

The website reads both tabs without writing to either. It checks duplicate dates, missing or nonpositive official rates, invalid feed quotes, rate differences, and quotes more than seven days old. Its status line shows each currency's recorded status and source date. A fixed rate that differs from the feed is reported for review, not replaced.

The Statement's routine spending is a reconciliation residual inferred from balances and adjustments. It can be positive and is not a transaction ledger. Statement formulas still contain some fixed row and snapshot-column ranges; expanding those areas requires a Sheet formula review even though the dashboard reads all used columns.

## Connection and privacy

The browser requests `https://www.googleapis.com/auth/spreadsheets.readonly` using Google Identity Services, then calls the Google Sheets API directly. The public OAuth Client ID and private Sheet ID are configured in `app.js`, so the connection needs one click. The access token is kept in memory and is not committed. A new page load requires a fresh token. Only Google accounts with access to the private sheet can read its contents.

GitHub Pages serves public frontend code. A client-side PIN would not protect the financial data and is not included.
