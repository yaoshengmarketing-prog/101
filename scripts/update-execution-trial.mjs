// 同一人工 gamePk 的離線串接：計畫決定函式呼叫，成功才提交處理版本。
// 不使用外部 fetch、不啟動排程、不寫 live/data 或公開預覽。
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "./build-live.mjs";
import { buildBullpen } from "./bullpen.mjs";
import { compute, decide, CHECKS } from "./ctx.mjs";
import { buildMatchup, matchupState } from "./matchup.mjs";
import { summarizePost } from "./post.mjs";
import { pk, steps, source, entryOf, boxOf } from "./same-game-fixture.mjs";
import { planRound, matchupFingerprint, contextFingerprint } from "./update-decision-trial.mjs";

const events=[
  {key:"no_lineup", step:steps[0], schedule:"g1", lineup:null, stats:"s1"},
  {key:"official", step:steps[1], schedule:"g1", lineup:"l1", stats:"s1"},
  {key:"recalc_failed", step:steps[2], schedule:"g2", lineup:"l2", stats:"s1"},
  {key:"recalc_ok", step:steps[3], schedule:"g2", lineup:"l2", stats:"s1"},
  {key:"stat_update", step:steps[3], at:"2027-04-20T22:15:00Z", schedule:"g2", lineup:"l2", stats:"s2"},
  {key:"same_version", step:steps[3], at:"2027-04-20T22:20:00Z", schedule:"g2", lineup:"l2", stats:"s2"},
  {key:"stat_failed", step:steps[3], at:"2027-04-20T22:25:00Z", schedule:"g2", lineup:"l2", stats:"s3", failStats:true},
  {key:"stat_recovered", step:steps[3], at:"2027-04-20T22:30:00Z", schedule:"g2", lineup:"l2", stats:"s3", statsState:"unchanged"},
  {key:"live", step:steps[4], schedule:"g3", lineup:"l2", stats:"s3"},
  {key:"final_partial", step:steps[5], schedule:"g4", lineup:"l2", stats:"s3", post:"p1"},
  {key:"final_complete", step:steps[6], schedule:"g5", lineup:"l2", stats:"s3", post:"p2"},
];
const partialEvents=[
  events[0],
  {key:"box_failed",step:steps[1],at:"2027-04-20T19:40:00Z",schedule:"g1",lineup:"l1",stats:"s1",failCurrentBox:true},
  {key:"box_recovered",step:steps[1],at:"2027-04-20T19:45:00Z",schedule:"g1",lineup:"l1",stats:"s1",lineupState:"unchanged"},
  ...events.slice(1,8),
  {key:"pitchers_failed",step:steps[3],at:"2027-04-20T22:31:00Z",schedule:"g2",lineup:"l2",stats:"s4",failPitchers:true},
  {key:"pitchers_recovered",step:steps[3],at:"2027-04-20T22:32:00Z",schedule:"g2",lineup:"l2",stats:"s4",statsState:"unchanged"},
  ...events.slice(8).map(e=>({...e,stats:"s4"})),
];
export const eventSet=variant=>variant==="partial"?partialEvents:events;
const stamp=e=>e.at||e.step.at;
const clone=x=>structuredClone(x);
const inputSource=(e)=>{
  const base=source(e.step);
  return async url=>{
    if(e.failStats && url.includes("/teams/stats?") && url.includes("group=hitting"))
      throw new Error("人工測試：s3 團隊打擊資料處理失敗");
    if(e.failPitchers && url.includes("/people?") && url.includes("group=[pitching]"))
      throw new Error("人工測試：s4 先發成績查詢失敗");
    if(e.failCurrentBox && url.includes(`/game/${pk}/boxscore`))
      throw new Error("人工測試：本場 boxscore 查詢失敗");
    const data=await base(url);
    if(e.stats==="s1")return data;
    const out=clone(data);
    if(url.includes("/teams/stats?")&&url.includes("group=hitting"))
      for(const row of out.stats?.[0]?.splits||[])row.stat.ops=e.stats==="s2"
        ? row.team.id===113?".760":".620" : e.stats==="s3" ? row.team.id===113?".780":".610" : row.team.id===113?".790":".600";
    if(url.includes("/people?")&&url.includes("statSplits"))
      for(const p of out.people||[])for(const split of p.stats?.[0]?.splits||[])
        if(split.stat?.ops)split.stat.ops=e.stats==="s2"?".731":e.stats==="s3"?".742":".753";
    return out;
  };
};

