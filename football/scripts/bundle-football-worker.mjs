// 將共用聯賽設定嵌入 Cloudflare Worker，供不具本機 Wrangler 的受控部署使用。
import fs from 'node:fs/promises';
import path from 'node:path';

const config = await fs.readFile('football/scripts/football-leagues.mjs', 'utf8');
const worker = await fs.readFile('cloudflare/live-data-trigger/worker.js', 'utf8');
const importLine = 'import { LIVE_LEAGUE_IDS, LEAGUES, PREMATCH_MINUTES } from "../../football/scripts/football-leagues.mjs";';
if (!worker.includes(importLine)) throw new Error('Worker 共用設定匯入路徑已改，停止打包');
const bundled = `${config.replace(/^export /gm, '')}\n${worker.replace(importLine, '')}`;
const target = path.resolve('.football-build/worker.js');
await fs.mkdir(path.dirname(target), { recursive: true });
await fs.writeFile(target, bundled);
console.log(JSON.stringify({ target, bytes: Buffer.byteLength(bundled) }));
