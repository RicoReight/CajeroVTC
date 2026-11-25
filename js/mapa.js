/* ==================== NOTIFICACIONES DE ZONA ==================== */
const ID_NOTIF_ZONA = 9001;

async function lanzarNotificacionZona(texto){
  if(safeStorage.get("uberCambioSonidoZona") === "0") return;
  try {
    const Cap = window.Capacitor;
    if(!Cap || !Cap.Plugins || !Cap.Plugins.LocalNotifications) return;
    const LN = Cap.Plugins.LocalNotifications;
    
    // Recreamos el canal por si Android lo ha bloqueado
    await crearCanalNotificacionesZona();

    await LN.schedule({
      notifications: [{
        id: ID_NOTIF_ZONA,
        title: '📍 Cambio de zona',
        body: texto,
        channelId: 'zona-cambio',
        smallIcon: 'ic_stat_icon_config_sample',
        schedule: { at: new Date(Date.now() + 1000) } // 👈 ESTA ES LA LÍNEA MÁGICA QUE FALTABA
      }]
    });
  } catch(e){ console.warn('Error lanzando notificación de zona:', e); }
}

async function crearCanalNotificacionesZona(){
  try {
    const Cap = window.Capacitor;
    if(!Cap || !Cap.Plugins || !Cap.Plugins.LocalNotifications) return;
    const LN = Cap.Plugins.LocalNotifications;

    try { if(LN.deleteChannel) await LN.deleteChannel({ id: 'zona-cambio' }); } catch(e){}

    if(LN.createChannel){
      await LN.createChannel({
        id: 'zona-cambio',
        name: 'Cambios de zona',
        description: 'Avisa cuando entras o sales de la zona de trabajo',
        importance: 5, visibility: 1, sound: 'default',
        vibration: true, lights: true, lightColor: '#4ade80'
      });
      console.log('✅ Canal de notificaciones de zona recreado');
    }
  } catch(e){ console.warn('Error creando canal:', e); }
}

async function solicitarPermisoNotificaciones(){
  try {
    const Cap = window.Capacitor;
    if(!Cap || !Cap.Plugins || !Cap.Plugins.LocalNotifications) return;
    const LN = Cap.Plugins.LocalNotifications;
    const perm = await LN.checkPermissions();
    if(perm.display !== 'granted'){ await LN.requestPermissions(); }
  } catch(e){ console.warn('Error pidiendo permiso notificaciones:', e); }
}

/* ==================== VARIABLES GLOBALES DEL MAPA ==================== */
let leafletLoaded = false;
let leafletLoading = null;
let mapaInstance = null;
let mapaMarker = null;
let geoAMB = null;
let geoZBE = null;
let geoPROV = null;
let capaPROV = null;
let capaAMB = null;
let capaZBE = null;
let geoWatcherId = null;
let geoActivo = false;
let ultimaPosicion = null;
let zonaActual = null;
let zonaPendiente = null;
let capaRecorridoActual = null;
let capaFlechasRuta = null;
let procesandoZona = false;
let zonaCandidata = null;
let zonaCandidataCount = 0;
let capasSegmentosRuta = [];
let grupoRutaActual = null; 
const ZONA_CONFIRMACION_MUESTRAS = 2;
const ZONA_COOLDOWN_MS = 20000;
let ultimoCambioZonaMs = 0;

const BUFFER_ZONA_METROS = 50;

let cacheRecorridoHoy = null;
let cacheFechaHoy = null;
let ultimoGuardadoRecorridoMs = 0;

/* ==================== ESTADO Y UI DEL MAPA ==================== */
function actualizarEstadoGeo(){
  const badge = document.getElementById("geoEstadoBadge");
  const btnIni = document.getElementById("btnGeoIniciar");
  const btnDet = document.getElementById("btnGeoDetener");
  if(!badge || !btnIni || !btnDet) return;

  if(geoActivo){
    badge.innerHTML = "🟢 RASTREO ACTIVO<div style='font-size:11px;font-weight:600;color:#a7f3d0;margin-top:4px'>La ubicación se actualiza en segundo plano</div>";
    badge.style.background = "linear-gradient(135deg,#064e3b,#065f46)";
    badge.style.color = "#4ade80"; badge.style.borderColor = "#059669";
    badge.style.boxShadow = "0 0 0 3px rgba(34,197,94,0.25)";
    btnIni.style.background = "#1e293b"; btnIni.style.color = "#475569"; btnIni.style.borderColor = "#334155";
    btnIni.style.cursor = "not-allowed"; btnIni.disabled = true;
    btnDet.style.background = "linear-gradient(135deg,#7f1d1d,#991b1b)"; btnDet.style.color = "#fca5a5";
    btnDet.style.borderColor = "#ef4444"; btnDet.style.cursor = "pointer"; btnDet.disabled = false;
  } else {
    badge.innerHTML = "⚫ RASTREO DETENIDO<div style='font-size:11px;font-weight:600;color:#94a3b8;margin-top:4px'>Pulsa INICIAR para empezar a rastrear</div>";
    badge.style.background = "linear-gradient(135deg,#1e293b,#0f172a)";
    badge.style.color = "#94a3b8"; badge.style.borderColor = "#475569"; badge.style.boxShadow = "none";
    btnIni.style.background = "linear-gradient(135deg,#0ea5e9,#0284c7)"; btnIni.style.color = "#fff";
    btnIni.style.borderColor = "#0ea5e9"; btnIni.style.cursor = "pointer"; btnIni.disabled = false;
    btnDet.style.background = "#1e293b"; btnDet.style.color = "#475569"; btnDet.style.borderColor = "#334155";
    btnDet.style.cursor = "not-allowed"; btnDet.disabled = true;
  }
}

function toggleDebugCoords(){
  const box = document.getElementById("debugCoordsBox");
  if(!box) return;
  box.style.display = (box.style.display === "none" || !box.style.display) ? "block" : "none";
}

function centrarEnMiUbicacion(){
  if(!mapaInstance) return;
  if(!ultimaPosicion){ mostrarToast("📍 Aún no hay ubicación. Pulsa INICIAR o prueba coordenadas manuales."); return; }
  mapaInstance.setView([ultimaPosicion.lat, ultimaPosicion.lon], 14);
  if(mapaMarker){ mapaMarker.setLatLng([ultimaPosicion.lat, ultimaPosicion.lon]); }
}

