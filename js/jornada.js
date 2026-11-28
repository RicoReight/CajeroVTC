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

// Variables para los avisos de 6h y 30m
let tiempoInicioTramoContinuo = parseInt(safeStorage.get("uberCambioTramoContinuoStart")) || Date.now();
let notificado6h = safeStorage.get("uberCambioNotificado6h") === "1";
let notificadoDescanso30m = safeStorage.get("uberCambioNotificadoDescanso30m") === "1";

/* ==================== NOTIFICACIONES NATIVAS CON BOTONES ==================== */
async function lanzarNotificacionJornada(title, body, actions = []) {
  try {
    const Cap = window.Capacitor;
    if(!Cap || !Cap.Plugins || !Cap.Plugins.LocalNotifications) return;
    const LN = Cap.Plugins.LocalNotifications;
    
    const notif = {
      id: new Date().getTime() % 100000,
      title: title,
      body: body,
      channelId: 'recordatorios-alta',
      smallIcon: 'ic_stat_icon_config_sample',
      schedule: { at: new Date(Date.now() + 1000) }
    };

    if(actions && actions.length > 0) {
      notif.actions = actions;
    }

    await LN.schedule({ notifications: [notif] });
  } catch(e) { console.warn('Error notificacion jornada:', e); }
}

// Escuchar cuando el usuario pulsa un botón de la notificación
try {
  const Cap = window.Capacitor;
  if (Cap && Cap.Plugins && Cap.Plugins.LocalNotifications) {
    Cap.Plugins.LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
      if (notification.actionId === 'libre') {
        cambiarEstadoApp('libre');
        if(typeof mostrarToast === 'function') mostrarToast("🟢 Estado cambiado desde notificación: LIBRE");
      } else if (notification.actionId === 'fuera') {
        cambiarEstadoApp('fuera');
        if(typeof mostrarToast === 'function') mostrarToast("⚫ Estado cambiado desde notificación: FUERA APP");
      }
    });
  }
} catch(e) { console.warn("Listener de notificaciones no disponible", e); }

/* ==================== CONTROL DE ESTADOS ==================== */

function abrirMenuEstado() {
  let drawer = document.getElementById("drawerEstado");
  let overlay = document.getElementById("overlayEstado");

  // Si no existe, lo creamos
  if (!drawer) {
    overlay = document.createElement("div");
    overlay.id = "overlayEstado";
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99998;display:none;opacity:0;transition:opacity 0.3s;";
    overlay.onclick = cerrarMenuEstado;
    document.body.appendChild(overlay);

    drawer = document.createElement("div");
    drawer.id = "drawerEstado";
    drawer.style.cssText = "position:fixed;top:0;left:0;bottom:0;width:85%;max-width:340px;background:#1e293b;z-index:99999;transform:translateX(-100%);transition:transform 0.3s ease-in-out;display:flex;flex-direction:column;box-shadow:2px 0 10px rgba(0,0,0,0.5);";
    document.body.appendChild(drawer);
  }

  // Calculamos los tiempos
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

  const horasApp = sLibre + sOcupado;
  const jornadaTotal = horasApp + sIncidencia + sFuera;

  drawer.innerHTML = `
    <div style="padding:20px; border-bottom:1px solid #334155; display:flex; justify-content:space-between; align-items:center; background:#0f172a;">
      <div style="font-size:16px;font-weight:900;color:#fff;">ESTADO DE LA JORNADA</div>
      <button onclick="cerrarMenuEstado()" style="background:none;border:none;color:#94a3b8;font-size:24px;cursor:pointer;">✕</button>
    </div>
    
    <div style="padding:20px; overflow-y:auto; flex:1;">
      <div style="background:#0f172a; border:1px solid #334155; border-radius:12px; padding:12px; margin-bottom:20px;">
        <div style="font-size:11px; color:#94a3b8; font-weight:800; text-align:center; margin-bottom:8px;">RESUMEN DE HOY</div>
        
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span style="font-size:12px; color:#4ade80; font-weight:700;">🟢 Libre:</span><span style="font-size:12px; color:#fff; font-weight:900;">${formatT(sLibre)}</span></div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span style="font-size:12px; color:#f87171; font-weight:700;">🔴 Ocupado:</span><span style="font-size:12px; color:#fff; font-weight:900;">${formatT(sOcupado)}</span></div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span style="font-size:12px; color:#fbbf24; font-weight:700;">🟠 Incidencia:</span><span style="font-size:12px; color:#fff; font-weight:900;">${formatT(sIncidencia)}</span></div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span style="font-size:12px; color:#c084fc; font-weight:700;">🟣 Descanso:</span><span style="font-size:12px; color:#fff; font-weight:900;">${formatT(sDescanso)}</span></div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span style="font-size:12px; color:#94a3b8; font-weight:700;">⚫ Fuera App:</span><span style="font-size:12px; color:#fff; font-weight:900;">${formatT(sFuera)}</span></div>

        <div style="display:flex; justify-content:space-between; border-top:1px solid #334155; padding-top:6px; margin-top:6px;">
          <span style="font-size:12px; color:#38bdf8; font-weight:800;">💼 Horas APP:</span>
          <span style="font-size:12px; color:#38bdf8; font-weight:900;">${formatT(horasApp)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-top:4px;">
          <span style="font-size:12px; color:#e2e8f0; font-weight:800;">⏱️ Total Jornada:</span>
          <span style="font-size:12px; color:#e2e8f0; font-weight:900;">${formatT(jornadaTotal)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-top:6px; padding-top:6px; border-top:1px dashed #334155;">
          <span style="font-size:12px; color:#c084fc; font-weight:800;">🟣 Descanso:</span>
          <span style="font-size:12px; color:#c084fc; font-weight:900;">${formatT(sDescanso)}</span>
        </div>
      </div>

      <div style="font-size:14px;font-weight:900;color:#fff;text-align:center;margin-bottom:12px;">CAMBIAR ESTADO</div>
      
      <button onclick="cambiarEstadoApp('libre')" style="width:100%;padding:14px;margin-bottom:8px;border-radius:10px;border:none;background:#10b981;color:#fff;font-weight:900;font-size:15px;cursor:pointer;box-shadow:0 4px 10px rgba(16,185,129,0.3);">🟢 LIBRE (APP ON)</button>
      <button onclick="cambiarEstadoApp('ocupado')" style="width:100%;padding:14px;margin-bottom:8px;border-radius:10px;border:none;background:#ef4444;color:#fff;font-weight:900;font-size:15px;cursor:pointer;box-shadow:0 4px 10px rgba(239,68,68,0.3);">🔴 OCUPADO (Cliente)</button>
      <button onclick="cambiarEstadoApp('incidencia')" style="width:100%;padding:14px;margin-bottom:8px;border-radius:10px;border:none;background:#f59e0b;color:#fff;font-weight:900;font-size:15px;cursor:pointer;box-shadow:0 4px 10px rgba(245,158,11,0.3);">🟠 INCIDENCIA (Repostar)</button>
      <button onclick="cambiarEstadoApp('descanso')" style="width:100%;padding:14px;margin-bottom:8px;border-radius:10px;border:none;background:#a855f7;color:#fff;font-weight:900;font-size:15px;cursor:pointer;box-shadow:0 4px 10px rgba(168,85,247,0.3);">🟣 DESCANSO (Pausa)</button>
      <button onclick="cambiarEstadoApp('fuera')" style="width:100%;padding:14px;margin-bottom:16px;border-radius:10px;border:none;background:#475569;color:#fff;font-weight:900;font-size:15px;cursor:pointer;">⚫ FUERA DE LA APP (Extras)</button>
    </div>
  `;

  // Animación de apertura
  overlay.style.display = "block";
  setTimeout(() => { overlay.style.opacity = "1"; drawer.style.transform = "translateX(0)"; }, 10);
}

