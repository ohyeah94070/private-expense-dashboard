# 開支羅盤

GitHub Pages 靜態網站，登入後直接以 Google Sheets API 讀取私人試算表。GitHub 儲存庫只包含程式碼，不包含財務資料、OAuth 權杖或 Google 密鑰。

## 啟用

1. 在 Google Cloud 專案啟用 Google Sheets API，設定 OAuth 同意畫面，建立 **Web application** 類型的 OAuth Client ID。
2. 將 `https://ohyeah94070.github.io` 加入 **Authorized JavaScript origins**。若用自訂網域，也需加入該網域的 origin。
3. 把本資料夾內容放入單獨的 GitHub 儲存庫，在 Settings → Pages 選擇從主分支根目錄發佈。
4. 開啟網站，貼上 Client ID 和試算表 ID（試算表網址 `/d/` 與 `/edit` 中間的字串），使用有這份私人試算表權限的 Google 帳戶連線。

Client ID 和試算表 ID 只保存在目前瀏覽器的 localStorage。Google access token 只存在記憶體，關閉或重新載入頁面後需重新授權。登入採用 `spreadsheets.readonly` 唯讀權限。

**隱私：** GitHub Pages 網站本身可被任何人載入；前端密碼只能擋住隨手瀏覽，無法充當真正的存取控制。實際財務資料仍由 Google 帳戶權限保護。不要把試算表分享設為「知道連結的任何人」。

目前網站呈現 `Stmt` 的對帳結果、`Budget` 的預算，以及匯率表的更新狀態。`Stmt` 的花費是結餘推算值，並非逐筆消費清單。
