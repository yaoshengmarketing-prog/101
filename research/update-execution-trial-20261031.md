# 更新決策與既有試跑執行串接

人工 2027 同一 gamePk 離線輸入；使用既有處理函式，沒有外部 HTTP、排程或正式資料寫入。模組函式呼叫次數不是 HTTP 請求量或供應商帳單。

本演練實際函式呼叫：build-live.build 9 次、bullpen.buildBullpen 1 次、ctx.compute 5 次、matchup.buildMatchup 5 次、ctx.decide（凍結／沿用） 3 次、post.summarizePost 2 次。

| 輪次／時間 UTC | 來源版 | 規劃後實際呼叫 | 失敗 | 已完成版及變化 | 對位與情境 |
|---|---|---|---|---|---|
| no_lineup 2027-04-20T15:00:00Z | game g1、lineup —、stats s1（available）、post — | build-live.build、bullpen.buildBullpen、ctx.compute | 無 | game g1／lineup —／roster —／stats s1／bullpen u1／post —；變化 schedule:—→g1、stats:—→s1、bullpen:—→u1 | 對位 unavailable（最後成功 無）；本輪情境輸入變動 dh,bp_load,bp_streak,whip,l10,rpg,rapg,ops,home（最後成功 2027-04-20T15:00:00Z） |
| official 2027-04-20T20:00:00Z | game g1、lineup l1、stats s1（available）、post — | build-live.build、matchup.buildMatchup | 無 | game g1／lineup l1／roster l1／stats s1／bullpen u1／post —；變化 lineup:—→l1、roster:—→l1 | 對位 current（最後成功 2027-04-20T20:00:00Z）；本輪情境輸入變動 無（最後成功 2027-04-20T15:00:00Z） |
| recalc_failed 2027-04-20T21:50:00Z | game g2、lineup l2、stats s1（available）、post — | build-live.build、matchup.buildMatchup、ctx.compute | matchup.buildMatchup：人工模擬：新版本對位來源重算失敗 | game g2／lineup l2／roster l2／stats s1／bullpen u1／post —；變化 schedule:g1→g2、lineup:l1→l2、roster:l1→l2 | 對位 stale（最後成功 2027-04-20T20:00:00Z）；本輪情境輸入變動 dh,whip（最後成功 2027-04-20T21:50:00Z） |
| recalc_ok 2027-04-20T22:10:00Z | game g2、lineup l2、stats s1（unchanged）、post — | matchup.buildMatchup | 無 | game g2／lineup l2／roster l2／stats s1／bullpen u1／post —；變化 無 | 對位 current（最後成功 2027-04-20T22:10:00Z）；本輪情境輸入變動 無（最後成功 2027-04-20T21:50:00Z） |
| stat_update 2027-04-20T22:15:00Z | game g2、lineup l2、stats s2（available）、post — | build-live.build、matchup.buildMatchup、ctx.compute | 無 | game g2／lineup l2／roster l2／stats s2／bullpen u1／post —；變化 stats:s1→s2 | 對位 current（最後成功 2027-04-20T22:15:00Z）；本輪情境輸入變動 whip,l10,rpg,rapg,ops,home（最後成功 2027-04-20T22:15:00Z） |
| same_version 2027-04-20T22:20:00Z | game g2、lineup l2、stats s2（unchanged）、post — | 無；同版沿用 | 無 | game g2／lineup l2／roster l2／stats s2／bullpen u1／post —；變化 無 | 對位 current（最後成功 2027-04-20T22:15:00Z）；本輪情境輸入變動 無（最後成功 2027-04-20T22:15:00Z） |
| stat_failed 2027-04-20T22:25:00Z | game g2、lineup l2、stats s3（failed）、post — | build-live.build、ctx.compute | build-live.team hitting：人工測試：s3 團隊打擊資料處理失敗 | game g2／lineup l2／roster l2／stats s2／bullpen u1／post —；變化 無 | 對位 current（最後成功 2027-04-20T22:15:00Z）；本輪情境輸入變動 whip,l10,rpg,rapg,home（最後成功 2027-04-20T22:25:00Z） |
| stat_recovered 2027-04-20T22:30:00Z | game g2、lineup l2、stats s3（unchanged）、post — | build-live.build、matchup.buildMatchup、ctx.compute | 無 | game g2／lineup l2／roster l2／stats s3／bullpen u1／post —；變化 stats:s2→s3 | 對位 current（最後成功 2027-04-20T22:30:00Z）；本輪情境輸入變動 ops（最後成功 2027-04-20T22:30:00Z） |
| live 2027-04-20T23:35:00Z | game g3、lineup l2、stats s3（available）、post — | build-live.build、ctx.decide（凍結／沿用） | 無 | game g3／lineup l2／roster l2／stats s3／bullpen u1／post —；變化 schedule:g2→g3 | 對位 current（最後成功 2027-04-20T22:30:00Z）；本輪情境輸入變動 無（最後成功 2027-04-20T22:30:00Z） |
| final_partial 2027-04-21T03:10:00Z | game g4、lineup l2、stats s3（available）、post p1 | build-live.build、ctx.decide（凍結／沿用）、post.summarizePost | 無 | game g4／lineup l2／roster l2／stats s3／bullpen u1／post p1；變化 schedule:g3→g4、post:—→p1 | 對位 current（最後成功 2027-04-20T22:30:00Z）；本輪情境輸入變動 無（最後成功 2027-04-20T22:30:00Z） |
| final_complete 2027-04-21T03:35:00Z | game g5、lineup l2、stats s3（available）、post p2 | build-live.build、ctx.decide（凍結／沿用）、post.summarizePost | 無 | game g5／lineup l2／roster l2／stats s3／bullpen u1／post p2；變化 schedule:g4→g5、post:p1→p2 | 對位 current（最後成功 2027-04-20T22:30:00Z）；本輪情境輸入變動 無（最後成功 2027-04-20T22:30:00Z） |

