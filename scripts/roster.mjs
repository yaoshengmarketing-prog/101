// 名單狀態（試作）：node scripts/roster.mjs <快照 json> <gamePk> <比較日 YYYY-MM-DD> <輸出檔>
// 站長 2026-10-01：只核准一場試作（PHI@ATL 外卡第 3 戰 849844），沿用已保存的賽前快照，不套用到其他比賽、不進排程
//   輸入＝實抓快照（MLB Stats API，欄位精簡，scripts/fixtures/），輸出＝live/data/roster/<gamePk>.json
//   只用快照裡的資料，不補抓；輸出記下取得時間、比較基準、依據。產生一次就固定，之後的現役名單不改寫它
//   名單只說「本場資料列出的名單」；和本輪前幾場相同只當補充，不保證之後不變
//   姓名、狀態、異動原文只取來源；官方沒寫原因的標 why:null，頁面寫「原因未確認」，不推測
//   「未列本場名單」「官方傷兵」「未列先發」分開：這裡不判斷未列先發（取得時官方打線未公布）
//   例行賽最後出賽取自 gameLog（只含例行賽）；本輪出賽另取快照裡已完賽的本輪比賽資料
//   分組：out＝比較日有、本場無；in＝本場有、比較日無；recentOff＝不在本場、比較日前 14 天內有例行賽出賽；
//         ilMove＝本場名單內、14 天內有傷兵異動；other＝其餘不在本場名單者（保留，依例行賽最後出賽排序；排後面不代表沒影響）
//   14 天是暫定閱讀整理範圍（站長 10-01），不回測
import fs from "node:fs";

export const RULES = "roster-status trial v0";
const day = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const MON = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };

// 傷兵異動：只認描述原文的固定句型；部位＝「injured list」那句之後的文字，沒有就 null（頁面寫官方未寫部位）
export function ilInfo(desc) {
  if (!/injured list/i.test(desc)) return null;
  const m = desc.match(/\b(placed|activated|transferred)\b.*?(\d+)-day injured list(?:.*?to the (\d+)-day injured list)?/i);
  const kind = !m ? "other" : m[1].toLowerCase() === "placed" ? "placed" : m[1].toLowerCase() === "activated" ? "activated" : "transferred";
  const days = m ? +(m[3] || m[2]) : null;
  const r = desc.match(/retroactive to (\w+) (\d+), (\d{4})/); const retro = r && MON[r[1]] ? `${r[3]}-${String(MON[r[1]]).padStart(2, "0")}-${r[2].padStart(2, "0")}` : null;
  const i = desc.search(/injured list/i), rest = desc.slice(i).match(/\.\s+(.+?)\.?\s*$/);
  return { kind, days, retro, injury: rest ? rest[1] : null };
}
export const unexplained = desc => /roster status changed/i.test(desc);

