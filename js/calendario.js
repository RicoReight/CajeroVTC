/* ==================== VARIABLES GLOBALES DEL CALENDARIO ==================== */
let diasAnioVista = new Date().getFullYear();
let diasMesVista = new Date().getMonth();
let festivoModalFecha = null;
let vacCalAnio = new Date().getFullYear();
let vacCalMes = new Date().getMonth();
let vacCalInicio = null;
let vacCalFin = null;

/* ==================== UTILIDADES DE FECHAS Y ESTADOS ==================== */
function fechaCaducidad(festivo){
  const fecha = (typeof festivo === "string") ? festivo : festivo.fecha;
  const p = fecha.split("-");
  const d = new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2]));

  const enVac = diasPersonales.find(x => x.fecha === fecha && x.tipo === "vacacion");
  if(enVac) return null;

  if(esDiaNoTrabajado(fecha)){
    return new Date(parseInt(p[0]), 11, 31, 23, 59, 59);
  }
  return sumarMesesExacto(d, 2);
}

function diasHastaCaducar(festivo){
  const cad = fechaCaducidad(festivo);
  if(cad === null) return Infinity;
  const ahora = new Date();
  ahora.setHours(0,0,0,0);
  cad.setHours(0,0,0,0);
  return Math.ceil((cad - ahora) / (1000*60*60*24));
}

function fechaMinimaSolicitud(fechaFestivo){
  const p = fechaFestivo.split("-");
  const d = new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2]));
  d.setDate(d.getDate() + 1);
  return d;
}

function puedeSolicitarseHoy(festivo){
  const minima = fechaMinimaSolicitud(festivo.fecha);
  const hoy = new Date();
  hoy.setHours(0,0,0,0);
  minima.setHours(0,0,0,0);
  return hoy >= minima;
}

function estadoFestivo(f){
  const enVac = diasPersonales.find(x => x.fecha === f.fecha && x.tipo === "vacacion");
  if(enVac) return "vacaciones";

  if(!f.trabajado) return "libre";
  if(f.sacrificado) return "sacrificado";

  if(f.solicitado){
    if(!f.aprobado) return "solicitado";
    if(f.fechaDisfrute){
      const hoyStr = fechaLocalStr();
      if(f.fechaDisfrute < hoyStr) return "completado";
    }
    return "aprobado";
  }

  const hoy = new Date();
  hoy.setHours(0,0,0,0);
  const p = f.fecha.split("-");
  const fechaFest = new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2]));
  if(fechaFest > hoy) return "futuro";

  const d = diasHastaCaducar(f);
  if(d === Infinity) return "vacaciones";
  if(d < 0) return "caducado";
  if(d <= 15) return "porCaducar";
  return "acumulado";
}

function colorEstadoFestivo(estado){
  const c = {
    solicitado:"#ec4899", aprobado:"#4ade80", completado:"#94a3b8",
    acumulado:"#38bdf8", porCaducar:"#fbbf24", caducado:"#ef4444",
    libre:"#fb923c", sacrificado:"#78350f", futuro:"#fcd34d", vacaciones:"#22d3ee"
  };
  return c[estado] || "#64748b";
}

function nombreEstado(est){
  const n = {
    solicitado:"Solicitado", aprobado:"Aprobado", completado:"Completado",
    acumulado:"Acumulado", porCaducar:"Por caducar", caducado:"Caducado",
    libre:"No trabajado", sacrificado:"Sacrificado", futuro:"Aún no trabajado",
    vacaciones:"En vacaciones"
  };
  return n[est] || est;
}

function estaPendiente(f){
  const enVac = diasPersonales.find(x => x.fecha === f.fecha && x.tipo === "vacacion");
  if(enVac) return false;
  if(!f.trabajado) return false;
  if(f.sacrificado) return false;
  if(!f.solicitado){
    const d = diasHastaCaducar(f);
    return d !== Infinity && d >= 0;
  }
  if(!f.fechaDisfrute) return true;
  const hoyStr = fechaLocalStr();
  return f.fechaDisfrute >= hoyStr;
}

function archivarAniosAntiguos(){
  const anioActual = new Date().getFullYear();
  const porAnio = {};
  festivos.forEach(f => {
    const a = parseInt(f.fecha.slice(0,4));
    if(!porAnio[a]) porAnio[a] = [];
    porAnio[a].push(f);
  });

  const aniosABorrar = [];
  Object.keys(porAnio).forEach(aStr => {
    const a = parseInt(aStr);
    if(a >= anioActual) return;
    const lista = porAnio[a];
    const pendientes = lista.filter(estaPendiente);
    if(pendientes.length === 0) aniosABorrar.push(a);
  });

  if(aniosABorrar.length === 0) return false;

  festivos = festivos.filter(f => !aniosABorrar.includes(parseInt(f.fecha.slice(0,4))));
  saveFestivos();

  diasPersonales = diasPersonales.filter(d => !aniosABorrar.includes(parseInt(d.fecha.slice(0,4))));
  saveDiasPersonales();

  let cambiosVac = false;
  aniosABorrar.forEach(a => {
    if(diasVacacionesAsignados[String(a)] !== undefined){
      delete diasVacacionesAsignados[String(a)];
      cambiosVac = true;
    }
  });
  if(cambiosVac) saveVacacionesAsignados();

  return true;
}

/* ==================== CÁLCULO DEL LÍMITE DE DEPÓSITO ==================== */
function calcularLimiteDepositoReal(proxReset) {
  let limite = new Date(proxReset.getTime());
  let seguridad = 15;

  while (seguridad > 0) {
    const fechaStr = fechaLocalStr(limite);
    const esLibre = esDiaNoTrabajado(fechaStr);
    const enVac = diasPersonales.find(d => d.fecha === fechaStr && d.tipo === "vacacion");
    const esDisfrute = festivos.find(f => f.fechaDisfrute === fechaStr && f.solicitado);
    const esFestivoLibre = festivos.find(f => f.fecha === fechaStr && !f.trabajado);

    if (!esLibre && !enVac && !esDisfrute && !esFestivoLibre) {
      break; 
    }
    limite.setDate(limite.getDate() - 1);
    seguridad--;
  }

  limite.setHours(10, 0, 0, 0);
  return limite;
}

