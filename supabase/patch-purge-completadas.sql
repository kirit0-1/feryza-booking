-- Ejecutar en SQL Editor si ya corriste hardening.sql antes.
-- Deja las completadas en el calendario para contabilidad diaria.

create or replace function public.purge_old_bookings()
returns void
language sql
security definer
set search_path = public, extensions
as $$
  delete from public.bookings
  where status = 'cancelled'
    and fecha < (timezone('America/Santiago', now()))::date;
$$;