/* ==================== CARGA DE LEAFLET Y POLÍGONOS ==================== */
async function cargarLeaflet(){
  if(leafletLoaded) return;
  if(leafletLoading) return leafletLoading;
  
  leafletLoading = new Promise((resolve, reject) => {
    // Damos 20 segundos de margen para redes lentas
    const timeout = setTimeout(() => { 
      leafletLoading = null; // Permitir reintentar si falla
      reject(new Error("Timeout: La conexión es muy lenta y el mapa no cargó en 20s")); 
    }, 20000);
    
    // 1. Cargar CSS de Leaflet
    const css = document.createElement("link"); 
    css.rel = "stylesheet";
    css.href = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    
    // 2. Cargar JS de Leaflet base
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js";
    
    s.onload = () => { 
      // 3. Cargar plugin de flechas (ahora desde jsdelivr, más fiable)
      const s2 = document.createElement("script");
      s2.src = "https://cdn.jsdelivr.net/npm/leaflet-polylinedecorator@1.6.0/dist/leaflet.polylineDecorator.js";
      
      s2.onload = () => {
        clearTimeout(timeout); 
        leafletLoaded = true; 
        console.log("✅ Leaflet y Flechas cargados"); 
        resolve(); 
      };
      
      s2.onerror = () => { 
        clearTimeout(timeout); 
        leafletLoaded = true; // ¡Importante! Cargamos el mapa igual
        console.warn("⚠️ Falló el plugin de flechas, el mapa funcionará sin flechas");
        resolve(); 
      };
      
      document.head.appendChild(s2);
    };
    
    s.onerror = () => { 
      clearTimeout(timeout); 
      leafletLoading = null; // Permitir reintentar si el usuario vuelve a abrir
      reject(new Error("No se pudo cargar Leaflet. Revisa tu conexión a internet.")); 
    };
    
    document.head.appendChild(s);
  });
  
  return leafletLoading;
}

