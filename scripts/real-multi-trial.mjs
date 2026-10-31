import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const option=name=>process.argv.find(x=>x.startsWith(`--${name}=`))?.slice(name.length+3);
const input=option("input")||path.join(root,"scripts/fixtures/real-2026");
const modules=["games","matchup","bullpen","ctx","roster"];
const sourceCommit="e14032cd8e1d502d476310e46e57c29cadaddf32";
const assert=(message,ok)=>{if(!ok)throw Error(message);console.log("PASS "+message)};
const blobSha=bytes=>crypto.createHash("sha1").update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes])).digest("hex");
const read=(module,pk,required=false)=>{
  const file=path.join(input,module,pk+".json");
  if(!fs.existsSync(file)){
    if(required)throw Error(`必要檔案未取得：${file}`);
    return null;
  }
  const bytes=fs.readFileSync(file);
  return {data:JSON.parse(bytes),sha:blobSha(bytes)};
};
const ids=slots=>(slots||[]).map(x=>x.id);
const lineupSig=slots=>"official:"+ids(slots).join(",");
const before=(at,start)=>typeof at==="string"&&Date.parse(at)<Date.parse(start);
const fullNine=slots=>Array.isArray(slots)&&slots.length===9
  &&new Set(slots.map(x=>x.n)).size===9
  &&slots.every(x=>Number.isInteger(x.n)&&x.n>=1&&x.n<=9&&x.name);
