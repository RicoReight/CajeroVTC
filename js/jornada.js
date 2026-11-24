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
  // Calculamos los tiempos totales actuales para mostrarlos en el menú
  let sLibre = segundosLibreHoy, sOcupado = segundosOcupadoHoy, sIncidencia = segundosIncidenciaHoy, sDescanso = segundosDescansoHoy, sFuera = segundosFueraHoy;
  const segsActuales = Math.floor((Date.now() - tiempoInicioEstado) / 1000);
  if (estadoApp === 'libre') sLibre += segsActuales;
  if (estadoApp === 'ocupado') sOcupado += segsActuales;
  if (estadoApp === 'incidencia') sIncidencia += segsActuales;
  if (estadoApp === 'descanso') sDescanso += segsActuales;
  if (estadoApp === 'fuera') sFuera += segsActuales;

  const formatT = (totalSegs) => {
    const h = Math.floor(totalSegs / 3600);
    const m = Math.floor((totalSegs % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const uberOn = sLibre + sOcupado;
  const jornadaTotal = uberOn + sIncidencia + sDescanso + sFuera;

  const m = document.createElement("div");
  m.id = "modalEstadoApp";
  m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;";
  
  m.innerHTML = `
    <div style="background:#1e293b;border-radius:16px;padding:20px;max-width:340px;width:100%;border:1px solid #334155;">
      
      <!-- MINI RESUMEN DEL DÍA -->
      <div style="background:#0f172a; border:1px solid #334155; border-radius:12px; padding:12px; margin-bottom:16px;">
        <div style="font-size:11px; color:#94a3b8; font-weight:800; text-align:center; margin-bottom:8px;">RESUMEN DE HOY</div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span style="font-size:12px; color:#f8fafc; font-weight:700;">💼 Uber ON:</span>
          <span style="font-size:12px; color:#4ade80; font-weight:900;">${formatT(uberOn)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span style="font-size:12px; color:#f8fafc; font-weight:700;">⚫ Fuera App:</span>
          <span style="font-size:12px; color:#94a3b8; font-weight:900;">${formatT(sFuera)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; border-top:1px solid #334155; padding-top:4px; margin-top:4px;">
          <span style="font-size:12px; color:#f8fafc; font-weight:800;">⏱️ Total Jornada:</span>
          <span style="font-size:12px; color:#38bdf8; font-weight:900;">${formatT(jornadaTotal)}</span>
        </div>
      </div>

      <div style="font-size:14px;font-weight:900;color:#fff;text-align:center;margin-bottom:12px;">CAMBIAR ESTADO</div>
      
      <button onclick="cambiarEstadoApp('libre')" style="width:100%;padding:14px;margin-bottom:8px;border-radius:10px;border:none;background:#10b981;color:#fff;font-weight:900;font-size:15px;cursor:pointer;box-shadow:0 4px 10px rgba(16,185,129,0.3);">🟢 LIBRE (Uber ON)</button>
      <button onclick="cambiarEstadoApp('ocupado')" style="width:100%;padding:14px;margin-bottom:8px;border-radius:10px;border:none;background:#ef4444;color:#fff;font-weight:900;font-size:15px;cursor:pointer;box-shadow:0 4px 10px rgba(239,68,68,0.3);">🔴 OCUPADO (Cliente)</button>
      <button onclick="cambiarEstadoApp('incidencia')" style="width:100%;padding:14px;margin-bottom:8px;border-radius:10px;border:none;background:#f59e0b;color:#fff;font-weight:900;font-size:15px;cursor:pointer;box-shadow:0 4px 10px rgba(245,158,11,0.3);">🟠 INCIDENCIA (Repostar)</button>
      <button onclick="cambiarEstadoApp('descanso')" style="width:100%;padding:14px;margin-bottom:8px;border-radius:10px;border:none;background:#a855f7;color:#fff;font-weight:900;font-size:15px;cursor:pointer;box-shadow:0 4px 10px rgba(168,85,247,0.3);">🟣 DESCANSO (Pausa)</button>
      <button onclick="cambiarEstadoApp('fuera')" style="width:100%;padding:14px;margin-bottom:16px;border-radius:10px;border:none;background:#475569;color:#fff;font-weight:900;font-size:15px;cursor:pointer;">⚫ FUERA DE LA APP (Extras)</button>
      
      <button onclick="document.getElementById('modalEstadoApp').remove()" style="width:100%;padding:12px;border-radius:10px;border:1px solid #475569;background:transparent;color:#94a3b8;font-weight:700;cursor:pointer;">Cancelar</button>
    </div>`;
  document.body.appendChild(m);
  m.addEventListener("click", e => { if(e.target === m) m.remove(); });
}

function guardarJornadaEnHistorial() {
  const hoy = fechaLocalStr();
  
  let sLibre = parseInt(safeStorage.get("uberCambioTiempoLibre_" + hoy)) || 0;
  let sOcupado = parseInt(safeStorage.get("uberCambioTiempoOcupado_" + hoy)) || 0;
  let sIncidencia = parseInt(safeStorage.get("uberCambioTiempoIncidencia_" + hoy)) || 0;
  let sDescanso = parseInt(safeStorage.get("uberCambioTiempoDescanso_" + hoy)) || 0;
  let sFuera = parseInt(safeStorage.get("uberCambioTiempoFuera_" + hoy)) || 0;

  let efectivoHoy = 0, propinasHoy = 0;
  try {
    const ops = loadHistorialOps() || [];
    ops.forEach(op => {
      if (op.fecha && op.fecha.startsWith(hoy)) {
        efectivoHoy += (op.precio || 0);
        propinasHoy += (op.propina || 0);
      }
    });
  } catch(e) {}

  const kms = typeof calcularKmsTotales === "function" ? calcularKmsTotales(hoy) : "0.00";
  const totalUberOn = sLibre + sOcupado;
  const totalJornada = totalUberOn + sIncidencia + sDescanso + sFuera;

  const registroHoy = {
    fecha: hoy,
    kms: parseFloat(kms),
    efectivo: efectivoHoy,
    propinas: propinasHoy,
    totalUberOn,
    totalJornada,
    sLibre, sOcupado, sIncidencia, sDescanso, sFuera
  };

  // Leemos el historial actual y lo guardamos
  let historial = [];
  try { historial = JSON.parse(safeStorage.get("uberCambioHistorialJornadas") || "[]"); } catch(e) {}
  
  // Si ya existe un registro de hoy, lo actualizamos (por si liberas el coche dos veces)
  const idx = historial.findIndex(h => h.fecha === hoy);
  if (idx >= 0) historial[idx] = registroHoy;
  else historial.push(registroHoy);

  // Borrado automático: mantenemos solo los últimos 31 días
  if (historial.length > 31) historial = historial.slice(-31);

  safeStorage.set("uberCambioHistorialJornadas", JSON.stringify(historial));
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

  // Calculamos el tiempo en vivo del estado actual
  let crono = "";
  if (estadoApp !== 'offline') {
    const segs = Math.floor((Date.now() - tiempoInicioEstado) / 1000);
    const h = Math.floor(segs / 3600).toString().padStart(2, '0');
    const m = Math.floor((segs % 3600) / 60).toString().padStart(2, '0');
    crono = ` · ${h}:${m}`;
  }

  return `
    <div onclick="abrirMenuEstado()" style="flex: 1; background:${color}; border:1px solid rgba(255,255,255,0.2); border-radius:20px; padding:6px 12px; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,0.3); transition:all 0.2s; min-width: 0;">
      <span style="font-size:12px; font-weight:900; color:#fff; letter-spacing:0.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${texto}${crono}</span>
    </div>`;
}

function iniciarJornada() {
  // Si estábamos offline, pasamos a "fuera" (o "libre" si lo prefieres)
  if(estadoApp === 'offline') {
    cambiarEstadoApp('fuera'); 
  }
  // Reiniciamos el contador para que cuente desde este preciso momento
  tiempoInicioEstado = Date.now();
  mostrarToast("⏱️ Jornada iniciada con el coche");
}

function detenerJornada() {
  // Pasamos a offline y cerramos el día
  if(estadoApp !== 'offline') {
    cambiarEstadoApp('offline');
    mostrarToast("🛑 Jornada finalizada");
  }
}

function mostrarResumenFinJornada() {
  guardarJornadaEnHistorial();  
  const hoy = fechaLocalStr();
  
  // 1. Leemos los tiempos directamente de la memoria para que no fallen
  let sLibre = parseInt(safeStorage.get("uberCambioTiempoLibre_" + hoy)) || segundosLibreHoy || 0;
  let sOcupado = parseInt(safeStorage.get("uberCambioTiempoOcupado_" + hoy)) || segundosOcupadoHoy || 0;
  let sIncidencia = parseInt(safeStorage.get("uberCambioTiempoIncidencia_" + hoy)) || segundosIncidenciaHoy || 0;
  let sDescanso = parseInt(safeStorage.get("uberCambioTiempoDescanso_" + hoy)) || segundosDescansoHoy || 0;
  let sFuera = parseInt(safeStorage.get("uberCambioTiempoFuera_" + hoy)) || segundosFueraHoy || 0;

  // 2. Buscamos el Efectivo y las Propinas del día de hoy en el historial de operaciones
  let efectivoHoy = 0;
  let propinasHoy = 0;
  try {
    const ops = loadHistorialOps() || [];
    ops.forEach(op => {
      if (op.fecha && op.fecha.startsWith(hoy)) {
        efectivoHoy += (op.precio || 0);
        propinasHoy += (op.propina || 0);
      }
    });
  } catch(e) { console.warn("No se pudo leer el historial", e); }

  const formatT = (totalSegs) => {
    const h = Math.floor(totalSegs / 3600);
    const m = Math.floor((totalSegs % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const totalUberOn = sLibre + sOcupado;
  const totalJornada = totalUberOn + sIncidencia + sDescanso + sFuera;
  const kms = typeof calcularKmsTotales === "function" ? calcularKmsTotales(hoy) : "0.00";

  // Si no ha pasado ni un minuto y no hay ganancias, no mostramos nada
  if (totalJornada < 60 && efectivoHoy === 0) {
    mostrarToast("No hay actividad suficiente para mostrar un resumen.");
    return;
  }

  const m = document.createElement("div");
  m.id = "modalFinJornada";
  m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;";
  
  m.innerHTML = `
    <div style="background:#1e293b;border-radius:16px;padding:22px;max-width:360px;width:100%;border:2px solid #3b82f6; box-shadow: 0 10px 40px rgba(0,0,0,0.5); max-height: 90vh; overflow-y: auto;">
      
      <div style="text-align:center; margin-bottom:16px;">
        <div style="font-size:36px; margin-bottom:8px;">🏁</div>
        <div style="font-size:18px; font-weight:900; color:#fff;">FIN DE JORNADA</div>
        <div style="font-size:13px; color:#94a3b8; margin-top:2px;">Resumen del día</div>
      </div>

      <!-- Bloque de Dinero -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
        <div style="background:#064e3b; border:1px solid #059669; border-radius:12px; padding:12px; text-align:center;">
          <div style="font-size:11px; color:#a7f3d0; font-weight:800; margin-bottom:4px;">💶 EFECTIVO</div>
          <div style="font-size:22px; color:#4ade80; font-weight:900;">${typeof moneyText === 'function' ? moneyText(efectivoHoy) : (efectivoHoy/100).toFixed(2)+'€'}</div>
        </div>
        <div style="background:#78350f; border:1px solid #f59e0b; border-radius:12px; padding:12px; text-align:center;">
          <div style="font-size:11px; color:#fcd34d; font-weight:800; margin-bottom:4px;">💶 PROPINAS</div>
          <div style="font-size:22px; color:#fbbf24; font-weight:900;">${typeof moneyText === 'function' ? moneyText(propinasHoy) : (propinasHoy/100).toFixed(2)+'€'}</div>
        </div>
      </div>

      <!-- Total Jornada -->
      <div style="background:#0f172a; border:1px solid #475569; border-radius:12px; padding:16px; text-align:center; margin-bottom:12px;">
        <div style="font-size:12px; color:#94a3b8; font-weight:800; margin-bottom:4px;">⏱️ JORNADA TOTAL</div>
        <div style="font-size:32px; color:#f8fafc; font-weight:900;">${formatT(totalJornada)}</div>
        <div style="font-size:11px; color:#38bdf8; font-weight:700; margin-top:4px;">🛣️ ${kms} km recorridos</div>
      </div>

      <!-- Horas Efectivas (Uber ON) -->
      <div style="background:#064e3b; border:1px solid #059669; border-radius:12px; padding:12px; text-align:center; margin-bottom:12px;">
        <div style="font-size:12px; color:#a7f3d0; font-weight:800; margin-bottom:4px;">💼 UBER ON (Efectivas)</div>
        <div style="font-size:20px; color:#4ade80; font-weight:900;">${formatT(totalUberOn)}</div>
      </div>

      <!-- Desglose detallado -->
      <div style="background:#1e293b; border:1px solid #334155; border-radius:12px; padding:12px; margin-bottom:16px;">
        <div style="font-size:11px; color:#94a3b8; font-weight:800; margin-bottom:8px; text-align:center;">DESGLOSE DE TIEMPOS</div>
        
        <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #334155;">
          <span style="font-size:13px; color:#4ade80; font-weight:700;">🟢 Libre</span>
          <span style="font-size:13px; color:#fff; font-weight:800;">${formatT(sLibre)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #334155;">
          <span style="font-size:13px; color:#f87171; font-weight:700;">🔴 Ocupado</span>
          <span style="font-size:13px; color:#fff; font-weight:800;">${formatT(sOcupado)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #334155;">
          <span style="font-size:13px; color:#fbbf24; font-weight:700;">🟠 Incidencia</span>
          <span style="font-size:13px; color:#fff; font-weight:800;">${formatT(sIncidencia)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #334155;">
          <span style="font-size:13px; color:#c084fc; font-weight:700;">🟣 Descanso</span>
          <span style="font-size:13px; color:#fff; font-weight:800;">${formatT(sDescanso)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; padding:4px 0;">
          <span style="font-size:13px; color:#94a3b8; font-weight:700;">⚫ Fuera App</span>
          <span style="font-size:13px; color:#fff; font-weight:800;">${formatT(sFuera)}</span>
        </div>
      </div>

      <button onclick="document.getElementById('modalFinJornada').remove()" style="width:100%;padding:14px;border-radius:10px;border:none;background:#3b82f6;color:#fff;font-weight:900;font-size:15px;cursor:pointer; box-shadow:0 4px 10px rgba(59,130,246,0.4);">ENTENDIDO</button>
    </div>`;
  document.body.appendChild(m);
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

// Actualizar el reloj del botón cada 10 segundos
setInterval(() => {
  if (typeof actualizarBotonCochePrincipal === 'function') {
    actualizarBotonCochePrincipal();
  }
}, 10000);

function abrirJornadaPantalla() {
  const p = document.getElementById("jornadaPantalla");
  if(p) p.style.display = "block";
  renderJornadaHistorial();
}

function cerrarJornadaPantalla() {
  const p = document.getElementById("jornadaPantalla");
  if(p) p.style.display = "none";
}

function renderJornadaHistorial() {
  const cont = document.getElementById("jornadaContenido");
  if(!cont) return;

  let historial = [];
  try { historial = JSON.parse(safeStorage.get("uberCambioHistorialJornadas") || "[]"); } catch(e) {}

  let html = `<div style="text-align:center;margin-bottom:16px;">
    <div style="font-size:32px;margin-bottom:8px;">📅</div>
    <div style="font-size:16px;font-weight:900;color:#fff;">HISTORIAL DE JORNADAS</div>
    <div style="font-size:12px;color:#94a3b8;">Se guardan los últimos 31 días</div>
  </div>`;

  if (historial.length === 0) {
    html += `<div style="text-align:center;color:#64748b;font-size:14px;padding:20px;background:#1e293b;border-radius:12px;">Aún no hay jornadas guardadas.<br>Libera el coche para guardar tu primer día.</div>`;
  } else {
    // Ordenar del más reciente al más antiguo
    historial.sort((a,b) => b.fecha.localeCompare(a.fecha));

    const formatT = (segs) => {
      const h = Math.floor(segs / 3600);
      const m = Math.floor((segs % 3600) / 60);
      return `${h}h ${m}m`;
    };

    historial.forEach(dia => {
      const p = dia.fecha.split("-");
      const fechaBonita = `${p[2]}/${p[1]}/${p[0]}`;
      
      html += `
      <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:14px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="font-size:15px;font-weight:900;color:#38bdf8;">📅 ${fechaBonita}</div>
          <div style="font-size:13px;font-weight:800;color:#4ade80;background:#064e3b;padding:4px 8px;border-radius:6px;">🛣️ ${dia.kms} km</div>
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
          <div style="background:#0f172a;padding:8px;border-radius:8px;text-align:center;">
            <div style="font-size:10px;color:#94a3b8;font-weight:700;">EFECTIVO</div>
            <div style="font-size:16px;color:#fff;font-weight:900;">${moneyText(dia.efectivo)}</div>
          </div>
          <div style="background:#0f172a;padding:8px;border-radius:8px;text-align:center;">
            <div style="font-size:10px;color:#94a3b8;font-weight:700;">PROPINAS</div>
            <div style="font-size:16px;color:#fbbf24;font-weight:900;">${moneyText(dia.propinas)}</div>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;padding:4px 0;border-top:1px solid #334155;">
          <span style="font-size:12px;color:#4ade80;font-weight:700;">💼 Uber ON:</span>
          <span style="font-size:12px;color:#fff;font-weight:800;">${formatT(dia.totalUberOn)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;">
          <span style="font-size:12px;color:#fbbf24;font-weight:700;">🟠 Incidencia:</span>
          <span style="font-size:12px;color:#fff;font-weight:800;">${formatT(dia.sIncidencia)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;">
          <span style="font-size:12px;color:#94a3b8;font-weight:700;">⚫ Fuera App:</span>
          <span style="font-size:12px;color:#fff;font-weight:800;">${formatT(dia.sFuera)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-top:1px solid #334155;margin-top:4px;">
          <span style="font-size:13px;color:#38bdf8;font-weight:800;">⏱️ TOTAL JORNADA:</span>
          <span style="font-size:13px;color:#38bdf8;font-weight:900;">${formatT(dia.totalJornada)}</span>
        </div>
      </div>`;
    });

    html += `<button onclick="if(confirm('¿Borrar todo el historial de jornadas?')){ safeStorage.set('uberCambioHistorialJornadas', '[]'); renderJornadaHistorial(); }" style="width:100%;padding:12px;border-radius:10px;border:none;background:#7f1d1d;color:#fca5a5;font-weight:800;font-size:14px;cursor:pointer;margin-bottom:12px;">🗑️ Borrar historial completo</button>`;
  }

  html += `<button onclick="cerrarJornadaPantalla()" style="width:100%;padding:14px;border-radius:10px;border:none;background:#334155;color:#fff;font-weight:900;font-size:15px;cursor:pointer;">✖ Volver</button>`;

  cont.innerHTML = html;
}