// 牛棚收集器／整理的情境測試（離線，不連網）
// 執行：node scripts/test-bullpen.mjs
import { collectBullpen, summarize, buildBullpen } from "./bullpen.mjs";

const fails = []; const check = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) fails.push(n); };
const TEAM = { id: 1, name: "主隊" }, OPP = { id: 2, name: "客隊" };
const sg = (pk, date, start, status, gno = 1, home = TEAM, away = OPP) => ({
  gamePk: pk, officialDate: date, gameDate: start, status: { detailedState: status }, gameNumber: gno, doubleHeader: gno > 1 ? "Y" : "N",
  venue: { name: "X" }, teams: { home: { team: home }, away: { team: away } } });
const box = (list) => ({ teams: { home: side(list), away: side([["SPx", 90], ["Rx", 15]]) } });
// 同名投手在不同場要同一個 id → id 由名字決定；n 為 undefined 代表 boxscore 沒給球數
const side = (list) => ({
  pitchers: list.map(([name]) => ID(name)),
  players: Object.fromEntries(list.map(([name, n]) => ["ID" + ID(name),
    { person: { fullName: name }, stats: { pitching: n === undefined ? {} : { numberOfPitches: n } } }])),
});
const ID = (name) => [...name].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 100000;

async function run(target, teamGames, boxes, throwFor = []) {
  const fetchJson = async (url) => {
    if (url.includes("gamePks=")) return { dates: [{ games: [target] }] };
    if (url.includes("teamId=")) {   // 真實 API：比賽分在 dates[].date 的桶子裡；_listed 用來模擬「原日期的延賽紀錄」
      const by = {}; teamGames.forEach((g) => { const d = g._listed || g.officialDate; (by[d] = by[d] || []).push(g); });
      return { dates: Object.keys(by).sort().map((date) => ({ date, games: by[date] })) };
    }
    const pk = +url.match(/game\/(\d+)\/boxscore/)[1];
    if (throwFor.includes(pk)) throw new Error("HTTP 500");
    return boxes[pk];
  };
  return summarize(await collectBullpen({ gamePk: target.gamePk, fetchJson, nowISO: "2026-09-23T00:00:00Z" }));
}
const day = (s, d) => s.home.days.find((x) => x.d === d);
const P = (s, n) => s.home.pitchers.find((p) => p.name === n);

// 情境 1：雙重賽 G2；G1 已完賽要算進「本日」，G2 自己不算
{
  const G2 = sg(900, "2026-09-22", "2026-09-22T23:05:00Z", "Scheduled", 2);
  const games = [
    sg(801, "2026-09-19", "2026-09-19T23:00:00Z", "Final"),
    sg(802, "2026-09-20", "2026-09-20T23:00:00Z", "Final"),
    // 9/21 無比賽
    sg(899, "2026-09-22", "2026-09-22T17:05:00Z", "Final", 1),
    G2,
  ];
  const boxes = {
    801: box([["SP1", 95], ["A", 20], ["C", 12]]),
    802: box([["SP2", 88], ["A", 18], ["B", 25]]),
    899: box([["SP3", 80], ["A", 14], ["B", 0], ["D"]]),   // B 真的 0 球；D 球數缺
  };
  const s = await run(G2, games, boxes);
  check("DH：本日（G1）＝played、complete", day(s, "2026-09-22").st === "played" && day(s, "2026-09-22").complete === true);
  check("DH：本日只含 G1，不含本場 G2", day(s, "2026-09-22").games.length === 1 && day(s, "2026-09-22").games[0].pk === 899);
  check("9/21 無賽程＝off", day(s, "2026-09-21").st === "off");
  check("先發不算牛棚（9/19 合計 20+12=32）", day(s, "2026-09-19").rpPitches === 32);
  check("球數缺的投手記為缺，不併成 0（本日合計 14+0、缺 1 人）", day(s, "2026-09-22").rpPitches === 14 && day(s, "2026-09-22").rpAppsNoCount === 1 && day(s, "2026-09-22").gamesMissing === 0);
  check("真實 0 球保留為 0", P(s, "B").days["2026-09-22"].pitches === 0 && P(s, "B").days["2026-09-22"].noCount === 0);
  check("A：9/19、9/20 有投，9/21 休 → 本日 G1 又投，連續＝1", P(s, "A").streak === 1);
  check("B：9/20 投、9/21 休、9/22 投 → 連續＝1", P(s, "B").streak === 1);
  check("C：只在 9/19 投 → 連續＝0", P(s, "C").streak === 0);
  check("D：球數缺仍列出登板", P(s, "D") && P(s, "D").days["2026-09-22"].noCount === 1 && P(s, "D").days["2026-09-22"].apps === 1);
}

