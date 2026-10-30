# 運彩101 MLB 新版：賽事入口＋單場研究首輪版型草案

**狀態：第一版閱讀草案已成形；仍是獨立預覽，正式版未核准。** 這是獨立靜態預覽，不修改 `/live/`、正式資料、排程或網域。

## 直接開啟

- [賽事入口](./index.html)
- [近期無賽](./index.html?view=quiet)
- [單場賽前](./game.html?mode=pre)
- [單場賽後](./game.html?mode=post)
- [春訓 3/24 完賽回放示例](./spring.html)
- [預估打線版型測試](./game.html?mode=pre&state=projection)
- [部分未取得版型測試](./game.html?mode=pre&state=partial)
- [新季零樣本版型測試](./game.html?mode=pre&state=new)
- [開季少樣本版型測試](./game.html?mode=pre&state=small)
- [官方九棒已公布、本季尚無成績測試](./game.html?mode=pre&state=official_empty)
- [牛棚部分資料未取得測試](./game.html?mode=pre&state=bp_missing)

## 資料界線

真實示例是 2026-10-29 台灣時間的 MLB 世界大賽第 5 戰，gamePk 849799，固定取自 `yaoshengmarketing-prog/101` commit `72070a33db4e5bd51ec2763cdcdfbea77368cd79` 的 `live/data` 檔。來源檔和欄位核對見 Private workspace 的 `design/baseball/MLB_新版入口單場版型_首輪草案_20261030.md`。本預覽將所需欄位抽成 `fixture.js`，不在瀏覽時讀取即時資料。

`state=projection`、`partial`、`new`、`small`、`official_empty`、`bp_missing` 都是**人工版型測試**；測試姓名、缺值、新季狀態不代表真實賽事，不進正式資料或研究樣本。人工預估打線示例沒有複製第三方名單；真實固定案例的來源對照使用已保存的歷史預估版本。「有賽事」入口是用已保存的 2026 賽前欄位重建閱讀示例，不是當時整頁快照，也不是今天的賽程；「近期無賽」是人工情境測試。開季少樣本模式的 OPS、ERA、WHIP、打席與局數及「有效 0」都是有計算基礎的人工測試數值，放在 `fixture.js` 的 `testOnly`，不進正式資料。首頁最近完賽列表中，只有 gamePk 849799 使用本獨立單場草案，其餘列到既有 `/live/` 頁面。

開啟 `index.html` 即可本機瀏覽；GitHub Pages 公開後也可直接由網址開啟。

## 對照與下季建議

沿用目前 `/live/` 的配色、頁首、標籤、客隊在左／主隊在右的比較方式。新季尚無例行賽紀錄時顯示「尚無」，少量局數與打席連同可計算的 OPS、ERA、WHIP 呈現並註記樣本少；本季完全無紀錄時先露出一行「2026 例行賽參考」，完整上季資料再收合，不冒充新季。春訓另列，不混入例行賽。區塊／欄位／來源及 V1.2.1 與 `/live/` 的實作差異見 Private workspace 主文件。


牛棚依原檔 `window.full` 顯示美國賽程日 10/25–10/27；`window.today` 10/28 另列。第一層列前三日總用球與主要承擔者，展開可看逐投手每日用球。打線直接列 1–9 棒及對本場先發手別的 2026 例行賽 OPS／打席；先發投手卡展開顯示對左右打分項與最近三次先發（逐筆標賽別）。更多整體成績、來源對照和上一場參考收合。`bp_missing` 人工拿掉釀酒人 10/27 一名投手的用球，顯示「?」及已取得部分小計，真實案例仍保持 167／219 球。四張情境卡在明細前各用一句列符合總數、例行賽／季後賽數及快照保留的明細數（依序 4、2、10、10 筆，最多最近 10 筆）；門檻只列一次，規則版本、凍結時間與連結性質集中在清單末尾。`ctx.mjs` 仍計算全部符合總數 4、2、26、15 場，明細上限不代表漏存。打線收合層可查上一場實際九棒，以及 RotoWire 預估與 MLB 官方逐棒對照；人選差異和棒次差異分列。RotoGrinders 在此固定檔只有彙總比對，沒有逐棒快照；這是另一項資料缺口，與案例明細十場上限不同。第三方「已確認官方」與臨場異動也沒有可展示的逐棒版本。

