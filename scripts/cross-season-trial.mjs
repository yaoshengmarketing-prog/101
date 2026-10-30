// Branch-only, offline integration trial. All 2027 source responses below are artificial test input.
// The output is generated through build-live, bullpen, ctx, and roster functions, never hand-curated for the page.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { build } from "./build-live.mjs";
import { buildBullpen } from "./bullpen.mjs";
import { compute } from "./ctx.mjs";
import { basisOf, classify } from "./roster.mjs";

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, "..");
const nowISO = "2027-03-27T00:10:00Z";
const target = { pk: 9902701, gamePk: 9902701, officialDate: "2027-03-26", gameDate: "2027-03-26T23:10:00Z", gameType: "R",
  status: { abstractGameState: "Preview", detailedState: "Scheduled" }, venue: { name: "人工測試球場", timeZone: { id: "America/Chicago" } },
  teams: { away: { team: { id: 113, name: "Cincinnati Reds", abbreviation: "CIN" }, probablePitcher: { id: 990001, fullName: "測試先發 A" } },
    home: { team: { id: 158, name: "Milwaukee Brewers", abbreviation: "MIL" }, probablePitcher: { id: 990002, fullName: "測試先發 B" } } } };
const priorS = { ...target, pk: 9902698, gamePk: 9902698, officialDate: "2027-03-24", gameDate: "2027-03-24T21:10:00Z", gameType: "S",
  status: { abstractGameState: "Final", detailedState: "Final" }, teams: { away: { ...target.teams.away, score: 2 }, home: { ...target.teams.home, score: 3 } } };
const priorR = { ...target, pk: 9902700, gamePk: 9902700, officialDate: "2027-03-26", gameDate: "2027-03-26T23:10:00Z", gameType: "R",
  status: { abstractGameState: "Final", detailedState: "Final" }, teams: { away: { ...target.teams.away, score: 1 }, home: { ...target.teams.home, score: 4 } } };
const mkBox = (pk, missing = false) => {
  if (missing) throw new Error("人工測試：boxscore 取數失敗");
  const side = (base, letter) => {
    const players = {};
    for (let n = 1; n <= 9; n++) { const id = base + n; players["ID" + id] = { person: { id, fullName: `測試打者 ${letter}${n}` },
      battingOrder: String(n * 100), position: { abbreviation: n === 1 ? "CF" : "IF" } }; }
    const sid = base + 90, rid = base + 91;
    players["ID" + sid] = { person: { id: sid, fullName: `測試投手 ${letter}1` }, stats: { pitching: { inningsPitched: "3.0", numberOfPitches: 49 } } };
    players["ID" + rid] = { person: { id: rid, fullName: `測試投手 ${letter}2` }, stats: { pitching: { inningsPitched: "1.0", numberOfPitches: letter === "A" ? 77 : 8 } } };
    return { players, pitchers: [sid, rid] };
  };
  return { teams: { away: side(991000, "A"), home: side(992000, "B") }, gamePk: pk };
};
const fakeGames = [priorS, target];
const box = Object.fromEntries(fakeGames.map(g => [g.pk, mkBox(g.pk)]));
const splitDates = games => games.map(g => ({ date: g.officialDate, games: [g] }));
const seasonZero = { records: [{ teamRecords: [113, 158].map(id => ({ team: { id }, wins: 0, losses: 0, gamesPlayed: 0, winningPercentage: ".000", records: { splitRecords: [] } })) }] };
const ids = [990001, 990002, ...[991000, 992000].flatMap(base => Array.from({ length: 9 }, (_, i) => base + i + 1))];
const liveCalls = [];
const liveFetch = async url => {
  liveCalls.push(url);
  if (url.includes("/schedule?")) return { dates: splitDates(fakeGames) };
  if (url.includes("/standings?")) return seasonZero;
  if (url.includes("/teams/stats?")) return { stats: [{ splits: [] }] };
  if (url.includes("/people?")) return { people: ids.filter(id => url.includes(String(id))).map(id => ({ id, pitchHand: { code: "R" }, stats: [{ splits: [] }] })) };
  const pk = Number(url.match(/\/game\/(\d+)\/boxscore/)?.[1]); if (pk) return box[pk];
  throw new Error("未預期的人工來源 URL: " + url);
};
const live = await build({ fetchJson: liveFetch, now: new Date(nowISO) });
const opening = live.games[target.pk];
const ok = (name, truth) => { if (!truth) throw new Error("FAIL " + name); console.log("PASS " + name); };
ok("開幕場以 officialDate 定 2027 賽季、統計只查 2027 R", opening.season === "2027" && opening.statsScope.gameType === "R"
  && liveCalls.filter(x => /teams\/stats|people\?/.test(x)).every(x => x.includes("season=2027") && x.includes("gameType=R")));
