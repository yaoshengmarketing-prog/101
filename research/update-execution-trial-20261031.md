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

## 局部完成與跨程序接續

原 11 輪保留；同一人工 gamePk 的局部失敗路徑增為 15 輪。`build-live` 在候選 state 複本上執行，依單場 `failed` 與 `R.errors` 分別提交賽程、官方九棒／名單及成績分項。成功取得的欄位保留；失敗欄位不前推完成版與最後成功時間。

| 狀態 | 已完成版本 | 保存狀態 |
|---|---|---|
| 本場 boxscore 失敗 | 賽程 g1、成績 s1；官方九棒／名單未完成 | `failed.lineup` 保留；同一 l1 標 `unchanged` 恢復後才完成九棒／名單 |
| 先發成績失敗 | 整組成績 s3、投手分項 s3；團隊 OPS 分項 s4 | 投手舊值原取得時間 2027-04-20T22:30:00Z 與失敗原因並列；WHIP 等待投手，OPS 可按成功輸入更新 |
| 新程序恢復成功 | 整組成績及投手、OPS 分項均 s4 | s4 即使來源標 `unchanged` 仍補處理，對位依成功版重算 |

測試專用 JSON checkpoint 每輪把輸出與完成標記保存於同一份帶 SHA-256 的檔案；最新檔若截斷，讀取回退上一份有效檔。分別在投手失敗後、開賽凍結後停止，改由新 Node 程序續跑；最終有效資料、完成版與完整賽前保存內容均與不中斷路徑一致。同一 gamePk 仍只保留一筆研究樣本。

## 保存輸出到新版頁面

單一離線入口：`node scripts/update-preview-delivery.mjs --out-dir <測試目錄> --source-commit <本分支 commit>`。它沿用上述人工輸入、既有處理函式與 checkpoint，在投手失敗和開賽凍結後啟動新 Node 程序接續，再以白名單欄位匯出獨立新版首頁／單場頁。`--from-checkpoints <已保存測試目錄>` 可不重跑資料處理，重新產生另一份預覽。每次使用新目錄，匯出不完整不覆蓋上一份可讀版；完整 checkpoint、工作輪次與來源 URL 不進公開頁面資料。

三個畫面狀態取同一 gamePk 9902750 的保存輸出：投手失敗但團隊 OPS s4 可讀；新程序恢復後投手／整組成績 s4 且對位一致；開賽凍結後再重啟並回填完整賽後結果。賽後展開層從獨立 `pregame` 保存物讀賽前先發、九棒、成績、牛棚、對位與情境，不能以 Final 的 `game` 全檔充當賽前。最後成功的賽前保存 SHA-256 為 `2fcd8e32f5392e908779b4bef4160f8eee4de79bb5a8d62b8097d7a96776e0c6`，賽後回看相同。資料取得、成功處理及本輪檢查時間分欄保存；此人工來源即時處理時前兩者可能同刻，重啟／失敗時則不同。

檢查：既有更新規劃器、11／15 輪重啟測試、三狀態資料投影與原新版 HTML 輸出均通過。這仍是人工離線候選版；真實供應商欄位、ID、時效、額度及使用權利未驗證。正式 `/live/`、正式資料、網域、排程及統計門檻均未改。