前一輪手機打線／對位的固定版本畫面（尚未展開本輪新增的研究內容）見 [`screenshots/mobile-lineup-matchup.jpg`](./screenshots/mobile-lineup-matchup.jpg)。

本輪逐筆案例、上一場與預估來源均抽自固定 commit `72070a3` 的 `live/data/ctx/849799.json`、`live/data/games/849799.json`。案例列中的比分與第 7 局起得分已在 849799 的賽前凍結版本保存；連到 `/live/` 的既有單場頁是目前頁面，不宣稱是該案例當時的賽前快照。

整頁走讀發現瀏覽器返回時會失去展開狀態與原位置；本預覽現以同一次瀏覽的頁面紀錄恢復閱讀位置，賽前／賽後切換也維持在長頁面上方。歷史案例展開後讓頁面自然捲動，避免手機內外兩層捲動。

## 春訓小範圍示例（獨立預覽）

沿用 b034105 的既有首頁及單場閱讀內容；首頁另列「春訓」分區，連至 `spring.html`。固定場為 2026-03-24 美國賽程日 CIN @ MIL（gamePk 832077，`gameType=S`）。`spring-fixture.js` 只保存此示例需要的賽程、原先發九棒、逐局及逐投手實際使用，並記錄本次回查時間與 MLB schedule／boxscore 查詢網址。這是**完賽後回查的歷史資料**，不是當時賽前快照；先發或原九棒的賽前公布／取得時間沒有被證明，2027 來源也未驗證。

春訓情境卡與名單增減標「暫不判定」，不寫未達門檻。春訓投手按球員列局數及用球，不依出場順序推定固定牛棚角色；已取得登板可作近期實際用量閱讀紀錄。依 D41，跨春訓／例行賽視窗的例行賽牛棚差距與連投情境暫不判定。正式 `/live/`、正式資料、排程及統計門檻未變。

## 跨季資料接入離線試跑（獨立分支，未部署）

此段只適用於 `mlb/2027-cross-season-trial` 分支。Pages 目前由 `main` 根目錄發布；本分支沒有自動發布。可下載 [固定離線預覽包](./mlb-cross-season-offline.zip)，解壓縮後直接開啟 `offline-start.html`；以下入口也可在本機靜態伺服器開啟，或由 GitHub 讀取程式輸出：

- [試跑賽事入口](./index.html?trial=opening)、[開幕零樣本](./game.html?trial=opening)
- [春訓銜接](./game.html?trial=transition)、[例行賽休兵日](./game.html?trial=r_off_day)、[部分取數失敗](./game.html?trial=partial_failure)
- [既有 2026 春訓完賽回查](./game.html?trial=spring)
- [程式產出的固定測試檔](./trial-data.js)；重建：`node scripts/cross-season-trial.mjs --write`

以上 2027 賽程、球員、登板是**人工測試輸入**；`cross-season-trial.mjs` 呼叫現有的 `build-live`、`bullpen`、`ctx`、`roster` 邏輯，輸出 `trial-data.js`。`?trial=opening` 與 `?trial=transition` 現由原新版 `app.js` 的首頁、投手、九棒、條件與近期用量區塊直接讀取程式輸出；休兵日、部分失敗、春訓回查仍由診斷用的 `trial-reader.js` 顯示。未帶 `?trial=` 的固定 2026 閱讀模式保持原樣。春訓 832077 取既存 `spring-fixture.js`，性質為完賽後回查。

