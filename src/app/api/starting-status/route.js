import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';

function getTodayTW() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || getTodayTW();

    const [lineupRes, pitcherRes] = await Promise.all([
      supabaseAdmin
        .from('starting_lineup')
        .select('team, player_id, batting_no')
        .eq('date', date),
      supabaseAdmin
        .from('starting_pitcher')
        .select('player_id')
        .eq('date', date),
    ]);

    if (lineupRes.error) throw lineupRes.error;
    if (pitcherRes.error) throw pitcherRes.error;

    const lineupByPlayerId = {};
    const lineupTeams = new Set();

    (lineupRes.data || []).forEach((row) => {
      if (row.team) lineupTeams.add(row.team);
      if (row.player_id && row.batting_no != null) {
        lineupByPlayerId[String(row.player_id)] = Number(row.batting_no);
      }
    });

    const pitcherPlayerIds = (pitcherRes.data || [])
      .map((row) => String(row.player_id))
      .filter(Boolean);

    return NextResponse.json({
      success: true,
      date,
      lineup_by_player_id: lineupByPlayerId,
      lineup_teams: Array.from(lineupTeams),
      pitcher_player_ids: pitcherPlayerIds,
    });
  } catch (err) {
    console.error('Starting status GET error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch starting status' },
      { status: 500 }
    );
  }
}
