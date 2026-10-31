import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {runTrial,loadSession,saveSession} from "./update-execution-trial.mjs";

const runner=fileURLToPath(new URL("./update-execution-trial.mjs",import.meta.url));
const copy=o=>JSON.parse(JSON.stringify(o));
const runNode=(...args)=>execFileSync(process.execPath,[runner,...args],{encoding:"utf8",timeout:240000,maxBuffer:1024*1024});
const by=(s,key)=>s.rounds.find(r=>r.key===key);
const effective=s=>({
  done:{sources:s.ledger.sources,bullpen:s.ledger.bullpen,matchupBuiltFor:s.ledger.matchupBuiltFor,
    contextDoneFor:s.ledger.contextDoneFor,post:s.ledger.post},
  output:{buildState:s.buildState,game:s.game,bullpen:s.bullpen,context:s.context,matchup:s.matchup,post:s.post,pregame:s.pregame}
});

const base=await runTrial();
const partial=await runTrial({variant:"partial"});
assert.equal(base.rounds.length,11);
assert.equal(partial.rounds.length,15);
const boxFail=by(partial.finalState,"box_failed"),boxRecover=by(partial.finalState,"box_recovered");
const boxOnly=(await runTrial({variant:"partial",stopAfter:"box_failed"})).finalState;
assert.ok(boxFail.errors.some(x=>x.includes("boxscore")));
assert.equal(boxFail.after.schedule,"g1");
assert.equal(boxFail.after.lineup,null);
assert.equal(boxFail.after.roster,null);
assert.equal(boxOnly.ledger.sources.lineup.state,"failed");
assert.equal(boxOnly.ledger.sources.roster.state,"failed");
assert.equal(boxOnly.ledger.sources.lineup.lastGoodAt,undefined);
assert.ok(boxOnly.game.away.failed.lineup);
assert.ok(Object.values(boxOnly.ledger.sources.stats.parts).every(x=>x.state==="available"||x.state==="not_applicable"));
assert.equal(boxRecover.after.lineup,"l1");
assert.equal(boxRecover.after.roster,"l1");
const spFail=by(partial.finalState,"pitchers_failed"),spRecover=by(partial.finalState,"pitchers_recovered");
assert.ok(spFail.errors.some(x=>x.includes("pitchers")));
assert.equal(spFail.after.stats,"s3");
assert.ok(!spFail.contextRecomputed.includes("whip"));
assert.ok(spFail.contextRecomputed.includes("ops"));
assert.equal(spRecover.after.stats,"s4");
assert.equal(spRecover.sourceStatsState,"unchanged");

async function restart(variant,stopAfter,baseline){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"mlb-update-restart-"));
  const stopped=runNode("--variant",variant,"--state-dir",dir,"--stop-after",stopAfter);
  assert.match(stopped,/^CHECKPOINT /);
  const checkpoint=loadSession(dir);
  assert.equal(checkpoint.rounds.at(-1).key,stopAfter);
  if(stopAfter==="pitchers_failed"){
    assert.equal(checkpoint.ledger.sources.stats.usedVersion,"s3");
    assert.equal(checkpoint.ledger.sources.stats.parts.sp.usedVersion,"s3");
    assert.equal(checkpoint.ledger.sources.stats.parts.sp.version,"s4");
    assert.equal(checkpoint.ledger.sources.stats.parts.sp.state,"failed");
    assert.equal(checkpoint.ledger.sources.stats.parts.ops.usedVersion,"s4");
    assert.equal(checkpoint.ledger.sources.stats.parts.sp.lastGoodAt,"2027-04-20T22:30:00Z");
    assert.equal(checkpoint.game.away.failed.sp.fetchedAt,"2027-04-20T22:30:00.000Z");
    assert.equal(checkpoint.game.home.failed.sp.fetchedAt,"2027-04-20T22:30:00.000Z");
  }
  if(stopAfter==="live"){
    assert.equal(checkpoint.context.frozen.at,by(baseline.finalState,"live").frozenAt);
    assert.equal(checkpoint.ledger.post.usedVersion,undefined);
  }
  const saved=fs.readdirSync(dir).sort();
  const invalid=copy(checkpoint);invalid.game=null;
  assert.throws(()=>saveSession(dir,invalid),/完成標記缺已保存/);
  assert.deepEqual(fs.readdirSync(dir).sort(),saved);
  fs.writeFileSync(path.join(dir,"session-9999-deadbeef.json"),'{"sha256":"interrupted"');
  assert.deepEqual(copy(loadSession(dir)),copy(checkpoint));
  runNode("--variant",variant,"--state-dir",dir,"--resume");
  const resumed=loadSession(dir);
  assert.deepEqual(copy(effective(resumed)),copy(effective(baseline.finalState)));
  assert.deepEqual(copy(resumed.rounds),copy(baseline.rounds));
  assert.equal(resumed.rounds.at(-1).contextEvidenceSha256,by(resumed,"live").contextEvidenceSha256);
  assert.equal(new Set(resumed.rounds.map(x=>x.after.schedule)).has("g5"),true);
  return {stopAfter,variant,checkpoint:dir,rounds:resumed.rounds.length,
    finalVersions:{schedule:resumed.ledger.sources.schedule.usedVersion,lineup:resumed.ledger.sources.lineup.usedVersion,
      stats:resumed.ledger.sources.stats.usedVersion,post:resumed.ledger.post.usedVersion},
    frozenHash:by(resumed,"live").contextEvidenceSha256};
}
const restartedAfterFailure=await restart("partial","pitchers_failed",partial);
const restartedAfterFreeze=await restart("base","live",base);
process.stdout.write(JSON.stringify({baseRounds:base.rounds.length,partialRounds:partial.rounds.length,
  boxFailure:{schedule:boxFail.after.schedule,lineup:boxFail.after.lineup,roster:boxFail.after.roster,recovered:boxRecover.after.lineup},
  pitcherFailure:{stats:spFail.after.stats,recovered:spRecover.after.stats,sourceState:spRecover.sourceStatsState},
  restartedAfterFailure,restartedAfterFreeze},null,2)+"\n");

