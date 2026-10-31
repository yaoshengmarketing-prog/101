import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const input=path.join(root,"scripts/fixtures/real-2026");
const modules=["games","matchup","bullpen","ctx","roster"];
const sourceCommit="e14032cd8e1d502d476310e46e57c29cadaddf32";
const assert=(message,ok)=>{if(!ok)throw Error(message);console.log("PASS "+message)};
const blobSha=bytes=>crypto.createHash("sha1").update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes])).digest("hex");
const read=(module,pk)=>{
  const file=path.join(input,module,pk+".json"),bytes=fs.readFileSync(file);
  return {data:JSON.parse(bytes),sha:blobSha(bytes)};
};
const ids=slots=>(slots||[]).map(x=>x.id);
const lineupSig=slots=>"official:"+ids(slots).join(",");
const before=(at,start)=>typeof at==="string"&&Date.parse(at)<Date.parse(start);
const pks=fs.readdirSync(path.join(input,"games")).filter(x=>/^\d+\.json$/.test(x)).map(x=>Number(x.slice(0,-5))).sort((a,b)=>a-b);
assert("真實清單由已保存 gamePk 檔案取得，沒有人工賽事",pks.length>=2&&pks.every(pk=>pk<9000000));
const records={};
for(const pk of pks){
  const loaded=Object.fromEntries(modules.map(m=>[m,read(m,pk)]));
  const g=loaded.games.data,m=loaded.matchup.data,b=loaded.bullpen.data,c=loaded.ctx.data,r=loaded.roster.data;
  const type=g.gameType||c.game?.gameType||r.gameType;
  assert(`${pk} 五個模組同場且賽別一致`,[g.pk,m.pk,b.target?.pk,c.game?.pk,r.pk].every(x=>x===pk)
    &&[c.game?.gameType,r.gameType,g.gameType].filter(Boolean).every(x=>x===type));
  assert(`${pk} 情境、對位、名單為有時間證據的賽前資料`,c.sample==="pregame"&&c.phase==="pre"
    &&c.frozen?.lastPregameAt===c.updatedAt&&[c.updatedAt,m.fetchedAt,r.fetchedAt].every(t=>before(t,g.startUTC))
    &&["away","home"].every(s=>before(g[s].sp?.firstSeen,g.startUTC)&&before(g[s].lineup?.firstSeen,g.startUTC)));
  assert(`${pk} 先發 ID、九棒 ID 和對位基準相同`,["away","home"].every(side=>{
    const opponent=side==="away"?"home":"away",pair=m.pairs.find(x=>x.pitcherSide===side&&x.battingSide===opponent);
    return pair?.basis?.sp===g[side].sp?.id
      &&pair.basis.lineup===lineupSig(g[opponent].lineup?.slots)
      &&JSON.stringify(ids(pair.lineup?.slots))===JSON.stringify(ids(g[opponent].lineup?.slots))
      &&pair.vsCode===(g[side].sp?.hand==="L"?"vl":"vr")
      &&pair.splitScope==="2026 例行賽";
  }));
  assert(`${pk} 賽後結果晚於開賽，比分仍屬同場`,c.post?.gameOver===true
    &&Date.parse(c.post.fetchedAt)>Date.parse(g.startUTC)
    &&c.post.final?.away?.runs===g.away.score&&c.post.final?.home?.runs===g.home.score);
  assert(`${pk} 牛棚明細較晚更新，不冒充賽前逐人快照`,Date.parse(b.fetchedAt)>Date.parse(g.startUTC)
    &&b.window?.today===g.usDate&&c.bp?.away&&c.bp?.home);
  const team=side=>{
    const t=g[side];
    return {id:t.id,ab:t.ab,name:t.name,
      sp:{id:t.sp.id,name:t.sp.name,hand:t.sp.hand,firstSeen:t.sp.firstSeen,statStatus:"scope_unconfirmed"},
      lineup:{state:t.lineup.state,firstSeen:t.lineup.firstSeen,lateAt:t.lineup.lateAt,
        slots:t.lineup.slots.map(x=>({n:x.n,id:x.id,name:x.name,pos:x.pos,statStatus:"scope_unconfirmed"}))},
      statStatus:{rec:"scope_unconfirmed",ops:"scope_unconfirmed",era:"scope_unconfirmed"}};
  };
  records[pk]={
    game:{pk,season:Number(g.usDate.slice(0,4)),gameType:type,twDate:g.twDate,twTime:g.twTime,
      usDate:g.usDate,startUTC:g.startUTC,venue:g.venue,series:g.series||r.series||null,
      away:team("away"),home:team("home")},
    matchup:{fetchedAt:m.fetchedAt,rules:m.rules,pairs:m.pairs.map(p=>({...p,
      splitStatus:{vl:p.splits?.vl?"value":"unavailable",vr:p.splits?.vr?"value":"unavailable"},
      recentStatus:p.recent?.starts?"value":"unavailable"}))},
    matchupStatus:"current",
    context:{rules:c.rules,updatedAt:c.updatedAt,frozen:c.frozen,checks:c.checks,bp:c.bp,similar:c.similar||null,weather:c.weather||null},
    bullpen:b,roster:r,post:c.post,
    source:{commit:sourceCommit,files:Object.fromEntries(modules.map(d=>[d,{
      path:`live/data/${d}/${pk}.json`,blob:loaded[d].sha,
      at:d==="games"?g.updatedAt:d==="matchup"?m.fetchedAt:d==="bullpen"?b.fetchedAt:d==="ctx"?c.updatedAt:r.fetchedAt
    }]))}
  };
}
const output={meta:{sourceCommit,warning:"兩場真實已保存的 2026 比賽，來源固定於上述 commit。賽前情境、對位與名單有保存時間；比賽及牛棚檔後來更新，不能把所有欄位當成當時賽前快照。"},games:records};
if(process.argv.includes("--write")){
  const file=path.join(root,"preview/mlb-next/real-games-data.js");
  fs.writeFileSync(file,"window.MLB_REAL_GAMES = "+JSON.stringify(output)+";\n");
  console.log("WROTE "+file);
}
console.log(`PASS ${pks.length} real gamePk / shared adapter`);
