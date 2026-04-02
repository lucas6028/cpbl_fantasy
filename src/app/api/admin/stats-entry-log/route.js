import { NextResponse } from 'next/server'
import supabase from '@/lib/supabase'

// GET - fetch entry log for a date
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    
    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    }

    // Get game UUIDs for the date first
    const { data: games, error: gamesError } = await supabase
      .from('cpbl_schedule_2026')
      .select('uuid')
      .eq('date', date)

    if (gamesError) {
      return NextResponse.json({ error: gamesError.message }, { status: 500 })
    }

    const gameUuids = games.map(g => g.uuid)
    
    if (gameUuids.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    // Get entry log for those games
    const { data, error } = await supabase
      .from('stats_entry_log_2026')
      .select('*')
      .in('game_uuid', gameUuids)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST - add entry to log
export async function POST(req) {
  try {
    const { game_uuid, team } = await req.json()
    
    if (!game_uuid || !team) {
      return NextResponse.json({ error: 'game_uuid and team are required' }, { status: 400 })
    }

    // Some deployments do not have a unique constraint on (game_uuid, team),
    // so avoid `upsert(..., { onConflict })` and handle idempotency manually.
    const { data: existing, error: existingError } = await supabase
      .from('stats_entry_log_2026')
      .select('*')
      .eq('game_uuid', game_uuid)
      .eq('team', team)
      .limit(1)

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }

    if (existing && existing.length > 0) {
      return NextResponse.json({ success: true, data: existing })
    }

    const { data, error } = await supabase
      .from('stats_entry_log_2026')
      .insert({ game_uuid, team })
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
