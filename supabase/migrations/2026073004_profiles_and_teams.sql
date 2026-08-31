-- Profiles: extends auth.users with app-specific fields
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  birthday DATE,
  address JSONB DEFAULT '{}',
  account_type TEXT NOT NULL DEFAULT 'individual' CHECK (account_type IN ('individual', 'team_owner', 'team_member')),
  avatar_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team Members
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('admin', 'editor', 'viewer')),
  invited_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Member Permissions (granular access control)
CREATE TABLE IF NOT EXISTS public.member_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('page', 'client')),
  resource_id TEXT NOT NULL,
  can_view BOOLEAN DEFAULT true,
  can_edit BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, resource_type, resource_id)
);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_permissions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Helpers (SECURITY DEFINER bypass RLS -> avoids infinite recursion in policies below)
CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id AND user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.is_team_admin(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id AND user_id = auth.uid() AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_team_owner(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams
    WHERE id = p_team_id AND owner_id = auth.uid()
  )
$$;

-- Teams policies
CREATE POLICY "Team members can read own team"
  ON public.teams FOR SELECT
  USING (auth.uid() = owner_id OR public.is_team_member(id));

CREATE POLICY "Team owner can update team"
  ON public.teams FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Team owner can delete team"
  ON public.teams FOR DELETE
  USING (auth.uid() = owner_id);

-- Team Members policies
CREATE POLICY "Team members can read members"
  ON public.team_members FOR SELECT
  USING (public.is_team_member(team_id) OR public.is_team_owner(team_id));

CREATE POLICY "Team admin can insert members"
  ON public.team_members FOR INSERT
  WITH CHECK (public.is_team_admin(team_id) OR public.is_team_owner(team_id));

CREATE POLICY "Team admin can update members"
  ON public.team_members FOR UPDATE
  USING (public.is_team_admin(team_id) OR public.is_team_owner(team_id));

CREATE POLICY "Team admin can delete members"
  ON public.team_members FOR DELETE
  USING (public.is_team_admin(team_id) OR public.is_team_owner(team_id));

-- Member Permissions policies
CREATE POLICY "Team admin can manage permissions"
  ON public.member_permissions FOR ALL
  USING (
    auth.uid() IN (
      SELECT tm.user_id FROM public.team_members tm
      WHERE tm.id = member_id AND tm.role IN ('admin')
    )
    OR auth.uid() IN (
      SELECT t.owner_id FROM public.teams t
      JOIN public.team_members tm2 ON tm2.team_id = t.id
      WHERE tm2.id = member_id
    )
  );

CREATE POLICY "Members can read own permissions"
  ON public.member_permissions FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.team_members WHERE id = member_id
    )
  );

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', '')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_member_permissions_member_id ON public.member_permissions(member_id);
CREATE INDEX IF NOT EXISTS idx_member_permissions_resource ON public.member_permissions(resource_type, resource_id);