// 情境 2：本場是 G1；同日 G2 在本場之後，不能算進來
{
  const G1 = sg(910, "2026-09-22", "2026-09-22T17:05:00Z", "Scheduled", 1);
  const G2 = sg(911, "2026-09-22", "2026-09-22T23:05:00Z", "Scheduled", 2);
  const s = await run(G1, [sg(812, "2026-09-21", "2026-09-21T23:00:00Z", "Final"), G1, G2], { 812: box([["SP", 90], ["E", 22]]) });
  check("本場 G1：同日較晚的 G2 不算進本日", day(s, "2026-09-22").st === "off" && day(s, "2026-09-22").games.length === 0);
  check("E 昨天投 → 連續＝1", P(s, "E").streak === 1);
}

// 情境 3：雙重賽 G1 在取得時還沒開打 → notstarted，不能當已投
{
  const G2 = sg(920, "2026-09-22", "2026-09-22T23:05:00Z", "Scheduled", 2);
  const s = await run(G2, [sg(919, "2026-09-22", "2026-09-22T17:05:00Z", "Scheduled", 1), G2], {});
  check("G1 尚未開打＝notstarted、牛棚合計為 null", day(s, "2026-09-22").st === "notstarted" && day(s, "2026-09-22").rpPitches === null);
}

// 情境 4：G1 進行中 → partial（只有部分用量）
{
  const G2 = sg(930, "2026-09-22", "2026-09-22T23:05:00Z", "Scheduled", 2);
  const s = await run(G2, [sg(929, "2026-09-22", "2026-09-22T17:05:00Z", "In Progress", 1), G2], { 929: box([["SP", 60], ["F", 9]]) });
  check("G1 進行中＝partial", day(s, "2026-09-22").st === "partial");
}

// 情境 5：延賽 → ppd；已完賽但 boxscore 取不到 → error，連續天數標為不確定
{
  const T = sg(940, "2026-09-22", "2026-09-22T23:05:00Z", "Scheduled");
  const games = [sg(931, "2026-09-19", "2026-09-19T23:00:00Z", "Postponed"),
                 sg(932, "2026-09-20", "2026-09-20T23:00:00Z", "Final"),
                 sg(933, "2026-09-21", "2026-09-21T23:00:00Z", "Final"), T];
  const s = await run(T, games, { 933: box([["SP", 90], ["G", 17]]) }, [932]);
  check("延賽＝ppd", day(s, "2026-09-19").st === "ppd");
  check("boxscore 失敗＝error、合計 null（不是 0）", day(s, "2026-09-20").st === "error" && day(s, "2026-09-20").rpPitches === null);
  check("G 昨天投、前天資料缺 → 連續 1 且標示可能更長", P(s, "G").streak === 1 && P(s, "G").streakUncertain === true);
}

// 情境 6：同一投手雙重賽兩場都投 → 同一天 2 場，連續天數只算 1 天
{
  const T = sg(950, "2026-09-22", "2026-09-22T23:05:00Z", "Scheduled");
  const games = [sg(941, "2026-09-19", "2026-09-19T23:00:00Z", "Final"), sg(942, "2026-09-20", "2026-09-20T23:00:00Z", "Final"),
                 sg(943, "2026-09-21", "2026-09-21T17:00:00Z", "Final", 1), sg(944, "2026-09-21", "2026-09-21T23:00:00Z", "Final", 2), T];
  const b = (n) => box([["SP" + n, 90], ["H", 10 + n]]);
  const s = await run(T, games, { 941: b(1), 942: b(2), 943: b(3), 944: b(4) });
  const h = P(s, "H");
  check("雙重賽同日兩場：apps=2、球數相加", h.days["2026-09-21"].apps === 2 && h.days["2026-09-21"].pitches === 27);
  check("人次 vs 人數：9/21 人次 2、人數 1", day(s, "2026-09-21").rpApps === 2 && day(s, "2026-09-21").rpPitchers === 1);
  check("連三天登板（碰到視窗邊界）→ 3 且標示可能更長", h.streak === 3 && h.streakAtEdge === true && h.streakUncertain === false);
}

