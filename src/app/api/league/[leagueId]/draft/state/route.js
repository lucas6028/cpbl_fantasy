
import { NextResponse } from 'next/server';

import supabase from '@/lib/supabaseServer';
import { draftCache, CACHE_TTL } from '@/lib/draftCache';

// ─── Cached helpers ────────────────────────────────────────────────

async function getCachedPositionMap() {
    return draftCache.getOrFetch('allPositions', async () => {
        const [batterRes, pitcherRes] = await Promise.all([
            supabase.from('v_batter_positions').select('player_id, position_list'),
            supabase.from('v_pitcher_positions').select('player_id, position_list'),
        ]);
        const map = {};
        if (batterRes.data) batterRes.data.forEach(b => map[b.player_id] = b.position_list);
        if (pitcherRes.data) pitcherRes.data.forEach(p => map[p.player_id] = p.position_list);
        return map;
    }, CACHE_TTL.POSITIONS);
}

async function getCachedSettings(leagueId) {
    return draftCache.getOrFetch(`settings:${leagueId}`, async () => {
        const { data } = await supabase
            .from('league_settings')
            .select('live_draft_time, live_draft_pick_time, foreigner_active_limit')
            .eq('league_id', leagueId)
            .single();
        return data;
    }, CACHE_TTL.LEAGUE_SETTINGS);
}

function parseDuration(settings) {
    let duration = 60;
    if (settings?.live_draft_pick_time) {
        const timeStr = settings.live_draft_pick_time.toLowerCase();
        if (timeStr.includes('minute')) {
            duration = parseInt(timeStr) * 60;
        } else if (timeStr.includes('second')) {
            duration = parseInt(timeStr);
        }
    }
    return duration + 10;
}

// Enrich picks with player details fetched separately from player_list
async function enrichPicksWithPlayerData(picks, posMap) {
    if (!picks || picks.length === 0) return;

    const playerIds = picks.map(p => p.player_id).filter(Boolean);
    if (playerIds.length === 0) return;

    const { data: playerRows } = await supabase
        .from('player_list')
        .select('player_id, name, team, batter_or_pitcher, identity, original_name')
        .in('player_id', playerIds);

    const playerMap = {};
    if (playerRows) playerRows.forEach(p => playerMap[p.player_id] = p);

    for (const pick of picks) {
        if (!pick.player_id) continue;
        const playerData = playerMap[pick.player_id] || {};
        pick.player = {
            name: playerData.name || null,
            team: playerData.team || null,
            batter_or_pitcher: playerData.batter_or_pitcher || null,
            identity: playerData.identity || null,
            original_name: playerData.original_name || null,
            position_list: posMap[pick.player_id] || null,
        };
    }
}

// ─── Auto-pick helper ──────────────────────────────────────────────

