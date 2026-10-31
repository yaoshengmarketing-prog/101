import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import {runDelivery,projectPreview} from "./update-preview-delivery.mjs";
import {loadSession} from "./update-execution-trial.mjs";

const outDir=fs.mkdtempSync(path.join(os.tmpdir(),"mlb-delivery-check-"));
const first=runDelivery({outDir,sourceCommit:"人工測試原始版本"});
const {preview:p,checkpointDir,previewDir}=first;
assert.equal(p.stages.length,3);
assert.equal(p.stages[0].sourceView.parts.sp.state,"failed");
assert.equal(p.stages[0].sourceView.parts.sp.lastGoodAt,"2027-04-20T22:30:00Z");
assert.equal(p.stages[0].sourceView.parts.ops.usedVersion,"s4");
assert.equal(p.stages[0].game.away.failed.sp.fetchedAt,"2027-04-20T22:30:00.000Z");
assert.equal(p.stages[1].sourceView.stats.usedVersion,"s4");
assert.equal(p.stages[1].matchupStatus,"current");
assert.equal(p.stages[2].game.status.code,"final");
assert.equal(p.stages[2].pregame.game.status.code,"pre");
assert.equal(p.stages[2].pregame.game.away.lineup.slots[0].id,991010);
assert.equal(p.stages[2].pregameSha256,p.stages[1].pregameSha256);
assert.equal(p.stages[2].post.complete,true);
assert.equal(p.meta.oneGameRecord,1);
for(const file of ["index.html","game.html","app.js","style.css","resume-data.js","README.md"])
  assert.ok(fs.statSync(path.join(previewDir,file)).size>0,file);
const dataJs=fs.readFileSync(path.join(previewDir,"resume-data.js"),"utf8");
for(const secret of ["buildState","checkpointDir","rounds","https://statsapi.mlb.com"])
  assert.ok(!dataJs.includes(secret),`公開投影不含 ${secret}`);
const win={};vm.runInNewContext(dataJs,{window:win});
const appJs=fs.readFileSync(path.join(previewDir,"app.js"),"utf8");
const render=(page,search)=>{
  const app={innerHTML:""},elements={".mast-id":{},".brand":{},".site-foot":{}};
  vm.runInNewContext(appJs,{window:win,document:{body:{dataset:{page}},getElementById:()=>app,querySelector:k=>elements[k]},
    location:{search},URLSearchParams,encodeURIComponent});
  return app.innerHTML;
};
const home=render("home","?trial=resume");
const fail=render("game","?trial=resume&step=0");
const recovered=render("game","?trial=resume&step=1");
const post=render("game","?trial=resume&step=2");
assert.ok(home.includes("game.html?trial=resume&step=0"));
assert.ok(fail.includes("本輪先發成績取得失敗")&&fail.includes("團隊 OPS")&&fail.includes("s4"));
assert.ok(fail.includes("測試打者 A10")&&fail.includes("2027-04-20T22:30:00.000Z"));
assert.ok(recovered.includes("新 Node 程序恢復成功")&&recovered.includes("對位 current"));
assert.ok(!recovered.includes("本輪先發成績取得失敗"));
assert.ok(post.includes("完賽・資料完整")&&post.includes("展開當時保存的賽前研究資料"));
assert.ok(post.includes("測試先發 B2")&&post.includes("測試打者 A10"));
for(const page of [fail,recovered,post])assert.ok(page.includes("index.html?trial=resume"));

const filesBefore=fs.readdirSync(previewDir).sort();
const bad=loadSession(checkpointDir,"final_complete");bad.pregame.game.status.code="final";
assert.throws(()=>projectPreview({failed:loadSession(checkpointDir,"pitchers_failed"),
  recovered:loadSession(checkpointDir,"pitchers_recovered"),final:bad}),/賽前保存內容缺同場賽前身份/);
assert.deepEqual(fs.readdirSync(previewDir).sort(),filesBefore);
const replay=runDelivery({outDir,sourceCommit:"人工測試原始版本",fromCheckpoints:checkpointDir});
assert.notEqual(replay.previewDir,previewDir);
assert.deepEqual(replay.preview,p);
assert.deepEqual(fs.readdirSync(previewDir).sort(),filesBefore);
process.stdout.write(JSON.stringify({states:p.stages.map(x=>({key:x.key,stats:x.sourceView.stats.usedVersion,
  sp:x.sourceView.parts.sp.usedVersion,ops:x.sourceView.parts.ops.usedVersion,post:x.post?.complete??null})),
  frozenPregameSha256:p.meta.frozenPregameSha256,htmlScreens:[home.length,fail.length,recovered.length,post.length],
  replayFromSavedCheckpoints:true,invalidExportKeptPrevious:true},null,2)+"\n");

