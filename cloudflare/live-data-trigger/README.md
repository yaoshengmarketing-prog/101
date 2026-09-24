# live-data-trigger（Cloudflare 外部觸發）

目的：把賽前時段（台灣 21:00–11:45）的更新間隔從「GitHub 排程每 30 分鐘、而且常延遲」縮短到排定每 15 分鐘觸發一次。
這個 Worker 只負責定時觸發。抓資料、檢查、寫回 GitHub 仍然全部由 101 的 GitHub Actions（`.github/workflows/live-data.yml`）處理。GitHub 原生排程照舊保留，當作備援。

| 項目 | 內容 |
|---|---|
| Worker | `live-data-trigger`（Cloudflare 帳號 Yaosheng.marketing@gmail.com's Account，帳號 ID `73304c8bf136dd0c432ae88c227c7a40`；該帳號是 Workers 付費方案） |
| 排程 | `*/15 0-3,13-23 * * *`（UTC）＝台灣 21:00–11:45 每 15 分鐘，每天 60 次 |
| 紀錄 | D1 資料庫 `live-data-trigger-log`，表 `triggers`（`schema.sql`），保留 30 天 |
| 公開紀錄 | https://live-data-trigger.yaosheng-marketing.workers.dev/log（最近 200 筆，不含密鑰） |
| 密鑰 | `GH_TOKEN`：站長自建，只存在 Cloudflare Secret |
| 程式 | `worker.js`；設定紀錄在 `wrangler.toml`（實際部署透過 Cloudflare 儀表板 UI，見「設定與交接紀錄」） |

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

2026-09-24 在 Cloudflare 儀表板 → Workers 方案 查證：這個帳號**目前是 Workers 付費方案**（US$5／月＋超額用量）。免費方案那一欄顯示「降級」，付費那一欄顯示「目前方案」。同一天的用量面板顯示「可計費使用量（本期）$0.00，尚未產生可計費使用量」。本服務不需要另外付費。

| 項目 | 付費方案包含 | 本服務用量 |
|---|---|---|
| Workers 請求 | 每月 1,000 萬次，超過每百萬次 US$0.30（全帳戶共用，也包含其他 Pages Functions；帳戶本期 9/1–9/24 累計 2.08M） | 每天 60 次排程觸發，加上查看 `/log` |
| 每次觸發的外部請求 | 上限 10,000 | 2（送出 1、補查 1） |
| Cron Trigger | 每個帳號 250 個 | 用 1 個 |
| D1 | 每月讀取 250 億列、寫入 5,000 萬列（超過另計），儲存 5 GB | 每天寫入約 120 列、讀取約 12 萬列 |
| GitHub Actions | 公開 repo 的標準 runner 不收費 | — |

更正：本檔前一版（commit 3fac71f）寫「接近每天 10 萬次免費上限」。那是誤以為帳號是免費方案，實際上是付費方案，以本段為準。
付費方案在哪裡：Cloudflare 儀表板左側 **運算 → Workers 方案**（https://dash.cloudflare.com/73304c8bf136dd0c432ae88c227c7a40/workers/plans ）；帳單在 **管理帳戶 → 計費**。

## 設定與交接紀錄

以下設定不在 repo 裡，是在 Cloudflare 或 GitHub 網頁上操作的。接手的人照這裡就能找到、核對、重做。

| 日期（台灣） | 誰 | 在哪裡做 | 做了什麼 |
|---|---|---|---|
| 2026-09-24 12:09 | Claude | Cloudflare D1（MCP） | 建立資料庫 `live-data-trigger-log`（id `5d985a28-52f4-4f9a-8831-a46f228365df`，APAC），執行 `schema.sql` 建立 `triggers` 表 |
| 2026-09-24 12:4x | Claude | Cloudflare 儀表板 → Workers 和 Pages → 建立 → 從 Hello World 開始 | 建立 Worker `live-data-trigger`，在「編輯代碼」貼上 `worker.js` 後部署。線上程式碼已用 MCP 讀回，與 repo 一致 |
| 2026-09-24 12:5x | Claude | Worker → 設定 → 繫結 | 新增 D1 繫結：名稱 `DB` → `live-data-trigger-log` |
| 2026-09-24 12:5x | Claude | Worker → 設定 → 觸發事件 → Cron | 新增 `*/15 0-3,13-23 * * *`，部署 |
| 2026-09-24 12:5x | Claude | 驗證 | `/log` 回 200、內容為空表 |
| 2026-09-24 13:2x | 站長 | GitHub → Settings → Developer settings → Fine-grained tokens | 建立 token：只限 `yaoshengmarketing-prog/101`，Actions: Read and write，Metadata: Read-only（必選），**到期日 2027-09-24** |
| 2026-09-24 13:2x | 站長（Claude 開好視窗、填好名稱） | Worker → 設定 → Runtime variables and secrets → 新增變數 | 環境選「生產」，名稱 `GH_TOKEN`，勾選「秘密」，值由站長貼上 → Add variable and deploy。已確認清單顯示「秘密 GH_TOKEN 值已加密」，Cron 與 D1 繫結都還在 |

