# Eryza Barber — Reservas online

App de reservas para **Eryza Barber**. Misma plataforma que Menfresh, personalizada para esta barbería.

## Datos del negocio

| Dato | Valor |
|------|--------|
| WhatsApp | +56 9 7960 8342 |
| Correo | Fernandoisaias2606@gmail.com |
| Lun–Sáb | 10:00 – 21:00 |
| Domingo | 11:00 – 14:00 |
| Intervalos | 45 min |

### Servicios

| Servicio | Precio | Duración |
|----------|--------|----------|
| El corte | $7.000 | 45 min |
| La barba | $2.000 | 45 min |
| Membresía 4 cortes / mes | $22.000 | 45 min |

## Local

```bash
cd eryza-booking
npx serve . -l 3001
```

## Deploy GitHub Pages

```bash
cd eryza-booking
git init -b main
git add -A
git commit -m "Eryza Barber booking app"
gh repo create eryza-booking --public --source=. --remote=origin --push
```

Luego: Settings → Pages → Source: GitHub Actions.

URL esperada: `https://kirit0-1.github.io/eryza-booking/`
