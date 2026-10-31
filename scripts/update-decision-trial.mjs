// 離線更新決策演練；只讀傳入狀態，不 fetch、不設 timer、不寫正式資料。
// 政策數字是 §10 的可調試算值，不是正式排程或頁面更新保證。
import { pathToFileURL } from "node:url";
import { lineupSig, matchupState } from "./matchup.mjs";
import { CHECKS, RULES as CTX_RULES } from "./ctx.mjs";

export const TRIAL_POLICY = Object.freeze({
  farScheduleMinutes: 1440, entryScheduleMinutes: 240,
  preLineupMinutes: 120, nearLineupMinutes: 15,
  preStatsMinutes: 240, nearStatsMinutes: 120,
  liveScoreMinutes: 20, finalRepairMinutes: 120,
});

const ms = value => value ? Date.parse(value) : NaN;
const due = (now, checkedAt, minutes) => !Number.isFinite(ms(checkedAt)) || ms(now) - ms(checkedAt) >= minutes * 60000;
const addDays = (date, offset) => new Date(ms(`${date}T12:00:00Z`) + offset*86400000).toISOString().slice(0,10);
const row = (game, module, action, reason, basis, next) => ({ gamePk: game.gamePk, module, action, reason, basis, next });
const scopeKey = x => [x?.season ?? "?", x?.gameType ?? "?", x?.version ?? "?"].join("/");

// 只判定既取得資料能否在同輪共用；實際供應商快取期限須待契約與 feed 行為核實。
export function reusable(acquired, wanted, now) {
  return acquired?.kind === wanted?.kind && acquired?.id === wanted?.id
    && String(acquired?.season) === String(wanted?.season)
    && acquired?.gameType === wanted?.gameType && acquired?.version === wanted?.version
    && Number.isFinite(ms(acquired?.validUntil)) && ms(acquired.validUntil) >= ms(now)
    && Number.isFinite(ms(acquired?.acquiredAt)) && ms(acquired.acquiredAt) <= ms(now);
}

export function stageOf(game, now) {
  if (game.phase === "final") return game.post?.complete ? "final_complete" : "final_partial";
  if (game.phase === "live") return "live";
  if (game.phase === "postponed") return "postponed";
  const hours = (ms(game.startUTC) - ms(now)) / 3600000;
  if (!Number.isFinite(hours)) return "unknown";
  if (hours <= 6) return "near";
  if (hours <= 48) return "pre";
  return "far";
}

function sourceRow(game, module, source, now, interval) {
  const s = source || { state: "not_acquired" };
  const basis = `狀態=${s.state}；範圍=${scopeKey(s)}；來源版=${s.version ?? "未取得"}；本站上次查=${s.checkedAt ?? "無"}`;
  if (s.state === "confirmed_off") return row(game, module, "沿用", "已確認休兵／無賽程，是已知狀態", basis, "賽程或狀態版本改變時");
  if (s.state === "failed") return row(game, module, due(now, s.checkedAt, interval) ? "重試來源" : "沿用舊值", "上輪執行失敗；舊值須附取得時間，不能視為來源無資料", basis + `；舊值取得=${s.lastGoodAt ?? "無"}`, `達試算間隔 ${interval} 分鐘或收到新來源版本時`);
  if (s.state === "unpublished") return row(game, module, due(now, s.checkedAt, interval) ? "檢查來源" : "暫不查", "來源尚未發布，本站未取得不等於零值", basis, `來源發布或達試算間隔 ${interval} 分鐘時`);
  if (s.state === "not_acquired") return row(game, module, due(now, s.checkedAt, interval) ? "檢查來源" : "暫不查", "本站尚未取得；尚無法判定來源是否已發布", basis, `來源可用或達試算間隔 ${interval} 分鐘時`);
  if (s.state === "scope_unconfirmed") return row(game, module, "待範圍核對", "賽季或賽別未確認，不能當本季無紀錄", basis, "來源回傳可確認的賽季與賽別時");
  if (module === "本季統計" && ["available", "unchanged"].includes(s.state) &&
      (String(s.season) !== String(game.season) || s.gameType !== "R"))
    return row(game, module, "待範圍核對", "取得的資料不是當季例行賽，不能標本季無紀錄或更新本季欄位", basis, "來源回傳可確認的當季 R 資料時");
  if (s.state === "unchanged") {
    if (s.version != null && s.version !== s.usedVersion) return row(game, module, "更新", "來源內容未變，但此版本尚未成功處理；前次安排不算完成", basis + `；已處理版=${s.usedVersion ?? "無"}`, "處理成功後保存版本；失敗則下輪續試");
    return row(game, module, due(now, s.checkedAt, interval) ? "檢查來源" : "沿用", "已取得內容未變；相同版本不重建", basis, `版本改變或達試算間隔 ${interval} 分鐘時`);
  }
  if (s.state === "available") {
    if (s.version !== s.usedVersion) return row(game, module, "更新", "已取得新版本", basis + `；已處理版=${s.usedVersion ?? "無"}`, "處理成功後保存版本；下次來源版本改變時");
    return row(game, module, due(now, s.checkedAt, interval) ? "檢查來源" : "沿用", "已處理同版內容", basis, `版本改變或達試算間隔 ${interval} 分鐘時`);
  }
  return row(game, module, "待確認", "未知來源狀態，不能默認零值", basis, "來源狀態可判讀時");
}

