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
import { batterBasis, batterBasisValid } from "./trial-batting.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const oldFiles=["live/data/games/849799.json","live/data/ctx/849799.json"];
const shaFile=f=>crypto.createHash("sha256").update(fs.readFileSync(path.join(root,f))).digest("hex");
const oldBefore=Object.fromEntries(oldFiles.map(f=>[f,shaFile(f)]));
const pk = 9902750, start = "2027-04-20T23:10:00Z";
const team = (id, name, abbreviation) => ({ id, name, abbreviation });
const away = team(113, "Cincinnati Reds", "CIN"), home = team(158, "Milwaukee Brewers", "MIL");
const steps = [
  { key:"no_lineup", label:"1 官方打線未取得", at:"2027-04-20T15:00:00Z", status:"Scheduled", lineup:false, changed:false },
  { key:"official", label:"2 官方九棒公布", at:"2027-04-20T20:00:00Z", status:"Scheduled", lineup:true, changed:false },
  { key:"recalc_failed", label:"3A 先發與九棒變動・重算失敗", at:"2027-04-20T21:50:00Z", status:"Scheduled", lineup:true, changed:true, failMatchup:true },
  { key:"recalc_ok", label:"3B 重算恢復成功", at:"2027-04-20T22:10:00Z", status:"Scheduled", lineup:true, changed:true },
  { key:"live", label:"4 比賽中・凍結賽前", at:"2027-04-20T23:35:00Z", status:"In Progress", lineup:true, changed:true },
  { key:"final_partial", label:"5 完賽・逐局未齊", at:"2027-04-21T03:10:00Z", status:"Final", lineup:true, changed:true, partial:true },
  { key:"final_complete", label:"6 補齊賽後結果", at:"2027-04-21T03:35:00Z", status:"Final", lineup:true, changed:true }
];
const prior = { gamePk:9902748, officialDate:"2027-04-18", gameDate:"2027-04-18T23:10:00Z", gameType:"R",
  status:{abstractGameState:"Final",detailedState:"Final"}, venue:{name:"人工測試球場",timeZone:{id:"America/Chicago"}},
  teams:{away:{team:away,score:2},home:{team:home,score:3}} };
