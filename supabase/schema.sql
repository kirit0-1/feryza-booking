-- Feryza Barber — esquema de reservas (Supabase)
-- Instalación nueva: ejecutar este archivo completo.
-- Proyecto ya en marcha: ejecutar supabase/hardening.sql (no borra citas).

create extension if not exists "pgcrypto";

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  barber_id text not null,
  service_id text not null,
  service_name text not null,
  fecha date not null,
  time text not null,
  duration int not null default 45,
  cliente_nombre text not null,
  cliente_telefono text not null,
  cliente_correo text not null,
  pago text not null,
  total int not null default 0,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled', 'completed')),
  created_at timestamptz not null default now()
);

create unique index if not exists bookings_unique_slot_confirmed
  on public.bookings (barber_id, fecha, time)
  where status = 'confirmed';

create index if not exists bookings_fecha_barber_idx
  on public.bookings (fecha, barber_id);

create index if not exists bookings_status_fecha_idx
  on public.bookings (status, fecha);

alter table public.bookings enable row level security;

create table if not exists public.admin_settings (
  id int primary key default 1 check (id = 1),
  pin_hash text not null
);

insert into public.admin_settings (id, pin_hash)
values (1, crypt('feryza2026', gen_salt('bf')))
on conflict (id) do nothing;

alter table public.admin_settings enable row level security;

create or replace function public._admin_pin_ok(p_pin text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_settings
    where id = 1
      and pin_hash = crypt(p_pin, pin_hash)
  );
$$;

create or replace function public.admin_verify_pin(p_pin text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public._admin_pin_ok(p_pin);
$$;

create or replace function public.get_confirmed_slots(p_fecha date, p_barber_id text default null)
returns table (
  id uuid,
  barber_id text,
  fecha date,
  "time" text,
  duration int,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.barber_id, b.fecha, b."time", b.duration, b.status
  from public.bookings b
  where b.fecha = p_fecha
    and b.status = 'confirmed'
    and (p_barber_id is null or b.barber_id = p_barber_id);
$$;

create or replace function public.create_booking(
  p_barber_id text,
  p_service_id text,
  p_service_name text,
  p_fecha date,
  p_time text,
  p_duration int,
  p_cliente_nombre text,
  p_cliente_telefono text,
  p_cliente_correo text,
  p_pago text,
  p_total int
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if p_duration is null or p_duration < 15 or p_duration > 180 then
    raise exception 'Duración inválida';
  end if;
  if p_time is null or p_time !~ '^\d{2}:\d{2}$' then
    raise exception 'Hora inválida';
  end if;
  if length(trim(p_cliente_nombre)) < 2 then
    raise exception 'Nombre inválido';
  end if;
  if length(regexp_replace(p_cliente_telefono, '\D', '', 'g')) < 9 then
    raise exception 'Teléfono inválido';
  end if;

  insert into public.bookings (
    barber_id, service_id, service_name, fecha, "time", duration,
    cliente_nombre, cliente_telefono, cliente_correo, pago, total, status
  ) values (
    p_barber_id, p_service_id, p_service_name, p_fecha, p_time, p_duration,
    trim(p_cliente_nombre), trim(p_cliente_telefono), coalesce(trim(p_cliente_correo), ''),
    p_pago, coalesce(p_total, 0), 'confirmed'
  )
  returning id into new_id;

  return json_build_object('id', new_id, 'barber_id', p_barber_id);
exception
  when unique_violation then
    raise exception 'SLOT_TAKEN' using errcode = '23505';
end;
$$;

create or replace function public.purge_old_bookings()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.bookings
  where fecha < current_date
    and status in ('completed', 'cancelled');
$$;

create or replace function public.admin_list_bookings(p_pin text, p_from date, p_to date)
returns setof public.bookings
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._admin_pin_ok(p_pin) then
    raise exception 'PIN_INVALID' using errcode = '42501';
  end if;

  perform public.purge_old_bookings();

  return query
    select *
    from public.bookings
    where fecha >= p_from
      and fecha <= p_to
    order by fecha, "time";
end;
$$;

create or replace function public.admin_update_status(p_pin text, p_id uuid, p_status text)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.bookings;
begin
  if not public._admin_pin_ok(p_pin) then
    raise exception 'PIN_INVALID' using errcode = '42501';
  end if;
  if p_status not in ('confirmed', 'cancelled', 'completed') then
    raise exception 'Estado inválido';
  end if;

  update public.bookings
  set status = p_status
  where id = p_id
  returning * into updated;

  if updated.id is null then
    raise exception 'Cita no encontrada';
  end if;

  return updated;
end;
$$;

revoke all on function public._admin_pin_ok(text) from public, anon, authenticated;
grant execute on function public.admin_verify_pin(text) to anon, authenticated;
grant execute on function public.get_confirmed_slots(date, text) to anon, authenticated;
grant execute on function public.create_booking(text, text, text, date, text, int, text, text, text, text, int) to anon, authenticated;
grant execute on function public.admin_list_bookings(text, date, date) to anon, authenticated;
grant execute on function public.admin_update_status(text, uuid, text) to anon, authenticated;

drop policy if exists "bookings_select_public" on public.bookings;
drop policy if exists "bookings_insert_public" on public.bookings;
drop policy if exists "bookings_update_status" on public.bookings;

revoke all on public.bookings from anon, authenticated, public;
revoke all on public.admin_settings from anon, authenticated, public;
