-- Permite verificar se um email está registado em auth.users.
-- Necessário para diferenciar "email não registado" de "senha incorreta" no login.
create or replace function public.check_email_exists(p_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users where lower(email) = lower(p_email)
  );
$$;

revoke execute on function public.check_email_exists(text) from public;
grant execute on function public.check_email_exists(text) to anon, authenticated;
