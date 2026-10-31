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
- IBKR current API → `IBKR Snapshot` and `Positions`. Historical `Trades` and `Cash Ledger` come from Flex or Activity Statements; daily sync does not refresh them.
- Webull OpenAPI → private Drive archive, local database, `Webull Current`, and `Webull Executions`. Official `Webull Monthly` and `Webull Holdings` require checked statements when the API omits history.
- `Monthly Summary` is IBKR monthly source. `Monthly Valuation`, `Monthly Results`, `Broker Reconciliation`, `Funding Detail`, `Stock P&L Detail`, `Portfolio Home`, and `Month-End Estimate` are existing calculation/display tabs. Read formulas before editing.

## Monthly catch-up

1. Read `Workflow Status`, month rows, private Drive statement dates, API as-of times, and automation definitions. List missing months. Confirm both official statements before calling a month official.
2. Run the existing Webull archive/import/reconcile path. Deduplicate statements by hash and executions by ID. Verify counts and monthly totals. Without a PDF, keep the API month-end estimate **Preliminary** with observation times and unverified funding.
3. Fetch IBKR current API data; check NAV against equity plus cash and position market values. Use the Activity Statement for historical month-end. Preserve verified cost basis when API cost differs, and flag it.
4. Check each broker's statement NAV, cash, positions, trades, dividends, taxes, fees, and external funding against source rows. Then check combined NAV = IBKR NAV + Webull NAV; combined P/L = ending NAV − beginning NAV − external net funding. Internal transfers cancel. A buy is not loss; sale proceeds are not realized profit. Missing values stay blank or **Reconciliation required**.
5. Read back Sheet cells and effective values. Compare the site's selected month and broker filter to the Sheet. Advance `Last reconciled official month` only when both original statements and calculated rows agree. Record preliminary gaps.
6. Repeat import against a copy or verify hash/ID keys and row counts; a second run must add no source facts. Do not append duplicate month rows. Update `Workflow Status` with the verified month, missing statements, error, and next action.
7. Notify through an already authorized Codex task only for a newly reconciled month, a specific statement request, or an actionable failure. Do not send email without separate authorization.

## Schedules and recovery

- `webull-hk-account-archive`: daily local Webull API/archive/import/Sheet sync; requires local protected credentials and its runner.
- `ibkr-daily-sheet-sync`: weekday IBKR current API → Sheet; does not settle historical months.
- `investment-month-end-preview`: monthly preliminary estimate; check its actual ACTIVE/PAUSED state. Official statements supersede estimates. Activate or alter only after source and idempotency checks.
- `monthly-portfolio-social-cards`: separate report; leave it alone.
- Expense GitHub Actions `daily-snapshot.yml` is not this investment update. Verify any investment encrypted backup separately; an old prompt does not prove a backup exists.
- On failure, preserve source documents and verified rows. Record failed step, source date, and next action in `Workflow Status`. After months away, repeat this checklist and catch up in order, independent of chat memory.

## Security

Use private Drive and Sheet for brokerage data. Keep website OAuth `spreadsheets.readonly`. Never commit credentials, recovery keys, raw exports, or financial totals to public GitHub. Read back every Sheet or schedule change.
