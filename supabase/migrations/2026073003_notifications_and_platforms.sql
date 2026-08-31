-- Notifications Preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  feedback_alerts BOOLEAN DEFAULT true,
  post_approvals BOOLEAN DEFAULT true,
  contract_alerts BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notification preferences"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
  ON public.notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Platform Accounts (Instagram + TikTok for clients)
CREATE TABLE IF NOT EXISTS public.platform_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok')),
  handle TEXT NOT NULL DEFAULT '',
  profile_photo TEXT DEFAULT '',
  metrics JSONB DEFAULT '{}',
  last_synced TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, platform)
);

ALTER TABLE public.platform_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage platform accounts for their clients"
  ON public.platform_accounts FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.clients WHERE id = client_id
    )
  );

-- Add platform column to posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'instagram'
  CHECK (platform IN ('instagram', 'tiktok', 'both'));

-- Add team_id to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_platform_accounts_client_id ON public.platform_accounts(client_id);
CREATE INDEX IF NOT EXISTS idx_clients_team_id ON public.clients(team_id);
CREATE INDEX IF NOT EXISTS idx_posts_platform ON public.posts(platform);
