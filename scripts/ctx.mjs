// 情境卡「今天值得一起看」：每場用固定門檻比一遍，成立的才成卡；沒成立、資料不足的也照樣記下
// 用法：node scripts/ctx.mjs [輸出資料夾，預設 .build]
//   讀 <out>/live-data/games/*.json、<out>/live-data/bullpen/*.json，寫 <out>/live-data/ctx/<gamePk>.json
// 規則 ctx-rules v0.2：
//   門檻是暫定值、未經回測；卡片只是資訊標記，不是預測
//   每一條都記「實際算出值」和結果（hit 成立／miss 未達／na 資料不足），不是只記成立的——之後才有兩組可比
//   只在賽前（status pre）計算；開賽後保留最後一次賽前的結果不再改（凍結），賽後資料另外存，不覆蓋
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const RULES = "ctx-rules v0.2";
export const MAXCARDS = 5;
const BP_DIFF = 80, BP_STREAK_N = 2;

const num = x => x == null || x === "" ? null : Number(x);
const wl = s => { const m = /^(\d+)-(\d+)$/.exec(s || ""); return m ? { w: +m[1], l: +m[2], pct: +m[1] / (+m[1] + +m[2]) } : null; };
const f3 = x => x.toFixed(3).replace(/^0/, ""), f2 = x => x.toFixed(2);
// 局數 165.1＝165⅓ 局
const ip = s => { const m = /^(\d+)(?:\.(\d))?$/.exec(s || ""); return m ? +m[1] + (+(m[2] || 0)) / 3 : null; };
const md = iso => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}`;

// 每條規則回傳 { state: hit|miss|na, value（實際算出值）, nums, says, why（na 的原因）}
export const CHECKS = [
  { id: "dh", title: "雙重賽", threshold: "同一天、同一球場、同兩隊兩場（dh 非空）",
    run(g, b, all) {
      if (!g.dh) return { state: "miss", value: "dh = null" };
      const o = all.find(x => x.pk !== g.pk && x.usDate === g.usDate && x.venue === g.venue && x.dh && x.away.id === g.away.id && x.home.id === g.home.id);
      const [g1, g2] = g.dh === "G1" ? [g, o] : [o, g];
      const gap = g1 && g2 && !g1.tbd && !g2.tbd ? (Date.parse(g2.startUTC) - Date.parse(g1.startUTC)) / 36e5 : null;
      const nums = [g1 && { k: "G1 表定（台）", v: g1.tbd ? "未定" : g1.twTime }, g2 && { k: "G2 表定（台）", v: g2.tbd ? "未定" : g2.twTime },
        gap != null && { k: "表定開賽相差", v: `${+gap.toFixed(1)} 小時` }].filter(Boolean);
      const says = [`今天同一球場的第 ${g.dh.slice(1)} 場${(g1 || g).rescheduledFrom ? `；G1 是 ${md((g1 || g).rescheduledFrom)} 延賽的補賽` : ""}。`];
      if (g.dh === "G2") says.push("G1 用掉多少牛棚，要等 G1 打完，看下方牛棚表「本日」欄。");
      if (gap != null) says.push("「相差」是表定開賽時間差，不是 G1 結束到 G2 的休息時間。");
      return { state: "hit", value: `${g.dh}${gap != null ? `，表定相差 ${+gap.toFixed(1)} 小時` : ""}`, nums, says };
    } },
  { id: "bp_load", title: "前三日牛棚用球數差距", threshold: `前三個完整日牛棚合計，兩隊相差 ≥ ${BP_DIFF} 球`,
    run(g, b) {
      if (!b || b.status === "failed" || !b.summary) return { state: "na", why: "本場牛棚資料沒有取得" };
      const t = s => { const full = b.summary[s].days.slice(0, 3);
        const bad = full.filter(d => !(d.complete || ["off", "ppd"].includes(d.st)) || d.rpAppsNoCount);
        return bad.length ? { bad } : { sum: full.reduce((a, d) => a + (d.rpPitches || 0), 0), full }; };
      const A = t("away"), H = t("home");
      if (A.bad || H.bad) return { state: "na", why: `前三日有資料不完整或球數缺（${[A.bad && g.away.name, H.bad && g.home.name].filter(Boolean).join("、")}），合計不完整就不比` };
      const d = Math.abs(A.sum - H.sum), hi = A.sum >= H.sum ? g.away : g.home;
      const days = x => x.full.map(d => d.st === "played" ? d.rpPitches : BPWORD[d.st] || d.st).join("／");
      const value = `${A.sum} vs ${H.sum} ＝ 差 ${d} 球`;
      if (d < BP_DIFF) return { state: "miss", value };
      return { state: "hit", value,
        nums: [{ k: `${g.away.name} 前三日牛棚`, v: `${A.sum} 球` }, { k: `${g.home.name} 前三日牛棚`, v: `${H.sum} 球` }, { k: "相差", v: `${d} 球` }],
        says: [`${hi.name}牛棚前三天多用 ${d} 球（逐日：${g.away.name} ${days(A)}；${g.home.name} ${days(H)}）。`,
          "只算用球數，沒有算誰投、投多久；每位投手的連續登板看下方牛棚表。"] };
    } },
  { id: "bp_streak", title: "中繼連續登板", threshold: `一方有 ≥ ${BP_STREAK_N} 位中繼連續 2 天以上登板（到本場之前）`,
    run(g, b) {
      if (!b || b.status === "failed" || !b.summary) return { state: "na", why: "本場牛棚資料沒有取得" };
      const who = s => b.summary[s].pitchers.filter(p => p.streak >= 2);
      const A = who("away"), H = who("home"), n = Math.max(A.length, H.length);
      const value = `${g.away.name} ${A.length} 位／${g.home.name} ${H.length} 位`;
      if (n < BP_STREAK_N) return { state: "miss", value };
      const list = (t, ps) => ps.length ? `${t.name}：${ps.map(p => `${p.name} 連 ${p.streak}${p.streakAtEdge || p.streakUncertain ? "+" : ""} 天`).join("、")}` : null;
      return { state: "hit", value, nums: [{ k: `${g.away.name} 連投 2 天以上`, v: `${A.length} 位` }, { k: `${g.home.name} 連投 2 天以上`, v: `${H.length} 位` }],
        says: [[list(g.away, A), list(g.home, H)].filter(Boolean).join("；") + "。", "連投不等於今天不能上，只是列出來一起看。"] };
    } },
  { id: "whip", title: "兩名先發 WHIP 都在 1.00 以下", threshold: "雙方先發本季 WHIP 皆 < 1.00 且局數皆 ≥ 100",
    run(g) {
      const a = g.away.sp?.s, h = g.home.sp?.s;
      if (!a || !h) return { state: "na", why: !g.away.sp || !g.home.sp ? "先發未公布" : "先發沒有本季大聯盟成績" };
      const value = `${a.whip} / ${h.whip}（局數 ${a.ip} / ${h.ip}）`;
      if (!(num(a.whip) < 1 && num(h.whip) < 1 && ip(a.ip) >= 100 && ip(h.ip) >= 100)) return { state: "miss", value };
      return { state: "hit", value, nums: [{ k: `${g.away.sp.name} WHIP`, v: a.whip }, { k: `${g.home.sp.name} WHIP`, v: h.whip }, { k: `${g.away.sp.name} ERA`, v: a.era }, { k: `${g.home.sp.name} ERA`, v: h.era }],
        says: [`分母＝本季大聯盟出賽（${a.gs} 先發 ${a.ip} 局／${h.gs} 先發 ${h.ip} 局）。`, "沒有對左右打拆分與近幾場逐場，這張卡不做今天的對位判斷。"] };
    } },
  { id: "l10", title: "近十場差距", threshold: "一方近十場勝率 ≥ .700 且雙方差 ≥ .200",
    run(g) {
      const a = wl(g.away.l10), h = wl(g.home.l10);
      if (!a || !h) return { state: "na", why: "近十場戰績沒有取得" };
      const d = Math.abs(a.pct - h.pct), value = `${g.away.l10}（${f3(a.pct)}）vs ${g.home.l10}（${f3(h.pct)}）＝ 差 ${f3(d)}`;
      if (!(Math.max(a.pct, h.pct) >= 0.7 - 1e-9 && d >= 0.2 - 1e-9)) return { state: "miss", value };
      return { state: "hit", value, nums: [{ k: `${g.away.name} 近十場`, v: g.away.l10 }, { k: `${g.home.name} 近十場`, v: g.home.l10 }, { k: "連勝／連敗", v: `${g.away.streak || "—"}／${g.home.streak || "—"}` }],
        says: ["分母只有 10 場，這個數字不拿來推論今天誰會贏。"] };
    } },
  ...[["rpg", "平均得分差距", "rs"], ["rapg", "平均失分差距", "ra"]].map(([id, title, key]) => ({ id, title, threshold: "兩隊每場平均相差 ≥ 1.00 分",
    run(g) {
      const A = g.away, H = g.home;
      if (num(A[key]) == null || num(H[key]) == null || !A.gp || !H.gp) return { state: "na", why: "得失分或場數沒有取得" };
      const a = A[key] / A.gp, h = H[key] / H.gp, d = Math.abs(a - h), value = `${f2(a)} vs ${f2(h)} ＝ 差 ${f2(d)}`;
      if (d < 1 - 1e-9) return { state: "miss", value };
      return { state: "hit", value, nums: [{ k: `${A.name} 每場`, v: f2(a) }, { k: `${H.name} 每場`, v: f2(h) }, { k: "相差", v: f2(d) }],
        says: [`本季累計：${A[key]} 分÷${A.gp} 場、${H[key]} 分÷${H.gp} 場。`] };
    } })),
  { id: "ops", title: "團隊 OPS 差距", threshold: "兩隊團隊 OPS 相差 ≥ .060",
    run(g) {
      const a = num(g.away.ops), h = num(g.home.ops);
      if (a == null || h == null) return { state: "na", why: "團隊 OPS 沒有取得" };
      const d = Math.abs(a - h), value = `${g.away.ops} vs ${g.home.ops} ＝ 差 ${f3(d)}`;
      if (d < 0.06 - 1e-9) return { state: "miss", value };
      return { state: "hit", value, nums: [{ k: `${g.away.name} OPS`, v: g.away.ops }, { k: `${g.home.name} OPS`, v: g.home.ops }, { k: "相差", v: f3(d) }],
        says: ["本季累計，沒有分今天先發是左投或右投。"] };
    } },
  { id: "home", title: "主隊主場戰績", threshold: "主隊主場勝率 ≥ .650",
    run(g) {
      const h = wl(g.home.home);
      if (!h) return { state: "na", why: "主場戰績沒有取得" };
      const value = `${g.home.name}主場 ${g.home.home}（${f3(h.pct)}）`;
      if (h.pct < 0.65 - 1e-9) return { state: "miss", value };
      const a = wl(g.away.road);
      return { state: "hit", value, nums: [{ k: `${g.home.name} 主場`, v: g.home.home }, { k: "勝率", v: f3(h.pct) }, a && { k: `${g.away.name} 客場`, v: g.away.road }].filter(Boolean),
        says: [`${g.home.name}本季主場 ${h.w + h.l} 場贏 ${h.w} 場。`] };
    } },
];
const BPWORD = { off: "無賽程", ppd: "延賽" };

// 純函式：單場 → 情境紀錄
export function compute(g, b, all, nowISO) {
  const checks = CHECKS.map(c => { let r; try { r = c.run(g, b, all); } catch (e) { r = { state: "na", why: `計算錯誤：${e.message}` }; }
    return { id: c.id, title: c.title, threshold: c.threshold, ...r }; });
  // updatedAt／fetchedAt 是 data-changed.mjs 忽略的時間戳：只有結果變了才算資料變動
  return { rules: RULES, maxCards: MAXCARDS, updatedAt: nowISO, phase: g.status.code,
    inputs: { game: { updatedAt: g.updatedAt }, bullpen: b ? { fetchedAt: b.fetchedAt, status: b.status } : null },
    hits: checks.filter(c => c.state === "hit").map(c => c.id), checks };
}

// 賽前才算；開賽後（或延賽、取消）沿用最後一次賽前的結果
export function decide(g, prev, fresh) {
  if (g.status.code === "pre") return fresh;
  if (prev && prev.phase === "pre") return prev;
  return prev || fresh; // 第一次看到就已開賽：只能用開賽後的資料算，phase 會記下實際狀態
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const OUT = process.argv[2] || ".build", D = `${OUT}/live-data`, nowISO = new Date().toISOString();
  const read = f => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
  const all = fs.readdirSync(`${D}/games`).map(f => read(`${D}/games/${f}`)).filter(Boolean);
  fs.mkdirSync(`${D}/ctx`, { recursive: true });
  const c = { pre: 0, frozen: 0, late: 0, hits: 0, cards: 0 };
  for (const g of all) {
    const prev = read(`live/data/ctx/${g.pk}.json`);
    const out = decide(g, prev, compute(g, read(`${D}/bullpen/${g.pk}.json`), all, nowISO));
    if (g.status.code === "pre") c.pre++; else if (out.phase === "pre") c.frozen++; else c.late++;
    c.hits += out.hits.length; c.cards += Math.min(out.hits.length, MAXCARDS);
    fs.writeFileSync(`${D}/ctx/${g.pk}.json`, JSON.stringify(out));
  }
  const line = `賽前計算 ${c.pre} 場／開賽後沿用賽前 ${c.frozen} 場／開賽後才第一次計算 ${c.late} 場；成立 ${c.hits} 條，顯示 ${c.cards} 張（共 ${all.length} 場）`;
  fs.appendFileSync(`${OUT}/report.md`, `\n## 情境卡（${RULES}）\n\n${line}\n`);
  console.log("情境卡：" + line);
}
