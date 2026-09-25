"use strict";

const safeStorage = {
  get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } },
  set(k,v){ try { localStorage.setItem(k,v); } catch(e){} },
  remove(k){ try { localStorage.removeItem(k); } catch(e){} }
};

const denominations = [
  {c:10000, n:"100 €", short:"100€", type:"bill", class:"b-100"},
  {c:5000,  n:"50 €",  short:"50€",  type:"bill", class:"b-50"},
  {c:2000,  n:"20 €",  short:"20€",  type:"bill", class:"b-20"},
  {c:1000,  n:"10 €",  short:"10€",  type:"bill", class:"b-10"},
  {c:500,   n:"5 €",   short:"5€",   type:"bill", class:"b-5"},
  {c:200,   n:"2 €",   short:"2 €",  type:"coin", class:"c-200"},
  {c:100,   n:"1 €",   short:"1 €",  type:"coin", class:"c-100"},
  {c:50,    n:"0,50 €", short:"0.50", type:"coin", class:"c-gold"},
  {c:20,    n:"0,20 €", short:"0.20", type:"coin", class:"c-gold"},
  {c:10,    n:"0,10 €", short:"0.10", type:"coin", class:"c-gold"},
  {c:5,     n:"0,05 €", short:"0.05", type:"coin", class:"c-copper"},
  {c:2,     n:"0,02 €", short:"0.02", type:"coin", class:"c-copper"},
  {c:1,     n:"0,01 €", short:"0.01", type:"coin", class:"c-copper"}
];

const RESERVA_MINIMA_DEFAULT = {
  10000:0, 5000:0, 2000:1, 1000:1, 500:1,
  200:2, 100:2, 50:3, 20:5, 10:5, 5:3, 2:3, 1:5
};

let stock = loadStock();
let totalTips = loadTips();
let reservaMinima = loadReserva();
let diaReset = loadDiaReset();
let ultimoResetPropinas = loadUltimoResetPropinas();

let received = [];
let pendingTransaction = null;
let stockInputs = [];
let reservaInputs = [];
let summaryTimer = null;
let precioInterval = null;

function loadStock(){
  const s = safeStorage.get("uberCambioStock");
  if(s){ try{ const a = JSON.parse(s);
    if(Array.isArray(a) && a.length === denominations.length)
      return a.map(x => Math.max(0, parseInt(x)||0));
  }catch(e){} }
  return [0,0,2,3,4,10,10,20,40,10,10,10,10];
}
function loadTips(){ return parseInt(safeStorage.get("uberCambioTips")) || 0; }
function loadReserva(){
  const base = Object.assign({}, RESERVA_MINIMA_DEFAULT);
  const s = safeStorage.get("uberCambioReserva");
  if(s){ try{ const o = JSON.parse(s);
    if(o && typeof o === "object") denominations.forEach(d => {
      if(typeof o[d.c] === "number") base[d.c] = Math.max(0, parseInt(o[d.c])||0);
    });
  }catch(e){} }
  return base;
}
function loadDiaReset(){ const n = parseInt(safeStorage.get("uberCambioDiaReset")); return (n>=1&&n<=31)?n:20; }
function saveDiaReset(){ safeStorage.set("uberCambioDiaReset", String(diaReset)); }
function loadUltimoResetPropinas(){ return safeStorage.get("uberCambioUltimoResetPropinas") || null; }
function saveUltimoResetPropinas(){ safeStorage.set("uberCambioUltimoResetPropinas", ultimoResetPropinas || ""); }

function saveStock(){ safeStorage.set("uberCambioStock", JSON.stringify(stock)); scheduleCashSummary(); }
function saveTips(){ safeStorage.set("uberCambioTips", String(totalTips)); }
function saveReserva(){ safeStorage.set("uberCambioReserva", JSON.stringify(reservaMinima)); scheduleCashSummary(); if(received.length) calculate(); }

function moneyText(c){ return (c/100).toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2})+" €"; }

