// Artificial test input shared by cross-season and same-game trials.
// Counts are the source; overall OPS is recomputed from combined counts, never from split OPS.
export const batterEvents = id => id === 991003
  ? { vl: { pa: 0, ab: 0, h: 0, bb: 0, tb: 0 }, vr: { pa: 3, ab: 3, h: 0, bb: 0, tb: 0 } }
  : { vl: { pa: 4, ab: 4, h: 1, bb: 0, tb: 1 }, vr: { pa: 6, ab: 5, h: 1, bb: 1, tb: 2 } };
export const battingStat = c => ({ plateAppearances: c.pa, atBats: c.ab, hits: c.h, baseOnBalls: c.bb, totalBases: c.tb,
  avg: c.ab ? (c.h / c.ab).toFixed(3).replace(/^0/, "") : ".000",
  ops: c.pa && c.ab ? ((c.h + c.bb) / c.pa + c.tb / c.ab).toFixed(3).replace(/^0/, "") : c.pa ? ".000" : "-.---" });
export const batterBasis = id => { const e = batterEvents(id), total = Object.fromEntries(["pa","ab","h","bb","tb"].map(k => [k, e.vl[k] + e.vr[k]]));
  return { total: battingStat(total), vl: battingStat(e.vl), vr: battingStat(e.vr) }; };
export const batterBasisValid = id => {
  const b = batterBasis(id);
  return b.total.plateAppearances === b.vl.plateAppearances + b.vr.plateAppearances
    && b.total.atBats === b.vl.atBats + b.vr.atBats
    && b.total.hits === b.vl.hits + b.vr.hits
    && b.total.baseOnBalls === b.vl.baseOnBalls + b.vr.baseOnBalls
    && b.total.totalBases === b.vl.totalBases + b.vr.totalBases;
};
