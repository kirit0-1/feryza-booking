-- Feryza Barber — esquema de reservas (Supabase)
-- Ejecutar una vez en: SQL Editor → New query → Run

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

-- Evita doble reserva en el mismo barbero/fecha/hora (solo citas confirmadas)
create unique index if not exists bookings_unique_slot_confirmed
  on public.bookings (barber_id, fecha, time)
  where status = 'confirmed';

create index if not exists bookings_fecha_barber_idx
  on public.bookings (fecha, barber_id);

create index if not exists bookings_status_fecha_idx
  on public.bookings (status, fecha);

alter table public.bookings enable row level security;

-- Lectura pública (demo): necesaria para disponibilidad y panel
drop policy if exists "bookings_select_public" on public.bookings;
create policy "bookings_select_public"
  on public.bookings
  for select
  to anon, authenticated
  using (true);

-- Insert público de nuevas reservas
drop policy if exists "bookings_insert_public" on public.bookings;
create policy "bookings_insert_public"
  on public.bookings
  for insert
  to anon, authenticated
  with check (status = 'confirmed');

-- Update de status (demo: PIN en el cliente; no Auth completo)
drop policy if exists "bookings_update_status" on public.bookings;
create policy "bookings_update_status"
  on public.bookings
  for update
  to anon, authenticated
  using (true)
  with check (status in ('confirmed', 'cancelled', 'completed'));