async function cargarPoligonos(){
  if(!geoAMB){
    try {
      const r1 = await fetch("VallasMap/AMB.json"); if(!r1.ok) throw new Error("HTTP "+r1.status);
      geoAMB = await r1.json();
    } catch(e){ console.warn("⚠️ AMB no cargado:", e); }
  }
  if(!geoZBE){
    try {
      const r2 = await fetch("VallasMap/ZBE.json"); if(!r2.ok) throw new Error("HTTP "+r2.status);
      geoZBE = await r2.json();
    } catch(e){ console.warn("⚠️ ZBE no cargado:", e); }
  }
  if(!geoPROV){
    try {
      const r3 = await fetch("VallasMap/ProvinciaBCN.json"); if(!r3.ok) throw new Error("HTTP "+r3.status);
      geoPROV = await r3.json();
    } catch(e){ console.warn("⚠️ Provincia BCN no cargada:", e); }
  }
}
/* ==================== PANTALLA DEL MAPA ==================== */
async function abrirMapaPantalla(){
  const d=document.getElementById("drawer"),o=document.getElementById("overlay");
  if(d)d.classList.remove("active"); if(o)o.classList.remove("active");
  const p=document.getElementById("mapaPantalla"); if(p)p.style.display="block";
  const cont = document.getElementById("mapaContenido");
  
  // PANTALLA DE CARGA VISUAL
  cont.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;text-align:center;">
      <div style="font-size:48px;margin-bottom:16px;animation:spin 2s linear infinite;display:inline-block;">🌍</div>
      <div id="loadingText" style="font-size:16px;color:#38bdf8;font-weight:800;margin-bottom:16px;">Iniciando motor...</div>
      <div style="width:80%;max-width:300px;background:#1e293b;border-radius:10px;height:12px;overflow:hidden;border:1px solid #334155;">
        <div id="loadingBar" style="width:0%;height:100%;background:linear-gradient(90deg, #0ea5e9, #38bdf8);transition:width 0.5s ease-in-out;"></div>
      </div>
    </div>
    <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
  `;

  const setLoad = (txt, pct) => {
    const t = document.getElementById("loadingText"), b = document.getElementById("loadingBar");
    if(t) t.textContent = txt;
    if(b) b.style.width = pct + "%";
  };

  // 👇 CARGA PASO A PASO (Sin solapamientos) 👇
  setLoad("Cargando motor del mapa...", 10);
  try { await cargarLeaflet(); } 
  catch(e){ cont.innerHTML = "<div style='text-align:center;color:#ef4444;padding:30px;background:#1e293b;border-radius:12px;'>❌ Error: "+e.message+"<br><br><button onclick='abrirMapaPantalla()' style='margin-top:12px;padding:10px 20px;border-radius:8px;border:none;background:#334155;color:#fff;font-weight:800;'>Reintentar</button></div>"; return; }

  setLoad("Descargando zona AMB...", 30);
  await new Promise(r => setTimeout(r, 600)); 

  setLoad("Descargando ZBE (Rondas)...", 50);
  await new Promise(r => setTimeout(r, 600));

  setLoad("Descargando provincia...", 70);
  await cargarPoligonos(); 
  
  setLoad("Dibujando mapa...", 90);
  await new Promise(r => setTimeout(r, 600)); 
  
  setLoad("¡Listo!", 100);
  await new Promise(r => setTimeout(r, 500)); // Pausa final

  // PANTALLA REAL DEL MAPA
  cont.innerHTML = `
    <div id="geoEstadoBadge" style="text-align:center;margin-bottom:12px;padding:14px;border-radius:12px;border:2px solid #475569;background:linear-gradient(135deg,#1e293b,#0f172a);color:#94a3b8;font-size:15px;font-weight:900;letter-spacing:0.5px;transition:all 0.3s">⚫ RASTREO DETENIDO<div style='font-size:11px;font-weight:600;color:#94a3b8;margin-top:4px'>Pulsa INICIAR para empezar</div></div>
    <div id="resumenJornadaBox" style="display:flex; justify-content:center; gap:8px; margin-bottom:12px;"></div>
    <div style="position:relative;margin-bottom:12px">
      <div id="mapa-leaflet" style="width:100%;height:50vh;min-height:300px;border-radius:12px;background:#1e293b;border:1px solid #334155"></div>
      <button type="button" onclick="centrarEnMiUbicacion()" title="Mi ubicación" style="position:absolute;right:10px;bottom:20px;z-index:500;width:46px;height:46px;border-radius:50%;border:2px solid #0ea5e9;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;font-size:22px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:0;line-height:1">◎</button>
    </div>
    <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;margin-bottom:12px;overflow:hidden;">
      <div onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display==='none'?'block':'none'; this.querySelector('span').textContent = this.nextElementSibling.style.display==='none'?'▼':'▲';" style="padding:12px;background:#0f172a;cursor:pointer;display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:12px;color:#38bdf8;font-weight:900;letter-spacing:0.5px;">🎛️ FILTROS Y REPRODUCTOR</div>
        <span style="color:#64748b;font-size:14px;">▼</span>
      </div>
      <div style="display:none;padding:12px;">
        <div style="font-size:11px;color:#94a3b8;font-weight:800;margin-bottom:8px;">MOSTRAR COLORES:</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">
          <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:#fff;background:#0f172a;padding:6px 10px;border-radius:8px;cursor:pointer;"><input type="checkbox" id="filtro_libre" checked onchange="actualizarMapaVisual()"> 🟢 Libre</label>
          <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:#fff;background:#0f172a;padding:6px 10px;border-radius:8px;cursor:pointer;"><input type="checkbox" id="filtro_ocupado" checked onchange="actualizarMapaVisual()"> 🔴 Ocupado</label>
          <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:#fff;background:#0f172a;padding:6px 10px;border-radius:8px;cursor:pointer;"><input type="checkbox" id="filtro_incidencia" checked onchange="actualizarMapaVisual()"> 🟠 Incid.</label>
          <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:#fff;background:#0f172a;padding:6px 10px;border-radius:8px;cursor:pointer;"><input type="checkbox" id="filtro_descanso" checked onchange="actualizarMapaVisual()"> 🟣 Desc.</label>
          <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:#fff;background:#0f172a;padding:6px 10px;border-radius:8px;cursor:pointer;"><input type="checkbox" id="filtro_fuera" checked onchange="actualizarMapaVisual()"> ⚫ Fuera</label>
        </div>
        <div style="font-size:11px;color:#94a3b8;font-weight:800;margin-bottom:8px;">REPRODUCIR RECORRIDO:</div>
        <input type="range" id="rutaSlider" min="0" max="100" value="100" oninput="actualizarMapaVisual()" style="width:100%;accent-color:#38bdf8;cursor:pointer;">
      </div>
    </div>
    <div id="mapaZonaActual" style="text-align:center;margin-bottom:12px;padding:12px;background:#1e293b;border-radius:12px;font-size:15px;font-weight:800;color:#94a3b8;border:1px solid #334155">Zona: —</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <button type="button" id="btnGeoIniciar" onclick="iniciarGeolocalizacion()" style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;border-radius:10px;padding:14px;font-weight:900;font-size:15px;cursor:pointer;letter-spacing:0.5px;box-shadow:0 4px 10px rgba(16,185,129,0.3)">▶ INICIAR</button>
      <button type="button" id="btnGeoDetener" onclick="detenerGeolocalizacion()" style="background:#1e293b;color:#64748b;border:1px solid #334155;border-radius:10px;padding:14px;font-weight:900;font-size:15px;cursor:not-allowed;letter-spacing:0.5px">⏹ DETENER</button>
    </div>
    <div style="background:#1e293b; border:1px solid #334155; border-radius:12px; padding:14px; margin-bottom:12px;">
      <div onclick="toggleHistorialRutas()" style="display:flex; align-items:center; justify-content:space-between; cursor:pointer; user-select:none;">
        <div style="font-size:11px; color:#94a3b8; font-weight:800; letter-spacing:0.5px;">🗺️ HISTORIAL DE RUTAS</div>
        <span id="historialRutasFlecha" style="font-size:14px; color:#64748b; transition:transform 0.2s; display:inline-block;">▶</span>
      </div>
      <div id="historialRutasContenedor" style="display:none; margin-top:12px;">
        <input type="hidden" id="fechaRutaInput" value="">
        <div id="listaRutasHistorial" style="max-height: 250px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;"></div>
      </div>
    </div>
    <div style="padding:12px;background:#1e293b;border:1px solid #334155;border-radius:12px;margin-bottom:12px">
      <div style="font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:10px">📖 LEYENDA</div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><div style="width:20px;height:6px;background:#4ade80;border-radius:3px"></div><span style="font-size:13px;color:#e2e8f0;font-weight:600">Zona de trabajo</span></div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><div style="width:20px;height:6px;background:#38bdf8;border-radius:3px"></div><span style="font-size:13px;color:#e2e8f0;font-weight:600">Zona AMB</span></div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><div style="width:20px;height:6px;background:#fb923c;border-radius:3px"></div><span style="font-size:13px;color:#e2e8f0;font-weight:600">Zona Interurbana</span></div>
      <div style="display:flex;align-items:center;gap:10px"><div style="width:20px;height:6px;background:#ef4444;border-radius:3px"></div><span style="font-size:13px;color:#e2e8f0;font-weight:600">Fuera Provincia</span></div>
    </div>
    <div style="text-align:center;margin-top:10px;margin-bottom:20px"><button type="button" onclick="toggleDebugCoords()" style="background:transparent;color:#64748b;border:1px dashed #475569;border-radius:10px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer">🐞 Probar coordenadas</button></div>
    <div id="debugCoordsBox" style="display:none;margin-top:10px;padding:12px;background:#1e293b;border:1px dashed #475569;border-radius:10px">
      <div style="font-size:11px;color:#64748b;font-weight:700;margin-bottom:8px;letter-spacing:0.5px">DEBUG · PRUEBA RÁPIDA</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px">
        <button type="button" onclick="setTestCoords(41.410627, 2.150158)" style="background:#14532d;color:#4ade80;border:1px solid #22c55e;border-radius:8px;padding:8px;font-size:12px;font-weight:800;cursor:pointer">🟢 BCN</button>
        <button type="button" onclick="setTestCoords(41.474148, 2.088923)" style="background:#78350f;color:#fbbf24;border:1px solid #f59e0b;border-radius:8px;padding:8px;font-size:12px;font-weight:800;cursor:pointer">🟡 AMB</button>
        <button type="button" onclick="setTestCoords(41.561185, 2.012338)" style="background:#9a3412;color:#fdba74;border:1px solid #fb923c;border-radius:8px;padding:8px;font-size:12px;font-weight:800;cursor:pointer">🟠 Interurbana</button>
        <button type="button" onclick="setTestCoords(41.137103, 1.199737)" style="background:#7f1d1d;color:#fca5a5;border:1px solid #ef4444;border-radius:8px;padding:8px;font-size:12px;font-weight:800;cursor:pointer">🔴 Fuera</button>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <input type="text" id="testLat" placeholder="Lat" style="flex:1;font-size:14px;padding:10px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#fff;outline:none;min-width:0">
        <input type="text" id="testLon" placeholder="Lon" style="flex:1;font-size:14px;padding:10px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#fff;outline:none;min-width:0">
      </div>
      <button type="button" onclick="probarCoordenadasManuales()" style="width:100%;background:#7c3aed;color:#fff;border:none;border-radius:8px;padding:10px;font-weight:700;font-size:13px;cursor:pointer">Probar esta posición</button>
    </div>`;

  setTimeout(() => {
    try {
      const limitesTrabajo = L.latLngBounds([40.80, 0.30], [42.80, 3.20]);
      mapaInstance = L.map("mapa-leaflet", { zoomControl: true, maxBounds: limitesTrabajo, maxBoundsViscosity: 1.0, minZoom: 9, maxZoom: 18, preferCanvas: true }).setView([41.3874, 2.1686], 11);
      L.tileLayer("https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png?api_key=041dfb21-2b3c-44a9-99cf-2895e73db293", { attribution: "&copy; Stadia Maps &copy; OpenMapTiles &copy; OpenStreetMap", maxZoom: 20 }).addTo(mapaInstance);
      if(geoAMB) capaAMB = L.geoJSON(geoAMB, { style: { color: "#38bdf8", weight: 2, fillColor: "#38bdf8", fillOpacity: 0.15 } }).addTo(mapaInstance);
      if(geoZBE) capaZBE = L.geoJSON(geoZBE, { style: { color: "#4ade80", weight: 3, fillColor: "#4ade80", fillOpacity: 0.25 } }).addTo(mapaInstance);
      if(geoPROV) capaPROV = L.geoJSON(geoPROV, { style: { color: "#fb923c", weight: 3, fillColor: "#fb923c", fillOpacity: 0.1, dashArray: "5,5" } }).addTo(mapaInstance);
      setTimeout(() => { if(mapaInstance) mapaInstance.invalidateSize(); }, 200);
      actualizarEstadoGeo();
      if(ultimaPosicion) actualizarMapaConPosicion(ultimaPosicion.lat, ultimaPosicion.lon, 0);
    } catch(e){ console.error("Error montando el mapa:", e); }
  }, 100);
  
  const inpFecha = document.getElementById("fechaRutaInput");
  if(inpFecha) inpFecha.value = fechaLocalStr();
  
  const sl = document.getElementById("rutaSlider"); if(sl) sl.value = 100;

  renderListaRutasHistorial();
  aplicarEstadoHistorialRutas();
  if(typeof renderResumenJornada === "function") {
    renderResumenJornada();
    setInterval(() => { if(document.getElementById("resumenJornadaBox")) renderResumenJornada(); }, 60000);
  }
}

function cerrarMapaPantalla(){
  const p = document.getElementById("mapaPantalla"); if(p) p.style.display = "none";
  mapaInstance = null; mapaMarker = null;
}

/* ==================== DETECCIÓN DE ZONA ==================== */
function contarCrucesRayo(lat, lon, coords){
  let count = 0;
  for(let i = 0; i < coords.length - 1; i++){
    const x1 = coords[i][0], y1 = coords[i][1];
    const x2 = coords[i+1][0], y2 = coords[i+1][1];
    const cruzaV = ((x1 > lon) !== (x2 > lon));
    if(!cruzaV) continue;
    const yInter = (y2 - y1) * (lon - x1) / (x2 - x1) + y1;
    if(yInter > lat) count++;
  }
  return count;
}

function aplanarGeometrias(geojson){
  if(!geojson) return [];
  const features = geojson.type === "FeatureCollection" ? geojson.features : [geojson];
  const out = [];
  for(const f of features){
    const g = f.geometry || f;
    if(!g || !g.type) continue;
    if(g.type === "GeometryCollection" && Array.isArray(g.geometries)){
      for(const sub of g.geometries){ if(sub && sub.type) out.push(sub); }
    } else { out.push(g); }
  }
  return out;
}

function puntoEnLineStrings(lat, lon, geojson){
  if(!geojson) return false;
  const geoms = aplanarGeometrias(geojson);
  let total = 0;
  for(const g of geoms){
    if(g.type === "LineString") total += contarCrucesRayo(lat, lon, g.coordinates);
    else if(g.type === "MultiLineString") for(const line of g.coordinates) total += contarCrucesRayo(lat, lon, line);
    else if(g.type === "Polygon") total += contarCrucesRayo(lat, lon, g.coordinates[0]);
    else if(g.type === "MultiPolygon") for(const poly of g.coordinates) total += contarCrucesRayo(lat, lon, poly[0]);
  }
  return (total % 2) === 1;
}

function enAnillo(lat, lon, ring){
  let inside = false;
  for(let i = 0, j = ring.length - 1; i < ring.length; j = i++){
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    const cruza = ((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if(cruza) inside = !inside;
  }
  return inside;
}

function enPoligonoSimple(lat, lon, coords){
  if(!coords || !coords.length) return false;
  if(!enAnillo(lat, lon, coords[0])) return false;
  for(let i = 1; i < coords.length; i++){ if(enAnillo(lat, lon, coords[i])) return false; }
  return true;
}

function puntoEnPoligono(lat, lon, geojson){
  if(!geojson) return false;
  const geoms = aplanarGeometrias(geojson);
  for(const g of geoms){
    if(g.type === "Polygon"){ if(enPoligonoSimple(lat, lon, g.coordinates)) return true; }
    else if(g.type === "MultiPolygon"){ for(const poly of g.coordinates){ if(enPoligonoSimple(lat, lon, poly)) return true; } }
  }
  return false;
}

function distanciaSegmentoMetros(lat, lon, lat1, lon1, lat2, lon2){
  const latRad = lat * Math.PI / 180;
  const mPorGradoLat = 111132, mPorGradoLon = 111320 * Math.cos(latRad);
  const x = (lon - lon1) * mPorGradoLon, y = (lat - lat1) * mPorGradoLat;
  const x2 = (lon2 - lon1) * mPorGradoLon, y2 = (lat2 - lat1) * mPorGradoLat;
  const len2 = x2*x2 + y2*y2;
  if(len2 === 0) return Math.sqrt(x*x + y*y);
  let t = (x*x2 + y*y2) / len2; t = Math.max(0, Math.min(1, t));
  const dx = x - t*x2, dy = y - t*y2;
  return Math.sqrt(dx*dx + dy*dy);
}

function distanciaAlPoligono(lat, lon, geojson){
  if(!geojson) return Infinity;
  const geoms = aplanarGeometrias(geojson);
  let min = Infinity;
  for(const g of geoms){
    let anillos = [];
    if(g.type === "Polygon") anillos = [g.coordinates[0]];
    else if(g.type === "MultiPolygon") anillos = g.coordinates.map(p => p[0]);
    for(const anillo of anillos){
      for(let i = 0; i < anillo.length - 1; i++){
        const d = distanciaSegmentoMetros(lat, lon, anillo[i][1], anillo[i][0], anillo[i+1][1], anillo[i+1][0]);
        if(d < min) min = d;
        if(min < 1) return min;
      }
    }
  }
  return min;
}

function detectarZona(lat, lon){
  if(puntoEnPoligono(lat, lon, geoZBE)) return { codigo: "bcn", nombre: "🟢 Zona de trabajo", color: "#4ade80" };
  if(puntoEnLineStrings(lat, lon, geoAMB)) return { codigo: "amb", nombre: "🟡 Zona AMB", color: "#fbbf24" };
  if(puntoEnPoligono(lat, lon, geoPROV)) return { codigo: "prov", nombre: "🟠 Zona Interurbana", color: "#fb923c" };
  const d = distanciaAlPoligono(lat, lon, geoZBE);
  if(d < BUFFER_ZONA_METROS) return { codigo: "bcn", nombre: "🟢 Zona de trabajo", color: "#4ade80" };
  return { codigo: "fuera", nombre: "🔴 Fuera Provincia", color: "#ef4444" };
}

async function actualizarNotificacionZona(nuevaZona){
  if(procesandoZona){
    zonaPendiente = nuevaZona;
    return;
  }
 
  if(zonaActual === nuevaZona.codigo){
    zonaCandidata = null;
    zonaCandidataCount = 0;
    return;
  }
 
  if(zonaCandidata === nuevaZona.codigo){
    zonaCandidataCount++;
  } else {
    zonaCandidata = nuevaZona.codigo;
    zonaCandidataCount = 1;
  }
 
  if(zonaCandidataCount < ZONA_CONFIRMACION_MUESTRAS) return;
 
  procesandoZona = true;
  try {
    zonaActual = nuevaZona.codigo;
    zonaCandidata = null;
    zonaCandidataCount = 0;
    ultimoCambioZonaMs = Date.now();

    // Actualizar la pantalla si el mapa está abierto
    const elZona = document.getElementById("mapaZonaActual");
    if(elZona && ultimaPosicion){
      elZona.innerHTML = "Zona: " + nuevaZona.nombre + "<div style='font-size:11px;color:#94a3b8;margin-top:4px;font-weight:600'>" + ultimaPosicion.lat.toFixed(5) + ", " + ultimaPosicion.lon.toFixed(5) + " · ±" + (ultimaPosicion.acc || 0) + "m</div>";
      elZona.style.color = nuevaZona.color;
    }

    // 👇 LANZAMOS LA NOTIFICACIÓN NATIVA (Sin tocar el GPS) 👇
    if(typeof lanzarNotificacionZona === 'function') {
      lanzarNotificacionZona(nuevaZona.nombre);
    }

  } finally {
    procesandoZona = false;
    if(zonaPendiente){
      const zp = zonaPendiente;
      zonaPendiente = null;
      if(zp.codigo !== zonaActual){
        actualizarNotificacionZona(zp);
      }
    }
  }
}

async function reiniciarWatcherConTexto(texto){
  const Cap = window.Capacitor;
  if(!Cap || !Cap.Plugins || !Cap.Plugins.BackgroundGeolocation) return;
  const BG = Cap.Plugins.BackgroundGeolocation;
  try {
    if(geoWatcherId){ await BG.removeWatcher({ id: geoWatcherId }); geoWatcherId = null; }
    const onLocation = (location, error) => {
      if(error || !location) return;
      actualizarMapaConPosicion(location.latitude, location.longitude, Math.round(location.accuracy));
    };
    geoWatcherId = await BG.addWatcher({
      backgroundMessage: 'Estás en: ' + texto, backgroundTitle: 'Mapa de zonas',
      requestPermissions: false, stale: false, distanceFilter: 10,
      desiredAccuracy: 20, stationaryRadius: 25, stopOnTerminate: false,
      startOnBoot: true, preventSuspend: true, heartbeatInterval: 60,
      foregroundService: true, debug: false, pausesLocationUpdatesAutomatically: false
    }, onLocation);
    zonaPendiente = null;
  } catch(e){ console.warn('No se pudo actualizar la notificación:', e); }
}

/* ==================== HISTORIAL DE RECORRIDOS ==================== */
function obtenerClaveRecorrido(fechaStr) { return "uberCambioRecorrido_" + fechaStr; }

function guardarPuntoRecorrido(lat, lon, acc) {
  if (acc && acc > 80) return; // Si la precisión es muy mala, no guardamos

  const hoy = fechaLocalStr();
  if (cacheFechaHoy !== hoy) {
    cacheFechaHoy = hoy;
    try { cacheRecorridoHoy = JSON.parse(safeStorage.get(obtenerClaveRecorrido(hoy)) || "[]"); } catch(e) { cacheRecorridoHoy = []; }
  }

  if (cacheRecorridoHoy.length > 0) {
    const ultimo = cacheRecorridoHoy[cacheRecorridoHoy.length - 1];
    const dist = Math.sqrt(Math.pow(ultimo.lat - lat, 2) + Math.pow(ultimo.lon - lon, 2)) * 111000;
    if (dist < 15) return; 
  }

  // 👇 AQUÍ GUARDAMOS EL ESTADO ACTUAL (libre/ocupado/repostando) 👇
  let est = (typeof estadoApp !== "undefined") ? estadoApp : "libre";
  cacheRecorridoHoy.push({ lat: lat, lon: lon, time: Date.now(), estado: est });

  if (cacheRecorridoHoy.length > 30000) {
    cacheRecorridoHoy.splice(0, 5000); 
  }

  const ahora = Date.now();
  if (ahora - ultimoGuardadoRecorridoMs > 20000) {
    try {
      safeStorage.set(obtenerClaveRecorrido(hoy), JSON.stringify(cacheRecorridoHoy));
      ultimoGuardadoRecorridoMs = ahora;
    } catch(e) { console.error("Error guardando ruta:", e); }
  }
}

function obtenerRecorrido(fechaStr) {
  if (cacheFechaHoy === fechaStr && cacheRecorridoHoy) return cacheRecorridoHoy;
  return JSON.parse(safeStorage.get(obtenerClaveRecorrido(fechaStr)) || "[]");
}

let puntosRutaActualGlobal = [];
let timeoutMapaVisual = null;
function actualizarMapaVisual() {
  if(timeoutMapaVisual) clearTimeout(timeoutMapaVisual);
  // Subimos a 100ms para que no se sature el móvil y vaya más fluido
  timeoutMapaVisual = setTimeout(() => {
    const inp = document.getElementById("fechaRutaInput");
    if (inp && inp.value) dibujarRecorridoEnMapa(inp.value);
  }, 100); 
}

function dibujarRecorridoEnMapa(fechaStr) {
  if (!mapaInstance) return;
  
  // 👇 MEJORA: Si ya tenemos los puntos en memoria, no leemos el localStorage (más fluido)
  let puntos;
  if (puntosRutaActualGlobal && puntosRutaActualGlobal.length > 0 && document.getElementById("fechaRutaInput")?.value === fechaStr) {
    puntos = puntosRutaActualGlobal;
  } else {
    const claveMatched = "uberCambioRecorridoMatched_" + fechaStr;
    let puntosStr = safeStorage.get(claveMatched);
    puntos = puntosStr ? JSON.parse(puntosStr) : obtenerRecorrido(fechaStr);
  }
  
  if (!puntos || puntos.length < 2) return;
  puntosRutaActualGlobal = puntos;

  if (grupoRutaActual) { mapaInstance.removeLayer(grupoRutaActual); grupoRutaActual = null; }
  grupoRutaActual = L.featureGroup().addTo(mapaInstance);
  capasSegmentosRuta = [];

  const filtros = {
    libre: document.getElementById("filtro_libre")?.checked ?? true,
    ocupado: document.getElementById("filtro_ocupado")?.checked ?? true,
    incidencia: document.getElementById("filtro_incidencia")?.checked ?? true,
    descanso: document.getElementById("filtro_descanso")?.checked ?? true,
    fuera: document.getElementById("filtro_fuera")?.checked ?? true
  };
  
  const pct = parseInt(document.getElementById("rutaSlider")?.value || 100);
  const numPuntosAMostrar = Math.floor(puntos.length * (pct / 100));
  const puntosVisibles = puntos.slice(0, numPuntosAMostrar);
  
  const idxActual = Math.max(0, numPuntosAMostrar - 1);
  const puntoActual = puntos[idxActual];
  const timeActual = puntoActual ? (puntoActual.time || Date.now()) : Date.now();

  if (pct < 100) {
    const coordsFantasma = puntos.map(p => [p.lat, p.lon]);
    const lineaFantasma = L.polyline(coordsFantasma, { color: '#334155', weight: 3, opacity: 0.3, dashArray: '5, 10' }).addTo(grupoRutaActual);
    capasSegmentosRuta.push(lineaFantasma);
  }

  let segmentos = [];
  let tramoActual = null;

  puntosVisibles.forEach((p) => {
    let est = p.estado || "libre";
    if (!tramoActual || tramoActual.estado !== est) {
      if (tramoActual && tramoActual.coords.length > 0) {
        tramoActual.coords.push([p.lat, p.lon]); 
        segmentos.push(tramoActual);
      }
      tramoActual = { estado: est, coords: [[p.lat, p.lon]] };
    } else {
      tramoActual.coords.push([p.lat, p.lon]);
    }
  });
  if (tramoActual && tramoActual.coords.length > 1) segmentos.push(tramoActual);

  segmentos.forEach(seg => {
    if (seg.coords.length < 2) return;
    if (!filtros[seg.estado]) return; 

    let color = "#38bdf8"; 
    if (seg.estado === "ocupado") color = "#ef4444"; 
    if (seg.estado === "incidencia") color = "#f59e0b"; 
    if (seg.estado === "descanso") color = "#a855f7"; 
    if (seg.estado === "fuera") color = "#94a3b8"; 
    let peso = seg.estado === "ocupado" ? 6 : 5;

    const linea = L.polyline(seg.coords, { color: color, weight: peso, opacity: 0.9, lineJoin: 'round', smoothFactor: 1.5 }).addTo(grupoRutaActual);
    capasSegmentosRuta.push(linea);

    if (L.polylineDecorator) {
      const flechas = L.polylineDecorator(linea, {
        patterns: [{ offset: 20, repeat: 70, symbol: L.Symbol.arrowHead({ pixelSize: 10, polygon: false, pathOptions: { stroke: true, color: color, weight: 3, opacity: 1 } }) }]
      }).addTo(grupoRutaActual);
      capasSegmentosRuta.push(flechas);
    }
  });

  // ICONOS CON NÚMERO DE VIAJE
  let marcadoresViajes = {};
  try { marcadoresViajes = JSON.parse(safeStorage.get("uberCambioMarcadoresViajes") || "{}"); } catch(e){}
  
  if (marcadoresViajes[fechaStr]) {
    let contadorViaje = 0;
    
    marcadoresViajes[fechaStr].forEach(punto => {
      const esA = punto.tipo === 'A';
      if (!filtros.ocupado) return; 
      
      if (esA) contadorViaje++;

      if (pct < 100 && punto.time && punto.time > timeActual) return;

      const color = esA ? '#10b981' : '#ef4444'; 
      const emoji = esA ? '🙋‍♂️' : '🏁'; 
      
      const icono = L.divIcon({
        className: 'custom-marker',
        html: `
          <div style="position:relative; width:34px; height:34px;">
            <div style="background:${color}; width:100%; height:100%; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:18px; border:2px solid #fff; box-shadow:0 2px 8px rgba(0,0,0,0.6);">${emoji}</div>
            <div style="position:absolute; top:-6px; right:-6px; background:#0f172a; color:#fff; font-size:11px; font-weight:900; width:18px; height:18px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:1.5px solid #fff; box-shadow:0 1px 3px rgba(0,0,0,0.5);">${contadorViaje}</div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });
      
      const marcador = L.marker([punto.lat, punto.lon], { icon: icono }).addTo(grupoRutaActual);
      capasSegmentosRuta.push(marcador);
    });
  }
  
  // 👇 ZOOM CORREGIDO 👇
  if (pct < 100 && puntoActual) {
    // Nivel 16: Se ve la calle y el coche justo en el medio
    mapaInstance.setView([puntoActual.lat, puntoActual.lon], 16, { animate: true });
  } else if (grupoRutaActual.getLayers().length > 0) {
    // Al 100%: Un zoom máximo de 15 para que no se aleje demasiado, y menos margen (padding)
    mapaInstance.fitBounds(grupoRutaActual.getBounds(), { padding: [20, 20], maxZoom: 15 });
  }
}

