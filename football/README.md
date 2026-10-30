# 足球當季取數試作（英超）

2026-10-30。研究試作；尚非正式採用或自動排程上線。與 `/live/` MLB 路徑分開。

## 開啟

- 每日英超總覽：`/101/football/`
- 本包單場頁：`/101/football/game.html`
- 原始碼固定版本以交付 commit 為準。GitHub Pages 可直接開；GitHub 檔案檢視頁只顯示原始碼。

## 重跑

在 `101` repo 根目錄使用 Node 24（無 npm 依賴）：

```sh
node football/scripts/build-football.mjs --event 401878761 --out football/data
node football/scripts/qa-football.mjs football/data
```

不指定 `--event` 時，從未來賽程選最近尚未開球的英超場次。`football-data.yml` 是獨立的 `workflow_dispatch`，目前沒有 schedule；不調用棒球流程。每次從來源重新組合，來源失敗的欄位寫「本次未取得」與查詢時間，不載入舊版 JSON。

## 資料邊界

- 賽程、英超近五場、近 14 日英超／歐聯／聯賽盃名單與事件：本次由 ESPN 公開賽事資料端點取得。這個端點沒有公開的穩定性承諾；正式營運前仍須確認長期供應與使用條件。
- 台彩：官方網站在本次伺服器讀取回 HTTP 403。頁面不顯示 10/30 早先樣本賠率，也不把 403 解釋成未開盤。另有 JBot 文件化 Token API 可作候選，但本包未取得 Token、未實測，也沒有訂閱。
- xG、未涵蓋賽事、未取得的事件與球員統計保持缺值。角色依每場名單判定；只有在來源完整名單時才標「未列名單」。
- `.football-build/` 是工作流程的暫存目錄，單次 job 結束即消失（最多 12 分鐘）。`football/data/` 是目前頁面讀取的一份物化 JSON，下一次成功建置整份覆蓋；Git commit 歷史仍會保留舊版本，因此正式高頻更新前要改成有明確保留期的部署方式。沒有累積查詢用的長期球賽資料庫。

## 這包驗證到哪裡

詳見研究 repo 的本次紀錄。已在不同時間兩次以上本機實抓、通過資料 QA；瀏覽器實際操作與 GitHub Actions 的執行狀態另行記錄，不以程式檢查冒充。
