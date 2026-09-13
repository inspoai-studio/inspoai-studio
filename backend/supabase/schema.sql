-- ═══════════════════════════════════════════════════════════════════════════
-- Inspo AI Studio: Complete Unified Database Schema & Security
-- Run this single script in your Supabase Project > SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────
-- 2. USER & WORKSPACE TABLES
-- ─────────────────────────────────────────────────────────────────────────

-- Profiles Table (Users, Roles, Usage & Credits)
CREATE TABLE IF NOT EXISTS public.profiles (
  id                  text PRIMARY KEY, -- Maps to auth UID
  email               text NOT NULL,
  display_name        text,
  photo_url           text,
  role                text DEFAULT 'trial',
  is_active           boolean DEFAULT true,
  onboarding_complete boolean DEFAULT false,
  credits             jsonb DEFAULT '{"used": 0, "total": 25}'::jsonb,
  usage               jsonb DEFAULT '{}'::jsonb,
  trial               jsonb DEFAULT '{}'::jsonb,
  subscription        jsonb DEFAULT '{}'::jsonb,
  team                jsonb DEFAULT '{}'::jsonb,
  search_history      jsonb DEFAULT '[]'::jsonb,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Moodboards Table (Private user canvas collections)
CREATE TABLE IF NOT EXISTS public.moodboards (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    text NOT NULL,
  title      text NOT NULL DEFAULT 'Untitled Moodboard',
  is_public  boolean DEFAULT false,
  images     jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_moodboards_user ON public.moodboards(user_id);

-- Shared Moodboards Table (Publicly shareable boards with views)
CREATE TABLE IF NOT EXISTS public.shared_moodboards (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    text NOT NULL,
  title      text NOT NULL DEFAULT 'Shared Moodboard',
  share_code text UNIQUE,
  is_public  boolean DEFAULT true,
  images     jsonb DEFAULT '[]'::jsonb,
  views      int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shared_moodboards_code ON public.shared_moodboards(share_code);
CREATE INDEX IF NOT EXISTS idx_shared_moodboards_user ON public.shared_moodboards(user_id);

-- Brand Scanner Results Table
CREATE TABLE IF NOT EXISTS public.scan_results (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url        text UNIQUE NOT NULL,
  data       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scan_results_url ON public.scan_results(url);

-- Live Sessions Table (Real-time multiplayer canvas collaboration)
CREATE TABLE IF NOT EXISTS public.live_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code   text UNIQUE NOT NULL,
  host_user_id  text NOT NULL,
  title         text,
  images        jsonb DEFAULT '[]'::jsonb,
  edges         jsonb DEFAULT '[]'::jsonb,
  participants  jsonb DEFAULT '[]'::jsonb,
  expires_at    timestamptz,
  last_activity timestamptz DEFAULT now(),
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_live_sessions_invite ON public.live_sessions(invite_code);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. INSPIRATION, ASSETS & FEED TABLES
-- ─────────────────────────────────────────────────────────────────────────

-- Curated Collections Table
CREATE TABLE IF NOT EXISTS public.curated_collections (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  body         text CHECK (char_length(body) <= 300),
  source_url   text,
  tags         text[] DEFAULT '{}',
  media        jsonb NOT NULL DEFAULT '[]',
  is_published boolean DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_curated_collections_tags ON public.curated_collections USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_curated_collections_published ON public.curated_collections (is_published, created_at DESC);

-- Visual Inspo Table (Pinterest + Google + Freepik scraped cache)
CREATE TABLE IF NOT EXISTS public.visual_inspo (
  id            bigserial PRIMARY KEY,
  image_url     text NOT NULL UNIQUE,
  full_image    text,
  title         text,
  source        text,
  query         text,
  width         int,
  height        int,
  relevance     float,
  created_at    timestamptz DEFAULT now(),
  last_seen_at  timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_visual_inspo_url ON public.visual_inspo(image_url);
CREATE INDEX IF NOT EXISTS idx_visual_inspo_query ON public.visual_inspo(query);
CREATE INDEX IF NOT EXISTS idx_visual_inspo_source ON public.visual_inspo(source);
CREATE INDEX IF NOT EXISTS idx_visual_inspo_seen ON public.visual_inspo(last_seen_at DESC);

-- Savee Assets Table
CREATE TABLE IF NOT EXISTS public.savee_assets (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url   text NOT NULL UNIQUE,
  title       text,
  tags        text[],
  colors      jsonb,
  width       int,
  height      int,
  source_url  text,
  created_at  timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_savee_assets_url ON public.savee_assets(image_url);

-- Search Analytics Logs
CREATE TABLE IF NOT EXISTS public.search_logs (
  id            bigserial PRIMARY KEY,
  user_email    text NOT NULL,
  query         text NOT NULL,
  search_mode   text,
  industry      text,
  design_style  text,
  color         text,
  result_count  int,
  page          int DEFAULT 0,
  searched_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_search_logs_email ON public.search_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_search_logs_mode ON public.search_logs(search_mode);
CREATE INDEX IF NOT EXISTS idx_search_logs_searched ON public.search_logs(searched_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_logs_query ON public.search_logs(query);

-- Design Assets Table (Vector Embeddings & Search)
CREATE TABLE IF NOT EXISTS public.design_assets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  src           text NOT NULL,
  thumbnail     text,
  url           text,
  title         text,
  site_name     text,
  site_domain   text,
  source        text,
  platform      text,
  ux_patterns   text[] DEFAULT '{}',
  ui_elements   text[] DEFAULT '{}',
  page_types    text[] DEFAULT '{}',
  tags          text[] DEFAULT '{}',
  fonts         text[] DEFAULT '{}',
  colors        jsonb,
  width         int,
  height        int,
  embedding     vector(1536),
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_design_assets_platform ON public.design_assets(platform);
CREATE INDEX IF NOT EXISTS idx_design_assets_site_name ON public.design_assets(site_name);
CREATE INDEX IF NOT EXISTS idx_design_assets_ux ON public.design_assets USING gin(ux_patterns);
CREATE INDEX IF NOT EXISTS idx_design_assets_page_types ON public.design_assets USING gin(page_types);
CREATE INDEX IF NOT EXISTS idx_design_assets_tags ON public.design_assets USING gin(tags);

-- Optional Content Cache Tables
CREATE TABLE IF NOT EXISTS public.landbook_websites (id bigserial PRIMARY KEY, title text, url text, description text, thumbnail text, tags text[], created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.lapa_websites (id bigserial PRIMARY KEY, title text, url text, description text, thumbnail text, tags text[], created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.view_port_designs (id bigserial PRIMARY KEY, title text, url text, image_url text, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.design_spells (id bigserial PRIMARY KEY, title text, url text, video_url text, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.mobbin_cache (id bigserial PRIMARY KEY, app_name text, screen_url text, tags text[], created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.icon_cache (id bigserial PRIMARY KEY, name text, svg text, tags text[], created_at timestamptz DEFAULT now());

-- ─────────────────────────────────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moodboards          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_moodboards   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_results        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curated_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visual_inspo        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savee_assets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_assets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landbook_websites   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lapa_websites       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.view_port_designs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_spells       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobbin_cache        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.icon_cache          ENABLE ROW LEVEL SECURITY;

-- Grants for service role (backend uses service key to bypass/manage)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Public & Authenticated Read Policies
CREATE POLICY "anon_read_design_assets"       ON public.design_assets       FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_read_visual_inspo"        ON public.visual_inspo        FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_read_savee_assets"        ON public.savee_assets        FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_read_shared_moodboards"   ON public.shared_moodboards   FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_read_scan_results"        ON public.scan_results        FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_read_landbook"            ON public.landbook_websites   FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_read_lapa"                ON public.lapa_websites       FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_read_viewport"            ON public.view_port_designs   FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_read_design_spells"       ON public.design_spells       FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_read_mobbin"              ON public.mobbin_cache        FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_read_icon_cache"          ON public.icon_cache          FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_read_curated_collections" ON public.curated_collections FOR SELECT TO anon, authenticated USING (is_published = true);

-- User Profiles & Moodboards (authenticated access)
CREATE POLICY "user_read_profiles"            ON public.profiles            FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_update_profiles"          ON public.profiles            FOR UPDATE TO authenticated USING (auth.uid()::text = id);
CREATE POLICY "user_access_moodboards"        ON public.moodboards          FOR ALL    TO authenticated USING (auth.uid()::text = user_id);

-- Live multiplayer sessions (realtime enabled)
CREATE POLICY "public_access_live_sessions"   ON public.live_sessions       FOR ALL    TO anon, authenticated USING (true) WITH CHECK (true);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.live_sessions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. VECTOR SEARCH FUNCTION (match_design_assets)
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.match_design_assets(
  query_embedding vector(1536),
  filter_platform text DEFAULT NULL,
  filter_ux_pattern text DEFAULT NULL,
  filter_page_type text DEFAULT NULL,
  match_count int DEFAULT 100,
  offset_val int DEFAULT 0
)
RETURNS TABLE (
  id uuid, src text, thumbnail text, url text, title text,
  site_name text, site_domain text, source text, platform text,
  ux_patterns text[], ui_elements text[], page_types text[],
  tags text[], fonts text[], colors jsonb, width int, height int, similarity float
)
LANGUAGE plpgsql VOLATILE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    da.id, da.src, da.thumbnail, da.url, da.title,
    da.site_name, da.site_domain, da.source, da.platform,
    da.ux_patterns, da.ui_elements, da.page_types, da.tags,
    da.fonts, da.colors, da.width, da.height,
    1 - (da.embedding <=> query_embedding) AS similarity
  FROM design_assets da
  WHERE
    da.embedding IS NOT NULL
    AND (filter_platform IS NULL OR da.platform = filter_platform)
    AND (filter_ux_pattern IS NULL OR da.ux_patterns @> ARRAY[filter_ux_pattern])
    AND (filter_page_type IS NULL OR da.page_types @> ARRAY[filter_page_type])
  ORDER BY da.embedding <=> query_embedding
  LIMIT match_count
  OFFSET offset_val;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_design_assets TO anon, authenticated, service_role;
