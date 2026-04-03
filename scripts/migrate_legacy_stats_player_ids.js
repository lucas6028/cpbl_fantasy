require('dotenv').config()

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TABLES = [
  'batting_stats_2026',
  'pitching_stats_2026',
]

const LEGACY_PATTERN = /^\d+$/

// Only one duplicated player name was found in the live data.
// The game-date override keeps the migration deterministic.
const OVERRIDES = {
  pitching_stats_2026: {
    林子崴: {
      '2026-03-28': '9e3ade75-007e-4c47-b675-24d4edf72c00', // 樂天桃猿
      '2026-03-31': '2e97272f-c659-48cd-9157-53a59b47ef3a', // 統一獅
    },
  },
}

async function getPlayerUuid(table, row) {
  const { data: matches, error } = await supabase
    .from('player_list')
    .select('player_id, name, team')
    .eq('name', row.name)

  if (error) {
    throw new Error(`Failed to look up player_list for ${row.name}: ${error.message}`)
  }

  if (matches.length === 1) {
    return matches[0].player_id
  }

  const override = OVERRIDES[table]?.[row.name]?.[row.game_date]
  if (override) {
    return override
  }

  if (matches.length > 1) {
    throw new Error(
      `Ambiguous player name "${row.name}" on ${row.game_date} in ${table}. ` +
      `No override was configured.`
    )
  }

  throw new Error(`No player_list match found for "${row.name}" on ${row.game_date} in ${table}`)
}

async function migrateTable(table) {
  const { data: rows, error } = await supabase
    .from(table)
    .select('id, player_id, name, game_date')
    .order('game_date', { ascending: true })

  if (error) {
    throw new Error(`Failed to load ${table}: ${error.message}`)
  }

  const legacyRows = (rows || []).filter(row => LEGACY_PATTERN.test(String(row.player_id || '')))
  const updates = []
  const skipped = []

  for (const row of legacyRows) {
    const newPlayerId = await getPlayerUuid(table, row)
    if (newPlayerId === row.player_id) {
      skipped.push(row)
      continue
    }
    updates.push({ id: row.id, oldPlayerId: row.player_id, newPlayerId, name: row.name, game_date: row.game_date })
  }

  for (const update of updates) {
    const { error: updateError } = await supabase
      .from(table)
      .update({ player_id: update.newPlayerId })
      .eq('id', update.id)

    if (updateError) {
      throw new Error(
        `Failed to update ${table} row ${update.id} (${update.name} ${update.game_date}): ${updateError.message}`
      )
    }
  }

  return {
    table,
    legacyRows: legacyRows.length,
    updated: updates.length,
    skipped: skipped.length,
    ambiguous: legacyRows.length - updates.length - skipped.length,
  }
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase env vars.')
  }

  const summary = []
  for (const table of TABLES) {
    const result = await migrateTable(table)
    summary.push(result)
  }

  console.log(JSON.stringify(summary, null, 2))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