// 情境 7：延賽重排（真實案例 TOR@BAL 824785）：同一 gamePk 兩筆，officialDate 都改成新日期
//   原日期 9/22 那筆＝Postponed；新日期 9/23 那筆＝Scheduled，是今天雙重賽 G1
{
  const T = sg(960, "2026-09-23", "2026-09-23T22:35:00Z", "Scheduled", 2);
  const orig = { ...sg(959, "2026-09-23", "2026-09-22T22:35:00Z", "Postponed", 1), _listed: "2026-09-22" };
  const makeup = sg(959, "2026-09-23", "2026-09-23T17:35:00Z", "Scheduled", 1);
  const s = await run(T, [sg(958, "2026-09-21", "2026-09-21T22:35:00Z", "Final"), orig, makeup, T], { 958: box([["SP", 90], ["J", 12]]) });
  check("原日期 9/22＝延賽，不是無賽程", day(s, "2026-09-22").st === "ppd");
  check("今天 G1（重排）＝未開打，不是延賽", day(s, "2026-09-23").st === "notstarted" && day(s, "2026-09-23").games[0].status === "Scheduled");
}

// 情境 8：本場自己就是從前一天延賽重排來的 → 原日期那筆要顯示延賽，重排後的本場不算
{
  const T = sg(970, "2026-09-23", "2026-09-23T17:35:00Z", "Scheduled", 1);
  const orig = { ...sg(970, "2026-09-23", "2026-09-22T22:35:00Z", "Postponed", 1), _listed: "2026-09-22" };
  const s = await run(T, [orig, T], {});
  check("本場原日期＝延賽", day(s, "2026-09-22").st === "ppd");
  check("本日不含本場自己", day(s, "2026-09-23").games.length === 0);
}

// 情境 9（站長指定）：同一天雙重賽，G1 boxscore 成功、G2 boxscore 失敗
//   → 不可回傳 played／complete；要標 incomplete、缺 1 場；合計只是部分小計
{
  const T = sg(980, "2026-09-23", "2026-09-23T23:05:00Z", "Scheduled");
  const games = [sg(975, "2026-09-20", "2026-09-20T23:00:00Z", "Final"),
                 sg(976, "2026-09-21", "2026-09-21T23:00:00Z", "Final"),
                 sg(977, "2026-09-22", "2026-09-22T17:00:00Z", "Final", 1), sg(978, "2026-09-22", "2026-09-22T23:00:00Z", "Final", 2), T];
  const boxes = { 975: box([["SP", 90], ["K", 15]]), 976: box([["SP", 90], ["K", 12], ["L", 20]]),
                  977: box([["SP", 90], ["L", 18], ["M", 11]]) };
  const s = await run(T, games, boxes, [978]);
  const d = day(s, "2026-09-22");
  check("DH G2 失敗：st＝incomplete，不是 played", d.st === "incomplete");
  check("DH G2 失敗：complete＝false", d.complete === false);
  check("DH G2 失敗：gamesExpected 2、gamesMissing 1", d.gamesExpected === 2 && d.gamesMissing === 1);
  check("DH G2 失敗：G1 資料照常顯示（部分小計 18+11=29）", d.rpPitches === 29);
  check("DH G2 失敗：已取得投手都有球數 → rpAppsNoCount 0（和缺整場分開）", d.rpAppsNoCount === 0);
  check("DH G2 失敗：場次標記 full / missing", d.games.find((g) => g.pk === 977).data === "full" && d.games.find((g) => g.pk === 978).data === "missing");
  // 連續登板：K 9/20、9/21 投，9/22 沒在 G1 出現，但 G2 缺 → 不能當成 9/22 休息
  const K = P(s, "K");
  check("K：昨天（9/22）沒看到但該日不完整 → streak 不能算 0 了事，要標不確定", K.streakUncertain === true);
  check("K：9/22 沒被記成登板（缺資料≠有投）", !K.days["2026-09-22"]);
  // L 9/21、9/22 都投 → 連續 2；斷點 9/20 完整 → 不確定只因「本日」無關；此處本日 9/23 無賽 → 確定
  const L = P(s, "L");
  check("L：9/21、9/22 連投＝2，斷點 9/20 完整 → 確定", L.streak === 2 && L.streakUncertain === false);
  // buildBullpen 的場次狀態也要是 incomplete
  const fetchJson = async (url) => {
    if (url.includes("gamePks=")) return { dates: [{ games: [T] }] };
    if (url.includes("teamId=")) { const by = {}; games.forEach((g) => (by[g.officialDate] = by[g.officialDate] || []).push(g)); return { dates: Object.keys(by).sort().map((date) => ({ date, games: by[date] })) }; }
    const pk = +url.match(/game\/(\d+)\/boxscore/)[1]; if (pk === 978) throw new Error("HTTP 500"); return boxes[pk];
  };
  const b = await buildBullpen({ games: [{ pk: 980 }], fetchJson, nowISO: "x" });
  check("buildBullpen：該場 status＝incomplete、gamesMissing＝2（兩隊各 1）", b.index[980].status === "incomplete" && b.index[980].gamesMissing === 2);
}