function cerrarMenuEstado() {
  const drawer = document.getElementById("drawerEstado");
  const overlay = document.getElementById("overlayEstado");
  if (drawer && overlay) {
    drawer.style.transform = "translateX(-100%)";
    overlay.style.opacity = "0";
    setTimeout(() => { overlay.style.display = "none"; }, 300);
  }
}

function calcularDistanciaAproxMetros(lat1, lon1, lat2, lon2) {
  const R = 6371e3; 
  const phi1 = lat1 * Math.PI/180;
  const phi2 = lat2 * Math.PI/180;
  const deltaPhi = (lat2-lat1) * Math.PI/180;
  const deltaLambda = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; 
}

function contarViajesDia(fechaStr) {
  try {
    const marcadores = JSON.parse(safeStorage.get("uberCambioMarcadoresViajes") || "{}");
    if (marcadores[fechaStr]) {
      return marcadores[fechaStr].filter(m => m.tipo === 'A').length;
    }
  } catch(e) {}
  return 0;
}

function cambiarEstadoApp(nuevoEstado) {
  cerrarMenuEstado();
  
  if(estadoApp === nuevoEstado) {
    if (nuevoEstado === 'ocupado' && typeof ultimaPosicion !== 'undefined' && ultimaPosicion) {
      const hoy = fechaLocalStr();
      let marcadores = {};
      try { marcadores = JSON.parse(safeStorage.get("uberCambioMarcadoresViajes") || "{}"); } catch(e){}
      if(!marcadores[hoy]) marcadores[hoy] = [];
      marcadores[hoy].push({ lat: ultimaPosicion.lat, lon: ultimaPosicion.lon, tipo: 'A', time: Date.now() });
      safeStorage.set("uberCambioMarcadoresViajes", JSON.stringify(marcadores));
      mostrarToast("🔄 Nuevo cliente en el mismo sitio");
      if(typeof renderResumenJornada === 'function') renderResumenJornada();
      if(typeof actualizarMapaVisual === 'function') actualizarMapaVisual();
    }
    return; 
  }

  if(typeof ultimaPosicion !== 'undefined' && ultimaPosicion) {
    const hoy = fechaLocalStr();
    let marcadores = {};
    try { marcadores = JSON.parse(safeStorage.get("uberCambioMarcadoresViajes") || "{}"); } catch(e){}
    if(!marcadores[hoy]) marcadores[hoy] = [];

    if (nuevoEstado === 'ocupado' && estadoApp !== 'ocupado') {
      let esMismoSitio = false;
      if (marcadores[hoy].length > 0) {
        const ultimo = marcadores[hoy][marcadores[hoy].length - 1];
        if (ultimo.tipo === 'B') {
          const dist = calcularDistanciaAproxMetros(ultimaPosicion.lat, ultimaPosicion.lon, ultimo.lat, ultimo.lon);
          if (dist < 50) esMismoSitio = true; 
        }
      }
      if (esMismoSitio) {
        marcadores[hoy][marcadores[hoy].length - 1].tipo = 'A';
        marcadores[hoy][marcadores[hoy].length - 1].time = Date.now(); 
        mostrarToast("📍 Mismo punto: Unificando recogida");
      } else {
        marcadores[hoy].push({ lat: ultimaPosicion.lat, lon: ultimaPosicion.lon, tipo: 'A', time: Date.now() });
      }
      safeStorage.set("uberCambioMarcadoresViajes", JSON.stringify(marcadores));
    }

    if (estadoApp === 'ocupado' && nuevoEstado !== 'ocupado') {
      marcadores[hoy].push({ lat: ultimaPosicion.lat, lon: ultimaPosicion.lon, tipo: 'B', time: Date.now() });
      safeStorage.set("uberCambioMarcadoresViajes", JSON.stringify(marcadores));
    }

    // 👇 NUEVO: Guardar punto de Descanso (D) AL SALIR del descanso (donde has aparcado) 👇
    if (estadoApp === 'descanso' && nuevoEstado !== 'descanso') {
      marcadores[hoy].push({ lat: ultimaPosicion.lat, lon: ultimaPosicion.lon, tipo: 'D', time: Date.now() });
      safeStorage.set("uberCambioMarcadoresViajes", JSON.stringify(marcadores));
    }
    // Lo mismo para Incidencia (Repostar)
    if (estadoApp === 'incidencia' && nuevoEstado !== 'incidencia') {
      // 👇 Solo guardamos el punto si ha durado MÁS de 10 minutos (600 segundos)
      const duracion = Math.floor((Date.now() - tiempoInicioEstado) / 1000);
      if (duracion >= 600) {
        marcadores[hoy].push({ lat: ultimaPosicion.lat, lon: ultimaPosicion.lon, tipo: 'I', time: Date.now() });
        safeStorage.set("uberCambioMarcadoresViajes", JSON.stringify(marcadores));
      }
    }
  }

  const ahora = Date.now();
  const segundosTranscurridos = Math.floor((ahora - tiempoInicioEstado) / 1000);
  
  if (estadoApp === 'libre') segundosLibreHoy += segundosTranscurridos;
  if (estadoApp === 'ocupado') segundosOcupadoHoy += segundosTranscurridos;
  if (estadoApp === 'incidencia') segundosIncidenciaHoy += segundosTranscurridos;
  if (estadoApp === 'descanso') segundosDescansoHoy += segundosTranscurridos;
  if (estadoApp === 'fuera') segundosFueraHoy += segundosTranscurridos;

  const hoy = fechaLocalStr();
  safeStorage.set("uberCambioTiempoLibre_" + hoy, segundosLibreHoy);
  safeStorage.set("uberCambioTiempoOcupado_" + hoy, segundosOcupadoHoy);
  safeStorage.set("uberCambioTiempoIncidencia_" + hoy, segundosIncidenciaHoy);
  safeStorage.set("uberCambioTiempoDescanso_" + hoy, segundosDescansoHoy);
  safeStorage.set("uberCambioTiempoFuera_" + hoy, segundosFueraHoy);

  if (nuevoEstado === 'descanso') {
    tiempoInicioTramoContinuo = Date.now();
    notificado6h = false;
    notificadoDescanso30m = false;
  } else if (nuevoEstado === 'offline' || nuevoEstado === 'fuera') {
    tiempoInicioTramoContinuo = Date.now();
    notificado6h = false;
  } else if (nuevoEstado === 'libre' || nuevoEstado === 'ocupado') {
    if (estadoApp === 'descanso' || estadoApp === 'offline' || estadoApp === 'fuera') {
      tiempoInicioTramoContinuo = Date.now();
      notificado6h = false;
    }
    notificadoDescanso30m = false;
  }
  
  safeStorage.set("uberCambioTramoContinuoStart", tiempoInicioTramoContinuo);
  safeStorage.set("uberCambioNotificado6h", notificado6h ? "1" : "0");
  safeStorage.set("uberCambioNotificadoDescanso30m", notificadoDescanso30m ? "1" : "0");

  estadoApp = nuevoEstado;
  tiempoInicioEstado = ahora;
  safeStorage.set("uberCambioEstadoApp", estadoApp);

  mostrarToast("Estado cambiado a: " + estadoApp.toUpperCase());
  
  if(typeof actualizarBotonCochePrincipal === 'function') actualizarBotonCochePrincipal();
  if(typeof renderResumenJornada === 'function') renderResumenJornada();
  if(typeof actualizarMapaVisual === 'function') actualizarMapaVisual();
  if(typeof guardarJornadaEnHistorial === 'function') guardarJornadaEnHistorial();
}

