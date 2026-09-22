# 設計說明

## 1. 資訊怎麼排

**首頁**只回答一件事：今天有哪些比賽、每場的基本盤是什麼。由上而下：運動分類 → 日期／狀態篩選 → 賽事卡。每張卡固定 5 段：時間與狀態、客隊列、主隊列、三格盤口、狀態標籤＋按鈕。兩隊各佔一列而不是左右並排，因為隊名、戰績、先發投手三樣資訊在 330px 寬的卡片裡左右排會擠。

**單場頁**先給「5 秒就看完」的東西，再往下深入：

1. 頂部卡：對戰、時間、球場、狀態、先發、打線狀態、更新時間（永遠可見的事實）
2. 固定頁內導覽（sticky）
3. 比賽快速總覽（8 列左右對照）
4. 前五局
5. 先發投手（左右兩張卡，每張再分 2026 大聯盟／上一季大聯盟／2026 3A／最近先發）
6. 團隊打擊（Tab：**今日對位**（預設）、本季、近十場、本月、對左投、對右投；今日對位＝客隊列「對主隊先發慣用手」、主隊列「對客隊先發慣用手」）
7. 牛棚（整季 vs 近三日負荷，逐日明細收在 `<details>` 裡）
8. 最近五場
9. 盤口（台彩 vs 國際盤）
10. 簡短觀察（82 字，放在最後）

**左右比較的統一寫法**：每一列都是「客隊值｜項目名（＋小字說明）｜主隊值」。客隊永遠在左、主隊永遠在右，全頁不變，讀者不用每個區塊重新對位。不用粗體或顏色標「較佳的一方」，因為那已經是判斷，不是整理。

## 2. 手機版怎麼處理大量資料

- **左右比較列不改結構**。三欄（值｜項目｜值）在 400px 寬仍放得下，因為值都是短數字。桌機和手機看到同一種列，只是字級縮小。
- **寬表格改成逐列卡片**（`.tbl.stack`）：最近五場、投手近 5 場這種 8 欄表格，手機上每一列變成一張小卡，欄名用 `data-k` 印在數值上方，4 欄一排。這是「重排」不是「縮小」。
- **投手統計格**固定 4 欄一排，數字用窄體字（Barlow Condensed）避免溢出。
- **兩欄區塊**（`.two`）在 720px 以下堆成一欄：先客隊、後主隊。
- **頁內導覽**在手機也 sticky，橫向可捲動。
- 品牌標語在 560px 以下隱藏，頂部只留品牌名和示範標籤。

## 3. 第一層／第二層

| 第一層（一進來就看到） | 第二層（要往下捲或點開） |
|---|---|
| 首頁：時間、兩隊、戰績、先發、三格盤口、打線狀態 | 首頁：狀態提示標籤（牛棚負荷、先發樣本） |
| 單場頁：頂部卡、比賽快速總覽 | 前五局、先發投手細項、打擊 Tab、牛棚逐日明細（收合）、近五場、盤口、觀察 |

判斷標準：不看第二層也能決定「這場要不要研究」的，放第一層。

## 4. 視覺

- 單一強調色（藍 `#1F5E8C`），不用紅綠。狀態標籤用四種中性色塊區分「已確認／預計／示範／資料不足」。
- 數字用 Barlow Condensed（窄體、等寬數字），中文用 Noto Sans TC。字型載不到時退回系統字型。
- 沒有 Banner、沒有大圖。頂部卡是資訊，不是裝飾。
- 支援深色模式（跟隨系統）。

## 5. 目前這一版刻意沒做

- 任何評分、優勢條、預測、推薦方向。
- 近十場打擊拆分、前五局統計、投手主客／對左右打拆分（原型未取得 → 顯示「資料不足」）。
- 國民 @ 老虎以外的單場頁（其他卡片按鈕為「原型未建此場」）。

---

# Mock Data 欄位清單（`data.js`）

## `meta`
| 欄位 | 型別 | 說明 | 未來來源 |
|---|---|---|---|
| snapshotAt | string | 資料快照時間（台北） | 抓取腳本 |
| tz | string | 時區標示 | 固定 |
| sports | string[] | 運動分類 | 固定 |

## `days[]`（首頁）
| 欄位 | 型別 | 說明 | 未來來源 |
|---|---|---|---|
| key / label / date | string | yesterday／today／tomorrow、顯示文字 | 系統日期 |
| games[] | Game[] | 見下 | |

