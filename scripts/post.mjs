// 賽後結果：補進每場情境紀錄的 post 欄位（有卡、沒卡的比賽都補），不動賽前的 checks
// 用法：node scripts/post.mjs [輸出資料夾，預設 .build]
//   對象＝live/data/ctx 與 <out>/live-data/ctx 裡所有「還沒補完」且表定開賽已過 1 小時的紀錄（不限今天／明天，跨日暫停、延賽也會一直補）
//   一次查：schedule（gamePks 批次，含 linescore）→ 已完賽的再查 boxscore 一次
//   post 內容：最終比分、逐局、第 7 局起得分、先發與牛棚實際使用（人次、用球數、失分）
//   「比賽完賽」（gameOver）和「資料完整」（complete）分開：完賽但逐局、比分或投手資料有缺 → 已有的照存，done＝false 下次再補
//   逐局：確定沒打的半局（主隊贏球、最後一局下半沒打、且已知得分加總＝總分）記在 notPlayed；其他取不到的記在 missing，不當 0
//   補完（done＝complete）後不再查；超過 30 天仍未補完就標 gaveUp
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { ident } from "./ctx.mjs";

export const POST_RULES = "post v0.2";
const API = "https://statsapi.mlb.com", LATE_FROM = 7, GIVE_UP_DAYS = 30;
const FINAL = new Set(["Final", "Game Over", "Completed Early"]);
const ipOuts = s => { const m = /^(\d+)(?:\.([012]))?$/.exec(s || ""); return m ? +m[1] * 3 + +(m[2] || 0) : null; };
const n = x => typeof x === "number" && Number.isFinite(x) ? x : null;

// 同一 gamePk 延賽重排後會有兩筆，取「已完賽」那筆，否則取最後一筆
export function pickEntry(entries) {
  return entries.find(e => FINAL.has(e.status?.detailedState)) || entries.slice().sort((a, b) => (a.gameDate || "").localeCompare(b.gameDate || "")).at(-1);
}

function pitching(t) {
  const ps = (t.pitchers || []).map((id, i) => { const p = t.players?.["ID" + id] || {}, s = p.stats?.pitching || {};
    const pitches = n(s.numberOfPitches ?? s.pitchesThrown);
    return { id, name: p.person?.fullName || null, role: i === 0 ? "SP" : "RP", outs: ipOuts(s.inningsPitched), pitches, runs: n(s.runs), er: n(s.earnedRuns) }; });
  const rp = ps.filter(p => p.role === "RP"), sum = k => rp.every(p => p[k] !== null) ? rp.reduce((a, p) => a + p[k], 0) : null;
  const complete = ps.length > 0 && ps.every(p => p.pitches !== null && p.outs !== null && p.runs !== null);
  return { complete, sp: ps[0] || null, rp: { apps: rp.length, pitches: sum("pitches"), noCount: rp.filter(p => p.pitches === null).length, outs: sum("outs"), runs: sum("runs"), er: sum("er"), pitchers: rp } };
}

