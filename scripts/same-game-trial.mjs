// Branch-only continuous artificial source trial. Every stage reuses the prior game state and saved records.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { build } from "./build-live.mjs";
import { buildBullpen } from "./bullpen.mjs";
import { compute, decide, similarOf } from "./ctx.mjs";
import { buildMatchup, buildPriorReference, matchupState } from "./matchup.mjs";
import { summarizePost, pending } from "./post.mjs";
import { batterBasisValid } from "./trial-batting.mjs";
import { pk, steps, prior, entryOf, boxOf, source } from "./same-game-fixture.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const oldFiles=["live/data/games/849799.json","live/data/ctx/849799.json"];
const shaFile=f=>crypto.createHash("sha256").update(fs.readFileSync(path.join(root,f))).digest("hex");
const oldBefore=Object.fromEntries(oldFiles.map(f=>[f,shaFile(f)]));
const assert=(label,ok)=>{if(!ok)throw new Error("FAIL "+label);console.log("PASS "+label)};
for(const id of [991001,991003,991010,992001]) assert(`人工打席與事件分項相符 ${id}`,batterBasisValid(id));
let state={games:{}}, prevGame=null, savedCtx=null, savedMatchup=null, frozenPregame=null, savedPost=null;
const rows=[], records=new Map(), priorReference=await buildPriorReference(
  {season:"2027",away:{id:113,sp:{id:990001}},home:{id:158,sp:{id:990002}}},steps[0].at,source(steps[0]));
for(const s of steps){
  const fetchJson=source(s), R=await build({fetchJson,now:new Date(s.at),state,prevGame:p=>p===pk?prevGame:null});
  state=R.state;
  const game=R.games[pk]; assert(`${s.key}：同一 gamePk 有單場輸出`,!!game&&game.pk===pk);
  prevGame=game;
  const bullpen=(await buildBullpen({games:[game],fetchJson,nowISO:s.at})).files[pk];
  const fresh=compute(game,bullpen,[game],s.at);
  if(game.status.code==="pre") fresh.similar=similarOf(fresh,[...records.values()]);
  savedCtx=decide(game,savedCtx,fresh,s.at);
  let recalcError=null;
  if(game.status.code==="pre"){
    try{savedMatchup=await buildMatchup(game,s.at,fetchJson)}
    catch(e){recalcError=String(e.message||e)}
    if(matchupState(game,savedMatchup)==="current"&&!recalcError)
      frozenPregame=structuredClone({game,matchup:savedMatchup,context:savedCtx,bullpen});
  }
  const matchState=matchupState(game,savedMatchup);
  if(s.status==="Final"&&pending(savedCtx,new Date(s.at))){
    savedPost=summarizePost(entryOf(s),boxOf(s),s.at);
    savedCtx={...savedCtx,post:savedPost};
  }
  records.set(pk,savedCtx);
  rows.push({key:s.key,label:s.label,at:s.at,game,context:savedCtx,bullpen,
    matchup:savedMatchup,matchupStatus:matchState,matchupError:recalcError,
    pregame:frozenPregame,post:savedPost,events:R.events});
}
assert("官方打線從未取得變成雙方九棒",rows[0].game.lineup==="none"&&rows[1].game.away.lineup.slots.length===9&&rows[1].game.home.lineup.slots.length===9);
assert("本場之前的實際登板來自上一場，與本場賽前資料分開",rows[0].bullpen.summary.away.recentUsage.some(x=>x.pk===prior.gamePk&&x.pitches===21)
  &&rows[0].bullpen.summary.away.days[3].st==="off");
assert("名單與左投變動後，重算失敗保留舊版時間但不能視為新對位",rows[2].game.home.sp.hand==="L"&&rows[2].game.away.lineup.slots[0].id===991010
  &&rows[2].matchupStatus==="stale"&&rows[2].matchupError&&rows[2].matchup.fetchedAt===rows[1].matchup.fetchedAt);
assert("恢復後新對位對應左投與新球員",rows[3].matchupStatus==="current"&&rows[3].matchup.pairs[1].vsCode==="vl"
  &&rows[3].matchup.pairs[1].lineup.slots[0].id===991010);
