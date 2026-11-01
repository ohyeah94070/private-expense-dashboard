---
name: investment-portfolio-update
description: Resume and reconcile this user's IBKR and Webull HK investment Sheet and GitHub Pages dashboard. Use for monthly catch-up, statement imports, schedule review, or data discrepancies.
---

# Investment portfolio update

## Start

Read this file, then the private `Investment Portfolio | IBKR + Webull` spreadsheet's `Workflow Status` and `Start Here` tabs. The spreadsheet ID is in `investment/app.js`. Compare the checkpoint with actual statement files and Sheet month rows; catch up each missing month in order. An absent record is not zero.

Keep the existing flow: broker API or statements → private Google Drive and Google Sheet → readonly Google OAuth → `investment/` on GitHub Pages. Sheet edits need a browser refresh. Deploy the site only for code changes.

## Existing sources

- Public site: `investment/index.html`, `app.js`, `model.js`, `unified.js`, `unified-app.js`, and CSS. Keep raw financial data and keys out of GitHub.
- Local workspace: `C:\Users\ohyea\OneDrive\文件\Investment`; Webull scripts in `scripts/webull_*.py` and `scripts/build_webull_sheet_payload.py`; private database in `data/webull/webull.sqlite3`.
- IBKR current API → `IBKR Snapshot` and `Positions`. Historical `Trades` and `Cash Ledger` come from Flex or Activity Statements; the daily snapshot alone does not refresh them. The private `scripts/ibkr_flex_sync.ps1` retrieves an Activity Flex XML report by closed month without Portal login or Save clicks. `scripts/ibkr_flex_catchup.ps1` retries missing months and records `data/ibkr/flex/sync-status.json`. The read-only Flex token is in the local Windows Credential Manager; `scripts/ibkr_vault.ps1` reads it. Never put the token, account number, XML reports, or financial values in this public repository.
- IBKR standard monthly Activity Statement PDF is a separate source from Flex XML. The connected IBKR tool does not expose PDF statement generation. Existing email notifications have links but no PDF attachments. The Portal PDF API requires an authenticated session; do not claim that PDF download is unattended until a supported delivery method is configured and tested. PortfolioAnalyst month-end NAV is a useful independent official check, but is not a PDF.
- The current Flex query fetched March–September 2026, and its trade/cash IDs matched the existing Sheet rows. January–February 2026 month-specific Flex requests returned IBKR error 1003; keep that detail gap visible even though their official NAV values were checked. October 2026 is not yet available as of 1 November and is retried automatically.
- Webull OpenAPI → private Drive archive, local database, `Webull Current`, and `Webull Executions`. Official `Webull Monthly` and `Webull Holdings` require checked statements when the API omits history.
- `Monthly Summary` is IBKR monthly source. `Monthly Valuation`, `Monthly Results`, `Broker Reconciliation`, `Funding Detail`, `Stock P&L Detail`, `Portfolio Home`, and `Month-End Estimate` are existing calculation/display tabs. Read formulas before editing.

## Monthly catch-up

1. Read `Workflow Status`, month rows, private Drive statement dates, API as-of times, and automation definitions. List missing months. Confirm both official statements before calling a month official.
2. Run the existing Webull archive/import/reconcile path. Deduplicate statements by hash and executions by ID. Verify counts and monthly totals. Without a PDF, keep the API month-end estimate **Preliminary** with observation times and unverified funding.
3. Fetch IBKR current API data; check NAV against equity plus cash and position market values. Run the private Flex catch-up script for closed missing months. Compare Flex trade IDs and cash transaction IDs with `Trades` and `Cash Ledger`; compare the month-end NAV with the independent PortfolioAnalyst series and, when available, the standard Activity Statement PDF. Do not label the Flex XML as the standard PDF. Preserve verified cost basis when API cost differs, and flag it.
4. Check each broker's statement NAV, cash, positions, trades, dividends, taxes, fees, and external funding against source rows. Then check combined NAV = IBKR NAV + Webull NAV; combined P/L = ending NAV − beginning NAV − external net funding. Internal transfers cancel. A buy is not loss; sale proceeds are not realized profit. Missing values stay blank or **Reconciliation required**.
5. Read back Sheet cells and effective values. Compare the site's selected month and broker filter to the Sheet. Advance `Last reconciled official month` only when both original statements and calculated rows agree. Record preliminary gaps.
6. Repeat import against a copy or verify hash/ID keys and row counts; a second run must add no source facts. Do not append duplicate month rows. Update `Workflow Status` with the verified month, missing statements, error, and next action.
7. Notify through an already authorized Codex task only for a newly reconciled month, a specific statement request, or an actionable failure. Do not send email without separate authorization.

## Schedules and recovery

- `webull-hk-account-archive`: daily local Webull API/archive/import/Sheet sync; requires local protected credentials and its runner.
- `ibkr-daily-sheet-sync`: weekday IBKR current API → Sheet. Its monthly catch-up step may retrieve missing Flex XML, upload only new reports to the private IBKR Drive folder, and reconcile source IDs/NAV before changing historical Sheet rows. A failed Flex or PDF step must not block a valid current snapshot update. Check the task's actual prompt and last result.
- Windows Task Scheduler `Investment IBKR Flex catch-up` runs daily at 10:15 local time and at Windows logon. A real task run succeeded after switching from an inaccessible local DPAPI file to the local Windows Credential Manager. It retries only missing closed months and treats IBKR error 1003 as pending, not a successful report. The Codex task at 10:45 reads its checkpoint and must not redownload the same month that day. The computer must run Windows for the task to execute; missed runs catch up at logon. A Flex token expires within one year and must then be renewed through IBKR.
- `investment-month-end-preview`: monthly preliminary estimate; check its actual ACTIVE/PAUSED state. Official statements supersede estimates. Activate or alter only after source and idempotency checks.
- `monthly-portfolio-social-cards`: separate report; leave it alone.
- The public website reads private Sheet data only through Google OAuth. Its former encrypted website backups have been removed.
- On failure, preserve source documents and verified rows. Record failed step, source date, and next action in `Workflow Status`. After months away, repeat this checklist and catch up in order, independent of chat memory.

## Security

Use private Drive and Sheet for brokerage data. Keep website OAuth `spreadsheets.readonly`. Never commit credentials, raw exports, or financial totals to public GitHub. Read back every Sheet or schedule change.
