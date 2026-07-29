ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_weather boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_recommendations boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_disease boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS quiet_hours_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quiet_start text NOT NULL DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS quiet_end text NOT NULL DEFAULT '06:00';