/* ==================== RENDER PRINCIPAL DEL CALENDARIO ==================== */
function renderDiasTrabajo(){
  const cont = document.getElementById("diasContenido");
  if(!cont) return;

  const anioActual = new Date().getFullYear();
  const anioSiguiente = anioActual + 1;
  const hoyStr = fechaLocalStr();

  const aniosBase = [anioActual, anioSiguiente];
  const aniosConPendientes = [];
  const aniosConFestivos = [...new Set(festivos.map(f => parseInt(f.fecha.slice(0,4))))];
  
  aniosConFestivos.forEach(a => {
    if(a >= anioActual) return;
    const lista = festivos.filter(f => parseInt(f.fecha.slice(0,4)) === a);
    if(lista.some(estaPendiente)) aniosConPendientes.push(a);
  });

  const aniosConPersonales = [...new Set(diasPersonales.map(d => parseInt(d.fecha.slice(0,4))))].filter(a => a >= anioActual);
  const anios = [...new Set([...aniosBase, ...aniosConPendientes, ...aniosConPersonales])].sort();

  if(!anios.includes(diasAnioVista)) diasAnioVista = anioActual;

  const festivosAnio = festivos.filter(f => parseInt(f.fecha.slice(0,4)) === diasAnioVista);

  const solicitados = festivosAnio.filter(f => estadoFestivo(f) === "solicitado").length;
  const aprobados   = festivosAnio.filter(f => estadoFestivo(f) === "aprobado").length;
  const completados = festivosAnio.filter(f => estadoFestivo(f) === "completado").length;
  const acumuladosTrab  = festivosAnio.filter(f => estadoFestivo(f) === "acumulado" && !esDiaNoTrabajado(f.fecha)).length;
  const acumuladosLibre = festivosAnio.filter(f => estadoFestivo(f) === "acumulado" &&  esDiaNoTrabajado(f.fecha)).length;
  const porCaducar  = festivosAnio.filter(f => estadoFestivo(f) === "porCaducar").length;

  const personalesAnio = diasPersonales.filter(d =>
    parseInt(d.fecha.slice(0,4)) === diasAnioVista && (!d.tipo || d.tipo === "personal")
  );
  const vacacionesAnio = diasPersonales.filter(d =>
    parseInt(d.fecha.slice(0,4)) === diasAnioVista && d.tipo === "vacacion"
  );
  const personalesRestantes = Math.max(0, 2 - personalesAnio.length);

  let html = "";

  // 👇 AQUÍ ESTÁ EL NUEVO BOTÓN DEL MODO WEB 👇
  html += `
    <div style="background:#1e293b; border:1px solid #334155; border-radius:12px; padding:16px; margin-bottom:14px; text-align:center;">
      <div style="font-size:12px; color:#38bdf8; font-weight:900; margin-bottom:10px;">💻 GESTIÓN DESDE EL PC O TABLET</div>
      <button type="button" id="btnModoWeb" onclick="toggleModoWeb()" style="width:100%; background:#0891b2; color:#fff; border:none; border-radius:10px; padding:12px; font-weight:800; font-size:14px; cursor:pointer; transition:0.3s;">
        🌐 ACTIVAR MODO WEB (PC)
      </button>
      <div id="ipWebDisplay" style="display:none; margin-top:14px; padding:12px; background:#0f172a; border:1px dashed #4ade80; border-radius:10px; line-height:1.5;"></div>
    </div>
  `;
  // 👆 FIN DEL BOTÓN DEL MODO WEB 👆

  html += `<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">`;
  anios.forEach(a => {
    const act = a === diasAnioVista;
    const tienePend = aniosConPendientes.includes(a) && a < anioActual;
    html += `<button type="button" onclick="cambiarAnioVista(${a})"
      style="flex:1;min-width:70px;padding:10px;border-radius:10px;border:2px solid ${act?'#3b82f6':'#334155'};
             background:${act?'#1e40af':'#0f172a'};color:${act?'#fff':'#94a3b8'};
             font-weight:800;cursor:pointer;font-size:14px;position:relative">
      ${a}${tienePend ? '<span style="position:absolute;top:2px;right:6px;font-size:10px;color:#fbbf24">⚠</span>' : ''}
    </button>`;
  });
  html += `</div>`;

  html += `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
      <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:10px">
        <div style="font-size:10px;color:#f97316;font-weight:900">💼 TRABAJADOS</div>
        <div style="font-size:22px;font-weight:900;color:#f97316;margin-top:4px">${acumuladosTrab}</div>
        <div style="font-size:9px;color:#94a3b8;margin-top:4px;font-weight:600">Caducan +2 meses</div>
      </div>
      <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:10px">
        <div style="font-size:10px;color:#22d3ee;font-weight:900">🏖️ LIBRANZA</div>
        <div style="font-size:22px;font-weight:900;color:#22d3ee;margin-top:4px">${acumuladosLibre}</div>
        <div style="font-size:9px;color:#94a3b8;margin-top:4px;font-weight:600">Caducan 31 dic</div>
      </div>
      <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:10px">
        <div style="font-size:10px;color:#94a3b8;font-weight:700">🟡 POR CADUCAR</div>
        <div style="font-size:22px;font-weight:900;color:#fbbf24;margin-top:4px">${porCaducar}</div>
      </div>
      <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:10px">
        <div style="font-size:10px;color:#94a3b8;font-weight:700">🟣 SOLICITADOS</div>
        <div style="font-size:22px;font-weight:900;color:#ec4899;margin-top:4px">${solicitados}</div>
      </div>
      <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:10px">
        <div style="font-size:10px;color:#94a3b8;font-weight:700">🟢 APROBADOS</div>
        <div style="font-size:22px;font-weight:900;color:#4ade80;margin-top:4px">${aprobados}</div>
      </div>
      <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:10px">
        <div style="font-size:10px;color:#94a3b8;font-weight:700">⚪ COMPLETADOS</div>
        <div style="font-size:22px;font-weight:900;color:#94a3b8;margin-top:4px">${completados}</div>
      </div>
    </div>
  `;

  {
    const asignadas = parseInt(diasVacacionesAsignados[String(diasAnioVista)]) || 0;
    const usadas = vacacionesAnio.filter(d => !d.noCuenta).length;
    const restantes = Math.max(0, asignadas - usadas);
    const pasadas = usadas > asignadas && asignadas > 0;
    const color = pasadas ? "#f87171" : (restantes === 0 && asignadas > 0 ? "#fbbf24" : "#22d3ee");

    html += `
      <div style="background:#1e293b;border:1px solid #164e63;border-radius:12px;padding:14px;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div style="font-size:12px;color:#22d3ee;font-weight:900;letter-spacing:1px">🏖️ VACACIONES ${diasAnioVista}</div>
          <button type="button" onclick="abrirModalDiasAsignados()"
            style="background:#0f172a;color:#22d3ee;border:1px solid #0891b2;border-radius:8px;
                   padding:6px 12px;font-weight:800;font-size:12px;cursor:pointer">
            ✏️ Asignados: ${asignadas}
          </button>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
          <div>
            <div style="font-size:11px;color:#94a3b8;font-weight:700">USADAS</div>
            <div style="font-size:30px;font-weight:900;color:${color};line-height:1.1">${usadas}<span style="font-size:18px;color:#64748b">/${asignadas || "—"}</span></div>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;color:#94a3b8;font-weight:700">${pasadas ? "TE PASASTE" : "TE QUEDAN"}</div>
            <div style="font-size:26px;font-weight:900;color:${pasadas ? "#f87171" : "#4ade80"};line-height:1.1">
              ${pasadas ? "−" + (usadas - asignadas) : restantes}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const nombresMes = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  html += `
    <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:14px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <button type="button" onclick="cambiarMesVista(-1)" style="background:#334155;color:#fff;border:none;width:36px;height:36px;border-radius:10px;font-size:18px;font-weight:900;cursor:pointer">◀</button>
        <div style="font-size:16px;font-weight:900;color:#38bdf8">${nombresMes[diasMesVista]} (${diasMesVista+1}) ${diasAnioVista}</div>
        <button type="button" onclick="cambiarMesVista(1)" style="background:#334155;color:#fff;border:none;width:36px;height:36px;border-radius:10px;font-size:18px;font-weight:900;cursor:pointer">▶</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:8px">
        ${["L","M","X","J","V","S","D"].map(d => `<div style="text-align:center;font-size:11px;color:#64748b;font-weight:900">${d}</div>`).join("")}
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">
        ${renderCalendarioMes()}
      </div>
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid #334155;font-size:11px;color:#94a3b8;">
        <div style="font-size:10px;color:#64748b;font-weight:900;letter-spacing:0.5px;margin-bottom:6px">📅 FESTIVOS</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:6px"><div style="width:14px;height:14px;border-radius:4px;background:rgba(56,189,248,0.45);border:2px solid #38bdf8"></div>Acumulado</div>
          <div style="display:flex;align-items:center;gap:6px"><div style="width:14px;height:14px;border-radius:4px;background:rgba(251,191,36,0.45);border:2px solid #fbbf24"></div>Por caducar</div>
          <div style="display:flex;align-items:center;gap:6px"><div style="width:14px;height:14px;border-radius:4px;background:rgba(239,68,68,0.45);border:2px solid #ef4444"></div>Caducado</div>
          <div style="display:flex;align-items:center;gap:6px"><div style="width:14px;height:14px;border-radius:4px;background:rgba(236,72,153,0.45);border:2px solid #ec4899"></div>Solicitado</div>
          <div style="display:flex;align-items:center;gap:6px"><div style="width:14px;height:14px;border-radius:4px;background:rgba(74,222,128,0.45);border:2px solid #4ade80"></div>Aprobado</div>
          <div style="display:flex;align-items:center;gap:6px"><div style="width:14px;height:14px;border-radius:4px;background:rgba(148,163,184,0.45);border:2px solid #94a3b8"></div>Completado</div>
          <div style="display:flex;align-items:center;gap:6px"><div style="width:14px;height:14px;border-radius:4px;background:rgba(120,53,15,0.65);border:2px solid #78350f"></div>Sacrificado</div>
          <div style="display:flex;align-items:center;gap:6px"><div style="width:14px;height:14px;border-radius:4px;background:rgba(251,146,60,0.45);border:2px solid #fb923c"></div>No trabajado</div>
        </div>
        <div style="font-size:10px;color:#64748b;font-weight:900;letter-spacing:0.5px;margin-bottom:6px">🏖️ DÍAS LIBRES</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px">
          <div style="display:flex;align-items:center;gap:6px"><div style="width:14px;height:14px;border-radius:4px;background:rgba(34,211,238,0.45);border:2px solid #22d3ee"></div>Vacaciones</div>
          <div style="display:flex;align-items:center;gap:6px"><div style="width:14px;height:14px;border-radius:4px;background:rgba(167,139,250,0.45);border:2px solid #a78bfa"></div>Día personal</div>
        </div>
      </div>
    </div>
  `;

  html += `<div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:14px;margin-bottom:14px">`;
  html += `<div style="font-size:12px;color:#94a3b8;font-weight:900;letter-spacing:1px;margin-bottom:10px">📅 FESTIVOS ${diasAnioVista}</div>`;

  if(festivosAnio.length === 0){
    html += `<div style="text-align:center;color:#64748b;font-size:13px;padding:14px">No hay festivos este año.</div>`;
  } else {
    festivosAnio.forEach(f => {
      const estaEnVacaciones = diasPersonales.find(d => d.fecha === f.fecha && d.tipo === "vacacion");
      const est = estadoFestivo(f);
      const col = estaEnVacaciones ? "#22d3ee" : colorEstadoFestivo(est);
      const dl = diasHastaCaducar(f);
      let txtDias = "";
      let txtDisfrute = "";

      if(est === "porCaducar") txtDias = `<span style="color:#fbbf24;font-weight:900;font-size:11px">${dl}d</span>`;
      else if(est === "caducado") txtDias = `<span style="color:#ef4444;font-weight:900;font-size:11px">caducado</span>`;
      else if(est === "acumulado") txtDias = `<span style="color:#64748b;font-weight:700;font-size:11px">${dl}d</span>`;

      if(f.solicitado && f.fechaDisfrute && !f.sacrificado){
        const disfrutado = f.fechaDisfrute < hoyStr;
        const icono = disfrutado ? '✓' : (f.aprobado ? '✅' : '⏳');
        const colorTxt = disfrutado ? '#64748b' : (f.aprobado ? '#4ade80' : '#ec4899');
        txtDisfrute = `<div style="font-size:10px;color:${colorTxt};margin-top:2px">${icono} Disfrute: ${formatearFechaBonita(f.fechaDisfrute)}</div>`;
      }
      if(f.sacrificado){
        txtDisfrute = `<div style="font-size:10px;color:#fde68a;margin-top:2px">🔥 Sacrificado por la empresa</div>`;
      }

      html += `
        <div onclick="abrirModalFestivo('${f.fecha}')" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #1e293b;cursor:pointer">
          <div style="width:12px;height:12px;border-radius:50%;background:${col};flex-shrink:0"></div>
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;color:#fff;font-weight:700">${formatearFechaBonita(f.fecha)}</div>
            <div style="font-size:12px;color:#94a3b8;margin-top:2px">${f.nombre}</div>
            ${txtDisfrute}
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:11px;color:${col};font-weight:800;text-transform:uppercase">${estaEnVacaciones ? "🏖️ Vacaciones" : nombreEstado(est)}</div>
            ${txtDias}
          </div>
        </div>
      `;
    });
  }
  html += `</div>`;

  html += `<button type="button" onclick="abrirModalVacaciones()" style="width:100%;margin-bottom:8px;background:#0891b2;color:#fff;border:none;border-radius:10px;padding:14px;font-weight:800;font-size:14px;cursor:pointer">🏖️ AÑADIR VACACIONES</button>`;

  html += `
    <div style="display:flex;gap:8px;margin-bottom:14px">
      <button type="button" onclick="importarICS()" style="flex:1;background:#0e7490;color:#fff;border:none;border-radius:10px;padding:12px;font-weight:800;font-size:13px;cursor:pointer">📥 Importar .ics</button>
      <button type="button" onclick="abrirModalFestivoNuevo()" style="flex:1;background:#334155;color:#fff;border:none;border-radius:10px;padding:12px;font-weight:800;font-size:13px;cursor:pointer">+ Añadir festivo</button>
    </div>
    <input type="file" id="icsInput" accept=".ics,text/calendar" style="display:none" onchange="onICSSeleccionado(event)">
  `;

  cont.innerHTML = html;
}

function renderCalendarioMes(){
  const primerDia = new Date(diasAnioVista, diasMesVista, 1);
  const totalDias = new Date(diasAnioVista, diasMesVista + 1, 0).getDate();
  const diaSemanaInicio = (primerDia.getDay() + 6) % 7;

  const hexToRgba = (hex, alpha) => {
    const h = hex.replace("#","");
    const r = parseInt(h.substring(0,2),16), g = parseInt(h.substring(2,4),16), b = parseInt(h.substring(4,6),16);
    return `rgba(${r},${g},${b},${alpha})`;
  };

  let html = "";
  for(let i = 0; i < diaSemanaInicio; i++) html += `<div style="aspect-ratio:1"></div>`;

  for(let d = 1; d <= totalDias; d++){
    const fechaStr = `${diasAnioVista}-${String(diasMesVista+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    
    const festivoOriginal = festivos.find(f => f.fecha === fechaStr);
    const festivoDisfrute = festivos.find(f => f.fechaDisfrute === fechaStr && f.solicitado);
    const festivo = festivoOriginal || festivoDisfrute;
    const diaPersonal = diasPersonales.find(f => f.fecha === fechaStr);

    let colorEstado = null, etiqueta = "";
    if(festivoOriginal && festivoOriginal.fechaDisfrute && (festivoOriginal.solicitado || festivoOriginal.aprobado)) {
      colorEstado = colorEstadoFestivo("solicitado");
    } else if(festivoDisfrute) {
      colorEstado = colorEstadoFestivo(estadoFestivo(festivoDisfrute));
      etiqueta = "DISF";
    } else if(diaPersonal){
      colorEstado = diaPersonal.tipo === "vacacion" ? "#22d3ee" : "#a78bfa";
      etiqueta = diaPersonal.tipo === "vacacion" ? "VAC" : "PER";
    } else if(festivo){
      colorEstado = colorEstadoFestivo(estadoFestivo(festivo));
    }

    const hoy = new Date();
    const esHoy = (hoy.getFullYear() === diasAnioVista && hoy.getMonth() === diasMesVista && hoy.getDate() === d);

    let bg, border, colorNum, shadow, fontWeight;
    const esLibre = esDiaNoTrabajado(fechaStr); // 👈 Comprobamos si es Lunes o Domingo
    
    if(colorEstado){
      // Tiene prioridad si hay un festivo o vacaciones
      bg = hexToRgba(colorEstado, 0.45);
      border = colorEstado;
      colorNum = "#fff";
      fontWeight = "900";
      shadow = "inset 0 0 0 1px rgba(0,0,0,0.2)";
    } else if(esLibre) {
      // 👇 ESTILO NUEVO PARA TUS DÍAS LIBRES
      bg = "#1e293b";            // Fondo un poco más claro
      border = "#475569";        // Borde más visible
      colorNum = "#94a3b8";      // Texto gris azulado
      fontWeight = "700";
      shadow = "inset 0 0 0 1px rgba(255,255,255,0.05)";
    } else {
      // Días de trabajo normales
      bg = "#0f172a"; border = "#334155"; colorNum = "#cbd5e1"; fontWeight = "600"; shadow = "none";
    }

    if(esHoy){
      if(!colorEstado){ bg = "#1e3a8a"; border = "#3b82f6"; colorNum = "#fff"; }
      shadow = "0 0 0 3px rgba(59,130,246,0.7), inset 0 0 0 1px rgba(0,0,0,0.2)";
    }

    let click = "";
    if(festivoOriginal){
      if(festivoOriginal.fechaDisfrute && (festivoOriginal.solicitado || festivoOriginal.aprobado)){
        click = `onclick="irADiaDisfrute('${festivoOriginal.fechaDisfrute}')"`;
      } else {
        click = `onclick="abrirModalFestivo('${fechaStr}')"`;
      }
    } else if(festivoDisfrute){
      click = `onclick="abrirModalFestivo('${festivoDisfrute.fecha}')"`;
    } else if(diaPersonal){
      click = `onclick="borrarDiaPersonal('${fechaStr}')"`;
    }

    html += `
      <div ${click} style="aspect-ratio:1;background:${bg};border:2px solid ${border};border-radius:8px;box-shadow:${shadow};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2px;position:relative;cursor:${colorEstado?'pointer':'default'};transition:transform 0.1s, background 0.15s;">
        <div style="font-size:13px;color:${colorNum};font-weight:${fontWeight};line-height:1;">${d}</div>
        ${etiqueta ? `<div style="font-size:7px;color:${colorEstado};font-weight:900;letter-spacing:0.3px;margin-top:2px;line-height:1;">${etiqueta}</div>` : ""}
      </div>
    `;
  }
  return html;
}

function irADiaDisfrute(fechaDisfrute) {
  if(!fechaDisfrute) return;
  const p = fechaDisfrute.split("-");
  diasAnioVista = parseInt(p[0]);
  diasMesVista = parseInt(p[1]) - 1;
  renderDiasTrabajo();
  mostrarToast("📅 Saltando al día de disfrute");
}

function cambiarAnioVista(a){ diasAnioVista = a; renderDiasTrabajo(); }
function cambiarMesVista(delta){
  diasMesVista += delta;
  if(diasMesVista < 0){ diasMesVista = 11; diasAnioVista--; }
  else if(diasMesVista > 11){ diasMesVista = 0; diasAnioVista++; }
  renderDiasTrabajo();
}

/* ==================== MODAL DE FESTIVO ==================== */
function abrirModalFestivo(fechaStr){
  const f = festivos.find(x => x.fecha === fechaStr);
  if(!f) return;
  festivoModalFecha = fechaStr;

  const prev = document.getElementById("modalFestivo");
  if(prev) prev.remove();

  const m = document.createElement("div");
  m.id = "modalFestivo";
  m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px";

  m.innerHTML = `
    <div style="background:#1e293b;border-radius:16px;padding:20px;max-width:380px;width:100%;border:1px solid #334155">
      <div style="font-size:16px;font-weight:900;color:#38bdf8;text-align:center;margin-bottom:4px">${formatearFechaBonita(f.fecha)}</div>
      <div style="font-size:13px;color:#94a3b8;text-align:center;margin-bottom:18px">${f.nombre}</div>

      <div style="font-size:11px;color:#64748b;font-weight:800;margin-bottom:8px">ESTADO</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
        <button type="button" onclick="setFestivoTrabajado(true)" style="padding:14px 8px;border-radius:10px;border:2px solid ${f.trabajado?'#22c55e':'#475569'};background:${f.trabajado?'linear-gradient(135deg,#14532d,#15803d)':'#0f172a'};color:${f.trabajado?'#4ade80':'#94a3b8'};font-weight:900;cursor:pointer;font-size:14px">✅ Trabajado</button>
        <button type="button" onclick="setFestivoTrabajado(false)" style="padding:14px 8px;border-radius:10px;border:2px solid ${!f.trabajado?'#64748b':'#475569'};background:${!f.trabajado?'#334155':'#0f172a'};color:${!f.trabajado?'#cbd5e1':'#94a3b8'};font-weight:900;cursor:pointer;font-size:14px">⚪ No trabajado</button>
      </div>

      ${f.trabajado ? `
        <div style="font-size:11px;color:#64748b;font-weight:800;margin-bottom:8px">¿LO HAS SOLICITADO?</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
          <button type="button" onclick="setFestivoSolicitado(true)" style="padding:14px 8px;border-radius:10px;border:2px solid ${f.solicitado&&!f.sacrificado?'#ec4899':'#475569'};background:${f.solicitado&&!f.sacrificado?'linear-gradient(135deg,#831843,#be185d)':'#0f172a'};color:${f.solicitado&&!f.sacrificado?'#fbcfe8':'#94a3b8'};font-weight:900;cursor:pointer;font-size:14px">🌸 Sí</button>
          <button type="button" onclick="setFestivoSolicitado(false)" style="padding:14px 8px;border-radius:10px;border:2px solid ${!f.solicitado&&!f.sacrificado?'#fbbf24':'#475569'};background:${!f.solicitado&&!f.sacrificado?'#78350f':'#0f172a'};color:${!f.solicitado&&!f.sacrificado?'#fbbf24':'#94a3b8'};font-weight:900;cursor:pointer;font-size:14px">🟡 No</button>
        </div>

        ${f.solicitado && !f.sacrificado ? `
          <div style="font-size:11px;color:#64748b;font-weight:800;margin-bottom:8px">APROBACIÓN DE LA EMPRESA</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
            <button type="button" onclick="setFestivoAprobado(true)" style="padding:14px 8px;border-radius:10px;border:2px solid ${f.aprobado?'#22c55e':'#475569'};background:${f.aprobado?'linear-gradient(135deg,#14532d,#15803d)':'#0f172a'};color:${f.aprobado?'#4ade80':'#94a3b8'};font-weight:900;cursor:pointer;font-size:14px">🟢 Aprobado</button>
            <button type="button" onclick="setFestivoAprobado(false)" style="padding:14px 8px;border-radius:10px;border:2px solid ${!f.aprobado?'#ec4899':'#475569'};background:${!f.aprobado?'#831843':'#0f172a'};color:${!f.aprobado?'#fbcfe8':'#94a3b8'};font-weight:900;cursor:pointer;font-size:14px">🌸 Pendiente</button>
          </div>
        ` : ""}

        <div style="font-size:11px;color:#64748b;font-weight:800;margin-bottom:8px">O SACRIFICADO POR LA EMPRESA</div>
        <button type="button" onclick="setFestivoSacrificado(${!f.sacrificado})" style="width:100%;padding:14px 8px;border-radius:10px;border:2px solid ${f.sacrificado?'#78350f':'#475569'};background:${f.sacrificado?'linear-gradient(135deg,#451a03,#78350f)':'#0f172a'};color:${f.sacrificado?'#fde68a':'#94a3b8'};font-weight:900;cursor:pointer;font-size:14px;margin-bottom:16px">🔥 ${f.sacrificado ? "Sacrificado · pulsa para quitar" : "Marcar como sacrificado"}</button>

        ${f.sacrificado ? `<div style="background:#451a03;border:1px solid #78350f;border-radius:10px;padding:10px;margin-bottom:14px;font-size:12px;color:#fde68a;line-height:1.5;text-align:center">🔥 Este festivo fue <b>sacrificado</b> por la empresa<br>No cuenta como pendiente ni bloquea el año</div>` : ""}

        ${!f.sacrificado && f.solicitado && f.fechaDisfrute ? `
          <div style="background:${f.aprobado ? '#064e3b' : '#831843'};border:1px solid ${f.aprobado ? '#059669' : '#ec4899'};border-radius:10px;padding:10px;margin-bottom:14px;font-size:12px;color:${f.aprobado ? '#a7f3d0' : '#fbcfe8'};line-height:1.5;text-align:center">
            ${f.aprobado ? '✅ Aprobado por la empresa' : '🌸 Pendiente de aprobación'}<br>
            🎉 Disfrute: <b style="font-size:15px;color:#fff">${formatearFechaBonita(f.fechaDisfrute)}</b>
            ${f.fechaDisfrute < fechaLocalStr() ? `<br><span style="color:#64748b">(ya disfrutado)</span>` : ""}
          </div>
          <button type="button" onclick="editarFechaDisfrute()" style="width:100%;margin-bottom:10px;background:#0f172a;color:#22d3ee;border:1px solid #0891b2;border-radius:10px;padding:10px;font-weight:700;font-size:13px;cursor:pointer">✏️ Cambiar fecha de disfrute</button>
        ` : ""}

        ${(() => {
          const enVac = diasPersonales.find(x => x.fecha === f.fecha && x.tipo === "vacacion");
          if(enVac) return `<div style="background:#164e63;border:1px solid #0891b2;border-radius:10px;padding:12px;margin-bottom:14px;font-size:13px;color:#a5f3fc;line-height:1.5;text-align:center">🏖️ Este festivo cae en vacaciones<br><span style="font-size:11px;color:#22d3ee">No se puede solicitar</span></div>`;
          const cad = fechaCaducidad(f);
          const d = diasHastaCaducar(f);
          let txtDias = "";
          if(d === Infinity) txtDias = "";
          else if(d < 0) txtDias = `<br><b style="color:#ef4444">Ya ha caducado</b>`;
          else txtDias = `<br>Quedan <b style="color:${d<=15?'#fbbf24':'#4ade80'}">${d} días</b>`;
          const min = fechaMinimaSolicitud(f.fecha);
          const etiqueta = esDiaNoTrabajado(f.fecha) ? "🎉 Día no trabajado · caduca el" : "📅 Caduca el";
          return `<div style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:12px;margin-bottom:14px;font-size:12px;color:#94a3b8;line-height:1.6">${etiqueta} <b style="color:#fff">${formatearFechaBonita(fechaLocalStr(cad))}</b>${txtDias}<br><span style="font-size:11px;color:#64748b">Puedes solicitarlo desde el <b style="color:#94a3b8">${formatearFechaBonita(fechaLocalStr(min))}</b></span></div>`;
        })()}
      ` : ""}

      <div style="display:flex;gap:8px;margin-top:16px">
        <button type="button" onclick="cerrarModalFestivo()" style="flex:1;background:#334155;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer">Cerrar</button>
        <button type="button" onclick="borrarFestivo('${f.fecha}')" style="flex:0 0 auto;background:#7f1d1d;color:#fca5a5;border:none;padding:12px 16px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer">🗑️</button>
      </div>
    </div>
  `;

  document.body.appendChild(m);
  m.addEventListener("click", (e) => { if(e.target === m) cerrarModalFestivo(); });
}

