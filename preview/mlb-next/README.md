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

## 資料界線

真實示例是 2026-10-29 台灣時間的 MLB 世界大賽第 5 戰，gamePk 849799，固定取自 `yaoshengmarketing-prog/101` commit `72070a33db4e5bd51ec2763cdcdfbea77368cd79` 的 `live/data` 檔。來源檔和欄位核對見 Private workspace 的 `design/baseball/MLB_新版入口單場版型_首輪草案_20261030.md`。本預覽將所需欄位抽成 `fixture.js`，不在瀏覽時讀取即時資料。

`state=projection`、`partial`、`new` 都是**人工版型測試**；測試姓名、缺值、新季狀態不代表真實賽事，不進正式資料或研究樣本。預估打線沒有複製第三方名單。首頁最近完賽列表中，只有 gamePk 849799 使用本獨立單場草案，其餘列到既有 `/live/` 頁面。

開啟 `index.html` 即可本機瀏覽；GitHub Pages 公開後也可直接由網址開啟。