export function matchupGame(game) {
  if (game.matchupGame) return game.matchupGame;
  const x = game.matchupInput || {};
  const side = s => ({ sp: x[`${s}Starter`] ? { id:x[`${s}Starter`],hand:x[`${s}Hand`] ?? "R" } : null,
    lineup: x[`${s}Lineup`]?.length ? { state:"official",slots:x[`${s}Lineup`].map((id,i)=>({id,n:i+1})) } : { state:"none" } });
  return {pk:game.gamePk,season:game.season,usDate:game.officialDate,away:side("away"),home:side("home")};
}

export function matchupFingerprint(game) {
  const m = matchupGame(game), stats = game.sources?.stats;
  return JSON.stringify({ season:String(m.season || m.usDate?.slice(0,4)), gameType:game.gameType,
    away:{sp:m.away.sp?.id ?? null,spHand:m.away.sp?.hand ?? null,lineup:lineupSig(m,"away")},
    home:{sp:m.home.sp?.id ?? null,spHand:m.home.sp?.hand ?? null,lineup:lineupSig(m,"home")},
    stats:{season:stats?.season ?? null,gameType:stats?.gameType ?? null,processedVersion:stats?.usedVersion ?? null} });
}

export function contextFingerprint(game, check) {
  const v=game.contextVersions || {};
  const deps=Object.fromEntries(check.inputs.map(k=>[k,v[k] ?? (k==="bullpen" ? game.bullpen?.usedVersion : game.sources?.stats?.usedVersion) ?? null]));
  return JSON.stringify({rules:CTX_RULES,id:check.id,game:v.game ?? `${game.gamePk}/${game.season}/${game.gameType}`,
    ...(check.id==="dh"?{schedule:v.schedule ?? game.scheduleVersion ?? null}:{}),deps});
}

function bullpenReadiness(game) {
  const days = game.bullpen?.days || [];
  if (days.length !== 3) return { ready: false, reason: "未列齊前三個完整美國賽程日" };
  if (days.some((d,i) => d.date !== addDays(game.officialDate,i-3)))
    return { ready: false, reason: "前三日日期不符美國賽程日；本日用量必須另外列" };
  if (days.some(d => d.state === "missing" || d.state === "failed")) return { ready: false, reason: "逐日用量未取得或執行失敗，不能把部分小計當完整" };
  if (days.some(d => d.state === "played" && d.pitchingComplete !== true)) return { ready: false, reason: "已登板場次仍缺逐投手用量" };
  if (days.some(d => !["played", "confirmed_off"].includes(d.state))) return { ready: false, reason: "前三日有未確認狀態" };
  const today = game.bullpen?.today;
  if (today && (today.date !== game.officialDate || !["played", "confirmed_off"].includes(today.state) || (today.state === "played" && today.pitchingComplete !== true)))
    return { ready: false, reason: "本日已知前場用量尚未完整；不把部分資料當完整" };
  return { ready: true, spring: game.gameType === "R" && days.some(d => d.gameType === "S") };
}