ok("官方九棒從實際程式輸出；無本季成績和有效 0 分開", opening.lineup === "official" && opening.away.lineup.slots.length === 9
  && opening.away.lineup.slots.every(x => x.statStatus === "no_record" && x.ops === null)
  && opening.away.gp === 0 && opening.away.statStatus.rec === "no_record");
ok("春訓上一場保留參考身分、不能作名單增減基準", opening.away.prev.gameType === "S" && basisOf(opening, "away") === null);
const noBasis = classify({ listed: opening.away.roster, basis: null, m40: [], tx: [], today: opening.usDate });
ok("開幕無基準不報名單增減 0", noBasis.in.length === 0 && noBasis.out.length === 0 && opening.away.roster.length > 0);
const scopedFetch = async url => {
  if (url.includes("/standings?")) return { records: [{ teamRecords: [113,158].map(id => ({ team: { id }, wins: 1, losses: 0, gamesPlayed: 1, winningPercentage: "1.000", records: { splitRecords: [] } })) }] };
  if (url.includes("/teams/stats?")) return { stats: [{ splits: [113,158].map(id => ({ season: "2027", team: { id }, stat: url.includes("group=hitting") ? { ops: ".000" } : { era: "0.00" } })) }] };
  if (url.includes("/people?")) return { people: ids.filter(id => url.includes(String(id))).map(id => {
    const s = (gameType, stat) => ({ season: "2027", gameType, stat });
    const splits = id === 990001 ? [s("S",{ era:"0.00",whip:"0.50",inningsPitched:"9.0" }),s("R",{ wins:0,losses:0,era:"4.50",whip:"1.25",inningsPitched:"4.0" })]
      : id === 990002 ? [s("S",{ era:"0.00",inningsPitched:"5.0" })]
      : id === 991001 ? [s("S",{ ops:"2.000",plateAppearances:30 }),s("R",{ avg:".250",ops:".500",plateAppearances:4 })]
      : id === 991002 ? [s("S",{ ops:"1.000",plateAppearances:12 })]
      : id === 991003 ? [s("R",{ avg:".000",ops:".000",plateAppearances:3 })] : [];
    return { id, pitchHand: { code:"R" }, stats: [{ splits }] };
  }) };
  return liveFetch(url);
};
const small = (await build({ fetchJson: scopedFetch, now: new Date(nowISO) })).games[target.pk];
ok("2027 R 分項：少樣本 OPS／ERA／WHIP 與分母同存；S-only 不填入 R；有效 0 保留",
  small.away.sp.s.era === "4.50" && small.away.sp.s.whip === "1.25" && small.away.sp.s.ip === "4.0"
  && small.home.sp.s === null && small.home.sp.statStatus === "scope_unconfirmed"
  && small.away.lineup.slots[0].ops === ".500" && small.away.lineup.slots[0].pa === 4
  && small.away.lineup.slots[1].ops === null && small.away.lineup.slots[1].statStatus === "scope_unconfirmed"
  && small.away.lineup.slots[2].ops === ".000" && small.away.lineup.slots[2].pa === 3);
const wrongTeam = (await build({ fetchJson: async url => url.includes("/teams/stats?") && url.includes("group=hitting")
  ? { stats: [{ splits: [{ season: "2027", gameType: "S", team: { id: 113 }, stat: { ops: ".999" } }] }] }
  : scopedFetch(url), now: new Date(nowISO) })).games[target.pk];
ok("團隊回應只有 S 時，R OPS 不採用且標範圍未確認", wrongTeam.away.ops === null
  && wrongTeam.away.statStatus.ops === "scope_unconfirmed");