const off=(date,state="confirmed_off",extra={})=>({date,state,gameType:"R",...extra});
const initial=()=>({gamePk:pk,season:2027,gameType:"R",officialDate:"2027-04-20",startUTC:"2027-04-20T23:10:00Z",phase:"scheduled",
  scheduleVersion:null,sources:{
    schedule:{state:"not_acquired",version:null,usedVersion:null,season:2027,gameType:"R"},
    lineup:{state:"unpublished",version:null,usedVersion:null,season:2027,gameType:"R"},
    stats:{state:"not_acquired",version:null,usedVersion:null,season:2027,gameType:"R",
      parts:Object.fromEntries(["sp","rec","ops","era","batters"].map(k=>[k,{version:null,usedVersion:null,lastGoodAt:null,state:"not_acquired"}]))},
    roster:{state:"not_acquired",version:null,usedVersion:null,season:2027,gameType:"R"}},
  bullpen:{days:[off("2027-04-17"),off("2027-04-18","played",{pitchingComplete:true}),off("2027-04-19")],version:"u1",usedVersion:null},
  contextDoneFor:{},contextVersions:{game:`${pk}/2027/R/113/158`,schedule:null,sp:null,rec:null,ops:null,bullpen:null},
  matchupBuiltFor:null,matchupSaved:null,post:{complete:false,inningsComplete:false,pitchingComplete:false}});
const pick=(rows,module)=>rows.find(r=>r.module===module);
const needs=action=>["更新","重算","追補"].includes(action);
const sessionName=n=>`session-${String(n).padStart(4,"0")}`;
export function validateSession(s){
  if(s?.schema!==1||!["base","partial"].includes(s.variant)||s.ledger?.gamePk!==pk||
     !Number.isInteger(s.nextIndex)||s.nextIndex<0||s.nextIndex>eventSet(s.variant).length||
     !Array.isArray(s.rounds)||s.rounds.length!==s.nextIndex)throw new Error("測試 checkpoint 結構或輪次不符");
  const l=s.ledger;
  if([l.sources.schedule.usedVersion,l.sources.lineup.usedVersion,l.sources.roster.usedVersion,l.sources.stats.usedVersion].some(Boolean)&&
     (!s.game||s.game.pk!==pk||!s.buildState?.games?.[pk]))throw new Error("完成標記缺已保存單場／state 輸出");
  if(l.matchupBuiltFor&&(!s.matchup||s.matchup.pk!==pk||!l.matchupSaved))throw new Error("對位完成標記缺輸出");
  if(Object.keys(l.contextDoneFor||{}).length&&!s.context)throw new Error("情境完成標記缺輸出");
  if(l.post.usedVersion&&(!s.post||!s.context?.post))throw new Error("賽後完成標記缺輸出");
  for(const part of Object.values(l.sources.stats.parts||{}))
    if(part.usedVersion&&!s.game)throw new Error("統計分項完成標記缺單場輸出");
  return s;
}
export function loadSession(dir){
  const files=fs.readdirSync(dir).filter(x=>/^session-\d{4}-[a-f0-9]+\.json$/.test(x)).sort().reverse();
  for(const file of files){try{
    const saved=JSON.parse(fs.readFileSync(path.join(dir,file),"utf8"));
    const body=JSON.stringify(saved.session);
    if(crypto.createHash("sha256").update(body).digest("hex")!==saved.sha256)continue;
    return validateSession(saved.session);
  }catch{ /* 中斷在寫入途中時，讀上一個完整 checkpoint */ }}
  throw new Error("沒有可讀且驗證通過的測試 checkpoint");
}
export function saveSession(dir,s){
  validateSession(s);fs.mkdirSync(dir,{recursive:true});
  const body=JSON.stringify(s),sha256=crypto.createHash("sha256").update(body).digest("hex");
  const file=path.join(dir,`${sessionName(s.nextIndex)}-${crypto.randomBytes(4).toString("hex")}.json`);
  fs.writeFileSync(file,JSON.stringify({sha256,session:s}),{flag:"wx"});
  // 每個 checkpoint 將輸出與完成標記寫在同一檔。若新檔寫一半就中斷，讀取時回退前一個驗證通過的檔。
}