function toggleHistorialRutas(){
  const cont = document.getElementById("historialRutasContenedor");
  const flecha = document.getElementById("historialRutasFlecha");
  if(!cont || !flecha) return;
  const abierto = cont.style.display !== "none";
  if(abierto){ cont.style.display = "none"; flecha.style.transform = "rotate(0deg)"; safeStorage.set("uberCambioHistorialRutasAbierto", "0"); }
  else { cont.style.display = "block"; flecha.style.transform = "rotate(90deg)"; safeStorage.set("uberCambioHistorialRutasAbierto", "1"); }
}
function aplicarEstadoHistorialRutas(){
  const cont = document.getElementById("historialRutasContenedor");
  const flecha = document.getElementById("historialRutasFlecha");
  if(!cont || !flecha) return;
  const abierto = safeStorage.get("uberCambioHistorialRutasAbierto") === "1";
  if(abierto){ cont.style.display = "block"; flecha.style.transform = "rotate(90deg)"; }
  else { cont.style.display = "none"; flecha.style.transform = "rotate(0deg)"; }
}

function renderListaRutasHistorial() {
  const cont = document.getElementById("listaRutasHistorial"); if (!cont) return;
  const fechas = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("uberCambioRecorrido_") && !k.includes("_Matched")) {
      const fecha = k.replace("uberCambioRecorrido_", "");
      if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) fechas.push(fecha);
    }
  }
  fechas.sort().reverse();
  if (fechas.length === 0) { cont.innerHTML = "<div style='color:#64748b;font-size:13px;text-align:center;padding:10px'>No hay rutas guardadas</div>"; return; }
  const fechaActual = document.getElementById("fechaRutaInput")?.value || "";
  let html = "";
  fechas.forEach(f => {
    const tieneMatched = localStorage.getItem("uberCambioRecorridoMatched_" + f);
    const esActual = (f === fechaActual && capaRecorridoActual);
    const p = f.split("-"), dateObj = new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2]));
    const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const fechaBonita = `${p[2]}/${p[1]}/${p[0]} <span style="font-size:11px;color:#64748b">(${dias[dateObj.getDay()]})</span>`;
    
    // Calcular KMs del historial
    const kms = typeof calcularKmsTotales === 'function' ? calcularKmsTotales(f) : "0.0";

    html += `<div style="display:flex; justify-content:space-between; align-items:center; background:#0f172a; border:1px solid ${esActual?'#3b82f6':'#334155'}; border-radius:8px; padding:10px;"><div><div style="font-size:14px; font-weight:800; color:#fff;">${fechaBonita} ${tieneMatched ? '<span title="Mapa dibujado" style="font-size:10px; color:#4ade80; border:1px solid #4ade80; padding:2px 4px; border-radius:4px; margin-left:4px;">MAPA</span>' : ''}</div><div style="font-size:11px; color:#38bdf8; font-weight:800; margin-top:2px;">🛣️ ${kms} km</div></div><div style="display:flex; gap:6px;"><button type="button" onclick="verRutaHistorial('${f}')" style="background:${esActual?'#3b82f6':'#1e293b'}; color:#fff; border:none; border-radius:6px; padding:6px 10px; font-weight:700; font-size:12px; cursor:pointer;">${esActual ? 'Ocultar' : 'Ver'}</button><button type="button" onclick="borrarRutaHistorial('${f}')" style="background:#7f1d1d; color:#fca5a5; border:none; border-radius:6px; padding:6px 10px; font-size:14px; cursor:pointer;">🗑️</button></div></div>`;
  });
  cont.innerHTML = html;
}