/* ==================== VIGILANTE DE AVISOS (Se ejecuta cada minuto) ==================== */
setInterval(() => {
  const ahora = Date.now();
  
  // 1. Aviso de 15 min antes de las 6 Horas
  if ((estadoApp === 'libre' || estadoApp === 'ocupado') && !notificado6h) {
    const diffHoras = (ahora - tiempoInicioTramoContinuo) / (1000 * 60 * 60);
    
    if (diffHoras >= 5.75) { // 5 horas y 45 minutos (15 min antes de las 6h)
      notificado6h = true;
      safeStorage.set("uberCambioNotificado6h", "1");
      
      const acciones = [
        { id: 'libre', title: '🟢 Modo Libre' },
        { id: 'fuera', title: '⚫ Fuera APP' }
      ];

      if (estadoApp === 'ocupado') {
        lanzarNotificacionJornada("⚠️ Recuerda descansar", "Estás a punto de llegar a las 6 horas. Recuerda hacer descanso después de este viaje.", acciones);
      } else {
        lanzarNotificacionJornada("⏰ Te quedan 15 minutos", "Llevas casi 6 horas seguidas. Por favor, activa el modo Descanso para cumplir con la normativa.", acciones);
      }
    }
  }
  
  // 2. Aviso de 30 minutos de Descanso
  if (estadoApp === 'descanso' && !notificadoDescanso30m) {
    const diffMinutos = (ahora - tiempoInicioEstado) / (1000 * 60);
    
    if (diffMinutos >= 30) {
      notificadoDescanso30m = true;
      safeStorage.set("uberCambioNotificadoDescanso30m", "1");
      
      const acciones = [
        { id: 'libre', title: '🟢 Volver a trabajar' },
        { id: 'fuera', title: '⚫ Fuera APP' }
      ];
      
      lanzarNotificacionJornada("☕ Descanso Completado", "Has descansado 30 minutos. ¡Recuerda volver a activar la APP!", acciones);
    }
  }
}, 60000);

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
  const viajes = contarViajesDia(hoy);
  
  let sLibre = segundosLibreHoy, sOcupado = segundosOcupadoHoy, sIncidencia = segundosIncidenciaHoy, sDescanso = segundosDescansoHoy, sFuera = segundosFueraHoy;
  const segsActuales = Math.floor((Date.now() - tiempoInicioEstado) / 1000);
  
  if (estadoApp === 'libre') sLibre += segsActuales;
  if (estadoApp === 'ocupado') sOcupado += segsActuales;
  if (estadoApp === 'incidencia') sIncidencia += segsActuales;
  if (estadoApp === 'descanso') sDescanso += segsActuales;
  if (estadoApp === 'fuera') sFuera += segsActuales;

  const formatTime = (totalSegs) => {
    const h = Math.floor(totalSegs / 3600);
    const m = Math.floor((totalSegs % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const totalApp = sLibre + sOcupado;

  box.innerHTML = `
    <div style="background:#1e3a8a; border:1px solid #3b82f6; border-radius:20px; padding:6px 14px; display:inline-flex; align-items:center; gap:12px; box-shadow:0 2px 8px rgba(59,130,246,0.3);">
      <div style="display:flex; align-items:center; gap:6px;">
        <span style="font-size:14px;">🛣️</span>
        <span style="font-size:14px; font-weight:900; color:#fff; letter-spacing:0.5px;">${kms} km</span>
      </div>
      <div style="width:1px; height:16px; background:#3b82f6;"></div>
      <div style="display:flex; align-items:center; gap:6px;">
        <span style="font-size:14px;">💼</span>
        <span style="font-size:14px; font-weight:900; color:#fff; letter-spacing:0.5px;">${formatTime(totalApp)}</span>
      </div>
      <div style="width:1px; height:16px; background:#3b82f6;"></div>
      <div style="display:flex; align-items:center; gap:6px;">
        <span style="font-size:14px;">📍</span>
        <span style="font-size:14px; font-weight:900; color:#fff; letter-spacing:0.5px;">${viajes}</span>
      </div>
    </div>
  `;
}

function obtenerBotonEstadoHTML() {
  let color = "#475569", texto = "⚫ FUERA APP", colorFondo = "linear-gradient(135deg, #334155, #1e293b)";
  if (estadoApp === 'libre') { texto = "🟢 LIBRE"; colorFondo = "linear-gradient(135deg, #10b981, #059669)"; }
  if (estadoApp === 'ocupado') { texto = "🔴 OCUPADO"; colorFondo = "linear-gradient(135deg, #ef4444, #dc2626)"; }
  if (estadoApp === 'incidencia') { texto = "🟠 INCIDENCIA"; colorFondo = "linear-gradient(135deg, #f59e0b, #d97706)"; }
  if (estadoApp === 'descanso') { texto = "🟣 DESCANSO"; colorFondo = "linear-gradient(135deg, #a855f7, #7e22ce)"; }

  let crono = "00:00";
  const tieneCoche = (typeof cocheActual !== 'undefined' && cocheActual);
  
  if (estadoApp !== 'offline' && tieneCoche) {
    const segs = Math.floor((Date.now() - tiempoInicioEstado) / 1000);
    const h = Math.floor(segs / 3600).toString().padStart(2, '0');
    const m = Math.floor((segs % 3600) / 60).toString().padStart(2, '0');
    crono = `${h}:${m}`; 
  }

  // 👇 INFO EXTRA: Cuánto queda para las 6 horas o último estado 👇
  let infoExtra = "Pulsa aquí para cambiar de estado";
  
  if (estadoApp === 'libre' || estadoApp === 'ocupado') {
    const ahora = Date.now();
    const tiempoTrabajadoContinuo = (ahora - tiempoInicioTramoContinuo) / 1000;
    const restante6h = (6 * 3600) - tiempoTrabajadoContinuo;
    
    if (restante6h > 0) {
      const rh = Math.floor(restante6h / 3600);
      const rm = Math.floor((restante6h % 3600) / 60);
      infoExtra = `⏳ Te quedan ${rh}h ${rm}m para el descanso obligatorio`;
    } else {
      infoExtra = `⚠️ ¡Has superado las 6h! Deberías descansar.`;
    }
  } else if (estadoApp === 'descanso') {
    infoExtra = `☕ Aprovecha para estirar las piernas`;
  } else if (estadoApp === 'fuera') {
    infoExtra = `🚗 Limpiando, repostando o en la base`;
  }

  return `
    <div onclick="abrirMenuEstado()" style="width: 100%; background: ${colorFondo}; border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; padding: 12px 16px; display: flex; flex-direction: column; gap: 4px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: all 0.2s; min-width: 0;">
      
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <span style="font-size: 16px; font-weight: 900; color: #fff; letter-spacing: 0.5px; white-space: nowrap;">${texto}</span>
        <span style="font-size: 18px; font-weight: 900; color: #fff; font-variant-numeric: tabular-nums; background: rgba(0,0,0,0.2); padding: 2px 8px; border-radius: 8px;">${crono}</span>
      </div>
      
      <div style="font-size: 11px; color: rgba(255,255,255,0.9); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left;">
        ${infoExtra}
      </div>

    </div>`;
}

setInterval(() => {
  if (typeof actualizarBotonCochePrincipal === 'function') actualizarBotonCochePrincipal();
}, 10000);

function iniciarJornada() {
  if(estadoApp === 'offline') { cambiarEstadoApp('fuera'); }
  tiempoInicioEstado = Date.now();
  mostrarToast("⏱️ Jornada iniciada con el coche");

  notificado6h40m = false;
  safeStorage.set("uberCambioNotificado6h40m", "0");

  notificadoFinJornada = false;
  safeStorage.set("uberCambioNotificadoFinJornada", "0");
}

function detenerJornada() {
  if(estadoApp !== 'offline') {
    const ahora = Date.now();
    const segundosTranscurridos = Math.floor((ahora - tiempoInicioEstado) / 1000);
    if (estadoApp === 'libre') segundosLibreHoy += segundosTranscurridos;
    if (estadoApp === 'ocupado') segundosOcupadoHoy += segundosTranscurridos;
    if (estadoApp === 'incidencia') segundosIncidenciaHoy += segundosTranscurridos;
    if (estadoApp === 'descanso') segundosDescansoHoy += segundosTranscurridos;
    if (estadoApp === 'fuera') segundosFueraHoy += segundosTranscurridos;

    const hoy = fechaLocalStr();
    safeStorage.set("uberCambioTiempoLibre_" + hoy, segundosLibreHoy);
    safeStorage.set("uberCambioTiempoOcupado_" + hoy, segundosOcupadoHoy);
    safeStorage.set("uberCambioTiempoIncidencia_" + hoy, segundosIncidenciaHoy);
    safeStorage.set("uberCambioTiempoDescanso_" + hoy, segundosDescansoHoy);
    safeStorage.set("uberCambioTiempoFuera_" + hoy, segundosFueraHoy);

    estadoApp = 'offline';
    safeStorage.set("uberCambioEstadoApp", estadoApp);
    if(typeof actualizarBotonCochePrincipal === 'function') actualizarBotonCochePrincipal();
    mostrarToast("🛑 Jornada finalizada");
    setTimeout(() => { mostrarResumenFinJornada(); }, 500);
    notificado6h40m = false;
    safeStorage.set("uberCambioNotificado6h40m", "0");

    notificadoFinJornada = false;
    safeStorage.set("uberCambioNotificadoFinJornada", "0");
  }
}

function guardarJornadaEnHistorial() {
  try {
    const hoy = fechaLocalStr();
    let sLibre = parseInt(safeStorage.get("uberCambioTiempoLibre_" + hoy)) || 0;
    let sOcupado = parseInt(safeStorage.get("uberCambioTiempoOcupado_" + hoy)) || 0;
    let sIncidencia = parseInt(safeStorage.get("uberCambioTiempoIncidencia_" + hoy)) || 0;
    let sDescanso = parseInt(safeStorage.get("uberCambioTiempoDescanso_" + hoy)) || 0;
    let sFuera = parseInt(safeStorage.get("uberCambioTiempoFuera_" + hoy)) || 0;

    let efectivoHoy = 0, propinasHoy = 0;
    try {
      const ops = (typeof loadHistorialOps === 'function') ? loadHistorialOps() : [];
      if (Array.isArray(ops)) {
        ops.forEach(op => {
          if (op && op.fecha && op.fecha.startsWith(hoy)) {
            efectivoHoy += (op.precio || 0);
            propinasHoy += (op.propina || 0);
          }
        });
      }
    } catch(e) {}

    const kms = (typeof calcularKmsTotales === "function") ? calcularKmsTotales(hoy) : "0.00";
    const viajes = (typeof contarViajesDia === "function") ? contarViajesDia(hoy) : 0; // 👈 NUEVO
    const totalHorasApp = sLibre + sOcupado;
    const totalJornada = totalHorasApp + sIncidencia + sFuera;

    const registroHoy = {
      fecha: hoy, 
      kms: parseFloat(kms), 
      viajes: viajes, // 👈 NUEVO
      efectivo: efectivoHoy, 
      propinas: propinasHoy,
      totalUberOn: totalHorasApp, 
      totalJornada, 
      sLibre, sOcupado, sIncidencia, sDescanso, sFuera
    };

    let historial = [];
    try { const raw = safeStorage.get("uberCambioHistorialJornadas"); const parsed = raw ? JSON.parse(raw) : []; if (Array.isArray(parsed)) historial = parsed; } catch(e) {}
    
    const idx = historial.findIndex(h => h && h.fecha === hoy);
    if (idx >= 0) historial[idx] = registroHoy; else historial.push(registroHoy);
    if (historial.length > 31) historial = historial.slice(-31);
    safeStorage.set("uberCambioHistorialJornadas", JSON.stringify(historial));
  } catch(err) { console.error("Error al guardar jornada:", err); }
}

function mostrarResumenFinJornada() {
  guardarJornadaEnHistorial();
  const hoy = fechaLocalStr();
  let sLibre = parseInt(safeStorage.get("uberCambioTiempoLibre_" + hoy)) || segundosLibreHoy || 0;
  let sOcupado = parseInt(safeStorage.get("uberCambioTiempoOcupado_" + hoy)) || segundosOcupadoHoy || 0;
  let sIncidencia = parseInt(safeStorage.get("uberCambioTiempoIncidencia_" + hoy)) || segundosIncidenciaHoy || 0;
  let sDescanso = parseInt(safeStorage.get("uberCambioTiempoDescanso_" + hoy)) || segundosDescansoHoy || 0;
  let sFuera = parseInt(safeStorage.get("uberCambioTiempoFuera_" + hoy)) || segundosFueraHoy || 0;

  let efectivoHoy = 0, propinasHoy = 0;
  try { const ops = loadHistorialOps() || []; ops.forEach(op => { if (op.fecha && op.fecha.startsWith(hoy)) { efectivoHoy += (op.precio || 0); propinasHoy += (op.propina || 0); } }); } catch(e) {}

  const formatT = (segs) => `${Math.floor(segs / 3600)}h ${Math.floor((segs % 3600) / 60)}m`;
  const totalHorasApp = sLibre + sOcupado;
  const totalJornada = totalHorasApp + sIncidencia + sFuera;
  const kms = typeof calcularKmsTotales === "function" ? calcularKmsTotales(hoy) : "0.00";

  if (totalJornada < 60 && efectivoHoy === 0) { mostrarToast("No hay actividad suficiente."); return; }

  const m = document.createElement("div");
  m.id = "modalFinJornada";
  m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;";
  m.innerHTML = `
    <div style="background:#1e293b;border-radius:16px;padding:22px;max-width:360px;width:100%;border:2px solid #3b82f6; box-shadow: 0 10px 40px rgba(0,0,0,0.5); max-height: 90vh; overflow-y: auto;">
      <div style="text-align:center; margin-bottom:16px;">
        <div style="font-size:36px; margin-bottom:8px;">🏁</div>
        <div style="font-size:18px; font-weight:900; color:#fff;">FIN DE JORNADA</div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
        <div style="background:#064e3b; border:1px solid #059669; border-radius:12px; padding:12px; text-align:center;">
          <div style="font-size:11px; color:#a7f3d0; font-weight:800; margin-bottom:4px;">💶 EFECTIVO</div>
          <div style="font-size:22px; color:#4ade80; font-weight:900;">${typeof moneyText === 'function' ? moneyText(efectivoHoy) : efectivoHoy}</div>
        </div>
        <div style="background:#78350f; border:1px solid #f59e0b; border-radius:12px; padding:12px; text-align:center;">
          <div style="font-size:11px; color:#fcd34d; font-weight:800; margin-bottom:4px;">💶 PROPINAS</div>
          <div style="font-size:22px; color:#fbbf24; font-weight:900;">${typeof moneyText === 'function' ? moneyText(propinasHoy) : propinasHoy}</div>
        </div>
      </div>
      <div style="background:#0f172a; border:1px solid #475569; border-radius:12px; padding:16px; text-align:center; margin-bottom:12px;">
        <div style="font-size:12px; color:#94a3b8; font-weight:800; margin-bottom:4px;">⏱️ JORNADA TOTAL</div>
        <div style="font-size:32px; color:#f8fafc; font-weight:900;">${formatT(totalJornada)}</div>
        <div style="font-size:11px; color:#38bdf8; font-weight:700; margin-top:4px;">🛣️ ${kms} km · 📍 ${viajes} viajes</div>
      </div>
      <div style="background:#064e3b; border:1px solid #059669; border-radius:12px; padding:12px; text-align:center; margin-bottom:12px;">
        <div style="font-size:12px; color:#a7f3d0; font-weight:800; margin-bottom:4px;">💼 HORAS APP (Efectivas)</div>
        <div style="font-size:20px; color:#4ade80; font-weight:900;">${formatT(totalHorasApp)}</div>
      </div>
      <div style="background:#1e293b; border:1px solid #334155; border-radius:12px; padding:12px; margin-bottom:16px;">
        <div style="font-size:11px; color:#94a3b8; font-weight:800; margin-bottom:8px; text-align:center;">DESGLOSE</div>
        <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #334155;"><span style="color:#4ade80; font-weight:700;">🟢 Libre</span><span style="color:#fff; font-weight:800;">${formatT(sLibre)}</span></div>
        <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #334155;"><span style="color:#f87171; font-weight:700;">🔴 Ocupado</span><span style="color:#fff; font-weight:800;">${formatT(sOcupado)}</span></div>
        <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #334155;"><span style="color:#fbbf24; font-weight:700;">🟠 Incidencia</span><span style="color:#fff; font-weight:800;">${formatT(sIncidencia)}</span></div>
        <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #334155;"><span style="color:#c084fc; font-weight:700;">🟣 Descanso</span><span style="color:#fff; font-weight:800;">${formatT(sDescanso)}</span></div>
        <div style="display:flex; justify-content:space-between; padding:4px 0;"><span style="color:#94a3b8; font-weight:700;">⚫ Fuera App</span><span style="color:#fff; font-weight:800;">${formatT(sFuera)}</span></div>
      </div>
      <button onclick="document.getElementById('modalFinJornada').remove()" style="width:100%;padding:14px;border-radius:10px;border:none;background:#3b82f6;color:#fff;font-weight:900;font-size:15px;cursor:pointer;">ENTENDIDO</button>
    </div>`;
  document.body.appendChild(m);
}

function abrirJornadaPantalla() { const p = document.getElementById("jornadaPantalla"); if(p) p.style.display = "block"; renderJornadaHistorial(); }
function cerrarJornadaPantalla() { const p = document.getElementById("jornadaPantalla"); if(p) p.style.display = "none"; }

function renderJornadaHistorial() {
  const cont = document.getElementById("jornadaContenido"); if(!cont) return;
  let historial = [];
  try { const raw = safeStorage.get("uberCambioHistorialJornadas"); const parsed = raw ? JSON.parse(raw) : []; if (Array.isArray(parsed)) historial = parsed; } catch(e) { historial = []; }

  let html = `<div style="text-align:center;margin-bottom:16px;"><div style="font-size:32px;margin-bottom:8px;">📅</div><div style="font-size:16px;font-weight:900;color:#fff;">HISTORIAL DE JORNADAS</div><div style="font-size:12px;color:#94a3b8;">Se guardan los últimos 31 días</div></div>`;

  if (historial.length === 0) {
    html += `<div style="text-align:center;color:#64748b;font-size:14px;padding:20px;background:#1e293b;border-radius:12px;">No hay jornadas guardadas todavía.</div>`;
  } else {
    historial.sort((a,b) => (b.fecha || "").localeCompare(a.fecha || ""));
    const formatT = (segs) => `${Math.floor((segs || 0) / 3600)}h ${Math.floor(((segs || 0) % 3600) / 60)}m`;
    
    historial.forEach(dia => {
      const p = (dia.fecha || "").split("-");
      const fechaBonita = p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : dia.fecha;
      
      // 👇 NUEVO DISEÑO MÁS LIMPIO Y CLICLEABLE 👇
      html += `
      <div onclick="abrirDetalleJornada('${dia.fecha}')" style="background:#1e293b; border:1px solid #334155; border-radius:12px; padding:14px; margin-bottom:12px; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.borderColor='#38bdf8'" onmouseout="this.style.borderColor='#334155'">
        
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:10px; margin-bottom:10px;">
          <div style="font-size:16px;font-weight:900;color:#38bdf8;">📅 ${fechaBonita}</div>
          <div style="font-size:12px;font-weight:800;color:#4ade80;background:#064e3b;padding:4px 8px;border-radius:6px;">🛣️ ${dia.kms || 0} km</div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
          <div style="background:#0f172a; padding:10px; border-radius:8px;">
            <div style="font-size:10px; color:#94a3b8; font-weight:700; margin-bottom:4px;">💶 EFECTIVO</div>
            <div style="font-size:15px; color:#fff; font-weight:900;">${typeof moneyText === 'function' ? moneyText(dia.efectivo || 0) : dia.efectivo}</div>
          </div>
          <div style="background:#0f172a; padding:10px; border-radius:8px;">
            <div style="font-size:10px; color:#94a3b8; font-weight:700; margin-bottom:4px;">💶 PROPINAS</div>
            <div style="font-size:15px; color:#fbbf24; font-weight:900;">${typeof moneyText === 'function' ? moneyText(dia.propinas || 0) : dia.propinas}</div>
          </div>
        </div>
        
        <div style="display:flex; justify-content:space-between; margin-top:10px;">
          <div style="font-size:12px; color:#38bdf8; font-weight:800;">💼 Horas APP: <span style="color:#fff;">${formatT(dia.totalUberOn || 0)}</span></div>
          <div style="font-size:12px; color:#fbbf24; font-weight:800;">📍 Viajes: <span style="color:#fff;">${dia.viajes || 0}</span></div>
        </div>
        
        <div style="text-align:center; font-size:11px; color:#64748b; margin-top:12px; font-weight:700;">Pulsa para ver el desglose completo ›</div>
      </div>`;
    });
    html += `<button onclick="if(confirm('¿Borrar todo el historial de jornadas?')){ safeStorage.set('uberCambioHistorialJornadas', '[]'); renderJornadaHistorial(); }" style="width:100%;padding:12px;border-radius:10px;border:none;background:#7f1d1d;color:#fca5a5;font-weight:800;font-size:14px;cursor:pointer;margin-bottom:12px;">🗑️ Borrar historial completo</button>`;
  }
  html += `<button onclick="cerrarJornadaPantalla()" style="width:100%;padding:14px;border-radius:10px;border:none;background:#334155;color:#fff;font-weight:900;font-size:15px;cursor:pointer;">✖ Volver</button>`;
  cont.innerHTML = html;
}

// 👇 FUNCIÓN NUEVA PARA VER EL DETALLE 👇
function abrirDetalleJornada(fechaStr) {
  let historial = [];
  try { historial = JSON.parse(safeStorage.get("uberCambioHistorialJornadas") || "[]"); } catch(e){}
  const dia = historial.find(h => h.fecha === fechaStr);
  if (!dia) return;

  const formatT = (segs) => `${Math.floor((segs || 0) / 3600)}h ${Math.floor(((segs || 0) % 3600) / 60)}m`;
  const p = fechaStr.split("-");
  const fechaBonita = `${p[2]}/${p[1]}/${p[0]}`;

  const m = document.createElement("div");
  m.id = "modalDetalleJornada";
  m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;";
  m.innerHTML = `
    <div style="background:#1e293b;border-radius:16px;padding:20px;max-width:340px;width:100%;border:1px solid #334155;max-height:90vh;overflow-y:auto;">
      <div style="text-align:center;margin-bottom:16px;">
        <div style="font-size:24px;margin-bottom:4px;">📅</div>
        <div style="font-size:16px;font-weight:900;color:#38bdf8;">${fechaBonita}</div>
      </div>
      
      <div style="background:#0f172a; border:1px solid #334155; border-radius:12px; padding:14px; text-align:center; margin-bottom:16px;">
        <div style="font-size:12px; color:#94a3b8; font-weight:800; margin-bottom:4px;">⏱️ JORNADA TOTAL</div>
        <div style="font-size:28px; color:#fff; font-weight:900;">${formatT(dia.totalJornada)}</div>
      </div>

      <div style="background:#1e293b; border:1px solid #334155; border-radius:12px; padding:14px; margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #334155;"><span style="color:#4ade80; font-weight:700;">🟢 Libre</span><span style="color:#fff; font-weight:800;">${formatT(dia.sLibre)}</span></div>
        <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #334155;"><span style="color:#f87171; font-weight:700;">🔴 Ocupado</span><span style="color:#fff; font-weight:800;">${formatT(dia.sOcupado)}</span></div>
        <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #334155;"><span style="color:#fbbf24; font-weight:700;">🟠 Incidencia</span><span style="color:#fff; font-weight:800;">${formatT(dia.sIncidencia)}</span></div>
        <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #334155;"><span style="color:#c084fc; font-weight:700;">🟣 Descanso</span><span style="color:#fff; font-weight:800;">${formatT(dia.sDescanso)}</span></div>
        <div style="display:flex; justify-content:space-between; padding:6px 0;"><span style="color:#94a3b8; font-weight:700;">⚫ Fuera App</span><span style="color:#fff; font-weight:800;">${formatT(dia.sFuera)}</span></div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:16px;">
        <div style="background:#0f172a; padding:10px; border-radius:8px; text-align:center;">
          <div style="font-size:10px; color:#94a3b8; font-weight:700;">EFECTIVO</div>
          <div style="font-size:16px; color:#fff; font-weight:900;">${typeof moneyText === 'function' ? moneyText(dia.efectivo || 0) : dia.efectivo}</div>
        </div>
        <div style="background:#0f172a; padding:10px; border-radius:8px; text-align:center;">
          <div style="font-size:10px; color:#94a3b8; font-weight:700;">PROPINAS</div>
          <div style="font-size:16px; color:#fbbf24; font-weight:900;">${typeof moneyText === 'function' ? moneyText(dia.propinas || 0) : dia.propinas}</div>
        </div>
      </div>

      <button onclick="document.getElementById('modalDetalleJornada').remove()" style="width:100%;padding:12px;border-radius:10px;border:none;background:#334155;color:#fff;font-weight:900;font-size:14px;cursor:pointer;">Cerrar</button>
    </div>`;
  document.body.appendChild(m);
  m.addEventListener("click", e => { if(e.target === m) m.remove(); });
}

setInterval(() => {
  const hoy = fechaLocalStr();
  if (hoy !== fechaJornadaActual) {
    fechaJornadaActual = hoy;
    segundosLibreHoy = parseInt(safeStorage.get("uberCambioTiempoLibre_" + hoy)) || 0;
    segundosOcupadoHoy = parseInt(safeStorage.get("uberCambioTiempoOcupado_" + hoy)) || 0;
    segundosIncidenciaHoy = parseInt(safeStorage.get("uberCambioTiempoIncidencia_" + hoy)) || 0;
    segundosDescansoHoy = parseInt(safeStorage.get("uberCambioTiempoDescanso_" + hoy)) || 0;
    segundosFueraHoy = parseInt(safeStorage.get("uberCambioTiempoFuera_" + hoy)) || 0;
    notificado6h40m = false;safeStorage.set("uberCambioNotificado6h40m", "0");
  }
}, 60000);

// Auto-guardado de seguridad cada 5 minutos
setInterval(() => { if (typeof guardarJornadaEnHistorial === 'function') guardarJornadaEnHistorial(); }, 5 * 60 * 1000);

// Guardar al cerrar o minimizar la app
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { if (typeof guardarJornadaEnHistorial === 'function') guardarJornadaEnHistorial(); }
});

