# Finance Review

Interactive GitHub Pages dashboard for the private “Finance — Expense Review & Improved Reconciliation” Google Sheet. The repository contains code only. No financial rows, OAuth access tokens, or client secrets are committed.

## Views

- **Overview:** net worth, gross assets, liabilities, reconciled spending, allocation, and selectable snapshot periods.
- **Assets & liabilities:** composition by category, account, or currency; searchable positions with original-currency and HKD balances; change since the previous snapshot.
- **Spending detail:** Statement expense components plus individual “Large exp.” entries, filterable by reconciliation period or calendar month, with searchable descriptions and optional suggested grouping.
- **Budget planner:** monthly income, expenses, surplus, category breakdown, and actual comparison only when a complete month-end to month-end reconciliation exists.

The Statement's routine spending is a residual inferred from balances and adjustments. It is not a transaction ledger. Only the “Large exp.” tab contains individual spending entries. Suggested categories are keyword-based and may need review.

## Connection and privacy

The browser requests `https://www.googleapis.com/auth/spreadsheets.readonly` using Google Identity Services, then calls the Google Sheets API directly. Client ID and spreadsheet ID are saved in the current browser's localStorage; the access token is kept in memory. A new page load requires a fresh token. Only Google accounts with access to the private sheet can read its contents.

GitHub Pages serves public frontend code. A client-side PIN would not protect the financial data and is not included.