### `Game`
| 欄位 | 型別 | 說明 | 未來來源 |
|---|---|---|---|
| pk | string | 賽事 ID（MLB gamePk） | MLB 官方 schedule |
| time | string | 台灣開賽時間 HH:MM | schedule.gameDate 轉 UTC+8 |
| status | `pre`／`live`／`final` | 比賽狀態 | schedule.status |
| venue | string | 球場 | schedule.venue |
| away / home | Team | 見下 | |
| odds | `{ml:[客,主], rl:[客讓分+賠率, 主讓分+賠率], ou:[盤口,大,小]}`／null | **示範** | 台彩 API |
| lineup | `none`／`partial`／`estimate`／`official`／`late` | 打線狀態（全站統一） | 打線彙整程序 |
| hints | string[] | 小型狀態提示 | 由牛棚／先發資料規則產生 |
| note | string | 雙重賽 G1/G2 等備註 | schedule.doubleHeader |
| hasPage | boolean | 是否有單場頁 | 正式版每場皆 true |

### `Team`（首頁卡片用）
| 欄位 | 說明 | 未來來源 |
|---|---|---|
| ab / name | 縮寫、中文隊名 | 隊名對照表 |
| rec | 戰績 W-L | standings |
| score | 比分（已結束才有） | linescore |
| sp | `{name, hand, wl, era}`／null；wl/era 為 null 表示本季無成績 | people?hydrate=stats(season) |

## `games[pk]`（單場頁，以 gamePk 為 key；`game.html?pk=xxx` 選場，找不到顯示提示）
| 欄位 | 說明 | 未來來源 |
|---|---|---|
| pk, sport, dateLabel, time, startISO, venue, status, updatedAt, lineup（none／partial／estimate／official／late） | 頂部卡與麵包屑（V1.1 起全部由 data.js 渲染，game.html 無寫死內容） | schedule |
| away / home | TeamDetail | |
| odds.tw | `{ml, rl, ou, updated}` **示範** | 台彩 API |
| odds.intl | `{open:{ml,rl,ou}, now:{...}, updated}` **示範** | 國際盤來源待定 |
| note | 簡短觀察（50–100 字） | 人工或生成 |

### `TeamDetail`
| 欄位 | 說明 | 未來來源 |
|---|---|---|
| ab, name, full, rank | 隊名、分區名次 | standings |
| rec, pct, home, road, l10, streak | 戰績拆分 | standings.records.splitRecords |
| rs, ra, gp | 總得分、總失分、場數（平均由前端計算） | standings |
| ops | 團隊 OPS | teams/{id}/stats hitting season |
| bpEra | 牛棚 ERA | teams/{id}/stats pitching sitCodes=rp |
| sp | Pitcher（見下） | |
| hit.{season,l10,month,vl,vr} | `{avg,obp,slg,ops,rpg,hr,so,bb,g}`；整個物件為 null＝資料不足；rpg 為 null＝該拆分無得分 | teams/{id}/stats：season／lastXGames／byDateRange／statSplits |
| bullpen | 見下 | |
| last5[] | `[日期, 主/客, 對手, 比分(本隊-對手), 勝/敗, 先發投手, 總得分, 大小分結果(null=資料不足)]` | schedule + boxscore；大小分需歷史盤口 |

### `Pitcher`
| 欄位 | 說明 | 未來來源 |
|---|---|---|
| name, hand, age | 基本資料 | people |
| mlb2026 | `{wl,era,whip,ip,gs,so,bb,avg}`／null（null＝本季無大聯盟成績） | people stats season |
| mlbLast | 同上＋year：上一個有成績的大聯盟球季 | people stats 逐年回查 |
| aaa2026 | 同上＋team：2026 3A | people stats sportId=11 |
| last5[] | `[日期, 對手, 局數, 被安打, 自責分, 三振, 保送, 用球]` | gameLog（MLB 或 3A） |
| note | 樣本說明文字 | 規則產生 |
| （未取得）主／客、對左／右打 | 顯示「資料不足」 | statSplits sitCodes=h,a,vl,vr |

### `Bullpen`
| 欄位 | 說明 | 未來來源 |
|---|---|---|
| era, whip, avg, kpct, kNote | 整季牛棚（三振率＝三振÷打席，kNote 寫分子/分母） | teams stats pitching sitCodes=rp |
| ip3, arms3, consec, consecNames | 近三日局數、人數、連續兩日登板人數與名單 | 近 3 天 boxscore 彙整 |
| closer, closerY, closerNp | 終結者、昨日是否登板、用球數 | boxscore（saves）＋前一日 boxscore |
| log[] | `[日期, "投手 局數/用球數、..."]` 逐日明細 | boxscore |

---

