const fs = require('fs');
const path = require('path');

function sqlEscape(value) {
    return String(value ?? '').replace(/'/g, "''");
}

async function fetchLivePlayers() {
    console.log('Fetching live player list from cpblfantasy.vercel.app...');
    
    try {
        const response = await fetch('https://cpblfantasy.vercel.app/api/playerslist');
        
        if (!response.ok) {
            throw new Error(`Failed to fetch players: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        const players = Array.isArray(data.players) ? data.players : [];
        
        console.log(`Successfully fetched ${players.length} players from the live API.`);
        
        // 1. Generate SQL for player_list
        let sql = `-- Auto-generated from Live API on ${new Date().toISOString()}\n`;
        sql += `-- Total players: ${players.length}\n\n`;

        sql += `CREATE TABLE IF NOT EXISTS public.player_list (\n`;
        sql += `    player_id TEXT PRIMARY KEY,\n`;
        sql += `    name TEXT NOT NULL,\n`;
        sql += `    team TEXT,\n`;
        sql += `    batter_or_pitcher TEXT NOT NULL,\n`;
        sql += `    identity TEXT DEFAULT 'local',\n`;
        sql += `    original_name TEXT,\n`;
        sql += `    available BOOLEAN DEFAULT true,\n`;
        sql += `    add_date DATE DEFAULT CURRENT_DATE,\n`;
        sql += `    position_list TEXT,\n`;
        sql += `    created_at TIMESTAMPTZ DEFAULT now()\n`;
        sql += `);\n\n`;

        // Safely add position_list column in case the table exists without it
        sql += `ALTER TABLE public.player_list ADD COLUMN IF NOT EXISTS position_list TEXT;\n\n`;

        sql += `-- Insert players into player_list\n`;
        sql += `INSERT INTO public.player_list (player_id, name, team, batter_or_pitcher, identity, original_name, available, add_date, position_list)\nVALUES\n`;

        const values = players.map((p, i) => {
            const name = sqlEscape(p.name);
            const team = p.team ? `'${sqlEscape(p.team)}'` : 'NULL';
            const original_name = p.original_name ? `'${sqlEscape(p.original_name)}'` : 'NULL';
            const identity = sqlEscape(p.identity || 'local');
            const batter_or_pitcher = sqlEscape(p.batter_or_pitcher || 'batter');
            const available = p.available === false ? 'false' : 'true';
            const add_date = p.add_date || new Date().toISOString().split('T')[0];
            const position_list = p.position_list ? `'${sqlEscape(p.position_list)}'` : 'NULL';
            const comma = i < players.length - 1 ? ',' : '';
            return `    ('${sqlEscape(p.player_id)}', '${name}', ${team}, '${batter_or_pitcher}', '${identity}', ${original_name}, ${available}, '${add_date}', ${position_list})${comma}`;
        });

        sql += values.join('\n');
        sql += `\nON CONFLICT (player_id) DO UPDATE SET \n`;
        sql += `    name = EXCLUDED.name,\n`;
        sql += `    team = EXCLUDED.team,\n`;
        sql += `    batter_or_pitcher = EXCLUDED.batter_or_pitcher,\n`;
        sql += `    identity = EXCLUDED.identity,\n`;
        sql += `    available = EXCLUDED.available,\n`;
        sql += `    add_date = EXCLUDED.add_date,\n`;
        sql += `    position_list = EXCLUDED.position_list,\n`;
        sql += `    original_name = EXCLUDED.original_name;\n\n`;

        // Write SQL file
        const sqlOutputPath = path.join(__dirname, 'scripts', 'create_player_list.sql');
        fs.writeFileSync(sqlOutputPath, sql, 'utf-8');
        console.log(`\nSQL migration script written to: ${sqlOutputPath}`);

        // Write JSON file for local reference
        const jsonOutputPath = path.join(__dirname, 'scripts', 'player_data.json');
        fs.writeFileSync(jsonOutputPath, JSON.stringify(players, null, 2), 'utf-8');
        console.log(`JSON raw data written to: ${jsonOutputPath}`);

    } catch (err) {
        console.error('Error fetching live players:', err);
    }
}

fetchLivePlayers();
