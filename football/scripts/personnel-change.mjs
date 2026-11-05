// Compare observed roles by ESPN athlete ID. This makes no claim about why a player moved or was absent.
export function personnelChange({ target, teamId, recentGames, details, scheduleStatus }) {
  const unavailable = status => ({ status, previous: null, continued: null,
    fromStarterToBench: [], fromBenchToStarter: [] });
  if (!Array.isArray(scheduleStatus) || !scheduleStatus.length
    || scheduleStatus.some(source => source.status !== 'acquired')) return unavailable('schedule_incomplete');
  const ordered = [...(recentGames || [])]
    .filter(game => game.finished && Date.parse(game.kickoffUTC) < Date.parse(target.kickoffUTC)
      && (game.home?.id === teamId || game.away?.id === teamId))
    .sort((a, b) => a.kickoffUTC.localeCompare(b.kickoffUTC));
  const previous = ordered.at(-1);
  if (!previous) return unavailable('previous_game_unavailable');

  const before = details?.[previous.key];
  const current = details?.[target.key];
  if (current?.status === 'not_acquired') return unavailable('target_fetch_failed');
  if (!current?.completeRosters?.[teamId]) return unavailable('target_lineup_unavailable');
  if (before?.status === 'not_acquired') return unavailable('previous_fetch_failed');
  if (!before?.completeRosters?.[teamId]) return unavailable('previous_lineup_incomplete');

  const oldRoster = before.rosters?.[teamId] || [];
  const newRoster = current.rosters?.[teamId] || [];
  const starters = roster => roster.filter(player => player.role === 'starter');
  const oldStarts = starters(oldRoster), newStarts = starters(newRoster);
  const unique = roster => roster.every(player => player.id && roster.filter(other => other.id === player.id).length === 1);
  if (oldStarts.length !== 11 || newStarts.length !== 11 || !unique(oldRoster) || !unique(newRoster)) {
    return unavailable('lineup_inconsistent');
  }
  const oldById = new Map(oldRoster.map(player => [player.id, player]));
  const newById = new Map(newRoster.map(player => [player.id, player]));
  const oldStartIds = new Set(oldStarts.map(player => player.id));
  const newStartIds = new Set(newStarts.map(player => player.id));
  const listedBench = player => player && (player.role === 'sub_on' || player.role === 'bench_unused');
  return {
    status: 'available',
    previous: { key: previous.key, id: previous.id, leagueLabel: previous.leagueLabel,
      kickoffUTC: previous.kickoffUTC, source: previous.source },
    continued: oldStarts.filter(player => newStartIds.has(player.id)).length,
    previousStarterCount: 11, targetStarterCount: 11,
    fromStarterToBench: oldStarts.filter(player => listedBench(newById.get(player.id)))
      .map(player => ({ id: player.id, name: newById.get(player.id).name })),
    fromBenchToStarter: newStarts.filter(player => listedBench(oldById.get(player.id)) && !oldStartIds.has(player.id))
      .map(player => ({ id: player.id, name: player.name })),
  };
}
