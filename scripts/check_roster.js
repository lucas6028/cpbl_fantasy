const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkData() {
  const { data: rosts, error: rErr } = await supabase.from('league_roster_positions').select('*').limit(2);
  fs.writeFileSync('roster_data.json', JSON.stringify(rosts || rErr, null, 2));
}

checkData();