// 純函式：schedule 那一筆（含 linescore）＋ boxscore → post
export function summarizePost(entry, box, nowISO) {
  const st = entry.status?.detailedState || "Unknown";
  if (!FINAL.has(st)) {
    const done = /Cancel/i.test(st);
    return { rules: POST_RULES, status: st, done, fetchedAt: nowISO };
  }
  const L = entry.linescore || {}, sched = L.scheduledInnings ?? 9;
  const tot = s => ({ runs: n(L.teams?.[s]?.runs ?? entry.teams?.[s]?.score), hits: n(L.teams?.[s]?.hits), errors: n(L.teams?.[s]?.errors) });
  const final = { away: tot("away"), home: tot("home") }, fa = final.away.runs, fh = final.home.runs;
  // 逐局：1 到最後一局都要有；中間缺局＝兩個半局都未取得
  const got = new Map((L.innings || []).map(i => [i.num, { n: i.num, away: n(i.away?.runs), home: n(i.home?.runs) }]));
  const last = Math.max(0, ...got.keys(), st === "Completed Early" ? 0 : sched);
  const inn = Array.from({ length: last }, (_, k) => got.get(k + 1) || { n: k + 1, away: null, home: null });
  const known = s => inn.reduce((a, i) => a + (i[s] ?? 0), 0);
  const notPlayed = [], missing = [];
  for (const i of inn) for (const s of ["away", "home"]) if (i[s] === null) {
    const skip = s === "home" && i.n === last && fa !== null && fh !== null && fh > fa && known("home") === fh; // 主隊領先，最後一局下半不用打
    (skip ? notPlayed : missing).push({ n: i.n, side: s });
  }
  // 已知得分加總要等於總分；沒有缺但對不上，也算資料不完整
  const mismatch = ["away", "home"].filter(s => final[s].runs === null || (!missing.some(m => m.side === s) && known(s) !== final[s].runs));
  const lateOf = s => missing.some(m => m.side === s && m.n >= LATE_FROM) ? null : inn.filter(i => i.n >= LATE_FROM).reduce((a, i) => a + (i[s] ?? 0), 0);
  const pitchingOut = box ? { away: pitching(box.teams.away), home: pitching(box.teams.home) } : null;
  const incomplete = [...missing.map(m => `${m.n}${m.side === "away" ? "上" : "下"}得分`), ...mismatch.map(s => `${s === "away" ? "客隊" : "主隊"}逐局加總對不上總分`),
    ...(!pitchingOut ? ["box score"] : ["away", "home"].filter(s => !pitchingOut[s].complete).map(s => `${s === "away" ? "客隊" : "主隊"}投手資料`))];
  const complete = incomplete.length === 0;
  return { rules: POST_RULES, status: st, gameOver: true, complete, done: complete, incomplete, fetchedAt: nowISO, officialDate: entry.officialDate || null,
    final, innings: inn, scheduledInnings: sched, notPlayed, missing,
    late: { fromInning: LATE_FROM, away: lateOf("away"), home: lateOf("home") },
    pitching: pitchingOut };
}

export function pending(rec, now) {
  if (!rec?.game?.startUTC) return false;
  if (rec.post?.done && rec.post.rules !== "post v0.1") return false; // v0.1 沒分「沒打」與「未取得」：重算一次
  const t = Date.parse(rec.game.startUTC);
  return now - t > 36e5;
}

