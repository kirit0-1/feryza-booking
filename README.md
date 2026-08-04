# Feryza Barber — Reservas online

App de reservas para **Feryza Barber**. Las citas se guardan en **Supabase** (visibles para todos) y el barbero las gestiona en un panel con PIN. El correo al barbero va a `Fernandoisaias2606@gmail.com` vía EmailJS.

**Demo:** https://kirit0-1.github.io/feryza-booking/  
**Panel barbero:** https://kirit0-1.github.io/feryza-booking/admin.html

## Datos del negocio

| Dato | Valor |
|------|--------|
| WhatsApp | +56 9 7960 8342 |
| Correo | Fernandoisaias2606@gmail.com |
| Lun–Sáb | 10:00 – 21:00 |
| Domingo | 11:00 – 14:00 |
| Intervalos | 45 min |
| PIN panel (demo) | `feryza2026` |

### Servicios

| Servicio | Precio | Duración |
|----------|--------|----------|
| El corte | $7.000 | 45 min |
| La barba | $2.000 | 45 min |
| Membresía 4 cortes / mes | $22.000 | 45 min |

## Setup (checklist)

### 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, pega y ejecuta el contenido de [`supabase/schema.sql`](supabase/schema.sql).
3. En **Project Settings → API**, copia:
   - **Project URL** → `APP_CONFIG.supabase.url` en [`scripts/config.js`](scripts/config.js)
   - **anon public** key → `APP_CONFIG.supabase.anonKey`
4. Deja `features.useMockAvailability: false` (ya viene así). Si faltan las keys, la app cae a `localStorage` solo en ese navegador.

### 2. EmailJS (opcional en demo)

Sin EmailJS la reserva **igual se guarda** en Supabase; el toast avisa que revises el panel.

1. Crea cuenta en [emailjs.com](https://www.emailjs.com).
2. Conecta un servicio de correo (Gmail u otro).
3. Crea **2 plantillas**: una para el cliente y otra para el barbero (usa `to_email`, `servicio`, `fecha`, `hora`, `pago`, `total`, `telefono`, `cliente` / `to_name`).
4. En la plantilla del barbero, el destinatario debe usar `{{to_email}}` (la app fuerza `Fernandoisaias2606@gmail.com`).
5. Pega en `config.js`: `serviceId`, `templateClienteId`, `templateBarberoId`, `publicKey`.

### 3. Panel del barbero

- URL: `/admin.html`
- PIN demo en `APP_CONFIG.admin.pin` → `feryza2026`
- Acciones: **Completada** / **Cancelar** (liberan el horario porque solo `confirmed` bloquea slots).

### 4. Deploy (GitHub Pages)

Push a `main` activa Pages automáticamente (workflow en `.github/workflows/`).

## Local

```bash
cd feryza-booking
npx serve . -l 3001
```

Abre `http://localhost:3001` y `http://localhost:3001/admin.html`.

## Arquitectura

```
Cliente (index.html)  →  insert/select  →  Supabase bookings
Admin (admin.html)    →  list/update    →  Supabase bookings
Cliente               →  EmailJS        →  Fernandoisaias2606@gmail.com
```
