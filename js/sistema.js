/* ==================== VARIABLES GLOBALES PENDIENTES ==================== */
let diasSemanaNombres = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function saveHistorialOps(h){ safeStorage.set("uberCambioHistorialOps", JSON.stringify(h)); }

/* ==================== LÍMITES Y RESERVAS ==================== */
function abrirLimitePantalla(){
  const d=document.getElementById("drawer"),o=document.getElementById("overlay");
  if(d)d.classList.remove("active"); if(o)o.classList.remove("active");
  const p=document.getElementById("limitePantalla"); if(p)p.style.display="block";
  
  const inpFactor = document.getElementById("factorLlenadoInput");
  if(inpFactor) inpFactor.value = Math.round(FACTOR_LLENADO * 100);
  if(typeof actualizarTextoMargen === "function") actualizarTextoMargen();

  renderReservaList();
  renderTopesList();
}
function cerrarLimitePantalla(){ const p=document.getElementById("limitePantalla"); if(p)p.style.display="none"; }

function renderReservaList(){
  const box=document.getElementById("reservaList"); if(!box)return;
  box.innerHTML=""; reservaInputs=[];
  denominations.forEach((d,i)=>{
    const row=document.createElement("div"); row.className="stock-item";
    const t=document.createElement("span"); t.textContent=d.n; t.style.fontWeight="700";
    const ctrl=document.createElement("div"); ctrl.className="stock-ctrl";
    const bm=document.createElement("button"); bm.textContent="-"; bm.onclick=()=>updateReservaVal(i,(reservaMinima[d.c]||0)-1);
    const inp=document.createElement("input"); inp.type="number"; inp.min="0"; inp.value=reservaMinima[d.c]||0;
    inp.onchange=(e)=>updateReservaVal(i,parseInt(e.target.value)||0);
    const bp=document.createElement("button"); bp.textContent="+"; bp.onclick=()=>updateReservaVal(i,(reservaMinima[d.c]||0)+1);
    ctrl.appendChild(bm); ctrl.appendChild(inp); ctrl.appendChild(bp);
    row.appendChild(t); row.appendChild(ctrl); box.appendChild(row); reservaInputs[i]=inp;
  });
}
function updateReservaVal(i,v){
  const d=denominations[i]; reservaMinima[d.c]=Math.max(0,v);
  if(reservaInputs[i]) reservaInputs[i].value=reservaMinima[d.c];
  saveReserva();
}
function resetReserva(){
  if(!confirm("¿Restaurar la reserva mínima a los valores por defecto?"))return;
  reservaMinima=Object.assign({},RESERVA_DEFAULT); saveReserva(); renderReservaList();
}

function renderTopesList(){
  const box=document.getElementById("topesList"); if(!box)return;
  box.innerHTML="";
  denominations.forEach(d=>{
    const row=document.createElement("div"); row.className="stock-item";
    const t=document.createElement("span"); t.textContent=d.n; t.style.fontWeight="700";
    const ctrl=document.createElement("div"); ctrl.className="stock-ctrl";
    const bm=document.createElement("button"); bm.textContent="-"; bm.onclick=()=>updateTopeVal(d.c,(topesRecibir[d.c]||0)-1);
    const inp=document.createElement("input"); inp.type="number"; inp.min="0"; inp.value=topesRecibir[d.c]||0;
    inp.onchange=(e)=>updateTopeVal(d.c,parseInt(e.target.value)||0);
    const bp=document.createElement("button"); bp.textContent="+"; bp.onclick=()=>updateTopeVal(d.c,(topesRecibir[d.c]||0)+1);
    ctrl.appendChild(bm); ctrl.appendChild(inp); ctrl.appendChild(bp);
    row.appendChild(t); row.appendChild(ctrl); box.appendChild(row);
  });
}
function updateTopeVal(c,v){ topesRecibir[c]=Math.max(0,v); saveTopes(); renderTopesList(); }
function resetTopes(){
  if(!confirm("¿Restaurar los topes máximos a los valores por defecto?"))return;
  topesRecibir=Object.assign({},TOPES_DEFAULT); saveTopes(); renderTopesList();
}