/* ---------- Resumen ---------- */
function scheduleCashSummary(){
  if(summaryTimer) clearTimeout(summaryTimer);
  summaryTimer = setTimeout(() => { summaryTimer = null; updateCashSummary(); }, 120);
}
function updateCashSummary(){
  let total = 0;
  denominations.forEach((d,i) => { total += d.c * stock[i]; });
  const el = document.getElementById("totalCashDisplay");
  if(el) el.textContent = moneyText(total);

  const checks = [
    ["status20",2000],["status30",3000],["status50",5000],["status80",8000],["status100",10000]
  ];
  const disp = stockDisponible();
  const cache = {};
  checks.forEach(([id,t]) => {
    if(!(t in cache)) cache[t] = estadoPara(t, disp);
    setStatusBadge(id, cache[t]);
  });
}
function estadoPara(target, disp){
  if(canMakeAmount(target, disp)) return "yes";
  if(canMakeAmount(target, stock)) return "warn";
  return "no";
}
function stockDisponible(){
  return stock.map((n,i) => Math.max(0, n - (reservaMinima[denominations[i].c]||0)));
}
function canMakeAmount(target, avail){
  if(target <= 0) return true;
  const r = new Uint8Array(target+1); r[0]=1;
  for(let i=0;i<denominations.length;i++){
    const v = denominations[i].c, m = avail[i];
    if(m<=0 || v>target) continue;
    const u = new Int32Array(target+1).fill(-1);
    for(let t=0;t<=target;t++) if(r[t]) u[t]=0;
    for(let t=0;t+v<=target;t++){
      if(u[t]<0) continue;
      if(u[t]<m && u[t+v]<0){ r[t+v]=1; u[t+v]=u[t]+1; }
    }
  }
  return r[target]===1;
}
function setStatusBadge(id, estado){
  const el = document.getElementById(id); if(!el) return;
  el.style.background=""; el.style.color="";
  if(estado==="yes"){ el.textContent="SÍ"; el.className="status-badge yes"; }
  else if(estado==="warn"){ el.textContent="MÍN"; el.className="status-badge warn";
    el.style.background="#eab308"; el.style.color="#000"; }
  else { el.textContent="NO"; el.className="status-badge no"; }
}

/* ---------- Menú ---------- */
function toggleMenu(){
  const d = document.getElementById("drawer");
  const o = document.getElementById("overlay");
  if(!d||!o) return;
  d.classList.toggle("active");
  o.classList.toggle("active");
}
function switchDrawerTab(tab){
  const panels = {
    inventario: document.getElementById("panelInventario"),
    reserva:    document.getElementById("panelReserva"),
    reset:      document.getElementById("panelReset")
  };
  const tabs = {
    inventario: document.getElementById("tabInventario"),
    reserva:    document.getElementById("tabReserva"),
    reset:      document.getElementById("tabReset")
  };
  const A = "flex:1;padding:8px;border-radius:10px;border:1px solid #475569;background:#334155;color:#fff;font-weight:700;cursor:pointer;font-size:12px";
  const I = "flex:1;padding:8px;border-radius:10px;border:1px solid #475569;background:#1e293b;color:#94a3b8;font-weight:700;cursor:pointer;font-size:12px";
  Object.keys(panels).forEach(k => {
    if(panels[k]) panels[k].style.display = (k===tab)?"block":"none";
    if(tabs[k])   tabs[k].style.cssText = (k===tab)?A:I;
  });
  if(tab==="inventario") renderStockList();
  if(tab==="reserva")    renderReservaList();
  if(tab==="reset")      renderResetPanel();
}

/* ---------- Botones de dinero ---------- */
function renderButtons(){
  const box = document.getElementById("moneyButtons"); if(!box) return;
  box.innerHTML = "";
  const t1 = document.createElement("div"); t1.className="section"; t1.textContent="Billetes"; box.appendChild(t1);
  denominations.slice(0,5).forEach(d=>{
    const b = document.createElement("button");
    b.type="button"; b.className="money"; b.textContent=d.n;
    b.addEventListener("click", () => addMoney(d.c));
    box.appendChild(b);
  });
  const t2 = document.createElement("div"); t2.className="section"; t2.textContent="Monedas"; box.appendChild(t2);
  denominations.slice(5).forEach(d=>{
    const b = document.createElement("button");
    b.type="button"; b.className="money"; b.textContent=d.n;
    b.addEventListener("click", () => addMoney(d.c));
    box.appendChild(b);
  });
}
function addMoney(c){ received.push(c); updateReceived(); calculate(); }
function undoMoney(){ received.pop(); updateReceived(); calculate(); }
function updateReceived(){
  const t = received.reduce((a,b)=>a+b,0);
  const el = document.getElementById("paidDisplay"); if(el) el.textContent = moneyText(t);
}
function setAllTip(){
  const raw = parseFloat(document.getElementById("price").value.replace(',','.'))||0;
  const p = Math.round(raw*100);
  const paid = received.reduce((a,b)=>a+b,0);
  if(paid>p && p>0){
    document.getElementById("tip").value = ((paid-p)/100).toFixed(2);
    calculate();
  }
}

