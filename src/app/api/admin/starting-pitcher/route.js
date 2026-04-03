import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import supabaseAdmin from '@/lib/supabaseAdmin';

// GET: Fetch starting pitchers for a date
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
        return NextResponse.json({ success: false, error: 'Missing date' }, { status: 400 });
    }

    try {
        const { data: pitchers, error } = await supabaseAdmin
            .from('starting_pitcher')
            .select('id, date, team, player_id, created_at')
            .eq('date', date)
            .order('team');

        if (error) throw error;

        const playerIds = [...new Set((pitchers || []).map(p => p.player_id).filter(Boolean))];
        let playerMap = new Map();

        if (playerIds.length > 0) {
            const { data: players, error: playerError } = await supabaseAdmin
                .from('player_list')
                .select('player_id, name, team')
                .in('player_id', playerIds);

            if (playerError) throw playerError;

            playerMap = new Map((players || []).map(p => [String(p.player_id), p]));
        }

        const data = (pitchers || []).map(p => ({
            ...p,
            player: playerMap.get(String(p.player_id)) || null
        }));

        return NextResponse.json({ success: true, data });
    } catch (err) {
        console.error('Starting Pitcher GET Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// POST: Save starting pitcher for a team on a date (replaces existing)
export async function POST(request) {
    try {
        const body = await request.json();
        const { date, pitchers } = body;
        // pitchers = [{ team: '...', player_id: '...', name?: '...' }, ...]

        if (!date || !pitchers || !Array.isArray(pitchers)) {
            return NextResponse.json({ success: false, error: 'Missing date or pitchers' }, { status: 400 });
        }

        const normalizedPitchers = pitchers
            .filter(p => p && p.team && (p.player_id || p.name))
            .map(p => ({
                team: p.team,
                player_id: p.player_id || null,
                name: (p.name || '').trim()
            }));

        if (normalizedPitchers.length === 0) {
            return NextResponse.json({ success: true, inserted: 0 });
        }

        const missingNames = normalizedPitchers.filter(p => !p.name && p.player_id);
        if (missingNames.length > 0) {
            const playerIds = missingNames.map(p => p.player_id).filter(Boolean);
            const { data: players, error: playerError } = await supabaseAdmin
                .from('player_list')
                .select('player_id, name')
                .in('player_id', playerIds);

            if (playerError) throw playerError;

            const nameByPlayerId = new Map((players || []).map(p => [String(p.player_id), p.name]));
            normalizedPitchers.forEach(p => {
                if (!p.name && p.player_id) {
                    p.name = nameByPlayerId.get(String(p.player_id)) || '';
                }
            });
        }

        const validPitchers = normalizedPitchers.filter(p => p.player_id && p.team && p.name);

        if (validPitchers.length !== normalizedPitchers.length) {
            return NextResponse.json(
                { success: false, error: 'Each starting pitcher must include a valid team, player_id, and name' },
                { status: 400 }
            );
        }

        // Get unique teams from the input to delete their existing entries
        const teams = [...new Set(validPitchers.map(p => p.team))];

        // Delete existing entries for these teams on this date
        if (teams.length > 0) {
            const { error: delError } = await supabase
                .from('starting_pitcher')
                .delete()
                .eq('date', date)
                .in('team', teams);

            if (delError) throw delError;
        }

        if (validPitchers.length > 0) {
            const rows = validPitchers.map(p => ({
                date,
                team: p.team,
                player_id: p.player_id,
                name: p.name
            }));

            const { error: insertError } = await supabase
                .from('starting_pitcher')
                .insert(rows);

            if (insertError) throw insertError;
        }

        return NextResponse.json({ success: true, inserted: validPitchers.length });
    } catch (err) {
        console.error('Starting Pitcher POST Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// DELETE: Delete pitcher for a team on a date
export async function DELETE(request) {
    try {
        const body = await request.json();
        const { date, team } = body;

        if (!date || !team) {
            return NextResponse.json({ success: false, error: 'Missing date or team' }, { status: 400 });
        }

        const { error } = await supabase
            .from('starting_pitcher')
            .delete()
            .eq('date', date)
            .eq('team', team);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Starting Pitcher DELETE Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
