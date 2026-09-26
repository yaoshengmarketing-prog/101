// 情境卡「今天值得一起看」：每場用固定門檻比一遍，成立的才成卡；沒成立、資料不足的也照樣記下
// 用法：node scripts/ctx.mjs [輸出資料夾，預設 .build]
//   讀 <out>/live-data/games/*.json、<out>/live-data/bullpen/*.json，寫 <out>/live-data/ctx/<gamePk>.json
// 規則 ctx-rules v0.3：
//   門檻是暫定值、未經回測；卡片只是資訊標記，不是預測
//   三種結果：hit 確認成立／miss 資料齊全、確認未達／na 資料不足（記原因）。缺值、無法解析的數字一律 na，不當成 0 或成立
//   每一條都記數值（v）與門檻（th），不是只記成立的——之後才有兩組可比
//   輸入是「抓取失敗、沿用舊值」時，照算但標 stale（哪一項、自何時起失敗、舊值何時取得），不當成剛確認的新資料
//   只在賽前（status pre）計算＝sample "pregame"；開賽後保留最後一次賽前結果不再改（凍結）
//   第一次看到就已開賽＝sample "late"，不列入賽前研究樣本。賽後結果由 scripts/post.mjs 另外加在 post，不覆蓋賽前內容
// v0.2 → v0.3（2026-09-27）：WHIP 缺值時 null < 1 被當成立、NaN 差距被當成立、牛棚資料不全時連投被判「0 位未達」、沿用舊值沒有標示
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const RULES = "ctx-rules v0.3";
export const MAXCARDS = 5;
const TH = { bp_load: { diff: 80 }, bp_streak: { pitchers: 2, days: 2 }, whip: { whipBelow: 1, ipAtLeast: 100 }, l10: { high: 0.7, diff: 0.2 },
  rpg: { diff: 1 }, rapg: { diff: 1 }, ops: { diff: 0.06 }, home: { pct: 0.65 } };
const UNCERTAIN = new Set(["partial", "incomplete", "error", "other"]); // 與 bullpen.mjs 相同
const EPS = 1e-9;

