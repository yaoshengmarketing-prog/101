// 由既有離線執行 checkpoint 匯出新版頁面所需欄位；不接外部來源、不寫正式資料。
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {loadSession,validateSession} from "./update-execution-trial.mjs";
import {matchupState} from "./matchup.mjs";

const runner=fileURLToPath(new URL("./update-execution-trial.mjs",import.meta.url));
const sha=x=>crypto.createHash("sha256").update(JSON.stringify(x)).digest("hex");
const fields=(x,keys)=>x==null?null:Object.fromEntries(keys.filter(k=>x[k]!==undefined).map(k=>[k,x[k]]));
const projectSlot=x=>fields(x,["n","id","name","pos","avg","ops","pa","statStatus"]);
const projectSide=t=>({
  ...fields(t,["id","ab","name","score","rec","gp","ops","era","statStatus"]),
  sp:t.sp?{...fields(t.sp,["id","name","hand","s","statStatus","statsScope","firstSeen"])}:null,
  lineup:t.lineup?{...fields(t.lineup,["state","firstSeen","lateAt","statsScope"]),slots:t.lineup.slots?.map(projectSlot)??null}:null,
  roster:t.roster?.map(x=>fields(x,["id","name","pos"]))??null,
  prev:t.prev?{...fields(t.prev,["pk","date","gameType","ha","opp","score"]),slots:t.prev.slots?.map(projectSlot)??null}:null,
  failed:fields(t.failed||{},["sp","lineup","rec","ops","era","prev"])
});
const projectGame=g=>({
  ...fields(g,["pk","season","statsScope","twDate","usDate","startUTC","twTime","venue","status","gameType","weather"]),
  away:projectSide(g.away),home:projectSide(g.home)
});
const projectContext=c=>c?{
  ...fields(c,["rules","updatedAt","phase","sample","frozen"]),
  checks:c.checks.map(x=>fields(x,["id","title","threshold","state","why","value","stale","computedAt"])),
  bp:c.bp?Object.fromEntries(["away","home"].map(k=>[k,fields(c.bp[k],["text","partial"])])):null
}:null;
const projectBullpen=b=>b?{
  ...fields(b,["rules","fetchedAt","status","scope"]),window:fields(b.window,["full","today"]),
  summary:Object.fromEntries(["away","home"].map(k=>{
    const s=b.summary[k];return [k,{
      days:s.days.map(d=>({...fields(d,["d","st","complete","gamesMissing"]),games:d.games?.map(g=>fields(g,["pk","gameType"]))??[]})),
      recentUsage:s.recentUsage?.map(x=>fields(x,["pk","day","season","gameType","id","name","ip","pitches","completeness"]))??[]
    }];}))
}:null;
const projectMatchup=m=>m?{
  ...fields(m,["pk","fetchedAt"]),pairs:m.pairs.map(p=>({
    ...fields(p,["pitcherSide","pitcher","splits","splitStatus","recentStatus"]),
    recent:p.recent?fields(p.recent,["starts","totalStarts"]):null,
    lineup:p.lineup?{slots:p.lineup.slots?.map(x=>fields(x,["n","id","name","vs","why"]))??[]}:null
  }))
}:null;
const projectPost=p=>p?fields(p,["status","complete","incomplete","fetchedAt","final","innings","notPlayed","missing","pitching"]):null;
const projectSource=s=>({
  schedule:fields(s.schedule,["state","version","usedVersion","receivedAt","lastGoodAt","checkedAt"]),
  lineup:fields(s.lineup,["state","version","usedVersion","receivedAt","lastGoodAt","checkedAt"]),
  roster:fields(s.roster,["state","version","usedVersion","receivedAt","lastGoodAt","checkedAt"]),
  stats:fields(s.stats,["state","version","usedVersion","receivedAt","lastGoodAt","checkedAt"]),
  parts:Object.fromEntries(Object.entries(s.stats.parts).map(([k,v])=>[k,fields(v,["state","version","usedVersion","receivedAt","lastGoodAt","checkedAt","error"])]))
});
function projectStage(s,key,label){
  validateSession(s);
  assert.equal(s.rounds.at(-1)?.key,key);
  assert.ok(s.game?.pk&&s.pregame?.game?.pk===s.game.pk&&s.bullpen&&s.context&&s.matchup);
  const isPost=key==="final_complete",saved=isPost?s.pregame:null;
  if(isPost)assert.ok(s.post?.complete&&s.context.frozen&&saved.game.status.code==="pre");
  const sourceView=projectSource(saved?.sources??s.ledger.sources);
  const stage={key,label,at:s.rounds.at(-1).at,
    game:projectGame(s.game),context:projectContext(s.context),bullpen:projectBullpen(s.bullpen),
    matchup:projectMatchup(s.matchup),matchupStatus:matchupState(s.game,s.matchup),
    post:projectPost(s.post),pregame:saved?{
      savedAt:saved.savedAt,game:projectGame(saved.game),context:projectContext(saved.context),
      bullpen:projectBullpen(saved.bullpen),matchup:projectMatchup(saved.matchup),matchupStatus:saved.matchupStatus
    }:null,
    pregameSha256:sha(s.pregame),sourceView:{...sourceView,status:key==="pitchers_failed"?"投手資料未完成，團隊資料可讀":isPost?"凍結後重啟，賽後另存":"新 Node 程序恢復成功"}
  };
  if(!isPost&&stage.matchupStatus!=="current")stage.matchup=null;
  if(isPost){
    assert.equal(stage.pregame.matchupStatus,"current");
    assert.equal(stage.pregame.game.status.code,"pre");
    assert.notEqual(stage.game.status.code,"pre");
  }
  return stage;
}
export function projectPreview(snapshots,sourceCommit="待提交"){
  const stages=[
    projectStage(snapshots.failed,"pitchers_failed","1 投手成績未取得"),
    projectStage(snapshots.recovered,"pitchers_recovered","2 重啟後補齊"),
    projectStage(snapshots.final,"final_complete","3 凍結後賽後回看")
  ];
  assert.equal(new Set(stages.map(x=>x.game.pk)).size,1);
  assert.equal(stages[1].pregameSha256,stages[2].pregameSha256);
  assert.equal(stages[0].sourceView.parts.sp.usedVersion,"s3");
  assert.equal(stages[0].sourceView.parts.ops.usedVersion,"s4");
  assert.equal(stages[1].sourceView.stats.usedVersion,"s4");
  assert.equal(stages[2].sourceView.stats.usedVersion,"s4");
  return {meta:{title:"保存輸出到新版頁面離線交付",gamePk:stages[0].game.pk,sourceCommit,
    warning:"2027 比賽、球員與回應均為人工測試。資料由既有函式處理、JSON checkpoint 保存，再由新 Node 程序續跑；非真實來源或正式更新。",
    frozenPregameSha256:stages[2].pregameSha256,oneGameRecord:1},stages};
}
function writeUnique(outDir,preview){
  const js=`window.MLB_UPDATE_RESUME_TRIAL = ${JSON.stringify(preview)};\n`;
  const version=sha(preview).slice(0,12),dir=path.join(outDir,`review-${version}-${crypto.randomBytes(4).toString("hex")}`);
  const source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../preview/mlb-next");
  const html=page=>`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>運彩101｜保存與重啟離線預覽</title><link rel="stylesheet" href="style.css"></head><body data-page="${page}"><div class="site-shell"><header class="mast"><a class="brand" href="index.html?trial=resume"><span>運彩 101<small>把一場比賽該看的資料，整理在同一頁。</small></span></a><div class="mast-right"><span class="draft-pill">獨立測試預覽</span><span class="mast-id">MLB / 2027 人工試跑</span></div></header><main id="app"></main><footer class="site-foot">人工來源的離線保存與重啟試跑；非正式網站。<a href="README.md">資料與版本說明</a></footer></div><script src="resume-data.js"></script><script src="app.js"></script></body></html>\n`;
  fs.mkdirSync(dir,{recursive:false});
  fs.writeFileSync(path.join(dir,"resume-data.js"),js,{flag:"wx"});
  for(const file of ["app.js","style.css"])
    fs.copyFileSync(path.join(source,file),path.join(dir,file),fs.constants.COPYFILE_EXCL);
  for(const page of ["index","game"])
    fs.writeFileSync(path.join(dir,`${page}.html`),html(page==="index"?"home":"game"),{flag:"wx"});
  fs.writeFileSync(path.join(dir,"README.md"),`# 獨立測試預覽\n\n來源程式 ${preview.meta.sourceCommit}。2027 內容是人工回應經既有處理函式、checkpoint 及跨程序接續產出；非真實賽程。\n\n只公開頁面所需欄位；完整 checkpoint 與工作紀錄留在測試目錄。正式 /live/、資料與排程未變。\n`,{flag:"wx"});
  return dir;
}
function processRound(dir,stopAfter,resume=false){
  const args=[runner,"--variant","partial","--state-dir",dir];
  if(resume)args.push("--resume");
  if(stopAfter)args.push("--stop-after",stopAfter);
  execFileSync(process.execPath,args,{encoding:"utf8",timeout:240000,maxBuffer:1024*1024});
  return loadSession(dir);
}
export function runDelivery({outDir,sourceCommit="待提交",fromCheckpoints=null}){
  assert.ok(outDir,"需要 --out-dir 測試專用輸出目錄");
  fs.mkdirSync(outDir,{recursive:true});
  const checkpointDir=fromCheckpoints||fs.mkdtempSync(path.join(outDir,"checkpoints-"));
  const failed=fromCheckpoints?loadSession(checkpointDir,"pitchers_failed"):processRound(checkpointDir,"pitchers_failed");
  const recovered=fromCheckpoints?loadSession(checkpointDir,"pitchers_recovered"):processRound(checkpointDir,"pitchers_recovered",true);
  const live=fromCheckpoints?loadSession(checkpointDir,"live"):processRound(checkpointDir,"live",true);
  assert.equal(live.context?.frozen?.at,live.rounds.at(-1).at);
  const final=fromCheckpoints?loadSession(checkpointDir,"final_complete"):processRound(checkpointDir,null,true);
  const preview=projectPreview({failed,recovered,final},sourceCommit);
  const previewDir=writeUnique(outDir,preview);
  return {previewDir,checkpointDir,preview};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const arg=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
  const outDir=arg("--out-dir")||path.join(os.tmpdir(),"mlb-update-delivery");
  const result=runDelivery({outDir,sourceCommit:arg("--source-commit")||"待提交",fromCheckpoints:arg("--from-checkpoints")});
  process.stdout.write(JSON.stringify({previewDir:result.previewDir,checkpointDir:result.checkpointDir,
    gamePk:result.preview.meta.gamePk,stages:result.preview.stages.map(s=>({key:s.key,checkedAt:s.at,
      schedule:s.sourceView.schedule.usedVersion,lineup:s.sourceView.lineup.usedVersion,
      stats:s.sourceView.stats.usedVersion,sp:s.sourceView.parts.sp.usedVersion,ops:s.sourceView.parts.ops.usedVersion,
      matchup:s.matchupStatus,postComplete:s.post?.complete??null,pregameSha256:s.pregameSha256}))},null,2)+"\n");
}