export function planRound({ now, games, policy = TRIAL_POLICY, optionalRights = { projection: false, weather: false } }) {
  if (!Number.isFinite(ms(now))) throw new Error("now 必須是有效 ISO 時間");
  const out = [];
  for (const g of games) {
    if (!g.gamePk || !g.season || !g.gameType) throw new Error("場次缺 gamePk／season／gameType");
    const stage = stageOf(g, now), s = g.sources || {};
    const scheduleInterval = stage === "far" || stage === "postponed" ? policy.farScheduleMinutes : policy.entryScheduleMinutes;
    if (stage === "final_complete") out.push(row(g, "賽程", "暫不查", "該場已完整；新賽程與其他場另判", `階段=${stage}`, "新場次或改期通知時"));
    else out.push(sourceRow(g, "賽程", s.schedule, now, scheduleInterval));

    if (["far", "unknown", "postponed"].includes(stage)) {
      for (const m of ["先發／官方九棒", "本季統計", "投打對位", "牛棚", ...CHECKS.map(c=>`情境/${c.id}`), "名單", "預估", "模型天氣"])
        out.push(row(g, m, "暫不查", stage === "postponed" ? "已改期，依新 startUTC 重算階段，不沿舊開賽時間" : "尚未進入該模組更新窗口", `階段=${stage}；目前 startUTC=${g.startUTC ?? "未取得"}`, "新開賽時間進入 T-48h 或賽程版本變動時"));
    } else if (["pre", "near"].includes(stage)) {
      const lineupInterval = stage === "near" ? policy.nearLineupMinutes : policy.preLineupMinutes;
      const statsInterval = stage === "near" ? policy.nearStatsMinutes : policy.preStatsMinutes;
      out.push(sourceRow(g, "先發／官方九棒", s.lineup, now, lineupInterval));
      out.push(sourceRow(g, "本季統計", s.stats, now, statsInterval));
      for (const [m, k, interval] of [["名單", "roster", lineupInterval], ["預估", "projection", lineupInterval], ["模型天氣", "weather", statsInterval]])
        out.push(k !== "roster" && optionalRights[k] !== true
          ? row(g, m, "待使用條件", "第三方／模型天氣公開自動使用條件未確認，技術上可檢查也不安排來源工作", `來源狀態=${s[k]?.state ?? "未取得"}`, "授權、額度及更新方式確認後再評估")
          : sourceRow(g, m, s[k], now, interval));

      const m=matchupGame(g),stats=s.stats;
      const ready = m.away.sp?.id && m.home.sp?.id && m.away.lineup?.slots?.length === 9 && m.home.lineup?.slots?.length === 9
        && ["available","unchanged","failed"].includes(stats?.state) && stats?.usedVersion != null
        && String(stats.season) === String(g.season) && stats.gameType === "R";
      const upstreamPending = ["available","unchanged"].includes(stats?.state) && stats?.version !== stats?.usedVersion;
      const fingerprint = matchupFingerprint(g);
      const current=g.matchupBuiltFor===fingerprint && (!g.matchupSaved || matchupState(m,g.matchupSaved)==="current");
      const action=!ready?"等待必要資料":upstreamPending?"等待上游處理":current?"沿用":"重算";
      out.push(row(g,"投打對位",action,
        !ready?"缺先發／九棒或可核的當季 R 已處理統計；舊對位若不適用不能冒充新對位":upstreamPending?"新統計來源版尚未成功處理；對位不可提前使用新版本":current?"既有 matchupState 的先發 ID、手別、打線簽章及統計處理版均相符":"依既有 matchupState 基準，先發 ID／手別、官方九棒或已處理統計版變動",
        `輸入指紋=${fingerprint}；已算指紋=${g.matchupBuiltFor ?? "無"}；既有對位狀態=${g.matchupSaved?matchupState(m,g.matchupSaved):"無"}`, "上游成功且任何對位基準變動時"));

      const b = bullpenReadiness(g), bVersion = g.bullpen?.version;
      out.push(row(g, "牛棚", !b.ready ? "等待必要資料" : bVersion !== g.bullpen?.usedVersion ? "重算" : "沿用",
        !b.ready ? b.reason : bVersion !== g.bullpen?.usedVersion ? "前三個完整美國賽程日的逐投手用量已成新版；不依賴逐局或 post.complete" : "前三日用量版本相同；確認休兵日照實保留",
        `賽別=${g.gameType}；美國賽程日=${g.officialDate}；前三日=${(g.bullpen?.days||[]).map(d=>`${d.date}:${d.state}:${d.gameType}`).join(",")||"未取得"}；本日=${g.bullpen?.today ? `${g.bullpen.today.date}:${g.bullpen.today.state}` : "另列／無已知前場"}；用量版=${bVersion ?? "無"}`, "前場逐投手用量齊備或逐日狀態版本變動時"));
      for (const check of CHECKS) {
        const isBp=check.inputs.includes("bullpen"), fp=contextFingerprint(g,check), done=g.contextDoneFor?.[check.id];
        const waitingStats=!isBp && check.inputs.some(k=>["sp","rec","ops"].includes(k)) && upstreamPending;
        const action=isBp && (!b.ready||b.spring)?"暫不判定":waitingStats?"等待上游處理":done===fp?"沿用":"重算";
        out.push(row(g,`情境/${check.id}`,action,
          isBp && b.spring?"僅此兩條牛棚情境跨 S／R 暫不判定；其他七條各按自身輸入處理":isBp&&!b.ready?b.reason:waitingStats?"本季統計來源版尚未處理完成，不使用新值":done===fp?"此條既有規則與相依輸入同版":"依 ctx.CHECKS 此條 inputs 重算；門檻不變",
          `規則=${CTX_RULES}；inputs=${check.inputs.join(",")||"僅場次"}；輸入版=${fp}；已算版=${done??"無"}`, "此條相依輸入成功更新或範圍／完整度恢復時"));
      }
    } else {
      for (const m of ["先發／官方九棒", "本季統計", "投打對位", "牛棚", ...CHECKS.map(c=>`情境/${c.id}`), "名單", "預估", "模型天氣"])
        out.push(row(g, m, "沿用凍結版", "已開賽，當場賽前研究不回算；其他未開賽場次獨立處理", `階段=${stage}`, "只在其他賽前場次以新資料版本重算"));
    }

    if (stage === "live") out.push(row(g, "比賽狀態／比分", due(now, g.live?.checkedAt, policy.liveScoreMinutes) ? "檢查來源" : "沿用", "比賽中只需狀態與比分，不做逐球直播", `上次查=${g.live?.checkedAt ?? "無"}`, `達試算間隔 ${policy.liveScoreMinutes} 分鐘或官方狀態改變時`));
    else if (stage === "final_partial") out.push(row(g, "賽後結果", (g.post?.sourceVersion && g.post.sourceVersion !== g.post.usedVersion) || due(now, g.post?.checkedAt, policy.finalRepairMinutes) ? "追補" : "沿用已得部分", "已完賽但逐局／投手等仍缺；逐欄補，不填 0", `逐局齊=${!!g.post?.inningsComplete}；投手齊=${!!g.post?.pitchingComplete}；來源版=${g.post?.sourceVersion ?? "未知"}；上次查=${g.post?.checkedAt ?? "無"}`, `缺欄來源更新或達試算間隔 ${policy.finalRepairMinutes} 分鐘時`));
    else if (stage === "final_complete") out.push(row(g, "賽後結果", "暫不查", "完賽且資料已齊；保留既存賽前快照", `完整=${g.post?.complete}`, "只在來源明確更正既有結果時"));
    else out.push(row(g, "賽後結果", "暫不查", "未完賽，無賽後欄位需要追補", `階段=${stage}`, "官方狀態進入 Final 時"));
  }
  return out;
}

