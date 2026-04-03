-- =============================================================
-- create_stat_views.sql
-- Creates the required views for Draft & Rankings pages:
-- 1) v_batting_summary
-- 2) v_pitching_summary
-- 3) v_batting_scoring
-- 4) v_pitching_scoring
-- =============================================================

-- 1) Batting Summary
DROP VIEW IF EXISTS public.v_batting_summary CASCADE;
CREATE OR REPLACE VIEW public.v_batting_summary AS
SELECT 
    '2026 Season' AS time_window,
    player_id,
    MAX(name) AS player_name,
    COUNT(DISTINCT game_date) AS gp,
    SUM(at_bats) + SUM(walks) + SUM(hbp) + SUM(sacrifice_flies) + SUM(sacrifice_bunts) AS pa,
    SUM(at_bats) AS ab,
    SUM(runs) AS r,
    SUM(hits) AS h,
    SUM(hits) - SUM(doubles) - SUM(triples) - SUM(home_runs) AS "1b",
    SUM(doubles) AS "2b",
    SUM(triples) AS "3b",
    SUM(home_runs) AS hr,
    SUM(doubles) + SUM(triples) + SUM(home_runs) AS xbh,
    (SUM(hits) - SUM(doubles) - SUM(triples) - SUM(home_runs)) + (SUM(doubles) * 2) + (SUM(triples) * 3) + (SUM(home_runs) * 4) AS tb,
    SUM(rbis) AS rbi,
    SUM(walks) AS bb,
    SUM(strikeouts) AS k,
    SUM(stolen_bases) AS sb,
    SUM(caught_stealing) AS cs,
    SUM(ibb) AS ibb,
    SUM(hbp) AS hbp,
    SUM(sacrifice_flies) AS sf,
    SUM(sacrifice_bunts) AS sh,
    SUM(double_plays) AS gidp,
    CASE WHEN SUM(at_bats) > 0 THEN ROUND(SUM(hits)::numeric / SUM(at_bats)::numeric, 3) ELSE 0.000 END AS avg,
    CASE WHEN (SUM(at_bats) + SUM(walks) + SUM(hbp) + SUM(sacrifice_flies)) > 0 THEN 
        ROUND((SUM(hits) + SUM(walks) + SUM(hbp))::numeric / (SUM(at_bats) + SUM(walks) + SUM(hbp) + SUM(sacrifice_flies))::numeric, 3) ELSE 0.000 END AS obp,
    CASE WHEN SUM(at_bats) > 0 THEN 
        ROUND(((SUM(hits) - SUM(doubles) - SUM(triples) - SUM(home_runs)) + (SUM(doubles) * 2) + (SUM(triples) * 3) + (SUM(home_runs) * 4))::numeric / SUM(at_bats)::numeric, 3) ELSE 0.000 END AS slg,
    ROUND(
        (
            CASE WHEN (SUM(at_bats) + SUM(walks) + SUM(hbp) + SUM(sacrifice_flies)) > 0 THEN 
                (SUM(hits) + SUM(walks) + SUM(hbp))::numeric / (SUM(at_bats) + SUM(walks) + SUM(hbp) + SUM(sacrifice_flies))::numeric
            ELSE 0.000 END
        ) +
        (
            CASE WHEN SUM(at_bats) > 0 THEN 
                ((SUM(hits) - SUM(doubles) - SUM(triples) - SUM(home_runs)) + (SUM(doubles) * 2) + (SUM(triples) * 3) + (SUM(home_runs) * 4))::numeric / SUM(at_bats)::numeric
            ELSE 0.000 END
        ), 3
    ) AS ops,
    0 AS e,
    0 AS cyc
FROM public.batting_stats_2026
WHERE is_major = true
GROUP BY player_id;