function cerrarModalFestivo(){
  const m = document.getElementById("modalFestivo");
  if(m) m.remove();
  festivoModalFecha = null;
}

function setFestivoTrabajado(v){
  if(!festivoModalFecha) return;
  const f = festivos.find(x => x.fecha === festivoModalFecha);
  if(!f) return;
  f.trabajado = v;
  if(!v){ f.solicitado = false; f.aprobado = false; f.fechaDisfrute = null; }
  saveFestivos();
  abrirModalFestivo(festivoModalFecha);
  renderDiasTrabajo();
}

function setFestivoAprobado(v){
  if(!festivoModalFecha) return;
  const f = festivos.find(x => x.fecha === festivoModalFecha);
  if(!f) return;
  f.aprobado = !!v;
  saveFestivos();
  abrirModalFestivo(festivoModalFecha);
  renderDiasTrabajo();
}

function setFestivoSolicitado(v){
  if(!festivoModalFecha) return;
  const f = festivos.find(x => x.fecha === festivoModalFecha);
  if(!f) return;

  const enVac = diasPersonales.find(x => x.fecha === f.fecha && x.tipo === "vacacion");
  if(enVac){ mostrarToast("🏖️ Este festivo cae en vacaciones. No se puede solicitar."); return; }

  if(v){
    if(!puedeSolicitarseHoy(f)){
      const min = fechaMinimaSolicitud(f.fecha);
      mostrarToast("⏳ Podrás solicitarlo a partir del " + formatearFechaBonita(fechaLocalStr(min)));
      return;
    }

    pedirFechaDisfrute(f, (resp) => {
      if(resp === null) return;
      const hoy = new Date();
      const sugerido = hoy.getFullYear() + "-" + String(hoy.getMonth()+1).padStart(2,"0") + "-" + String(hoy.getDate()).padStart(2,"0");
      f.solicitado = true;
      f.fechaSolicitud = f.fechaSolicitud || sugerido;
      f.fechaDisfrute = resp;
      saveFestivos();
      abrirModalFestivo(festivoModalFecha);
      renderDiasTrabajo();
      try{ if(archivarAniosAntiguos()) renderDiasTrabajo(); }catch(e){}
    });
  } else {
    f.solicitado = false; f.aprobado = false; f.fechaSolicitud = null; f.fechaDisfrute = null;
    saveFestivos();
    abrirModalFestivo(festivoModalFecha);
    renderDiasTrabajo();
  }
}

