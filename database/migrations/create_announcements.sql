-- Create announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  CONSTRAINT announcements_pkey PRIMARY KEY (id),
  CONSTRAINT announcements_title_check CHECK ((char_length(title) > 0)),
  CONSTRAINT announcements_content_check CHECK ((char_length(content) > 0))
) TABLESPACE pg_default;

-- Create trigger function to update updated_at timestamp
DROP TRIGGER IF EXISTS trg_announcements_updated_at ON announcements;
CREATE TRIGGER trg_announcements_updated_at
BEFORE UPDATE ON announcements
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);

-- Add comment
COMMENT ON TABLE public.announcements IS 'Stores system announcements that admins can publish to users';