function verRutaHistorial(fechaStr) {
  const inp = document.getElementById("fechaRutaInput"); if (!inp || !mapaInstance) return;
  
  if (inp.value === fechaStr && grupoRutaActual) { 
    // Si ya está abierta, la ocultamos
    if (grupoRutaActual) { mapaInstance.removeLayer(grupoRutaActual); grupoRutaActual = null; }
    capasSegmentosRuta = [];
    capaRecorridoActual = null;
  }
  else { 
    // Si abrimos una nueva ruta, reseteamos el slider al 100%
    const sl = document.getElementById("rutaSlider"); if(sl) sl.value = 100;
    
    inp.value = fechaStr; 
    dibujarRecorridoEnMapa(fechaStr); 
  }
  renderListaRutasHistorial();
}

function borrarRutaHistorial(fechaStr) {
  if(!confirm("¿Borrar la ruta del " + fechaStr + "?\n\nEsta acción no se puede deshacer.")) return;
  localStorage.removeItem("uberCambioRecorrido_" + fechaStr);
  localStorage.removeItem("uberCambioRecorridoMatched_" + fechaStr);
  
  // (Opcional) Borrar también los marcadores A y B de este día
  try {
    let marcadoresViajes = JSON.parse(safeStorage.get("uberCambioMarcadoresViajes") || "{}");
    if (marcadoresViajes[fechaStr]) {
      delete marcadoresViajes[fechaStr];
      safeStorage.set("uberCambioMarcadoresViajes", JSON.stringify(marcadoresViajes));
    }
  } catch(e){}

  const inp = document.getElementById("fechaRutaInput");
  if (inp && inp.value === fechaStr && capaRecorridoActual) { 
    if (typeof capasSegmentosRuta !== 'undefined') {
      capasSegmentosRuta.forEach(capa => mapaInstance.removeLayer(capa));
      capasSegmentosRuta = [];
    }
    capaRecorridoActual = null; 
  }
  renderListaRutasHistorial(); mostrarToast("🗑️ Ruta borrada");
}

