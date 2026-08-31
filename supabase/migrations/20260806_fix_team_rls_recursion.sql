-- Fix infinite recursion (42P17) in team RLS policies.
-- The "Team members can read members" policy subselects team_members,
-- re-triggering RLS on itself. Replace membership checks with
-- SECURITY DEFINER helpers (bypass RLS) and fix the `id` name collision
-- in the teams policy.

-- Helpers (search_path = '' forces schema-qualified references)
create or replace function public.is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = auth.uid()
  )
$$;

create or replace function public.is_team_admin(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = auth.uid() and role = 'admin'
  )
$$;

create or replace function public.is_team_owner(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.teams
    where id = p_team_id and owner_id = auth.uid()
  )
$$;

-- Teams: fix `id` ambiguity (was resolving to team_members.id)
drop policy if exists "Team members can read own team" on public.teams;

create policy "Team members can read own team"
  on public.teams for select
  using (auth.uid() = owner_id or public.is_team_member(id));

-- Team members: remove self-referential subselects
drop policy if exists "Team members can read members" on public.team_members;
drop policy if exists "Team admin can insert members" on public.team_members;
drop policy if exists "Team admin can update members" on public.team_members;
drop policy if exists "Team admin can delete members" on public.team_members;

create policy "Team members can read members"
  on public.team_members for select
  using (public.is_team_member(team_id) or public.is_team_owner(team_id));

create policy "Team admin can insert members"
  on public.team_members for insert
  with check (public.is_team_admin(team_id) or public.is_team_owner(team_id));

create policy "Team admin can update members"
  on public.team_members for update
  using (public.is_team_admin(team_id) or public.is_team_owner(team_id));

create policy "Team admin can delete members"
  on public.team_members for delete
  using (public.is_team_admin(team_id) or public.is_team_owner(team_id));
