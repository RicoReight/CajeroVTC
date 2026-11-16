/* ==================== NOTIFICACIONES DE ZONA ==================== */
const ID_NOTIF_ZONA = 9001;

async function lanzarNotificacionZona(texto){
  if(safeStorage.get("uberCambioSonidoZona") === "0") return;
  try {
    const Cap = window.Capacitor;
    if(!Cap || !Cap.Plugins || !Cap.Plugins.LocalNotifications) return;
    const LN = Cap.Plugins.LocalNotifications;
    await LN.schedule({
      notifications: [{
        id: ID_NOTIF_ZONA,
        title: '📍 Cambio de zona',
        body: texto,
        channelId: 'zona-cambio',
        smallIcon: 'ic_stat_icon_config_sample'
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
let procesandoZona = false;
let zonaCandidata = null;
let zonaCandidataCount = 0;
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
    const timeout = setTimeout(() => { reject(new Error("Timeout: Leaflet no cargó en 10s")); }, 10000);
    const css = document.createElement("link"); css.rel = "stylesheet";
    css.href = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js";
    s.onload = () => { clearTimeout(timeout); leafletLoaded = true; console.log("✅ Leaflet cargado"); resolve(); };
    s.onerror = () => { clearTimeout(timeout); reject(new Error("No se pudo cargar Leaflet desde jsdelivr")); };
    document.head.appendChild(s);
  });
  return leafletLoading;
}

async function cargarPoligonos(cont){
  if(!geoAMB){
    try {
      if(cont) cont.innerHTML = "<div style='text-align:center;color:#94a3b8;padding:20px'>Cargando zona AMB...</div>";
      const r1 = await fetch("VallasMap/AMB.json"); if(!r1.ok) throw new Error("HTTP "+r1.status);
      geoAMB = await r1.json();
    } catch(e){ console.warn("⚠️ AMB no cargado:", e); if(cont) cont.innerHTML = "<div style='text-align:center;color:#fbbf24;padding:20px'>⚠️ AMB no cargado. Siguiendo...</div>"; await new Promise(r => setTimeout(r, 800)); }
  }
  if(!geoZBE){
    try {
      if(cont) cont.innerHTML = "<div style='text-align:center;color:#94a3b8;padding:20px'>Cargando zona Rondas...</div>";
      const r2 = await fetch("VallasMap/ZBE.json"); if(!r2.ok) throw new Error("HTTP "+r2.status);
      geoZBE = await r2.json();
    } catch(e){ console.warn("⚠️ ZBE no cargado:", e); if(cont) cont.innerHTML = "<div style='text-align:center;color:#fbbf24;padding:20px'>⚠️ ZBE no cargado. Siguiendo...</div>"; await new Promise(r => setTimeout(r, 800)); }
  }
  if(!geoPROV){
    try {
      if(cont) cont.innerHTML = "<div style='text-align:center;color:#94a3b8;padding:20px'>Cargando provincia de Barcelona...</div>";
      const r3 = await fetch("VallasMap/ProvinciaBCN.json"); if(!r3.ok) throw new Error("HTTP "+r3.status);
      geoPROV = await r3.json();
    } catch(e){ console.warn("⚠️ Provincia BCN no cargada:", e); if(cont) cont.innerHTML = "<div style='text-align:center;color:#fbbf24;padding:20px'>⚠️ Provincia no cargada. Siguiendo...</div>"; await new Promise(r => setTimeout(r, 800)); }
  }
}

/* ==================== PANTALLA DEL MAPA ==================== */
async function abrirMapaPantalla(){
  const d=document.getElementById("drawer"),o=document.getElementById("overlay");
  if(d)d.classList.remove("active"); if(o)o.classList.remove("active");
  const p=document.getElementById("mapaPantalla"); if(p)p.style.display="block";
  const cont = document.getElementById("mapaContenido");
  cont.innerHTML = "<div style='text-align:center;color:#94a3b8;padding:20px'>Cargando librería de mapas...</div>";

  try { await cargarLeaflet(); }
  catch(e){ cont.innerHTML = "<div style='text-align:center;color:#ef4444;padding:20px'>❌ Error: "+e.message+"</div>"; return; }

  await cargarPoligonos(cont);

  cont.innerHTML = `
    <div id="geoEstadoBadge" style="text-align:center;margin-bottom:12px;padding:14px;border-radius:12px;border:2px solid #475569;background:linear-gradient(135deg,#1e293b,#0f172a);color:#94a3b8;font-size:15px;font-weight:900;letter-spacing:0.5px;transition:all 0.3s">⚫ RASTREO DETENIDO<div style='font-size:11px;font-weight:600;color:#94a3b8;margin-top:4px'>Pulsa INICIAR para empezar</div></div>
    <div style="position:relative;margin-bottom:12px">
      <div id="mapa-leaflet" style="width:100%;height:50vh;min-height:300px;border-radius:12px;background:#1e293b;border:1px solid #334155"></div>
      <button type="button" onclick="centrarEnMiUbicacion()" title="Mi ubicación" style="position:absolute;right:10px;bottom:20px;z-index:500;width:46px;height:46px;border-radius:50%;border:2px solid #0ea5e9;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;font-size:22px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:0;line-height:1">◎</button>
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
  renderListaRutasHistorial();
  aplicarEstadoHistorialRutas();
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

    // 👇 CAMBIO: En vez de una notificación aparte, actualizamos el texto del watcher
    await reiniciarWatcherConTexto(nuevaZona.nombre);

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
  // Filtro de precisión: aceptamos hasta 80m para no perder puntos en calles o túneles
  if (acc && acc > 80) return;

  const hoy = fechaLocalStr();
  if (cacheFechaHoy !== hoy) {
    cacheFechaHoy = hoy;
    try { cacheRecorridoHoy = JSON.parse(safeStorage.get(obtenerClaveRecorrido(hoy)) || "[]"); } catch(e) { cacheRecorridoHoy = []; }
  }

  if (cacheRecorridoHoy.length > 0) {
    const ultimo = cacheRecorridoHoy[cacheRecorridoHoy.length - 1];
    const dist = Math.sqrt(Math.pow(ultimo.lat - lat, 2) + Math.pow(ultimo.lon - lon, 2)) * 111000;
    // Distancia mínima de 5m y máxima de 1000m (por si pega un salto el GPS)
    if (dist < 5 || dist > 1000) return;
  }

  cacheRecorridoHoy.push({ lat: lat, lon: lon, time: Date.now() });

  // 👇 SUBIMOS EL LÍMITE A 35.000 PUNTOS (suficiente para 350km)
  if (cacheRecorridoHoy.length > 35000) {
    cacheRecorridoHoy.splice(0, 2000); 
  }

  // Guardado automático cada 20 segundos
  const ahora = Date.now();
  if (ahora - ultimoGuardadoRecorridoMs > 20000) {
    try {
      safeStorage.set(obtenerClaveRecorrido(hoy), JSON.stringify(cacheRecorridoHoy));
      ultimoGuardadoRecorridoMs = ahora;
    } catch(e) {}
  }
}

function obtenerRecorrido(fechaStr) {
  if (cacheFechaHoy === fechaStr && cacheRecorridoHoy) return cacheRecorridoHoy;
  return JSON.parse(safeStorage.get(obtenerClaveRecorrido(fechaStr)) || "[]");
}

function dibujarRecorridoEnMapa(fechaStr) {
  if (!mapaInstance) return;
  const claveMatched = "uberCambioRecorridoMatched_" + fechaStr;
  let puntosStr = safeStorage.get(claveMatched);
  let puntos = puntosStr ? JSON.parse(puntosStr) : obtenerRecorrido(fechaStr);
  if (!puntos || puntos.length < 2) return;
  if (capaRecorridoActual && capaRecorridoActual._fecha === fechaStr && capaRecorridoActual._numPuntos === puntos.length) return;
  if (capaRecorridoActual) { mapaInstance.removeLayer(capaRecorridoActual); capaRecorridoActual = null; }
  const coordenadas = puntos.map(p => [p.lat, p.lon]);
  capaRecorridoActual = L.polyline(coordenadas, { color: '#38bdf8', weight: 4, opacity: 0.9, lineJoin: 'round', smoothFactor: 1.5 }).addTo(mapaInstance);
  capaRecorridoActual._fecha = fechaStr;
  capaRecorridoActual._numPuntos = puntos.length;
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
    html += `<div style="display:flex; justify-content:space-between; align-items:center; background:#0f172a; border:1px solid ${esActual?'#3b82f6':'#334155'}; border-radius:8px; padding:10px;"><div style="font-size:14px; font-weight:800; color:#fff;">${fechaBonita} ${tieneMatched ? '<span title="Ajustada a calles" style="font-size:10px; color:#4ade80; border:1px solid #4ade80; padding:2px 4px; border-radius:4px; margin-left:4px;">CALLE</span>' : ''}</div><div style="display:flex; gap:6px;"><button type="button" onclick="verRutaHistorial('${f}')" style="background:${esActual?'#3b82f6':'#1e293b'}; color:#fff; border:none; border-radius:6px; padding:6px 10px; font-weight:700; font-size:12px; cursor:pointer;">${esActual ? 'Ocultar' : 'Ver'}</button><button type="button" onclick="borrarRutaHistorial('${f}')" style="background:#7f1d1d; color:#fca5a5; border:none; border-radius:6px; padding:6px 10px; font-size:14px; cursor:pointer;">🗑️</button></div></div>`;
  });
  cont.innerHTML = html;
}

function verRutaHistorial(fechaStr) {
  const inp = document.getElementById("fechaRutaInput"); if (!inp || !mapaInstance) return;
  if (inp.value === fechaStr && capaRecorridoActual) { mapaInstance.removeLayer(capaRecorridoActual); capaRecorridoActual = null; }
  else { inp.value = fechaStr; dibujarRecorridoEnMapa(fechaStr); if (capaRecorridoActual) { mapaInstance.fitBounds(capaRecorridoActual.getBounds(), { padding: [30, 30] }); } }
  renderListaRutasHistorial();
}

function borrarRutaHistorial(fechaStr) {
  if(!confirm("¿Borrar la ruta del " + fechaStr + "?\n\nEsta acción no se puede deshacer.")) return;
  localStorage.removeItem("uberCambioRecorrido_" + fechaStr);
  localStorage.removeItem("uberCambioRecorridoMatched_" + fechaStr);
  const inp = document.getElementById("fechaRutaInput");
  if (inp && inp.value === fechaStr && capaRecorridoActual) { mapaInstance.removeLayer(capaRecorridoActual); capaRecorridoActual = null; }
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
      requestPermissions: true, stale: false, distanceFilter: 10
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
  mostrarToast("🪄 Ajustando ruta a las calles...");
  const puntosAjustados = await ajustarRutaACalles(puntos);
  if (puntosAjustados && puntosAjustados.length > 1) {
    const claveMatched = "uberCambioRecorridoMatched_" + hoy;
    safeStorage.set(claveMatched, JSON.stringify(puntosAjustados));
    mostrarToast("✅ Ruta ajustada a las calles");
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