let notificadoFinJornada = safeStorage.get("uberCambioNotificadoFinJornada") === "1";

setInterval(() => {
  const tieneCoche = (typeof cocheActual !== 'undefined' && cocheActual);
  
  if (tieneCoche && estadoApp !== 'offline' && !notificadoFinJornada) {
    // Calculamos la jornada total en vivo
    let sLibre = segundosLibreHoy, sOcupado = segundosOcupadoHoy, sIncidencia = segundosIncidenciaHoy, sDescanso = segundosDescansoHoy, sFuera = segundosFueraHoy;
    const segsActuales = Math.floor((Date.now() - tiempoInicioEstado) / 1000);
    
    if (estadoApp === 'libre') sLibre += segsActuales;
    if (estadoApp === 'ocupado') sOcupado += segsActuales;
    if (estadoApp === 'incidencia') sIncidencia += segsActuales;
    if (estadoApp === 'descanso') sDescanso += segsActuales;
    if (estadoApp === 'fuera') sFuera += segsActuales;

    const totalJornada = sLibre + sOcupado + sIncidencia + sFuera;

    // 👇 6 horas y 30 minutos = 23400 segundos 👇
    if (totalJornada >= 23400) { 
      notificadoFinJornada = true;
      safeStorage.set("uberCambioNotificadoFinJornada", "1");
      
      // Si estás con un cliente, el mensaje es para que termines el viaje. Si estás libre, para que pares ya.
      if (estadoApp === 'ocupado') {
        lanzarNotificacionJornada("⏰ Quedan 10 min de jornada", "Llevas 6h y 30m de jornada total. Termina este viaje y ve pensando en ir a incidencias y cerrar el día.");
      } else {
        lanzarNotificacionJornada("⏰ Quedan 10 min de jornada", "Llevas 6h y 30m de jornada total. Ve pensando en ir a incidencias y cerrar el día.");
      }
    }
  }
}, 60000);  // Revisa cada minuto

// Reiniciar el aviso al empezar un día nuevo (a las 00:00)
setInterval(() => {
  const hoy = fechaLocalStr();
  if (hoy !== fechaJornadaActual) {
    notificado6h40m = false;
  }
}, 60000);