/* ==================== PROCESAMIENTO DE POSICIÓN ==================== */
function procesarNuevaPosicion(lat, lon, acc){
  ultimaPosicion = { lat, lon };
  guardarPuntoRecorrido(lat, lon, acc);
  const zona = detectarZona(lat, lon);
  actualizarNotificacionZona(zona);
  if(mapaInstance){
    if(!mapaMarker){ mapaMarker = L.circleMarker([lat, lon], { radius: 8, color: "#fff", weight: 3, fillColor: "#38bdf8", fillOpacity: 1 }).addTo(mapaInstance); }
    else { mapaMarker.setLatLng([lat, lon]); }
    if (capaRecorridoActual) {
      const ahora = Date.now();
      if (ahora - (window.__ultimoDibujoRuta || 0) > 5000) {
        const inpF = document.getElementById("fechaRutaInput");
        if (inpF && inpF.value !== fechaLocalStr()) inpF.value = fechaLocalStr();
        dibujarRecorridoEnMapa((inpF?.value) || fechaLocalStr());
        window.__ultimoDibujoRuta = ahora;
      }
    }
    mapaInstance.panTo([lat, lon]);
    const elZona = document.getElementById("mapaZonaActual");
    if(elZona){
      elZona.innerHTML = "Zona: " + zona.nombre + "<div style='font-size:11px;color:#94a3b8;margin-top:4px;font-weight:600'>" + lat.toFixed(5) + ", " + lon.toFixed(5) + " · ±" + (acc||0) + "m</div>";
      elZona.style.color = zona.color;
    }
  }
}