const source = (state, version, checkedAt, extra = {}) => ({ state, version, checkedAt, season: 2027, gameType: "R", ...extra });
const base = (gamePk, startUTC, phase = "scheduled") => ({ gamePk, season: 2027, gameType: "R", officialDate: startUTC.slice(0,10), startUTC, phase, scheduleVersion: "sch-1",
  sources: { schedule: source("unchanged", "sch-1", "2027-04-20T19:00:00Z"), lineup: source("unpublished", null, "2027-04-20T19:00:00Z"),
    stats: source("available", "stat-1", "2027-04-20T19:00:00Z", { usedVersion: "stat-1" }),
    roster: source("unchanged", "roster-1", "2027-04-20T19:00:00Z"), projection: source("unpublished", null, "2027-04-20T19:00:00Z"),
    weather: source("not_acquired", null, "2027-04-20T19:00:00Z") },
  bullpen: { days: [3,2,1].map(n => ({ date:addDays(startUTC.slice(0,10),-n),state:"confirmed_off",gameType:"R" })), version: "usage-1", usedVersion: "usage-1" }, contextBuiltFor: "sch-1|usage-1|R" });

export function demoCases() {
  const now = "2027-04-20T20:00:00Z";
  const pre = { ...base(910001, "2027-04-21T16:00:00Z"), sources: { ...base(1,"2027-04-21T16:00:00Z").sources,
    lineup: source("available", "line-1", now, { usedVersion:"line-1" }),
    stats: source("available", "stat-2", now, { usedVersion:"stat-1" }) },
    matchupInput: { awayStarter: 11, homeStarter: 12, awayLineup:[1,2,3,4,5,6,7,8,9], homeLineup:[21,22,23,24,25,26,27,28,29] } };
  const near = { ...base(910002, "2027-04-20T21:00:00Z"), sources: { ...base(2,"2027-04-20T21:00:00Z").sources,
    lineup: source("unpublished", null, "2027-04-20T19:30:00Z"), stats: source("failed", "stat-old", "2027-04-20T18:00:00Z", { lastGoodAt:"2027-04-20T15:00:00Z" }) } };
  const live = { ...base(910003, "2027-04-20T18:00:00Z", "live"), live:{checkedAt:"2027-04-20T19:30:00Z"} };
  const partial = { ...base(910004, "2027-04-20T12:00:00Z", "final"), post:{complete:false, inningsComplete:false, pitchingComplete:true, checkedAt:"2027-04-20T17:00:00Z"} };
  const complete = { ...base(910005, "2027-04-20T10:00:00Z", "final"), post:{complete:true, inningsComplete:true, pitchingComplete:true, checkedAt:"2027-04-20T17:00:00Z"} };
  const g1 = { ...base(920001, "2027-04-20T12:00:00Z", "final"), post:{complete:false, inningsComplete:false, pitchingComplete:true, checkedAt:"2027-04-20T19:50:00Z"} };
  const g2 = { ...base(920002, "2027-04-20T23:00:00Z"), bullpen:{days:base(2,"2027-04-20T23:00:00Z").bullpen.days,today:{date:"2027-04-20", state:"played", gameType:"R", pitchingComplete:true, gamePk:g1.gamePk},version:"usage-g1-complete",usedVersion:"usage-before-g1"}, contextBuiltFor:"sch-1|usage-before-g1|R" };
  const x = { ...pre, gamePk:930001, sources:{...pre.sources,stats:source("available","stat-3",now,{usedVersion:"stat-2"})} };
  const oldFingerprint = matchupFingerprint({...x,sources:{...x.sources,stats:source("available","stat-2",now,{usedVersion:"stat-2"})}});
  const changedStats = {...x, matchupBuiltFor:oldFingerprint};
  const afterStats = {...changedStats,sources:{...changedStats.sources,stats:{...changedStats.sources.stats,usedVersion:"stat-3"}}};
  const processed = {...afterStats,matchupBuiltFor:matchupFingerprint(afterStats)};
  const pending = { ...base(940001,"2027-04-19T12:00:00Z","final"), post:{complete:false,inningsComplete:true,pitchingComplete:false,checkedAt:"2027-04-20T15:00:00Z"} };
  const tomorrowNear = { ...base(940002,"2027-04-21T00:30:00Z"), officialDate:"2027-04-21" };
  const postponed = { ...base(940003,"2027-04-22T22:00:00Z","postponed"), priorStartUTC:"2027-04-20T22:00:00Z", scheduleVersion:"sch-moved", sources:{...base(3,"2027-04-22T22:00:00Z").sources,schedule:source("available","sch-moved",now,{usedVersion:"sch-1"})} };
  const uncertain={...base(940004,"2027-04-20T21:00:00Z","postponed"),startUTC:null,officialDate:"2027-04-20"};
  const resumed={...postponed,phase:"scheduled",sources:{...postponed.sources,schedule:source("unchanged","sch-moved","2027-04-22T18:30:00Z",{usedVersion:"sch-moved"}),lineup:source("unpublished",null,"2027-04-22T18:30:00Z")}};
  return [
    {name:"A 同日多階段",now,games:[pre,near,live,partial,complete]},
    {name:"B G1用量先齊、G2賽前",now,games:[g1,g2]},
    {name:"C 統計版本更新",now,games:[changedStats]},
    {name:"C 統計處理成功，待重算對位",now,games:[afterStats]},
    {name:"C 同版重跑",now,games:[processed]},
    {name:"D 今日無新賽、待補與改期",now,games:[pending,tomorrowNear,postponed,uncertain]},
    {name:"D 改期來源恢復並進入賽前",now:"2027-04-22T19:00:00Z",games:[resumed]},
  ];
}

