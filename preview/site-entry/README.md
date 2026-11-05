# 運彩 101｜全站入口與共用導覽候選

獨立設計候選，不取代根目錄 V1.2.1 原型、正式 `/live/` 或足球試營運。頁面只讀同一 GitHub Pages 網站已公開的 `live/data/manifest.json`、`live/data/status.json`、當日賽程，以及足球短期 `football/data/status.json`、`football/data/overview.json`。沒有新供應商請求、排程、盤口、勝負預測或公開原始資料下載。

## 閱讀路徑

- 首頁 `index.html` → MLB `sport.html?sport=mlb` → 現有 `/live/game.html?pk=...` 的導覽候選包裝頁 `read.html?sport=mlb&pk=...`。
- 首頁 `index.html` → 足球 `sport.html?sport=football` → 現有 `/football/game.html?id=...` 的導覽候選包裝頁 `read.html?sport=football&id=...`。
- 共用導覽只存在候選頁。單場由同源 iframe 顯示原有公開頁面，不複製或改寫其資料處理；若內嵌不可用，可按「原頁直接開啟」。正式整合時，需另決定是否將共用導覽放入兩條原頁，並確認使用條件。

## 資料界線

- MLB 近期沒有已知賽事時，只顯示休賽狀態及 `manifest.recent` 已保存的真實完賽入口；2027 人工試跑不列入。
- 足球快照狀態若為 failed、逾期或與 overview 版本不一致，就不列場次；單場缺失不阻擋其他有效場次。總覽未提供比分時不補猜。
- 時間明標台灣時間；首頁標示各來源本次取得時間。資料會依既有公開輸出改變，因此固定網址固定的是候選程式版本，頁面資料仍以顯示的取得時間為準。
- MLB 今天／明天逐日核對清單日期、日期檔版本與場數；缺一日保留已讀場次並標缺口，兩日核對且流程狀態成功才顯示「已確認無賽」。單場內的返回連結在候選包裝頁指向相同運動的候選列表與場次位置。

## 候選檢查

`node test-site.mjs` 使用離線輸入驗證零場、舊日期、日期檔失敗、部分取得、流程狀態缺失與失敗，不發出網路請求。

## 範圍

只有 `preview/site-entry/` 的候選程式與必要靜態發布。根目錄、`/live/`、`/football/`、資料、Actions、Cloudflare、排程與網域不變。足球獨立工作繼續。

