-- =============================================================
-- create_league_finalized_status.sql
-- Creates the missing league_finalized_status table
-- =============================================================

CREATE TABLE IF NOT EXISTS public.league_finalized_status (
    league_id UUID PRIMARY KEY REFERENCES public.league_settings(league_id) ON DELETE CASCADE,
    updated_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_league_finalized_status_league
    ON public.league_finalized_status (league_id);

ALTER TABLE public.league_finalized_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON public.league_finalized_status
    FOR ALL USING (true) WITH CHECK (true);
