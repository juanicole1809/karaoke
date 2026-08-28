# Deploy a la VPS (Docker)

App: karaoke multiusuario (fork de vkara) con **pedido de canciones + agente de validación karaoke**.

Stack: imagen todo-en-uno (`aio`) → web (Next.js) + API (Elysia) + Redis + Caddy, todo en **un solo contenedor**, puerto `3000` interno.

---

## 1) Build de la imagen

En tu máquina o directamente en la VPS (recomendado: build en la VPS si tiene RAM ≥ 2GB; el build de Next.js/aio necesita ~1.5-2GB).

```bash
cd karaoke/vkara
cp containers/aio/.env.example containers/aio/.env
AIO_PORT=4000 docker compose --profile aio up --build -d
```

### Envío a la VPS (opciones)

**Opción A — copiar el repo y buildear allá (simple):**

```bash
rsync -av --exclude node_modules --exclude .next --exclude .git ./ usuario@vps:/opt/karaoke/
ssh usuario@vps
cd /opt/karaoke && AIO_PORT=4000 docker compose --profile aio up --build -d
```

**Opción B — imagen pre-buildada (más rápido en la VPS):**

```bash
# local
docker build -f containers/aio/Dockerfile -t karaoke-aio:latest .
docker save karaoke-aio:latest | bzip2 | ssh usuario@vps 'bunzip2 | docker load'
# vps
cd /opt/karaoke && AIO_PORT=4000 docker compose --profile aio up -d
```

---

## 2) Variables de entorno (VPS)

`containers/aio/.env` (o `-e` en el run):

```bash
PUBLIC_APP_URL=https://karaoke.tudominio.com   # obligatorio: usado para validar embed de YouTube
NODE_ENV=production

# --- Agente de validación karaoke (opcional pero recomendado) ---
# Sin API key → modo heurístico (funciona igual, ranking sin LLM).
KARAOKE_AGENT_PROVIDER=anthropic   # anthropic | openai | heuristic
KARAOKE_AGENT_API_KEY=sk-ant-...
KARAOKE_AGENT_MODEL=claude-3-5-haiku-latest   # o gpt-4o-mini si usás openai
```

> Las variables del agente llegan al proceso API vía environment de supervisord:
> `docker compose run` / `up` hereda el `env_file` del contenedor completo, así que
> alcanza con definirlas en `containers/aio/.env`.

---

## 3) HTTPS público (elegí una)

### Opción A — Cloudflare Tunnel (cero puertos abiertos, HTTPS gratis)

```bash
# en la VPS
sudo cloudflared service install <token-de-tunnel>
```

En el dashboard de Cloudflare, public service → `https://karaoke.tudominio.com` →
`http://localhost:4000` (el puerto mapeado del contenedor).

### Opción B — Caddy en el host (auto-HTTPS con Le)

```bash
# /etc/caddy/Caddyfile
karaoke.tudominio.com {
    reverse_proxy 127.0.0.1:4000
}
```

Solo apuntá el DNS (record A) a la IP de la VPS y Caddy emite el certificado solo.

### Opción C — nginx

```nginx
server_name karaoke.tudominio.com;
location / { proxy_pass http://127.0.0.1:4000; proxy_http_version 1.1; }
location /ws { proxy_pass http://127.0.0.1:4000; proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; }
```

> El WebSocket es **clave**: vkara sincroniza cola/playback por `wss`. Cualquier
> proxy inverso debe soportar `Upgrade`/`Connection`.

---

## 4) Verificación

```bash
curl -I https://karaoke.tudominio.com                        # 200
curl -X POST https://karaoke.tudominio.com/api/vkara/search \
  -H 'Content-Type: application/json' -d '{"query":"karaoke persiana americana"}'
curl -X POST https://karaoke.tudominio.com/api/vkara/song-request \
  -H 'Content-Type: application/json' -d '{"query":"Persiana Americana - Soda Stereo"}'
```

Flujo de la fiesta:

1. Abrí `https://karaoke.tudominio.com` en el TV/laptop conectada al HDMI → botón **Crear sala**.
2. La pantalla muestra código de 4 dígitos + **QR**.
3. Invitados escanean el QR → entran directo a la sala → pestaña **🎤 Pedir** → escriben
   "Persiana Americana - Soda" → el sistema busca y valida la versión karaoke → **Agregar**.
4. Todo se ve en realtime en la pantalla grande.

---

## 5) Tips de operación

- **RAM**: 1GB alcanza para una fiesta de ~50 personas. El contenedor corre Redis embebido.
- **Backups**: no hay datos que persistir (memoria/Redis). Si cerrás la sala, se borra todo.
- **Actualizar**: `docker compose --profile aio up --build -d` de nuevo tras un `git pull`.
- **Logs**: `docker logs -f vkara-aio`
- **Límites**: vkara usa innertube (sin API key de YouTube). Para una noche está bien;
  si buscás mucho seguido YouTube puede throttlear. El modo agente no cambia eso.