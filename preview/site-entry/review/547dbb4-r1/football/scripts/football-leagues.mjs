// 足球正式更新與候選共用的聯賽、來源及賽前時窗設定。
export const EUROPE = [
  { id: 'uefa.champions', label: '歐冠' },
  { id: 'uefa.europa', label: '歐聯' },
  { id: 'uefa.europa.conf', label: '歐協' },
];

export const LEAGUES = {
  'eng.1': { label: '英超', country: '英格蘭', cups: [
    { id: 'eng.fa', label: '足總盃' }, { id: 'eng.league_cup', label: '聯賽盃' },
  ] },
  'esp.1': { label: '西甲', country: '西班牙', cups: [{ id: 'esp.copa_del_rey', label: '國王盃' }] },
  'ita.1': { label: '義甲', country: '義大利', cups: [{ id: 'ita.coppa_italia', label: '義大利盃' }] },
  'ger.1': { label: '德甲', country: '德國', cups: [{ id: 'ger.dfb_pokal', label: '德國盃' }] },
  'fra.1': { label: '法甲', country: '法國', cups: [{ id: 'fra.coupe_de_france', label: '法國盃' }] },
};

export const TOP_LEAGUE_IDS = Object.keys(LEAGUES);
export const LIVE_LEAGUE_IDS = TOP_LEAGUE_IDS;
export const FORM_GAMES = 5;
export const USAGE_DAYS = 14;
export const PREMATCH_MINUTES = [90, 30];
export const competitionsFor = id => {
  const config = LEAGUES[id];
  if (!config) throw new Error(`不支援的聯賽 ${id}`);
  return [{ id, label: config.label }, ...config.cups, ...EUROPE];
};
export const competitionLabel = id =>
  [...TOP_LEAGUE_IDS.flatMap(competitionsFor), ...EUROPE].find(item => item.id === id)?.label || id;
