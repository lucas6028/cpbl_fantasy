const fs = require('fs');
const path = require('path');

async function fetchLivePlayers() {
    console.log('Fetching live player list from cpblfantasy.vercel.app...');
    
    try {
        const response = await fetch('https://cpblfantasy.vercel.app/api/playerslist');
        
        if (!response.ok) {
            throw new Error(`Failed to fetch players: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        const players = data.players || [];
        
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
            const name = p.name ? p.name.replace(/'/g, "''") : '';
            const team = p.team ? p.team.replace(/'/g, "''") : '';
            const original_name = p.original_name ? `'${p.original_name.replace(/'/g, "''")}'` : 'NULL';
            const identity = p.identity || 'local';
            const batter_or_pitcher = p.batter_or_pitcher || 'batter';
            const add_date = p.add_date || new Date().toISOString().split('T')[0];
            const position_list = p.position_list ? `'${p.position_list}'` : 'NULL';
            const comma = i < players.length - 1 ? ',' : '';
            return `    ('${p.player_id}', '${name}', '${team}', '${batter_or_pitcher}', '${identity}', ${original_name}, true, '${add_date}', ${position_list})${comma}`;
        });

        sql += values.join('\n');
        sql += `\nON CONFLICT (player_id) DO UPDATE SET \n`;
        sql += `    name = EXCLUDED.name,\n`;
        sql += `    team = EXCLUDED.team,\n`;
        sql += `    batter_or_pitcher = EXCLUDED.batter_or_pitcher,\n`;
        sql += `    identity = EXCLUDED.identity,\n`;
        sql += `    position_list = EXCLUDED.position_list,\n`;
        sql += `    original_name = EXCLUDED.original_name;\n\n`;

        // 2. Generate SQL for real_life_player_status (if we want to sync status too)
        sql += `-- Insert real-life statuses\n`;
        sql += `CREATE TABLE IF NOT EXISTS public.real_life_player_status (\n`;
        sql += `    player_id TEXT PRIMARY KEY REFERENCES public.player_list(player_id) ON DELETE CASCADE,\n`;
        sql += `    status TEXT NOT NULL DEFAULT 'Active',\n`;
        sql += `    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n`;
        sql += `    created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n`;
        sql += `);\n\n`;

        sql += `INSERT INTO public.real_life_player_status (player_id, status)\nVALUES\n`;
        const statusValues = players.map((p, i) => {
            const status = p.real_life_status || 'UNREGISTERED';
            const comma = i < players.length - 1 ? ',' : '';
            return `    ('${p.player_id}', '${status}')${comma}`;
        });
        sql += statusValues.join('\n');
        sql += `\nON CONFLICT (player_id) DO UPDATE SET \n`;
        sql += `    status = EXCLUDED.status,\n`;
        sql += `    updated_at = now();\n\n`;

        // Write SQL file
        const sqlOutputPath = path.join(__dirname, 'import_players_from_api.sql');
        fs.writeFileSync(sqlOutputPath, sql, 'utf-8');
        console.log(`\nSQL migration script written to: ${sqlOutputPath}`);

        // Write JSON file for local reference
        const jsonOutputPath = path.join(__dirname, 'live_player_data.json');
        fs.writeFileSync(jsonOutputPath, JSON.stringify(data, null, 2), 'utf-8');
        console.log(`JSON raw data written to: ${jsonOutputPath}`);

    } catch (err) {
        console.error('Error fetching live players:', err);
    }
}

fetchLivePlayers();