| 開季缺口 | 這次試跑的結果 | 仍待真實來源驗證 |
| --- | --- | --- |
| 賽季／賽別／完整度 | 遊戲年取 `officialDate`；牛棚逐場保留 S／R、每日日狀態與缺筆；未知賽別不歸季後賽 | 2027 實際賽程、異動與來源時機 |
| 本季統計 | team hitting/pitching、先發、打者要求該場賽季的 R；回應分項再核對 R 與 season；只回 S／其他範圍標「當季例行賽資料未確認」，不標無紀錄；有效 0 保留 | 2027 開幕 API 實際空回應型態；上季參考如何取入獨立欄位 |
| 近期登板／情境 | S 登板保留日期、賽別、投手、局數、球數；跨 S／R 的兩條牛棚情境暫不判定；R 視窗休兵日可判定，部分失敗不判定 | 正式 R 視窗含補賽、延賽的來源完整性 |
| 開幕名單 | 上一場 S 僅列打線參考，不作增減基準；本場名單照列，沒有基準不報增減 0 | 2027 官方名單公布時機與合理基準是否存在 |

**必要來源核對（2026-10-30，MLB Stats API 一次性查詢）：** [Misiorowski 投手本季未指定賽別](https://statsapi.mlb.com/api/v1/people/694819/stats?stats=season&group=pitching&season=2026) 回 `gameType=R`、30 場、174.2 局、ERA 1.80；明指定 `gameType=R` 相同，`gameType=S` 為 3 場、11.2 局、ERA 5.40。[釀酒人團隊打擊](https://statsapi.mlb.com/api/v1/teams/158/stats?stats=season&group=hitting&season=2026) 未指定與 R 均為 162 場、OPS .744，S 為 30 場、OPS .791。團隊投球未指定與 R 均為 162 場、ERA 3.51、1446.2 局，S 為 30 場、ERA 4.83、261.0 局。團隊回應有 season、未必有 gameType，故查詢本身要明指定 R；這只驗證 2026 回應，不證明 2027 賽前可用。

另以程式實際使用的 people hydrate 形式核對：[2026 R](https://statsapi.mlb.com/api/v1/people?personIds=694819&hydrate=stats(group%3D%5Bpitching%5D,type%3D%5Bseason%5D,season%3D2026,gameType%3DR)) 回 `gameType=R`、ERA 1.80／174.2 局；[2026 S](https://statsapi.mlb.com/api/v1/people?personIds=694819&hydrate=stats(group%3D%5Bpitching%5D,type%3D%5Bseason%5D,season%3D2026,gameType%3DS)) 回 `gameType=S`、ERA 5.40／11.2 局。試跑也餵入混有 S／R 分項的人工回應，確認輸出只採 R，少樣本 OPS／ERA／WHIP 附打席或局數，有效 `.000` 不變成缺值。

舊 `live/data/games/849799.json` 在試跑前後均只讀取，SHA-256 記在 `trial-data.js`；本分支不寫 `live/data`、不回算舊情境，也沒有 workflow 或 Pages 設定修改。

統計狀態補正：指定 R 但人員或團隊回應只有 S／其他賽季時，標 `scope_unconfirmed`，只表示未取得可確認的當季 R 成績；正確 R 查詢的空分項才在本次試跑標 `no_record`。人工少樣本案例驗證 `.000` 與 3 打席仍保留。賽別標籤依既有 roster 對照：F＝外卡賽、W＝世界大賽；試跑有直接檢查兩個標籤。

離線包包含 `index.html`、`game.html`、`app.js`、`trial-reader.js`、`trial-data.js`、原固定 2026 與春訓檔、`style.css` 及本說明。它供本機閱讀，不是公開部署。程式輸出與頁面 DOM 內容檢查通過；受目前本機瀏覽器連線限制，**桌機／手機畫面及點擊操作尚未實際驗證**，須在可用瀏覽器開啟離線包後補走讀。