function actualizarMapaConPosicion(lat, lon, acc){ procesarNuevaPosicion(lat, lon, acc); }

function setTestCoords(lat, lon){
  const latEl = document.getElementById("testLat"), lonEl = document.getElementById("testLon");
  if(latEl && lonEl){ latEl.value = lat; lonEl.value = lon; probarCoordenadasManuales(); }
}

function probarCoordenadasManuales(){
  const latEl = document.getElementById("testLat"), lonEl = document.getElementById("testLon");
  if(!latEl || !lonEl) return;
  const lat = parseFloat(latEl.value.replace(',','.')), lon = parseFloat(lonEl.value.replace(',','.'));
  if(isNaN(lat) || isNaN(lon)){ alert("Coordenadas inválidas. Usa números decimales (ej: 41.3874, 2.1686)"); return; }
  actualizarMapaConPosicion(lat, lon, 0);
}

/* ==================== PERMISOS ==================== */
async function pedirPermisosUbicacionYNotificaciones(){
  const Cap = window.Capacitor;
  if(!Cap || !Cap.Plugins){ alert('❌ Capacitor no disponible'); return false; }
  try {
    const Geo = Cap.Plugins.Geolocation;
    if(!Geo){ alert('❌ Plugin Geolocation no instalado'); return false; }
    const geoPerms = await Geo.requestPermissions();
    if(geoPerms.location !== 'granted'){ alert('⚠️ Necesito permiso de ubicación para rastrear zonas.'); return false; }
    const LN = Cap.Plugins.LocalNotifications;
    if(LN){ try { const notifPerms = await LN.requestPermissions(); if(notifPerms.display !== 'granted'){ mostrarToast('⚠️ Sin permiso de notificaciones no verás el aviso de zona'); } } catch(e){} }
    return true;
  } catch(e){ console.warn('Error pidiendo permisos:', e); alert('❌ Error al pedir permisos: ' + (e.message || e)); return false; }
}