/* ==================== PANEL RESET (Sistema) ==================== */
function renderResetPanel(){
  const inp = document.getElementById("resetDia");
  if(inp) inp.value = diaReset;

  const box = document.getElementById("resetPanelBox"), title = document.getElementById("resetPanelTitle");
  const sub = document.getElementById("resetPanelSub"), foot = document.getElementById("resetPanelFoot");

  if(box && title && sub && foot){
    if(diaReset === 0){
      box.style.background = "linear-gradient(135deg,#7f1d1d,#991b1b)"; box.style.borderColor = "#ef4444";
      title.textContent = "🔕 RESET AUTOMÁTICO DESACTIVADO"; title.style.color = "#fca5a5";
      sub.textContent = "Las propinas no se resetearán solas"; sub.style.color = "#fecaca";
      foot.innerHTML = "Pon un día (1-31) para activarlo"; foot.style.color = "#fecaca";
      if(inp){ inp.style.borderColor = "#ef4444"; inp.style.color = "#f87171"; }
    } else {
      box.style.background = "#064e3b"; box.style.borderColor = "#059669";
      title.textContent = "🔄 RESET AUTOMÁTICO DE PROPINAS"; title.style.color = "#4ade80";
      sub.textContent = "Se reseteará el día"; sub.style.color = "#a7f3d0";
      foot.innerHTML = "de cada mes · <b style='color:#fbbf24'>0 = desactivado</b>"; foot.style.color = "#a7f3d0";
      if(inp){ inp.style.borderColor = "#059669"; inp.style.color = "#4ade80"; }
    }
  }

  const proxEl = document.getElementById("resetProximo");
  if(proxEl){
    if(diaReset === 0){
      proxEl.innerHTML = "🔕 Sin reset programado"; proxEl.style.color = "#fca5a5"; proxEl.style.background = "#7f1d1d"; proxEl.style.borderColor = "#ef4444";
    } else {
      const prox = calcularProximoReset();
      if(!prox){ proxEl.innerHTML = "📅 Sin fecha (configura un día)"; proxEl.style.color = "#94a3b8"; proxEl.style.background = "#0f172a"; proxEl.style.borderColor = "#334155"; }
      else {
        const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
        const ahora = new Date(); const dias = Math.ceil((prox - ahora) / (1000*60*60*24));
        const inminente = dias <= 1, color = inminente ? "#fbbf24" : "#4ade80";
        const sig = new Date(prox.getTime()); sig.setMonth(sig.getMonth() + 1);
        const ultimoDiaSig = new Date(sig.getFullYear(), sig.getMonth() + 1, 0).getDate();
        if(sig.getDate() > ultimoDiaSig) sig.setDate(ultimoDiaSig);
        const fechaProx = prox.getDate() + " de " + meses[prox.getMonth()] + " de " + prox.getFullYear();
        const fechaSig = sig.getDate() + " de " + meses[sig.getMonth()] + " de " + sig.getFullYear();
        let texto = "📅 Próximo reset: <b style='color:" + color + ";font-size:14px'>" + fechaProx + "</b>";
        if(dias >= 0) texto += " <span style='color:#94a3b8;font-size:11px'>· en " + dias + " día" + (dias !== 1 ? "s" : "") + "</span>";
        else texto += " <span style='color:#f87171;font-size:11px'>· atrasado</span>";
        if(resetSkip > 0) texto += " <span style='color:#a78bfa;font-size:11px'>· ⏭️ saltado x" + resetSkip + "</span>";
        texto += "<br><span style='color:#a78bfa;font-size:11px;font-weight:700'>⏭️ Si saltas ahora → <b style='color:#c4b5fd'>" + fechaSig + "</b></span>";
        proxEl.innerHTML = texto; proxEl.style.color = "#e2e8f0"; proxEl.style.background = "#0f172a"; proxEl.style.borderColor = inminente ? "#fbbf24" : "#334155";
      }
    }
  }

  const el = document.getElementById("resetUltimaVez");
  if(el){ if(ultimoResetPropinas){ const d = new Date(ultimoResetPropinas); el.textContent = "Última vez: " + d.toLocaleDateString("es-ES") + " " + d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"}); } else { el.textContent = "Última vez: —"; } }

  const btnDbg = document.getElementById("btnDebugToggle");
  if(btnDbg){
    if(safeStorage.get("uberCambioDebug") === "1"){ btnDbg.textContent = "ON"; btnDbg.style.background = "#7c3aed"; btnDbg.style.color = "#fff"; }
    else { btnDbg.textContent = "OFF"; btnDbg.style.background = "#334155"; btnDbg.style.color = "#94a3b8"; }
  }

  const btnSaltar = document.querySelector('button[onclick="saltarProximoReset()"]');
  let anchorParaNuevosBoxes = btnSaltar ? btnSaltar.parentNode : box;

  if(btnSaltar){
    let boxCoche = document.getElementById("resetCocheBox");
    if(!boxCoche){
      boxCoche = document.createElement("div"); boxCoche.id = "resetCocheBox";
      boxCoche.style.cssText = "margin-top:16px; margin-bottom:16px; padding:14px; background:#1e293b; border-radius:12px; border:1px solid #334155";
      btnSaltar.parentNode.insertBefore(boxCoche, btnSaltar.nextSibling);
    }
    if(!(document.activeElement && document.activeElement.id === "inputHoraJornadaReset")){
      const cocheSel = (typeof cocheActual !== "undefined" && cocheActual) ? cocheActual : "Ninguno";
      const horaSel = (typeof horaFinJornada !== "undefined") ? horaFinJornada : "18:00";
      boxCoche.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div style="font-size:13px;color:#38bdf8;font-weight:900;letter-spacing:1px">🚗 FIN DE JORNADA (COCHE)</div><div style="font-size:11px;color:#64748b;font-weight:700">Coche actual: <b style="color:#fff">${cocheSel}</b></div></div>
        <div style="font-size:12px;color:#94a3b8;margin-bottom:12px;line-height:1.4">A esta hora, el coche se liberará solo. Podrás cambiarlo al día siguiente.</div>
        <div style="display:flex;align-items:center;gap:10px"><input type="time" id="inputHoraJornadaReset" value="${horaSel}" style="flex:1;font-size:24px;font-weight:900;padding:12px;border-radius:10px;border:2px solid #0891b2;background:#0f172a;color:#22d3ee;text-align:center;outline:none;font-family:monospace;box-sizing:border-box"><button type="button" onclick="guardarHoraJornadaDesdeReset()" style="background:#0891b2;color:#fff;border:none;border-radius:10px;padding:14px 18px;font-weight:900;font-size:14px;cursor:pointer">Guardar</button></div>`;
    }
  }

  if(btnSaltar){
    let avisosBox = document.getElementById("avisosBox");
    if(!avisosBox){
      avisosBox = document.createElement("div"); avisosBox.id = "avisosBox";
      avisosBox.style.cssText = "margin-top:16px; margin-bottom:16px; padding:14px; background:#1e293b; border-radius:12px; border:1px solid #334155";
      const boxCoche = document.getElementById("resetCocheBox");
      if(boxCoche) boxCoche.parentNode.insertBefore(avisosBox, boxCoche.nextSibling);
      else btnSaltar.parentNode.insertBefore(avisosBox, btnSaltar.nextSibling);
    }
    if(!(document.activeElement && document.activeElement.id === "inputHoraRecordatorio")){
      const opcionesDias = diasSemanaNombres.map((d, i) => `<option value="${i}" ${i === diaRecordatorio ? 'selected' : ''}>${d}</option>`).join("");
      avisosBox.innerHTML = `
        <div style="font-size:13px;color:#38bdf8;font-weight:900;letter-spacing:1px;margin-bottom:10px">🔔 RECORDATORIOS DE CAJA</div>
        <div style="font-size:12px;color:#94a3b8;margin-bottom:12px;line-height:1.4">¿Qué día y a qué hora quieres que te avise para ingresar el dinero de las propinas?</div>
        <div style="display:flex;gap:10px;align-items:center;"><select id="inputDiaRecordatorio" style="flex:1;font-size:16px;font-weight:800;padding:12px;border-radius:10px;border:2px solid #0891b2;background:#0f172a;color:#22d3ee;outline:none;">${opcionesDias}</select><input type="time" id="inputHoraRecordatorio" value="${horaRecordatorio}" style="width:110px;font-size:18px;font-weight:900;padding:12px;border-radius:10px;border:2px solid #0891b2;background:#0f172a;color:#22d3ee;text-align:center;outline:none;"></div>
        <button type="button" onclick="guardarConfigRecordatorio()" style="width:100%; margin-top:12px; background:#0891b2; color:#fff; border:none; border-radius:10px; padding:12px; font-weight:900; font-size:14px; cursor:pointer;">Guardar Día y Hora</button>`;
    }
  }

  renderHistorialPanel();
}

function guardarDiaReset(){
  const el = document.getElementById("resetDia"); if(!el) return;
  const n = parseInt(el.value); const nuevoDia = (isNaN(n) || n < 0) ? 0 : Math.min(31, n);
  if(nuevoDia === 0){
    if(!confirm("🔕 DESACTIVAR RESET AUTOMÁTICO\n\nLas propinas NO se resetearán solas.\n\nPodrás resetearlas a mano cuando quieras.\n\n¿Desactivar?")){ el.value = diaReset; return; }
    diaReset = 0; saveDiaReset(); el.value = 0; renderResetPanel(); mostrarToast("🔕 Reset automático desactivado"); return;
  }
  const now = new Date(); const cand = new Date(now.getFullYear(), now.getMonth(), nuevoDia, 0, 0, 0);
  const yaPasoEsteMes = (cand <= now);
  if(yaPasoEsteMes && nuevoDia !== diaReset){
    if(!confirm("⚠️ El día " + nuevoDia + " ya ha pasado este mes.\n\nSi guardas, NO se reseteará ahora.\nEl próximo reset será el día " + nuevoDia + " del mes que viene.\n\n¿Continuar?")){ el.value = diaReset; return; }
    ultimoResetPropinas = now.toISOString(); saveUltimoResetPropinas();
  }
  diaReset = nuevoDia; saveDiaReset(); el.value = diaReset; renderResetPanel(); mostrarToast("✅ Día de reset: " + diaReset);
}

function guardarHoraJornadaDesdeReset(){
  const inp = document.getElementById("inputHoraJornadaReset"); if(!inp) return;
  const v = inp.value;
  if(!/^\d{2}:\d{2}$/.test(v)){ alert("Hora inválida"); return; }
  horaFinJornada = v; saveHoraFinJornada(); mostrarToast("⏰ Fin de jornada: " + v);
}

function guardarConfigRecordatorio(){
  const diaInp = document.getElementById("inputDiaRecordatorio"); const horaInp = document.getElementById("inputHoraRecordatorio");
  if(!diaInp || !horaInp) return;
  diaRecordatorio = parseInt(diaInp.value); horaRecordatorio = horaInp.value;
  safeStorage.set("uberCambioDiaRecordatorio", String(diaRecordatorio)); safeStorage.set("uberCambioHoraRecordatorio", horaRecordatorio);
  mostrarToast("✅ Recordatorios: " + diasSemanaNombres[diaRecordatorio] + " a las " + horaRecordatorio);
  programarAvisosResetPropinas(); programarAvisosDeposito();
}

function saltarProximoReset(){
  if(diaReset === 0){ mostrarToast("ℹ️ El reset ya está desactivado"); return; }
  const prox = calcularProximoReset();
  if(!prox){ mostrarToast("ℹ️ No hay reset programado"); return; }
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const siguiente = new Date(prox.getTime()); siguiente.setMonth(siguiente.getMonth() + 1);
  if(!confirm("⏭️ SALTAR PRÓXIMO RESET\n\nSe saltará el de " + prox.getDate() + " de " + meses[prox.getMonth()] + ".\nEl siguiente será " + siguiente.getDate() + " de " + meses[siguiente.getMonth()] + ".\n\nLas propinas NO se resetearán hasta entonces.\n\n¿Saltar?")) return;
  resetSkip++; saveResetSkip(); renderResetPanel(); mostrarToast("⏭️ Reset saltado. Nuevo: " + siguiente.getDate() + " de " + meses[siguiente.getMonth()]);
}

/* ==================== FUNCIONES DE RESET ==================== */
function resetCuenta(){ if(!confirm("¿Poner el INVENTARIO (caja) a CERO?\nLas propinas NO se tocan."))return; stock=new Array(denominations.length).fill(0); saveStock(); renderStockList(); if(received.length)calculate(); }
function resetPropinas(){
  if(!confirm("¿Poner las PROPINAS a CERO?\nEl inventario NO se toca.")) return;
  totalTips=0; saveTips();
  safeStorage.remove("uberCambioPeajesHistorial");
  limpiarTodasLasRutas(3);
  renderStockList(); renderResetPanel(); mostrarToast("✅ Propinas y peajes reseteados");
}
function resetHistorialDepositos(){
  if(!confirm("¿Borrar el HISTORIAL de depósitos?\n\nEl aprendizaje (stats) NO se toca."))return;
  safeStorage.remove("uberCambioCierres"); renderHistorialPanel(); renderCierreHistorico();
  const hc=document.getElementById("cierreHistorico"); if(hc){hc.innerHTML="";hc.style.display="none"}
  alert("✅ Historial de depósitos borrado."); programarAvisosDeposito();
}
function resetHistorialResets(){ if(!confirm("¿Borrar el HISTORIAL de resets?\n\nLas propinas actuales NO se tocan."))return; safeStorage.remove("uberCambioHistoricoResets"); renderHistorialPanel(); renderResetPanel(); alert("✅ Historial de resets borrado."); }
function resetHistorialCambios(){ if(!confirm("¿Borrar el HISTORIAL de cambios?\n\nEl aprendizaje NO se toca."))return; safeStorage.remove("uberCambioCambios"); renderCambioHistorial(); alert("✅ Historial de cambios borrado."); }
function resetEstadisticas(){ if(!confirm("¿Borrar las estadísticas de aprendizaje?"))return; resetStats(); renderStockList(); alert("✅ Estadísticas reseteadas."); }
function resetTodo(){ if(!confirm("⚠️ ¿RESETEAR TODO?\n\nSe borrará el inventario, propinas, historial y estadísticas."))return; stock=new Array(denominations.length).fill(0); totalTips=0; safeStorage.remove("uberCambioCierres"); safeStorage.remove("uberCambioHistoricoResets"); safeStorage.remove("uberCambioCambios"); safeStorage.remove("uberCambioPeajesHistorial"); resetStats(); saveStock(); saveTips(); renderStockList(); renderResetPanel(); if(received.length)calculate(); }

/* ==================== HISTORIAL OPERACIONES ==================== */
function renderHistorialPanel(){
  const box=document.getElementById("historialPanel"); if(!box)return;
  const cierres=loadCierres(), resets=loadHistoricoResets(); let html="";
  if(cierres.length){
    html+="<div style='font-size:12px;font-weight:800;color:#94a3b8;letter-spacing:0.5px;margin-bottom:6px'>📜 ÚLTIMOS DEPÓSITOS</div>";
    const total = cierres.length;
    cierres.slice(-10).reverse().forEach((c,revIdx)=>{
      const idx = total - 1 - revIdx; const d=new Date(c.fecha);
      const f=d.toLocaleDateString("es-ES")+" "+d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});
      const ic=c.manual?"📝 ":""; const tieneDetalle = Array.isArray(c.usados) && c.usados.length>0;
      const flecha = tieneDetalle ? "<span style='color:#38bdf8;font-weight:900;font-size:18px'>›</span>" : "";
      html+="<div onclick='verDetalleDeposito("+idx+")' style='display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #334155;font-size:13px;cursor:pointer'><span style='color:#94a3b8'>"+ic+f+"</span><span style='display:flex;align-items:center;gap:8px'><span style='font-weight:800;color:#4ade80'>"+moneyText(c.total)+"</span>"+flecha+"</span></div>";
    });
  }
  if(resets.length){
    html+="<div style='font-size:12px;font-weight:800;color:#94a3b8;letter-spacing:0.5px;margin:14px 0 6px'>🔄 ÚLTIMOS RESETS DE PROPINAS</div>";
    resets.slice(-10).reverse().forEach(r=>{
      const d=new Date(r.fecha); const f=d.toLocaleDateString("es-ES")+" "+d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});
      html+="<div style='display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #334155;font-size:13px'><span style='color:#94a3b8'>"+f+"</span><span style='font-weight:800;color:#fbbf24'>"+moneyText(r.propinas)+"</span></div>";
    });
  }
  box.innerHTML=html;
}

function abrirHistorialOpsPantalla(){
  const prev = document.getElementById("modalHistorialOps"); if(prev) prev.remove();
  const ops = loadHistorialOps(); const total = ops.length; const reverse = [...ops].reverse();
  let html = `<div style="background:#1e293b;border-radius:16px;padding:18px;max-width:480px;width:100%;border:1px solid #334155;max-height:88vh;overflow-y:auto"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px"><div style="font-size:16px;font-weight:900;color:#38bdf8">📋 Historial de operaciones</div><button type="button" onclick="cerrarHistorialOps()" style="background:#334155;color:#fff;border:none;padding:6px 12px;border-radius:8px;font-weight:800;cursor:pointer;font-size:13px">✕</button></div>`;
  if(!total){ html += `<div style="text-align:center;color:#64748b;padding:30px 10px;font-size:14px">Sin operaciones registradas todavía.</div>`; }
  else {
    let sumaPrecios = 0, sumaPropinas = 0;
    ops.forEach(o => { sumaPrecios += o.precio || 0; sumaPropinas += o.propina || 0; });
    html += `<div style="display:flex;gap:8px;margin-bottom:14px"><div style="flex:1;background:#0f172a;border:1px solid #334155;border-radius:10px;padding:10px;text-align:center"><div style="font-size:10px;color:#94a3b8;font-weight:700">OPERACIONES</div><div style="font-size:20px;font-weight:900;color:#38bdf8;margin-top:2px">${total}</div></div><div style="flex:1;background:#0f172a;border:1px solid #334155;border-radius:10px;padding:10px;text-align:center"><div style="font-size:10px;color:#94a3b8;font-weight:700">TOTAL VIAJES</div><div style="font-size:16px;font-weight:900;color:#fff;margin-top:2px">${moneyText(sumaPrecios)}</div></div><div style="flex:1;background:#0f172a;border:1px solid #334155;border-radius:10px;padding:10px;text-align:center"><div style="font-size:10px;color:#94a3b8;font-weight:700">PROPINAS</div><div style="font-size:16px;font-weight:900;color:#4ade80;margin-top:2px">${moneyText(sumaPropinas)}</div></div></div>`;
    reverse.forEach(o => {
      const d = new Date(o.fecha); const fecha = d.toLocaleDateString("es-ES", { day:"2-digit", month:"2-digit", year:"2-digit" }); const hora = d.toLocaleTimeString("es-ES", { hour:"2-digit", minute:"2-digit" });
      const conPropina = (o.propina || 0) > 0;
      html += `<div style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:10px 12px;margin-bottom:8px"><div style="font-size:11px;color:#94a3b8;font-weight:700;margin-bottom:6px">📅 ${fecha} · ${hora}</div><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><div style="font-size:13px;color:#e2e8f0">Precio <b style="color:#fff">${moneyText(o.precio || 0)}</b> · Dado <b style="color:#fff">${moneyText(o.dado || 0)}</b></div><div style="font-size:14px;font-weight:900;color:#38bdf8">→ Cambio ${moneyText(o.cambio || 0)}</div></div>${conPropina ? `<div style="font-size:12px;color:#4ade80;font-weight:700;margin-top:4px">💶 Propina: ${moneyText(o.propina)}</div>` : ""}</div>`;
    });
  }
  html += `<div style="display:flex;gap:8px;margin-top:14px"><button type="button" onclick="cerrarHistorialOps()" style="flex:1;background:#334155;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer">Cerrar</button><button type="button" onclick="borrarHistorialOps()" style="flex:0 0 auto;background:#7f1d1d;color:#fca5a5;border:none;padding:12px 16px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer">🗑️</button></div></div>`;
  const m = document.createElement("div");
  m.id = "modalHistorialOps"; m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px"; m.innerHTML = html;
  document.body.appendChild(m); m.addEventListener("click", (e) => { if(e.target === m) cerrarHistorialOps(); });
}
function cerrarHistorialOps(){ const m = document.getElementById("modalHistorialOps"); if(m) m.remove(); }
function borrarHistorialOps(){ if(!confirm("¿Borrar TODO el historial de operaciones?\n\nNo afecta a propinas ni a la caja.")) return; saveHistorialOps([]); cerrarHistorialOps(); abrirHistorialOpsPantalla(); mostrarToast("🗑️ Historial borrado"); }

/* ==================== AVISOS (CAMPANA) ==================== */
function obtenerAvisos(){
  const avisos = []; const ahora = new Date();
  const porCaducar = festivos.filter(f => { if(!f.trabajado || f.solicitado || f.sacrificado) return false; const d = diasHastaCaducar(f); return d >= 0 && d <= 15; });
  if(porCaducar.length) avisos.push({ tipo: "urgente", icono: "⚠️", titulo: porCaducar.length + " festivo" + (porCaducar.length !== 1 ? "s" : "") + " por caducar", subtitulo: "Menos de 15 días para solicitarlo", accion: "dias" });

  const hoyStrAvisos = fechaLocalStr();
  const sinSolicitar = festivos.filter(f => { if(!f.trabajado || f.solicitado || f.sacrificado) return false; if(f.fecha >= hoyStrAvisos) return false; const enVac = diasPersonales.find(x => x.fecha === f.fecha && x.tipo === "vacacion"); if(enVac) return false; const d = diasHastaCaducar(f); return d > 15 && d !== Infinity; });
  if(sinSolicitar.length) avisos.push({ tipo: "info", icono: "📅", titulo: sinSolicitar.length + " festivo" + (sinSolicitar.length !== 1 ? "s" : "") + " sin solicitar", subtitulo: "Aún estás a tiempo", accion: "dias" });

  const pendAprobar = festivos.filter(f => f.solicitado && !f.aprobado && !f.sacrificado);
  if(pendAprobar.length) avisos.push({ tipo: "info", icono: "⏳", titulo: pendAprobar.length + " pendiente" + (pendAprobar.length !== 1 ? "s" : "") + " de aprobar", subtitulo: "La empresa no ha confirmado todavía", accion: "dias" });

  const sinDisfrute = festivos.filter(f => f.solicitado && f.aprobado && !f.sacrificado && !f.fechaDisfrute);
  if(sinDisfrute.length) avisos.push({ tipo: "info", icono: "🎉", titulo: sinDisfrute.length + " sin fecha de disfrute", subtitulo: "Aprobado pero sin día elegido", accion: "dias" });

  try {
    if(diaReset !== 0){ const prox = calcularProximoReset(); if(prox){ const dias = Math.ceil((prox - ahora) / (1000*60*60*24)); if(dias >= 0 && dias <= 3){ avisos.push({ tipo: dias <= 1 ? "urgente" : "info", icono: "🔄", titulo: "Reset de propinas en " + dias + " día" + (dias !== 1 ? "s" : ""), subtitulo: formatearFechaBonita(fechaLocalStr(prox)), accion: "sistema" }); } } }
  } catch(e){}

  try {
    const ops = loadHistorialOps(); 
    // Como el historial se limpia al depositar, lo que hay aquí ya es el "pendiente" exacto
    const pendiente = ops.reduce((s, op) => s + (op.precio || 0), 0);
    if(pendiente > 0){
      let enUltimaSemana = false, fechaLimite = null;
      try { if(diaReset !== 0){ const prox = calcularProximoReset(); if(prox){ fechaLimite = calcularLimiteDepositoReal(prox); fechaLimite.setHours(0,0,0,0); const ahoraDia = new Date(); ahoraDia.setHours(0,0,0,0); const diasHastaLimite = Math.ceil((fechaLimite - ahoraDia) / (1000*60*60*24)); if(diasHastaLimite >= 0 && diasHastaLimite <= 7) enUltimaSemana = true; } } } catch(e){}
      const diaHoy = new Date().getDay(); const diasDesdeRecordatorio = (diaHoy - diaRecordatorio + 7) % 7;
      const esDiaRecordatorio = (diaHoy === diaRecordatorio); const yaPasoRecordatorioEstaSemana = (diasDesdeRecordatorio >= 0 && diasDesdeRecordatorio <= 3);
      if(enUltimaSemana && fechaLimite) avisos.push({ tipo: "urgente", icono: "⚠️", titulo: "Última semana para depositar", subtitulo: "Límite: " + formatearFechaBonita(fechaLocalStr(fechaLimite)) + " · " + moneyText(pendiente), accion: "cierre" });
      else if(esDiaRecordatorio || yaPasoRecordatorioEstaSemana) avisos.push({ tipo: "info", icono: "💶", titulo: moneyText(pendiente) + " pendientes de depositar", subtitulo: "Propinas de viajes sin ingresar", accion: "cierre" });
    }
  } catch(e){}
  return avisos;
}

function ejecutarAccionAviso(accion){
  const m = document.getElementById("modalAvisos"); if(m) m.remove();
  try { if(accion === "dias") abrirDiasPantalla(); else if(accion === "cierre") abrirCierrePantalla(); else if(accion === "sistema"){ toggleMenu(); drawerTab("sistema"); } } catch(e){ console.warn("Acción aviso:", e); }
}

function abrirModalAvisos(){
  const prev = document.getElementById("modalAvisos"); if(prev) prev.remove();
  const avisos = obtenerAvisos(); if(!avisos.length){ mostrarToast("✅ Sin avisos pendientes"); return; }
  const m = document.createElement("div");
  m.id = "modalAvisos"; m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px";
  let html = `<div style="background:#1e293b;border-radius:16px;padding:20px;max-width:400px;width:100%;border:1px solid #334155"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><div style="font-size:16px;font-weight:900;color:#fbbf24">🔔 Avisos</div><button type="button" onclick="document.getElementById('modalAvisos').remove()" style="background:#334155;color:#fff;border:none;padding:6px 12px;border-radius:8px;font-weight:800;cursor:pointer;font-size:13px">✕</button></div>`;
  avisos.forEach(a => {
    const bg = a.tipo === "urgente" ? "#7f1d1d" : "#0f172a", border = a.tipo === "urgente" ? "#ef4444" : "#334155", color = a.tipo === "urgente" ? "#fca5a5" : "#e2e8f0";
    html += `<div onclick="ejecutarAccionAviso('${a.accion}')" style="background:${bg};border:1px solid ${border};border-radius:10px;padding:12px;margin-bottom:8px;display:flex;align-items:center;gap:10px;cursor:pointer"><span style="font-size:22px;flex-shrink:0">${a.icono}</span><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:800;color:${color}">${a.titulo}</div><div style="font-size:11px;color:#94a3b8;margin-top:2px">${a.subtitulo}</div></div><span style="font-size:18px;color:#64748b">›</span></div>`;
  });
  html += `<button type="button" onclick="document.getElementById('modalAvisos').remove()" style="width:100%;margin-top:12px;background:#334155;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer">Cerrar</button></div>`;
  m.innerHTML = html; document.body.appendChild(m); m.addEventListener("click", (e) => { if(e.target === m) m.remove(); });
}

/* ==================== NOTIFICACIONES PROGRAMADAS ==================== */
async function asegurarAlarmasExactas(){
  try {
    const LN = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications;
    if(!LN || !LN.checkExactNotificationSetting) return true;
    const r = await LN.checkExactNotificationSetting();
    if(r.exact_alarm === 'granted') return true;
    if(safeStorage.get("uberCambioPidioAlarmas") === "1") return false;
    safeStorage.set("uberCambioPidioAlarmas", "1");
    if(confirm("⏰ Para que los recordatorios suenen a su hora, activa el permiso «Alarmas y recordatorios» para esta app.\n\n¿Abrir ajustes ahora?")){ await LN.requestExactNotificationSetting(); }
    return false;
  } catch(e){ return false; }
}

async function crearCanalRecordatorios(){
  const Cap = window.Capacitor;
  if(!Cap || !Cap.Plugins || !Cap.Plugins.LocalNotifications) return;
  const LN = Cap.Plugins.LocalNotifications;
  try { 
    await LN.createChannel({ 
      id: 'recordatorios-alta', 
      name: 'Avisos y Recordatorios', 
      description: 'Avisos de jornada, depósitos, resets', 
      importance: 5, 
      visibility: 1, 
      sound: 'default', 
      vibration: true, 
      lights: true,
      actions: [
        { id: 'libre', title: '🟢 Modo Libre' },
        { id: 'fuera', title: '⚫ Fuera APP' }
      ]
    }); 
  } catch(e){ console.warn("Error creando canal", e); }
}

function calcularProximoAviso(){
  const ahora = new Date(); const [hh, mm] = horaRecordatorio.split(":").map(Number);
  let proximo = new Date();
  proximo.setDate(proximo.getDate() + (diaRecordatorio + 7 - proximo.getDay()) % 7);
  proximo.setHours(hh, mm, 0, 0);
  if(proximo <= ahora) { proximo.setDate(proximo.getDate() + 7); }
  return proximo;
}

async function programarAvisosFestivos(){
  const Cap = window.Capacitor; if(!Cap || !Cap.Plugins || !Cap.Plugins.LocalNotifications) return;
  const LN = Cap.Plugins.LocalNotifications;
  try {
    const perm = await LN.checkPermissions(); if(perm.display !== 'granted') return;
    await crearCanalRecordatorios();
    const pending = await LN.getPending(); const aBorrar = pending.notifications.filter(n => n.id >= 300000 && n.id < 400000); if(aBorrar.length > 0) await LN.cancel({ notifications: aBorrar });
    const ahora = new Date();
    const pendientes = festivos.filter(f => { if(!f.trabajado || f.solicitado || f.sacrificado) return false; const d = diasHastaCaducar(f); return d > 0 && d <= 90; });
    const notificaciones = [];
    pendientes.forEach(f => {
      const caducidad = fechaCaducidad(f.fecha); if(!caducidad) return;
      const p = f.fecha.split("-"); const idBase = (parseInt(p[0]) * 10000 + parseInt(p[1]) * 100 + parseInt(p[2])) % 9000;
      [15, 5, 1].forEach((diasAntes, k) => {
        const [hh, mm] = horaRecordatorio.split(":").map(Number);
        const fechaAviso = new Date(caducidad.getTime()); fechaAviso.setDate(fechaAviso.getDate() - diasAntes); fechaAviso.setHours(hh, mm, 0, 0);
        if(fechaAviso.getTime() <= ahora.getTime()) return;
        notificaciones.push({ id: 300000 + idBase * 10 + k, title: '💼 Festivo a punto de caducar', body: `Te quedan ${diasAntes} día${diasAntes !== 1 ? 's' : ''} para solicitar el festivo del ${formatearFechaBonita(f.fecha)} (${f.nombre}).`, channelId: 'recordatorios-alta', schedule: { at: fechaAviso, allowWhileIdle: true } });
      });
    });
    if(notificaciones.length > 0){ await LN.schedule({ notifications: notificaciones }); }
  } catch(e){}
}

async function programarAvisosResetPropinas(){
  const Cap = window.Capacitor; if(!Cap || !Cap.Plugins || !Cap.Plugins.LocalNotifications) return;
  const LN = Cap.Plugins.LocalNotifications;
  try {
    const perm = await LN.checkPermissions(); if(perm.display !== 'granted') return;
    await crearCanalRecordatorios();
    const pending = await LN.getPending(); const aBorrar = pending.notifications.filter(n => n.id >= 400000 && n.id < 500000); if(aBorrar.length > 0) await LN.cancel({ notifications: aBorrar });
    if(diaReset === 0) return;
    const proxReset = calcularProximoReset(); if(!proxReset) return;
    const ahora = new Date();
    const [hh, mm] = horaRecordatorio.split(":").map(Number);
    let fechaLimite = calcularLimiteDepositoReal(proxReset);
    let fechaPreparacion = new Date(fechaLimite.getTime()); let diasHastaViernes = (fechaLimite.getDay() + 7 - 5) % 7; if(diasHastaViernes === 0) diasHastaViernes = 7; fechaPreparacion.setDate(fechaPreparacion.getDate() - diasHastaViernes); fechaPreparacion.setHours(hh, mm, 0, 0);
    let fechaUltimaSemana = new Date(fechaLimite.getTime()); let diasHastaMartes = (fechaLimite.getDay() + 7 - 2) % 7; fechaUltimaSemana.setDate(fechaUltimaSemana.getDate() - diasHastaMartes); fechaUltimaSemana.setHours(hh, mm, 0, 0);
    const alertas = [{ fecha: fechaPreparacion, title: '📅 Último viernes de margen', body: `Aprovecha hoy que las máquinas están abiertas. El límite real para ingresar las propinas es el ${nombreDiaLimite} de la próxima semana.` }];
    if(!esMismoDia) alertas.push({ fecha: fechaUltimaSemana, title: '🔔 ¡Empieza tu semana de entrega!', body: `Tienes hasta el ${nombreDiaLimite} para meter las propinas en las máquinas.` });
    alertas.push({ fecha: fechaLimite, title: '⚠️ ¡ÚLTIMO DÍA DE ENTREGA!', body: 'Hoy es el último día para meter el dinero de las propinas en las máquinas.' });
    const notificaciones = [];
    alertas.forEach((a, index) => { if(a.fecha.getTime() <= ahora.getTime()) return; const idFinal = 400000 + (a.fecha.getMonth() * 100 + a.fecha.getDate()) * 10 + index; notificaciones.push({ id: idFinal, title: a.title, body: a.body, channelId: 'recordatorios-alta', schedule: { at: a.fecha, allowWhileIdle: true } }); });
    if(notificaciones.length > 0){ await LN.schedule({ notifications: notificaciones }); }
  } catch(e){}
}

async function programarAvisosDeposito(){
  const Cap = window.Capacitor; if(!Cap || !Cap.Plugins || !Cap.Plugins.LocalNotifications) return;
  const LN = Cap.Plugins.LocalNotifications;
  try {
    const perm = await LN.checkPermissions(); if(perm.display !== 'granted') return;
    await crearCanalRecordatorios();
    const pending = await LN.getPending(); const aBorrar = pending.notifications.filter(n => n.id >= 500000 && n.id < 600000); if(aBorrar.length > 0) await LN.cancel({ notifications: aBorrar });
    
    // 👇 ARREGLO: Sumamos solo lo que hay en el historial actual
    const ops = loadHistorialOps(); 
    const pendiente = ops.reduce((s, op) => s + (op.precio || 0), 0); 
    if(pendiente <= 0) return;
    
    const ahora = new Date(); const proximoAviso = calcularProximoAviso();
    let fechaLimite = null;
    const proxReset = (diaReset !== 0) ? calcularProximoReset() : null;
    if(proxReset){ fechaLimite = calcularLimiteDepositoReal(proxReset); }
    let cuando = proximoAviso; let notif;
    const unaSemana = 7 * 24 * 3600 * 1000;
    
    if(fechaLimite && proximoAviso.getTime() > fechaLimite.getTime()){ 
        cuando = fechaLimite; 
        // Texto corto para que no se corte
        notif = { id: 500001, title: '⚠️ Último día de entrega', body: `Te quedan ${moneyText(pendiente)} por ingresar antes de nómina.` }; 
    }
    else if(fechaLimite && (fechaLimite.getTime() - proximoAviso.getTime()) < unaSemana){ 
        // Texto corto para que no se corte
        notif = { id: 500001, title: '⚠️ Última semana antes de nómina', body: `Aún tienes ${moneyText(pendiente)} pendientes de entregar.` }; 
    }
    else { 
        // Texto corto para que no se corte
        notif = { id: 500002, title: '💶 Recordatorio de depósito', body: `Tienes ${moneyText(pendiente)} acumulados. Recuerda ingresarlos.` }; 
    }
    
    if(cuando.getTime() <= ahora.getTime()) return;
    await LN.schedule({ notifications: [{ id: notif.id, title: notif.title, body: notif.body, channelId: 'recordatorios-alta', schedule: { at: cuando, allowWhileIdle: true } }] });
  } catch(e){}
}

async function checkFestivosCaducidad(){
  const hoy = fechaLocalStr(); if(safeStorage.get("uberCambioUltimoAvisoFestivos") === hoy) return;
  const urgentes = festivos.filter(f => { if(!f.trabajado || f.solicitado || f.sacrificado) return false; const d = diasHastaCaducar(f); return d >= 0 && d <= 15; });
  if(urgentes.length === 0) return;
  safeStorage.set("uberCambioUltimoAvisoFestivos", hoy);
  try { const Cap = window.Capacitor; if(!Cap || !Cap.Plugins || !Cap.Plugins.LocalNotifications) return; const LN = Cap.Plugins.LocalNotifications; await LN.schedule({ notifications: [{ id: 2001, title: '💼 Días pendientes de solicitar', body: urgentes.length === 1 ? `Tienes 1 festivo a punto de caducar. Revísalo.` : `Tienes ${urgentes.length} festivos a punto de caducar. Revísalos.`, schedule: { at: new Date(), allowWhileIdle: true } }] }); } catch(e){}
}

function checkAutoResetPropinas(){
  if(diaReset === 0) return;
  if(!ultimoResetPropinas){ ultimoResetPropinas = new Date().toISOString(); saveUltimoResetPropinas(); return; }
  const prox = calcularProximoReset(); if(!prox) return;
  const now = new Date();
  if(now >= prox){
    const h = loadHistoricoResets(); h.push({ fecha: now.toISOString(), propinas: totalTips }); saveHistoricoResets(h);
    totalTips = 0; saveTips(); saveHistorialOps([]);
    safeStorage.remove("uberCambioPeajesHistorial");
    limpiarTodasLasRutas(3);
    ultimoResetPropinas = now.toISOString(); saveUltimoResetPropinas();
    resetSkip = 0; saveResetSkip();
    renderStockList(); renderResetPanel(); programarAvisosDeposito();
  }
}

/* ==================== PANTALLA DÍAS NO TRABAJADOS ==================== */
const ORDEN_DIAS_VISUAL = [1, 2, 3, 4, 5, 6, 0];
const NOMBRES_DIAS_CORTOS = { 1:"L", 2:"M", 3:"X", 4:"J", 5:"V", 6:"S", 0:"D" };

function abrirDiasNoTrabajadosPantalla(){
  const d = document.getElementById("drawer"), o = document.getElementById("overlay");
  if(d) d.classList.remove("active"); if(o) o.classList.remove("active");
  const prev = document.getElementById("modalDiasNoTrab"); if(prev) prev.remove();
  const m = document.createElement("div");
  m.id = "modalDiasNoTrab"; m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px";
  const renderBotones = () => ORDEN_DIAS_VISUAL.map(dia => {
    const activo = diasNoTrabajados.includes(dia);
    const bg = activo ? "#7f1d1d" : "#1e293b", borde = activo ? "#ef4444" : "#475569", color = activo ? "#fca5a5" : "#94a3b8";
    return `<button type="button" data-dia="${dia}" style="flex:1;min-width:0;padding:14px 4px;border-radius:10px;border:2px solid ${borde};background:${bg};color:${color};font-weight:900;font-size:15px;cursor:pointer">${NOMBRES_DIAS_CORTOS[dia]}</button>`;
  }).join("");
  const textoTotales = () => { if(diasNoTrabajados.length === 0) return "⚠️ No has marcado ningún día libre"; const ordenados = diasNoTrabajados.slice().sort((a,b) => ORDEN_DIAS_VISUAL.indexOf(a) - ORDEN_DIAS_VISUAL.indexOf(b)); return "Días libres: " + ordenados.map(d => NOMBRES_DIAS_CORTOS[d]).join(", "); };
  const pintar = () => {
    m.innerHTML = `<div style="background:#1e293b;border-radius:16px;padding:20px;max-width:400px;width:100%;border:1px solid #334155"><div style="font-size:16px;font-weight:900;color:#fca5a5;text-align:center;margin-bottom:6px">📅 Días no trabajados</div><div style="font-size:12px;color:#94a3b8;text-align:center;margin-bottom:18px;line-height:1.4">Marca los días que <b>NO</b> trabajas.<br>Los festivos que caigan en estos días caducan el <b>31 de diciembre</b>.</div><div id="diasNoTrabBotones" style="display:flex;gap:6px;margin-bottom:18px">${renderBotones()}</div><div style="font-size:12px;color:#a7f3d0;background:#164e63;padding:10px 12px;border-radius:8px;margin-bottom:16px;line-height:1.4;text-align:center">${textoTotales()}</div><div style="display:flex;gap:8px"><button type="button" id="diasNoTrabCancelar" style="flex:1;background:#334155;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer">Cancelar</button><button type="button" id="diasNoTrabGuardar" style="flex:1;background:#0891b2;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer">✅ Guardar</button></div></div>`;
    m.querySelectorAll("[data-dia]").forEach(btn => { btn.onclick = () => { const dia = parseInt(btn.dataset.dia); const idx = diasNoTrabajados.indexOf(dia); if(idx >= 0) diasNoTrabajados.splice(idx, 1); else diasNoTrabajados.push(dia); pintar(); }; });
    document.getElementById("diasNoTrabCancelar").onclick = () => m.remove();
    document.getElementById("diasNoTrabGuardar").onclick = () => { saveDiasNoTrabajados(); m.remove(); const txt = diasNoTrabajados.length ? diasNoTrabajados.slice().sort((a,b) => ORDEN_DIAS_VISUAL.indexOf(a) - ORDEN_DIAS_VISUAL.indexOf(b)).map(d => NOMBRES_DIAS_CORTOS[d]).join(", ") : "ninguno"; mostrarToast("✅ Días no trabajados: " + txt); try { renderDiasTrabajo(); } catch(e){} try { renderResetPanel(); } catch(e){} try { programarAvisosFestivos(); } catch(e){} };
  };
  document.body.appendChild(m); m.addEventListener("click", (e) => { if(e.target === m) m.remove(); }); pintar();
}

function abrirDiasPantalla(){ try{ if(archivarAniosAntiguos()) renderDiasTrabajo(); }catch(e){} const p = document.getElementById("diasPantalla"); if(p)p.style.display = "block"; renderDiasTrabajo(); }
function cerrarDiasPantalla(){ const p = document.getElementById("diasPantalla"); if(p)p.style.display = "none"; }

/* ==================== MODALES DEL CALENDARIO ==================== */
function abrirModalDiasAsignados(){
  const anio = diasAnioVista, actuales = parseInt(diasVacacionesAsignados[String(anio)]) || 0;
  const prev = document.getElementById("modalDiasAsignados"); if(prev) prev.remove();
  const m = document.createElement("div");
  m.id = "modalDiasAsignados"; m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px";
  m.innerHTML = `<div style="background:#1e293b;border-radius:16px;padding:20px;max-width:380px;width:100%;border:1px solid #334155"><div style="font-size:16px;font-weight:900;color:#22d3ee;text-align:center;margin-bottom:6px">🏖️ Días de vacaciones</div><div style="font-size:13px;color:#94a3b8;text-align:center;margin-bottom:18px">Año ${anio}</div><div style="font-size:12px;color:#94a3b8;font-weight:700;margin-bottom:8px;line-height:1.4;text-align:center">¿Cuántos días te ha asignado la empresa este año?</div><input type="number" id="diasAsignadosInput" min="0" max="365" value="${actuales}" style="width:100%;font-size:36px;font-weight:900;padding:16px;border-radius:12px;border:2px solid #0891b2;background:#0f172a;color:#22d3ee;text-align:center;outline:none;margin-bottom:8px"><div style="display:flex;justify-content:center;gap:6px;margin-bottom:18px"><button type="button" onclick="setDiasAsignadosQuick(20)" style="background:#1e293b;color:#94a3b8;border:1px solid #334155;border-radius:8px;padding:6px 12px;font-weight:700;font-size:13px;cursor:pointer">20</button><button type="button" onclick="setDiasAsignadosQuick(22)" style="background:#1e293b;color:#94a3b8;border:1px solid #334155;border-radius:8px;padding:6px 12px;font-weight:700;font-size:13px;cursor:pointer">22</button><button type="button" onclick="setDiasAsignadosQuick(25)" style="background:#1e293b;color:#94a3b8;border:1px solid #334155;border-radius:8px;padding:6px 12px;font-weight:700;font-size:13px;cursor:pointer">25</button><button type="button" onclick="setDiasAsignadosQuick(30)" style="background:#1e293b;color:#94a3b8;border:1px solid #334155;border-radius:8px;padding:6px 12px;font-weight:700;font-size:13px;cursor:pointer">30</button></div><div style="display:flex;gap:8px"><button type="button" onclick="cerrarModalDiasAsignados()" style="flex:1;background:#334155;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer">Cancelar</button><button type="button" onclick="guardarDiasAsignados()" style="flex:1;background:#0891b2;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer">✅ Guardar</button></div></div>`;
  document.body.appendChild(m); m.addEventListener("click", (e) => { if(e.target === m) cerrarModalDiasAsignados(); });
}
function cerrarModalDiasAsignados(){ const m = document.getElementById("modalDiasAsignados"); if(m) m.remove(); }
function setDiasAsignadosQuick(n){ const inp = document.getElementById("diasAsignadosInput"); if(inp) inp.value = n; }
function guardarDiasAsignados(){
  const inp = document.getElementById("diasAsignadosInput"); if(!inp) return;
  const n = parseInt(inp.value) || 0;
  diasVacacionesAsignados[String(diasAnioVista)] = Math.max(0, n); saveVacacionesAsignados();
  cerrarModalDiasAsignados(); renderDiasTrabajo(); mostrarToast("🏖️ Guardado: " + n + " días en " + diasAnioVista);
}

function abrirModalDiaPersonal(fechaExistente){
  const prev = document.getElementById("modalDiaPersonal"); if(prev) prev.remove();
  const esNuevo = !fechaExistente; const hoy = new Date();
  const fechaDefault = hoy.getFullYear() + "-" + String(hoy.getMonth()+1).padStart(2,"0") + "-" + String(hoy.getDate()).padStart(2,"0");
  const fecha = fechaExistente || fechaDefault; const existente = fechaExistente ? diasPersonales.find(d => d.fecha === fechaExistente) : null;
  const m = document.createElement("div");
  m.id = "modalDiaPersonal"; m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px";
  m.innerHTML = `<div style="background:#1e293b;border-radius:16px;padding:20px;max-width:380px;width:100%;border:1px solid #334155"><div style="font-size:16px;font-weight:900;color:#a78bfa;text-align:center;margin-bottom:16px">${esNuevo ? "👤 Nuevo día personal" : "👤 Editar día personal"}</div><div style="font-size:11px;color:#64748b;font-weight:800;margin-bottom:6px">FECHA</div><input type="date" id="dpFecha" value="${fecha}" style="width:100%;font-size:16px;padding:12px;border-radius:10px;border:1px solid #475569;background:#0f172a;color:#fff;margin-bottom:14px;outline:none"><div style="font-size:11px;color:#64748b;font-weight:800;margin-bottom:6px">NOTA (OPCIONAL)</div><input type="text" id="dpNota" placeholder="Ej: fiesta familiar" value="${existente && existente.nota ? existente.nota : ''}" style="width:100%;font-size:14px;padding:12px;border-radius:10px;border:1px solid #475569;background:#0f172a;color:#fff;margin-bottom:16px;outline:none"><div style="display:flex;gap:8px"><button type="button" onclick="cerrarModalDiaPersonal()" style="flex:1;background:#334155;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer">Cancelar</button><button type="button" onclick="guardarDiaPersonal('${fechaExistente || ''}')" style="flex:1;background:#7c3aed;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer">✅ Guardar</button></div></div>`;
  document.body.appendChild(m); m.addEventListener("click", (e) => { if(e.target === m) cerrarModalDiaPersonal(); });
}
function cerrarModalDiaPersonal(){ const m = document.getElementById("modalDiaPersonal"); if(m) m.remove(); }
function guardarDiaPersonal(fechaVieja){
  const fecha = document.getElementById("dpFecha").value, nota = document.getElementById("dpNota").value.trim();
  if(!fecha){ alert("Elige una fecha."); return; }
  const anio = parseInt(fecha.slice(0,4));
  const otros = diasPersonales.filter(d => d.fecha !== fechaVieja && parseInt(d.fecha.slice(0,4)) === anio && (!d.tipo || d.tipo === "personal"));
  if(otros.length >= 2){ alert("⚠️ Ya tienes 2 días personales en " + anio + "."); return; }
  if(fechaVieja) diasPersonales = diasPersonales.filter(d => d.fecha !== fechaVieja);
  diasPersonales = diasPersonales.filter(d => d.fecha !== fecha);
  diasPersonales.push({ fecha, nota, tipo: "personal" }); diasPersonales.sort((a,b) => a.fecha.localeCompare(b.fecha));
  saveDiasPersonales(); cerrarModalDiaPersonal(); renderDiasTrabajo(); mostrarToast("✅ Día personal guardado");
}
function borrarDiaPersonal(fecha){
  const item = diasPersonales.find(d => d.fecha === fecha); if(!item) return;
  const esVacacion = item.tipo === "vacacion";
  const txt = esVacacion ? "¿Borrar este día de vacaciones?" : "¿Borrar este día personal?";
  if(!confirm(txt)) return;
  diasPersonales = diasPersonales.filter(d => d.fecha !== fecha); saveDiasPersonales(); renderDiasTrabajo();
  mostrarToast(esVacacion ? "🏖️ Día de vacaciones borrado" : "👤 Día personal borrado");
}

/* ==================== MODAL VACACIONES ==================== */

function abrirModalVacaciones(){
  const prev = document.getElementById("modalVacaciones"); if(prev) prev.remove();
  const hoy = new Date();
  vacCalAnio = hoy.getFullYear(); vacCalMes = hoy.getMonth(); vacCalInicio = null; vacCalFin = null;
  const m = document.createElement("div");
  m.id = "modalVacaciones"; m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto";
  m.innerHTML = `<div style="background:#1e293b;border-radius:16px;padding:18px;max-width:420px;width:100%;border:1px solid #334155;margin:auto"><div style="font-size:16px;font-weight:900;color:#22d3ee;text-align:center;margin-bottom:4px">🏖️ Añadir vacaciones</div><div style="font-size:11px;color:#94a3b8;text-align:center;margin-bottom:14px">Pulsa el primer día y luego el último</div><div id="vacCalendarioBox"></div><div id="vacPreview" style="font-size:12px;color:#a7f3d0;background:#164e63;padding:10px 12px;border-radius:8px;margin:12px 0;line-height:1.4;text-align:center;min-height:20px"></div><div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap" id="vacRapidosBox"></div><div style="font-size:11px;color:#64748b;font-weight:800;margin-bottom:6px">NOTA (OPCIONAL)</div><input type="text" id="vacNota" placeholder="Ej: Verano 2026" style="width:100%;font-size:14px;padding:12px;border-radius:10px;border:1px solid #475569;background:#0f172a;color:#fff;margin-bottom:14px;outline:none;box-sizing:border-box"><div style="display:flex;gap:8px"><button type="button" onclick="cerrarModalVacaciones()" style="flex:1;background:#334155;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer">Cancelar</button><button type="button" onclick="guardarVacaciones()" style="flex:1;background:#0891b2;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer">✅ Guardar</button></div></div>`;
  document.body.appendChild(m); m.addEventListener("click", (e) => { if(e.target === m) cerrarModalVacaciones(); });
  renderVacCalendario(); renderVacPreview(); renderVacRapidos();
}
function cerrarModalVacaciones(){ const m = document.getElementById("modalVacaciones"); if(m) m.remove(); vacCalInicio = null; vacCalFin = null; }

function renderVacCalendario(){
  const box = document.getElementById("vacCalendarioBox"); if(!box) return;
  const nombresMes = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const primerDia = new Date(vacCalAnio, vacCalMes, 1), totalDias = new Date(vacCalAnio, vacCalMes + 1, 0).getDate(), diaSemanaInicio = (primerDia.getDay() + 6) % 7;
  let html = `<div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><button type="button" onclick="cambiarMesVacCal(-1)" style="background:#334155;color:#fff;border:none;width:34px;height:34px;border-radius:8px;font-size:16px;font-weight:900;cursor:pointer">◀</button><div style="font-size:15px;font-weight:900;color:#38bdf8">${nombresMes[vacCalMes]} (${vacCalMes+1}) ${vacCalAnio}</div><button type="button" onclick="cambiarMesVacCal(1)" style="background:#334155;color:#fff;border:none;width:34px;height:34px;border-radius:8px;font-size:16px;font-weight:900;cursor:pointer">▶</button></div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:6px">${["L","M","X","J","V","S","D"].map(d => `<div style="text-align:center;font-size:10px;color:#64748b;font-weight:900">${d}</div>`).join("")}</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">`;
  for(let i = 0; i < diaSemanaInicio; i++) html += `<div style="aspect-ratio:1"></div>`;
  for(let d = 1; d <= totalDias; d++){
    const fechaStr = `${vacCalAnio}-${String(vacCalMes+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const dia = new Date(vacCalAnio, vacCalMes, d).getDay();
    const esFinde = (dia === 0 || dia === 1);
    const festivo = festivos.find(f => f.fecha === fechaStr && f.trabajado), festivoNoTrab = festivos.find(f => f.fecha === fechaStr && !f.trabajado);
    const yaEsPersonal = diasPersonales.find(x => x.fecha === fechaStr);
    let enRango = false, esExtremo = false;
    if(vacCalInicio && vacCalFin){ enRango = fechaStr >= vacCalInicio && fechaStr <= vacCalFin; esExtremo = (fechaStr === vacCalInicio || fechaStr === vacCalFin); }
    else if(vacCalInicio){ enRango = fechaStr === vacCalInicio; esExtremo = true; }
    let bg, color, border;
    if(esExtremo){ bg = "#22d3ee"; color = "#0f172a"; border = "#0891b2"; }
    else if(enRango){ bg = "#164e63"; color = "#a5f3fc"; border = "#0891b2"; }
    else if(yaEsPersonal){ bg = "#1e293b"; color = "#64748b"; border = "#334155"; }
    else if(festivo){ bg = "#78350f"; color = "#fbbf24"; border = "#b45309"; }
    else if(festivoNoTrab){ bg = "#1e293b"; color = "#64748b"; border = "#334155"; }
    else if(esFinde){ bg = "#0f172a"; color = "#475569"; border = "#1e293b"; }
    else { bg = "#1e293b"; color = "#cbd5e1"; border = "#334155"; }
    const hoy = new Date(), esHoy = (hoy.getFullYear() === vacCalAnio && hoy.getMonth() === vacCalMes && hoy.getDate() === d);
    const clickable = !yaEsPersonal && !festivoNoTrab;
    const onclick = clickable ? `onclick="clickDiaVac('${fechaStr}')"` : "";
    html += `<div ${onclick} style="aspect-ratio:1;background:${bg};border:1px solid ${border};border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:${clickable?'pointer':'default'};position:relative;${esHoy ? "box-shadow:0 0 0 2px #3b82f6 inset;" : ""}"><div style="font-size:12px;color:${color};font-weight:${esHoy||esExtremo?'900':'600'}">${d}</div>${festivo && !enRango && !esExtremo ? `<div style="width:5px;height:5px;border-radius:50%;background:#fbbf24;margin-top:1px"></div>` : ""}</div>`;
  }
  html += `</div></div><div style="display:flex;justify-content:center;gap:12px;font-size:10px;color:#94a3b8;margin-top:8px;flex-wrap:wrap"><span style="display:flex;align-items:center;gap:3px"><span style="display:inline-block;width:10px;height:10px;background:#1e293b;border:1px solid #334155;border-radius:2px"></span>Laborable</span><span style="display:flex;align-items:center;gap:3px"><span style="display:inline-block;width:10px;height:10px;background:#78350f;border:1px solid #b45309;border-radius:2px"></span>Festivo</span><span style="display:flex;align-items:center;gap:3px"><span style="display:inline-block;width:10px;height:10px;background:#0f172a;border:1px solid #1e293b;border-radius:2px"></span>Descanso (D-L)</span></div>`;
  box.innerHTML = html;
}
function cambiarMesVacCal(delta){ vacCalMes += delta; if(vacCalMes < 0){ vacCalMes = 11; vacCalAnio--; } else if(vacCalMes > 11){ vacCalMes = 0; vacCalAnio++; } renderVacCalendario(); }
function clickDiaVac(fechaStr){
  if(!vacCalInicio){ vacCalInicio = fechaStr; vacCalFin = null; renderVacCalendario(); renderVacPreview(); renderVacRapidos(); return; }
  if(vacCalInicio && !vacCalFin){
    if(fechaStr === vacCalInicio) vacCalFin = fechaStr;
    else if(fechaStr < vacCalInicio){ vacCalFin = vacCalInicio; vacCalInicio = fechaStr; }
    else vacCalFin = fechaStr;
    renderVacCalendario(); renderVacPreview(); renderVacRapidos(); return;
  }
  vacCalInicio = fechaStr; vacCalFin = null; renderVacCalendario(); renderVacPreview(); renderVacRapidos();
}
function renderVacPreview(){
  const el = document.getElementById("vacPreview"); if(!el) return;
  if(!vacCalInicio){ el.innerHTML = "👆 Pulsa el <b>primer día</b> en el calendario"; return; }
  if(!vacCalFin){ el.innerHTML = "📍 Inicio: <b>" + formatearFechaBonita(vacCalInicio) + "</b><br>Pulsa el <b>último día</b>"; return; }
  const a = new Date(vacCalInicio + "T00:00:00"), b = new Date(vacCalFin + "T00:00:00");
  let nat = 0, lab = 0, fest = 0;
  const cursor = new Date(a);
  while(cursor <= b){ nat++; const dia = cursor.getDay(); if(dia !== 0 && dia !== 1){ const s = cursor.getFullYear() + "-" + String(cursor.getMonth()+1).padStart(2,"0") + "-" + String(cursor.getDate()).padStart(2,"0"); if(festivos.find(f => f.fecha === s && f.trabajado)) fest++; else lab++; } cursor.setDate(cursor.getDate() + 1); }
  const rango = (vacCalInicio === vacCalFin) ? formatearFechaBonita(vacCalInicio) : formatearFechaBonita(vacCalInicio) + " → " + formatearFechaBonita(vacCalFin);
  let txt = "📅 <b>" + rango + "</b><br>"; txt += nat + " día" + (nat !== 1 ? "s" : "") + " naturales · "; txt += "<span style='color:#4ade80'>" + lab + " laborable" + (lab !== 1 ? "s" : "") + "</span>"; if(fest > 0) txt += " · <span style='color:#fbbf24'>" + fest + " festivo" + (fest !== 1 ? "s" : "") + "</span>";
  el.innerHTML = txt;
}
function renderVacRapidos(){
  const box = document.getElementById("vacRapidosBox"); if(!box) return;
  if(!vacCalInicio){ box.innerHTML = ""; return; }
  box.innerHTML = `<div style="font-size:10px;color:#64748b;font-weight:800;width:100%;margin-bottom:2px">ATAJOS · CUENTAN DESDE EL INICIO</div><button type="button" onclick="vacRangoDesdeInicio(1)" style="flex:1;min-width:60px;background:#0f172a;color:#22d3ee;border:1px solid #0891b2;border-radius:8px;padding:8px;font-weight:800;font-size:12px;cursor:pointer">1 día</button><button type="button" onclick="vacRangoDesdeInicio(2)" style="flex:1;min-width:60px;background:#0f172a;color:#22d3ee;border:1px solid #0891b2;border-radius:8px;padding:8px;font-weight:800;font-size:12px;cursor:pointer">2 días</button><button type="button" onclick="vacRangoDesdeInicio(3)" style="flex:1;min-width:60px;background:#0f172a;color:#22d3ee;border:1px solid #0891b2;border-radius:8px;padding:8px;font-weight:800;font-size:12px;cursor:pointer">3 días</button><button type="button" onclick="vacRangoDesdeInicio(5)" style="flex:1;min-width:60px;background:#0f172a;color:#22d3ee;border:1px solid #0891b2;border-radius:8px;padding:8px;font-weight:800;font-size:12px;cursor:pointer">5 días</button><button type="button" onclick="vacRangoDesdeInicio(7)" style="flex:1;min-width:60px;background:#0f172a;color:#22d3ee;border:1px solid #0891b2;border-radius:8px;padding:8px;font-weight:800;font-size:12px;cursor:pointer">7 días</button><button type="button" onclick="resetVacSeleccion()" style="flex:1;min-width:60px;background:#7f1d1d;color:#fca5a5;border:1px solid #b91c1c;border-radius:8px;padding:8px;font-weight:800;font-size:12px;cursor:pointer">🗑️</button>`;
}
function vacRangoDesdeInicio(n){ if(!vacCalInicio) return; const d = new Date(vacCalInicio + "T00:00:00"); d.setDate(d.getDate() + (n - 1)); const y = d.getFullYear(), mm = String(d.getMonth()+1).padStart(2,"0"), dd = String(d.getDate()).padStart(2,"0"); vacCalFin = y + "-" + mm + "-" + dd; renderVacCalendario(); renderVacPreview(); renderVacRapidos(); }
function resetVacSeleccion(){ vacCalInicio = null; vacCalFin = null; renderVacCalendario(); renderVacPreview(); renderVacRapidos(); }

function guardarVacaciones(){
  const nota = (document.getElementById("vacNota") || {}).value || ""; const notaFinal = nota.trim() || "Vacaciones";
  if(!vacCalInicio || !vacCalFin){ alert("Selecciona un rango en el calendario."); return; }
  const ini = new Date(vacCalInicio + "T00:00:00"), fin = new Date(vacCalFin + "T00:00:00");
  const laborables = [], festivosEnRango = [];
  const cursor = new Date(ini);
  while(cursor <= fin){
    const dia = cursor.getDay();
    const s = cursor.getFullYear() + "-" + String(cursor.getMonth()+1).padStart(2,"0") + "-" + String(cursor.getDate()).padStart(2,"0");
    const fest = festivos.find(f => f.fecha === s && f.trabajado);
    const yaEsPersonal = diasPersonales.find(d => d.fecha === s);
    if(dia !== 0 && dia !== 1){ if(fest){ if(!yaEsPersonal) festivosEnRango.push({ fecha: s, nombre: fest.nombre }); } else if(!yaEsPersonal){ laborables.push(s); } }
    else { if(fest && !yaEsPersonal){ festivosEnRango.push({ fecha: s, nombre: fest.nombre }); } }
    cursor.setDate(cursor.getDate() + 1);
  }
  let festivosAVisualizar = [];
  if(festivosEnRango.length > 0){
    const lista = festivosEnRango.map(f => "· " + formatearFechaBonita(f.fecha) + " (" + f.nombre + ")").join("\n");
    const msg = "🎉 Hay " + festivosEnRango.length + " festivo" + (festivosEnRango.length !== 1 ? "s" : "") + " dentro del rango:\n\n" + lista + "\n\n¿Quieres marcarlos como vacaciones también?\n\n👉 Aceptar = SÍ (se ven como vacación, pero NO cuentan como día gastado)\n👉 Cancelar = NO (siguen como festivos normales)";
    if(confirm(msg)) festivosAVisualizar = festivosEnRango.map(f => f.fecha);
  }
  laborables.forEach(fecha => { diasPersonales.push({ fecha, nota: notaFinal, tipo: "vacacion" }); });
  festivosAVisualizar.forEach(fecha => { diasPersonales.push({ fecha, nota: notaFinal, tipo: "vacacion", noCuenta: true }); });
  if(laborables.length === 0 && festivosAVisualizar.length === 0){ alert("⚠️ No hay días nuevos que añadir en ese rango.\n\n(Puede que ya estuvieran todos)"); return; }
  diasPersonales.sort((a,b) => a.fecha.localeCompare(b.fecha));
  saveDiasPersonales(); cerrarModalVacaciones(); renderDiasTrabajo();
  let toast = "🏖️ " + laborables.length + " día(s) de vacaciones añadido(s)";
  if(festivosAVisualizar.length > 0) toast += " · " + festivosAVisualizar.length + " festivo(s) marcados como vacación (sin contar)";
  mostrarToast(toast);
}

/* ==================== IMPORTAR ICS Y FESTIVO NUEVO ==================== */
function importarICS(){ const inp = document.getElementById("icsInput"); if(inp) inp.click(); }

function onICSSeleccionado(e){
  const file = e.target.files && e.target.files[0]; e.target.value = ""; if(!file) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const eventos = parseICS(rd.result);
      if(!eventos.length){ alert("⚠️ El archivo .ics no contiene eventos."); return; }
      const clavesPersonal = /vacacion|vacación|personal|asunto|libre|permiso/i;
      const nuevosFestivosTrab = [], nuevosFestivosLibres = [], nuevosPersonales = [], aniosAfectados = new Set();
      eventos.forEach(ev => {
        const anio = parseInt(ev.fecha.slice(0,4)); aniosAfectados.add(anio);
        if(clavesPersonal.test(ev.nombre)){ nuevosPersonales.push(ev); }
        else if(esDiaNoTrabajado(ev.fecha)){ nuevosFestivosLibres.push(ev); }
        else { nuevosFestivosTrab.push(ev); }
      });
      const nuevosFestivos = [...nuevosFestivosTrab, ...nuevosFestivosLibres];
      if(!nuevosFestivos.length && !nuevosPersonales.length){ alert("⚠️ El archivo .ics no contiene festivos ni días personales reconocibles."); return; }
      const aniosTxt = [...aniosAfectados].sort().join(", ");
      const msg = "📥 IMPORTAR CALENDARIO\n\nAños detectados: " + aniosTxt + "\n📅 Festivos en día trabajado (caducan +2 meses): " + nuevosFestivosTrab.length + "\n📅 Festivos en día libre (caducan 31 dic): " + nuevosFestivosLibres.length + "\n👤 Personales/Vacaciones: " + nuevosPersonales.length + "\n\n¿Cómo quieres aplicar?\n\n👉 Aceptar = AÑADIR (fusiona con lo que ya tienes)\n👉 Cancelar = REEMPLAZAR el año del .ics";
      const soloAnadir = confirm(msg);
      let festivosAñadidos = 0, festivosActualizados = 0, festivosBorrados = 0, personalesAñadidos = 0;
      if(soloAnadir){
        nuevosFestivos.forEach(ev => { const existente = festivos.find(f => f.fecha === ev.fecha); if(existente){ if(existente.nombre !== ev.nombre){ existente.nombre = ev.nombre; festivosActualizados++; } } else { festivos.push({ fecha: ev.fecha, nombre: ev.nombre, trabajado: true, solicitado: false, aprobado: false, fechaSolicitud: null, fechaDisfrute: null, sacrificado: false }); festivosAñadidos++; } });
      } else {
        const fechasNuevas = new Set(nuevosFestivos.map(ev => ev.fecha)), añosDelIcs = [...aniosAfectados];
        festivos = festivos.filter(f => { const a = parseInt(f.fecha.slice(0,4)); if(!añosDelIcs.includes(a)) return true; if(fechasNuevas.has(f.fecha)) return true; festivosBorrados++; return false; });
        nuevosFestivos.forEach(ev => { const existente = festivos.find(f => f.fecha === ev.fecha); if(existente){ if(existente.nombre !== ev.nombre){ existente.nombre = ev.nombre; festivosActualizados++; } } else { festivos.push({ fecha: ev.fecha, nombre: ev.nombre, trabajado: true, solicitado: false, aprobado: false, fechaSolicitud: null, fechaDisfrute: null, sacrificado: false }); festivosAñadidos++; } });
      }
      nuevosPersonales.forEach(ev => { const yaExiste = diasPersonales.find(d => d.fecha === ev.fecha); if(yaExiste){ if(yaExiste.nota !== ev.nombre) yaExiste.nota = ev.nombre; } else { diasPersonales.push({ fecha: ev.fecha, nota: ev.nombre, tipo: "personal" }); personalesAñadidos++; } });
      festivos.sort((a,b) => a.fecha.localeCompare(b.fecha)); diasPersonales.sort((a,b) => a.fecha.localeCompare(b.fecha));
      saveFestivos(); saveDiasPersonales(); renderDiasTrabajo();
      let resumen = "✅ Importación completa\n\nModo: " + (soloAnadir ? "AÑADIR" : "REEMPLAZAR") + "\n\n📅 Festivos:\n  + " + festivosAñadidos + " añadidos\n  ✏ " + festivosActualizados + " actualizados\n";
      if(festivosBorrados > 0) resumen += "  🗑 " + festivosBorrados + " borrados\n";
      if(personalesAñadidos > 0) resumen += "\n👤 Días personales añadidos: " + personalesAñadidos;
      alert(resumen);
    } catch(err){ alert("❌ Error al leer el .ics: " + (err.message || "")); }
  };
  rd.readAsText(file);
}

function parseICS(texto){
  const eventos = [];
  const lineasRaw = texto.split(/\r?\n/); const lineas = [];
  for(let i = 0; i < lineasRaw.length; i++){ const l = lineasRaw[i]; if((l.startsWith(" ") || l.startsWith("\t")) && lineas.length > 0) lineas[lineas.length-1] += l.slice(1); else lineas.push(l); }
  let actual = null;
  for(const l of lineas){
    if(l.startsWith("BEGIN:VEVENT")) actual = {};
    else if(l.startsWith("END:VEVENT")){ if(actual && actual.fecha && actual.nombre) eventos.push(actual); actual = null; }
    else if(actual){
      if(l.startsWith("DTSTART")){ const m = l.match(/(\d{8})/); if(m){ const s = m[1]; actual.fecha = s.slice(0,4) + "-" + s.slice(4,6) + "-" + s.slice(6,8); } }
      else if(l.startsWith("SUMMARY")){ const idx = l.indexOf(":"); if(idx >= 0){ let v = l.slice(idx+1).replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\n/gi, " "); actual.nombre = v.trim(); } }
    }
  }
  return eventos;
}

function abrirModalFestivoNuevo(){
  const prev = document.getElementById("modalFestivoNuevo"); if(prev) prev.remove();
  const hoy = new Date(); const fechaDefault = hoy.getFullYear() + "-" + String(hoy.getMonth()+1).padStart(2,"0") + "-" + String(hoy.getDate()).padStart(2,"0");
  const m = document.createElement("div");
  m.id = "modalFestivoNuevo"; m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px";
  m.innerHTML = `<div style="background:#1e293b;border-radius:16px;padding:20px;max-width:380px;width:100%;border:1px solid #334155"><div style="font-size:16px;font-weight:900;color:#38bdf8;text-align:center;margin-bottom:16px">📅 Nuevo festivo</div><div style="font-size:11px;color:#64748b;font-weight:800;margin-bottom:6px">FECHA</div><input type="date" id="nfFecha" value="${fechaDefault}" onchange="onNuevaFechaFestivoChange()" style="width:100%;font-size:16px;padding:12px;border-radius:10px;border:1px solid #475569;background:#0f172a;color:#fff;margin-bottom:12px;outline:none"><div id="nfAviso" style="font-size:12px;color:#a7f3d0;background:#164e63;padding:10px 12px;border-radius:8px;margin-bottom:12px;line-height:1.4;text-align:center"></div><div style="font-size:11px;color:#64748b;font-weight:800;margin-bottom:6px">NOMBRE</div><input type="text" id="nfNombre" placeholder="Ej: Nochebuena" maxlength="40" style="width:100%;font-size:14px;padding:12px;border-radius:10px;border:1px solid #475569;background:#0f172a;color:#fff;margin-bottom:16px;outline:none"><div style="display:flex;gap:8px"><button type="button" onclick="cerrarModalFestivoNuevo()" style="flex:1;background:#334155;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer">Cancelar</button><button type="button" onclick="guardarNuevoFestivo()" style="flex:1;background:#0891b2;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer">✅ Guardar</button></div></div>`;
  document.body.appendChild(m); m.addEventListener("click", (e) => { if(e.target === m) cerrarModalFestivoNuevo(); });
  onNuevaFechaFestivoChange(); setTimeout(() => { const inp = document.getElementById("nfNombre"); if(inp) inp.focus(); }, 150);
}
function cerrarModalFestivoNuevo(){ const m = document.getElementById("modalFestivoNuevo"); if(m) m.remove(); }
function onNuevaFechaFestivoChange(){
  const el = document.getElementById("nfAviso"), inp = document.getElementById("nfFecha"); if(!el || !inp) return;
  const v = inp.value; if(!/^\d{4}-\d{2}-\d{2}$/.test(v)){ el.innerHTML = ""; return; }
  const p = v.split("-"), d = new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2])), dia = d.getDay();
  const dup = festivos.find(f => f.fecha === v);
  if(dup){ el.innerHTML = "⚠️ Ya existe un festivo ese día (" + dup.nombre + ")"; el.style.background = "#78350f"; el.style.color = "#fde68a"; }
  else if(dia === 0 || dia === 1){ el.innerHTML = "ℹ️ Cae en " + (dia === 0 ? "Domingo" : "Lunes") + " (día de descanso habitual)"; el.style.background = "#1e3a8a"; el.style.color = "#bfdbfe"; }
  else { el.innerHTML = "✅ Día laborable válido"; el.style.background = "#164e63"; el.style.color = "#a7f3d0"; }
}
function guardarNuevoFestivo(){
  const fecha = document.getElementById("nfFecha").value, nombre = (document.getElementById("nfNombre").value || "").trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha)){ alert("Selecciona una fecha válida."); return; }
  if(!nombre){ alert("Escribe un nombre para el festivo."); return; }
  if(festivos.find(f => f.fecha === fecha)){ alert("Ya existe un festivo en esa fecha."); return; }
  const p = fecha.split("-"), d = new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2])), dia = d.getDay();
  if(dia === 0 || dia === 1){ if(!confirm("⚠️ Esa fecha cae en " + (dia === 0 ? "Domingo" : "Lunes") + ".\n\nNormalmente no cuenta como laborable, pero puedes guardarlo igualmente.\n\n¿Quieres añadirlo de todas formas?")) return; }
  festivos.push({ fecha, nombre, trabajado: true, solicitado: false, aprobado: false, fechaSolicitud: null, fechaDisfrute: null, sacrificado: false });
  festivos.sort((a,b) => a.fecha.localeCompare(b.fecha));
  saveFestivos(); cerrarModalFestivoNuevo(); renderDiasTrabajo(); mostrarToast("✅ Festivo añadido: " + nombre);
}