const makeCase = async (id, game, priors, failPk = null) => {
  const f = async url => {
    if (url.includes("gamePks=")) return { dates: splitDates([game]) };
    if (url.includes("teamId=")) return { dates: splitDates(priors) };
    const pk = Number(url.match(/\/game\/(\d+)\/boxscore/)?.[1]);
    if (pk) return mkBox(pk, pk === failPk);
    throw new Error("未預期的人工來源 URL: " + url);
  };
  const b = (await buildBullpen({ games: [{ pk: game.pk }], fetchJson: f, nowISO })).files[game.pk];
  const g = { ...opening, pk: game.pk, season: "2027", usDate: game.officialDate, startUTC: game.gameDate,
    gameType: "R", status: { code: "pre" }, updatedAt: nowISO };
  const c = compute(g, b, [], nowISO);
  return { id, game: { pk: game.pk, usDate: game.officialDate, gameType: "R", away: opening.away.ab, home: opening.home.ab },
    bullpen: { status: b.status, scope: b.scope, window: b.window, summary: b.summary, gamesMissing: b.gamesMissing },
    context: { bp_load: c.checks.find(x => x.id === "bp_load"), bp_streak: c.checks.find(x => x.id === "bp_streak") } };
};
const openingUsage = await makeCase("opening", target, [priorS]);
const transitionTarget = { ...target, pk: 9902702, gamePk: 9902702, officialDate: "2027-03-27", gameDate: "2027-03-27T23:10:00Z" };
const transitionFetch = async url => {
  if (url.includes("/schedule?")) return { dates: splitDates([priorS, priorR, transitionTarget]) };
  const pk = Number(url.match(/\/game\/(\d+)\/boxscore/)?.[1]); if (pk) return mkBox(pk);
  return liveFetch(url);
};
const transitionGame = (await build({ fetchJson: transitionFetch, now: new Date("2027-03-28T00:10:00Z") })).games[transitionTarget.pk];
ok("春訓銜接單場也由 build-live 產出，不借開幕場展示欄位", transitionGame.pk === transitionTarget.pk
  && transitionGame.usDate === "2027-03-27" && transitionGame.away.lineup.slots.length === 9);
const transition = await makeCase("transition", transitionTarget, [priorS, priorR]);
ok("前三完整美國賽程日含 S 與確認休兵：近期登板保留 S、兩條情境暫不判定",
  transition.bullpen.window.full.join(",") === "2027-03-24,2027-03-25,2027-03-26"
  && transition.bullpen.summary.away.days[1].st === "off"
  && transition.bullpen.summary.away.recentUsage.some(x => x.gameType === "S")
  && transition.context.bp_load.state === "na" && transition.context.bp_streak.state === "na");
const rTarget = { ...target, pk: 9902805, gamePk: 9902805, officialDate: "2027-04-05", gameDate: "2027-04-05T23:10:00Z" };
const r2 = { ...priorR, pk: 9902802, gamePk: 9902802, officialDate: "2027-04-02", gameDate: "2027-04-02T23:10:00Z" };
const r4 = { ...priorR, pk: 9902804, gamePk: 9902804, officialDate: "2027-04-04", gameDate: "2027-04-04T23:10:00Z" };
const rWindow = await makeCase("r_off_day", rTarget, [r2, r4]);
ok("R 視窗中已確認休兵日不算缺值，也不需要湊三場", rWindow.bullpen.summary.away.days[1].st === "off"
  && !rWindow.bullpen.scope.hasSpringInFullWindow && rWindow.context.bp_load.state !== "na");
const partial = await makeCase("partial_failure", rTarget, [r2, r4], r4.pk);
ok("部分 boxscore 失敗：已得用量仍可讀，情境不拿部分小計判定", partial.bullpen.status === "incomplete"
  && partial.bullpen.summary.away.recentUsage.some(x => x.day === "2027-04-02")
  && partial.context.bp_load.state === "na" && partial.context.bp_streak.state === "na");

const springCtx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "preview/mlb-next/spring-fixture.js"), "utf8"), { window: springCtx.window });
const spring = springCtx.window.SPRING_PREVIEW_DATA;
ok("既存 2026 春訓資料僅作完賽後回查", spring.game.pk === 832077 && spring.game.gameType === "S"
  && spring.meta.status.includes("完賽後"));