const entryOf = s => {
  const final = s.status === "Final", live = s.status === "In Progress";
  const innings = final ? Array.from({length:9},(_,i)=>({num:i+1,
    away:{runs:i===2||i===6?i===6&&s.partial?null:1:0},
    home:i===8?null:{runs:[0,5,7].includes(i)?1:0}})) : null;
  return { gamePk:pk, officialDate:"2027-04-20", gameDate:start, gameType:"R",
    status:{abstractGameState:final?"Final":live?"Live":"Preview",detailedState:s.status},
    venue:{name:"人工測試球場",timeZone:{id:"America/Chicago"}},
    teams:{away:{team:away,probablePitcher:{id:990001,fullName:"測試先發 A"},...(final?{score:2}:{})},
      home:{team:home,probablePitcher:{id:s.changed?990003:990002,fullName:s.changed?"測試先發 B2":"測試先發 B"},...(final?{score:3}:{})}},
    ...(final?{linescore:{scheduledInnings:9,teams:{away:{runs:2,hits:5,errors:0},home:{runs:3,hits:7,errors:0}},innings}}:{}) };
};
const boxOf = (s, old=false) => {
  const side = (base, letter) => {
    const players={};
    for(let n=1;n<=9;n++){
      const id=letter==="A"&&n===1&&s.changed&&!old?991010:base+n;
      players["ID"+id]={person:{id,fullName:`測試打者 ${letter}${id===991010?"10":n}`},
        position:{abbreviation:n===1?"CF":"IF"},...(old||s.lineup?{battingOrder:String(n*100)}:{})};
    }
    if(s.status==="Final"&&!old){
      const ids=letter==="A"?[990001,990091]:[990003,990092];
      for(const [i,id] of ids.entries()) players["ID"+id]={person:{id,fullName:`測試投手 ${letter}${i+1}`},
        stats:{pitching:{inningsPitched:i?"3.0":"6.0",numberOfPitches:i?42:87,runs:i?1:letter==="A"?2:1,earnedRuns:i?1:letter==="A"?2:1}}};
      return {players,pitchers:ids};
    }
    return {players,pitchers:[]};
  };
  return {gamePk:old?prior.gamePk:pk,teams:{away:side(991000,"A"),home:side(992000,"B")}};
};
const idsFrom = url => (url.match(/personIds=([^&]+)/)?.[1]||"").split(",").map(Number).filter(Boolean);
const source = s => async url => {
  if(url.includes("/schedule?")){
    if(url.includes("gamePks=")) return {dates:[{date:"2027-04-20",games:[entryOf(s)]}]};
    return {dates:[{date:"2027-04-18",games:[prior]},{date:"2027-04-20",games:[entryOf(s)]}]};
  }
  if(url.includes("/standings?")) return {records:[{teamRecords:[113,158].map(id=>({team:{id},wins:2,losses:1,gamesPlayed:3,winningPercentage:".667",records:{splitRecords:[]}}))}]};
  if(url.includes("/teams/stats?")) return {stats:[{splits:[113,158].map(id=>({season:url.includes("season=2026")?"2026":"2027",gameType:"R",team:{id},
    stat:url.includes("group=hitting")?{ops:".650"}:{era:"2.25"}}))}]};
  if(url.includes("/game/")&&url.includes("/boxscore")) return boxOf(s,Number(url.match(/\/game\/(\d+)/)?.[1])===prior.gamePk);
  if(url.includes("/people?")){
    const season=url.includes("season=2026")?"2026":"2027";
    const pitching=url.includes("group=[pitching]"), split=url.includes("statSplits");
    return {people:idsFrom(url).map(id=>({
      id,pitchHand:{code:id===990003?"L":"R"},batSide:{code:id%2?"L":"R"},
      stats:[{type:{displayName:split?"statSplits":"season"},
        splits:season==="2026"?[{season,gameType:"R",stat:pitching?{era:"3.45",whip:"1.20",inningsPitched:"120.0",gamesStarted:25}:{avg:".245",ops:".710",plateAppearances:110}}]
          :split?[{season,gameType:"R",split:{code:"vl"},stat:batterBasis(id).vl},{season,gameType:"R",split:{code:"vr"},stat:batterBasis(id).vr}]
          :[{season,gameType:"R",stat:pitching?{wins:1,losses:0,era:"2.19",whip:"0.97",inningsPitched:"12.1",gamesStarted:3}:batterBasis(id).total}]}]
    }))};
  }
  if(url.includes("/people/")&&url.includes("/stats?")){
    if(s.failMatchup) throw new Error("人工模擬：新版本對位來源重算失敗");
    if(url.includes("stats=statSplits")) return {stats:[{splits:[
      {season:"2027",gameType:"R",split:{code:"vl"},stat:{battersFaced:20,ops:".500"}},
      {season:"2027",gameType:"R",split:{code:"vr"},stat:{battersFaced:25,ops:".750"}}]}]};
    if(url.includes("stats=gameLog")) return {stats:[{splits:["2027-04-04","2027-04-09","2027-04-14"].map((date,i)=>({
      season:"2027",gameType:"R",date,game:{gamePk:9902740+i},opponent:{id:147},isHome:i%2===0,
      stat:{gamesStarted:1,inningsPitched:["3.0","4.1","5.0"][i],numberOfPitches:[54,69,78][i],earnedRuns:[2,1,0][i]}}))}]};
  }
  throw new Error("未預期的人工來源："+url);
};
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
assert("名單與左投變動後，重算失敗保留舊版時間但不能視為新對位",rows[2].game.home.sp.hand==="L"&&rows[2].game.away.lineup.slots[0].id===991010
  &&rows[2].matchupStatus==="stale"&&rows[2].matchupError&&rows[2].matchup.fetchedAt===rows[1].matchup.fetchedAt);
assert("恢復後新對位對應左投與新球員",rows[3].matchupStatus==="current"&&rows[3].matchup.pairs[1].vsCode==="vl"
  &&rows[3].matchup.pairs[1].lineup.slots[0].id===991010);
assert("開賽後賽前快照凍結，仍為同一場賽前樣本",rows[4].context.sample==="pregame"
  &&rows[4].context.frozen?.lastPregameAt===rows[3].context.updatedAt&&records.size===1);
assert("完賽未齊與完整分開，0／確定未打／未取得分開",rows[5].post.gameOver&&!rows[5].post.complete
  &&rows[5].post.innings[0].away===0&&rows[5].post.notPlayed.some(x=>x.n===9&&x.side==="home")
  &&rows[5].post.missing.some(x=>x.n===7&&x.side==="away")&&rows[6].post.complete&&!rows[6].post.missing.length);
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