/* ==================== SONIDOS ==================== */
let audioActual = null;
function abrirSonidosPantalla(){ const d=document.getElementById("drawer"),o=document.getElementById("overlay"); if(d)d.classList.remove("active"); if(o)o.classList.remove("active"); const p=document.getElementById("sonidosPantalla"); if(p)p.style.display="block"; renderSonidosPanel(); }
function cerrarSonidosPantalla(){ const p=document.getElementById("sonidosPantalla"); if(p)p.style.display="none"; detenerAudioActual(); }
function abrirGeotabDrive(){ try { detenerAudioActual(); } catch(e){} try { window.location.href = "geotabdrive://"; setTimeout(() => { if(document.visibilityState === "visible"){ alert("⚠️ No se pudo abrir Geotab Drive.\n\n¿Está instalada?"); } }, 1500); } catch(e){ alert("No se pudo abrir Geotab Drive."); } }
function detenerAudioActual(){ if(audioActual){ try { audioActual.pause(); audioActual.currentTime = 0; audioActual.src = ""; audioActual.load(); } catch(e){} audioActual = null; } try { if(window.AndroidAudio && window.AndroidAudio.abandonAudioFocus) window.AndroidAudio.abandonAudioFocus(); } catch(e){} }
function reanudarMusica(){ if(window.AndroidAudio && window.AndroidAudio.reanudarMusica){ try { window.AndroidAudio.reanudarMusica(); mostrarToast('▶️ Música reanudada'); } catch(e){ mostrarToast('⚠️ No se pudo reanudar'); } } else { mostrarToast('⚠️ No disponible en esta versión'); } }