const oldPath = path.join(root, "live/data/games/849799.json");
const oldSha256 = crypto.createHash("sha256").update(fs.readFileSync(oldPath)).digest("hex");
ok("2026 舊單場仍可讀，未納入試跑輸出路徑", JSON.parse(fs.readFileSync(oldPath)).pk === 849799);
const result = { meta: { title: "MLB 跨季接入離線試跑", status: "獨立分支人工測試，未部署", simulatedClock: nowISO, sourceCheckDate: "2026-10-30",
  warning: "2027 賽程、球員、登板均為人工測試輸入；整理、判定與輸出走實際程式。2026 春訓是完賽後回查，不能證明當時賽前取得。2027 來源時機未驗證。",
  old2026GameSha256: oldSha256 },
  opening: { game: opening, bullpen: openingUsage.bullpen, context: openingUsage.context,
    roster: { basis: null, status: "no_applicable_basis", listed: opening.away.roster, in: noBasis.in, out: noBasis.out },
    smallStats: { sampleType: "人工少樣本測試", pitcherR: small.away.sp, pitcherSOnly: small.home.sp,
      hitterR: small.away.lineup.slots.slice(0, 3), teamR: { ops: small.away.ops, era: small.away.era, gp: small.away.gp } } },
  cases: { transition: { ...transition, liveGame: transitionGame }, r_off_day: rWindow, partial_failure: partial },
  historicalSpring: { meta: spring.meta, game: spring.game, pitchers: spring.pitchers } };
const reader = fs.readFileSync(path.join(root, "preview/mlb-next/trial-reader.js"), "utf8");
const trialMarkup = (page, key, data = result) => {
  const app = { innerHTML: "", textContent: "" }, els = { ".mast-id": {}, ".brand": {}, ".site-foot": {} };
  vm.runInNewContext(reader, { window: { MLB_CROSS_SEASON_TRIAL: data },
    document: { body: { dataset: { page } }, getElementById: () => app, querySelector: k => els[k] },
    location: { search: "?trial=" + key }, URLSearchParams, encodeURIComponent });
  return app.innerHTML;
};
const core = fs.readFileSync(path.join(root, "preview/mlb-next/app.js"), "utf8");
const coreMarkup = (page, key) => {
  const app = { innerHTML: "" }, els = { ".mast-id": {}, ".brand": {}, ".site-foot": {} };
  vm.runInNewContext(core, { window: { MLB_CROSS_SEASON_TRIAL: result },
    document: { body: { dataset: { page } }, getElementById: () => app, querySelector: k => els[k] },
    location: { search: "?trial=" + key }, URLSearchParams, encodeURIComponent });
  return app.innerHTML;
};
const historicalWindow = {};
vm.runInNewContext(fs.readFileSync(path.join(root,"preview/mlb-next/fixture.js"),"utf8"), { window: historicalWindow });
const historicalMarkup = (page, search) => {
  const app = { innerHTML: "" };
  vm.runInNewContext(core, { window: historicalWindow,
    document: { body: { dataset: { page } }, getElementById: () => app },
    location: { search }, URLSearchParams, encodeURIComponent });
  return app.innerHTML;
};
ok("原固定 2026 首頁、賽前與賽後仍由原 app.js 正常產出",
  historicalMarkup("home","").includes("849799")
  && historicalMarkup("game","?mode=pre").includes("本場打線")
  && historicalMarkup("game","?mode=post").includes("逐局比分"));
ok("原新版 app.js 直接讀程式輸出：首頁、投手、九棒、近期用量與狀態",
  coreMarkup("home","opening").includes("開幕零樣本")
  && coreMarkup("game","opening").includes("測試打者 A1")
  && coreMarkup("game","opening").includes("近期實際登板與用量")
  && coreMarkup("game","transition").includes("2027-03-27")
  && coreMarkup("game","transition").includes("暫不判定"));
ok("其餘診斷案例仍由 trial-reader 顯示",
  trialMarkup("game","r_off_day").includes("確認無賽程")
  && trialMarkup("game","partial_failure").includes("球數未取得")
  && trialMarkup("game","spring").includes("完賽後回查"));
const labels = structuredClone(result), usage = labels.cases.r_off_day.bullpen.summary.away.recentUsage;
usage[0].gameType = "F"; usage[1].gameType = "W";
ok("trial-reader 賽別 F＝外卡賽、W＝世界大賽", trialMarkup("game","r_off_day",labels).includes("外卡賽")
  && trialMarkup("game","r_off_day",labels).includes("世界大賽"));
if (process.argv.includes("--write")) {
  const dest = path.join(root, "preview/mlb-next/trial-data.js");
  fs.writeFileSync(dest, "/* Generated by scripts/cross-season-trial.mjs --write; branch-only test artifact. */\nwindow.MLB_CROSS_SEASON_TRIAL = " + JSON.stringify(result, null, 2) + ";\n");
  console.log("WROTE " + dest);
}
console.log("PASS 16/16 integrated checks");