async function pedirExencionBateria(){
  const Cap = window.Capacitor;
  if(!Cap || !Cap.Plugins) return false;
  const BO = Cap.Plugins.BatteryOptimization;
  if(!BO) return false;
  try {
    const { enabled } = await BO.isBatteryOptimizationEnabled();
    if(!enabled) return true;
    await BO.requestIgnoreBatteryOptimization();
    await new Promise(r => setTimeout(r, 1000));
    const check = await BO.isBatteryOptimizationEnabled();
    if(!check.enabled){ mostrarToast('✅ Batería: sin restricciones'); return true; }
    else { mostrarToast('⚠️ Acepta "Sin restricciones" para que el rastreo no se pare'); return false; }
  } catch(e){
    try { await BO.openBatteryOptimizationSettings(); } catch(e2){}
    return false;
  }
}

/* ==================== GEOLOCALIZACIÓN BACKGROUND ==================== */
async function iniciarGeolocalizacion(){
  try {
    const Cap = window.Capacitor;
    if(!Cap || !Cap.Plugins || !Cap.Plugins.BackgroundGeolocation){ alert('❌ Plugin de geolocalización no instalado'); return; }
    const permisosOk = await pedirPermisosUbicacionYNotificaciones(); if(!permisosOk) return;
    await pedirExencionBateria();
    const BG = Cap.Plugins.BackgroundGeolocation;
    zonaActual = null; zonaPendiente = null; zonaCandidata = null; zonaCandidataCount = 0; procesandoZona = false; ultimoCambioZonaMs = 0;
    mostrarToast("🔎 Buscando tu posición...");
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(
        (pos) => { const lat = pos.coords.latitude, lon = pos.coords.longitude, acc = Math.round(pos.coords.accuracy || 0); actualizarMapaConPosicion(lat, lon, acc); mostrarToast("📍 Posición capturada"); },
        (err) => { console.warn('navigator.geolocation falló:', err && err.message); },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    }
    if(geoWatcherId){ try { await BG.removeWatcher({ id: geoWatcherId }); } catch(e){} geoWatcherId = null; }
    const onLocation = (location, error) => {
      if(error){ console.warn('Error geolocalización:', error); return; }
      if(!location) return;
      actualizarMapaConPosicion(location.latitude, location.longitude, Math.round(location.accuracy));
    };
    geoWatcherId = await BG.addWatcher({
      backgroundMessage: 'Rastreo de zonas activo', backgroundTitle: 'Mapa de zonas',
      requestPermissions: true, stale: false, distanceFilter: 15
    }, onLocation);
    geoActivo = true;
    actualizarEstadoGeo();
  } catch(e){ console.error('Error general:', e); alert('❌ Error: ' + (e.message || JSON.stringify(e))); geoActivo = false; actualizarEstadoGeo(); }
}

/* ==================== MAP MATCHING (OSRM) ==================== */
async function ajustarRutaACalles(puntosOriginales) {
  if (!puntosOriginales || puntosOriginales.length < 2) return puntosOriginales;
  try {
    let rutasFinales = []; const maxPoints = 100;
    for (let i = 0; i < puntosOriginales.length; i += maxPoints) {
      const inicio = Math.max(0, i - 1);
      const bloque = puntosOriginales.slice(inicio, i + maxPoints);
      if (bloque.length < 2) continue;
      const coords = bloque.map(p => `${p.lon},${p.lat}`).join(';');
      const url = `https://router.project-osrm.org/match/v1/driving/${coords}?geometries=geojson&overview=full`;
      const response = await fetch(url); if (!response.ok) throw new Error("OSRM falló");
      const data = await response.json();
      if (data.code === "Ok" && data.matchings && data.matchings.length > 0) {
        const rutaAjustada = data.matchings[0].geometry.coordinates.map(c => ({ lat: c[1], lon: c[0] }));
        rutasFinales = rutasFinales.concat(rutaAjustada);
      } else { rutasFinales = rutasFinales.concat(bloque); }
    }
    return rutasFinales;
  } catch (e) { console.warn("No se pudo ajustar a calles:", e); return puntosOriginales; }
}

async function procesarRutaFinalDia() {
  const hoy = fechaLocalStr(), puntos = obtenerRecorrido(hoy);
  if (!puntos || puntos.length < 2) return;
  mostrarToast("🪄 Dibujando mapa...");
  const puntosAjustados = await ajustarRutaACalles(puntos);
  if (puntosAjustados && puntosAjustados.length > 1) {
    const claveMatched = "uberCambioRecorridoMatched_" + hoy;
    safeStorage.set(claveMatched, JSON.stringify(puntosAjustados));
    mostrarToast("✅ Mapa dibujado");
    if (mapaInstance && document.getElementById("fechaRutaInput")?.value === hoy) { dibujarRecorridoEnMapa(hoy); }
  }
}

async function detenerGeolocalizacion(){
  try {
    const Cap = window.Capacitor;
    if(!Cap || !Cap.Plugins || !Cap.Plugins.BackgroundGeolocation) return;
    const BG = Cap.Plugins.BackgroundGeolocation;

    // 👇 FORZAR GUARDADO FINAL antes de apagar el GPS
    if(cacheRecorridoHoy && cacheFechaHoy){
      try {
        safeStorage.set(obtenerClaveRecorrido(cacheFechaHoy), JSON.stringify(cacheRecorridoHoy));
        console.log("💾 Guardado final de " + cacheRecorridoHoy.length + " puntos");
      } catch(e){ console.warn("Error en guardado forzado:", e); }
    }

    if(geoWatcherId){
      await BG.removeWatcher({ id: geoWatcherId });
      geoWatcherId = null;
      mostrarToast('⏹️ Rastreo detenido');
    }
    geoActivo = false;
    safeStorage.set("uberCambioGeoActivo", "0");
    actualizarEstadoGeo();

    procesarRutaFinalDia();

  } catch(e){
    console.warn('Error deteniendo:', e);
    geoActivo = false;
    safeStorage.set("uberCambioGeoActivo", "0");
    actualizarEstadoGeo();
    procesarRutaFinalDia();
  }
}

function limpiarRutasAntiguas(diasAConservar = 3) {
  try {
    const hoy = new Date();
    hoy.setHours(0,0,0,0);
    const limite = new Date(hoy.getTime());
    limite.setDate(limite.getDate() - diasAConservar);

    const clavesABorrar = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("uberCambioRecorrido_")) {
        const fechaStr = k.replace("uberCambioRecorrido_", "").replace("Matched_", "");
        const p = fechaStr.split("-");
        if (p.length === 3) {
          const fecha = new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2]));
          if (!isNaN(fecha.getTime()) && fecha < limite) {
            clavesABorrar.push(k);
          }
        }
      }
    }

    clavesABorrar.forEach(k => safeStorage.remove(k));
    if (clavesABorrar.length > 0) {
      console.log("🧹 Borradas " + clavesABorrar.length + " rutas (> " + diasAConservar + " días)");
    }
  } catch(e) {
    console.warn("Error limpiando rutas antiguas:", e);
  }
}

function limpiarTodasLasRutas(dias) {
  limpiarRutasAntiguas(dias);
}