export function buildRoster(S, pk, basisDate, windowDays = 14) {
  const G = S.games[pk]; if (!G) throw new Error(`快照沒有 ${pk}`);
  const from = day(basisDate, -(windowDays - 1));
  const prior = Object.entries(S.games).filter(([k, g]) => k !== String(pk) && g.officialDate < G.officialDate && g.status === "Final"
      && g.away.team === G.away.team && g.home.team === G.home.team)
    .sort((a, b) => a[1].officialDate.localeCompare(b[1].officialDate)).map(([k, g], i) => ({ pk: +k, n: i + 1, date: g.officialDate, g }));
  const P = new Map(S.people.map(r => [r[0], r]));
  const side = s => {
    const t = G[s].team, R = k => S.rosters[`${t}|${k}`] || null;
    const listed = new Set(G[s].players), basis = R(`active@${basisDate}`), m40 = R("40Man");
    if (!basis || !m40) throw new Error(`快照缺 ${t} 的比較日或 40Man 名單`);
    const inBasis = new Set(basis.map(r => r[0])), status = new Map(m40.map(r => [r[0], r[3]]));
    const info = new Map([...m40, ...basis].map(r => [r[0], { name: r[1], pos: r[2] }]));
    const T = S.transactions[t], tx = [...T.older, ...T.recent].filter(x => x[2] !== "NUM").sort((a, b) => a[0].localeCompare(b[0]));
    const ids = [...new Set([...m40.map(r => r[0]), ...inBasis, ...listed])];
    const people = ids.map(id => {
      const p = P.get(id), nm = info.get(id) || (p ? { name: p[1], pos: p[2] } : { name: String(id), pos: "" });
      const pit = nm.pos === "P";
      const post = prior.flatMap(({ n, date, g }) => { const x = g[s], r = [];
        if (x.starters.includes(id)) r.push("先發打線"); else if (x.subs.includes(id)) r.push("替補上場");
        if (x.pitchersUsed.includes(id)) r.push(x.pitchersUsed[0] === id ? "先發投手" : "中繼登板");
        return r.length ? [{ n, date, role: r.join("、") }] : []; });
      const myTx = tx.filter(x => x[3] === id).map(x => ({ date: x[0], eff: x[1], type: x[2], text: x[4], il: ilInfo(x[4]), unexplained: unexplained(x[4]) }));
      const o = { id, name: nm.name, pos: nm.pos, listed: listed.has(id), inBasis: inBasis.has(id), status: status.get(id) ?? null,
        reg: p ? (pit ? { g: p[5], gs: p[6], ip: p[4] } : { pa: p[3] }) : null, lastReg: p?.[7] ?? null, post, tx: myTx };
      const ilRecent = myTx.some(x => x.il && x.date >= from);
      o.group = o.inBasis && !o.listed ? "out" : o.listed && !o.inBasis ? "in"
        : !o.listed && o.lastReg && o.lastReg >= from && o.lastReg <= basisDate ? "recentOff"
        : o.listed && ilRecent ? "ilMove" : !o.listed ? "other" : null;
      return o; }).filter(o => o.group);
    // 組內排序：other 依例行賽最後出賽日（新到舊，未出賽在最後）；其他組野手在前、投手在後，各自依出賽量（打席／出賽場數），不跨單位比較
    const usage = o => o.reg ? (o.reg.pa ?? o.reg.g ?? 0) : 0, isP = o => o.pos === "P" ? 1 : 0;
    const ORD = { out: 0, in: 1, recentOff: 2, ilMove: 3, other: 4 };
    people.sort((a, b) => ORD[a.group] - ORD[b.group] || (a.group === "other" ? (b.lastReg || "").localeCompare(a.lastReg || "") : isP(a) - isP(b) || usage(b) - usage(a)) || a.name.localeCompare(b.name));
    const il = m40.filter(r => /^D\d+$/.test(r[3])), ilBy = {}; il.forEach(r => ilBy[r[3]] = (ilBy[r[3]] || 0) + 1);
    // 第一層：傷兵登錄／回歸（快照裡全隊異動的範圍內），依日期
    const ilEvents = tx.filter(x => ilInfo(x[4]) && x[0] >= T.recent_query.match(/startDate=([\d-]+)/)[1]).map(x => ({ id: x[3], name: (info.get(x[3]) || { name: P.get(x[3])?.[1] || String(x[3]) }).name, listed: listed.has(x[3]), date: x[0], ...ilInfo(x[4]) }));
    return { team: t, ab: S.teams[t], listedN: listed.size, basisN: basis.length,
      sameAsPrior: prior.map(({ pk, n, date, g }) => { const a = [...g[s].players].sort(), b = [...G[s].players].sort(); return { pk, n, date, same: a.length === b.length && a.every((v, i) => v === b[i]) }; }),
      out: people.filter(o => o.group === "out").map(o => o.id), in: people.filter(o => o.group === "in").map(o => o.id),
      ilCount: il.length, ilBy, ilEvents, people };
  };
  return { rules: RULES, pk: +pk, officialDate: G.officialDate, gameType: G.gameType, source: S.api, fetchedAt: S.fetchedAtUTC,
    statusAtFetch: G.status, probableAtFetch: G.probable, lineupPostedAtFetch: G.away.starters.length > 0 || G.home.starters.length > 0,
    basis: { date: basisDate, label: "例行賽最後一天現役名單" }, window: { from, to: basisDate, days: windowDays },
    txFrom: { all: S.transactions[G.away.team].recent_query.match(/startDate=([\d-]+)/)[1], note: "全隊官方異動自此日起；更早只查了部分球員的傷兵相關紀錄" },
    prior: prior.map(({ pk, n, date }) => ({ pk, n, date })),
    away: side("away"), home: side("home") };
}

if (process.argv[1] && import.meta.url === new URL(`file://${fs.realpathSync(process.argv[1])}`).href) {
  const [src, pk, basis, out] = process.argv.slice(2);
  const R = buildRoster(JSON.parse(fs.readFileSync(src, "utf8")), pk, basis);
  if (fs.existsSync(out)) { console.log(`${out} 已存在，不覆寫（固定取得時間）`); process.exit(0); }
  fs.mkdirSync(out.split("/").slice(0, -1).join("/"), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(R) + "\n");
  console.log(`寫出 ${out}：${["away", "home"].map(s => `${R[s].ab} ${R[s].people.length} 人`).join("、")}`);
}