async function fetchWithRetry(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return r.json(); last = new Error(`HTTP ${r.status} ${url}`); if (r.status < 500 && r.status !== 429) break; }
    catch (e) { last = e; }
    await new Promise(res => setTimeout(res, 1500 * (i + 1)));
  }
  throw last;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const OUT = process.argv[2] || ".build", D = `${OUT}/live-data`, now = Date.now(), nowISO = new Date(now).toISOString();
  const read = f => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
  const ls = d => { try { return fs.readdirSync(d).filter(f => /^\d+\.json$/.test(f)); } catch { return []; } };
  fs.mkdirSync(`${D}/ctx`, { recursive: true });
  // 這次產出的優先，其次是已發布的
  const recs = new Map();
  for (const f of ls("live/data/ctx")) recs.set(f, read(`live/data/ctx/${f}`));
  for (const f of ls(`${D}/ctx`)) recs.set(f, read(`${D}/ctx/${f}`));
  // v0.2 的舊紀錄沒有 game 身分：從單場檔補
  for (const [f, r] of recs) if (r && !r.game) { const g = read(`${D}/games/${f}`) || read(`live/data/games/${f}`); if (g) recs.set(f, { ...r, game: ident(g), sample: r.sample || (r.phase === "pre" ? "pregame" : "late") }); }
  const todo = [...recs].filter(([, r]) => pending(r, now));
  const c = { done: 0, partial: 0, waiting: 0, gaveUp: 0, failed: 0 }, errs = [];
  const write = (f, r) => fs.writeFileSync(`${D}/ctx/${f}`, JSON.stringify(r));
  for (let i = 0; i < todo.length; i += 40) {
    const chunk = todo.slice(i, i + 40);
    let sched;
    try { sched = await fetchWithRetry(`${API}/api/v1/schedule?sportId=1&hydrate=linescore&gamePks=${chunk.map(([, r]) => r.game.pk).join(",")}`); }
    catch (e) { c.failed += chunk.length; errs.push(`schedule：${e.message}`); continue; }
    const byPk = new Map();
    for (const d of sched.dates || []) for (const e of d.games || []) (byPk.get(e.gamePk) || byPk.set(e.gamePk, []).get(e.gamePk)).push(e);
    for (const [f, r] of chunk) {
      try {
        const entry = byPk.has(r.game.pk) ? pickEntry(byPk.get(r.game.pk)) : null;
        if (!entry) throw new Error("schedule 查無此場");
        const box = FINAL.has(entry.status?.detailedState) ? await fetchWithRetry(`${API}/api/v1/game/${r.game.pk}/boxscore`) : null;
        let post = summarizePost(entry, box, nowISO);
        if (!post.done && now - Date.parse(r.game.startUTC) > GIVE_UP_DAYS * 864e5) post = { ...post, done: true, gaveUp: true };
        // 還沒完賽而且狀態沒變：沿用上一版（不寫新的 fetchedAt 以外內容）
        if (!post.done && !post.gameOver && r.post && r.post.status === post.status) post = r.post;
        write(f, { ...r, post });
        if (post.gaveUp) c.gaveUp++; else if (post.done) c.done++; else if (post.gameOver) c.partial++; else c.waiting++;
      } catch (e) { c.failed++; errs.push(`${r.game.pk}：${e.message}`); if (!fs.existsSync(`${D}/ctx/${f}`)) write(f, r); }
    }
  }
  // 研究用索引：每場一列，只放可以直接計算的欄位
  const rows = [];
  for (const f of new Set([...ls("live/data/ctx"), ...ls(`${D}/ctx`)])) {
    const r = read(`${D}/ctx/${f}`) || read(`live/data/ctx/${f}`); if (!r?.game) continue;
    const p = r.post?.final ? r.post : null, ck = id => r.checks.find(x => x.id === id);
    // 每一項都分隊記：研究某隊牛棚，就對那隊自己的賽後數字，不用整場勝負
    const side = (o, s) => o ? o[s] ?? null : null;
    const bp3 = ck("bp_load"), st2 = ck("bp_streak");
    const team = s => ({ ab: r.game[s].ab,
      pre: { bpPitches3d: bp3?.state !== "na" ? side(bp3?.v, s) : null, relieversStreak2: st2?.v ? side(st2.v, s) : null, relieversStreak2Uncertain: st2?.v ? !!st2.v[s + "Uncertain"] : null },
      post: p ? { runs: p.final[s].runs, lateRuns: p.late[s], spRuns: p.pitching?.[s].sp?.runs ?? null, spOuts: p.pitching?.[s].sp?.outs ?? null,
        rpApps: p.pitching?.[s].rp.apps ?? null, rpPitches: p.pitching?.[s].rp.pitches ?? null, rpOuts: p.pitching?.[s].rp.outs ?? null, rpRuns: p.pitching?.[s].rp.runs ?? null } : null });
    rows.push({ pk: r.game.pk, usDate: r.game.usDate, twDate: r.game.twDate, scheduledStartUTC: r.game.startUTC,
      rules: r.rules, sample: r.sample, minutesBeforeScheduledStart: r.frozen?.minutesBeforeScheduledStart ?? r.frozen?.minutesBeforeStart ?? null,
      hits: r.hits, states: Object.fromEntries(r.checks.map(x => [x.id, x.state + (x.stale ? "*" : "")])),
      postStatus: r.post ? { status: r.post.status, gameOver: !!r.post.gameOver || !!p, complete: r.post.complete ?? (p ? true : null), incomplete: r.post.incomplete || [] } : null,
      away: team("away"), home: team("home") });
  }
  rows.sort((a, b) => a.scheduledStartUTC.localeCompare(b.scheduledStartUTC) || a.pk - b.pk);
  fs.writeFileSync(`${D}/ctx/index.json`, JSON.stringify({ note: "states：hit 成立／miss 未達／na 資料不足；* ＝ 用到沿用的舊值。sample：pregame 賽前留下／late 開賽後才第一次計算（不列入賽前樣本）。scheduledStartUTC＝MLB 表定開賽時間（schedule 的 gameDate），不是實際第一球；minutesBeforeScheduledStart 也以表定時間計。away／home 各自的 pre 是賽前數值（沒成卡也記），post 是該隊自己的賽後數字；lateRuns＝該隊第 7 局起（含延長）得分，null＝那段有半局未取得。", rows }));
  const line = `待補 ${todo.length} 場：補完 ${c.done}／已完賽但資料未齊（已存可用部分，下次再補）${c.partial}／還沒完賽 ${c.waiting}／放棄 ${c.gaveUp}／這次查詢失敗 ${c.failed}` + (errs.length ? "\n" + errs.slice(0, 10).map(e => "- " + e).join("\n") : "");
  fs.appendFileSync(`${OUT}/report.md`, `\n## 賽後結果（${POST_RULES}）\n\n${line}\n`);
  console.log("賽後結果：" + line);
}
