# Finance Review

Interactive GitHub Pages dashboard for the private “Finance — Expense Review & Improved Reconciliation” Google Sheet. The repository contains code and one encrypted snapshot. No plaintext financial rows, OAuth access tokens, or client secrets are committed.

## Views

- **Overview:** Statement period income, reconciled expense, net worth change, salary less expense, allocation, and selectable snapshot periods.
- **Assets & liabilities:** composition by category, account, or currency; searchable positions with original-currency and HKD balances; change since the previous snapshot.
- **Income & spending:** Statement income and expense figures, net worth change, salary less expense, source income categories, itemized income entries, and individual “Large exp.” entries. The itemized logs can be filtered by reconciliation period or calendar month; account transfers are excluded from income entries.
- **Budget planner:** monthly income, expenses, surplus, category breakdown, and the user-entered “Future One-off Plans” section from the Sheet, searchable and filterable by month, category, and inclusion status. Actual and variance figures display only when present in the Budget Sheet.

The Statement's routine spending is a residual inferred from balances and adjustments. It is not a transaction ledger. Only the “Large exp.” tab contains individual spending entries. Income and expense totals, and all Budget monthly figures, are read from the Sheet's calculated cells rather than recomputed from itemized logs. Suggested expense categories are keyword-based and may need review.

## Connection and privacy

The browser requests `https://www.googleapis.com/auth/spreadsheets.readonly` using Google Identity Services, then calls the Google Sheets API directly. Client ID and spreadsheet ID are saved in the current browser's localStorage; the access token is kept in memory. A new page load requires a fresh token. Only Google accounts with access to the private sheet can read its contents.

GitHub Pages serves public frontend code. A client-side PIN would not protect the financial data and is not included.

## Saved snapshot without Google sign-in

The setup screen can open `snapshot.enc.json` with a separate recovery key when Google sign-in is unavailable. The file contains a point-in-time copy of the Sheet's value ranges, encrypted with AES-256-GCM and a randomly generated 12-letter uppercase recovery key derived through PBKDF2-SHA-256 (600,000 iterations). The key is never committed or stored by the website. The decrypted data and key remain in browser memory only, and Disconnect clears the page. The dashboard displays the authenticated snapshot timestamp so it is never presented as live data.

GitHub Actions refreshes the encrypted snapshot daily at 03:17 HKT. The workflow reads only this private spreadsheet through a dedicated Google service account, encrypts the four value ranges using a fixed recovery key from GitHub Actions secrets, commits the ciphertext, and requests a Pages rebuild. The service account must have Viewer access to this spreadsheet only. `scripts/build-snapshot.mjs` can also rebuild manually from an object containing the `raw` map on standard input; without `EXPENSE_SNAPSHOT_KEY` it generates a new key. Never put plaintext Sheet exports, service-account credentials, or the recovery key in Git.
