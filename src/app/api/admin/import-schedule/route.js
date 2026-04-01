import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import supabaseAdmin from '@/lib/supabaseAdmin';

export async function GET() {
    return handleImport();
}

export async function POST() {
    return handleImport();
}

async function handleImport() {
    try {
        console.log('[Import Schedule] Starting import process...');
        const filePath = path.join(process.cwd(), 'cpbl_schedule_data.json');
        
        if (!fs.existsSync(filePath)) {
            return NextResponse.json(
                { success: false, error: 'cpbl_schedule_data.json not found in the project root' }, 
                { status: 404 }
            );
        }

        const rawData = fs.readFileSync(filePath, 'utf8');
        const json = JSON.parse(rawData);
        
        // The data scraped was wrapped in { "Success": true, "GameDatas": "[{...}]" }
        let gamesRaw = json.GameDatas;
        if (typeof gamesRaw === 'string') {
            gamesRaw = JSON.parse(gamesRaw);
        }

        if (!gamesRaw || !Array.isArray(gamesRaw)) {
            return NextResponse.json(
                { success: false, error: 'Invalid data format in JSON' }, 
                { status: 400 }
            );
        }

        const mappedSchedules = gamesRaw.map(game => {
            // "GameDate": "2026-03-28T00:00:00" -> "YYYY-MM-DD"
            const dateStr = game.GameDate.split('T')[0];
            
            // "PreExeDate": "2026-03-28T17:05:00" -> UTC time ISO
            // Apply Taiwan Time offset (+08:00)
            const timePart = game.PreExeDate ? game.PreExeDate.split('T')[1] : '17:05:00';
            const twDateTimeStr = `${dateStr}T${timePart}+08:00`;
            const utcDate = new Date(twDateTimeStr);
            
            return {
                game_no: game.GameSno,
                date: dateStr,
                time: utcDate.toISOString(),
                away: game.VisitingTeamName,
                home: game.HomeTeamName,
                stadium: game.FieldAbbe || 'TBD',
                major_game: game.KindCode === 'A' || game.KindCode === 'E', // E usually stands for playoff/championship, A is regular
                is_postponed: false
            };
        });

        console.log(`[Import Schedule] Parsed ${mappedSchedules.length} games. Pushing to Supabase...`);

        // We use insert. If you execute this twice, game_no might duplicate unless you added a UNIQUE constraint on game_no.
        // It's recommended to clear the table first or ensure game_no is unique if you want to use upsert.
        const { data, error } = await supabaseAdmin
            .from('cpbl_schedule_2026')
            .insert(mappedSchedules)
            .select();

        if (error) {
            console.error('[Import Schedule] Supabase Insert Error:', error);
            return NextResponse.json({ success: false, error: error.message, details: error }, { status: 500 });
        }

        console.log(`[Import Schedule] Successfully imported ${data.length} games!`);
        return NextResponse.json({ success: true, inserted: data.length });

    } catch (err) {
        console.error('[Import Schedule] Server Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