-- 2) Pitching Summary
DROP VIEW IF EXISTS public.v_pitching_summary CASCADE;
CREATE OR REPLACE VIEW public.v_pitching_summary AS
SELECT 
    '2026 Season' AS time_window,
    player_id,
    MAX(name) AS player_name,
    COUNT(DISTINCT game_date) AS app,
    0 AS gs, -- We don't have explicit start data structured yet
    COUNT(DISTINCT game_date) AS rapp, 
    SUM(innings_pitched) AS ip,
    SUM(batters_faced) AS tbf,
    SUM(pitches_thrown) AS pc,
    SUM(CASE WHEN record LIKE '%W%' THEN 1 ELSE 0 END) AS w,
    SUM(CASE WHEN record LIKE '%L%' THEN 1 ELSE 0 END) AS l,
    SUM(CASE WHEN record LIKE '%SV%' THEN 1 ELSE 0 END) AS sv,
    SUM(CASE WHEN record LIKE '%HLD%' THEN 1 ELSE 0 END) AS hld,
    SUM(CASE WHEN record LIKE '%SV%' OR record LIKE '%HLD%' THEN 1 ELSE 0 END) AS svhld,
    0 AS rw,
    0 AS rl,
    SUM(strikeouts) AS k,
    SUM(walks) AS bb,
    SUM(ibb) AS ibb,
    SUM(hbp) AS hbp,
    SUM(hits_allowed) AS h,
    SUM(home_runs_allowed) AS hr,
    SUM(runs_allowed) AS ra,
    SUM(earned_runs) AS er,
    0 AS qs,
    SUM(complete_game) AS cg,
    0 AS sho,
    0 AS pg,
    0 AS nh,
    CASE WHEN SUM(innings_pitched) > 0 THEN ROUND((SUM(earned_runs) * 9 / SUM(innings_pitched))::numeric, 2) ELSE 0.00 END AS era,
    CASE WHEN SUM(innings_pitched) > 0 THEN ROUND(((SUM(walks) + SUM(hits_allowed)) / SUM(innings_pitched))::numeric, 2) ELSE 0.00 END AS whip,
    CASE WHEN SUM(innings_pitched) > 0 THEN ROUND((SUM(strikeouts) * 9 / SUM(innings_pitched))::numeric, 2) ELSE 0.00 END AS "k/9",
    CASE WHEN SUM(innings_pitched) > 0 THEN ROUND((SUM(walks) * 9 / SUM(innings_pitched))::numeric, 2) ELSE 0.00 END AS "bb/9",
    CASE WHEN SUM(walks) > 0 THEN ROUND((SUM(strikeouts)::numeric / SUM(walks)::numeric), 2) ELSE 0.00 END AS "k/bb",
    CASE WHEN (SUM(CASE WHEN record LIKE '%W%' THEN 1 ELSE 0 END) + SUM(CASE WHEN record LIKE '%L%' THEN 1 ELSE 0 END)) > 0 THEN 
        ROUND(SUM(CASE WHEN record LIKE '%W%' THEN 1 ELSE 0 END)::numeric / 
        (SUM(CASE WHEN record LIKE '%W%' THEN 1 ELSE 0 END) + SUM(CASE WHEN record LIKE '%L%' THEN 1 ELSE 0 END))::numeric, 3) ELSE 0.000 END AS "win%",
    CASE WHEN SUM(innings_pitched) > 0 THEN ROUND((SUM(hits_allowed) * 9 / SUM(innings_pitched))::numeric, 2) ELSE 0.00 END AS "h/9",
    CASE WHEN SUM(batters_faced) > 0 THEN ROUND(((SUM(hits_allowed) + SUM(walks) + SUM(hbp))::numeric / SUM(batters_faced)::numeric), 3) ELSE 0.000 END AS obpa
FROM public.pitching_stats_2026
WHERE is_major = true
GROUP BY player_id;

-- 3) Batting Scoring (Z-Scores)
DROP VIEW IF EXISTS public.v_batting_scoring CASCADE;
CREATE OR REPLACE VIEW public.v_batting_scoring AS
SELECT 
    time_window,
    player_id,
    player_name,
    (gp - AVG(gp) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(gp) OVER(PARTITION BY time_window), 0) AS z_gp,
    (pa - AVG(pa) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(pa) OVER(PARTITION BY time_window), 0) AS z_pa,
    (ab - AVG(ab) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(ab) OVER(PARTITION BY time_window), 0) AS z_ab,
    (h - AVG(h) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(h) OVER(PARTITION BY time_window), 0) AS z_h,
    ("1b" - AVG("1b") OVER(PARTITION BY time_window)) / NULLIF(STDDEV("1b") OVER(PARTITION BY time_window), 0) AS z_1b,
    ("2b" - AVG("2b") OVER(PARTITION BY time_window)) / NULLIF(STDDEV("2b") OVER(PARTITION BY time_window), 0) AS z_2b,
    ("3b" - AVG("3b") OVER(PARTITION BY time_window)) / NULLIF(STDDEV("3b") OVER(PARTITION BY time_window), 0) AS z_3b,
    (hr - AVG(hr) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(hr) OVER(PARTITION BY time_window), 0) AS z_hr,
    (xbh - AVG(xbh) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(xbh) OVER(PARTITION BY time_window), 0) AS z_xbh,
    (tb - AVG(tb) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(tb) OVER(PARTITION BY time_window), 0) AS z_tb,
    (r - AVG(r) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(r) OVER(PARTITION BY time_window), 0) AS z_r,
    (rbi - AVG(rbi) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(rbi) OVER(PARTITION BY time_window), 0) AS z_rbi,
    (bb - AVG(bb) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(bb) OVER(PARTITION BY time_window), 0) AS z_bb,
    (hbp - AVG(hbp) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(hbp) OVER(PARTITION BY time_window), 0) AS z_hbp,
    (sb - AVG(sb) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(sb) OVER(PARTITION BY time_window), 0) AS z_sb,
    (cs - AVG(cs) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(cs) OVER(PARTITION BY time_window), 0) AS z_cs,
    (sh - AVG(sh) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(sh) OVER(PARTITION BY time_window), 0) AS z_sh,
    (sf - AVG(sf) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(sf) OVER(PARTITION BY time_window), 0) AS z_sf,
    (gidp - AVG(gidp) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(gidp) OVER(PARTITION BY time_window), 0) AS z_gidp,
    (cyc - AVG(cyc) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(cyc) OVER(PARTITION BY time_window), 0) AS z_cyc,
    (avg - AVG(avg) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(avg) OVER(PARTITION BY time_window), 0) AS z_avg,
    (obp - AVG(obp) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(obp) OVER(PARTITION BY time_window), 0) AS z_obp,
    (slg - AVG(slg) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(slg) OVER(PARTITION BY time_window), 0) AS z_slg,
    ((obp + slg) - AVG(obp + slg) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(obp + slg) OVER(PARTITION BY time_window), 0) AS z_ops,
    -((k - AVG(k) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(k) OVER(PARTITION BY time_window), 0)) AS z_k