# V1.1 變更（2026-09-21）
1. 首頁盤口三格全部標隊名：不讓分「WSH 1.85／DET 1.80」、讓分雙方完整「WSH +1.5 1.55／DET -1.5 2.20」、大小「大／小」。
2. 單場頁新增「今日對位」打擊 Tab 並設為預設。
3. 比賽總覽「主場戰績／客場戰績」兩列合併為一列「今日主客場條件」＝客隊客場戰績 vs 主隊主場戰績。
4. 前五局全部資料不足 → 改為收合提示，不進頁內導覽。
5. 先發投手卡預設只顯示核心（2026 大聯盟；無則 2026 3A 季成績），上一季與逐場紀錄收合；最近五場預設顯示近五場勝敗／場均得失分，逐場收合。手機版單場頁高度 7,666 → 4,387 px（−43%）。
6. game.html 移除所有寫死內容，頂部卡、麵包屑、導覽、標題全由 `data.js` 的 `games[pk]` 渲染。

---

# V1.2 變更（2026-09-21）：資訊時效與資料狀態
1. 單場頁新增「預估打線」區塊（雙隊左右並列）：首次發布、最後更新、距開賽（由 `startISO` 每 30 秒計算）、狀態標籤（初步預估／多來源共識／官方確認／臨場異動）、來源共識 n/m、不確定席位數、每個有分歧的棒次列備選球員。
2. 官方確認後：顯示官方確認時間、與原預估相比「n 人員、m 棒次改變」（前端比對 `slots` 計算），異動列以「原預估 ○○」標籤標示；版本變更紀錄收合可展開。臨場異動再多一行「臨場異動時間」與「與官方版相比」。
3. 首頁每張卡：預估打線尚未完整／預估打線已建立／官方打線已確認／臨場異動（`Game.lineup`：none｜partial｜estimate｜official｜late）。
4. 首頁「今天／明天」上方「資料完成度」列：預計先發 n/N、預估打線 n/N、盤口 n/N（示範時標示）、天氣 n/N（`Game.weather`，原型皆 false → 0/N）。
5. 預估永遠帶「預估非官方」標籤；官方／臨場版本為原型示範，由右上「原型預覽：切換狀態」切換，不會混入真實資料。

## V1.2 新增欄位
| 欄位 | 說明 | 未來來源 |
|---|---|---|
| `Game.lineup` | none／partial／estimate／official／late | 打線彙整程序 |
| `Game.weather` | 是否已有天氣 | 天氣 API |
| `games[pk].startISO` | 開賽時間 ISO（含 +08:00） | schedule.gameDate |
| `games[pk].lineups.{away,home}` | `{state, firstAt, updatedAt, sources:{agree,total}, basis, initial, slots[], versions[], preview}` | 打線彙整程序 |
| `initial` | `{at, basis, slots[]}` 初步預估的獨立快照（無 agree／alt） | 第一次建立時凍結 |
| `slots[]` | `{n, name, pos, agree, alt[]}`；`alt` 存在＝該棒次有分歧 | 多來源比對 |
| `versions[]` | `{at, state, note}` | 每次更新追加 |
| `preview.official` | `{confirmedAt, slots[], note}`（原型示範） | MLB boxscore battingOrder |
| `preview.late` | `{at, slots[], note}` 或 null（原型示範） | 官方確認後再比對 |

---

# V1.2.1 正確性修補（2026-09-21）
1. 打線狀態統一：`games[pk].lineup` 改為 `estimate`，全站不再出現 `expected`；首頁卡、單場頂部、打線區標題三處讀同一個值。
2. 初步預估改用獨立快照 `lineups.*.initial`（打序依 9/20 實際打序建立，守位為預估先發守位；Ruiz 上一場為代打 PH，初步預估列 C），切換時不顯示共識比例與備選。概念區分：Previous Lineup＝上一場實際打線（可保留 PH）；Initial Projection＝初步預估打線（用預估正式守位）。畫面顯示的是後者。
3. 示範標示下沉到卡片內：官方確認／臨場異動卡帶「原型示範」＋「此版本為原型示範，非 MLB 官方公布」；預估卡的首次發布、來源共識各帶「原型示範」，並有一行說明備選名單為示範。
4. 手機水平溢出：`.two>*`、`.grid>*`、`.panel` 加 `min-width:0`，國際盤表格外包 `.scrollx`（overflow-x:auto），比較列文字允許斷行。驗收 body.scrollWidth ≤ innerWidth：375／390／430 皆通過（修補前為 585）。
5. 文件：README 狀態值統一為五種；ZIP 與 GitHub 同為扁平目錄；不再列 screenshots。
