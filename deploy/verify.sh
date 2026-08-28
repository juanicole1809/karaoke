#!/usr/bin/env bash
# Verificación post-deploy de karaoke (HTTP, WebSocket, búsqueda, canción pedida).
# Uso: URL_APP=https://karaoke.tudominio.com ./verify.sh
BASE="${URL_APP:-http://localhost:8080}"
echo "→ Verificando ${BASE}"

# 1. Web carga
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "${BASE}/" || true)
echo "[1/5] Web /           → ${code}"
if [[ "$code" != "200" ]]; then echo "  ✗ la web no responde"; exit 1; fi

# 2. API health
h=$(curl -s --max-time 10 "${BASE}/api/vkara/health" || true)
echo "[2/5] API health      → ${h:0:60}"
if [[ "$h" != *'"status":"ok"'* ]]; then echo "  ✗ health no es ok (¿API/Redis apagados?)"; exit 1; fi

# 3. Búsqueda de YouTube (innertube)
s=$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 \
    -X POST "${BASE}/api/vkara/search" -H 'Content-Type: application/json' \
    -d '{"query":"karaoke persiana americana"}' || true)
echo "[3/5] YouTube search  → ${s}"
if [[ "$s" != "200" ]]; then echo "  ✗ búsqueda falló (¿throttle de YouTube o PUBLIC_APP_URL?)"; exit 1; fi

# 4. Pedido de canción (pipeline de validación)
r=$(curl -s --max-time 40 -X POST "${BASE}/api/vkara/song-request" \
    -H 'Content-Type: application/json' -d '{"query":"Persiana Americana - Soda Stereo"}' || true)
n=$(printf '%s' "$r" | grep -o '"confidence"' | wc -l | tr -d ' ')
echo "[4/5] song-request    → ${n} candidatos validados"
if [[ "$n" -eq 0 ]]; then echo "  ✗ el validador no devolvió candidatos"; exit 1; fi

# 5. WebSocket (lo crítico: la app sincroniza por aquí)
node -e '
const BASE = process.env.URL_APP || process.argv[1];
const url = BASE.replace(/^http/, "ws") + "/ws";
const s = new WebSocket(url);
const t = setTimeout(() => {
  console.log("  ✗ WS timeout — revisá Cloudflare (WebSockets activados?) y el proxy");
  process.exit(1);
}, 8000);
s.onopen = () => {
  s.send(JSON.stringify({ id: "v1", timestamp: Date.now(), type: "ping" }));
  setTimeout(() => {
    console.log("[5/5] WebSocket       → OK (wss funcionando con Cloudflare)");
    clearTimeout(t); s.close(); process.exit(0);
  }, 1200);
};
s.onerror = (e) => { clearTimeout(t); console.log("  ✗ WS error: " + (e.message || String(e))); process.exit(1); };
' "$BASE"

echo ""
echo "✅ Todo OK. Abrí ${BASE} en el TV: creá sala, escaneá el QR con el celu y agregá una canción."