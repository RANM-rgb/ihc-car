// === Config ===
const API_BASE = "http://52.0.30.82:5500/api"; // Si corres desde otra PC, cambia por http://IP:5500/api

// Catálogo local (para mostrar estatus inmediatamente)
const CATALOGO = {
  1: "Adelante",
  2: "Atrás",
  3: "Detener",
  4: "Vuelta adelante derecha",
  5: "Vuelta adelante izquierda",
  6: "Vuelta atrás derecha",
  7: "Vuelta atrás izquierda",
  8: "Giro 90° derecha",
  9: "Giro 90° izquierda",
  10: "Giro 360° derecha",
  11: "Giro 360° izquierda",
};

// === Utilidades UI ===
const statusEl = document.getElementById("status");
const tsEl = document.getElementById("timestamp");
const toastEl = document.getElementById("toast");
const toastMsg = document.getElementById("toast-msg");
const toast = new bootstrap.Toast(toastEl, { delay: 2000 });

function showToast(msg) {
  toastMsg.textContent = msg;
  toast.show();
}

function setStatus(texto, fecha = null) {
  statusEl.textContent = (texto || "—").toUpperCase();
  tsEl.textContent = fecha ? new Date(fecha).toLocaleString() : "";
}

// === Llamadas a API ===
async function postMovimiento(id_movimiento) {
  const url = `${API_BASE}/movimientos`;
  const body = { id_movimiento };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Error HTTP ${res.status}`);
  }
  return res.json();
}

async function getUltimoMovimiento() {
  const url = `${API_BASE}/movimientos/ultimo`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Error HTTP ${res.status}`);
  }
  return res.json();
}

// === Controladores ===
async function enviarMovimiento(idMov) {
  try {
    // Feedback optimista: mostrar de inmediato
    setStatus(CATALOGO[idMov]);
    await postMovimiento(idMov);
    showToast(`Enviado: ${CATALOGO[idMov]}`);

    // Confirmar con el último estatus de la API
    await refrescarUltimo();
  } catch (e) {
    showToast(`Error: ${e.message}`);
  }
}

async function refrescarUltimo() {
  try {
    const { data } = await getUltimoMovimiento();
    if (data) {
      // El API devuelve { id, movimiento, fecha_hora }
      setStatus(data.movimiento, data.fecha_hora);
    }
  } catch (e) {
    showToast(`No se pudo consultar el estatus: ${e.message}`);
  }
}

// === Eventos ===
document.querySelectorAll("[data-mov]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const id = Number(btn.dataset.mov);
    enviarMovimiento(id);
  });
});

// Atajos de teclado (opcional)
document.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (key === "w") enviarMovimiento(1);       // Adelante
  if (key === "s") enviarMovimiento(2);       // Atrás
  if (key === " ") enviarMovimiento(3);       // Detener
  if (key === "e") enviarMovimiento(4);       // Vuelta adelante derecha
  if (key === "q") enviarMovimiento(5);       // Vuelta adelante izquierda
  if (key === "c") enviarMovimiento(6);       // Vuelta atrás derecha
  if (key === "z") enviarMovimiento(7);       // Vuelta atrás izquierda
  if (key === "d") enviarMovimiento(8);       // Giro 90° derecha
  if (key === "a") enviarMovimiento(9);       // Giro 90° izquierda
  if (key === "x") enviarMovimiento(10);      // Giro 360° derecha
  if (key === "y") enviarMovimiento(11);      // Giro 360° izquierda
});

// ✅ Ejecutar refrescarUltimo() automáticamente al cargar la página
window.addEventListener("DOMContentLoaded", async () => {
  await refrescarUltimo();
});
// === Monitoreo: Config ===
const MONITOR_N = 10;       // cuántos últimos movimientos mostrar
const MONITOR_MS = 2000;    // refresco automático cada 2s
let monitorTimer = null;

// === API extra ===
async function getUltimosMovimientos(n = MONITOR_N) {
  const url = `${API_BASE}/movimientos/ultimos?n=${encodeURIComponent(n)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Error HTTP ${res.status}`);
  }
  return res.json();
}

