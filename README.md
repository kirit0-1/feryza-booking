# Feryza Barber — Reservas online

App estática de reservas (HTML/JS + Supabase). Sin build: lista para **GitHub Pages** o **Vercel**.

**Demo:** https://kirit0-1.github.io/feryza-booking/  
**Panel:** https://kirit0-1.github.io/feryza-booking/admin.html · PIN `feryza2026`  
**Oferta comercial (clínicas / dental / vet / estética):** https://kirit0-1.github.io/feryza-booking/oferta.html  
**Kit interno de ventas:** https://kirit0-1.github.io/feryza-booking/kit-ventas.html

## Qué incluye

- Reserva móvil (servicio → horario → datos → pago)
- Panel día/semana, completar / cancelar por WhatsApp
- Citas completadas en gris (caja del día)
- **Vacaciones:** bloquear días, semanas o franjas horarias
- Efectivo y transferencia · 100% marca del local

## Setup Supabase

1. Proyecto nuevo: ejecuta `supabase/schema.sql` (incluye vacaciones).
2. Proyecto ya vivo: ejecuta, en orden si falta algo:
   - `supabase/hardening.sql`
   - `supabase/patch-purge-completadas.sql`
   - **`supabase/patch-vacaciones.sql`** ← obligatorio para el botón Vacaciones
3. URL y anon key en `scripts/config.js` (ya configuradas en la demo).

## Local

```bash
cd feryza-booking
npm run dev
```

Abre http://localhost:3001 y http://localhost:3001/admin.html

## Deploy

### GitHub Pages (actual)

Push a `main` → workflow `.github/workflows/deploy-pages.yml`.

### Vercel (próximo, con dominio)

1. Importa el repo en [vercel.com](https://vercel.com).
2. Framework preset: **Other** · Build: vacío · Output: `.`
3. `vercel.json` ya tiene headers de caché y seguridad.
4. Cuando tengas dominio, actualiza `APP_CONFIG.publicUrl` en `scripts/config.js`.

Sin dependencias npm en producción: solo archivos estáticos + CDN de Supabase.

## Notas de producto

- Llegar **10 min antes**; la cita se confirma en el último paso.
- Corte clásico ya no incluye masaje (máquina fuera de servicio).
- Cada feature extra se cotiza aparte; esta es la versión final en GitHub hasta dominio propio.
