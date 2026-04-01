import supabase from '@/lib/supabaseServer';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  try {
    const { leagueId } = await params;

    if (!leagueId) {
      return NextResponse.json(
        { error: 'League ID is required' },
        { status: 400 }
      );
    }

    // Fetch league settings
    const { data: leagueSettings, error: settingsError } = await supabase
      .from('league_settings')
      .select('*')
      .eq('league_id', leagueId)
      .single();

    if (settingsError) {
      console.error('Supabase settings error:', settingsError);
      return NextResponse.json(
        { error: 'League not found', details: settingsError.message },
        { status: 404 }
      );
    }

    // These queries are independent, so run them in parallel to reduce latency.
    const [scheduleRes, statusRes, membersRes, finalizedRes] = await Promise.all([
      supabase
        .from('league_schedule')
        .select(`
          id,
          league_id,
          week_number,
          week_type,
          week_start,
          week_end,
          week_label
        `)
        .eq('league_id', leagueId)
        .order('week_number', { ascending: true }),
      supabase
        .from('league_statuses')
        .select('status')
        .eq('league_id', leagueId)
        .maybeSingle(),
      supabase
        .from('league_members')
        .select(`
          nickname,
          joined_at,
          manager_id,
          role,
          managers (
            name
          )
        `)
        .eq('league_id', leagueId)
        .order('joined_at', { ascending: true }),
      supabase
        .from('league_finalized_status')
        .select('league_id')
        .eq('league_id', leagueId)
        .maybeSingle(),
    ]);

    const { data: schedule, error: scheduleError } = scheduleRes;
    if (scheduleError) {
      console.error('Supabase schedule error:', scheduleError);
      // We don't block page load if schedule fails.
    }

    const { data: statusData, error: statusError } = statusRes;
    if (statusError) {
      console.error('Supabase status error:', statusError);
    }

    const { data: members, error: membersError } = membersRes;
    if (membersError) {
      console.error('Supabase members error:', membersError);
      return NextResponse.json(
        { error: 'Failed to fetch members', details: membersError.message },
        { status: 500 }
      );
    }

    const { data: finalizedStatus, error: finalizedError } = finalizedRes;

    // Record exists = finalized, no record or error = not finalized
    const isFinalized = !finalizedError && finalizedStatus != null;

    return NextResponse.json(
      {
        success: true,
        league: {
          ...leagueSettings,
          is_finalized: isFinalized
        },
        schedule: schedule || [],
        members: members || [],
        status: statusData?.status || 'unknown',
        maxTeams: leagueSettings?.max_teams || 0,
        invitePermissions: leagueSettings?.invite_permissions || 'commissioner only',
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=45'
        }
      }
    );
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Server error', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE: Delete entire league (Commissioner only)
export async function DELETE(request, { params }) {
  try {
    const { leagueId } = await params;

    if (!leagueId) {
      return NextResponse.json(
        { success: false, error: 'League ID is required' },
        { status: 400 }
      );
    }

    // Check if league is finalized (record exists = finalized)
    const { data: finalizedStatus, error: finalizedError } = await supabase
      .from('league_finalized_status')
      .select('league_id')
      .eq('league_id', leagueId)
      .single();

    if (!finalizedError && finalizedStatus) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete finalized league. Please unlock teams first.' },
        { status: 403 }
      );
    }


    // Delete league_settings will cascade delete all related data
    const { error: deleteError } = await supabase
      .from('league_settings')
      .delete()
      .eq('league_id', leagueId);

    if (deleteError) {
      console.error('Error deleting league:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to delete league', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'League deleted successfully'
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error.message },
      { status: 500 }
    );
  }
}