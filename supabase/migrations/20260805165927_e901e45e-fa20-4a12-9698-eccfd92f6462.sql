ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'India',
  ADD COLUMN IF NOT EXISTS mandal text;

ALTER TABLE public.government_schemes
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'India',
  ADD COLUMN IF NOT EXISTS state text;

ALTER TABLE public.market_prices
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'India',
  ADD COLUMN IF NOT EXISTS district text;

CREATE INDEX IF NOT EXISTS idx_schemes_country_state ON public.government_schemes (country, state);
CREATE INDEX IF NOT EXISTS idx_prices_country_state ON public.market_prices (country, state);