賽前情境 checks SHA-256：開賽凍結 3b9a5c17b3812fe53386658f13ab54069b33d6692ab63c24d1da826a7bda8ff1；賽後完整 3b9a5c17b3812fe53386658f13ab54069b33d6692ab63c24d1da826a7bda8ff1。兩者相同；完整逐輪指紋在同目錄 JSON。

## 查核重點

- `recalc_failed` 的新先發／九棒已進單場資料，但 matchup 舊版與最後成功時間保留；既有 `matchupState` 標 stale，不能當新對位。`recalc_ok` 用相同版本恢復後才提交新指紋。
- `stat_update` 先讓 build-live 成功處理新統計版，同輪再次規劃才准 matchup 與 OPS／WHIP／戰績相依情境使用它；六條統計相依條件重算，兩條牛棚條件沿用。`same_version` 沒有模組函式呼叫。
- `stat_failed` 的 s3 來源處理失敗，已完成版仍為 s2；舊對位的 current 僅指對已完成 s2 與已保存名單仍適用，並非 s3 已成功。最後成功時間照列。`stat_recovered` 的來源內容即使標 unchanged，s3 仍會補處理。
- `live` 凍結最後成功賽前內容；Final 的逐局未齊與完整分兩輪，post 另存，不改對位與賽前情境版本。
- 情境範圍直接取 `ctx.CHECKS` 九條；跨 S／R 或牛棚缺值時僅 `bp_load`、`bp_streak` 暫不判定，其餘條件按各自相依輸入。規則門檻沒有變。

## 待供應商確認

正式 feed 的版本／更新事件、可用時間、額度、重試與授權、可重用期限及費用；這些尚未由人工離線回應證明。

## 局部失敗與跨程序重啟（同一獨立分支）

沿用 11 輪正常流程，另用同一 gamePk 增加 4 個人工回應輪次；逐輪輸入、已完成版本、失敗及情境指紋在同名 JSON 的 `partial.rounds`。`build-live` 先在候選 state 複本執行，再按 `errors` 與單場 `failed` 分別提交賽程、官方九棒／名單、投手、戰績、團隊 OPS／ERA、打者資料；局部錯誤不丟棄成功取得的其他欄位。

| 人工情況 | 失敗時已完成版 | 保留與標記 | 來源恢復後 |
|---|---|---|---|
| 本場 boxscore 失敗，其他查詢成功 | 賽程 g1、成績 s1；官方九棒／名單仍無完成版 | 單場 `failed.lineup` 和來源 `failed`；未推進九棒／名單最後成功時間 | 同一 l1 標 `unchanged`，重新處理後九棒與名單才成為 l1 |
| 先發成績查詢失敗，團隊打擊成功 | 成績整組仍 s3；投手分項仍 s3，團隊 OPS 分項已 s4 | 投手舊值附 `failed.sp`、原取得時間；WHIP 情境等待投手，OPS 可更新 | s4 標 `unchanged`，投手補成 s4，整組成績才成為 s4，對位依新成功資料重算 |

測試專用目錄每輪寫入一份帶 SHA-256 的完整 JSON checkpoint，把輸出與完成標記放同一檔；啟動新 Node 程序時讀最新有效檔，若最新檔截斷則回退上一份。測試也拒絕「有完成標記但沒有單場輸出」的候選檔，原 checkpoint 保持可讀。

- 在 `pitchers_failed` 後停止程序、另啟程序恢復：s4 仍待補；恢復後與不中斷的 15 輪最終有效資料、各完成版及凍結內容一致。最終賽程 g5、名單 l2、成績 s4、賽後 p2。
- 在 `live` 凍結後停止、另啟程序恢復：賽前凍結內容與不中斷的 11 輪一致，後續只補 p1／p2；最終賽程 g5、名單 l2、成績 s3、賽後 p2。兩條流程都只對同一 gamePk 留一筆研究樣本。
- 呼叫模組的次數只代表離線函式執行，不能推成 HTTP 請求或供應商帳單。checkpoint 僅供測試，尚未驗證真實來源的版本語意、可用時機、停機復原環境與授權。