function setFestivoSacrificado(v){
  if(!festivoModalFecha) return;
  const f = festivos.find(x => x.fecha === festivoModalFecha);
  if(!f) return;
  if(v){
    if(!confirm("🔥 MARCAR COMO SACRIFICADO\n\nEste festivo lo sacrificó la empresa.\n\n👉 No sumará días a tus vacaciones.\n👉 Solo queda registrado como sacrificado.")) return;
    f.sacrificado = true; f.solicitado = false; f.aprobado = false; f.fechaSolicitud = null; f.fechaDisfrute = null;
    mostrarToast("🔥 Marcado como sacrificado");
  } else { f.sacrificado = false; }
  saveFestivos();
  abrirModalFestivo(festivoModalFecha);
  renderDiasTrabajo();
  try{ if(archivarAniosAntiguos()) renderDiasTrabajo(); }catch(e){}
}

function pedirFechaDisfrute(f, callback){
  const prev = document.getElementById("modalFechaDisfrute");
  if(prev) prev.remove();

  const minDate = fechaMinimaSolicitud(f.fecha);
  const maxDate = fechaCaducidad(f);
  if(!maxDate){ alert("⚠️ Este festivo no se puede solicitar."); callback(null); return; }
  minDate.setHours(0,0,0,0); maxDate.setHours(23,59,59,999);

  const minStr = fechaLocalStr(minDate), maxStr = fechaLocalStr(maxDate);
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  let sugeridoDate;
  if(f.fechaDisfrute) sugeridoDate = new Date(f.fechaDisfrute + "T00:00:00");
  else if(hoy < minDate) sugeridoDate = new Date(minDate);
  else if(hoy > maxDate) sugeridoDate = new Date(maxDate);
  else sugeridoDate = new Date(hoy);
  const sugerido = fechaLocalStr(sugeridoDate);

  const m = document.createElement("div");
  m.id = "modalFechaDisfrute";
  m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px";
  m.innerHTML = `
    <div style="background:#1e293b;border-radius:16px;padding:20px;max-width:380px;width:100%;border:1px solid #334155">
      <div style="font-size:16px;font-weight:900;color:#22d3ee;text-align:center;margin-bottom:6px">🎉 Día de disfrute</div>
      <div style="font-size:12px;color:#94a3b8;text-align:center;margin-bottom:18px;line-height:1.4">¿Qué día vas a disfrutar esta fiesta?<br><span style="color:#64748b;font-size:11px">${f.nombre} · ${formatearFechaBonita(f.fecha)}</span></div>
      <div style="font-size:11px;color:#64748b;font-weight:800;margin-bottom:6px">FECHA DE DISFRUTE</div>
      <input type="date" id="fdFecha" value="${sugerido}" min="${minStr}" max="${maxStr}" style="width:100%;font-size:18px;padding:14px;border-radius:10px;border:2px solid #0891b2;background:#0f172a;color:#fff;margin-bottom:16px;outline:none">
      <div style="font-size:11px;color:#22d3ee;font-weight:700;padding:10px 12px;background:#164e63;border-radius:8px;margin-bottom:16px;line-height:1.5;text-align:center">📅 Del <b>${formatearFechaBonita(minStr)}</b><br>al <b>${formatearFechaBonita(maxStr)}</b></div>
      <div style="display:flex;gap:8px">
        <button type="button" id="fdCancelar" style="flex:1;background:#334155;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer">Cancelar</button>
        <button type="button" id="fdGuardar" style="flex:1;background:#0891b2;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer">✅ Guardar</button>
      </div>
    </div>
  `;
  document.body.appendChild(m);
  const cerrar = () => m.remove();
  m.addEventListener("click", (e) => { if(e.target === m){ cerrar(); callback(null); } });
  document.getElementById("fdCancelar").onclick = () => { cerrar(); callback(null); };
  document.getElementById("fdGuardar").onclick = () => {
    const v = document.getElementById("fdFecha").value;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(v)){ alert("Selecciona una fecha válida"); return; }
    const fecha = new Date(v + "T00:00:00");
    if(fecha < minDate || fecha > maxDate){ alert("⚠️ Fecha fuera del plazo\n\nDebe estar entre el " + formatearFechaBonita(minStr) + " y el " + formatearFechaBonita(maxStr) + "."); return; }
    cerrar(); callback(v);
  };
}