注意事項：
- Cloudflare 儀表板的寫入 API 從頁面內呼叫一律回 403，所以部署走 UI。以後要更新程式，照同樣方式：Worker →「編輯代碼」→ 全選後貼上 repo 的 `worker.js` → 部署。部署後用 MCP `workers_get_worker_code` 或儀表板確認內容。
- token 的值只存在 Cloudflare Secret，repo 和對話紀錄裡都沒有。token **2027-09-24 到期**，到期前照「有效期限與更換」換新。
- 要暫停外部觸發：Worker → 設定 → 觸發事件，刪除 Cron（或刪除 `GH_TOKEN`）。網站仍會靠 GitHub 原生排程更新。
- 第一次實際觸發排在 2026-09-24 21:00（台灣）。驗證結果寫在 workspace `00_PROJECT_STATUS.md` §9 與 101 的 `data/cf-trigger-log.json`。

### 驗證用的排程檢查（2026-09-24 建立）

| 任務 ID | 觸發時間（台灣） | 執行環境 | 檢查內容 |
|---|---|---|---|
| `trig_019w8pkwJqAimvDwCVXg9bKf` | 2026-09-24 21:20，只跑一次 | Claude 排程任務，Anthropic 雲端；叫醒原對話（session_01BFMsEEsDZQXV92nTu3Sff8）接著執行 | 21:00、21:15 兩次觸發 |
| `trig_01SrAY2SW9tJEabtQYc1KKN7` | 2026-09-24 22:20，只跑一次 | 同上 | 21:00–22:15 共 6 次觸發：統計與延遲；確認有效後才改頁面上的時段文字 |

- 核對順序：Cloudflare 送出 → GitHub run → 資料結果 → 網站更新。
- 用到的工具都在雲端，**不需要站長電腦開著**：
  - Cloudflare D1 MCP：讀 `triggers` 表。Worker 下一次觸發時，會把前一次的 run 狀態和結果回填進來。
  - raw.githubusercontent：讀 `live/data/manifest.json`，只拿來核對網站是否已發布，不用來判斷資料有沒有變動。
  - WebFetch（網址加 `?t=` 避開快取）：讀 Pages 網站的 manifest。
- 站長電腦和 Chrome 只有兩件事會用到，電腦沒開時兩件都延後補做，不影響判讀：
  - 查 GitHub API 各步驟的細節；
  - 把檢查結果上傳回 GitHub。雲端沙箱連不到 api.github.com，也不能寫入 GitHub。
- 判讀方式：
  - 資料有沒有變動，看**該次 run 自己的判定步驟**（workflow `aa21b3f` 起新增）。Worker 補查 run 時會讀這兩個步驟，記進 D1 的 `result` 欄。
  - **成功並提交**：`result=changed`，也就是「判定：資料有變動（提交）」這個步驟是 success。
  - **成功、資料沒變、不需提交**：`result=unchanged`，也就是「判定：資料沒有變動（成功檢查，不提交）」這個步驟是 success。這也算正常成功。
  - **待確認**：`result` 是 null 或 unknown（還沒回填，或讀不到步驟紀錄）。不會因為 manifest 時間沒更新，就推定資料沒變。
  - **未執行**：沒有對應的 run。
  - **被取代**：cancelled，由較新的觸發取代。不算失敗，也不算執行。
  - **進行中**：還沒回填、排隊中、執行中或 Pages 發布中，不提前宣告成功。
- 事前連線測試（2026-09-24 14:4x–17:5x）沒做成：原本要在 Cloudflare 臨時加一個 cron，但 Worker 設定頁多次載入後一直空白，所以沒加。**token 和設定都沒有動**，等 21:00 實際觸發的回應再判斷。

| 日期（台灣） | 誰 | 在哪裡做 | 做了什麼 |
|---|---|---|---|
| 2026-09-24 18:0x | Claude | 101 workflow（`aa21b3f`） | publish 步驟輸出 `changed`，新增兩個判定步驟，每次 run 都留下自己的判定 |
| 2026-09-24 18:0x | Claude | Cloudflare D1（MCP） | `ALTER TABLE triggers ADD COLUMN result TEXT` |
| 2026-09-24 18:0x | Claude | GitHub Actions 手動測試 run `35984883627`（名稱 `live-data test verdict-steps`，手動觸發，不算外部觸發） | 判定步驟實測：「判定：資料有變動（提交）」success，另一個 skipped，整體 success |
| 2026-09-24 18:1x | Claude | Cloudflare 儀表板 → Worker →「編輯代碼」貼上 `worker.js`（`a716d60`）→ 部署 | 補查 run 時讀判定步驟，寫入 `result`。部署版本 `c7324b4e`；用 MCP 讀回線上程式碼，與 repo 一致；設定頁確認 `GH_TOKEN` 秘密、`DB` 繫結、Cron（下次 13:00Z）都還在 |
