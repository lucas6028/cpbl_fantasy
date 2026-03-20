-- Queue window schedule for draft reschedule announcements
-- Rule: 5 queues per batch, start from today 17:00 (Asia/Taipei), each batch opens every 15 minutes.

CREATE TABLE IF NOT EXISTS public.draft_reschedule_queue_windows (
  batch_start_queue integer NOT NULL,
  batch_end_queue integer NOT NULL,
  open_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT draft_reschedule_queue_windows_pkey PRIMARY KEY (batch_start_queue),
  CONSTRAINT draft_reschedule_queue_windows_open_at_key UNIQUE (open_at),
  CONSTRAINT draft_reschedule_queue_windows_batch_positive CHECK (batch_start_queue > 0),
  CONSTRAINT draft_reschedule_queue_windows_batch_end_check CHECK (batch_end_queue = batch_start_queue + 4),
  CONSTRAINT draft_reschedule_queue_windows_batch_step_check CHECK (((batch_start_queue - 1) % 5) = 0)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_draft_reschedule_queue_windows_open_at
  ON public.draft_reschedule_queue_windows USING btree (open_at) TABLESPACE pg_default;

DROP TRIGGER IF EXISTS trg_draft_reschedule_queue_windows_updated_at ON public.draft_reschedule_queue_windows;
CREATE TRIGGER trg_draft_reschedule_queue_windows_updated_at
BEFORE UPDATE ON public.draft_reschedule_queue_windows
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Seed 200 batches (queue 1~1000) using today's Taiwan 17:00 as the base.
-- If rows already exist, this is idempotent (ON CONFLICT DO NOTHING).
INSERT INTO public.draft_reschedule_queue_windows (batch_start_queue, batch_end_queue, open_at)
SELECT
  1 + (gs * 5) AS batch_start_queue,
  5 + (gs * 5) AS batch_end_queue,
  (
    make_timestamptz(
      EXTRACT(YEAR FROM timezone('Asia/Taipei', now()))::int,
      EXTRACT(MONTH FROM timezone('Asia/Taipei', now()))::int,
      EXTRACT(DAY FROM timezone('Asia/Taipei', now()))::int,
      17,
      0,
      0,
      'Asia/Taipei'
    )
    + (gs * interval '15 minutes')
  ) AS open_at
FROM generate_series(0, 199) AS gs
ON CONFLICT (batch_start_queue) DO NOTHING;