async function getBestRankedAvailablePlayer(leagueId, takenIdSet, excludePlayerIds = [], requestUrl = null) {
    const { data: allPlayers } = await supabase
        .from('player_list')
        .select('player_id');

    const allExcluded = new Set([...takenIdSet, ...excludePlayerIds]);
    const validPlayers = allPlayers?.filter(p => !allExcluded.has(p.player_id)) || [];
    if (validPlayers.length === 0) return null;
    const validPlayerIdSet = new Set(validPlayers.map(p => p.player_id));

    try {
        let rankingsUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/league/${leagueId}/rankings`;
        if (requestUrl) {
            const parsedUrl = new URL(requestUrl);
            rankingsUrl = `${parsedUrl.origin}/api/league/${leagueId}/rankings`;
        }

        const res = await fetch(rankingsUrl, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
        const data = await res.json();

        if (data.success && data.rankings && data.rankings.length > 0) {
            for (const r of data.rankings) {
                if (validPlayerIdSet.has(r.player_id)) return r.player_id;
            }
        }
    } catch (e) {
        console.error('[Draft AutoPick] Rankings fetch failed, using random fallback', e);
    }

    const randomIndex = Math.floor(Math.random() * validPlayers.length);
    return validPlayers[randomIndex].player_id;
}

async function finalizeDraftIfNeeded(leagueId, leagueStatus, allPicksData) {
    const completedPicks = (allPicksData || []).filter(
        p => p.player_id != null && p.manager_id != null
    );

    if (completedPicks.length === 0) {
        return;
    }

    const acquiredAt = new Date().toISOString();
    const ownershipRows = completedPicks.map(p => ({
        league_id: leagueId,
        player_id: p.player_id,
        manager_id: p.manager_id,
        status: 'On Team',
        acquired_at: p.picked_at || acquiredAt,
        off_waiver: null,
    }));

    const { error: ownershipError } = await supabase
        .from('league_player_ownership')
        .upsert(ownershipRows, {
            onConflict: 'league_id,player_id',
            ignoreDuplicates: false,
        });

    if (ownershipError) {
        throw new Error(`Failed to finalize draft ownership: ${ownershipError.message}`);
    }

    if (leagueStatus !== 'post-draft & pre-season' && leagueStatus !== 'in-season') {
        const { error: statusError } = await supabase
            .from('league_statuses')
            .update({ status: 'post-draft & pre-season' })
            .eq('league_id', leagueId);

        if (statusError) {
            throw new Error(`Failed to update league status after draft: ${statusError.message}`);
        }
    }
}

// ─── Main GET handler ──────────────────────────────────────────────

export async function GET(request, { params }) {
    const { leagueId } = await params;

    try {
        // 1. Fetch status + settings (settings from cache)
        const [statusRes, settings] = await Promise.all([
            supabase
                .from('league_statuses')
                .select('status')
                .eq('league_id', leagueId)
                .maybeSingle(),
            getCachedSettings(leagueId),
        ]);

        let leagueStatus = statusRes.data?.status;
        const now = new Date();
        const startTime = settings?.live_draft_time ? new Date(settings.live_draft_time) : null;

        // 2. Single consolidated query: fetch ALL picks for this league
        //    No relational join — enriched manually below to avoid FK requirement
        const { data: allPicks, error: allPicksError } = await supabase
            .from('draft_picks')
            .select('pick_id, pick_number, round_number, player_id, manager_id, picked_at, deadline, is_auto_picked')
            .eq('league_id', leagueId)
            .order('pick_number', { ascending: true });

        if (allPicksError) {
            console.error('[DraftState] Error fetching picks:', allPicksError);
            return NextResponse.json({ success: false, error: allPicksError.message }, { status: 500 });
        }

        const allPicksData = allPicks || [];

        // 3. Derive counts and split from the single query result
        const totalPicks = allPicksData.length;
        const completedPicks = allPicksData.filter(p => p.player_id != null);
        const pendingPicks = allPicksData.filter(p => p.player_id == null);
        const remainingPicks = pendingPicks.length;

        // CASE A: No picks generated yet
        if (totalPicks === 0) {
            return NextResponse.json({
                status: 'pre-draft',
                message: 'Draft order not generated',
                startTime: settings?.live_draft_time || null,
                serverTime: now.toISOString()
            });
        }

        // CASE B: Some picks remaining
        if (remainingPicks > 0) {

            // Check if we should START the draft
            if (startTime && now >= startTime) {
                if (leagueStatus !== 'drafting now') {
                    console.log('[DraftState] Time arrived. Switching to "drafting now"...');
                    await supabase.from('league_statuses').update({ status: 'drafting now' }).eq('league_id', leagueId);
                    leagueStatus = 'drafting now';
                }
            } else {
                // Time NOT arrived yet — pre-draft
                const posMap = await getCachedPositionMap();
                await enrichPicksWithPlayerData(completedPicks, posMap);

                // Strip full row data from next picks (only need scheduling info)
                const nextPicksSummary = pendingPicks.map(p => ({
                    pick_id: p.pick_id,
                    pick_number: p.pick_number,
                    round_number: p.round_number,
                    manager_id: p.manager_id,
                }));

                return NextResponse.json({
                    status: 'pre-draft',
                    startTime: settings?.live_draft_time,
                    serverTime: now.toISOString(),
                    remainingPicks,
                    picks: completedPicks,
                    nextPicks: nextPicksSummary,
                    foreignerActiveLimit: settings?.foreigner_active_limit
                });
            }

            // ── Active Draft Logic ──

            let currentPick = pendingPicks[0]; // First unpicked = current

            if (!currentPick) {
                console.warn('[DraftState] Remaining > 0 but currentPick not found?');
                await finalizeDraftIfNeeded(leagueId, leagueStatus, allPicksData);
                return NextResponse.json({ status: 'completed' });
            }

            const duration = parseDuration(settings);
            let autoPickOccurred = false;

            // Init Deadline if needed
            if (!currentPick.deadline) {
                let baseTime = now;

                // Find the most recent completed pick from our already-fetched data
                const lastCompleted = completedPicks.length > 0
                    ? completedPicks[completedPicks.length - 1]
                    : null;

                if (lastCompleted?.picked_at) {
                    baseTime = new Date(lastCompleted.picked_at).getTime();
                    console.log('[Deadline Calc] Previous Pick:', {
                        pickNumber: lastCompleted.pick_number,
                        pickedAt: lastCompleted.picked_at,
                        baseTime: new Date(baseTime).toISOString()
                    });
                } else {
                    console.log('[Deadline Calc] No previous pick found, using server time');
                }

                const nextDeadline = new Date(baseTime + duration * 1000);
                const diff = Math.floor((nextDeadline.getTime() - now) / 1000);

                console.log('[Deadline Calc] Calculation:', {
                    previousPickTime: lastCompleted?.picked_at || 'N/A',
                    nowTime: now.toISOString(),
                    duration: `${duration}s`,
                    calculatedDeadline: nextDeadline.toISOString(),
                    diff: `${diff}s`
                });

                const { data: updated, error: updateError } = await supabase
                    .from('draft_picks')
                    .update({ deadline: nextDeadline.toISOString() })
                    .eq('pick_id', currentPick.pick_id)
                    .select()
                    .single();

                if (updateError) {
                    console.error('[Draft] Failed to update deadline:', updateError);
                }

                if (updated) {
                    currentPick = updated;
                } else {
                    currentPick.deadline = nextDeadline.toISOString();
                }
            }
            // Expired -> AUTO PICK
            else if (new Date(currentPick.deadline) < now) {
                console.log(`[Draft] Pick ${currentPick.pick_number} expired. Auto-picking...`);

                // Build taken set from our already-fetched data (no extra query!)
                const takenIdSet = new Set(completedPicks.map(p => p.player_id));

                // Check Foreigner Limit
                const foreignerLimit = settings?.foreigner_active_limit;
                let excludeForeigners = false;
                let foreignIds = new Set();

                if (foreignerLimit !== null && foreignerLimit !== undefined) {
                    const myForeignerCount = completedPicks.filter(p => {
                        if (String(p.manager_id) !== String(currentPick.manager_id)) return false;
                        const id = (p.player?.identity || '').toLowerCase();
                        return id === 'foreigner' || id === 'f';
                    }).length;

                    if (myForeignerCount >= foreignerLimit) {
                        excludeForeigners = true;
                        const { data: fPlayers } = await supabase
                            .from('player_list')
                            .select('player_id')
                            .or('identity.ilike.foreigner,identity.ilike.f');
                        fPlayers?.forEach(fp => foreignIds.add(fp.player_id));
                    }
                }

                // Check Draft Queue
                const { data: queueItems } = await supabase
                    .from('draft_queues')
                    .select('player_id, queue_id, player:player_list(identity)')
                    .eq('league_id', leagueId)
                    .eq('manager_id', currentPick.manager_id)
                    .order('rank_order', { ascending: true });

                let pickedPlayerId = null;
                let usedQueueId = null;

                if (queueItems && queueItems.length > 0) {
                    for (const item of queueItems) {
                        if (takenIdSet.has(item.player_id)) continue;

                        if (excludeForeigners) {
                            const pIdentity = (item.player?.identity || '').toLowerCase();
                            if (pIdentity === 'foreigner' || pIdentity === 'f') {
                                console.log(`[Draft] Skipping queued foreigner ${item.player_id} due to limit.`);
                                continue;
                            }
                        }

                        pickedPlayerId = item.player_id;
                        usedQueueId = item.queue_id;
                        console.log(`[Draft] Picking from Queue: ${pickedPlayerId}`);
                        break;
                    }
                }

                // Ranking Fallback
                if (!pickedPlayerId) {
                    const exclusions = excludeForeigners ? Array.from(foreignIds) : [];
                    pickedPlayerId = await getBestRankedAvailablePlayer(leagueId, takenIdSet, exclusions, request.url);
                }

                if (pickedPlayerId) {
                    const { data: updateResult, error: updateError } = await supabase
                        .from('draft_picks')
                        .update({
                            player_id: pickedPlayerId,
                            is_auto_picked: true,
                            picked_at: now.toISOString()
                        })
                        .eq('pick_id', currentPick.pick_id)
                        .is('player_id', null)
                        .select();

                    if (updateError || !updateResult || updateResult.length === 0) {
                        console.log(`[Draft] Pick ${currentPick.pick_number} already picked by another request. Skipping.`);
                        // Re-fetch just the next pending pick (lightweight)
                        const { data: refreshPicks } = await supabase
                            .from('draft_picks')
                            .select('*')
                            .eq('league_id', leagueId)
                            .is('player_id', null)
                            .order('pick_number', { ascending: true })
                            .limit(1);

                        if (refreshPicks && refreshPicks.length > 0) {
                            currentPick = refreshPicks[0];
                        }
                    } else {
                        console.log(`[Draft] Successfully auto-picked player ${pickedPlayerId} for pick ${currentPick.pick_number}`);
                        autoPickOccurred = true;

                        if (usedQueueId) await supabase.from('draft_queues').delete().eq('queue_id', usedQueueId);

                        // Find next pending pick from our data (adjust for the one we just completed)
                        const nextPending = pendingPicks.filter(p => p.pick_id !== currentPick.pick_id);

                        if (nextPending.length > 0) {
                            currentPick = nextPending[0];
                            const nextDeadline = new Date(now.getTime() + duration * 1000);
                            const { data: nextUpdated, error: nextUpError } = await supabase
                                .from('draft_picks')
                                .update({ deadline: nextDeadline.toISOString() })
                                .eq('pick_id', currentPick.pick_id)
                                .select()
                                .single();

                            if (nextUpError) console.error('AutoPick Deadline Error:', nextUpError);

                            if (nextUpdated) {
                                currentPick = nextUpdated;
                            } else {
                                currentPick.deadline = nextDeadline.toISOString();
                            }
                        } else {
                            console.log('[DraftState] Last pick made. Finished.');
                            const { data: finalPicks, error: finalPicksError } = await supabase
                                .from('draft_picks')
                                .select('pick_id, pick_number, round_number, player_id, manager_id, picked_at, deadline, is_auto_picked')
                                .eq('league_id', leagueId)
                                .order('pick_number', { ascending: true });

                            if (finalPicksError) {
                                console.error('[DraftState] Error fetching final picks:', finalPicksError);
                                return NextResponse.json({ success: false, error: finalPicksError.message }, { status: 500 });
                            }

                            await finalizeDraftIfNeeded(leagueId, leagueStatus, finalPicks || []);
                            return NextResponse.json({ status: 'completed' });
                        }
                    }
                }
            }

            // ── Return Active State ──
            // Re-fetch completed picks if auto-pick occurred so the new pick is included
            let finalCompletedPicks = completedPicks;
            let finalPendingPicks = pendingPicks;

            if (autoPickOccurred) {
                const { data: freshPicks } = await supabase
                    .from('draft_picks')
                    .select('pick_id, pick_number, round_number, player_id, manager_id, picked_at, deadline, is_auto_picked, player:player_list(name, team, batter_or_pitcher, identity, original_name)')
                    .eq('league_id', leagueId)
                    .order('pick_number', { ascending: true });

                if (freshPicks) {
                    finalCompletedPicks = freshPicks.filter(p => p.player_id != null);
                    finalPendingPicks = freshPicks.filter(p => p.player_id == null);
                }
            }

            // Enrich with cached positions
            const posMap = await getCachedPositionMap();
            await enrichPicksWithPlayerData(finalCompletedPicks, posMap);

            const nextPicksSummary = finalPendingPicks.map(p => ({
                pick_id: p.pick_id,
                pick_number: p.pick_number,
                round_number: p.round_number,
                manager_id: p.manager_id,
            }));

            return NextResponse.json({
                status: 'active',
                currentPick,
                picks: finalCompletedPicks,
                nextPicks: nextPicksSummary,
                serverTime: now.toISOString(),
                foreignerActiveLimit: settings?.foreigner_active_limit
            });
        }

        // CASE C: All picks completed
        if (remainingPicks === 0 && totalPicks > 0) {
            await finalizeDraftIfNeeded(leagueId, leagueStatus, allPicksData);

            const posMap = await getCachedPositionMap();
            await enrichPicksWithPlayerData(completedPicks, posMap);

            return NextResponse.json({
                status: 'completed',
                picks: completedPicks,
                foreignerActiveLimit: settings?.foreigner_active_limit
            });
        }

        return NextResponse.json({ status: 'unknown', message: 'Unknown State' });

    } catch (error) {
        console.error('Draft State Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
