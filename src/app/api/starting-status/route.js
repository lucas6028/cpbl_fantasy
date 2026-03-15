import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';

function getTodayTW() {
  const now = new Date();
  const twOffset = 8 * 60 * 60 * 1000;
  const twTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + twOffset);
  return twTime.toISOString().split('T')[0];
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
