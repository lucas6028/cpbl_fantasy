-- =============================================================
-- create_missing_views_for_matchups.sql
-- Creates dummy views for v_weekly_manager_stats and v_league_standings
-- to prevent API 500 errors on the matchups and standings pages
-- =============================================================

-- 1. v_weekly_manager_stats (Dummy VIEW)
DROP VIEW IF EXISTS public.v_weekly_manager_stats CASCADE;
CREATE OR REPLACE VIEW public.v_weekly_manager_stats AS
SELECT 
    lm.league_id,
    lm.manager_id,
    ls.week_number,
    'Regular'::TEXT AS week_type,
    ls.week_start,
    ls.week_end,
    'Week ' || ls.week_number AS week_label,
    
    -- Stub Batting Stats
    0 AS b_gp, 0 AS b_pa, 0 AS b_ab, 0 AS b_r, 0 AS b_h, 0 AS b_1b, 0 AS b_2b, 0 AS b_3b, 0 AS b_hr,
    0 AS b_xbh, 0 AS b_tb, 0 AS b_rbi, 0 AS b_bb, 0 AS b_ibb, 0 AS b_hbp, 0 AS b_k, 0 AS b_sb,
    0 AS b_cs, 0 AS b_sh, 0 AS b_sf, 0 AS b_gidp, 0 AS b_e, 0 AS b_cyc,
    0.0 AS b_avg, 0.0 AS b_obp, 0.0 AS b_slg, 0.0 AS b_ops,
    
    -- Stub Pitching Stats
    0 AS p_app, 0 AS p_gs, 0 AS p_rapp, 0.0 AS p_ip, 0 AS p_tbf, 0 AS p_pc,
    0 AS p_w, 0 AS p_l, 0 AS p_sv, 0 AS p_hld, 0 AS p_svhld, 0 AS p_rw, 0 AS p_rl,
    0 AS p_k, 0 AS p_bb, 0 AS p_ibb, 0 AS p_hbp, 0 AS p_h, 0 AS p_hr, 0 AS p_ra, 0 AS p_er,
    0 AS p_qs, 0 AS p_cg, 0 AS p_sho, 0 AS p_pg, 0 AS p_nh,
    0.0 AS p_era, 0.0 AS p_whip, 0.0 AS "p_k/9", 0.0 AS "p_bb/9", 0.0 AS "p_k/bb", 0.0 AS "p_win%", 0.0 AS "p_h/9", 0.0 AS p_obpa

FROM public.league_members lm
JOIN public.league_schedule ls ON lm.league_id = ls.league_id;


-- 2. v_league_standings (Dummy VIEW)
DROP VIEW IF EXISTS public.v_league_standings CASCADE;
CREATE OR REPLACE VIEW public.v_league_standings AS
SELECT 
    lm.league_id,
    lm.manager_id,
    1 AS rank,
    0 AS wins,
    0 AS losses,
    0 AS ties,
    0.0 AS win_pct
FROM public.league_members lm;
