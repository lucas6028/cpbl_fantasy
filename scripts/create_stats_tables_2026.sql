-- 1. Create batting_stats_2026
CREATE TABLE IF NOT EXISTS public.batting_stats_2026 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id TEXT,
    name TEXT NOT NULL,
    position TEXT,
    at_bats INTEGER DEFAULT 0,
    runs INTEGER DEFAULT 0,
    hits INTEGER DEFAULT 0,
    rbis INTEGER DEFAULT 0,
    doubles INTEGER DEFAULT 0,
    triples INTEGER DEFAULT 0,
    home_runs INTEGER DEFAULT 0,
    double_plays INTEGER DEFAULT 0,
    walks INTEGER DEFAULT 0,
    ibb INTEGER DEFAULT 0,
    hbp INTEGER DEFAULT 0,
    strikeouts INTEGER DEFAULT 0,
    sacrifice_bunts INTEGER DEFAULT 0,
    sacrifice_flies INTEGER DEFAULT 0,
    stolen_bases INTEGER DEFAULT 0,
    caught_stealing INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    avg NUMERIC,
    game_date DATE NOT NULL,
    is_major BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_batting_stats_2026_player_id ON public.batting_stats_2026 (player_id);
CREATE INDEX IF NOT EXISTS idx_batting_stats_2026_game_date ON public.batting_stats_2026 (game_date);

ALTER TABLE public.batting_stats_2026 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON public.batting_stats_2026
    FOR ALL USING (true) WITH CHECK (true);

-- 2. Create pitching_stats_2026
CREATE TABLE IF NOT EXISTS public.pitching_stats_2026 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id TEXT,
    name TEXT NOT NULL,
    position TEXT,
    record TEXT,
    innings_pitched NUMERIC DEFAULT 0,
    batters_faced INTEGER DEFAULT 0,
    pitches_thrown INTEGER DEFAULT 0,
    strikes_thrown INTEGER DEFAULT 0,
    hits_allowed INTEGER DEFAULT 0,
    home_runs_allowed INTEGER DEFAULT 0,
    walks INTEGER DEFAULT 0,
    ibb INTEGER DEFAULT 0,
    hbp INTEGER DEFAULT 0,
    strikeouts INTEGER DEFAULT 0,
    wild_pitches INTEGER DEFAULT 0,
    balks INTEGER DEFAULT 0,
    runs_allowed INTEGER DEFAULT 0,
    earned_runs INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    era NUMERIC,
    whip NUMERIC,
    complete_game INTEGER DEFAULT 0,
    game_date DATE NOT NULL,
    is_major BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pitching_stats_2026_player_id ON public.pitching_stats_2026 (player_id);
CREATE INDEX IF NOT EXISTS idx_pitching_stats_2026_game_date ON public.pitching_stats_2026 (game_date);

ALTER TABLE public.pitching_stats_2026 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON public.pitching_stats_2026
    FOR ALL USING (true) WITH CHECK (true);

-- 3. Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
