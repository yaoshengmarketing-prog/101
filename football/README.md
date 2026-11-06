# 足球當季資料頁試行（五大聯賽）

2026-11-05 更新。正式足球入口為[英超總覽與五聯賽切換](https://yaoshengmarketing-prog.github.io/101/football/)；西甲、義甲、德甲、法甲各有 `/football/leagues/{聯賽 ID}/` 每日總覽及 `game.html?id={ESPN event ID}` 固定單場。原英超 `/football/` 與 `/football/game.html?id=...` 網址保留。先前的[每聯賽一場固定候選](https://yaoshengmarketing-prog.github.io/101/football/five-leagues-preview/)仍供研究比較，並非當期資料。

## 取數與發布

五聯賽共用 `football/scripts/football-leagues.mjs` 的聯賽、國內盃賽、歐戰、近五場、14 日用人與賽前 90／30 分鐘設定。各隊近五場只取所屬聯賽，近期用人查已接入的跨賽事來源。每聯賽重建台灣昨天至後天的賽程；空窗時顯示該聯賽下一個賽事日。

```sh
node --test football/scripts/test-football.mjs football/scripts/test-football-page.mjs football/scripts/test-personnel-change.mjs football/scripts/test-five-leagues.mjs cloudflare/live-data-trigger/test-football-trigger.mjs
node football/scripts/build-five-leagues.mjs --out .football-build/data
```

英超 JSON 保留 `football/data/`，其他聯賽在 `football/data/leagues/{id}/`。同批 `manifest.json` 記錄 GitHub run ID、每聯賽賽事 ID、請求數、耗時與資料時間。單一聯賽建置失敗時發布該聯賽的失敗狀態，其他聯賽仍可讀；頁面先讀各自的狀態，逾期或失敗不回退舊資料。

`.github/workflows/football-data.yml` 在程式 push、手動觸發及每日台灣約 06:07／18:07 的 GitHub schedule 重建。另每半小時檢查賽前 90／30 分鐘時窗。Cloudflare `live-data-trigger` 的足球分支在 UTC 08:00–22:45 每 15 分鐘輕量檢查五聯賽，同一時點的聯賽與賽事 ID 合併派送一次 workflow。觸發、run、公開批次可用[足球觸發紀錄](https://live-data-trigger.yaosheng-marketing.workers.dev/football-log)、Actions 與公開 `manifest.json` 對照。輕量來源失敗只記錄，不撤下有效快照；完整重建失敗顯示明確失敗狀態。棒球更新分支維持原設定。

每次完整重建的兩天 artifact 供 Pages 部署及短期查核；例行球賽 JSON 不寫入 Git，也不建立長期球賽資料庫。成功快照 18 小時後於頁面標示逾期。台彩維持人工核對的一次官方賠率快照：比賽配對通過才呈現賽事編號、玩法、門檻、賠率、取得時間與[官方入口](https://www-talo-ssb-pr.sportslottery.com.tw/daily-coupons)；未取得留空，不追價。來源列出 11 名先發不代表替補完整；未列名單不推斷傷停或輪休。xG 缺值照實標示。

## 首次五聯賽正式批次

[push run 42004303798](https://github.com/yaoshengmarketing-prog/101/actions/runs/42004303798) 在台灣 2026-11-05 17:40 取數，五聯賽共 16 場（英 4、西 3、義 3、德 5、法 1）、397 次 HTTP 嘗試，整批建置約 31 秒；QA、Pages 及公開同批賽事 ID／資料時間回查均成功。這是首次正式批次發布。後續 [自然 schedule run 42079526457](https://github.com/yaoshengmarketing-prog/101/actions/runs/42079526457) 與 [run 42148854541](https://github.com/yaoshengmarketing-prog/101/actions/runs/42148854541) 又各自完成五聯賽 35 場的取數、QA、Pages 與公開回查，故**無人固定更新已實跑成功兩次**。兩次實際生成時間分別為台灣 11/6 01:56:57、10:12:52，對照名義固定時點 11/5 18:07、11/6 06:07 有明顯延遲；完整對應與限制見研究 repo `research/football/2026-11-05_五大聯賽正式取數與排程接入.md`。外部賽前 90／30 分鐘真實派送及新增聯賽正式名單仍待各場驗收；實體手機尚未試看。
