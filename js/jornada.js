/* ==================== ESTADO DE LA JORNADA Y MÉTRICAS ==================== */

// Estados: 'fuera', 'libre', 'ocupado', 'incidencia', 'descanso'
let estadoApp = safeStorage.get("uberCambioEstadoApp") || "fuera"; 
let tiempoInicioEstado = Date.now();

// Variables de tiempo diario
let fechaJornadaActual = fechaLocalStr();
let segundosLibreHoy = parseInt(safeStorage.get("uberCambioTiempoLibre_" + fechaJornadaActual)) || 0;
let segundosOcupadoHoy = parseInt(safeStorage.get("uberCambioTiempoOcupado_" + fechaJornadaActual)) || 0;
let segundosIncidenciaHoy = parseInt(safeStorage.get("uberCambioTiempoIncidencia_" + fechaJornadaActual)) || 0;
let segundosDescansoHoy = parseInt(safeStorage.get("uberCambioTiempoDescanso_" + fechaJornadaActual)) || 0;
let segundosFueraHoy = parseInt(safeStorage.get("uberCambioTiempoFuera_" + fechaJornadaActual)) || 0;

/* ==================== CONTROL DE ESTADOS ==================== */

function abrirMenuEstado() {
  const m = document.createElement("div");
  m.id = "modalEstadoApp";
  m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;";
  m.innerHTML = `
    <div style="background:#1e293b;border-radius:16px;padding:20px;max-width:340px;width:100%;border:1px solid #334155;">
      <div style="font-size:16px;font-weight:900;color:#fff;text-align:center;margin-bottom:16px;">ESTADO DE LA JORNADA</div>
      
      <button onclick="cambiarEstadoApp('libre')" style="width:100%;padding:14px;margin-bottom:8px;border-radius:10px;border:none;background:#10b981;color:#fff;font-weight:900;font-size:15px;cursor:pointer;box-shadow:0 4px 10px rgba(16,185,129,0.3);">🟢 LIBRE (Uber ON)</button>
      <button onclick="cambiarEstadoApp('ocupado')" style="width:100%;padding:14px;margin-bottom:8px;border-radius:10px;border:none;background:#ef4444;color:#fff;font-weight:900;font-size:15px;cursor:pointer;box-shadow:0 4px 10px rgba(239,68,68,0.3);">🔴 OCUPADO (Cliente)</button>
      <button onclick="cambiarEstadoApp('incidencia')" style="width:100%;padding:14px;margin-bottom:8px;border-radius:10px;border:none;background:#f59e0b;color:#fff;font-weight:900;font-size:15px;cursor:pointer;box-shadow:0 4px 10px rgba(245,158,11,0.3);">🟠 INCIDENCIA (Repostar/Comer)</button>
      <button onclick="cambiarEstadoApp('descanso')" style="width:100%;padding:14px;margin-bottom:8px;border-radius:10px;border:none;background:#a855f7;color:#fff;font-weight:900;font-size:15px;cursor:pointer;box-shadow:0 4px 10px rgba(168,85,247,0.3);">🟣 DESCANSO (Pausa)</button>
      <button onclick="cambiarEstadoApp('fuera')" style="width:100%;padding:14px;margin-bottom:16px;border-radius:10px;border:none;background:#475569;color:#fff;font-weight:900;font-size:15px;cursor:pointer;">⚫ FUERA DE LA APP (Extras)</button>
      
      <button onclick="document.getElementById('modalEstadoApp').remove()" style="width:100%;padding:12px;border-radius:10px;border:1px solid #475569;background:transparent;color:#94a3b8;font-weight:700;cursor:pointer;">Cancelar</button>
    </div>`;
  document.body.appendChild(m);
  m.addEventListener("click", e => { if(e.target === m) m.remove(); });
}