// === Render de tabla ===
function renderTablaMovs(rows) {
  const tbody = document.getElementById("tabla-movs");
  if (!tbody) return;

  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted">Sin datos</td></tr>`;
    return;
  }

  const html = list.map(r => {
    const id = r.id ?? "";
    const mov = (r.movimiento ?? r.status_texto ?? "").toString();
    const fecha = r.fecha_hora ?? r.created_at ?? "";
    return `<tr><td>${id}</td><td>${mov}</td><td>${fecha}</td></tr>`;
  }).join("");

  // Solo actualizamos el <tbody> (no recargamos la página)
  tbody.innerHTML = html;
}

// === Ciclo de monitoreo ===
async function updateMonitorOnce() {
  try {
    // 1) Tabla de últimos N
    const ultimos = await getUltimosMovimientos(MONITOR_N);
    const rows = ultimos?.data ?? ultimos;   // por compatibilidad
    renderTablaMovs(rows);

    // 2) Actualizar el estatus con la última lectura real
    await refrescarUltimo();

    // 3) Pie con hora de actualización
    const foot = document.getElementById("monitor-foot");
    if (foot) foot.textContent = `Actualizado: ${new Date().toLocaleTimeString()}`;
  } catch (e) {
    showToast(`Error de monitoreo: ${e.message}`);
  }
}

function startMonitor() {
  if (monitorTimer) return;
  updateMonitorOnce(); // tiro inmediato
  monitorTimer = setInterval(updateMonitorOnce, MONITOR_MS);

  const btn = document.getElementById("btn-monitor-toggle");
  if (btn) {
    btn.setAttribute("data-active", "1");
    btn.classList.remove("btn-outline-primary");
    btn.classList.add("btn-primary");
    btn.textContent = "Detener";
  }
}

function stopMonitor() {
  if (!monitorTimer) return;
  clearInterval(monitorTimer);
  monitorTimer = null;

  const btn = document.getElementById("btn-monitor-toggle");
  if (btn) {
    btn.setAttribute("data-active", "0");
    btn.classList.remove("btn-primary");
    btn.classList.add("btn-outline-primary");
    btn.textContent = "Auto (2s)";
  }
}

// === Eventos del monitor ===
window.addEventListener("DOMContentLoaded", () => {
  // Botón de actualización manual
  const btnOnce = document.getElementById("btn-monitor-once");
  if (btnOnce) btnOnce.addEventListener("click", updateMonitorOnce);

  // Toggle auto-refresh
  const btnToggle = document.getElementById("btn-monitor-toggle");
  if (btnToggle) {
    btnToggle.addEventListener("click", () => {
      const active = btnToggle.getAttribute("data-active") === "1";
      if (active) stopMonitor(); else startMonitor();
    });
  }

  // (Opcional) iniciar el auto-refresh al cargar:
  // startMonitor();
});
// =====================
// Control por Voz (Frontend puro con MockAPI)
// =====================

// --- Config ---
const MOCKAPI_URL = "https://68e5388e8e116898997ee625.mockapi.io/apikey"; // <-- tu endpoint
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";   // puedes cambiarlo si quieres

// --- Helpers ---
function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, ...options });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// Extrae la key de distintos formatos posibles (objeto o arreglo)
function extractKeyFromBody(body) {
  if (!body) return null;
  const candidate = Array.isArray(body) && body.length ? body[0] : body;
  const fields = ["api_key","apikey","key","token","value","secret","apiKey"];
  for (const f of fields) {
    if (candidate && Object.prototype.hasOwnProperty.call(candidate, f) && candidate[f]) {
      return String(candidate[f]).trim();
    }
  }
  if (candidate && typeof candidate === "object") {
    for (const k of Object.keys(candidate)) {
      const v = candidate[k];
      if (typeof v === "string" && v.length > 20) return v.trim();
    }
  }
  return null;
}