/* ---------- Precio gigante ES/EN ---------- */
function mostrarPrecio(){
  const inp = document.getElementById("price"); if(!inp) return;
  const raw = parseFloat(inp.value.replace(',','.'))||0;
  if(raw<=0){ alert("Escribe primero el precio del viaje."); return; }
  const el = document.getElementById("precioGrande");
  if(el) el.textContent = moneyText(Math.round(raw*100));
  const p = document.getElementById("precioPantalla");
  if(p) p.style.display = "flex";
  iniciarAlternanciaPrecio();
}
function iniciarAlternanciaPrecio(){
  detenerAlternanciaPrecio();
  const t = document.getElementById("precioTitulo"); if(!t) return;
  let en = false;
  t.textContent = "A PAGAR";
  precioInterval = setInterval(()=>{ en=!en; t.textContent = en?"TO PAY":"A PAGAR"; },3000);
}
function detenerAlternanciaPrecio(){
  if(precioInterval){ clearInterval(precioInterval); precioInterval=null; }
}
function cerrarPrecio(){
  detenerAlternanciaPrecio();
  const p = document.getElementById("precioPantalla"); if(p) p.style.display="none";
}

/* ---------- Cambio óptimo ---------- */
function findSmartChange(target, avail){
  let best = null, bestScore = Infinity;
  function bt(i, rest, used, score){
    if(rest===0){ if(score<bestScore){ bestScore=score; best=[...used]; } return; }
    if(i>=denominations.length || rest<0 || score>=bestScore) return;
    const v = denominations[i].c;
    const max = Math.min(avail[i], Math.floor(rest/v));
    for(let n=max;n>=0;n--){
      used[i]=n;
      const pen = (denominations[i].type==="coin" && v<=200) ? n*2 : n;
      bt(i+1, rest-n*v, used, score+pen);
      used[i]=0;
    }
  }
  bt(0,target,new Array(denominations.length).fill(0),0);
  return best;
}

function calculate(){
  const rawP = parseFloat(document.getElementById("price").value.replace(',','.'))||0;
  const price = Math.round(rawP*100);
  const paid = received.reduce((a,b)=>a+b,0);
  const rawT = parseFloat(document.getElementById("tip").value.replace(',','.'))||0;
  const tip = Math.round(rawT*100);

  const resultDiv = document.getElementById("changeResult");
  const changeTotal = document.getElementById("changeTotal");
  const changeGrid = document.getElementById("changeGrid");

  pendingTransaction = null;
  if(price<=0 || paid===0){ resultDiv.style.display="none"; return; }

  const total = price+tip;
  if(paid<total){
    changeTotal.textContent = "FALTAN " + moneyText(total-paid);
    changeGrid.innerHTML = "";
    resultDiv.style.display="block";
    return;
  }

  const incoming = new Array(denominations.length).fill(0);
  received.forEach(c=>{
    const i = denominations.findIndex(d=>d.c===c);
    if(i>=0) incoming[i]++;
  });
  const avail = stock.map((n,i)=>n+incoming[i]);
  const targetChange = paid-total;

  if(targetChange===0){
    pendingTransaction = { incoming, used: new Array(denominations.length).fill(0), tip, tocaReserva:false };
    changeTotal.textContent = tip>0 ? "PAGO EXACTO (Propina: "+moneyText(tip)+")" : "PAGO EXACTO. SIN CAMBIO.";
    changeGrid.innerHTML = "";
    resultDiv.style.display="block";
    return;
  }

  const disp = avail.map((n,i)=>Math.max(0, n-(reservaMinima[denominations[i].c]||0)));
  let used = findSmartChange(targetChange, disp);
  let tocaReserva = false;
  if(!used){ used = findSmartChange(targetChange, avail); tocaReserva = !!used; }

  if(!used){
    changeTotal.textContent = "SIN CAMBIO ÓPTIMO PARA DEVOLVER " + moneyText(targetChange);
    changeGrid.innerHTML = "";
    resultDiv.style.display="block";
    return;
  }

  pendingTransaction = { incoming, used, tip, tocaReserva };
  let h = "DEVOLVER: " + moneyText(targetChange);
  if(tocaReserva) h += " ⚠️ (toca reserva mínima)";
  changeTotal.textContent = h;
  changeGrid.innerHTML = "";
  used.forEach((n,i)=>{
    if(n>0){
      const d = denominations[i];
      const it = document.createElement("div"); it.className="cash-item";
      const bd = document.createElement("div"); bd.className="badge"; bd.textContent="x"+n;
      const gr = document.createElement("div");
      gr.className = (d.type==="bill"?"bill-graphic ":"coin-graphic ")+d.class;
      gr.textContent = d.short;
      it.appendChild(bd); it.appendChild(gr);
      changeGrid.appendChild(it);
    }
  });
  resultDiv.style.display="block";
}

