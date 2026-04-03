import { NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')

  if (!date) {
    return NextResponse.json({ error: '缺少日期' }, { status: 400 })
  }

  const { data: pitchers, error } = await supabaseAdmin
    .from('starting_pitcher')
    .select('id, date, team, player_id, created_at')
    .eq('date', date)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const playerIds = [...new Set((pitchers || []).map(p => p.player_id).filter(Boolean))]
  let playerMap = new Map()

  if (playerIds.length > 0) {
    const { data: players, error: playerError } = await supabaseAdmin
      .from('player_list')
      .select('player_id, name, team')
      .in('player_id', playerIds)

    if (playerError) {
      return NextResponse.json({ error: playerError.message }, { status: 500 })
    }

    playerMap = new Map((players || []).map(p => [String(p.player_id), p]))
  }

  const data = (pitchers || []).map(p => ({
    ...p,
    player: playerMap.get(String(p.player_id)) || null
  }))

  return NextResponse.json(data)
}