// Carga la key desde MockAPI con reintentos
async function loadKeyFromMockAPI(maxAttempts = 3, delayMs = 1200) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetchWithTimeout(MOCKAPI_URL, { method: "GET", cache: "no-store" }, 8000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const key = extractKeyFromBody(body);
      if (key) return key;
      throw new Error("Respuesta sin campo de API key");
    } catch (err) {
      console.warn(`[MockAPI] intento ${attempt} fallido: ${err.message}`);
      if (attempt < maxAttempts) await wait(delayMs);
    }
  }
  return null;
}

// === Lista blanca de comandos que entenderá el LLM ===
const INTENT_COMMANDS = [
  { cmd: "adelante", id: 1 },
  { cmd: "atras", id: 2 },
  { cmd: "detener", id: 3 },
  { cmd: "vuelta_adelante_derecha", id: 4 },
  { cmd: "vuelta_adelante_izquierda", id: 5 },
  { cmd: "vuelta_atras_derecha", id: 6 },
  { cmd: "vuelta_atras_izquierda", id: 7 },
  { cmd: "giro_90_derecha", id: 8 },
  { cmd: "giro_90_izquierda", id: 9 },
  { cmd: "giro_360_derecha", id: 10 },
  { cmd: "giro_360_izquierda", id: 11 },
];

// === Fallback local (regex) ===
const FRASES = [
  { id: 1,  rx: /\b(adelante|arriba|avanza|avanzar|frente)\b/i },
  { id: 2,  rx: /\b(atr[aá]s|abajo|retrocede|retroceder|reversa)\b/i },
  { id: 3,  rx: /\b(det[eé]n|detener|alto|stop|para|parar|espera)\b/i },
  { id: 4,  rx: /\b(vuelta\s*(?:adelante)?\s*derecha|gira\s*adelante\s*derecha|giro\s*adelante\s*derecha)\b/i },
  { id: 5,  rx: /\b(vuelta\s*(?:adelante)?\s*izquierda|gira\s*adelante\s*izquierda|giro\s*adelante\s*izquierda)\b/i },
  { id: 6,  rx: /\b(vuelta\s*atr[aá]s\s*derecha|gira\s*atr[aá]s\s*derecha)\b/i },
  { id: 7,  rx: /\b(vuelta\s*atr[aá]s\s*izquierda|gira\s*atr[aá]s\s*izquierda)\b/i },
  { id: 8,  rx: /\b(giro\s*90(?:\s*grados)?\s*derecha|noventa\s*(?:grados)?\s*derecha|gira\s*90\s*derecha)\b/i },
  { id: 9,  rx: /\b(giro\s*90(?:\s*grados)?\s*izquierda|noventa\s*(?:grados)?\s*izquierda|gira\s*90\s*izquierda)\b/i },
  { id:10,  rx: /\b(giro\s*360(?:\s*grados)?\s*derecha|trescientos\s*sesenta\s*derecha|gira\s*360\s*derecha)\b/i },
  { id:11,  rx: /\b(giro\s*360(?:\s*grados)?\s*izquierda|trescientos\s*sesenta\s*izquierda|gira\s*360\s*izquierda)\b/i },
];
function parsearLocal(texto) {
  const t = (texto || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  for (const item of FRASES) if (item.rx.test(t)) return item.id;
  if (/\bderecha\b/.test(t) && /\badelante\b/.test(t)) return 4;
  if (/\bizquierda\b/.test(t) && /\badelante\b/.test(t)) return 5;
  if (/\bderecha\b/.test(t) && /\batras\b/.test(t)) return 6;
  if (/\bizquierda\b/.test(t) && /\batras\b/.test(t)) return 7;
  if (/\badelante\b/.test(t)) return 1;
  if (/\batras\b/.test(t)) return 2;
  if (/\b(stop|alto|deten|para|detener)\b/.test(t)) return 3;
  return null;
}

// === Cache de key (memoria de la pestaña) ===
let OPENAI_API_KEY = null;
async function ensureOpenAIKey() {
  if (OPENAI_API_KEY) return OPENAI_API_KEY;
  const key = await loadKeyFromMockAPI();
  if (key) {
    OPENAI_API_KEY = key;
    return key;
  }
  return null;
}

// === Llamada a OpenAI para clasificar intención ===
async function classifyWithOpenAI(text) {
  const apiKey = await ensureOpenAIKey();
  if (!apiKey) return { id: null, confidence: 0, error: "no_key" };

  const commands = INTENT_COMMANDS.map(c => c.cmd);
  const systemMsg = "Eres un clasificador de intenciones que devuelve JSON estricto.";
  const userMsg =
    `Texto del usuario: "${text}". ` +
    `Elige el comando que mejor aplique de esta lista EXACTA: ${commands.join(", ")}. ` +
    `Devuelve sólo un JSON: {"command":"<uno de la lista>","confidence":<0..1>}`;

  try {
    const res = await fetchWithTimeout(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: userMsg },
        ],
      })
    }, 15000);

    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
    const data = await res.json();

    let out = {};
    try { out = JSON.parse(data?.choices?.[0]?.message?.content ?? "{}"); } catch {}
    const whitelist = new Set(commands);
    let { command = null, confidence = 0 } = out;
    if (!whitelist.has(command)) command = null;

    const found = INTENT_COMMANDS.find(c => c.cmd === command);
    return { id: found?.id ?? null, confidence: Number(confidence) || 0 };
  } catch (e) {
    console.warn("[OpenAI] clasificación falló:", e.message);
    return { id: null, confidence: 0, error: e.message };
  }
}

