/**
 * Generate weekly matchups for a league.
 * 
 * Uses a round-robin algorithm to ensure:
 * - Each manager plays every other manager as evenly as possible
 * - No manager plays the same opponent in consecutive weeks
 * - All managers play each week
 * 
 * Usage: node generate_matchups.js <leagueId>
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LEAGUE_ID = process.argv[2] || '82dc9fcb-aef2-428f-97b5-8a602471a332';

/**
 * Round-robin scheduling algorithm.
 * Given N teams, generates pairings for each round.
 * For N teams, there are (N-1) rounds in a full cycle, each with N/2 matchups.
 * We rotate through these rounds for all weeks.
 */
function generateRoundRobinSchedule(managerIds, totalWeeks) {
    const n = managerIds.length;
    if (n < 2) throw new Error('Need at least 2 managers');
    if (n % 2 !== 0) {
        throw new Error(`Need an even number of managers. Got ${n}.`);
    }

    // Standard round-robin: fix team[0], rotate others
    const teams = [...managerIds];
    const rounds = [];
    const numRounds = n - 1; // Full cycle = n-1 rounds

    for (let round = 0; round < numRounds; round++) {
        const pairings = [];
        for (let i = 0; i < n / 2; i++) {
            const home = teams[i];
            const away = teams[n - 1 - i];
            pairings.push([home, away]);
        }
        rounds.push(pairings);

        // Rotate: keep teams[0] fixed, rotate the rest
        const last = teams.pop();
        teams.splice(1, 0, last);
    }

    // Map weeks to rounds (cycle through if more weeks than rounds)
    const weeklyMatchups = [];
    for (let week = 0; week < totalWeeks; week++) {
        const roundIndex = week % numRounds;
        weeklyMatchups.push(rounds[roundIndex]);
    }

    return weeklyMatchups;
}

async function main() {
    console.log(`\n🏆 Generating matchups for league: ${LEAGUE_ID}\n`);

    // 1. Fetch league members
    const { data: members, error: membersError } = await supabase
        .from('league_members')
        .select('manager_id, nickname')
        .eq('league_id', LEAGUE_ID)
        .order('joined_at', { ascending: true });

    if (membersError) {
        console.error('❌ Error fetching members:', membersError);
        process.exit(1);
    }

    if (!members || members.length < 2) {
        console.error('❌ Need at least 2 members in the league. Found:', members?.length || 0);
        process.exit(1);
    }

    console.log(`👥 Found ${members.length} managers:`);
    members.forEach((m, i) => console.log(`   ${i + 1}. ${m.nickname} (${m.manager_id})`));

    if (members.length % 2 !== 0) {
        console.error(`\n❌ Need an even number of managers. Got ${members.length}.`);
        process.exit(1);
    }

    // 2. Fetch league schedule
    const { data: schedule, error: scheduleError } = await supabase
        .from('league_schedule')
        .select('week_number, week_start, week_end, week_type')
        .eq('league_id', LEAGUE_ID)
        .order('week_number', { ascending: true });

    if (scheduleError) {
        console.error('❌ Error fetching schedule:', scheduleError);
        process.exit(1);
    }

    if (!schedule || schedule.length === 0) {
        console.error('❌ No schedule found for this league.');
        process.exit(1);
    }

    console.log(`\n📅 Found ${schedule.length} weeks in schedule`);

    // 3. Check if matchups already exist
    const { data: existingMatchups, error: existingError } = await supabase
        .from('league_matchups')
        .select('id')
        .eq('league_id', LEAGUE_ID)
        .limit(1);

    if (!existingError && existingMatchups && existingMatchups.length > 0) {
        console.log('\n⚠️  Matchups already exist for this league. Deleting old matchups...');
        const { error: deleteError } = await supabase
            .from('league_matchups')
            .delete()
            .eq('league_id', LEAGUE_ID);

        if (deleteError) {
            console.error('❌ Error deleting old matchups:', deleteError);
            process.exit(1);
        }
        console.log('   ✅ Old matchups deleted.');
    }

    // 4. Generate matchups using round-robin
    const managerIds = members.map(m => m.manager_id);
    const weeklyMatchups = generateRoundRobinSchedule(managerIds, schedule.length);

    // 5. Build insert records
    const records = [];
    for (let weekIdx = 0; weekIdx < schedule.length; weekIdx++) {
        const week = schedule[weekIdx];
        const pairings = weeklyMatchups[weekIdx];

        for (const [manager1, manager2] of pairings) {
            records.push({
                league_id: LEAGUE_ID,
                week_number: week.week_number,
                week_start: week.week_start,
                week_end: week.week_end,
                manager1_id: manager1,
                manager2_id: manager2,
                team1_score: 0,
                team2_score: 0,
            });
        }
    }

    console.log(`\n📋 Generated ${records.length} matchup records (${schedule.length} weeks × ${managerIds.length / 2} matchups/week)`);

    // 6. Insert into database
    const { data: inserted, error: insertError } = await supabase
        .from('league_matchups')
        .insert(records)
        .select('id');

    if (insertError) {
        console.error('❌ Error inserting matchups:', insertError);
        process.exit(1);
    }

    console.log(`\n✅ Successfully inserted ${inserted.length} matchup records!`);

    // 7. Print summary
    console.log('\n📊 Matchup Summary:');
    const nicknameMap = {};
    members.forEach(m => nicknameMap[m.manager_id] = m.nickname);

    for (let weekIdx = 0; weekIdx < Math.min(schedule.length, 10); weekIdx++) {
        const week = schedule[weekIdx];
        const pairings = weeklyMatchups[weekIdx];
        console.log(`\n   Week ${week.week_number} (${week.week_start} → ${week.week_end}):`);
        for (const [m1, m2] of pairings) {
            console.log(`      ${nicknameMap[m1]} vs ${nicknameMap[m2]}`);
        }
    }

    if (schedule.length > 10) {
        console.log(`\n   ... and ${schedule.length - 10} more weeks`);
    }

    console.log('\n🎉 Done!\n');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