function confirmTransaction(){
  if(!pendingTransaction){ alert("Introduce un precio y el dinero recibido."); return; }
  for(let i=0;i<stock.length;i++) stock[i] += pendingTransaction.incoming[i] - pendingTransaction.used[i];
  if(pendingTransaction.tip>0){ totalTips += pendingTransaction.tip; saveTips(); }
  saveStock();
  renderStockList();
  received = [];
  pendingTransaction = null;
  document.getElementById("price").value = "";
  document.getElementById("tip").value = "";
  document.getElementById("changeResult").style.display = "none";
  updateReceived();
  alert("¡Operación guardada!");
}

/* ---------- Inventario ---------- */
function renderStockList(){
  let box = document.getElementById("stockList");
  if(!box){
    const p = document.getElementById("panelInventario")||document.getElementById("drawer");
    if(!p) return;
    box = document.createElement("div"); box.id="stockList"; p.appendChild(box);
  }
  box.innerHTML = ""; stockInputs = [];
  const tipEl = document.getElementById("totalTipDisplay");
  if(tipEl) tipEl.textContent = "💶 Propinas: " + moneyText(totalTips);

  denominations.forEach((d,i)=>{
    const row = document.createElement("div"); row.className="stock-item";
    const t = document.createElement("span"); t.textContent=d.n; t.style.fontWeight="700";
    const ctrl = document.createElement("div"); ctrl.className="stock-ctrl";
    const bm = document.createElement("button"); bm.type="button"; bm.textContent="-";
    bm.onclick = ()=>updateStockVal(i, stock[i]-1);
    const inp = document.createElement("input"); inp.type="number"; inp.min="0"; inp.value=stock[i];
    inp.onchange = (e)=>updateStockVal(i, parseInt(e.target.value)||0);
    const bp = document.createElement("button"); bp.type="button"; bp.textContent="+";
    bp.onclick = ()=>updateStockVal(i, stock[i]+1);
    ctrl.appendChild(bm); ctrl.appendChild(inp); ctrl.appendChild(bp);
    row.appendChild(t); row.appendChild(ctrl);
    box.appendChild(row);
    stockInputs[i] = inp;
  });
}
function updateStockVal(index, val){
  stock[index] = Math.max(0, val);
  if(stockInputs[index]) stockInputs[index].value = stock[index];
  saveStock();
}

/* ---------- Reserva (Límite) ---------- */
function renderReservaList(){
  let box = document.getElementById("reservaList");
  if(!box){
    const p = document.getElementById("panelReserva")||document.getElementById("drawer");
    if(!p) return;
    box = document.createElement("div"); box.id="reservaList"; p.appendChild(box);
  }
  box.innerHTML = ""; reservaInputs = [];
  denominations.forEach((d,i)=>{
    const row = document.createElement("div"); row.className="stock-item";
    const t = document.createElement("span"); t.textContent=d.n; t.style.fontWeight="700";
    const ctrl = document.createElement("div"); ctrl.className="stock-ctrl";
    const bm = document.createElement("button"); bm.type="button"; bm.textContent="-";
    bm.onclick = ()=>updateReservaVal(i, (reservaMinima[d.c]||0)-1);
    const inp = document.createElement("input"); inp.type="number"; inp.min="0"; inp.value=reservaMinima[d.c]||0;
    inp.onchange = (e)=>updateReservaVal(i, parseInt(e.target.value)||0);
    const bp = document.createElement("button"); bp.type="button"; bp.textContent="+";
    bp.onclick = ()=>updateReservaVal(i, (reservaMinima[d.c]||0)+1);
    ctrl.appendChild(bm); ctrl.appendChild(inp); ctrl.appendChild(bp);
    row.appendChild(t); row.appendChild(ctrl);
    box.appendChild(row);
    reservaInputs[i] = inp;
  });
}
function updateReservaVal(index, val){
  const d = denominations[index];
  reservaMinima[d.c] = Math.max(0, val);
  if(reservaInputs[index]) reservaInputs[index].value = reservaMinima[d.c];
  saveReserva();
}
function resetReserva(){
  if(!confirm("¿Restaurar la reserva mínima a los valores por defecto?")) return;
  reservaMinima = Object.assign({}, RESERVA_MINIMA_DEFAULT);
  saveReserva(); renderReservaList();
}