// === Utilidades de voz/UI ===
function speak(msg) {
  try {
    const u = new SpeechSynthesisUtterance(msg);
    u.lang = "es-MX";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {}
}

function setVozUI(state, extra = "") {
  const btn = document.getElementById("btn-voz");
  const lbl = document.getElementById("voz-status");
  if (lbl) lbl.textContent = `Micrófono: ${state}${extra ? " — " + extra : ""}`;
  if (!btn) return;
  if (state === "activo") {
    btn.dataset.active = "1";
    btn.classList.remove("btn-outline-dark");
    btn.classList.add("btn-dark");
    btn.innerHTML = `<i class="bi bi-mic-fill"></i> Voz`;
  } else {
    btn.dataset.active = "0";
    btn.classList.remove("btn-dark");
    btn.classList.add("btn-outline-dark");
    btn.innerHTML = `<i class="bi bi-mic"></i> Voz`;
  }
}

// === Módulo principal de Voz ===
const Voz = (() => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let activo = false;

  function onResult(texto) {
    const ult = document.getElementById("voz-ult");
    if (ult) ult.textContent = `“${texto}”`;
  }

  function iniciar() {
    if (!SpeechRecognition) {
      setVozUI("inactivo", "no soportado");
      speak("Tu navegador no soporta reconocimiento de voz");
      return;
    }
    if (activo) return;

    recognition = new SpeechRecognition();
    recognition.lang = "es-MX";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onstart = () => { activo = true; setVozUI("activo", "escuchando…"); };
    recognition.onend   = () => {
      activo = false; setVozUI("inactivo");
      const btn = document.getElementById("btn-voz");
      if (btn?.dataset.active === "1") recognition.start(); // resiliencia
    };
    recognition.onerror = (ev) => { setVozUI("inactivo", ev.error || "error"); };

    recognition.onresult = async (ev) => {
      const texto = ev.results[ev.resultIndex][0].transcript.trim();
      onResult(texto);

      // 1) Intent con OpenAI (usando key de MockAPI)
      const { id, confidence } = await classifyWithOpenAI(texto);

      // 2) Fallback local si no hay id o confianza baja
      const THRESHOLD = 0.6;
      const elegido = (id && confidence >= THRESHOLD) ? id : parsearLocal(texto);

      if (elegido) {
        enviarMovimiento(elegido);
        speak(CATALOGO[elegido] || "ok");
      } else {
        speak("No entendí la orden");
      }
    };

    recognition.start();
  }

  function detener() {
    if (!recognition) return;
    recognition.onend = null;
    recognition.stop();
    activo = false;
    setVozUI("inactivo");
  }

  // Hook del botón
  const btn = document.getElementById("btn-voz");
  if (btn) {
    btn.addEventListener("click", () => {
      const active = btn.dataset.active === "1";
      if (active) detener(); else iniciar();
    });
  }

  return { iniciar, detener };
})();
