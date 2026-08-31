# Cómo actualizar la app (kara.iapp.ar)

> **2026-08-31 — Migración a vps-hetzner-2 (Nuremberg, 4 vCPU / 8GB RAM).**
> El build ahora corre **en el propio server** (antes GitHub Actions porque el VPS viejo tenía 2GB y se quedaba sin RAM compilando Next.js).
> Server: `ssh root@100.84.48.125` (Tailscale, `vps-hetzner-2`). IP pública: `46.224.150.16`.

## Arquitectura rápida

```
[tu Mac]   código → git push → GitHub (repo juanicole1809/karaoke)
[VPS 8GB]  update.sh → git pull → docker compose build → up → nginx 443 → Cloudflare → kara.iapp.ar
```

El workflow de GitHub Actions (`.github/workflows/build.yml`) quedó **solo manual** (workflow_dispatch) como respaldo.

## Actualizar después de editar el código

Working dir: **`/Users/cole1809/Documents/code_proyects/karaoke/vkara`** (git ya apunta al repo `juanicole1809/karaoke`).

### 1. Editá y verificá local

```bash
cd /Users/cole1809/Documents/code_proyects/karaoke/vkara
bun install                      # si cambiaste dependencias
cd apps/web && bunx tsc --noEmit # typecheck web
cd ../api && bunx tsc --noEmit   # typecheck api
```

### 2. Push

```bash
git add -A
git commit -m "mi cambio"
git push
```

### 3. Aplicá en el VPS (1 comando)

```bash
ssh root@100.84.48.125 /opt/karaoke/update.sh
```

`update.sh` hace: `git pull` → `docker compose build` → `down` → `up -d` (~3-5 min de build).

### 4. Verificá

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://kara.iapp.ar/        # 200
# y el flujo real (crea sala + agrega canción con cantantes):
ssh -N -L 8080:127.0.0.1:8080 root@100.84.48.125   # túnel, en otra terminal
```

## Prender / apagar (sin tocar nada más)

```bash
ssh root@100.84.48.125
cd /opt/karaoke
docker compose -f docker-compose.prod.yml up -d    # prender
docker compose -f docker-compose.prod.yml down     # apagar (libera RAM; imagen queda)
```

## Operación del server (referencia)

| Qué | Dónde |
|---|---|
| Contenedor | `karaoke-aio` → `127.0.0.1:8080` (solo host, nunca público) |
| TLS | nginx host, cert en `/etc/nginx/certs/kara.iapp.ar.{crt,key}` (Full Strict en CF) |
| vhost | `/etc/nginx/sites-available/kara.iapp.ar` (enabled) |
| Env | `/opt/karaoke/deploy/.env.prod` (`PUBLIC_APP_URL=https://kara.iapp.ar`) |
| Compose | `/opt/karaoke/docker-compose.prod.yml` (build local, NO está en el repo) |
| update | `/opt/karaoke/update.sh` (git pull + build + restart) |
| Rollback | `git revert` + push → `update.sh` |
| Logs | `docker logs karaoke-aio` / `tail /var/log/nginx/kara.iapp.ar.error.log` |

## Reglas de oro

1. **NO tocar** `/opt/facturador-web/` ni su container/volumen. Karaoke usa solo `127.0.0.1:8080`.
2. **NO exponer** el contenedor a `0.0.0.0`; entra solo por nginx (443) con Cloudflare adelante.
3. **NO commitear** secretos: keys, `.env`, certs (los certs viven solo en `/etc/nginx/certs/`).
4. El build en el server usa ~2GB de RAM pico; con 8GB hay de sobra, pero evitá correrlo a la par de un deploy del facturador si el server está cargado.