export async function runTrial({variant="base",resume=null,stopAfter=null,checkpointDir=null}={}){
  if(resume)validateSession(resume);
  if(resume&&resume.variant!==variant)throw new Error("checkpoint 與案例版本不符");
  let ledger=resume?.ledger??initial(),buildState=resume?.buildState??{games:{}},game=resume?.game??null,
    bullpen=resume?.bullpen??null,context=resume?.context??null,matchup=resume?.matchup??null,post=resume?.post??null;
  const rounds=resume?.rounds??[], trialEvents=eventSet(variant);
  for(let index=resume?.nextIndex??0;index<trialEvents.length;index++){
    const e=trialEvents[index];
    const at=stamp(e),before={schedule:ledger.sources.schedule.usedVersion,lineup:ledger.sources.lineup.usedVersion,roster:ledger.sources.roster.usedVersion,
      stats:ledger.sources.stats.usedVersion,bullpen:ledger.bullpen.usedVersion,matchup:ledger.matchupBuiltFor,
      context:clone(ledger.contextDoneFor),post:ledger.post.usedVersion??null};
    const phase=e.step.status==="Final"?"final":e.step.status==="In Progress"?"live":"scheduled";
    ledger.phase=phase;
    ledger.sources.schedule={...ledger.sources.schedule,state:e.schedule===ledger.sources.schedule.usedVersion?"unchanged":"available",version:e.schedule,checkedAt:at};
    ledger.sources.lineup={...ledger.sources.lineup,state:e.lineupState || (e.lineup?e.lineup===ledger.sources.lineup.usedVersion?"unchanged":"available":"unpublished"),version:e.lineup,checkedAt:at};
    ledger.sources.roster={...ledger.sources.roster,state:e.lineupState || (e.lineup?e.lineup===ledger.sources.roster.usedVersion?"unchanged":"available":"not_acquired"),version:e.lineup,checkedAt:at};
    ledger.sources.stats={...ledger.sources.stats,state:e.statsState || (e.stats===ledger.sources.stats.usedVersion?"unchanged":"available"),version:e.stats,checkedAt:at,
      parts:Object.fromEntries(Object.entries(ledger.sources.stats.parts).map(([k,p])=>[k,{...p,version:e.stats}]))};
    if(e.post)ledger.post={...ledger.post,sourceVersion:e.post};
    const calls=[],errors=[],fetchJson=inputSource(e);
    let plan=planRound({now:at,games:[ledger]});
    const buildRows=["賽程","先發／官方九棒","本季統計"].map(m=>pick(plan,m));
    if(buildRows.some(r=>r.action==="更新")){
      calls.push("build-live.build");
      try{
        const candidate=clone(buildState); // build-live 會原地改 state；候選未驗證前不碰已提交 state
        const R=await build({fetchJson,now:new Date(at),state:candidate,prevGame:p=>p===pk?game:null});
        const fresh=R.games[pk];if(!fresh)throw new Error("build-live 未產生同一 gamePk");
        if(fresh.pk!==pk||fresh.failed?.game)throw new Error("單場身份或組資料失敗；不提交候選 state");
        buildState=R.state;game=fresh;ledger.matchupGame=fresh;ledger.startUTC=fresh.startUTC;ledger.officialDate=fresh.usDate;
        const failedPart=k=>["away","home"].some(side=>!!fresh[side]?.failed?.[k]);
        const failedError=what=>R.errors.some(x=>x.what===what);
        const lineupOk=!failedPart("lineup")&&!failedError(`boxscore ${pk}`);
        if(ledger.sources.schedule.usedVersion!==e.schedule){ledger.sources.schedule.usedVersion=e.schedule;ledger.sources.schedule.lastGoodAt=at;}
        if(e.lineup&&lineupOk&&ledger.sources.lineup.usedVersion!==e.lineup){ledger.sources.lineup.usedVersion=e.lineup;ledger.sources.lineup.lastGoodAt=at;}
        if(e.lineup&&lineupOk&&ledger.sources.roster.usedVersion!==e.lineup){ledger.sources.roster.usedVersion=e.lineup;ledger.sources.roster.lastGoodAt=at;}
        if(!lineupOk){ledger.sources.lineup.state="failed";ledger.sources.roster.state="failed";}
        const hasLineup=["away","home"].some(side=>!!fresh[side]?.lineup?.slots?.length);
        const ok={sp:!failedPart("sp")&&!failedError("pitchers"),rec:!failedPart("rec")&&!failedError("standings"),
          ops:!failedPart("ops")&&!failedError("team hitting"),era:!failedPart("era")&&!failedError("team pitching"),
          batters:!hasLineup?null:lineupOk&&!failedError("batters")};
        for(const [k,good] of Object.entries(ok)){
          const p=ledger.sources.stats.parts[k];
          if(good===null){p.state="not_applicable";delete p.error;}
          else if(good){if(p.usedVersion!==e.stats){p.usedVersion=e.stats;p.lastGoodAt=at;}p.state="available";delete p.error;}
          else {p.state="failed";p.error=R.errors.find(x=>({sp:"pitchers",rec:"standings",ops:"team hitting",era:"team pitching",batters:"batters"})[k]===x.what)?.error||"本場模組失敗";}
        }
        const complete=Object.values(ledger.sources.stats.parts).every(p=>p.state==="not_applicable"||(p.usedVersion===e.stats&&p.state!=="failed"));
        if(complete){if(ledger.sources.stats.usedVersion!==e.stats){ledger.sources.stats.usedVersion=e.stats;ledger.sources.stats.lastGoodAt=at;}ledger.sources.stats.state=e.statsState||"available";}
        else ledger.sources.stats.state="failed";
        errors.push(...R.errors.map(x=>`build-live.${x.what}：${x.error}`));
        ledger.scheduleVersion=ledger.sources.schedule.usedVersion;
        ledger.contextVersions.game=`${pk}/2027/R/${game.away.id}/${game.home.id}`;
        ledger.contextVersions.schedule=ledger.scheduleVersion;
        const partKey=k=>{const p=ledger.sources.stats.parts[k];return p.state==="failed"?`failed:${p.version}:using:${p.usedVersion??"none"}`:p.usedVersion;};
        ledger.contextVersions.sp=`${partKey("sp")}|${game.away.sp?.id}:${game.away.sp?.hand}|${game.home.sp?.id}:${game.home.sp?.hand}`;
        ledger.contextVersions.rec=partKey("rec");ledger.contextVersions.ops=partKey("ops");
      }catch(err){
        // 整場候選驗證失敗時，已提交輸出與 buildState 都沒有被修改。
        ledger.sources.stats.state="failed";
        errors.push(`build-live.build：${err.message}`);
      }
    }
    plan=planRound({now:at,games:[ledger]});
    if(needs(pick(plan,"牛棚").action)&&game){
      calls.push("bullpen.buildBullpen");
      try{const R=await buildBullpen({games:[game],fetchJson,nowISO:at});const b=R.files[pk];
        if(!b||b.status==="failed")throw new Error(b?.error||"牛棚輸出未取得");
        bullpen=b;ledger.bullpen.usedVersion=ledger.bullpen.version;ledger.bullpen.lastSuccessAt=at;
        ledger.contextVersions.bullpen=ledger.bullpen.usedVersion;
      }catch(err){errors.push(`bullpen.buildBullpen：${err.message}`);}
    }
    plan=planRound({now:at,games:[ledger]});
    const matchupRow=pick(plan,"投打對位");
    if(needs(matchupRow.action)&&game){
      calls.push("matchup.buildMatchup");
      try{const next=await buildMatchup(game,at,fetchJson);if(matchupState(game,next)!=="current")throw new Error("處理後對位仍不合既有基準");
        matchup=next;ledger.matchupSaved=next;ledger.matchupBuiltFor=matchupFingerprint(ledger);ledger.matchupSuccessAt=at;
      }catch(err){errors.push(`matchup.buildMatchup：${err.message}`);}
    }
    plan=planRound({now:at,games:[ledger]});
    const ctxRows=plan.filter(r=>r.module.startsWith("情境/")&&r.action==="重算");
    if(ctxRows.length&&game){
      calls.push("ctx.compute");
      try{const fresh=compute(game,bullpen,[game],at),recomputed=new Set(ctxRows.map(r=>r.module.slice(3)));
        fresh.checks=fresh.checks.map(c=>{
          const old=context?.checks?.find(x=>x.id===c.id);
          if(recomputed.has(c.id)||!old)return {...c,computedAt:at};
          const saved={...old};
          if(c.stale?.length)saved.stale=c.stale;
          return saved;
        });
        fresh.hits=fresh.checks.filter(c=>c.state==="hit").map(c=>c.id);
        context=decide(game,context,fresh,at);
        for(const r of ctxRows){const check=CHECKS.find(c=>`情境/${c.id}`===r.module);ledger.contextDoneFor[check.id]=contextFingerprint(ledger,check);}
        ledger.contextSuccessAt=at;
      }catch(err){errors.push(`ctx.compute：${err.message}`);}
    }
    if(phase!=="scheduled"&&context){calls.push("ctx.decide（凍結／沿用）");context=decide(game,context,context,at);}
    plan=planRound({now:at,games:[ledger]});
    if(pick(plan,"賽後結果")?.action==="追補"&&game){
      calls.push("post.summarizePost");
      try{post=summarizePost(entryOf(e.step),boxOf(e.step),at);
        ledger.post={...ledger.post,complete:post.complete,inningsComplete:!post.incomplete?.some(x=>x.includes("得分")),
          pitchingComplete:!post.incomplete?.some(x=>x.includes("投手")),usedVersion:e.post,checkedAt:at,lastSuccessAt:at};
        if(context)context={...context,post};
      }catch(err){errors.push(`post.summarizePost：${err.message}`);}
    }
    const after={schedule:ledger.sources.schedule.usedVersion,lineup:ledger.sources.lineup.usedVersion,roster:ledger.sources.roster.usedVersion,
      stats:ledger.sources.stats.usedVersion,bullpen:ledger.bullpen.usedVersion,matchup:ledger.matchupBuiltFor,
      context:clone(ledger.contextDoneFor),post:ledger.post.usedVersion??null};
    rounds.push({key:e.key,at,sourceVersions:{schedule:e.schedule,lineup:e.lineup,stats:e.stats,post:e.post??null},
      sourceStatsState:ledger.sources.stats.state,planBefore:buildRows.map(r=>({module:r.module,action:r.action})),
      calls,errors,before,after,contextRecomputed:ctxRows.map(r=>r.module.slice(3)),matchupState:game?matchupState(game,matchup):"unavailable",
      matchupSuccessAt:ledger.matchupSuccessAt??null,contextSuccessAt:ledger.contextSuccessAt??null,
      contextChecks:context?.checks?.map(x=>({id:x.id,state:x.state}))??[],postComplete:post?.complete??null,
      contextEvidenceSha256:context?.checks?crypto.createHash("sha256").update(JSON.stringify(context.checks)).digest("hex"):null,
      frozenAt:context?.frozen?.at??null});
    const session={schema:1,variant,nextIndex:index+1,ledger,buildState,game,bullpen,context,matchup,post,rounds};
    validateSession(session);
    if(checkpointDir)saveSession(checkpointDir,session);
    if(e.key===stopAfter)break;
  }
  const completed=rounds.length===trialEvents.length;
  if(completed){
  assert.equal(new Set(rounds.map(x=>pk)).size,1);
  const by=key=>rounds.find(x=>x.key===key);
  assert.equal(by("official").matchupState,"current");
  assert.equal(by("recalc_failed").matchupState,"stale");
  assert.equal(by("recalc_failed").after.matchup,by("official").after.matchup);
  assert.equal(by("recalc_failed").matchupSuccessAt,by("official").matchupSuccessAt);
  assert.equal(by("recalc_ok").matchupState,"current");
  assert.equal(by("stat_update").after.stats,"s2");
  assert.notEqual(by("stat_update").after.matchup,by("recalc_ok").after.matchup);
  assert.deepEqual(by("same_version").calls,[]);
  assert.equal(by("stat_failed").after.stats,"s2");
  assert.equal(by("stat_recovered").after.stats,"s3");
  assert.equal(by("stat_recovered").sourceStatsState,"unchanged");
  assert.ok(by("stat_recovered").calls.includes("matchup.buildMatchup"));
  assert.equal(by("final_partial").postComplete,false);
  assert.equal(by("final_complete").postComplete,true);
  assert.equal(by("live").frozenAt,by("final_complete").frozenAt);
  assert.equal(by("live").contextEvidenceSha256,by("final_complete").contextEvidenceSha256);
  assert.equal(by("live").after.matchup,by("final_complete").after.matchup);
  assert.ok(by("stat_update").contextChecks.some(x=>x.id==="ops"));
  assert.deepEqual([...by("stat_update").contextRecomputed].sort(),["home","l10","ops","rapg","rpg","whip"].sort());
  assert.equal(by("no_lineup").contextChecks.find(x=>x.id==="ops").state,"miss");
  assert.equal(by("stat_update").contextChecks.find(x=>x.id==="ops").state,"hit");
  if(variant==="partial"){
    assert.equal(by("box_failed").after.schedule,"g1");
    assert.equal(by("box_failed").after.lineup,null);
    assert.equal(by("box_failed").after.roster,null);
    assert.equal(by("box_recovered").after.lineup,"l1");
    assert.equal(by("box_recovered").after.roster,"l1");
    assert.equal(by("pitchers_failed").after.stats,"s3");
    assert.equal(by("pitchers_failed").after.lineup,"l2");
    assert.equal(by("pitchers_recovered").sourceStatsState,"unchanged");
    assert.equal(by("pitchers_recovered").after.stats,"s4");
  }
  }
  const finalState={schema:1,variant,nextIndex:rounds.length,ledger,buildState,game,bullpen,context,matchup,post,rounds};
  validateSession(finalState);
  return {meta:{gamePk:pk,variant,completed,kind:"人工來源離線串接",rules:"只在成功後提交處理版；模組呼叫不是 HTTP 次數",source:"same-game-fixture.mjs；既有 build-live／bullpen／matchup／ctx／post"},rounds,finalState};
}

