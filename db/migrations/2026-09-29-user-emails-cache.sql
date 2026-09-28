-- Homy: hilangkan N panggilan Admin Auth per request.
-- Simpan email di tabel klon `user_emails` yang disinkronkan via trigger dari auth.users.
-- Tabel hanya dibaca service_role (RLS aktif tanpa policy) → email tidak bocor ke klien.

create table if not exists public.user_emails (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  updated_at timestamptz not null default now()
);

alter table public.user_emails enable row level security;

-- Backfill
insert into public.user_emails (user_id, email, updated_at)
select id, email, now() from auth.users
where email is not null
on conflict (user_id) do update set email = excluded.email, updated_at = now();

-- Trigger sinkronisasi
create or replace function public.sync_user_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is not null then
    insert into public.user_emails (user_id, email, updated_at)
    values (new.id, new.email, now())
    on conflict (user_id) do update set email = excluded.email, updated_at = now();
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_user_email on auth.users;
create trigger trg_sync_user_email
after insert or update of email on auth.users
for each row execute function public.sync_user_email();

-- Index bantu
create index if not exists idx_user_emails_email on public.user_emails (email);
