
-- Profile table (created automatically on sign up)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  village TEXT,
  district TEXT,
  state TEXT,
  avatar_url TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  dark_mode BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Fields
CREATE TABLE public.fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  crop TEXT,
  soil_type TEXT,
  water_source TEXT,
  polygon JSONB NOT NULL,
  centroid_lat DOUBLE PRECISION NOT NULL,
  centroid_lng DOUBLE PRECISION NOT NULL,
  area_acres NUMERIC(10,3) NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fields TO authenticated;
GRANT ALL ON public.fields TO service_role;
ALTER TABLE public.fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own fields" ON public.fields FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Recommendations
CREATE TABLE public.recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field_id UUID REFERENCES public.fields(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('crop','fertilizer','irrigation','yield')),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommendations TO authenticated;
GRANT ALL ON public.recommendations TO service_role;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own recommendations" ON public.recommendations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Disease scans
CREATE TABLE public.disease_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field_id UUID REFERENCES public.fields(id) ON DELETE SET NULL,
  image_url TEXT NOT NULL,
  disease TEXT,
  confidence NUMERIC(5,2),
  recommendation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disease_scans TO authenticated;
GRANT ALL ON public.disease_scans TO service_role;
ALTER TABLE public.disease_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own scans" ON public.disease_scans FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Government schemes (public read)
CREATE TABLE public.government_schemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  benefits TEXT NOT NULL,
  eligibility TEXT NOT NULL,
  documents TEXT NOT NULL,
  official_url TEXT NOT NULL,
  apply_url TEXT NOT NULL,
  category TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.government_schemes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.government_schemes TO authenticated;
GRANT ALL ON public.government_schemes TO service_role;
ALTER TABLE public.government_schemes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Schemes readable by all" ON public.government_schemes FOR SELECT USING (true);

-- Market prices (public read)
CREATE TABLE public.market_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop TEXT NOT NULL,
  market TEXT NOT NULL,
  state TEXT NOT NULL,
  price_per_quintal NUMERIC(10,2) NOT NULL,
  prev_price NUMERIC(10,2),
  recorded_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.market_prices TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_prices TO authenticated;
GRANT ALL ON public.market_prices TO service_role;
ALTER TABLE public.market_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Market prices readable by all" ON public.market_prices FOR SELECT USING (true);

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_fields_updated BEFORE UPDATE ON public.fields FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, village, district, state)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'village', ''),
    COALESCE(NEW.raw_user_meta_data->>'district', ''),
    COALESCE(NEW.raw_user_meta_data->>'state', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed government schemes
INSERT INTO public.government_schemes (title, description, benefits, eligibility, documents, official_url, apply_url, category) VALUES
('PM-KISAN', 'Pradhan Mantri Kisan Samman Nidhi - direct income support for farmers.', 'Rs 6,000 per year in 3 equal installments credited directly to bank account.', 'All landholding farmer families with cultivable land.', 'Aadhaar, land records, bank account details.', 'https://pmkisan.gov.in', 'https://pmkisan.gov.in/RegistrationForm.aspx', 'Income Support'),
('PMFBY', 'Pradhan Mantri Fasal Bima Yojana - crop insurance scheme.', 'Insurance cover against crop loss due to natural calamities, pests and diseases.', 'All farmers growing notified crops in notified areas.', 'Aadhaar, land records, sowing certificate, bank passbook.', 'https://pmfby.gov.in', 'https://pmfby.gov.in/farmerRegistrationForm', 'Insurance'),
('Kisan Credit Card', 'Short term credit for cultivation and other needs.', 'Loans up to Rs 3 lakh at 4% interest with prompt repayment.', 'Farmers, tenant farmers, sharecroppers, SHGs.', 'Application form, ID proof, land documents.', 'https://www.myscheme.gov.in/schemes/kcc', 'https://www.myscheme.gov.in/schemes/kcc', 'Credit'),
('PMKSY', 'Pradhan Mantri Krishi Sinchayee Yojana - Har Khet Ko Pani.', 'Subsidy on micro-irrigation systems (drip and sprinkler) up to 55%.', 'All categories of farmers.', 'Aadhaar, land records, bank details, quotation.', 'https://pmksy.gov.in', 'https://pmksy.gov.in/mis/frmFarmerLogin.aspx', 'Irrigation'),
('Soil Health Card', 'Free soil testing and nutrient recommendations.', 'Soil health card every 2 years with nutrient status and fertilizer recommendation.', 'All farmers with cultivable land.', 'Land records, Aadhaar.', 'https://soilhealth.dac.gov.in', 'https://soilhealth.dac.gov.in/FarmerRegistration', 'Advisory'),
('e-NAM', 'National Agriculture Market - online trading platform.', 'Transparent price discovery, wider market access, better returns.', 'All farmers, traders, buyers registered with mandi.', 'Aadhaar, mobile number, bank details.', 'https://enam.gov.in', 'https://enam.gov.in/web/registration/farmer-registration', 'Marketing'),
('PM-KMY', 'Pradhan Mantri Kisan Maan-Dhan Yojana - pension for small farmers.', 'Assured monthly pension of Rs 3,000 after age 60.', 'Small and marginal farmers aged 18-40 years.', 'Aadhaar, savings bank account, land records.', 'https://maandhan.in/pmkmy', 'https://maandhan.in/auth/login', 'Pension'),
('Paramparagat Krishi Vikas Yojana', 'Promotion of organic farming.', 'Financial assistance of Rs 50,000 per hectare over 3 years for organic farming.', 'Farmers in cluster of 50 acres or more.', 'Aadhaar, land records, cluster group formation.', 'https://pgsindia-ncof.gov.in/pkvy', 'https://pgsindia-ncof.gov.in/pkvy', 'Organic'),
('National Mission on Sustainable Agriculture', 'Promote sustainable agriculture practices.', 'Subsidy for water conservation, soil health, rainfed area development.', 'Farmers in rainfed areas.', 'Land records, Aadhaar, bank details.', 'https://nmsa.dac.gov.in', 'https://nmsa.dac.gov.in', 'Sustainability'),
('Rashtriya Krishi Vikas Yojana', 'State-level agriculture development scheme.', 'Grants for agriculture infrastructure, farm mechanization, allied sectors.', 'State-specific eligibility.', 'Application through state agriculture department.', 'https://rkvy.nic.in', 'https://rkvy.nic.in', 'Infrastructure');

-- Seed market prices (recent, in Rs / quintal)
INSERT INTO public.market_prices (crop, market, state, price_per_quintal, prev_price, recorded_on) VALUES
('Rice', 'Warangal', 'Telangana', 2150, 2070, CURRENT_DATE),
('Wheat', 'Ludhiana', 'Punjab', 2280, 2260, CURRENT_DATE),
('Maize', 'Nizamabad', 'Telangana', 1850, 1820, CURRENT_DATE),
('Cotton', 'Adilabad', 'Telangana', 6800, 6650, CURRENT_DATE),
('Groundnut', 'Anantapur', 'Andhra Pradesh', 5900, 5850, CURRENT_DATE),
('Soybean', 'Indore', 'Madhya Pradesh', 4750, 4700, CURRENT_DATE),
('Sugarcane', 'Muzaffarnagar', 'Uttar Pradesh', 340, 335, CURRENT_DATE),
('Onion', 'Lasalgaon', 'Maharashtra', 2200, 2400, CURRENT_DATE),
('Tomato', 'Kolar', 'Karnataka', 1600, 1500, CURRENT_DATE),
('Turmeric', 'Erode', 'Tamil Nadu', 12500, 12300, CURRENT_DATE);
