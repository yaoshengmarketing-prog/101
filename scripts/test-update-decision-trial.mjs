import assert from "node:assert/strict";
import { demoCases, matchupFingerprint, planRound, reusable, stageOf } from "./update-decision-trial.mjs";

const cases = demoCases();
const find = (rows, pk, module) => {
  const r = rows.find(x => x.gamePk === pk && x.module === module);
  assert.ok(r, `${pk} ${module} 必須有判斷`);
  return r;
};
const [a,b,c,repeat,d] = cases.map(x => ({ ...x, rows: planRound(x) }));

assert.equal(a.games.length, 5);
assert.equal(stageOf(a.games[0], a.now), "pre");
assert.equal(stageOf(a.games[1], a.now), "near");
assert.equal(stageOf(a.games[2], a.now), "live");
assert.equal(stageOf(a.games[3], a.now), "final_partial");
assert.equal(stageOf(a.games[4], a.now), "final_complete");
assert.equal(find(a.rows, 910001, "本季統計").action, "更新");
assert.equal(find(a.rows, 910001, "投打對位").action, "重算");
assert.equal(find(a.rows, 910002, "先發／官方九棒").action, "檢查來源");
assert.equal(find(a.rows, 910002, "本季統計").action, "重試來源");
assert.equal(find(a.rows, 910002, "預估").action, "待使用條件");
assert.equal(find(a.rows, 910002, "模型天氣").action, "待使用條件");
assert.equal(find(a.rows, 910003, "情境").action, "沿用凍結版");
assert.equal(find(a.rows, 910004, "賽後結果").action, "追補");
assert.equal(find(a.rows, 910005, "賽後結果").action, "暫不查");

assert.equal(find(b.rows, 920001, "賽後結果").action, "沿用已得部分");
assert.equal(find(b.rows, 920002, "牛棚").action, "重算");
assert.match(find(b.rows, 920002, "牛棚").reason, /不依賴逐局或 post.complete/);
assert.equal(b.games[1].bullpen.days.length, 3);
assert.deepEqual(b.games[1].bullpen.days.map(x=>x.date),["2027-04-17","2027-04-18","2027-04-19"]);
assert.equal(b.games[1].bullpen.today.date,"2027-04-20");
const wrongWindow={...b.games[1],bullpen:{...b.games[1].bullpen,days:[...b.games[1].bullpen.days.slice(1),b.games[1].bullpen.today]}};
assert.equal(find(planRound({now:b.now,games:[wrongWindow]}),920002,"牛棚").action,"等待必要資料");

assert.deepEqual(c.games[0].matchupInput, repeat.games[0].matchupInput);
assert.equal(find(c.rows, 930001, "投打對位").action, "重算");
assert.equal(find(repeat.rows, 930001, "投打對位").action, "沿用");
assert.equal(find(repeat.rows, 930001, "本季統計").action, "沿用");
assert.notEqual(c.games[0].matchupBuiltFor, matchupFingerprint(c.games[0]));

assert.equal(d.games.filter(x=>x.officialDate === "2027-04-20" && x.phase === "scheduled").length, 0);
assert.equal(find(d.rows, 940001, "賽後結果").action, "追補");
assert.equal(stageOf(d.games[1], d.now), "near");
assert.equal(find(d.rows, 940002, "先發／官方九棒").action, "檢查來源");
assert.equal(stageOf(d.games[2], d.now), "postponed");
assert.equal(find(d.rows, 940003, "先發／官方九棒").action, "暫不查");
assert.equal(find(d.rows, 940003, "賽程").action, "更新");
assert.match(find(d.rows, 940003, "先發／官方九棒").basis, /2027-04-22T22:00:00Z/);

const g = a.games[0];
const scopeBad = { ...g, sources:{...g.sources,stats:{...g.sources.stats,gameType:"S"}} };
assert.equal(find(planRound({now:a.now,games:[scopeBad]}),g.gamePk,"本季統計").action,"待範圍核對");
assert.equal(find(planRound({now:a.now,games:[scopeBad]}),g.gamePk,"投打對位").action,"等待必要資料");
const shortLineup={...g,matchupInput:{...g.matchupInput,awayLineup:g.matchupInput.awayLineup.slice(0,8)}};
assert.equal(find(planRound({now:a.now,games:[shortLineup]}),g.gamePk,"投打對位").action,"等待必要資料");
const confirmedOff = { ...g, sources:{...g.sources,lineup:{state:"confirmed_off",version:null,season:2027,gameType:"R"}} };
assert.equal(find(planRound({now:a.now,games:[confirmedOff]}),g.gamePk,"先發／官方九棒").action,"沿用");
const unchanged = { ...g, sources:{...g.sources,stats:{...g.sources.stats,state:"unchanged",checkedAt:a.now}} };
assert.equal(find(planRound({now:a.now,games:[unchanged]}),g.gamePk,"本季統計").action,"沿用");
const failed = { ...g, sources:{...g.sources,weather:{state:"failed",checkedAt:a.now,lastGoodAt:"2027-04-20T18:00:00Z",season:2027,gameType:"R"}} };
assert.equal(find(planRound({now:a.now,games:[failed],optionalRights:{projection:false,weather:true}}),g.gamePk,"模型天氣").action,"沿用舊值");

const spring = { ...g, bullpen:{days:[{date:g.bullpen.days[0].date,state:"played",gameType:"S",pitchingComplete:true},...g.bullpen.days.slice(1)],version:"spring-v1",usedVersion:"old"} };
assert.equal(find(planRound({now:a.now,games:[spring]}),g.gamePk,"牛棚").action,"重算");
assert.equal(find(planRound({now:a.now,games:[spring]}),g.gamePk,"情境").action,"暫不判定");

const cache={kind:"player-stats",id:11,season:2027,gameType:"R",version:"stat-2",acquiredAt:"2027-04-20T19:00:00Z",validUntil:"2027-04-20T21:00:00Z"};
assert.equal(reusable(cache,{...cache},a.now),true);
for (const changed of [{season:2026},{gameType:"S"},{version:"stat-3"},{id:12},{validUntil:"2027-04-20T19:59:59Z"}])
  assert.equal(reusable({...cache,...changed},{...cache},a.now),false,JSON.stringify(changed));

console.log("更新決策離線演練：四組情況與範圍、狀態、共用鍵檢查通過");

