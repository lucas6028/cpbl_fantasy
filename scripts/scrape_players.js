/**
 * Scrape all CPBL players from team pages
 * Each team page groups players by position: 投手, 捕手, 內野手, 外野手
 */

const teams = [
  { code: 'ACN', name: '中信兄弟' },
  { code: 'ADD', name: '統一7-ELEVEn獅' },
  { code: 'AJL', name: '樂天桃猿' },
  { code: 'AEO', name: '富邦悍將' },
  { code: 'AAA', name: '味全龍' },
  { code: 'AKP', name: '台鋼雄鷹' },
];

// Position section anchors on team pages: #pitcher, #catcher, #infielder, #outfielder
// 投手 = pitcher, 捕手/內野手/外野手 = batter

async function fetchHTML(url) {
  const res = await fetch(url);
  return await res.text();
}

function parseTeamPage(html, teamName) {
  const players = [];

  // The HTML structure has sections with id="pitcher", "catcher", "infielder", "outfielder"
  // Each section contains player cards with links like /team/person?Acnt=XXXXXXXX
  // We need to find the player links and which section they belong to.

  // Strategy: Find all player links (/team/person?Acnt=) and determine position from context
  // The page has tab-style sections. Let's parse by looking for section markers.

  // Approach: Split HTML by section dividers to determine batter vs pitcher
  // The sections are: coach, pitcher, catcher, infielder, outfielder
  // pitcher -> batter_or_pitcher = 'pitcher'
  // catcher, infielder, outfielder -> batter_or_pitcher = 'batter'

  // Find all sections by looking for id attributes
  const sectionRegex = /id=["'](pitcher|catcher|infielder|outfielder)["']/gi;
  const sectionPositions = [];
  let match;
  while ((match = sectionRegex.exec(html)) !== null) {
    sectionPositions.push({ type: match[1].toLowerCase(), index: match.index });
  }

  // For each section, extract player links
  for (let i = 0; i < sectionPositions.length; i++) {
    const sectionStart = sectionPositions[i].index;
    const sectionEnd = i + 1 < sectionPositions.length ? sectionPositions[i + 1].index : html.length;
    const sectionHTML = html.substring(sectionStart, sectionEnd);
    const sectionType = sectionPositions[i].type;
    const batter_or_pitcher = sectionType === 'pitcher' ? 'pitcher' : 'batter';

    // Find all player links in this section
    const playerLinkRegex = /\/team\/person\?[Aa]cnt=(\d+)["'][^>]*>([^<]+)</g;
    let playerMatch;
    const seenIds = new Set();
    while ((playerMatch = playerLinkRegex.exec(sectionHTML)) !== null) {
      const acnt = playerMatch[1];
      const rawName = playerMatch[2].trim();

      // Skip duplicates (page may have duplicate links per player)
      if (seenIds.has(acnt)) continue;
      seenIds.add(acnt);

      // Determine identity from prefix: ◎ = foreign registration, * = minor league/二軍
      let identity = 'local';
      let cleanName = rawName;
      if (rawName.startsWith('◎')) {
        identity = 'foreign';
        cleanName = rawName.substring(1);
      } else if (rawName.startsWith('*')) {
        cleanName = rawName.substring(1);
        // * typically means on the reserve/farm team list, still local usually
        // but some foreign players also have * — we'll check name chars
      }

      // Detect foreign players by name (non-CJK names, katakana, etc.)
      const hasCJK = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(cleanName);
      const hasKatakana = /[\u30a0-\u30ff]/.test(cleanName);
      // Foreign names translated to Chinese characters — hard to distinguish
      // Keep identity as detected from prefix, default to 'local'

      players.push({
        player_id: acnt,
        name: cleanName,
        original_name: rawName !== cleanName ? rawName : null,
        team: teamName,
        batter_or_pitcher,
        identity,
        position_type: sectionType, // pitcher, catcher, infielder, outfielder
      });
    }
  }

  return players;
}

async function main() {
  const allPlayers = [];

  for (const team of teams) {
    const url = `https://cpbl.com.tw/team?ClubNo=${team.code}`;
    console.log(`Fetching ${team.name} (${url})...`);
    try {
      const html = await fetchHTML(url);
      const players = parseTeamPage(html, team.name);
      console.log(`  Found ${players.length} players`);
      allPlayers.push(...players);
    } catch (err) {
      console.error(`  Error: ${err.message}`);
    }
  }

  console.log(`\nTotal players: ${allPlayers.length}`);

  // Generate SQL INSERT statements
  const today = new Date().toISOString().split('T')[0];

  let sql = `-- Auto-generated from CPBL website scrape on ${today}\n`;
  sql += `-- Total players: ${allPlayers.length}\n\n`;

  // Create the player_list table first
  sql += `CREATE TABLE IF NOT EXISTS public.player_list (\n`;
  sql += `    player_id TEXT PRIMARY KEY,\n`;
  sql += `    name TEXT NOT NULL,\n`;
  sql += `    team TEXT,\n`;
  sql += `    batter_or_pitcher TEXT NOT NULL,\n`;
  sql += `    identity TEXT DEFAULT 'local',\n`;
  sql += `    original_name TEXT,\n`;
  sql += `    available BOOLEAN DEFAULT true,\n`;
  sql += `    add_date DATE DEFAULT CURRENT_DATE,\n`;
  sql += `    created_at TIMESTAMPTZ DEFAULT now()\n`;
  sql += `);\n\n`;

  sql += `-- Enable RLS\n`;
  sql += `ALTER TABLE public.player_list ENABLE ROW LEVEL SECURITY;\n`;
  sql += `CREATE POLICY "Allow all for service role" ON public.player_list\n`;
  sql += `    FOR ALL USING (true) WITH CHECK (true);\n\n`;

  sql += `-- Insert players\n`;
  sql += `INSERT INTO public.player_list (player_id, name, team, batter_or_pitcher, identity, original_name, available, add_date)\nVALUES\n`;

  const values = allPlayers.map((p, i) => {
    const name = p.name.replace(/'/g, "''");
    const team = p.team.replace(/'/g, "''");
    const original_name = p.original_name ? `'${p.original_name.replace(/'/g, "''")}'` : 'NULL';
    const comma = i < allPlayers.length - 1 ? ',' : '';
    return `    ('${p.player_id}', '${name}', '${team}', '${p.batter_or_pitcher}', '${p.identity}', ${original_name}, true, '${today}')${comma}`;
  });

  sql += values.join('\n');
  sql += `\nON CONFLICT (player_id) DO NOTHING;\n`;

  // Write to file
  const fs = require('fs');
  const outputPath = require('path').join(__dirname, 'create_player_list.sql');
  fs.writeFileSync(outputPath, sql, 'utf-8');
  console.log(`\nSQL written to: ${outputPath}`);

  // Also write JSON for reference
  const jsonPath = require('path').join(__dirname, 'player_data.json');
  fs.writeFileSync(jsonPath, JSON.stringify(allPlayers, null, 2), 'utf-8');
  console.log(`JSON written to: ${jsonPath}`);
}

main().catch(console.error);
