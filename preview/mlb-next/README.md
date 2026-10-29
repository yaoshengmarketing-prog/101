# 運彩101 MLB 新版：賽事入口＋單場研究首輪版型草案

**狀態：討論稿，未核准正式版。** 這是獨立靜態預覽，不修改 `/live/`、正式資料、排程或網域。

## 直接開啟

- [賽事入口](./index.html)
- [近期無賽](./index.html?view=quiet)
- [單場賽前](./game.html?mode=pre)
- [單場賽後](./game.html?mode=post)
- [預估打線版型測試](./game.html?mode=pre&state=projection)
- [部分未取得版型測試](./game.html?mode=pre&state=partial)
- [新季零樣本版型測試](./game.html?mode=pre&state=new)
- [開季少樣本版型測試](./game.html?mode=pre&state=small)
- [官方九棒已公布、本季尚無成績測試](./game.html?mode=pre&state=official_empty)

## 資料界線

真實示例是 2026-10-29 台灣時間的 MLB 世界大賽第 5 戰，gamePk 849799，固定取自 `yaoshengmarketing-prog/101` commit `72070a33db4e5bd51ec2763cdcdfbea77368cd79` 的 `live/data` 檔。來源檔和欄位核對見 Private workspace 的 `design/baseball/MLB_新版入口單場版型_首輪草案_20261030.md`。本預覽將所需欄位抽成 `fixture.js`，不在瀏覽時讀取即時資料。

`state=projection`、`partial`、`new`、`small`、`official_empty` 都是**人工版型測試**；測試姓名、缺值、新季狀態不代表真實賽事，不進正式資料或研究樣本。預估打線沒有複製第三方名單。「有賽事」入口是用已保存的 2026 賽前欄位重建閱讀示例，不是當時整頁快照，也不是今天的賽程；「近期無賽」是人工情境測試。開季少樣本模式的 OPS、ERA、WHIP、打席與局數及「有效 0」都是有計算基礎的人工測試數值，放在 `fixture.js` 的 `testOnly`，不進正式資料。首頁最近完賽列表中，只有 gamePk 849799 使用本獨立單場草案，其餘列到既有 `/live/` 頁面。

開啟 `index.html` 即可本機瀏覽；GitHub Pages 公開後也可直接由網址開啟。

## 對照與下季建議

沿用目前 `/live/` 的配色、頁首、標籤、客隊在左／主隊在右的比較方式。新季尚無例行賽紀錄時顯示「尚無」，少量局數與打席連同可計算的 OPS、ERA、WHIP 呈現並註記樣本少；本季完全無紀錄時先露出一行「2026 例行賽參考」，完整上季資料再收合，不冒充新季。春訓另列，不混入例行賽。區塊／欄位／來源及 V1.2.1 與 `/live/` 的實作差異見 Private workspace 主文件。


牛棚依原檔 `window.full` 顯示美國賽程日 10/25–10/27；`window.today` 10/28 另列。第一層列前三日總用球與主要承擔者，展開可看逐投手每日用球。打線直接列 1–9 棒，更多成績、來源對照和上一場參考收合；對位與歷史案例等未完成的預覽仍留入口與「預覽待補」註記。
