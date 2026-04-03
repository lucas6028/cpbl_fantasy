// check_data.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkData() {
  const result = {};
  
  const { data: bStats, error: bErr } = await supabase.from('batting_stats_2026').select('*').limit(2);
  result.batting_stats_2026 = bStats || bErr;
  
  const { data: pStats, error: pErr } = await supabase.from('pitching_stats_2026').select('*').limit(2);
  result.pitching_stats_2026 = pStats || pErr;
  
  const { data: lSettings, error: sErr } = await supabase.from('league_settings').select('*').limit(2);
  result.league_settings = lSettings || sErr;

  const { data: lSchedule, error: sErr2 } = await supabase.from('league_schedule').select('*').limit(2);
  result.league_schedule = lSchedule || sErr2;

  fs.writeFileSync('tables_output.json', JSON.stringify(result, null, 2));
}

checkData();
