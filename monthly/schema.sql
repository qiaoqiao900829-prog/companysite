-- Monthly rental extension. Run only after reviewing in Supabase SQL Editor.
-- Does not update or delete existing properties, property_media, storage files or customer data.
create table if not exists public.monthly_settings (
 property_id uuid primary key references public.properties(id) on delete restrict,
 enabled boolean not null default false,
 min_nights integer not null default 30 check(min_nights between 1 and 3650),
 monthly_rent numeric(12,0) not null default 0 check(monthly_rent>=0),
 utilities_per_person_day numeric(12,0) not null default 0 check(utilities_per_person_day>=0),
 extra_person_day numeric(12,0) not null default 0 check(extra_person_day>=0),
 deposit numeric(12,0) not null default 0 check(deposit>=0),
 contract_fee numeric(12,0) not null default 0 check(contract_fee>=0),
 peak_surcharge_day numeric(12,0) not null default 0 check(peak_surcharge_day>=0),
 peak_periods jsonb not null default '[]'::jsonb,
 max_guests integer not null default 4 check(max_guests between 1 and 30),
 updated_at timestamptz not null default now()
);
create table if not exists public.monthly_blocks (
 id uuid primary key default gen_random_uuid(),
 property_id uuid not null references public.properties(id) on delete restrict,
 start_date date not null,
 end_date date not null,
 reason text,
 created_at timestamptz not null default now(),
 constraint monthly_block_valid check(end_date>start_date)
);
create index if not exists monthly_blocks_property_dates on public.monthly_blocks(property_id,start_date,end_date);
create table if not exists public.monthly_requests (
 id uuid primary key default gen_random_uuid(),
 property_id uuid not null references public.properties(id) on delete restrict,
 start_date date not null,
 end_date date not null,
 guests integer not null check(guests between 1 and 30),
 guest_name text not null check(char_length(guest_name) between 1 and 120),
 guest_email text not null check(char_length(guest_email) between 3 and 254),
 message text not null default '',
 quote_total numeric(12,0) not null default 0,
 status text not null default 'pending' check(status in ('pending','reviewing','approved','rejected','cancelled')),
 created_at timestamptz not null default now(),
 constraint monthly_request_valid check(end_date>start_date)
);
create index if not exists monthly_requests_property_dates on public.monthly_requests(property_id,start_date,end_date);
alter table public.monthly_settings enable row level security;
alter table public.monthly_blocks enable row level security;
alter table public.monthly_requests enable row level security;
-- Public may read only settings for published short rentals.
create policy "monthly settings public read" on public.monthly_settings for select to anon,authenticated
using (enabled and exists(select 1 from public.properties p where p.id=property_id and p.business_type='short' and p.status='published'));
create policy "monthly blocks public read" on public.monthly_blocks for select to anon,authenticated
using (exists(select 1 from public.monthly_settings s where s.property_id=monthly_blocks.property_id and s.enabled));
-- Admin access is limited to users explicitly listed in monthly_admins.
create table if not exists public.monthly_admins(user_id uuid primary key references auth.users(id));
alter table public.monthly_admins enable row level security;
create policy "monthly admins self read" on public.monthly_admins for select to authenticated using(user_id=auth.uid());
create policy "monthly settings admin all" on public.monthly_settings for all to authenticated
using (exists(select 1 from public.monthly_admins a where a.user_id=auth.uid()))
with check(exists(select 1 from public.monthly_admins a where a.user_id=auth.uid()));
create policy "monthly blocks admin all" on public.monthly_blocks for all to authenticated
using (exists(select 1 from public.monthly_admins a where a.user_id=auth.uid()))
with check(exists(select 1 from public.monthly_admins a where a.user_id=auth.uid()));
create policy "monthly requests admin read" on public.monthly_requests for select to authenticated
using (exists(select 1 from public.monthly_admins a where a.user_id=auth.uid()));
create policy "monthly requests admin update" on public.monthly_requests for update to authenticated
using (exists(select 1 from public.monthly_admins a where a.user_id=auth.uid()))
with check(exists(select 1 from public.monthly_admins a where a.user_id=auth.uid()));
-- Additional administrator SELECT policies: draft/disabled settings must remain editable.
create policy "monthly settings admin read" on public.monthly_settings for select to authenticated
using (exists(select 1 from public.monthly_admins a where a.user_id=auth.uid()));
create policy "monthly blocks admin read" on public.monthly_blocks for select to authenticated
using (exists(select 1 from public.monthly_admins a where a.user_id=auth.uid()));
-- Exclusion constraint prevents two approved bookings from overlapping.
create extension if not exists btree_gist;
alter table public.monthly_requests add constraint monthly_no_approved_overlap
exclude using gist (property_id with =, daterange(start_date,end_date,'[)') with &&)
where (status='approved');
-- Public request creation must be implemented via a server-side endpoint / Edge Function
-- with spam controls, validation, rate limits and authoritative pricing. No anon INSERT policy.
-- Register the existing admin user manually after reviewing auth.users:
-- insert into public.monthly_admins(user_id) values ('YOUR_EXISTING_AUTH_USER_UUID');
