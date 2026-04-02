
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import supabase from '@/lib/supabaseServer';

export async function GET(request, { params }) {
    try {
        const { leagueId } = await params;

        // 1. Admin check
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: adminRecord, error: adminError } = await supabase
            .from('admin')
            .select('manager_id')
            .eq('manager_id', userId)
            .single();

        if (adminError || !adminRecord) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 2. Fetch league schedules
        const { data: schedules, error: scheduleError } = await supabase
            .from('league_schedule')
            .select('*')
            .eq('league_id', leagueId)
            .order('week_number', { ascending: true });

        if (scheduleError) {
            return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
        }

        // 3. Fetch league matchups
        const { data: matchups, error: matchupsError } = await supabase
            .from('league_matchups')
            .select('*')
            .eq('league_id', leagueId);

        if (matchupsError) {
            return NextResponse.json({ error: 'Failed to fetch matchups' }, { status: 500 });
        }

        // 4. Fetch member names
        const { data: members, error: membersError } = await supabase
            .from('league_members')
            .select('manager_id, nickname')
            .eq('league_id', leagueId);

        const memberMap = {};
        if (members) {
            members.forEach(m => {
                memberMap[m.manager_id] = m.nickname;
            });
        }

        return NextResponse.json({
            success: true,
            schedules: schedules || [],
            matchups: matchups || [],
            memberMap
        });

    } catch (error) {
        console.error('Admin matchups error:', error);
        return NextResponse.json({ error: 'Server error', details: error.message }, { status: 500 });
    }
}

export async function POST(request, { params }) {
    try {
        const { leagueId } = await params;

        // 1. Admin check
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: adminRecord, error: adminError } = await supabase
            .from('admin')
            .select('manager_id')
            .eq('manager_id', userId)
            .single();

        if (adminError || !adminRecord) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 2. Fetch league members
        const { data: members, error: membersError } = await supabase
            .from('league_members')
            .select('manager_id')
            .eq('league_id', leagueId);

        if (membersError) {
            console.error('Error fetching league members:', membersError);
            return NextResponse.json({ error: 'Failed to fetch league members' }, { status: 500 });
        }

        if (!members || members.length < 2) {
            return NextResponse.json({ error: 'Not enough members to generate matchups (minimum 2)' }, { status: 400 });
        }

        const managerIds = members.map(m => m.manager_id);
        let teams = [...managerIds];
        const isOdd = teams.length % 2 !== 0;

        if (isOdd) {
            teams.push(null); // Add a dummy team for bye weeks
        }

        const numTeams = teams.length;
        const half = numTeams / 2;
        const rounds = numTeams - 1; // Number of rounds for a full round-robin

        // 3. Fetch league schedules
        const { data: schedules, error: scheduleError } = await supabase
            .from('league_schedule')
            .select('*')
            .eq('league_id', leagueId)
            .order('week_number', { ascending: true });

        if (scheduleError) {
            console.error('Error fetching league schedule:', scheduleError);
            return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
        }

        const matchupsToInsert = [];

        for (let round = 0; round < rounds; round++) {
            const weekSchedule = schedules.find(s => s.week_number === round + 1);

            if (!weekSchedule) {
                console.warn(`No schedule found for week ${round + 1}. Skipping matchup generation for this week.`);
                continue;
            }

            for (let i = 0; i < half; i++) {
                const manager1_id = teams[i];
                const manager2_id = teams[numTeams - 1 - i];

                if (manager1_id === null) {
                    // manager2_id has a bye
                    matchupsToInsert.push({
                        league_id: leagueId,
                        week_number: weekSchedule.week_number,
                        week_start: weekSchedule.week_start,
                        week_end: weekSchedule.week_end,
                        manager1_id: manager2_id, // The manager with the bye is manager1
                        manager2_id: null, // No opponent
                    });
                } else if (manager2_id === null) {
                    // manager1_id has a bye
                    matchupsToInsert.push({
                        league_id: leagueId,
                        week_number: weekSchedule.week_number,
                        week_start: weekSchedule.week_start,
                        week_end: weekSchedule.week_end,
                        manager1_id: manager1_id, // The manager with the bye is manager1
                        manager2_id: null, // No opponent
                    });
                } else {
                    // Regular matchup
                    matchupsToInsert.push({
                        league_id: leagueId,
                        week_number: weekSchedule.week_number,
                        week_start: weekSchedule.week_start,
                        week_end: weekSchedule.week_end,
                        manager1_id: manager1_id,
                        manager2_id: manager2_id,
                    });
                }
            }

            // Rotate teams (fixed first team, rotate others)
            const lastTeam = teams.pop();
            teams.splice(1, 0, lastTeam);
        }

        // 4. Delete existing matchups for this league
        const { error: deleteError } = await supabase
            .from('league_matchups')
            .delete()
            .eq('league_id', leagueId);

        if (deleteError) {
            console.error('Error deleting existing matchups:', deleteError);
            return NextResponse.json({ error: 'Failed to delete existing matchups' }, { status: 500 });
        }

        // 5. Insert new matchups
        const { error: insertError } = await supabase
            .from('league_matchups')
            .insert(matchupsToInsert);

        if (insertError) {
            console.error('Error inserting new matchups:', insertError);
            return NextResponse.json({ error: 'Failed to insert new matchups' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Matchups generated successfully', count: matchupsToInsert.length });

    } catch (error) {
        console.error('Admin generate matchups error:', error);
        return NextResponse.json({ error: 'Server error', details: error.message }, { status: 500 });
    }
}