FROM public.v_batting_summary;

-- 4) Pitching Scoring (Z-Scores)
DROP VIEW IF EXISTS public.v_pitching_scoring CASCADE;
CREATE OR REPLACE VIEW public.v_pitching_scoring AS
SELECT 
    time_window,
    player_id,
    player_name,
    (app - AVG(app) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(app) OVER(PARTITION BY time_window), 0) AS z_app,
    (gs - AVG(gs) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(gs) OVER(PARTITION BY time_window), 0) AS z_gs,
    (rapp - AVG(rapp) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(rapp) OVER(PARTITION BY time_window), 0) AS z_rapp,
    (ip - AVG(ip) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(ip) OVER(PARTITION BY time_window), 0) AS z_ip,
    (tbf - AVG(tbf) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(tbf) OVER(PARTITION BY time_window), 0) AS z_tbf,
    (pc - AVG(pc) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(pc) OVER(PARTITION BY time_window), 0) AS z_pc,
    (w - AVG(w) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(w) OVER(PARTITION BY time_window), 0) AS z_w,
    (l - AVG(l) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(l) OVER(PARTITION BY time_window), 0) AS z_l,
    (sv - AVG(sv) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(sv) OVER(PARTITION BY time_window), 0) AS z_sv,
    (hld - AVG(hld) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(hld) OVER(PARTITION BY time_window), 0) AS z_hld,
    (svhld - AVG(svhld) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(svhld) OVER(PARTITION BY time_window), 0) AS z_svhld,
    (rw - AVG(rw) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(rw) OVER(PARTITION BY time_window), 0) AS z_rw,
    (rl - AVG(rl) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(rl) OVER(PARTITION BY time_window), 0) AS z_rl,
    (k - AVG(k) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(k) OVER(PARTITION BY time_window), 0) AS z_k,
    -((bb - AVG(bb) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(bb) OVER(PARTITION BY time_window), 0)) AS z_bb,
    -((ibb - AVG(ibb) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(ibb) OVER(PARTITION BY time_window), 0)) AS z_ibb,
    -((hbp - AVG(hbp) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(hbp) OVER(PARTITION BY time_window), 0)) AS z_hbp,
    -((h - AVG(h) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(h) OVER(PARTITION BY time_window), 0)) AS z_h,
    -((hr - AVG(hr) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(hr) OVER(PARTITION BY time_window), 0)) AS z_hr,
    -((ra - AVG(ra) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(ra) OVER(PARTITION BY time_window), 0)) AS z_ra,
    -((er - AVG(er) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(er) OVER(PARTITION BY time_window), 0)) AS z_er,
    (qs - AVG(qs) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(qs) OVER(PARTITION BY time_window), 0) AS z_qs,
    (cg - AVG(cg) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(cg) OVER(PARTITION BY time_window), 0) AS z_cg,
    (sho - AVG(sho) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(sho) OVER(PARTITION BY time_window), 0) AS z_sho,
    (pg - AVG(pg) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(pg) OVER(PARTITION BY time_window), 0) AS z_pg,
    (nh - AVG(nh) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(nh) OVER(PARTITION BY time_window), 0) AS z_nh,
    -((era - AVG(era) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(era) OVER(PARTITION BY time_window), 0)) AS z_era,
    -((whip - AVG(whip) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(whip) OVER(PARTITION BY time_window), 0)) AS z_whip,
    ("k/9" - AVG("k/9") OVER(PARTITION BY time_window)) / NULLIF(STDDEV("k/9") OVER(PARTITION BY time_window), 0) AS "z_k/9",
    -(("bb/9" - AVG("bb/9") OVER(PARTITION BY time_window)) / NULLIF(STDDEV("bb/9") OVER(PARTITION BY time_window), 0)) AS "z_bb/9",
    ("k/bb" - AVG("k/bb") OVER(PARTITION BY time_window)) / NULLIF(STDDEV("k/bb") OVER(PARTITION BY time_window), 0) AS "z_k/bb",
    ("win%" - AVG("win%") OVER(PARTITION BY time_window)) / NULLIF(STDDEV("win%") OVER(PARTITION BY time_window), 0) AS "z_win%",
    -(("h/9" - AVG("h/9") OVER(PARTITION BY time_window)) / NULLIF(STDDEV("h/9") OVER(PARTITION BY time_window), 0)) AS "z_h/9",
    -((obpa - AVG(obpa) OVER(PARTITION BY time_window)) / NULLIF(STDDEV(obpa) OVER(PARTITION BY time_window), 0)) AS z_obpa
FROM public.v_pitching_summary;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
