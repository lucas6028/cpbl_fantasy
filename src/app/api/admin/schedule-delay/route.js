import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import supabaseAdmin from '@/lib/supabaseAdmin';

function addDays(dateValue, days) {
  if (!dateValue) return null;
  const d = new Date(dateValue);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

async function ensureAdmin() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('user_id')?.value;

  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: adminRecord, error: adminError } = await supabaseAdmin
    .from('admin')
    .select('manager_id')
    .eq('manager_id', userId)
    .single();

  if (adminError || !adminRecord) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true };
}

export async function POST(request) {
  try {
    const adminCheck = await ensureAdmin();
    if (!adminCheck.ok) return adminCheck.response;

    const body = await request.json();
    const affectedWeek = Number(body?.affectedWeek);

    if (!Number.isInteger(affectedWeek) || affectedWeek < 1) {
      return NextResponse.json({ success: false, error: 'affectedWeek must be an integer >= 1' }, { status: 400 });
    }

    let scheduleDateUpdated = 0;
    let leagueScheduleUpdated = 0;
    let leagueMatchupsUpdated = 0;
    let matchupsDateFieldMode = 'start_date/end_date';

    const { data: scheduleDateRows, error: scheduleDateError } = await supabaseAdmin
      .from('schedule_date')
      .select('week_id, week_start, week_end')
      .gt('week_id', affectedWeek)
      .order('week_id', { ascending: true });

    if (scheduleDateError) {
      return NextResponse.json({ success: false, error: 'Failed to load schedule_date', details: scheduleDateError.message }, { status: 500 });
    }

    if (scheduleDateRows && scheduleDateRows.length > 0) {
      const updatedScheduleDate = scheduleDateRows.map((r) => ({
        week_id: r.week_id,
        week_start: addDays(r.week_start, 7),
        week_end: addDays(r.week_end, 7),
      }));

      const { error: scheduleDateUpdateError } = await supabaseAdmin
        .from('schedule_date')
        .upsert(updatedScheduleDate, { onConflict: 'week_id' });

      if (scheduleDateUpdateError) {
        return NextResponse.json({ success: false, error: 'Failed to update schedule_date', details: scheduleDateUpdateError.message }, { status: 500 });
      }

      scheduleDateUpdated = updatedScheduleDate.length;
    }

    const { data: leagueScheduleRows, error: leagueScheduleError } = await supabaseAdmin
      .from('league_schedule')
      .select('id, week_number, week_start, week_end')
      .gt('week_number', affectedWeek);

    if (leagueScheduleError) {
      return NextResponse.json({ success: false, error: 'Failed to load league_schedule', details: leagueScheduleError.message }, { status: 500 });
    }

    if (leagueScheduleRows && leagueScheduleRows.length > 0) {
      const updatedLeagueSchedule = leagueScheduleRows.map((r) => ({
        id: r.id,
        week_start: addDays(r.week_start, 7),
        week_end: addDays(r.week_end, 7),
      }));

      const { error: leagueScheduleUpdateError } = await supabaseAdmin
        .from('league_schedule')
        .upsert(updatedLeagueSchedule, { onConflict: 'id' });

      if (leagueScheduleUpdateError) {
        return NextResponse.json({ success: false, error: 'Failed to update league_schedule', details: leagueScheduleUpdateError.message }, { status: 500 });
      }

      leagueScheduleUpdated = updatedLeagueSchedule.length;
    }

    let matchupsRows = null;
    let matchupsError = null;

    const { data: byStartDateRows, error: byStartDateError } = await supabaseAdmin
      .from('league_matchups')
      .select('id, week_number, start_date, end_date')
      .gt('week_number', affectedWeek);

    if (byStartDateError) {
      const { data: byWeekDateRows, error: byWeekDateError } = await supabaseAdmin
        .from('league_matchups')
        .select('id, week_number, week_start, week_end')
        .gt('week_number', affectedWeek);

      matchupsRows = byWeekDateRows;
      matchupsError = byWeekDateError;
      matchupsDateFieldMode = 'week_start/week_end';
    } else {
      matchupsRows = byStartDateRows;
      matchupsDateFieldMode = 'start_date/end_date';
    }

    if (matchupsError) {
      return NextResponse.json({ success: false, error: 'Failed to load league_matchups', details: matchupsError.message }, { status: 500 });
    }

    if (matchupsRows && matchupsRows.length > 0) {
      let updatedLeagueMatchups = [];

      if (matchupsDateFieldMode === 'start_date/end_date') {
        updatedLeagueMatchups = matchupsRows.map((r) => ({
          id: r.id,
          start_date: addDays(r.start_date, 7),
          end_date: addDays(r.end_date, 7),
        }));
      } else {
        updatedLeagueMatchups = matchupsRows.map((r) => ({
          id: r.id,
          week_start: addDays(r.week_start, 7),
          week_end: addDays(r.week_end, 7),
        }));
      }

      const { error: leagueMatchupsUpdateError } = await supabaseAdmin
        .from('league_matchups')
        .upsert(updatedLeagueMatchups, { onConflict: 'id' });

      if (leagueMatchupsUpdateError) {
        return NextResponse.json({ success: false, error: 'Failed to update league_matchups', details: leagueMatchupsUpdateError.message }, { status: 500 });
      }

      leagueMatchupsUpdated = updatedLeagueMatchups.length;
    }

    return NextResponse.json({
      success: true,
      message: `Weeks after fantasy week ${affectedWeek} have been delayed by 1 week (+7 days).`,
      affectedWeek,
      updated: {
        schedule_date: scheduleDateUpdated,
        league_schedule: leagueScheduleUpdated,
        league_matchups: leagueMatchupsUpdated,
        league_matchups_date_mode: matchupsDateFieldMode,
      },
    });
  } catch (error) {
    console.error('[Admin Schedule Delay API] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
