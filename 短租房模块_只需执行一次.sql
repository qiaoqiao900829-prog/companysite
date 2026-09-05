-- 在 Supabase 的 SQL Editor 中执行一次，为“短租房”增加业务类型。
-- 不会删除房源或图片。

do $$
declare
  item record;
begin
  for item in
    select conname
    from pg_constraint
    where conrelid = 'public.properties'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%business_type%'
  loop
    execute format('alter table public.properties drop constraint %I', item.conname);
  end loop;
end $$;

alter table public.properties
  add constraint properties_business_type_check
  check (business_type in ('rent', 'short', 'sale'));
