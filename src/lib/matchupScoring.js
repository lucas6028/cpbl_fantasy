import supabase from '@/lib/supabaseServer';

const LOWER_BETTER_BATTER = new Set(['cs', 'k', 'gidp']);
const LOWER_BETTER_PITCHER = new Set([
  'era',
  'whip',
  'bb/9',
  'bb',
  'er',
  'ra',
  'h/9',
  'h',
  'hbp',
  'hr',
  'ibb',
  'l',
  'obpa',
  'rl',
]);

function getCategoryAbbr(categoryName) {
  const match = String(categoryName || '').match(/\(([^)]+)\)/);
  return match ? match[1].toLowerCase().replace('sv+hld', 'svhld') : '';
}

function compareValues(left, right, lowerIsBetter) {
  const a = Number(left);
  const b = Number(right);

  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) {
    return 0;
  }

  if (lowerIsBetter) {
    return a < b ? 1 : -1;
  }

  return a > b ? 1 : -1;
}

function buildFantasyPointsTotal(managerStats, batterCategories, pitcherCategories, batterWeights, pitcherWeights) {
  let total = 0;

  for (const category of batterCategories || []) {
    const abbr = getCategoryAbbr(category);
    const value = Number(managerStats?.[`b_${abbr}`]);
    if (!Number.isFinite(value)) continue;

    const weight = Number.isFinite(Number(batterWeights?.[category])) ? Number(batterWeights[category]) : 1;
    total += value * weight;
  }

  for (const category of pitcherCategories || []) {
    const abbr = getCategoryAbbr(category);
    const value = Number(managerStats?.[`p_${abbr}`]);
    if (!Number.isFinite(value)) continue;

    const weight = Number.isFinite(Number(pitcherWeights?.[category])) ? Number(pitcherWeights[category]) : 1;
    total += value * weight;
  }

  return Math.round((total + Number.EPSILON) * 100) / 100;
}

export async function syncLeagueMatchupScores(leagueId, weekNumber) {
  if (!leagueId || !Number.isInteger(Number(weekNumber))) {
    return { updated: [], skipped: true };
  }

  const week = Number(weekNumber);

  const { data: settings, error: settingsError } = await supabase
    .from('league_settings')
    .select('scoring_type, batter_stat_categories, pitcher_stat_categories')
    .eq('league_id', leagueId)
    .single();

  if (settingsError) {
    throw settingsError;
  }

  const { data: matchups, error: matchupsError } = await supabase
    .from('league_matchups')
    .select('id, manager1_id, manager2_id, team1_score, team2_score, winner_id')
    .eq('league_id', leagueId)
    .eq('week_number', week);

  if (matchupsError) {
    throw matchupsError;
  }

  const { data: weeklyStats, error: statsError } = await supabase
    .from('v_weekly_manager_stats')
    .select('*')
    .eq('league_id', leagueId)
    .eq('week_number', week);

  if (statsError) {
    throw statsError;
  }

  if (!matchups?.length || !weeklyStats?.length) {
    return { updated: [], skipped: true };
  }

  let batterWeights = {};
  let pitcherWeights = {};
  if (settings.scoring_type === 'Head-to-Head Fantasy Points') {
    const { data: weights, error: weightsError } = await supabase
      .from('league_stat_category_weights')
      .select('category_type, category_name, weight')
      .eq('league_id', leagueId);

    if (weightsError) {
      throw weightsError;
    }

    for (const row of weights || []) {
      if (row.category_type === 'batter') {
        batterWeights[row.category_name] = row.weight;
      } else if (row.category_type === 'pitcher') {
        pitcherWeights[row.category_name] = row.weight;
      }
    }
  }

  const statsMap = new Map((weeklyStats || []).map((row) => [String(row.manager_id), row]));
  const updated = [];

  for (const matchup of matchups) {
    if (!matchup.manager1_id || !matchup.manager2_id) continue;

    const manager1Stats = statsMap.get(String(matchup.manager1_id));
    const manager2Stats = statsMap.get(String(matchup.manager2_id));

    if (!manager1Stats || !manager2Stats) continue;

    let team1Score = 0;
    let team2Score = 0;

    if (settings.scoring_type === 'Head-to-Head Fantasy Points') {
      team1Score = buildFantasyPointsTotal(
        manager1Stats,
        settings.batter_stat_categories,
        settings.pitcher_stat_categories,
        batterWeights,
        pitcherWeights
      );
      team2Score = buildFantasyPointsTotal(
        manager2Stats,
        settings.batter_stat_categories,
        settings.pitcher_stat_categories,
        batterWeights,
        pitcherWeights
      );
    } else {
      for (const category of settings.batter_stat_categories || []) {
        const abbr = getCategoryAbbr(category);
        const result = compareValues(
          manager1Stats[`b_${abbr}`],
          manager2Stats[`b_${abbr}`],
          LOWER_BETTER_BATTER.has(abbr)
        );

        if (result > 0) team1Score += 1;
        else if (result < 0) team2Score += 1;
      }

      for (const category of settings.pitcher_stat_categories || []) {
        const abbr = getCategoryAbbr(category);
        const result = compareValues(
          manager1Stats[`p_${abbr}`],
          manager2Stats[`p_${abbr}`],
          LOWER_BETTER_PITCHER.has(abbr)
        );

        if (result > 0) team1Score += 1;
        else if (result < 0) team2Score += 1;
      }
    }

    const winnerId = team1Score > team2Score
      ? matchup.manager1_id
      : team2Score > team1Score
        ? matchup.manager2_id
        : null;

    if (
      Number(matchup.team1_score) === Number(team1Score)
      && Number(matchup.team2_score) === Number(team2Score)
      && String(matchup.winner_id || '') === String(winnerId || '')
    ) {
      continue;
    }

    const { error: updateError } = await supabase
      .from('league_matchups')
      .update({
        team1_score: team1Score,
        team2_score: team2Score,
        winner_id: winnerId,
      })
      .eq('id', matchup.id);

    if (updateError) {
      throw updateError;
    }

    updated.push({
      id: matchup.id,
      team1_score: team1Score,
      team2_score: team2Score,
      winner_id: winnerId,
    });
  }

  return { updated, skipped: false };
}