const nameKey=name=>String(name||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const pks=fs.readdirSync(path.join(input,"games")).filter(x=>/^\d+\.json$/.test(x)).map(x=>Number(x.slice(0,-5))).sort((a,b)=>a-b);
assert("真實清單由已保存 gamePk 檔案取得，沒有人工賽事",pks.length>=2&&pks.every(pk=>pk<9000000));
const records={};
for(const pk of pks){
  const loaded=Object.fromEntries(modules.map(m=>[m,read(m,pk,m==="games"||m==="ctx")]));
  const g=loaded.games.data,m=loaded.matchup?.data,b=loaded.bullpen?.data,c=loaded.ctx.data,r=loaded.roster?.data;
  const type=g.gameType||c.game?.gameType||r?.gameType;
  assert(`${pk} 必要身份與已取得模組同場、賽別一致`,!!type
    &&[g.pk,c.game?.pk,m?.pk,b?.target?.pk,r?.pk].filter(x=>x!=null).every(x=>x===pk)
    &&[c.game?.gameType,r?.gameType,g.gameType].filter(Boolean).every(x=>x===type));
  assert(`${pk} 情境與可用的對位、名單有賽前保存時間`,c.sample==="pregame"&&c.phase==="pre"
    &&c.frozen?.lastPregameAt===c.updatedAt
    &&[c.updatedAt,m?.fetchedAt,r?.fetchedAt].filter(Boolean).every(t=>before(t,g.startUTC))
    &&["away","home"].every(s=>before(g[s].sp?.firstSeen,g.startUTC)&&before(g[s].lineup?.firstSeen,g.startUTC)));
  if(m)assert(`${pk} 先發 ID、九棒 ID 和對位基準相同`,["away","home"].every(side=>{
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
  if(b)assert(`${pk} 牛棚明細較晚更新，不冒充賽前逐人快照`,Date.parse(b.fetchedAt)>Date.parse(g.startUTC)
    &&b.window?.today===g.usDate&&c.bp?.away&&c.bp?.home);
  const projection=side=>{
    const p=g.proj?.[side];
    if(!p)return null;
    const versions=(p.versions||[]).filter(v=>before(v.at,g.startUTC)&&before(v.at,p.frozenAt)
      &&fullNine(v.slots)).sort((a,z)=>a.at.localeCompare(z.at));
    const first=p.first&&before(p.first.at,g.startUTC)&&fullNine(p.first.slots)?p.first:null;
    const official=p.official&&before(p.official.at,g.startUTC)&&fullNine(p.official.slots)?p.official:null;
    if(official)assert(`${pk} ${side} 預估內的官方版本與本場九棒一致`,
      official.at===g[side].lineup.firstSeen&&official.slots.every((x,i)=>
        x.n===g[side].lineup.slots[i]?.n&&nameKey(x.name)===nameKey(g[side].lineup.slots[i]?.name)));
    if(!versions.length&&!first&&!official)return null;
    return {source:p.source||null,firstSeen:p.firstSeen||null,frozenAt:p.frozenAt||null,
      first,versions,official,crossSource:p.cross||null,crossCmp:p.crossCmp||null,
      confirmed:versions.findLast(v=>v.statusKey==="confirmed")||null,
      sourceStatus:p.sourceStatus||null,lateAt:g[side].lineup.lateAt||null,
      containerUpdatedAt:g.updatedAt};
  };
  const previous=side=>{
    const p=g[side].prev;
    if(!p)return null;
    const ref=read("previous",p.pk);
    if(!ref)return {status:"unverified",reason:"上一場核對檔未取得"};
    const prior=ref.data,ps=["away","home"].find(x=>prior[x]?.id===g[side].id);
    const other=ps==="away"?"home":"away",slots=prior[ps]?.slots;
    assert(`${pk} ${side} 上一場 gamePk、日期、對手與九棒 ID 一致`,
      prior.source?.commit===sourceCommit&&prior.pk===p.pk&&prior.usDate===p.date
      &&before(prior.source?.at,g.startUTC)&&ps&&p.ha===(ps==="away"?"客":"主")
      &&prior[other]?.name===p.opp&&fullNine(slots)&&fullNine(p.slots)
      &&JSON.stringify(ids(slots))===JSON.stringify(ids(p.slots))
      &&p.score===`${prior[ps].score}-${prior[other].score}`);
    return {status:"historical_reference",pk:p.pk,date:p.date,gameType:p.gameType||null,
      ha:p.ha,opp:p.opp,score:p.score,slots:slots.map(x=>({n:x.n,id:x.id,name:x.name,pos:x.pos})),
      source:prior.source,note:"上一場歷史參考，非本場當時賽前快照"};
  };
  const team=side=>{
    const t=g[side];
    return {id:t.id,ab:t.ab,name:t.name,
      sp:{id:t.sp.id,name:t.sp.name,hand:t.sp.hand,firstSeen:t.sp.firstSeen,statStatus:"scope_unconfirmed"},
      lineup:{state:t.lineup.state,firstSeen:t.lineup.firstSeen,lateAt:t.lineup.lateAt,
        slots:t.lineup.slots.map(x=>({n:x.n,id:x.id,name:x.name,pos:x.pos,statStatus:"scope_unconfirmed"}))},
      projection:projection(side),prev:previous(side),
      statStatus:{rec:"scope_unconfirmed",ops:"scope_unconfirmed",era:"scope_unconfirmed"}};
  };
  records[pk]={
    game:{pk,season:Number(g.usDate.slice(0,4)),gameType:type,twDate:g.twDate,twTime:g.twTime,
      usDate:g.usDate,startUTC:g.startUTC,venue:g.venue,series:g.series||r?.series||null,
      away:team("away"),home:team("home")},
    matchup:m?{fetchedAt:m.fetchedAt,rules:m.rules,pairs:m.pairs.map(p=>({...p,
      splitStatus:{vl:p.splits?.vl?"value":"unavailable",vr:p.splits?.vr?"value":"unavailable"},
      recentStatus:p.recent?.starts?"value":"unavailable"}))}:null,
    matchupStatus:m?"current":"unavailable",
    context:{rules:c.rules,updatedAt:c.updatedAt,frozen:c.frozen,checks:c.checks,bp:c.bp,similar:c.similar||null,weather:c.weather||null},
    bullpen:b||null,roster:r||null,post:c.post,
    source:{commit:sourceCommit,missing:modules.filter(d=>!loaded[d]),files:Object.fromEntries(modules.filter(d=>loaded[d]).map(d=>[d,{
      path:`live/data/${d}/${pk}.json`,blob:loaded[d].sha,
      at:d==="games"?g.updatedAt:d==="matchup"?m.fetchedAt:d==="bullpen"?b.fetchedAt:d==="ctx"?c.updatedAt:r.fetchedAt
    }]))}
  };
}
const testCopy=process.argv.includes("--test-copy");
const output={meta:{sourceCommit,testCopy,warning:testCopy
  ?"此為固定資料的測試複本，刻意移除一個選配檔；原始保存檔仍完整。其他已取得內容只按各自來源時間顯示。"
  :"兩場真實已保存的 2026 比賽，來源固定於上述 commit。賽前情境、對位與名單有保存時間；比賽及牛棚檔後來更新，不能把所有欄位當成當時賽前快照。"},games:records};
if(process.argv.includes("--write")){
  const file=option("output")||path.join(root,"preview/mlb-next/real-games-data.js");
  const globalName=option("global")||"MLB_REAL_GAMES";
  if(!/^MLB_REAL_GAMES(?:_MISSING)?$/.test(globalName))throw Error("不允許的輸出全域名稱");
  fs.writeFileSync(file,`window.${globalName} = `+JSON.stringify(output)+";\n");
  console.log("WROTE "+file);
}
console.log(`PASS ${pks.length} real gamePk / shared adapter`);

