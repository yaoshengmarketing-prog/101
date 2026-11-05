# 賽前人員變化：可操作候選

開啟 `https://yaoshengmarketing-prog.github.io/101/football/personnel-preview/`。預設熱刺對水晶宮（ESPN `401878761`），頁首可切換利物浦對阿森納（`401879246`）。點球隊卡片展開前一場賽事、雙向角色轉換、本場已列先發與替補，再收合回原位置。這是歷史資料研究候選，不是正式單場頁或即時名單。

計算在 `football/scripts/personnel-change.mjs`，由既有 `build-football.mjs` 在每場 `teamData[teamId].personnelChange` 產生。比較對象是目標開球前近 14 日、六個既有賽事來源中最後一場已完賽的比賽；先確認六個賽程來源均已取得。前場與本場各需列出 11 名不重複 ID 的先發。依 ESPN 球員 ID 比對沿用人數；只把確實在另一場來源名單列出者標成「先發轉替補」或「替補轉先發」。替補名單完整性仍未證實，因此未列名單不推斷傷病、輪休、停賽，也不列為角色轉換。

`data/` 的兩份 JSON 是 `node football/scripts/make-personnel-preview.mjs <ESPN ID>` 以 ESPN 既有賽程／summary 正規化流程於台灣 2026-11-05 回讀的歷史名單研究樣本，供候選固定呈現，不參與正式足球更新。熱刺樣本的 `10/11`、Maddison 與 Solanke 角色，另與研究 repo 記錄的賽前固定 run `41222385143` 核對；本候選沒有接入球會公告原因。利物浦對阿森納用相同計算規則，前一場各自是聯賽盃。

驗證：`node --test football/scripts/test-personnel-change.mjs football/scripts/test-football.mjs`。完整取數另於台灣 11/5 對當期英超重跑到暫存目錄，4 場、99 次來源檢查、0 錯誤；未公布正式名單的場次兩隊均輸出 `target_lineup_unavailable`、`continued=null`、轉換清單為空。暫存資料已移除。正式 `football/game.html`、台彩快照、排程與棒球流程均未修改。
