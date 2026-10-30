# 足球當季資料頁試行（英超）

2026-10-30 更新。足球總覽、各場固定 ID 單場頁、獨立取數與 Pages 部署已可運作；正式產品採用及長期穩定供應仍待驗證。與 `/live/` 棒球流程分開。

## 開啟與重跑

- [每日英超總覽](https://yaoshengmarketing-prog.github.io/101/football/)
- 單場固定網址：`/101/football/game.html?id={ESPN event ID}`。每次重建依比賽 ID 產出各場 JSON，網址不會被下一場覆寫。
- 在 `101` 根目錄使用 Node 24（無 npm 套件依賴）：

```sh
node --test football/scripts/test-football.mjs football/scripts/test-football-page.mjs
node football/scripts/build-football.mjs --event 401878761 --out .football-build/data
node football/scripts/qa-football.mjs .football-build/data
```

不指定 `--event` 時，重建台灣昨天至後天的已知英超場次；空窗時列下一個賽事日。指定 `--event` 用於明確驗證目標場。單場頁先讀 `status.json`；更新失敗或逾期時不再讀已移除的場次 JSON。

## 自動更新與發布

`.github/workflows/football-data.yml` 在 push、手動觸發及自然排程運作。固定更新時點為台灣約 06:07、18:07；另每半小時做輕量賽程檢查，僅在開球前約 90 或 30 分鐘重建。GitHub 的 schedule 可延遲或漏觸發，因此仍須觀察自然排程紀錄，不能以手動成功代替。賽前加跑會重新查正式名單及賽事狀態，但不重抓台彩賠率。

每次完整重建從 ESPN 取得當季賽程、兩隊近五場英超及近 14 日跨賽事用人，產出各場資料；主工作流的兩天 artifact 供 Pages 部署與短期查核。部署直接以 GitHub Pages Actions 發布整站，保留原有棒球頁面；例行足球 JSON 不提交 Git，也不建立長期球賽資料庫。下次發布覆蓋前次足球快照。成功快照 18 小時後由頁面標逾期；失敗時只發布 `status.json`，不回退舊值。

## 資料邊界

- ESPN 來源涵蓋英超、歐冠、歐聯、歐協、足總盃與聯賽盃已取得的賽程、名單與事件。這些公開端點沒有穩定供應承諾。缺比分不合計總進球；來源列出 11 名先發不代表替補名單完整。
- 本場正式名單分為尚無、已列出、部分列出、本次查詢失敗。先發延續只在相鄰兩場都有 11 名先發時計算。
- 台彩採人工核對後的一次性**官方賠率快照**。只有賽事 ID、主客隊、開球時間、台彩賽事編號、玩法／門檻／賠率及取得時間通過配對檢查才呈現；未取得留空並提供[台彩官方入口](https://www-talo-ssb-pr.sportslottery.com.tw/daily-coupons)。不追蹤賠率變動、不把舊樣本套入新場次。
- xG、未涵蓋賽事與缺少的球員統計維持缺值。台彩大小快照門檻對照歷史比分時，明示並非各場當時盤口。

## 驗證狀態

`site-pages` run 41036738596 已於台灣 2026-10-30 17:53 由 `live-data` 觸發，足球 artifact 下載、全站組合及 Pages 部署成功。足球 workflow 曾由 push／手動觸發並部署；**自然 schedule 觸發及賽前正式名單出現仍須以實際 run 與公開頁驗證**。失敗與逾期的狀態優先讀取邏輯及台灣日期邊界已有自動測試；實體手機尚未試看。