export function renderDemo() {
  const cases = demoCases();
  const lines = ["# 下一季更新決策離線演練", "", "討論用試算；人工狀態輸入、無外部請求、無排程、無正式資料修改。核心來源檢查列技術假設，正式執行仍以書面使用權為前提；預估與模型天氣因條件未確認，預設不安排來源工作。", "", `試算參數：${JSON.stringify(TRIAL_POLICY)}。輪詢間隔不是來源發布至頁面更新的保證；還須加來源、處理、QA 與發布時間。`, "", "動作數為模組工作數，不是 HTTP 次數、供應商額度或帳單。", ""];
  for (const c of cases) {
    const rows=planRound(c), active=rows.filter(r=>["更新","重算","檢查來源","重試來源","追補"].includes(r.action));
    const reused=rows.filter(r=>["沿用","沿用舊值","沿用凍結版","沿用已得部分"].includes(r.action)).length;
    const skipped=rows.filter(r=>r.action==="暫不查").length;
    lines.push(`## ${c.name}`, "", `模擬現在：${c.now}；場次 ${c.games.length}；安排模組工作 ${active.length}；沿用 ${reused}；暫不查 ${skipped}（均為模組判斷筆數，不是 HTTP 節省數）。`, "", "| 場次 | 模組 | 動作 | 原因與判斷依據 | 下次檢查條件 |", "|---|---|---|---|---|");
    for (const r of rows) lines.push(`| ${r.gamePk} | ${r.module} | ${r.action} | ${r.reason}；${r.basis} | ${r.next} |`);
    lines.push("");
  }
  const acquired={kind:"player-stats",id:11,season:2027,gameType:"R",version:"stat-2",acquiredAt:"2027-04-20T19:00:00Z",validUntil:"2027-04-20T21:00:00Z"};
  const checks=[
    ["同球員同季同賽別同版本且有效",acquired,{...acquired}],
    ["同球員但統計版本已變",acquired,{...acquired,version:"stat-3"}],
    ["同球員但賽別為春訓",acquired,{...acquired,gameType:"S"}],
    ["同球員同版但已過有效時點",{...acquired,validUntil:"2027-04-20T19:59:59Z"},{...acquired}],
  ];
  lines.push("## 同輪重用檢查", "", "| 候選 | 判定 |", "|---|---|");
  for (const [label,have,wanted] of checks) lines.push(`| ${label} | ${reusable(have,wanted,"2027-04-20T20:00:00Z") ? "可共用已取得資料" : "不得沿用，需按新範圍／版本處理"} |`);
  lines.push("", "隊伍與球場亦用相同鍵：資料類型＋ID＋賽季＋賽別＋版本＋有效時點。實際重用期限須按供應商 feed 決定；這份輸出沒有外部 HTTP 計數，不推算省下的請求數。", "", "## 待供應商回覆", "", "- G1 的逐投手用量與逐局得分是獨立完整度；G2 牛棚重算不等 G1 post.complete。", "- 春訓 S 登板可供閱讀，跨 S／R 情境暫不判定；當季 R 成績、上季 R 參考與逐場實投分開。", "- 尚須確認各 feed 的更新通知／延遲、額度、可重用時效、正式授權與價格，再調整試算間隔。", "");
  return lines.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.stdout.write(renderDemo());

