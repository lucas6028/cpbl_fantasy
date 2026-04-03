import { NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')

  if (!date) {
    return NextResponse.json({ error: '缺少日期參數' }, { status: 400 })
  }

  const { data: lineups, error } = await supabaseAdmin
    .from('starting_lineup')
    .select('id, date, team, batting_no, player_id')
    .eq('date', date)

  if (error) {
    console.error('❌ Supabase 錯誤:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const playerIds = [...new Set((lineups || []).map(l => l.player_id).filter(Boolean))]
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

  const data = (lineups || []).map(l => ({
    ...l,
    player: playerMap.get(String(l.player_id)) || null
  }))

  return NextResponse.json(data)
}
