# Finance Review

Interactive GitHub Pages dashboard for the private “Finance — Expense Review & Improved Reconciliation” Google Sheet. The repository contains code only. No financial rows, OAuth access tokens, or client secrets are committed.

## Views

- **Overview:** net worth, gross assets, liabilities, reconciled spending, allocation, and selectable snapshot periods.
- **Assets & liabilities:** composition by category, account, or currency; searchable positions with original-currency and HKD balances; change since the previous snapshot.
- **Income & spending:** Statement income and expense figures, source income categories, itemized income entries, and individual “Large exp.” entries. The itemized logs can be filtered by reconciliation period or calendar month; account transfers are excluded from income entries.
- **Budget planner:** monthly income, expenses, surplus, category breakdown, and the user-entered “Future One-off Plans” section from the Sheet, searchable and filterable by month, category, and inclusion status. Actual and variance figures display only when present in the Budget Sheet.

The Statement's routine spending is a residual inferred from balances and adjustments. It is not a transaction ledger. Only the “Large exp.” tab contains individual spending entries. Income and expense totals, and all Budget monthly figures, are read from the Sheet's calculated cells rather than recomputed from itemized logs. Suggested expense categories are keyword-based and may need review.

## Connection and privacy

The browser requests `https://www.googleapis.com/auth/spreadsheets.readonly` using Google Identity Services, then calls the Google Sheets API directly. Client ID and spreadsheet ID are saved in the current browser's localStorage; the access token is kept in memory. A new page load requires a fresh token. Only Google accounts with access to the private sheet can read its contents.

GitHub Pages serves public frontend code. A client-side PIN would not protect the financial data and is not included.

## Saved snapshot without Google sign-in

The setup screen can open `snapshot.enc.json` with a separate recovery key when Google sign-in is unavailable. The file contains a point-in-time copy of the Sheet's value ranges, encrypted with AES-256-GCM and a randomly generated 100-bit recovery key derived through PBKDF2-SHA-256 (600,000 iterations). The key is never committed or stored by the website. The decrypted data and key remain in browser memory only, and Disconnect clears the page. The dashboard displays the authenticated snapshot timestamp so it is never presented as live data.

This snapshot must be refreshed manually from an authorized environment. `scripts/build-snapshot.mjs` accepts an object with a `raw` map of the four required Sheet value ranges on standard input, writes only the encrypted output file, and prints a new recovery key. Rebuilding rotates the key. Never put plaintext Sheet exports or the recovery key in Git.