async function renderSonidosPanel(){
  const cont = document.getElementById("sonidosContenido"); if(!cont) return;
  cont.innerHTML = `<div style="text-align:center;color:#94a3b8;padding:24px">Cargando audios…</div>`;
  let manifest = null;
  try { const r = await fetch("audios/manifest.json"); if(!r.ok) throw new Error("HTTP " + r.status); manifest = await r.json(); } catch(e){ console.warn("No se pudo cargar audios/manifest.json:", e); }
  if(!manifest || typeof manifest !== "object" || Array.isArray(manifest)){ cont.innerHTML = `<div class="card" style="background:#78350f;border:1px solid #b45309"><div style="font-size:14px;color:#fbbf24;font-weight:800;margin-bottom:6px">⚠️ No se pudo leer audios/manifest.json</div><button type="button" onclick="renderSonidosPanel()" style="width:100%;margin-top:12px;background:#334155;color:#fff;border:none;border-radius:8px;padding:10px;font-weight:700;cursor:pointer">🔄 Reintentar</button></div>`; return; }
  const idiomas = [{code:"ESP",titulo:"🇪🇸 Español"},{code:"ENG",titulo:"🇬🇧 English"},{code:"FRA",titulo:"🇫🇷 Français"},{code:"ITA",titulo:"🇮🇹 Italiano"},{code:"DEU",titulo:"🇩🇪 Deutsch"},{code:"POR",titulo:"🇵🇹 Português"},{code:"CAT",titulo:"🟡 Català"}];
  const detectarIdioma = n => { const u = n.toUpperCase(); for(const i of idiomas){ if(u.includes(i.code)) return i; } return { code: "OTROS", titulo: "🌐 Otros" }; };
  const grupos = {};
  Object.entries(manifest).forEach(([archivo, titulo]) => { const idi = detectarIdioma(archivo); if(!grupos[idi.code]) grupos[idi.code] = { titulo: idi.titulo, items: [] }; grupos[idi.code].items.push({ archivo, titulo }); });
  const ordenFinal = [...idiomas.map(i => i.code), "OTROS"];
  const gruposOrdenados = ordenFinal.filter(c => grupos[c]).map(c => ({ code: c, ...grupos[c] }));
  if(gruposOrdenados.length === 0){ cont.innerHTML = `<div class="card" style="text-align:center;color:#94a3b8;padding:30px">Sin audios configurados.</div>`; return; }
  let html = `<button type="button" onclick="abrirGeotabDrive()" style="width:100%;display:flex;align-items:center;justify-content:center;gap:10px;background:linear-gradient(135deg,#0c4a6e,#075985);border:2px solid #0ea5e9;border-radius:14px;padding:16px;color:#7dd3fc;font-size:16px;font-weight:900;letter-spacing:0.5px;cursor:pointer;margin-bottom:10px"><span style="font-size:22px">🚗</span><span>ABRIR GEOTAB DRIVE</span></button><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px"><button type="button" onclick="reanudarMusica()" style="display:flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,#1db954,#168f40);border:2px solid #1ed760;border-radius:12px;padding:14px 6px;color:#fff;font-size:14px;font-weight:900;cursor:pointer"><span style="font-size:20px">▶️</span><span>REANUDAR</span></button><button type="button" onclick="detenerAudioActual()" style="display:flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,#7f1d1d,#991b1b);border:2px solid #ef4444;border-radius:12px;padding:14px 6px;color:#fca5a5;font-size:14px;font-weight:900;cursor:pointer"><span style="font-size:20px">⏹</span><span>PARAR</span></button></div>`;
  gruposOrdenados.forEach(grupo => {
    html += `<div style="font-size:13px;color:#38bdf8;font-weight:900;letter-spacing:0.5px;margin:16px 0 10px;padding-bottom:6px;border-bottom:1px solid #334155">${grupo.titulo}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">`;
    grupo.items.forEach(({ archivo, titulo }) => { const url = "audios/" + archivo; html += `<button type="button" onclick="reproducirAudio('${url.replace(/'/g, "\\'")}', this)" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:linear-gradient(135deg,#1e293b,#0f172a);border:2px solid #334155;border-radius:16px;padding:22px 10px;min-height:130px;color:#fff;font-size:15px;font-weight:800;cursor:pointer;text-align:center;transition:all 0.15s"><span style="font-size:42px;line-height:1">🎵</span><span style="word-break:break-word;line-height:1.25">${titulo}</span></button>`; });
    html += `</div>`;
  });
  cont.innerHTML = html;
}