function editarFechaDisfrute(){
  if(!festivoModalFecha) return;
  const f = festivos.find(x => x.fecha === festivoModalFecha);
  if(!f) return;
  pedirFechaDisfrute(f, (resp) => {
    if(resp === null) return;
    f.fechaDisfrute = resp;
    saveFestivos(); abrirModalFestivo(festivoModalFecha); renderDiasTrabajo();
  });
}

function borrarFestivo(fecha){
  if(!confirm("¿Borrar este festivo?")) return;
  festivos = festivos.filter(f => f.fecha !== fecha);
  saveFestivos(); cerrarModalFestivo(); renderDiasTrabajo();
}

/* ==================== SERVIDOR WEB LOCAL (MODO PC) ==================== */
let modoWebActivo = false;
let servidorWeb = null;
let listenerHandle = null;

async function toggleModoWeb() {
  const btn = document.getElementById("btnModoWeb");
  const display = document.getElementById("ipWebDisplay");

  if (modoWebActivo) {
    if (listenerHandle) { try { await listenerHandle.remove(); } catch(e){} listenerHandle = null; }
    if (servidorWeb) { try { await servidorWeb.stop(); } catch(e){} servidorWeb = null; }
    modoWebActivo = false;
    if(btn) { btn.innerHTML = "🌐 ACTIVAR MODO WEB (PC)"; btn.style.background = "#0891b2"; }
    if(display) display.style.display = "none";
    mostrarToast("Modo Web desactivado");
    return;
  }

  try {
    const { HttpServer } = Capacitor.Plugins;
    if (!HttpServer) { alert("⚠️ El plugin no está compilado."); return; }

    listenerHandle = await HttpServer.addListener('request', async (req) => {
      console.log("📥 Petición recibida:", req.path);

      // 1. Sincronización (Recibir datos del PC y guardarlos en el móvil)
      if (req.path === '/sync' && req.method === 'POST') {
        try {
          const data = JSON.parse(req.bodyText || req.body);
          if (data.key && data.value !== undefined) {
            safeStorage.set(data.key, data.value);
            if (data.key.includes("Festivos") || data.key.includes("DiasPersonales")) {
              setTimeout(() => { if(typeof renderDiasTrabajo === 'function') renderDiasTrabajo(); }, 100);
            }
          }
          await HttpServer.respond({ requestId: req.requestId, status: 200, bodyText: "OK" });
        } catch (e) {
          await HttpServer.respond({ requestId: req.requestId, status: 500, bodyText: "Error" });
        }
        return;
      }

      // 2. Enviar TODOS los datos al PC (para que el PC se sincronice al entrar)
      if (req.path === '/get-all-data' && req.method === 'GET') {
        try {
          const datos = {};
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith("uberCambio")) {
              datos[key] = localStorage.getItem(key);
            }
          }
          await HttpServer.respond({ 
            requestId: req.requestId, 
            status: 200, 
            bodyText: JSON.stringify(datos), 
            headers: { "Content-Type": "application/json" } 
          });
        } catch (e) {
          await HttpServer.respond({ requestId: req.requestId, status: 500, bodyText: "{}" });
        }
        return;
      }

      // 3. Servir los archivos al PC (HTML, JS, CSS, etc.)
      let filePath = req.path === '/' ? 'index.html' : req.path;
      filePath = filePath.split('?')[0]; 
      filePath = filePath.replace(/^\//, ''); // Quitar la barra inicial

      try {
        // Límite de 3 segundos para evitar que el PC se quede en blanco
        const fetchPromise = fetch(filePath);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout de red")), 3000));
        const resp = await Promise.race([fetchPromise, timeoutPromise]);

        if (resp && resp.ok) {
          const text = await resp.text();
          
          let mime = 'text/plain';
          if (filePath.endsWith('.html') || filePath === 'index.html') mime = 'text/html';
          else if (filePath.endsWith('.js')) mime = 'application/javascript';
          else if (filePath.endsWith('.css')) mime = 'text/css';
          else if (filePath.endsWith('.json')) mime = 'application/json';
          else if (filePath.endsWith('.png')) mime = 'image/png';
          else if (filePath.endsWith('.svg')) mime = 'image/svg+xml';
          else if (filePath.endsWith('.ico')) mime = 'image/x-icon';

          await HttpServer.respond({ 
            requestId: req.requestId, 
            status: 200, 
            bodyText: text, 
            headers: { "Content-Type": mime } 
          });
        } else {
          await HttpServer.respond({ requestId: req.requestId, status: 404, bodyText: "Not found" });
        }
      } catch (e) {
        console.error("Error sirviendo archivo:", e);
        await HttpServer.respond({ requestId: req.requestId, status: 500, bodyText: "Error cargando archivo" }).catch(()=>{});
      }
    });

    // Arrancar servidor en el puerto 8080
    servidorWeb = await HttpServer.start({
      port: 8080, 
      android: {
        notificationTitle: 'CambioVTC - Modo Web',
        notificationText: 'Servidor local activo en el puerto 8080',
        channelId: 'modo_web',
        channelName: 'Modo Web'
      }
    });
    
    modoWebActivo = true;
    
    // Extraer IP
    let ip = "IP_DEL_MOVIL";
    if (servidorWeb.urls && servidorWeb.urls.length > 0) {
        ip = servidorWeb.urls[0].split(':')[1].replace('//', '');
    } else if (servidorWeb.url) {
        ip = servidorWeb.url.split(':')[1].replace('//', '');
    }
    
    if(btn) { btn.innerHTML = "🔴 DETENER MODO WEB"; btn.style.background = "#7f1d1d"; }
    if(display) {
      display.style.display = "block";
      display.innerHTML = `
        <div style="font-size:13px; color:#fff; margin-bottom:8px;">Abre esta dirección en el navegador de tu PC:</div>
        <div style="font-size:22px; font-weight:900; color:#4ade80; letter-spacing:1px;">http://${ip}:8080</div>
        <div style="font-size:11px; color:#94a3b8; margin-top:8px;">Wi-Fi obligatorio. El móvil debe tener internet.</div>
      `;
    }
    mostrarToast("🌐 Servidor Web activo");
  } catch(e) {
    console.error(e);
    alert("❌ Error al iniciar el servidor: " + e.message);
  }
}