import { batterBasis } from "./trial-batting.mjs";
export const pk = 9902750, start = "2027-04-20T23:10:00Z";
const team = (id, name, abbreviation) => ({ id, name, abbreviation });
const away = team(113, "Cincinnati Reds", "CIN"), home = team(158, "Milwaukee Brewers", "MIL");
export const steps = [
  { key:"no_lineup", label:"1 官方打線未取得", at:"2027-04-20T15:00:00Z", status:"Scheduled", lineup:false, changed:false },
  { key:"official", label:"2 官方九棒公布", at:"2027-04-20T20:00:00Z", status:"Scheduled", lineup:true, changed:false },
  { key:"recalc_failed", label:"3A 先發與九棒變動・重算失敗", at:"2027-04-20T21:50:00Z", status:"Scheduled", lineup:true, changed:true, failMatchup:true },
  { key:"recalc_ok", label:"3B 重算恢復成功", at:"2027-04-20T22:10:00Z", status:"Scheduled", lineup:true, changed:true },
  { key:"live", label:"4 比賽中・凍結賽前", at:"2027-04-20T23:35:00Z", status:"In Progress", lineup:true, changed:true },
  { key:"final_partial", label:"5 完賽・逐局未齊", at:"2027-04-21T03:10:00Z", status:"Final", lineup:true, changed:true, partial:true },
  { key:"final_complete", label:"6 補齊賽後結果", at:"2027-04-21T03:35:00Z", status:"Final", lineup:true, changed:true }
];
export const prior = { gamePk:9902748, officialDate:"2027-04-18", gameDate:"2027-04-18T23:10:00Z", gameType:"R",
  status:{abstractGameState:"Final",detailedState:"Final"}, venue:{name:"人工測試球場",timeZone:{id:"America/Chicago"}},
  teams:{away:{team:away,score:2},home:{team:home,score:3}} };
export const entryOf = s => {
  const final = s.status === "Final", live = s.status === "In Progress";
  const innings = final ? Array.from({length:9},(_,i)=>({num:i+1,
    away:{runs:i===2||i===6?i===6&&s.partial?null:1:0,outs:3},
    home:i===8?null:{runs:[0,5,7].includes(i)?1:0,outs:3}})) : null;
  return { gamePk:pk, officialDate:"2027-04-20", gameDate:start, gameType:"R",
    status:{abstractGameState:final?"Final":live?"Live":"Preview",detailedState:s.status},
    venue:{name:"人工測試球場",timeZone:{id:"America/Chicago"}},
    teams:{away:{team:away,probablePitcher:{id:990001,fullName:"測試先發 A"},...(final?{score:2}:{})},
      home:{team:home,probablePitcher:{id:s.changed?990003:990002,fullName:s.changed?"測試先發 B2":"測試先發 B"},...(final?{score:3}:{})}},
    ...(final?{linescore:{scheduledInnings:9,teams:{away:{runs:2,hits:5,errors:0},home:{runs:3,hits:7,errors:0}},innings}}:{}) };
};
export const boxOf = (s, old=false) => {
  const side = (base, letter) => {
    const players={};
    for(let n=1;n<=9;n++){
      const id=letter==="A"&&n===1&&s.changed&&!old?991010:base+n;
      players["ID"+id]={person:{id,fullName:`測試打者 ${letter}${id===991010?"10":n}`},
        position:{abbreviation:n===1?"CF":"IF"},...(old||s.lineup?{battingOrder:String(n*100)}:{})};
    }
    if(old||s.status==="Final"){
      const ids=old?(letter==="A"?[990011,990093]:[990012,990094]):letter==="A"?[990001,990091]:[990003,990092];
      for(const [i,id] of ids.entries()) players["ID"+id]={person:{id,fullName:`測試投手 ${letter}${i+1}`},
        stats:{pitching:{inningsPitched:i?(letter==="A"?"2.0":"3.0"):"6.0",numberOfPitches:old?(i?21:68):i?42:87,
          runs:i?1:letter==="A"?2:1,earnedRuns:i?1:letter==="A"?2:1}}};
      return {players,pitchers:ids};
    }
    return {players,pitchers:[]};
  };
  return {gamePk:old?prior.gamePk:pk,teams:{away:side(991000,"A"),home:side(992000,"B")}};
};
const idsFrom = url => (url.match(/personIds=([^&]+)/)?.[1]||"").split(",").map(Number).filter(Boolean);
export const source = s => async url => {
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