assert("開賽後賽前快照凍結，仍為同一場賽前樣本",rows[4].context.sample==="pregame"
  &&rows[4].context.frozen?.lastPregameAt===rows[3].context.updatedAt&&records.size===1);
assert("完賽未齊與完整分開，0／確定未打／未取得分開",rows[5].post.gameOver&&!rows[5].post.complete
  &&rows[5].post.innings[0].away===0&&rows[5].post.notPlayed.some(x=>x.n===9&&x.side==="home")
  &&rows[5].post.missing.some(x=>x.n===7&&x.side==="away")&&rows[6].post.complete&&!rows[6].post.missing.length);
const outsOfIp=ip=>{const [whole,part]=String(ip).split(".").map(Number);return whole*3+(part||0)};
assert("人工賽後投球出局數對齊實際半局，九下未打不計客隊投球",[steps[5],steps[6]].every(s=>{
  const halves=entryOf(s).linescore.innings, box=boxOf(s);
  return ["away","home"].every(side=>{
    const battingSide=side==="away"?"home":"away";
    const inningsOuts=halves.reduce((n,inning)=>n+(inning[battingSide]?.outs??0),0);
    const pitchingOuts=box.teams[side].pitchers.reduce((n,id)=>n+outsOfIp(box.teams[side].players["ID"+id].stats.pitching.inningsPitched),0);
    return inningsOuts===pitchingOuts;
  });
}));
const preHash=x=>crypto.createHash("sha256").update(JSON.stringify(x)).digest("hex");
const frozenHash=preHash(rows[4].pregame), lastHash=preHash(rows[6].pregame);
assert("賽後只補 post，未改寫最後成功的賽前內容",frozenHash===lastHash
  &&preHash(rows[3].pregame)===frozenHash&&rows[6].context.checks===rows[4].context.checks);
assert("同一 gamePk 沒有重複累積研究樣本",records.size===1&&[...records.values()][0].game.pk===pk);
const repeat=await build({fetchJson:source(steps[6]),now:new Date(steps[6].at),state,prevGame:p=>p===pk?prevGame:null});
const repeatCtx=decide(repeat.games[pk],savedCtx,compute(repeat.games[pk],rows[6].bullpen,[repeat.games[pk]],steps[6].at),steps[6].at);
assert("賽後補完後不再重取；重跑同一階段不累積",!pending(repeatCtx,new Date("2027-04-21T04:00:00Z"))
  &&repeat.events.length===0&&records.size===1&&repeatCtx.post.fetchedAt===steps[6].at);
const lateBuild=await build({fetchJson:source(steps[4]),now:new Date(steps[4].at),state:{games:{}},prevGame:()=>null});
const lateGame=lateBuild.games[pk];
const late=decide(lateGame,null,compute(lateGame,rows[4].bullpen,[lateGame],steps[4].at),steps[4].at);
assert("首次取得已開賽者標晚到，不補造賽前樣本",Date.parse(lateGame.firstSeen)===Date.parse(steps[4].at)
  &&late.sample==="late"&&late.phase==="live"&&!late.frozen);
assert("2026 舊單場與舊情境快照未覆寫",oldFiles.every(f=>shaFile(f)===oldBefore[f]));
const result={meta:{title:"同場連續資料試跑",gamePk:pk,warning:"2027 賽事、球員、來源回應皆為人工測試；每一步由既有程式處理，非真實來源或正式更新。",
  firstSeen:rows[0].game.firstSeen,oneGameRecord:records.size,old2026Sha256:oldBefore,
  frozenPregameSha256:frozenHash,afterPostPregameSha256:lastHash,lateFirstSeenSample:late.sample},
  priorReference,stages:rows};
if(process.argv.includes("--write")){
  const output=path.join(root,"preview/mlb-next/same-game-data.js");
  fs.writeFileSync(output,"window.MLB_SAME_GAME_TRIAL = "+JSON.stringify(result)+";\n");
  console.log("WROTE "+output);
}
console.log("PASS 7 connected snapshots / 1 gamePk");