/* ---------- Reset (panel) ---------- */
function renderResetPanel(){
  const inp = document.getElementById("resetDia");
  if(inp) inp.value = diaReset;
  const el = document.getElementById("resetUltimaVez");
  if(el){
    if(ultimoResetPropinas){
      const d = new Date(ultimoResetPropinas);
      el.textContent = "Última vez: " + d.toLocaleDateString("es-ES") + " " +
                       d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});
    } else {
      el.textContent = "Última vez: —";
    }
  }
  renderHistorialPanel();
}
function guardarDiaReset(){
  const el = document.getElementById("resetDia");
  if(!el) return;
  const n = parseInt(el.value)||20;
  diaReset = Math.max(1, Math.min(31, n));
  saveDiaReset();
  el.value = diaReset;
}

function resetCuenta(){
  if(!confirm("¿Poner el INVENTARIO (caja) a CERO?\nLas propinas NO se tocan.")) return;
  stock = new Array(denominations.length).fill(0);
  saveStock();
  renderStockList();
  if(received.length>0) calculate();
}

function resetPropinas(){
  if(!confirm("¿Poner las PROPINAS a CERO?\nEl inventario NO se toca.")) return;
  totalTips = 0;
  saveTips();
  renderStockList();
  renderResetPanel();
}

function resetHistorial(){
  if(!confirm("¿Borrar el HISTORIAL de cierres y de resets?")) return;
  safeStorage.remove("uberCambioCierres");
  safeStorage.remove("uberCambioHistoricoResets");
  renderHistorialPanel();
  const hc = document.getElementById("cierreHistorico");
  if(hc){ hc.innerHTML = ""; hc.style.display = "none"; }
}

function resetTodo(){
  if(!confirm("⚠️ ¿RESETEAR TODO?\n\nSe borrará el inventario, las propinas y el historial.")) return;
  stock = new Array(denominations.length).fill(0);
  totalTips = 0;
  safeStorage.remove("uberCambioCierres");
  safeStorage.remove("uberCambioHistoricoResets");
  saveStock();
  saveTips();
  renderStockList();
  renderResetPanel();
  if(received.length>0) calculate();
}

/* ---------- Reset automático día 20 ---------- */
function loadHistoricoResets(){
  const s = safeStorage.get("uberCambioHistoricoResets");
  if(s){ try { return JSON.parse(s) || []; } catch(e){ return []; } }
  return [];
}
function saveHistoricoResets(h){ safeStorage.set("uberCambioHistoricoResets", JSON.stringify(h)); }

function checkAutoResetPropinas(){
  if(!ultimoResetPropinas){ ultimoResetPropinas = new Date().toISOString(); saveUltimoResetPropinas(); return; }
  const last = new Date(ultimoResetPropinas);
  const now  = new Date();
  // ¿Ha pasado el día 'diaReset' desde la última vez?
  const candidato = new Date(last.getFullYear(), last.getMonth(), diaReset, 0, 0, 0);
  if(candidato <= last) candidato.setMonth(candidato.getMonth()+1);
  if(now >= candidato){
    // Guardar histórico antes de borrar
    const h = loadHistoricoResets();
    h.push({ fecha: now.toISOString(), propinas: totalTips });
    saveHistoricoResets(h);
    totalTips = 0;
    saveTips();
    ultimoResetPropinas = now.toISOString();
    saveUltimoResetPropinas();
    renderStockList();
    renderResetPanel();
  }
}

function renderHistorialPanel(){
  const box = document.getElementById("historialPanel");
  if(!box) return;

  const cierres = loadCierres();
  const resets  = loadHistoricoResets();

  let html = "";

  if(cierres.length > 0){
    html += "<div style='font-size:12px;font-weight:800;color:#94a3b8;letter-spacing:0.5px;margin-bottom:6px'>📜 ÚLTIMOS CIERRES</div>";
    cierres.slice(-10).reverse().forEach(c=>{
      const d = new Date(c.fecha);
      const fecha = d.toLocaleDateString("es-ES")+" "+d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});
      html += "<div style='display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #334155;font-size:13px'>" +
                "<span style='color:#94a3b8'>"+fecha+"</span>" +
                "<span style='font-weight:800;color:#4ade80'>"+moneyText(c.total)+"</span>" +
              "</div>";
    });
  }

  if(resets.length > 0){
    
