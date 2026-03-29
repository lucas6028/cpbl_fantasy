import { NextResponse } from 'next/server'
import supabase from '@/lib/supabase'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const away = searchParams.get('away')
    const home = searchParams.get('home')
    const isMajorParam = searchParams.get('is_major')

    if (!date || !away || !home || isMajorParam === null) {
      return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 })
    }

    const isMajor = isMajorParam === 'true'
    const teamSet = new Set([away, home])

    const [battingRes, pitchingRes] = await Promise.all([
      supabase
        .from('batting_stats_2026')
        .select('*')
        .eq('game_date', date)
        .eq('is_major', isMajor),
      supabase
        .from('pitching_stats_2026')
        .select('*')
        .eq('game_date', date)
        .eq('is_major', isMajor),
    ])

    if (battingRes.error) {
      return NextResponse.json({ success: false, error: battingRes.error.message }, { status: 500 })
    }
    if (pitchingRes.error) {
      return NextResponse.json({ success: false, error: pitchingRes.error.message }, { status: 500 })
    }

    const battingRows = battingRes.data || []
    const pitchingRows = pitchingRes.data || []

    const playerIds = Array.from(
      new Set([
        ...battingRows.map(r => r.player_id).filter(Boolean),
        ...pitchingRows.map(r => r.player_id).filter(Boolean)
      ])
    )

    const teamByPlayerId = {}
    if (playerIds.length > 0) {
      const { data: players, error: playersError } = await supabase
        .from('player_list')
        .select('player_id, team')
        .in('player_id', playerIds)

      if (playersError) {
        return NextResponse.json({ success: false, error: playersError.message }, { status: 500 })
      }

      ;(players || []).forEach(p => {
        teamByPlayerId[p.player_id] = p.team
      })
    }

    const toTeamKey = (row) => {
      const team = teamByPlayerId[row.player_id]
      if (teamSet.has(team)) return team
      return null
    }

    const battingByTeam = { [away]: [], [home]: [] }
    battingRows.forEach(row => {
      const team = toTeamKey(row)
      if (!team) return
      battingByTeam[team].push(row)
    })

    const pitchingByTeam = { [away]: [], [home]: [] }
    pitchingRows.forEach(row => {
      const team = toTeamKey(row)
      if (!team) return
      pitchingByTeam[team].push(row)
    })

    return NextResponse.json({
      success: true,
      batting_by_team: battingByTeam,
      pitching_by_team: pitchingByTeam,
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message || 'Server error' }, { status: 500 })
  }
}
