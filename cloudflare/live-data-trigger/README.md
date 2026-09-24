# live-data-trigger（Cloudflare 外部觸發）

目的：把賽前時段（台灣 21:00–11:45）的更新間隔從「GitHub 排程每 30 分鐘、而且常延遲」縮短到排定每 15 分鐘觸發一次。
這個 Worker 只負責定時觸發。抓資料、檢查、寫回 GitHub 仍然全部由 101 的 GitHub Actions（`.github/workflows/live-data.yml`）處理。GitHub 原生排程照舊保留，當作備援。

| 項目 | 內容 |
|---|---|
| Worker | `live-data-trigger`（Cloudflare 帳號 yaosheng-marketing，免費方案） |
| 排程 | `*/15 0-3,13-23 * * *`（UTC）＝台灣 21:00–11:45 每 15 分鐘，每天 60 次 |
| 紀錄 | D1 資料庫 `live-data-trigger-log`，表 `triggers`（`schema.sql`），保留 30 天 |
| 公開紀錄 | https://live-data-trigger.yaosheng-marketing.workers.dev/log（最近 200 筆，不含密鑰） |
| 密鑰 | `GH_TOKEN`：站長自建，只存在 Cloudflare Secret |
| 程式 | `worker.js`；設定紀錄在 `wrangler.toml`（實際部署透過 Cloudflare 儀表板／API） |

## 怎麼對應 Cloudflare 觸發和 GitHub run

- 每次觸發的編號是 `cf <排定時間 UTC>`，例如 `cf 2026-09-24T13:15Z`。這個編號會帶進 workflow_dispatch，所以 GitHub run 的名稱是 `live-data cf 2026-09-24T13:15Z`。
- `/log` 每一列記錄以下欄位：
  - `sent_at`：送出時間
  - `http`：GitHub 回應碼。null 表示沒有回應，或是在送出前就失敗了
  - `ms`：耗時
  - `error`：錯誤內容，包括「逾時（15 秒沒有回應）」「GH_TOKEN 尚未設定」、GitHub 回的錯誤
  - `run_id`：對應的 GitHub run
- 後面的觸發會回頭補查前面觸發的 run 結果，補上 `run_status`、`conclusion`、`run_started_at`、`run_updated_at`。
- `conclusion` 是 `cancelled` 時，通常是排隊中的這次觸發被更新的觸發取代了。這是預期行為，最新那次跑完就夠。
- 101 的 live-data 每次有資料變動時，會把 `/log` 一起存成 `data/cf-trigger-log.json`，所以 GitHub 上也留有紀錄。
- 101 的 live-data 每次開始時也會檢查這份紀錄，時段是台灣 21:40–11:59。出現下面任一情況，就開一則 issue「[live-data] Cloudflare 外部觸發異常」，並 @ 站長：
  - 最近兩次送出都失敗
  - 超過 40 分鐘沒有觸發

  恢復正常後，會自動留言並關閉這則 issue。

判斷外部觸發有沒有成功，請看 `/log` 或 run 名稱裡的 `cf` 編號，不要只看 `event=schedule` 的次數。外部觸發在 GitHub 上顯示的是 `workflow_dispatch`。

## 兩種觸發並存時

- workflow 設有 `concurrency: live-data`：同時只會有一個 run 在跑，最多一個在排隊。新的排隊會取代舊的排隊（舊的顯示 cancelled），所以不保證每個排隊的 run 都會依序跑完。
- 每個 run 都以自己「開始的時間」抓資料，前一個 run 推上去的 commit 也在它 checkout 的範圍內。因此舊資料不會蓋掉新資料，也不會補跑已經過期的檢查。
- 資料沒有變動就不會 commit（`scripts/data-changed.mjs`）。

## GitHub token（站長自己建立，不要貼到對話或 repo）

1. 登入 GitHub，右上角頭像 → **Settings** → 左側最下方 **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**。
2. **Token name**：`live-data-trigger (Cloudflare)`。**Resource owner**：`yaoshengmarketing-prog`。
3. **Expiration**：建議 **90 天**，或自訂一年以內（見下方「有效期限與更換」）。
4. **Repository access**：選 **Only select repositories** → 只勾 `yaoshengmarketing-prog/101`。
5. **Permissions** → **Repository permissions** → **Actions**：**Read and write**。
   - 其他權限一律維持 No access。
   - **Metadata: Read-only** 是 GitHub 自動帶入的必要項目，不用管。
6. **Generate token**，複製畫面上的 token。這個畫面只會出現一次。
7. 到 Cloudflare 儀表板 → **Workers & Pages** → `live-data-trigger` → **Settings** → **Variables and Secrets** → **Add**：
   - **Type**：**Secret**
   - **Variable name**：`GH_TOKEN`
   - **Value**：貼上 token
   - 按 **Deploy**（或 Save）
8. 完成。下一個 15 分鐘整點（台灣 21:00 以後）就會開始觸發，可以到 `/log` 確認 `http` 是 200。

權限說明：Actions 讀寫權限能觸發、取消、重跑這個 repo 的 workflow，也能讀執行紀錄。它不能改程式碼、不能讀 Secrets，也碰不到其他 repo。

## 有效期限與更換

- 到期前，GitHub 會寄信提醒。到期或被撤銷後，送出會回 HTTP 401：
  - `/log` 會看到錯誤；
  - 101 會開「Cloudflare 外部觸發異常」issue。
  - 網站不會停，只是回到 GitHub 原生排程的間隔。
- 更換步驟：
  1. 照上面第 1–6 步建一個新的 token。
  2. 到 Cloudflare 的 `GH_TOKEN` 按 **Edit**，貼上新值後 **Deploy**。
  3. 確認 `/log` 下一次觸發是 200。
  4. 回 GitHub 的 Fine-grained tokens 頁面刪除舊 token。
- 懷疑 token 外洩時，先在 GitHub 刪除舊 token，再做以上更換。

## 費用

全部使用免費額度：

| 項目 | 免費額度 | 本服務用量 |
|---|---|---|
| Workers 請求 | 每天 100,000 次（全帳戶共用，含其他 Pages Functions） | 每天 60 次排程觸發，加上查看 `/log` |
| 每次觸發的外部請求 | 上限 50 | 2（送出 1、補查 1） |
| Cron Trigger | 每個帳號 5 個 | 用 1 個 |
| D1 | 每天讀取 500 萬列、寫入 10 萬列，儲存 5 GB（全帳戶共用） | 每天寫入約 120 列；讀取每次觸發最多約 2,000 列（30 天紀錄全表），每天約 12 萬列 |
| GitHub Actions | 公開 repo 的標準 runner 不收費 | — |

注意：2026-09-24 查到這個 Cloudflare 帳戶的 Workers／Pages 請求，本期（9/1 起）累計 2.08M。以 24 天計，平均每天約 8.7 萬，已經接近每天 10 萬的免費上限（上限由全帳戶共用，大多是其他網站的用量）。每天的明細沒有查到。超過上限的那一天，外部觸發有可能失敗。失敗會記錄在 `/log`，101 也會開 issue。網站仍會靠 GitHub 原生排程繼續更新。
