-- =============================================================
-- create_league_matchups.sql
-- Creates the missing league_matchups table
-- =============================================================

CREATE TABLE IF NOT EXISTS public.league_matchups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES public.league_settings(league_id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL,
    week_start DATE,
    week_end DATE,
    manager1_id TEXT,
    manager2_id TEXT,
    winner_id TEXT,
    team1_score NUMERIC(10,2) DEFAULT 0,
    team2_score NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_league_matchups_league_week
    ON public.league_matchups (league_id, week_number);

ALTER TABLE public.league_matchups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service role" ON public.league_matchups
    FOR ALL USING (true) WITH CHECK (true);
