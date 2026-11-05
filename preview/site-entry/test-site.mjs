import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./site.js', import.meta.url), 'utf8');
const generatedAt = '2026-11-04T16:00:39.542Z';
const today = '2026-11-05', tomorrow = '2026-11-06';
const manifest = (days, recent = []) => ({generatedAt,days:days.map(([date,count]) => ({date,count})),recent});
const dateFile = (date,games = []) => ({date,generatedAt,games});
const game = {pk:12345,twDate:today,twTime:'18:00',away:{name:'客隊'},home:{name:'主隊'},status:{text:'賽前'}};
const status = {lastAttemptOk:true,lastAttemptAt:'2026-11-04T16:00:42Z'};
const football = {
  'football/data/status.json':{status:'ok',generatedAt,expiresAt:'2027-01-01T00:00:00Z'},
  'football/data/overview.json':{generatedAt,games:[]}
};

async function render(page, mlbFiles){
  const app = {innerHTML:''};
  class FixedDate extends Date {
    constructor(...args){ super(...(args.length ? args : ['2026-11-05T04:00:00Z'])); }
    static now(){ return Date.parse('2026-11-05T04:00:00Z'); }
  }
  const files = {...football,...mlbFiles};
  const context = {
    Date:FixedDate, Intl, URL, URLSearchParams, Promise,
    location:{pathname:`/101/preview/site-entry/review/test/${page === 'home' ? 'index' : 'sport'}.html`,search:page === 'sport' ? '?sport=mlb' : '',hash:''},
    document:{body:{dataset:{page}},querySelector:s => s === '#app' ? app : null,querySelectorAll:() => []},
    fetch:async url => {
      const path = String(url).replace(/^\/101\//,'');
      if(!(path in files)) throw Error(`missing ${path}`);
      return {ok:true,json:async () => files[path]};
    },
    requestAnimationFrame:fn => fn()
  };
  vm.runInNewContext(source,context);
  await new Promise(resolve => setImmediate(resolve));
  return app.innerHTML;
}

async function both(files){ return [await render('home',files),await render('sport',files)]; }
const base = {
  'live/data/manifest.json':manifest([[today,0],[tomorrow,0]]),
  'live/data/status.json':status,
  [`live/data/dates/${today}.json`]:dateFile(today),
  [`live/data/dates/${tomorrow}.json`]:dateFile(tomorrow)
};

for(const html of await both(base)) assert.match(html,/11\/05–11\/06 已確認無賽/);

const stale = {...base,'live/data/manifest.json':manifest([['2026-11-01',2],['2026-11-02',1]],[{pk:849799,twDate:'2026-10-29',away:{name:'釀酒人'},home:{name:'光芒'}}])};
for(const html of await both(stale)){
  assert.match(html,/日期待更新|未列於清單/);
  assert.match(html,/清單原列 11\/01、11\/02/);
  assert.doesNotMatch(html,/已確認無賽/);
  assert.match(html,/849799/);
}

const missingDate = {...base};
delete missingDate[`live/data/dates/${tomorrow}.json`];
for(const html of await both(missingDate)){
  assert.match(html,/11\/06 日期檔讀取失敗/);
  assert.doesNotMatch(html,/已確認無賽/);
}

const missingManifest = {...base};
delete missingManifest['live/data/manifest.json'];
for(const html of await both(missingManifest)){
  assert.match(html,/賽程清單讀取失敗|賽程清單未取得/);
  assert.doesNotMatch(html,/已確認無賽/);
}

const partial = {...missingDate,'live/data/manifest.json':manifest([[today,1],[tomorrow,0]]),[`live/data/dates/${today}.json`]:dateFile(today,[game])};
for(const html of await both(partial)){
  assert.match(html,/已核對 1 日 1 場/);
  assert.match(html,/11\/06 日期檔讀取失敗/);
  assert.doesNotMatch(html,/已確認無賽/);
}
assert.match(await render('sport',partial),/game-12345/);

const missingStatus = {...base};
delete missingStatus['live/data/status.json'];
for(const html of await both(missingStatus)){
  assert.match(html,/流程狀態檔未取得/);
  assert.doesNotMatch(html,/已確認無賽|最近一次流程檢查成功/);
}

const failedStatus = {...base,'live/data/status.json':{lastAttemptOk:false}};
for(const html of await both(failedStatus)){
  assert.match(html,/本次流程檢查失敗/);
  assert.doesNotMatch(html,/已確認無賽/);
}

console.log('MLB 日期與缺項狀態：正常零場、舊清單、缺清單、缺日期檔、部分取得、缺狀態檔、流程失敗均通過。');