function reproducirAudio(url, boton){
  detenerAudioActual();
  try { if(window.AndroidAudio && window.AndroidAudio.requestAudioFocus) window.AndroidAudio.requestAudioFocus(); } catch(e){}
  audioActual = new Audio(url); audioActual.volume = 1.0;
  audioActual.onended = () => { try { if(window.AndroidAudio && window.AndroidAudio.abandonAudioFocus) window.AndroidAudio.abandonAudioFocus(); } catch(e){} setTimeout(() => { if(window.AndroidAudio && window.AndroidAudio.reanudarMusica){ try { window.AndroidAudio.reanudarMusica(); } catch(e){} } }, 800); audioActual = null; };
  audioActual.play().catch(e => { alert("❌ No se pudo reproducir:\n" + url); try { if(window.AndroidAudio && window.AndroidAudio.abandonAudioFocus) window.AndroidAudio.abandonAudioFocus(); } catch(e2){} });
  if(boton){ boton.style.borderColor = "#38bdf8"; boton.style.background = "linear-gradient(135deg,#1e40af,#1e3a8a)"; setTimeout(() => { boton.style.borderColor = "#334155"; boton.style.background = "linear-gradient(135deg,#1e293b,#0f172a)"; }, 800); }
}

/* ==================== DEBUG (ERUDA) ==================== */
function cargarEruda(){ return new Promise((resolve, reject) => { if(window.eruda){ resolve(); return; } const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/eruda"; s.onload = () => { if(window.eruda){ window.eruda.init(); resolve(); } else { reject(new Error("eruda no se inicializó")); } }; s.onerror = () => reject(new Error("No se pudo cargar Eruda")); document.head.appendChild(s); }); }
function activarModoDebug(){ safeStorage.set("uberCambioDebug", "1"); cargarEruda().then(() => mostrarToast("🐞 Modo debug activado")).catch(e => alert("❌ Error: " + e.message)); }
function desactivarModoDebug(){ safeStorage.set("uberCambioDebug", "0"); if(window.eruda && window.eruda.destroy){ try { window.eruda.destroy(); } catch(e){} } mostrarToast("🐞 Modo debug desactivado"); }
function toggleModoDebug(){ const activo = safeStorage.get("uberCambioDebug") === "1"; if(!activo){ if(!confirm("⚠️ Activar modo DEBUG\n\nSe cargará Eruda con consola y herramientas de desarrollo.\n\nÚsalo solo para diagnóstico.")) return; activarModoDebug(); } else { desactivarModoDebug(); } renderResetPanel(); }

/* ==================== BACKUP (COPIA DE SEGURIDAD) ==================== */
function setupBackupUI(){
  const p=document.getElementById("panelInventario"); if(!p)return;
  if(document.getElementById("backupBox"))return;
  const box=document.createElement("div"); box.id="backupBox"; box.style.cssText="margin-top:16px;border-top:1px solid #334155;padding-top:14px";
  const tt=document.createElement("div"); tt.textContent="COPIA DE SEGURIDAD"; tt.style.cssText="font-size:12px;font-weight:800;color:#94a3b8;letter-spacing:0.5px;margin-bottom:8px";
  const be=document.createElement("button"); be.type="button"; be.textContent="💾 Guardar copia"; be.style.cssText="width:100%;background:#334155;color:#fff;padding:12px;border-radius:10px;margin-bottom:8px;font-weight:700;font-size:15px;border:none;cursor:pointer"; be.onclick=exportInventory;
  const bi=document.createElement("button"); bi.type="button"; bi.textContent="📂 Cargar copia"; bi.style.cssText=be.style.cssText; bi.onclick=()=>fi.click();
  const fi=document.createElement("input"); fi.type="file"; fi.accept="application/json,.json"; fi.style.display="none"; fi.onchange=e=>{const f=e.target.files[0];if(f)importInventory(f);fi.value=""};
  box.appendChild(tt); box.appendChild(be); box.appendChild(bi); box.appendChild(fi); p.appendChild(box);
}

async function exportInventory(){
  const data = { app: "uberCambioVTC", version: 12, exportedAt: new Date().toISOString(), stock, hucha, totalTips, pines: pinesLista, reservaMinima, topesRecibir, diaReset, resetSkip, ultimoResetPropinas, stats: statsOps, cierres: loadCierres(), historicoResets: loadHistoricoResets(), cambios: loadCambios(), festivos: festivos, diasPersonales: diasPersonales, vacacionesAsignadas: diasVacacionesAsignados, diasNoTrabajados: diasNoTrabajados, historialOps: loadHistorialOps() };
  const js = JSON.stringify(data, null, 2);
  const st = new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
  const fn = "cambio-vtc-" + st + ".json";
  const eleccion = await preguntarModoExport(); if(!eleccion) return;
  const Cap = window.Capacitor;
  if(!Cap || !Cap.Plugins || !Cap.Plugins.Filesystem){ alert("❌ Filesystem no disponible"); return; }
  const Fs = Cap.Plugins.Filesystem;
  let uriGuardado = null;
  try {
    try { const perm = await Fs.checkPermissions(); if(perm.publicStorage !== 'granted'){ await Fs.requestPermissions(); } } catch(e){}
    const result = await Fs.writeFile({ path: 'Documents/CambioVTC/copias/' + fn, data: js, directory: 'DOCUMENTS', encoding: 'utf8', recursive: true });
    uriGuardado = result.uri;
  } catch(e){ alert("❌ No se pudo guardar:\n" + (e.message || "")); return; }
  if(eleccion === "compartir"){
    if(Cap.Plugins.Share){ try { await Cap.Plugins.Share.share({ title: 'Copia de seguridad', text: 'Copia de seguridad Cambio VTC', url: uriGuardado, dialogTitle: 'Compartir copia' }); return; } catch(e){} }
    else { alert("⚠️ Plugin Share no disponible.\n\nLa copia se ha guardado en:\nDocuments/Documents/CambioVTC/copias/" + fn); }
  } else { mostrarToast("✅ Guardado en Documents/CambioVTC/copias/"); }
}

function preguntarModoExport(){
  return new Promise((resolve) => {
    const prev = document.getElementById("modalExportOpciones"); if(prev) prev.remove();
    const m = document.createElement("div");
    m.id = "modalExportOpciones"; m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px";
    m.innerHTML = `<div style="background:#1e293b;color:#f8fafc;border-radius:16px;padding:20px;max-width:380px;width:100%;border:1px solid #334155"><div style="font-size:16px;font-weight:900;color:#38bdf8;text-align:center;margin-bottom:6px">💾 Guardar copia</div><div style="font-size:12px;color:#94a3b8;text-align:center;margin-bottom:18px;line-height:1.4">¿Qué quieres hacer con el archivo?</div><button type="button" id="expLocal" style="width:100%;display:flex;align-items:center;gap:14px;padding:16px;margin-bottom:10px;background:linear-gradient(135deg,#1e3a8a,#1e40af);border:2px solid #3b82f6;border-radius:12px;color:#fff;cursor:pointer;font-size:15px;font-weight:800;text-align:left"><span style="font-size:28px">📱</span><div style="flex:1"><div>Guardar en el móvil</div><div style="font-size:11px;color:#bfdbfe;font-weight:600;margin-top:3px">Documents/CambioVTC/copias/</div></div></button><button type="button" id="expCompartir" style="width:100%;display:flex;align-items:center;gap:14px;padding:16px;margin-bottom:14px;background:linear-gradient(135deg,#4c1d95,#6d28d9);border:2px solid #8b5cf6;border-radius:12px;color:#fff;cursor:pointer;font-size:15px;font-weight:800;text-align:left"><span style="font-size:28px">📤</span><div style="flex:1"><div>Compartir / Exportar</div><div style="font-size:11px;color:#ddd6fe;font-weight:600;margin-top:3px">Drive, WhatsApp, Gmail, etc.</div></div></button><button type="button" id="expCancelar" style="width:100%;padding:12px;background:#0f172a;color:#94a3b8;border:1px solid #475569;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer">✖ Cancelar</button></div>`;
    document.body.appendChild(m);
    document.getElementById("expLocal").onclick = () => { m.remove(); resolve("local"); };
    document.getElementById("expCompartir").onclick = () => { m.remove(); resolve("compartir"); };
    document.getElementById("expCancelar").onclick = () => { m.remove(); resolve(null); };
    m.addEventListener("click", (e) => { if(e.target === m){ m.remove(); resolve(null); } });
  });
}

function importInventory(file){
  const rd=new FileReader();
  rd.onload=()=>{
    try{
      const data=JSON.parse(rd.result);
      if(!data||!Array.isArray(data.stock)||data.stock.length!==denominations.length){ alert("El archivo no es una copia válida."); return; }
      if(!confirm("¿Reemplazar el inventario, hucha, propinas, reserva, topes, estadísticas e historial actuales?")) return;
      stock=data.stock.map(x=>Math.max(0,parseInt(x)||0));
      if(Array.isArray(data.hucha) && data.hucha.length === denominations.length){ hucha = data.hucha.map(x => Math.max(0, parseInt(x) || 0)); saveHucha(); }
      if(typeof data.totalTips==="number") totalTips=Math.max(0,data.totalTips);
      if(data.reservaMinima&&typeof data.reservaMinima==="object"){ reservaMinima=Object.assign({},RESERVA_DEFAULT); denominations.forEach(d=>{if(typeof data.reservaMinima[d.c]==="number")reservaMinima[d.c]=Math.max(0,parseInt(data.reservaMinima[d.c])||0)}); safeStorage.set("uberCambioReserva",JSON.stringify(reservaMinima)); }
      if(data.topesRecibir&&typeof data.topesRecibir==="object"){ topesRecibir=Object.assign({},TOPES_DEFAULT); denominations.forEach(d=>{if(typeof data.topesRecibir[d.c]==="number")topesRecibir[d.c]=Math.max(0,parseInt(data.topesRecibir[d.c])||0)}); saveTopes(); }
      if(typeof data.diaReset === "number"){ const n = parseInt(data.diaReset); diaReset = (isNaN(n) || n < 0) ? 20 : Math.min(31, n); saveDiaReset(); }
      if(typeof data.resetSkip === "number"){ resetSkip = Math.max(0, parseInt(data.resetSkip) || 0); saveResetSkip(); }
      if(typeof data.ultimoResetPropinas==="string"){ ultimoResetPropinas=data.ultimoResetPropinas; saveUltimoResetPropinas(); }
      if(data.stats&&typeof data.stats==="object"){ statsOps={ operations:parseInt(data.stats.operations)||0, received:Array.isArray(data.stats.received)?data.stats.received.map(x=>parseInt(x)||0):new Array(denominations.length).fill(0), spent:Array.isArray(data.stats.spent)?data.stats.spent.map(x=>parseInt(x)||0):new Array(denominations.length).fill(0), deposited:Array.isArray(data.stats.deposited)?data.stats.deposited.map(x=>parseInt(x)||0):new Array(denominations.length).fill(0), repuesto:Array.isArray(data.stats.repuesto)?data.stats.repuesto.map(x=>parseInt(x)||0):new Array(denominations.length).fill(0), cambioNeto:Array.isArray(data.stats.cambioNeto)?data.stats.cambioNeto.map(x=>parseInt(x)||0):new Array(denominations.length).fill(0), manualIn:Array.isArray(data.stats.manualIn)?data.stats.manualIn.map(x=>parseInt(x)||0):new Array(denominations.length).fill(0), manualOut:Array.isArray(data.stats.manualOut)?data.stats.manualOut.map(x=>parseInt(x)||0):new Array(denominations.length).fill(0) }; saveStats(); }
      if(Array.isArray(data.cierres)) saveCierres(data.cierres);
      if(Array.isArray(data.historicoResets)) saveHistoricoResets(data.historicoResets);
      if(Array.isArray(data.cambios)) saveCambios(data.cambios);
      if(Array.isArray(data.diasNoTrabajados)){ const validos = data.diasNoTrabajados.map(Number).filter(n => n >= 0 && n <= 6); if(validos.length > 0){ diasNoTrabajados = validos; saveDiasNoTrabajados(); } }
      if(Array.isArray(data.diasPersonales)){ diasPersonales = data.diasPersonales; saveDiasPersonales(); }
      if(data.vacacionesAsignadas && typeof data.vacacionesAsignadas === "object" && !Array.isArray(data.vacacionesAsignadas)){ diasVacacionesAsignados = data.vacacionesAsignadas; saveVacacionesAsignados(); }
      if(Array.isArray(data.festivos)){ festivos = data.festivos.map(f => ({ fechaDisfrute: null, ...f })); saveFestivos(); }
      if(Array.isArray(data.pines)){ pinesLista = data.pines.filter(x => x && x.mat && x.pin).map(x => ({ mat: x.mat, pin: x.pin, combustible: x.combustible !== false, pinturaBarca: !!x.pinturaBarca, sinPeaje: !!x.sinPeaje })); savePines(); }
      if(Array.isArray(data.historialOps)){ saveHistorialOps(data.historialOps); }
      saveStock(); saveTips(); renderStockList(); renderReservaList(); renderTopesList(); updateCashSummary(); renderCierreHistorico(); renderResetPanel();
      try{ renderDiasTrabajo(); }catch(e){}
      alert("✅ Copia restaurada.");
    }catch(e){ alert("No se pudo leer el archivo."); }
  };
  rd.readAsText(file);
}

/* ==================== RECIBIR IMAGEN COMPARTIDA ==================== */
let __procesandoCompartida = false;
window.recibirImagenCompartida = async function(){
  if(__procesandoCompartida) return; __procesandoCompartida = true;
  try {
    const Cap = window.Capacitor;
    if(!Cap || !Cap.Plugins || !Cap.Plugins.Filesystem){ console.warn('Plugin Filesystem no disponible'); return; }
    const Fs = Cap.Plugins.Filesystem;
    const dirs = ['DATA', 'DOCUMENTS', 'CACHE', 'EXTERNAL'];
    let res = null, dirUsado = null;
    for(const dir of dirs){ try { res = await Fs.readFile({ path: 'shared_image.png', directory: dir }); dirUsado = dir; break; } catch(e){} }
    if(!res){ console.warn('shared_image.png no encontrado'); return; }
    const byteString = atob(res.data);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for(let i=0;i<byteString.length;i++) ia[i]=byteString.charCodeAt(i);
    const blob = new Blob([ab], { type: 'image/png' });
    procesarImagenPrecio(blob);
    setTimeout(()=>{ Fs.deleteFile({ path: 'shared_image.png', directory: dirUsado }).catch(()=>{}); }, 3000);
  } catch(e){ console.warn('Error leyendo imagen compartida:', e); } finally { setTimeout(() => { __procesandoCompartida = false; }, 3000); }
};

/* ==================== NAVEGACIÓN Y DRAWER ==================== */
function drawerTab(nombre){
  const tabs = {
    caja:         { btn:"tabCaja",         cont:"drawerTabCaja",         c1:"#1e3a8a", c2:"#1e40af", cb:"#3b82f6" },
    herramientas: { btn:"tabHerramientas", cont:"drawerTabHerramientas", c1:"#4c1d95", c2:"#6d28d9", cb:"#8b5cf6" },
    sistema:      { btn:"tabSistema",      cont:"drawerTabSistema",      c1:"#7f1d1d", c2:"#991b1b", cb:"#ef4444" }
  };
  Object.keys(tabs).forEach(k => {
    const t = tabs[k], b = document.getElementById(t.btn), c = document.getElementById(t.cont);
    if(!b || !c) return;
    if(k === nombre){ b.classList.remove("drawer-tab-idle"); b.classList.add("drawer-tab-active"); b.style.setProperty("--c1", t.c1); b.style.setProperty("--c2", t.c2); b.style.setProperty("--cb", t.cb); c.style.display = "block"; }
    else { b.classList.remove("drawer-tab-active"); b.classList.add("drawer-tab-idle"); c.style.display = "none"; }
  });
  if(nombre === "caja"){ try { renderStockList(); } catch(e){} try { actualizarBotonModoEdicion(); } catch(e){} }
  if(nombre === "sistema"){ try { renderResetPanel(); } catch(e){} }
  safeStorage.set("uberCambioDrawerTab", nombre);
}

function toggleMenu(){
  const d = document.getElementById("drawer"), o = document.getElementById("overlay"); if(!d || !o) return;
  const abriendo = !d.classList.contains("active");
  d.classList.toggle("active"); o.classList.toggle("active");
  if(abriendo){ const guardada = safeStorage.get("uberCambioDrawerTab") || "caja"; drawerTab(guardada); }
}

/* ==================== PANTALLA SIEMPRE ACTIVA ==================== */
async function activarPantallaSiempreActiva(){
  try { const Cap = window.Capacitor; if(!Cap || !Cap.Plugins || !Cap.Plugins.KeepAwake){ console.warn('KeepAwake no disponible'); return; } await Cap.Plugins.KeepAwake.keepAwake(); console.log('🔆 Pantalla siempre activa'); } catch(e){ console.warn('Error keepAwake:', e); }
}
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible'){ activarPantallaSiempreActiva(); try { checkResetCoche(); } catch(e){} } });
window.addEventListener('focus', () => { activarPantallaSiempreActiva(); });

/* ==================== INIT (ARRANQUE) ==================== */
function init(){
  try { solicitarPermisoNotificaciones(); } catch(e){}
  setTimeout(() => { activarPantallaSiempreActiva(); }, 600);
  setTimeout(() => { crearCanalNotificacionesZona(); }, 500);
  setTimeout(() => { checkFestivosCaducidad(); }, 1500);
  setTimeout(() => { programarAvisosFestivos(); }, 2000);
  setTimeout(() => { programarAvisosResetPropinas(); }, 2200);
  setTimeout(() => { programarAvisosDeposito(); }, 2400);
  setTimeout(() => { asegurarAlarmasExactas(); }, 1000);
  setTimeout(() => { try{ if(archivarAniosAntiguos()) renderDiasTrabajo(); }catch(e){} }, 2600);
  if(safeStorage.get("uberCambioDebug") === "1"){ cargarEruda().catch(e => console.warn("Eruda no cargó:", e)); }
  
  try{ drawerTab(safeStorage.get("uberCambioDrawerTab") || "caja"); }catch(e){}
  try{ renderButtons(); }catch(e){}
  try{ renderStockList(); }catch(e){}
  try{ updateCashSummary(); }catch(e){}
  try{ setupBackupUI(); }catch(e){}
  try{ renderCierreHistorico(); }catch(e){}
  try{ checkAutoResetPropinas(); }catch(e){}
  try{ checkResetCoche(); }catch(e){}
  setInterval(checkResetCoche, 60000);
  
  // Auto-reconexión GPS
  if(safeStorage.get("uberCambioGeoActivo") === "1"){
    setTimeout(() => { try { if(!geoWatcherId){ iniciarGeolocalizacion(); } } catch(e){} }, 3000);
  }

  // Botón del coche en menú principal
  let intentosCoche = 0;
  const intervaloCoche = setInterval(() => {
    try {
      const exito = actualizarBotonCochePrincipal();
      intentosCoche++;
      if (exito || intentosCoche > 10) clearInterval(intervaloCoche);
    } catch(e){ clearInterval(intervaloCoche); }
  }, 500);

  setTimeout(() => {
    const fD = document.getElementById("depManualFecha"), fT = document.getElementById("depManualFechaTxt");
    if(fD && fT){ fD.addEventListener("change", () => { fT.value = fD.value || ""; }); fT.addEventListener("input", () => { const v = fT.value.trim(); if(/^\d{4}-\d{2}-\d{2}$/.test(v)) fD.value = v; }); }
    const hD = document.getElementById("depManualHora"), hT = document.getElementById("depManualHoraTxt");
    if(hD && hT){ hD.addEventListener("change", () => { hT.value = hD.value || ""; }); hT.addEventListener("input", () => { const v = hT.value.trim(); if(/^\d{2}:\d{2}$/.test(v)) hD.value = v; }); }
  }, 100);

  setTimeout(() => { try { precalentarOCR(); } catch(e){} }, 800);

  const s = document.getElementById("splash");
  if(s){ setTimeout(()=>{ s.classList.add("oculto"); document.body.classList.remove("splash-active"); setTimeout(()=>{ if(s.parentNode) s.parentNode.removeChild(s); },500); },2500); }
}

/* ==================== ARRANQUE ==================== */
init();

/* ==================== BARRAS DEL SISTEMA (ANDROID) ==================== */
setTimeout(async () => {
  try {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AndroidSystemBars) {
      const ASB = window.Capacitor.Plugins.AndroidSystemBars;
      const info = await ASB.initialize();

      await ASB.setSystemBarsStyle({
        style: 'DARK',
        color: '#0f172a'
      });

      if (typeof ASB.setNavigationBarColor === 'function') {
        await ASB.setNavigationBarColor({ color: '#00000000' });
      } else if (typeof ASB.setNavigationBar === 'function') {
        await ASB.setNavigationBar({ color: '#00000000' });
      } else if (typeof ASB.setSystemBarsColor === 'function') {
        await ASB.setSystemBarsColor({ statusBarColor: '#0f172a', navigationBarColor: '#00000000' });
      }

      if (info.isAndroid35Plus) {
        await ASB.setOverlay({ overlay: true });
      }
    }
  } catch(e) {
    console.warn('Error configurando barras:', e);
  }
}, 500);

/* ==================== FIX: CÁLCULO DEL PRÓXIMO RESET ==================== */
function calcularProximoReset(){
  if(diaReset === 0) return null;
  const now = new Date();
  const skips = Math.max(0, parseInt(resetSkip) || 0);

  let candidato = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
  const diasEsteMes = new Date(candidato.getFullYear(), candidato.getMonth() + 1, 0).getDate();
  candidato.setDate(Math.min(diaReset, diasEsteMes));

  let mesesExtra = 0;
  if(candidato <= now) mesesExtra = 1;
  mesesExtra += skips;

  candidato.setDate(1);
  candidato.setMonth(candidato.getMonth() + mesesExtra);
  const diasMesFinal = new Date(candidato.getFullYear(), candidato.getMonth() + 1, 0).getDate();
  candidato.setDate(Math.min(diaReset, diasMesFinal));

  return candidato;
}

// Detector de deslizamiento desde el borde izquierdo
/* ==================== GESTOS TÁCTILES (SWIPE) ==================== */
let touchStartX = 0;
let touchStartY = 0;
const umbralDeslizamiento = 80; // Píxeles mínimos para considerar que es un deslizamiento
const margenBorde = 40; // Píxeles desde el borde (un poco más adentro para no activar el "Atrás" de Android)

document.addEventListener('touchstart', e => {
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
}, { passive: true });

document.addEventListener('touchend', e => {
  const touchEndX = e.changedTouches[0].screenX;
  const touchEndY = e.changedTouches[0].screenY;
  
  const deltaX = touchEndX - touchStartX;
  const deltaY = Math.abs(touchEndY - touchStartY);

  // Si el movimiento es más vertical que horizontal, ignoramos (es un scroll)
  if (deltaY > 60) return; 

  // 1. Deslizar de IZQUIERDA a DERECHA (Empieza cerca del borde izquierdo) -> Menú de ESTADOS
  if (touchStartX < margenBorde && deltaX > umbralDeslizamiento) {
    if (typeof abrirMenuEstado === 'function') {
      abrirMenuEstado(); 
    }
  }

  // 2. Deslizar de DERECHA a IZQUIERDA (Empieza cerca del borde derecho) -> Menú de CAJA/HERRAMIENTAS
  const touchInInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
  const touchInMap = e.target.closest('#mapa-leaflet');

  // Evitamos que salte si estamos en un input o en el mapa
  if (!touchInInput && !touchInMap && touchStartX > (window.innerWidth - margenBorde) && deltaX < -umbralDeslizamiento) {
    const drawer = document.getElementById("drawer");
    if (drawer && !drawer.classList.contains("active")) {
      toggleMenu(); 
    }
  }
}, { passive: true });