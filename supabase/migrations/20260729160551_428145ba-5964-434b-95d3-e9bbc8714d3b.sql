CREATE TABLE IF NOT EXISTS public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null default 'android',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (token)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_tokens TO authenticated;
GRANT ALL ON public.device_tokens TO service_role;

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own device tokens"
ON public.device_tokens FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER device_tokens_set_updated_at
BEFORE UPDATE ON public.device_tokens
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();