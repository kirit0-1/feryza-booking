-- Vacaciones / bloqueos de agenda
-- Ejecutar en SQL Editor (proyecto que ya tiene hardening.sql).

create table if not exists public.blocked_periods (
  id uuid primary key default gen_random_uuid(),
  barber_id text,
  fecha_from date not null,
  fecha_to date not null,
  time_from text,
  time_to text,
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint blocked_dates_ok check (fecha_to >= fecha_from),
  constraint blocked_times_ok check (
    (time_from is null and time_to is null)
    or (
      time_from is not null
      and time_to is not null
      and time_from ~ '^\d{2}:\d{2}$'
      and time_to ~ '^\d{2}:\d{2}$'
      and time_from < time_to
    )
  )
);

create index if not exists blocked_periods_range_idx
  on public.blocked_periods (fecha_from, fecha_to);

alter table public.blocked_periods enable row level security;

revoke all on public.blocked_periods from anon, authenticated, public;

create or replace function public._time_to_min(p_time text)
returns int
language sql
immutable
as $$
  select split_part(p_time, ':', 1)::int * 60 + split_part(p_time, ':', 2)::int;
$$;

create or replace function public.is_slot_blocked(
  p_fecha date,
  p_time text,
  p_duration int,
  p_barber_id text default null
)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.blocked_periods bp
    where p_fecha between bp.fecha_from and bp.fecha_to
      and (bp.barber_id is null or bp.barber_id = p_barber_id)
      and (
        bp.time_from is null
        or (
          public._time_to_min(p_time) < public._time_to_min(bp.time_to)
          and (public._time_to_min(p_time) + greatest(p_duration, 1))
              > public._time_to_min(bp.time_from)
        )
      )
  );
$$;

create or replace function public.get_blocked_periods(
  p_from date,
  p_to date,
  p_barber_id text default null
)
returns table (
  id uuid,
  barber_id text,
  fecha_from date,
  fecha_to date,
  time_from text,
  time_to text,
  note text
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    bp.id,
    bp.barber_id,
    bp.fecha_from,
    bp.fecha_to,
    bp.time_from,
    bp.time_to,
    bp.note
  from public.blocked_periods bp
  where bp.fecha_to >= p_from
    and bp.fecha_from <= p_to
    and (p_barber_id is null or bp.barber_id is null or bp.barber_id = p_barber_id)
  order by bp.fecha_from, bp.time_from nulls first;
$$;

create or replace function public.admin_list_blocks(
  p_pin text,
  p_from date,
  p_to date
)
returns table (
  id uuid,
  barber_id text,
  fecha_from date,
  fecha_to date,
  time_from text,
  time_to text,
  note text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public._admin_pin_ok(p_pin) then
    raise exception 'PIN_INVALID' using errcode = '42501';
  end if;

  return query
    select
      bp.id,
      bp.barber_id,
      bp.fecha_from,
      bp.fecha_to,
      bp.time_from,
      bp.time_to,
      bp.note,
      bp.created_at
    from public.blocked_periods bp
    where bp.fecha_to >= p_from
      and bp.fecha_from <= p_to
    order by bp.fecha_from, bp.time_from nulls first;
end;
$$;

create or replace function public.admin_create_block(
  p_pin text,
  p_fecha_from date,
  p_fecha_to date,
  p_time_from text default null,
  p_time_to text default null,
  p_note text default '',
  p_barber_id text default null
)
returns public.blocked_periods
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  created public.blocked_periods;
begin
  if not public._admin_pin_ok(p_pin) then
    raise exception 'PIN_INVALID' using errcode = '42501';
  end if;
  if p_fecha_to < p_fecha_from then
    raise exception 'Rango de fechas inválido';
  end if;

  insert into public.blocked_periods (
    barber_id, fecha_from, fecha_to, time_from, time_to, note
  ) values (
    nullif(trim(coalesce(p_barber_id, '')), ''),
    p_fecha_from,
    p_fecha_to,
    nullif(trim(coalesce(p_time_from, '')), ''),
    nullif(trim(coalesce(p_time_to, '')), ''),
    coalesce(trim(p_note), '')
  )
  returning * into created;

  return created;
end;
$$;

create or replace function public.admin_delete_block(p_pin text, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public._admin_pin_ok(p_pin) then
    raise exception 'PIN_INVALID' using errcode = '42501';
  end if;

  delete from public.blocked_periods where id = p_id;
  return found;
end;
$$;

-- create_booking ahora rechaza horas bloqueadas
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
set search_path = public, extensions
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
  if public.is_slot_blocked(p_fecha, p_time, p_duration, p_barber_id) then
    raise exception 'SLOT_BLOCKED' using errcode = 'P0001';
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

grant execute on function public.get_blocked_periods(date, date, text) to anon, authenticated;
grant execute on function public.admin_list_blocks(text, date, date) to anon, authenticated;
grant execute on function public.admin_create_block(text, date, date, text, text, text, text) to anon, authenticated;
grant execute on function public.admin_delete_block(text, uuid) to anon, authenticated;
