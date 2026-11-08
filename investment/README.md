# Investment Dashboard V2

This GitHub Pages directory serves the V2 dashboard at `/investment/`.

The browser uses Google OAuth with the `spreadsheets.readonly` scope. `v2-data.js` reads only the V2 Master Spreadsheet. Market Watch is displayed from its formatted `A:P` values; financial tables use unformatted source values for display conversion.

The site stores no access token or financial dataset. A failed read clears the displayed data. The V1 site can be restored from Git tag `investment-v1-pre-v2-20261108`.

The source tests are maintained in the separate local V2 development directory.