const fin = (...xs) => xs.every(x => typeof x === "number" && Number.isFinite(x));
const num = x => { if (x == null || x === "") return null; const n = Number(x); return Number.isFinite(n) ? n : null; };
const wl = s => { const m = /^(\d+)-(\d+)$/.exec(s || ""); return m && +m[1] + +m[2] > 0 ? { w: +m[1], l: +m[2], pct: +m[1] / (+m[1] + +m[2]) } : null; };
const f3 = x => x.toFixed(3).replace(/^(-?)0/, "$1"), f2 = x => x.toFixed(2), r3 = x => Math.round(x * 1000) / 1000;
// 局數 165.1＝165⅓ 局
const ip = s => { const m = /^(\d+)(?:\.([012]))?$/.exec(s || ""); return m ? +m[1] + (+(m[2] || 0)) / 3 : null; };
const md = iso => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}`;
const na = why => ({ state: "na", why });
const bpOk = b => b && b.status !== "failed" && b.summary;

// 每條規則：inputs＝用到哪些底層資料（用來判斷是否沿用舊值）；run 回傳 { state, v, value, nums, says, why }
export const CHECKS = [
  { id: "dh", title: "雙重賽", threshold: "同一天、同一球場、同兩隊兩場（dh 非空）", inputs: [],
    run(g, b, all) {
      if (!g.dh) return { state: "miss", v: { dh: null }, value: "dh = null" };
      const o = all.find(x => x.pk !== g.pk && x.usDate === g.usDate && x.venue === g.venue && x.dh && x.away.id === g.away.id && x.home.id === g.home.id);
      const [g1, g2] = g.dh === "G1" ? [g, o] : [o, g];
      const gap = g1 && g2 && !g1.tbd && !g2.tbd ? (Date.parse(g2.startUTC) - Date.parse(g1.startUTC)) / 36e5 : null;
      const nums = [g1 && { k: "G1 表定（台）", v: g1.tbd ? "未定" : g1.twTime }, g2 && { k: "G2 表定（台）", v: g2.tbd ? "未定" : g2.twTime },
        gap != null && { k: "表定開賽相差", v: `${+gap.toFixed(1)} 小時` }].filter(Boolean);
      const says = [`今天同一球場的第 ${g.dh.slice(1)} 場${(g1 || g).rescheduledFrom ? `；G1 是 ${md((g1 || g).rescheduledFrom)} 延賽的補賽` : ""}。`];
      if (g.dh === "G2") says.push("G1 用掉多少牛棚，要等 G1 打完，看下方牛棚表「本日」欄。");
      if (gap != null) says.push("「相差」是表定開賽時間差，不是 G1 結束到 G2 的休息時間。");
      return { state: "hit", v: { dh: g.dh, otherPk: o?.pk ?? null, gapHours: gap }, value: `${g.dh}${gap != null ? `，表定相差 ${+gap.toFixed(1)} 小時` : ""}`, nums, says };
    } },
  { id: "bp_load", title: "前三日牛棚用球數差距", threshold: `前三個完整日牛棚合計，兩隊相差 ≥ ${TH.bp_load.diff} 球`, inputs: ["bullpen"],
    run(g, b) {
      if (!bpOk(b)) return na("本場牛棚資料沒有取得");
      const t = s => { const full = b.summary[s].days.slice(0, 3);
        const bad = full.filter(d => !(d.complete || ["off", "ppd"].includes(d.st)) || d.rpAppsNoCount || (d.st === "played" && !fin(d.rpPitches)));
        return bad.length ? { bad } : { sum: full.reduce((a, d) => a + (d.st === "played" ? d.rpPitches : 0), 0), full }; };
      const A = t("away"), H = t("home");
      if (A.bad || H.bad) return na(`前三日有資料不完整或球數缺（${[A.bad && g.away.name, H.bad && g.home.name].filter(Boolean).join("、")}），合計不完整就不比`);
      const d = Math.abs(A.sum - H.sum), hi = A.sum >= H.sum ? g.away : g.home;
      const days = x => x.full.map(d => d.st === "played" ? d.rpPitches : BPWORD[d.st] || d.st).join("／");
      const v = { away: A.sum, home: H.sum, diff: d, awayDays: A.full.map(d => d.st === "played" ? d.rpPitches : null), homeDays: H.full.map(d => d.st === "played" ? d.rpPitches : null) };
      const value = `${A.sum} vs ${H.sum} ＝ 差 ${d} 球`;
      if (d < TH.bp_load.diff) return { state: "miss", v, value };
      return { state: "hit", v, value,
        nums: [{ k: `${g.away.name} 前三日牛棚`, v: `${A.sum} 球` }, { k: `${g.home.name} 前三日牛棚`, v: `${H.sum} 球` }, { k: "相差", v: `${d} 球` }],
        says: [`${hi.name}牛棚前三天多用 ${d} 球（逐日：${g.away.name} ${days(A)}；${g.home.name} ${days(H)}）。`,
          "只算用球數，沒有算誰投、投多久；每位投手的連續登板看下方牛棚表。"] };
    } },
  { id: "bp_streak", title: "中繼連續登板", threshold: `一方有 ≥ ${TH.bp_streak.pitchers} 位中繼連續 ${TH.bp_streak.days} 天以上登板（到本場之前）`, inputs: ["bullpen"],
    run(g, b) {
      if (!bpOk(b)) return na("本場牛棚資料沒有取得");
      // 已確認的連投人數只會少算不會多算：成立可以直接認定；「未達」必須資料齊全才能說
      const side = s => { const t = b.summary[s];
        const who = t.pitchers.filter(p => p.streak >= TH.bp_streak.days);
        // 視窗內還沒打的日子（notstarted）也算不確定：明天的比賽，今天這場打完前不能說「沒人連投」
        const unsure = t.days.some(d => UNCERTAIN.has(d.st) || d.st === "notstarted") || t.pitchers.some(p => p.streakUncertain);
        return { who, unsure }; };
      const A = side("away"), H = side("home"), n = Math.max(A.who.length, H.who.length);
      const v = { away: A.who.length, home: H.who.length, awayUncertain: A.unsure, homeUncertain: H.unsure };
      const value = `${g.away.name} ${A.who.length}${A.unsure ? "+" : ""} 位／${g.home.name} ${H.who.length}${H.unsure ? "+" : ""} 位`;
      if (n < TH.bp_streak.pitchers) {
        if (A.unsure || H.unsure) return { ...na(`牛棚資料有缺場或連投天數不確定（${[A.unsure && g.away.name, H.unsure && g.home.name].filter(Boolean).join("、")}），目前確認 ${value}，無法判定未達`), v };
        return { state: "miss", v, value };
      }
      const list = (t, ps) => ps.length ? `${t.name}：${ps.map(p => `${p.name} 連 ${p.streak}${p.streakAtEdge || p.streakUncertain ? "+" : ""} 天`).join("、")}` : null;
      return { state: "hit", v, value, nums: [{ k: `${g.away.name} 連投 2 天以上`, v: `${A.who.length}${A.unsure ? "+" : ""} 位` }, { k: `${g.home.name} 連投 2 天以上`, v: `${H.who.length}${H.unsure ? "+" : ""} 位` }],
        says: [[list(g.away, A.who), list(g.home, H.who)].filter(Boolean).join("；") + "。", "連投不等於今天不能上，只是列出來一起看。"] };
    } },
  { id: "whip", title: "兩名先發 WHIP 都在 1.00 以下", threshold: `雙方先發本季 WHIP 皆 < ${TH.whip.whipBelow.toFixed(2)} 且局數皆 ≥ ${TH.whip.ipAtLeast}`, inputs: ["sp"],
    run(g) {
      if (!g.away.sp || !g.home.sp) return na("先發未公布");
      const a = g.away.sp.s, h = g.home.sp.s;
      if (!a || !h) return na("先發沒有本季大聯盟成績");
      const v = { awayWhip: num(a.whip), homeWhip: num(h.whip), awayIp: ip(a.ip), homeIp: ip(h.ip), awayId: g.away.sp.id ?? null, homeId: g.home.sp.id ?? null };
      if (!fin(v.awayWhip, v.homeWhip, v.awayIp, v.homeIp)) return { ...na(`先發 WHIP 或局數缺值（${a.whip ?? "—"} / ${h.whip ?? "—"}，局數 ${a.ip ?? "—"} / ${h.ip ?? "—"}）`), v };
      const value = `${a.whip} / ${h.whip}（局數 ${a.ip} / ${h.ip}）`;
      if (!(v.awayWhip < TH.whip.whipBelow && v.homeWhip < TH.whip.whipBelow && v.awayIp >= TH.whip.ipAtLeast && v.homeIp >= TH.whip.ipAtLeast)) return { state: "miss", v, value };
      return { state: "hit", v, value, nums: [{ k: `${g.away.sp.name} WHIP`, v: a.whip }, { k: `${g.home.sp.name} WHIP`, v: h.whip }, { k: `${g.away.sp.name} ERA`, v: a.era ?? "—" }, { k: `${g.home.sp.name} ERA`, v: h.era ?? "—" }],
        says: [`分母＝本季大聯盟出賽（${a.gs ?? "—"} 先發 ${a.ip} 局／${h.gs ?? "—"} 先發 ${h.ip} 局）。`, "沒有對左右打拆分與近幾場逐場，這張卡不做今天的對位判斷。"] };
    } },
  { id: "l10", title: "近十場差距", threshold: "一方近十場勝率 ≥ .700 且雙方差 ≥ .200", inputs: ["rec"],
    run(g) {
      const a = wl(g.away.l10), h = wl(g.home.l10);
      if (!a || !h) return na("近十場戰績沒有取得");
      const d = Math.abs(a.pct - h.pct), v = { away: r3(a.pct), home: r3(h.pct), diff: r3(d) };
      const value = `${g.away.l10}（${f3(a.pct)}）vs ${g.home.l10}（${f3(h.pct)}）＝ 差 ${f3(d)}`;
      if (!(Math.max(a.pct, h.pct) >= TH.l10.high - EPS && d >= TH.l10.diff - EPS)) return { state: "miss", v, value };
      return { state: "hit", v, value, nums: [{ k: `${g.away.name} 近十場`, v: g.away.l10 }, { k: `${g.home.name} 近十場`, v: g.home.l10 }, { k: "連勝／連敗", v: `${g.away.streak || "—"}／${g.home.streak || "—"}` }],
        says: ["分母只有 10 場，這個數字不拿來推論今天誰會贏。"] };
    } },
  ...[["rpg", "平均得分差距", "rs"], ["rapg", "平均失分差距", "ra"]].map(([id, title, key]) => ({ id, title, threshold: "兩隊每場平均相差 ≥ 1.00 分", inputs: ["rec"],
    run(g) {
      const A = g.away, H = g.home, ra = num(A[key]), rh = num(H[key]), ga = num(A.gp), gh = num(H.gp);
      if (!fin(ra, rh, ga, gh) || !ga || !gh) return na("得失分或場數沒有取得");
      const a = ra / ga, h = rh / gh, d = Math.abs(a - h), v = { away: r3(a), home: r3(h), diff: r3(d), awayTotal: ra, homeTotal: rh, awayGp: ga, homeGp: gh };
      const value = `${f2(a)} vs ${f2(h)} ＝ 差 ${f2(d)}`;
      if (d < TH[id].diff - EPS) return { state: "miss", v, value };
      return { state: "hit", v, value, nums: [{ k: `${A.name} 每場`, v: f2(a) }, { k: `${H.name} 每場`, v: f2(h) }, { k: "相差", v: f2(d) }],
        says: [`本季累計：${ra} 分÷${ga} 場、${rh} 分÷${gh} 場。`] };
    } })),
  { id: "ops", title: "團隊 OPS 差距", threshold: "兩隊團隊 OPS 相差 ≥ .060", inputs: ["ops"],
    run(g) {
      const a = num(g.away.ops), h = num(g.home.ops);
      if (!fin(a, h)) return na("團隊 OPS 沒有取得");
      const d = Math.abs(a - h), v = { away: a, home: h, diff: r3(d) }, value = `${g.away.ops} vs ${g.home.ops} ＝ 差 ${f3(d)}`;
      if (d < TH.ops.diff - EPS) return { state: "miss", v, value };
      return { state: "hit", v, value, nums: [{ k: `${g.away.name} OPS`, v: g.away.ops }, { k: `${g.home.name} OPS`, v: g.home.ops }, { k: "相差", v: f3(d) }],
        says: ["本季累計，沒有分今天先發是左投或右投。"] };
    } },
  { id: "home", title: "主隊主場戰績", threshold: "主隊主場勝率 ≥ .650", inputs: ["rec"],
    run(g) {
      const h = wl(g.home.home);
      if (!h) return na("主場戰績沒有取得");
      const v = { homePct: r3(h.pct), homeW: h.w, homeL: h.l }, value = `${g.home.name}主場 ${g.home.home}（${f3(h.pct)}）`;
      if (h.pct < TH.home.pct - EPS) return { state: "miss", v, value };
      const a = wl(g.away.road);
      return { state: "hit", v, value, nums: [{ k: `${g.home.name} 主場`, v: g.home.home }, { k: "勝率", v: f3(h.pct) }, a && { k: `${g.away.name} 客場`, v: g.away.road }].filter(Boolean),
        says: [`${g.home.name}本季主場 ${h.w + h.l} 場贏 ${h.w} 場。`] };
    } },
];
const BPWORD = { off: "無賽程", ppd: "延賽" };

// 這條規則用到的底層資料裡，哪些是「抓取失敗、沿用舊值」
export function staleOf(inputs, g, b) {
  const out = [], f = g.failed?.game;
  if (f) out.push({ what: "game", since: f.since, fetchedAt: f.fetchedAt });
  for (const k of inputs) {
    if (k === "bullpen") { if (b?.retryFailedSince) out.push({ what: "bullpen", since: b.retryFailedSince, fetchedAt: b.fetchedAt }); continue; }
    for (const s of ["away", "home"]) { const x = g[s].failed?.[k]; if (x && x.fetchedAt) out.push({ what: k, side: s, since: x.since, fetchedAt: x.fetchedAt }); }
  }
  return out;
}

export const ident = g => ({ pk: g.pk, usDate: g.usDate, twDate: g.twDate, startUTC: g.startUTC, dh: g.dh ?? null, venue: g.venue,
  away: { id: g.away.id, ab: g.away.ab }, home: { id: g.home.id, ab: g.home.ab } });

// 純函式：單場 → 情境紀錄
export function compute(g, b, all, nowISO) {
  const checks = CHECKS.map(c => { let r; try { r = c.run(g, b, all); } catch (e) { r = na(`計算錯誤：${e.message}`); }
    const stale = r.state === "na" ? [] : staleOf(c.inputs, g, b);
    return { id: c.id, title: c.title, threshold: c.threshold, th: TH[c.id] || null, ...r, ...(stale.length ? { stale } : {}) }; });
  // updatedAt／fetchedAt 是 data-changed.mjs 忽略的時間戳：只有結果變了才算資料變動
  return { rules: RULES, maxCards: MAXCARDS, updatedAt: nowISO, phase: g.status.code, sample: g.status.code === "pre" ? "pregame" : "late",
    game: ident(g),
    weather: g.weather ?? null, // 計算當下的 MLB 官方天氣（null＝當時尚未公布）；凍結後就是最後一次賽前看到的
    forecast: g.forecast ?? null, // 計算當下的模型預報（scripts/forecast.mjs；不是官方）
    inputs: { game: { updatedAt: g.updatedAt }, bullpen: b ? { fetchedAt: b.fetchedAt, status: b.status } : null },
    hits: checks.filter(c => c.state === "hit").map(c => c.id), checks };
}

// 賽前才算；開賽後（或延賽、取消）沿用最後一次賽前的結果，第一次凍結時記下凍結時間與距「表定」開賽幾分鐘（game.startUTC 是 MLB 表定時間，不是實際第一球）
export function decide(g, prev, fresh, nowISO) {
  if (g.status.code === "pre") return fresh;
  const base = prev || fresh; // 第一次看到就已開賽：只能用開賽後的資料算，sample＝late
  const out = { ...base, game: base.game || ident(g), sample: base.sample || (base.phase === "pre" ? "pregame" : "late") };
  if (out.phase === "pre" && !out.frozen) out.frozen = { at: nowISO, lastPregameAt: out.updatedAt,
    minutesBeforeScheduledStart: Math.round((Date.parse(out.game.startUTC) - Date.parse(out.updatedAt)) / 6e4) };
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const OUT = process.argv[2] || ".build", D = `${OUT}/live-data`, nowISO = new Date().toISOString();
  const read = f => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
  const all = fs.readdirSync(`${D}/games`).map(f => read(`${D}/games/${f}`)).filter(Boolean);
  fs.mkdirSync(`${D}/ctx`, { recursive: true });
  const c = { pre: 0, frozen: 0, late: 0, hits: 0, cards: 0, stale: 0 };
  for (const g of all) {
    const prev = read(`live/data/ctx/${g.pk}.json`);
    const out = decide(g, prev, compute(g, read(`${D}/bullpen/${g.pk}.json`), all, nowISO), nowISO);
    if (g.status.code === "pre") c.pre++; else if (out.sample === "pregame") c.frozen++; else c.late++;
    c.hits += out.hits.length; c.cards += Math.min(out.hits.length, MAXCARDS); c.stale += out.checks.some(x => x.stale) ? 1 : 0;
    fs.writeFileSync(`${D}/ctx/${g.pk}.json`, JSON.stringify(out));
  }
  const line = `賽前計算 ${c.pre} 場／開賽後沿用賽前 ${c.frozen} 場／開賽後才第一次計算（不列入賽前樣本）${c.late} 場；成立 ${c.hits} 條，顯示 ${c.cards} 張；有沿用舊值的 ${c.stale} 場（共 ${all.length} 場）`;
  fs.appendFileSync(`${OUT}/report.md`, `\n## 情境卡（${RULES}）\n\n${line}\n`);
  console.log("情境卡：" + line);
}