// 情境 10：整天 boxscore 都失敗 → error；前一天有投的人連續天數標不確定
{
  const T = sg(990, "2026-09-23", "2026-09-23T23:05:00Z", "Scheduled");
  const games = [sg(986, "2026-09-21", "2026-09-21T23:00:00Z", "Final"), sg(987, "2026-09-22", "2026-09-22T23:00:00Z", "Final"), T];
  const s = await run(T, games, { 986: box([["SP", 90], ["N", 15]]) }, [987]);
  check("整天失敗＝error、complete false、合計 null", day(s, "2026-09-22").st === "error" && !day(s, "2026-09-22").complete && day(s, "2026-09-22").rpPitches === null);
  check("N：前天投、昨天整天缺 → streak 0 但不確定", P(s, "N").streak === 0 && P(s, "N").streakUncertain === true);
}

// 情境 11：本日 G1 進行中、他沒出現 → 本日不確定；昨天投過 → streak 1 且不確定
{
  const T = sg(995, "2026-09-23", "2026-09-23T23:05:00Z", "Scheduled", 2);
  const games = [sg(993, "2026-09-22", "2026-09-22T23:00:00Z", "Final"), sg(994, "2026-09-23", "2026-09-23T17:00:00Z", "In Progress", 1), T];
  const s = await run(T, games, { 993: box([["SP", 90], ["Q", 15]]), 994: box([["SP", 50]]) });
  check("本日 G1 進行中＝partial、complete false", day(s, "2026-09-23").st === "partial" && !day(s, "2026-09-23").complete);
  check("Q：昨天投、本日進行中未見 → streak 1、不確定", P(s, "Q").streak === 1 && P(s, "Q").streakUncertain === true);
}

// 情境 12：buildBullpen 失敗隔離＋快取（兩場同一隊，schedule 只抓一次）
{
  const A = sg(1001, "2026-09-23", "2026-09-23T23:05:00Z", "Scheduled");
  const calls = {};
  const fetchJson = async (url) => {
    calls[url] = (calls[url] || 0) + 1;
    if (url.includes("gamePks=1002")) throw new Error("HTTP 503");
    if (url.includes("gamePks=")) return { dates: [{ games: [A] }] };
    if (url.includes("teamId=")) return { dates: [{ date: "2026-09-23", games: [A] }] };
  };
  const b = await buildBullpen({ games: [{ pk: 1001 }, { pk: 1002 }, { pk: 1001 }], fetchJson, nowISO: "x" });
  check("一場失敗不影響其他場", b.index[1001].status === "ok" && b.index[1002].status === "failed" && /503/.test(b.files[1002].error));
  check("快取：同 URL 只抓一次", Object.entries(calls).filter(([u]) => u.includes("teamId=")).every(([, n]) => n === 1));
}

console.log(fails.length ? `\n${fails.length} FAIL` : "\nALL PASS");
process.exit(fails.length ? 1 : 0);