function cambiarEstadoApp(nuevoEstado) {
  const m = document.getElementById("modalEstadoApp"); if(m) m.remove();
  if(estadoApp === nuevoEstado) return;

  // 1. Guardar el tiempo que ha pasado en el estado anterior
  const ahora = Date.now();
  const segundosTranscurridos = Math.floor((ahora - tiempoInicioEstado) / 1000);
  
  if (estadoApp === 'libre') segundosLibreHoy += segundosTranscurridos;
  if (estadoApp === 'ocupado') segundosOcupadoHoy += segundosTranscurridos;
  if (estadoApp === 'incidencia') segundosIncidenciaHoy += segundosTranscurridos;
  if (estadoApp === 'descanso') segundosDescansoHoy += segundosTranscurridos;
  if (estadoApp === 'fuera') segundosFueraHoy += segundosTranscurridos;

  // 2. Guardar en memoria (localStorage)
  const hoy = fechaLocalStr();
  safeStorage.set("uberCambioTiempoLibre_" + hoy, segundosLibreHoy);
  safeStorage.set("uberCambioTiempoOcupado_" + hoy, segundosOcupadoHoy);
  safeStorage.set("uberCambioTiempoIncidencia_" + hoy, segundosIncidenciaHoy);
  safeStorage.set("uberCambioTiempoDescanso_" + hoy, segundosDescansoHoy);
  safeStorage.set("uberCambioTiempoFuera_" + hoy, segundosFueraHoy);

  // 3. Cambiar al nuevo estado
  estadoApp = nuevoEstado;
  tiempoInicioEstado = ahora;
  safeStorage.set("uberCambioEstadoApp", estadoApp);

  mostrarToast("Estado cambiado a: " + estadoApp.toUpperCase());
  
  if(typeof actualizarBotonCochePrincipal === 'function') actualizarBotonCochePrincipal();
  if(typeof renderResumenJornada === 'function') renderResumenJornada();
}

/* ==================== CÁLCULOS DE LA JORNADA ==================== */

function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function calcularKmsTotales(fechaStr) {
  const claveMatched = "uberCambioRecorridoMatched_" + fechaStr;
  let puntosStr = safeStorage.get(claveMatched);
  let puntos = puntosStr ? JSON.parse(puntosStr) : obtenerRecorrido(fechaStr);
  
  let kms = 0;
  for (let i = 1; i < puntos.length; i++) {
    kms += calcularDistanciaKm(puntos[i-1].lat, puntos[i-1].lon, puntos[i].lat, puntos[i].lon);
  }
  return kms.toFixed(2);
}