export function renderTrial(result){
  const count=Object.entries(result.rounds.flatMap(r=>r.calls).reduce((o,k)=>(o[k]=(o[k]||0)+1,o),{})).map(([k,n])=>`${k} ${n} 次`).join("、");
  const lines=["# 更新決策與既有試跑執行串接", "", "人工 2027 同一 gamePk 離線輸入；使用既有處理函式，沒有外部 HTTP、排程或正式資料寫入。模組函式呼叫次數不是 HTTP 請求量或供應商帳單。", "", `本演練實際函式呼叫：${count}。`, "", "| 輪次／時間 UTC | 來源版 | 規劃後實際呼叫 | 失敗 | 已完成版及變化 | 對位與情境 |", "|---|---|---|---|---|---|"];
  for(const r of result.rounds){const v=r.after,w=r.before,changed=["schedule","lineup","roster","stats","bullpen","post"].filter(k=>v[k]!==w[k]).map(k=>`${k}:${w[k]||"—"}→${v[k]||"—"}`);lines.push(`| ${r.key} ${r.at} | game ${r.sourceVersions.schedule}、lineup ${r.sourceVersions.lineup||"—"}、stats ${r.sourceVersions.stats}（${r.sourceStatsState}）、post ${r.sourceVersions.post||"—"} | ${r.calls.join("、")||"無；同版沿用"} | ${r.errors.join("；")||"無"} | game ${v.schedule||"—"}／lineup ${v.lineup||"—"}／roster ${v.roster||"—"}／stats ${v.stats||"—"}／bullpen ${v.bullpen||"—"}／post ${v.post||"—"}；變化 ${changed.join("、")||"無"} | 對位 ${r.matchupState}（最後成功 ${r.matchupSuccessAt||"無"}）；本輪情境輸入變動 ${r.contextRecomputed.join(",")||"無"}（最後成功 ${r.contextSuccessAt||"無"}） |`);}
  lines.push("",`賽前情境 checks SHA-256：開賽凍結 ${result.rounds.find(x=>x.key==="live").contextEvidenceSha256}；賽後完整 ${result.rounds.find(x=>x.key==="final_complete").contextEvidenceSha256}。兩者相同；完整逐輪指紋在同目錄 JSON。`);
  lines.push("", "## 查核重點", "", "- `recalc_failed` 的新先發／九棒已進單場資料，但 matchup 舊版與最後成功時間保留；既有 `matchupState` 標 stale，不能當新對位。`recalc_ok` 用相同版本恢復後才提交新指紋。", "- `stat_update` 先讓 build-live 成功處理新統計版，同輪再次規劃才准 matchup 與 OPS／WHIP／戰績相依情境使用它；六條統計相依條件重算，兩條牛棚條件沿用。`same_version` 沒有模組函式呼叫。", "- `stat_failed` 的 s3 來源處理失敗，已完成版仍為 s2；舊對位的 current 僅指對已完成 s2 與已保存名單仍適用，並非 s3 已成功。最後成功時間照列。`stat_recovered` 的來源內容即使標 unchanged，s3 仍會補處理。", "- `live` 凍結最後成功賽前內容；Final 的逐局未齊與完整分兩輪，post 另存，不改對位與賽前情境版本。", "- 情境範圍直接取 `ctx.CHECKS` 九條；跨 S／R 或牛棚缺值時僅 `bp_load`、`bp_streak` 暫不判定，其餘條件按各自相依輸入。規則門檻沒有變。", "", "## 待供應商確認", "", "正式 feed 的版本／更新事件、可用時間、額度、重試與授權、可重用期限及費用；這些尚未由人工離線回應證明。", "");
  return lines.join("\n");
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const arg=name=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:null;};
  const dir=arg("--state-dir"),variant=arg("--variant")||"base",resume=process.argv.includes("--resume")?(dir?loadSession(dir):null):null;
  const r=await runTrial({variant,resume,stopAfter:arg("--stop-after"),checkpointDir:dir});
  process.stdout.write(r.meta.completed?renderTrial(r):`CHECKPOINT ${variant} ${r.rounds.at(-1)?.key} ${r.finalState.nextIndex}\n`);
}

