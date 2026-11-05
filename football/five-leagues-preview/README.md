# 五大聯賽可操作研究候選

[候選總覽](https://yaoshengmarketing-prog.github.io/101/football/five-leagues-preview/)切換英超目前頁與西甲、義甲、德甲、法甲固定樣本。四個新聯賽各有一場固定 ID 單場，共用正式足球的比分、射門／射正、近五場、近 14 日跨賽事用人、人員比較及比賽背景程式。來源取得時間顯示於每頁。此處資料固定供複核，不是正式更新、即時名單或長期球賽資料庫。

## 設定與重跑

- `football/scripts/football-leagues.mjs` 管理五個聯賽、各國盃賽、歐冠／歐聯／歐協、正式啟用集合與賽前 90／30 分鐘條件。`LIVE_LEAGUE_IDS` 目前只含 `eng.1`。
- `build-football.mjs` 預設仍跑英超。候選使用 `--league <league> --event <id> --single --out .football-build/five/<league>/data` 各跑一場；`prepare-five-leagues-preview.mjs` 核對聯賽、ID、同批時間，再複製四份固定輸出並產生入口。`qa-football.mjs` 依目標聯賽核對近五場與跨賽事來源。
- `football-due.mjs` 與 Cloudflare Worker 的**候選代碼**共用啟用集合及時窗。`verify-five-leagues-due.mjs` 只讀 ESPN 真實賽程驗證四聯賽 90／30 分鐘窗，不派送 Actions；結果在 `trigger-check.json`。現行 GitHub workflow 與已部署 Worker 仍只檢查英超，新增聯賽正式啟用須同時切換取數、GitHub 閘門、外部 Worker 與部署方式，並做無人操作到公開頁的實跑。

## 2026-11-05 台灣時間取數

| 候選 | ESPN ID | HTTP 嘗試 | 耗時 | 近五場比分／射門完整 | 近 14 日兩隊場數 |
|---|---:|---:|---:|---:|---:|
| 西甲 Racing Santander @ Málaga | 401882812 | 35 | 3.197 秒 | 10/10 | 3＋2 |
| 義甲 Frosinone @ Cagliari | 401874791 | 33 | 3.224 秒 | 10/10 | 2＋3 |
| 德甲 SV Elversberg @ Borussia Dortmund | 401884745 | 36 | 3.269 秒 | 10/10 | 4＋2 |
| 法甲 Paris FC @ AJ Auxerre | 401876411 | 33 | 2.917 秒 | 10/10 | 2＋2 |

四場共 137 次 HTTP 嘗試、0 筆來源錯誤；四場名單皆尚未公布，故人員比較不可判，台彩快照皆未取得。西甲的 14 日用人有國王盃，德甲有德國盃與歐冠；義甲、法甲樣本的 14 日場次只有所屬聯賽。法國盃端點查詢成功但本季這兩隊尚無賽程回應，不能把空清單說成已有盃賽覆蓋。

此為一次性取數結果，不能證明來源持續穩定。原有英超以相同新版 builder 回歸試跑 4 場、99 次 HTTP、0 錯誤，QA 通過；正式英超發布流程維持原設定。實體手機及新增聯賽的正式無人排程尚未驗證。