function renderResumenJornada() {
  const box = document.getElementById("resumenJornadaBox");
  if(!box) return;

  const hoy = fechaLocalStr();
  const kms = calcularKmsTotales(hoy);
  
  let sLibre = segundosLibreHoy;
  let sOcupado = segundosOcupadoHoy;
  let sIncidencia = segundosIncidenciaHoy;
  let sDescanso = segundosDescansoHoy;
  let sFuera = segundosFueraHoy;
  
  const ahora = Date.now();
  const segundosActuales = Math.floor((ahora - tiempoInicioEstado) / 1000);
  
  if (estadoApp === 'libre') sLibre += segundosActuales;
  if (estadoApp === 'ocupado') sOcupado += segundosActuales;
  if (estadoApp === 'incidencia') sIncidencia += segundosActuales;
  if (estadoApp === 'descanso') sDescanso += segundosActuales;
  if (estadoApp === 'fuera') sFuera += segundosActuales;

  const formatTime = (totalSegs) => {
    const h = Math.floor(totalSegs / 3600);
    const m = Math.floor((totalSegs % 3600) / 60);
    return `${h}h ${m}m`;
  };

  // Cálculos de la jornada
  const totalEfectivas = sLibre + sOcupado;
  const totalJornada = totalEfectivas + sIncidencia + sDescanso + sFuera;

  box.innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
      <div style="background:#0f172a; border:1px solid #334155; border-radius:12px; padding:12px; text-align:center;">
        <div style="font-size:11px; color:#94a3b8; font-weight:800; margin-bottom:4px;">🛣️ KMS HOY</div>
        <div style="font-size:24px; color:#38bdf8; font-weight:900;">${kms} km</div>
      </div>
      <div style="background:#0f172a; border:1px solid #334155; border-radius:12px; padding:12px; text-align:center;">
        <div style="font-size:11px; color:#94a3b8; font-weight:800; margin-bottom:4px;">⏱️ JORNADA TOTAL</div>
        <div style="font-size:24px; color:#f8fafc; font-weight:900;">${formatTime(totalJornada)}</div>
      </div>
    </div>
    
    <div style="background:#0f172a; border:1px solid #334155; border-radius:12px; padding:12px; text-align:center; margin-bottom:8px;">
      <div style="font-size:11px; color:#94a3b8; font-weight:800; margin-bottom:4px;">💼 HORAS EFECTIVAS (Uber ON)</div>
      <div style="font-size:20px; color:#4ade80; font-weight:900;">${formatTime(totalEfectivas)}</div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
      <div style="background:#064e3b; border:1px solid #059669; border-radius:10px; padding:8px; text-align:center;">
        <div style="font-size:10px; color:#a7f3d0; font-weight:700;">LIBRE</div>
        <div style="font-size:14px; color:#fff; font-weight:900;">${formatTime(sLibre)}</div>
      </div>
      <div style="background:#7f1d1d; border:1px solid #ef4444; border-radius:10px; padding:8px; text-align:center;">
        <div style="font-size:10px; color:#fca5a5; font-weight:700;">OCUPADO</div>
        <div style="font-size:14px; color:#fff; font-weight:900;">${formatTime(sOcupado)}</div>
      </div>
    </div>
    
    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;">
      <div style="background:#78350f; border:1px solid #f59e0b; border-radius:10px; padding:8px; text-align:center;">
        <div style="font-size:10px; color:#fcd34d; font-weight:700;">INCIDENCIA</div>
        <div style="font-size:14px; color:#fff; font-weight:900;">${formatTime(sIncidencia)}</div>
      </div>
      <div style="background:#4c1d95; border:1px solid #a855f7; border-radius:10px; padding:8px; text-align:center;">
        <div style="font-size:10px; color:#d8b4fe; font-weight:700;">DESCANSO</div>
        <div style="font-size:14px; color:#fff; font-weight:900;">${formatTime(sDescanso)}</div>
      </div>
      <div style="background:#334155; border:1px solid #64748b; border-radius:10px; padding:8px; text-align:center;">
        <div style="font-size:10px; color:#cbd5e1; font-weight:700;">FUERA APP</div>
        <div style="font-size:14px; color:#fff; font-weight:900;">${formatTime(sFuera)}</div>
      </div>
    </div>
  `;
}

// Función que inyecta el botón de estado en la pantalla principal
function obtenerBotonEstadoHTML() {
  let color = "#475569", texto = "⚫ FUERA APP";
  if (estadoApp === 'libre') { color = "#10b981"; texto = "🟢 LIBRE"; }
  if (estadoApp === 'ocupado') { color = "#ef4444"; texto = "🔴 OCUPADO"; }
  if (estadoApp === 'incidencia') { color = "#f59e0b"; texto = "🟠 INCIDENCIA"; }
  if (estadoApp === 'descanso') { color = "#a855f7"; texto = "🟣 DESCANSO"; }

  return `
    <div onclick="abrirMenuEstado()" style="background:${color}; border:1px solid rgba(255,255,255,0.2); border-radius:20px; padding:6px 12px; display:inline-flex; align-items:center; gap:8px; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,0.3); transition:all 0.2s;">
      <span style="font-size:12px; font-weight:900; color:#fff; letter-spacing:0.5px;">${texto}</span>
    </div>`;
}

// Comprobador de cambio de día
setInterval(() => {
  const hoy = fechaLocalStr();
  if (hoy !== fechaJornadaActual) {
    fechaJornadaActual = hoy;
    segundosLibreHoy = parseInt(safeStorage.get("uberCambioTiempoLibre_" + hoy)) || 0;
    segundosOcupadoHoy = parseInt(safeStorage.get("uberCambioTiempoOcupado_" + hoy)) || 0;
    segundosIncidenciaHoy = parseInt(safeStorage.get("uberCambioTiempoIncidencia_" + hoy)) || 0;
    segundosDescansoHoy = parseInt(safeStorage.get("uberCambioTiempoDescanso_" + hoy)) || 0;
    segundosFueraHoy = parseInt(safeStorage.get("uberCambioTiempoFuera_" + hoy)) || 0;
  }
}, 60000);