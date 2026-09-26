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

const TOPES_DEFAULT = {
  1: 25, 2: 25, 5: 25,       // 0,01 €, 0,02 €, 0,05 €
  10: 22, 20: 20, 50: 20,    // 0,10 €, 0,20 €, 0,50 €
  100: 20, 200: 20,          // 1 €, 2 €
  500: 8, 1000: 8,           // 5 €, 10 €
  2000: 5, 5000: 3, 10000: 2 // 20 €, 50 €, 100 €
};

let stock = loadStock();
let totalTips = loadTips();
let reservaMinima = loadReserva();
let topesRecibir = loadTopes();
let diaReset = loadDiaReset();
let ultimoResetPropinas = loadUltimoResetPropinas();
let statsOps = loadStats();
let received = [];
let pendingTransaction = null;
let stockInputs = [];
let reservaInputs = [];
let summaryTimer = null;
let precioInterval = null;
let precioActual = 0;
let cambioState = { aEntregar: {}, aRecibir: {}, modo: null, orden: [], ordenRecibir: [] };

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
function loadTopes(){
  const base = Object.assign({}, TOPES_DEFAULT);
  const s = safeStorage.get("uberCambioTopes");
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

function loadStats(){
  const s = safeStorage.get("uberCambioStats");
  if(s){ try{ const o = JSON.parse(s);
    if(o && typeof o === "object" && Array.isArray(o.received) && Array.isArray(o.spent)){
      return {
        operations: parseInt(o.operations)||0,
        received: o.received.map(x=>parseInt(x)||0),
        spent: o.spent.map(x=>parseInt(x)||0)
      };
    }
  }catch(e){} }
  return { operations: 0, received: new Array(denominations.length).fill(0), spent: new Array(denominations.length).fill(0) };
}
function saveStats(){ safeStorage.set("uberCambioStats", JSON.stringify(statsOps)); }
function resetStats(){
  statsOps = { operations: 0, received: new Array(denominations.length).fill(0), spent: new Array(denominations.length).fill(0) };
  saveStats();
}

function saveStock(){ safeStorage.set("uberCambioStock", JSON.stringify(stock)); scheduleCashSummary(); }
function saveTips(){ safeStorage.set("uberCambioTips", String(totalTips)); }
function saveReserva(){ safeStorage.set("uberCambioReserva", JSON.stringify(reservaMinima)); scheduleCashSummary(); if(received.length) calculate(); }
function saveTopes(){ safeStorage.set("uberCambioTopes", JSON.stringify(topesRecibir)); }

function moneyText(c){ return (c/100).toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2})+" €"; }

function scheduleCashSummary(){
  if(summaryTimer) clearTimeout(summaryTimer);
  summaryTimer = setTimeout(() => { summaryTimer = null; updateCashSummary(); }, 120);
}
function updateCashSummary(){
  let total = 0;
  denominations.forEach((d,i) => { total += d.c * stock[i]; });
  const el = document.getElementById("totalCashDisplay");
  if(el) el.textContent = moneyText(total);
  const checks = [["status20",2000],["status30",3000],["status50",5000],["status80",8000],["status100",10000]];
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
function stockDisponible(){ return stock.map((n,i) => Math.max(0, n - (reservaMinima[denominations[i].c]||0))); }
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
  else if(estado==="warn"){ el.textContent="MÍN"; el.className="status-badge warn"; el.style.background="#eab308"; el.style.color="#000"; }
  else { el.textContent="NO"; el.className="status-badge no"; }
}

function toggleMenu(){
  const d = document.getElementById("drawer"); const o = document.getElementById("overlay");
  if(!d||!o) return;
  d.classList.toggle("active"); o.classList.toggle("active");
}
function switchDrawerTab(tab){
  const panels = {
    inventario: document.getElementById("panelInventario"),
    reset:      document.getElementById("panelReset")
  };
  const tabs = {
    inventario: document.getElementById("tabInventario"),
    reset:      document.getElementById("tabReset")
  };
  const A = "flex:1;padding:8px;border-radius:10px;border:1px solid #475569;background:#334155;color:#fff;font-weight:700;cursor:pointer;font-size:12px";
  const I = "flex:1;padding:8px;border-radius:10px;border:1px solid #475569;background:#1e293b;color:#94a3b8;font-weight:700;cursor:pointer;font-size:12px";
  Object.keys(panels).forEach(k => {
    if(panels[k]) panels[k].style.display = (k===tab)?"block":"none";
    if(tabs[k])   tabs[k].style.cssText = (k===tab)?A:I;
  });
  if(tab==="inventario") renderStockList();
  if(tab==="reset")      renderResetPanel();
}

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

/* ---------- Precio gigante ---------- */
function mostrarPrecio(){
  const inp = document.getElementById("price"); if(!inp) return;
  const raw = parseFloat(inp.value.replace(',','.'))||0;
  if(raw<=0){ alert("Escribe primero el precio del viaje."); return; }
  precioActual = Math.round(raw*100);
  const el = document.getElementById("precioGrande");
  if(el) el.textContent = moneyText(precioActual);
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
function detenerAlternanciaPrecio(){ if(precioInterval){ clearInterval(precioInterval); precioInterval=null; } }
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

  statsOps.operations++;
  for(let i=0;i<denominations.length;i++){
    statsOps.received[i] += pendingTransaction.incoming[i] || 0;
    statsOps.spent[i]    += pendingTransaction.used[i] || 0;
  }
  saveStats();

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

function renderRecomendaciones(){
  const box = document.getElementById("recomendacionesBox");
  if(!box) return;
  if(statsOps.operations < 10){ box.innerHTML = ""; return; }

  const ops = statsOps.operations;
  const faltantes = [];
  const sobrantes = [];

  denominations.forEach((d,i)=>{
    const avgRecv  = statsOps.received[i] / ops;
    const avgSpent = statsOps.spent[i] / ops;

    if(avgSpent > 0 && statsOps.spent[i] > statsOps.received[i] + 2){
      const opsRestantes = stock[i] / avgSpent;
      if(opsRestantes < 30){
        faltantes.push({ d, falta: Math.max(1, Math.ceil(avgSpent * 30) - stock[i]) });
      }
    }

    if(avgRecv > avgSpent * 2 && statsOps.received[i] > 8 && stock[i] > 8){
      sobrantes.push({ d, exceso: statsOps.received[i] - statsOps.spent[i] });
    }
  });

  if(faltantes.length === 0 && sobrantes.length === 0){ box.innerHTML = ""; return; }

  let html = "<div style='background:#0f172a;border:1px solid #475569;border-radius:10px;padding:12px;margin-top:14px'>";
  html += "<div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:10px'>🤖 SUGERENCIAS · últimas " + ops + " operaciones</div>";

  if(faltantes.length > 0){
    html += "<div style='font-size:11px;color:#fbbf24;font-weight:700;margin-bottom:4px'>⚠️ SE TE AGOTAN</div>";
    faltantes.forEach(x=>{
      html += "<div style='display:flex;justify-content:space-between;padding:3px 0;font-size:13px;color:#fff'>" +
                "<span>" + x.d.n + "</span>" +
                "<span style='color:#fbbf24;font-weight:700'>pedir +" + x.falta + "</span></div>";
    });
  }

  if(sobrantes.length > 0){
    html += "<div style='font-size:11px;color:#4ade80;font-weight:700;margin:10px 0 4px'>💚 ACUMULAS DE MÁS</div>";
    sobrantes.forEach(x=>{
      html += "<div style='display:flex;justify-content:space-between;padding:3px 0;font-size:13px;color:#fff'>" +
                "<span>" + x.d.n + "</span>" +
                "<span style='color:#4ade80;font-weight:700'>+" + x.exceso + " de más</span></div>";
    });
  }

  html += "</div>";
  box.innerHTML = html;
}

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

  renderRecomendaciones();
}
function updateStockVal(index, val){
  stock[index] = Math.max(0, val);
  if(stockInputs[index]) stockInputs[index].value = stock[index];
  saveStock();
}

function renderReservaList(){
  let box = document.getElementById("reservaList");
  if(!box) return;
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

function renderTopesList(){
  let box = document.getElementById("topesList");
  if(!box) return;
  box.innerHTML = "";
  denominations.forEach((d)=>{
    const row = document.createElement("div"); row.className="stock-item";
    const t = document.createElement("span"); t.textContent=d.n; t.style.fontWeight="700";
    const ctrl = document.createElement("div"); ctrl.className="stock-ctrl";
    const bm = document.createElement("button"); bm.type="button"; bm.textContent="-";
    bm.onclick = ()=>updateTopeVal(d.c, (topesRecibir[d.c]||0)-1);
    const inp = document.createElement("input"); inp.type="number"; inp.min="0"; inp.value=topesRecibir[d.c]||0;
    inp.onchange = (e)=>updateTopeVal(d.c, parseInt(e.target.value)||0);
    const bp = document.createElement("button"); bp.type="button"; bp.textContent="+";
    bp.onclick = ()=>updateTopeVal(d.c, (topesRecibir[d.c]||0)+1);
    ctrl.appendChild(bm); ctrl.appendChild(inp); ctrl.appendChild(bp);
    row.appendChild(t); row.appendChild(ctrl);
    box.appendChild(row);
  });
}
function updateTopeVal(cents, val){
  topesRecibir[cents] = Math.max(0, val);
  saveTopes();
  renderTopesList();
}
function resetTopes(){
  if(!confirm("¿Restaurar los topes máximos a los valores por defecto?")) return;
  topesRecibir = Object.assign({}, TOPES_DEFAULT);
  saveTopes();
  renderTopesList();
}

function renderResetPanel(){
  const inp = document.getElementById("resetDia");
  if(inp) inp.value = diaReset;
  const el = document.getElementById("resetUltimaVez");
  if(el){
    if(ultimoResetPropinas){
      const d = new Date(ultimoResetPropinas);
      el.textContent = "Última vez: " + d.toLocaleDateString("es-ES") + " " + d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});
    } else {
      el.textContent = "Última vez: —";
    }
  }
  renderHistorialPanel();
}
function guardarDiaReset(){
  const el = document.getElementById("resetDia"); if(!el) return;
  const n = parseInt(el.value)||20;
  diaReset = Math.max(1, Math.min(31, n));
  saveDiaReset();
  el.value = diaReset;
}
function resetCuenta(){
  if(!confirm("¿Poner el INVENTARIO (caja) a CERO?\nLas propinas NO se tocan.")) return;
  stock = new Array(denominations.length).fill(0);
  saveStock(); renderStockList();
  if(received.length>0) calculate();
}
function resetPropinas(){
  if(!confirm("¿Poner las PROPINAS a CERO?\nEl inventario NO se toca.")) return;
  totalTips = 0; saveTips(); renderStockList(); renderResetPanel();
}
function resetHistorial(){
  if(!confirm("¿Borrar el HISTORIAL de depósitos, resets y cambios de billetes?")) return;
  safeStorage.remove("uberCambioCierres");
  safeStorage.remove("uberCambioHistoricoResets");
  safeStorage.remove("uberCambioCambios");
  renderHistorialPanel();
  renderCambioHistorial();
  const hc = document.getElementById("cierreHistorico");
  if(hc){ hc.innerHTML = ""; hc.style.display = "none"; }
}
function resetEstadisticas(){
  if(!confirm("¿Borrar las estadísticas de aprendizaje?\n\nLa app volverá a aprender tus hábitos desde cero.")) return;
  resetStats();
  renderStockList();
  alert("✅ Estadísticas reseteadas. La app aprenderá de nuevo.");
}
function resetTodo(){
  if(!confirm("⚠️ ¿RESETEAR TODO?\n\nSe borrará el inventario, las propinas, el historial y las estadísticas.")) return;
  stock = new Array(denominations.length).fill(0);
  totalTips = 0;
  safeStorage.remove("uberCambioCierres");
  safeStorage.remove("uberCambioHistoricoResets");
  safeStorage.remove("uberCambioCambios");
  resetStats();
  saveStock(); saveTips(); renderStockList(); renderResetPanel();
  if(received.length>0) calculate();
}

function loadHistoricoResets(){
  const s = safeStorage.get("uberCambioHistoricoResets");
  if(s){ try { return JSON.parse(s) || []; } catch(e){ return []; } }
  return [];
}
function saveHistoricoResets(h){ safeStorage.set("uberCambioHistoricoResets", JSON.stringify(h)); }

function loadCambios(){
  const s = safeStorage.get("uberCambioCambios");
  if(s){ try { return JSON.parse(s) || []; } catch(e){ return []; } }
  return [];
}
function saveCambios(c){ safeStorage.set("uberCambioCambios", JSON.stringify(c)); }

function checkAutoResetPropinas(){
  if(!ultimoResetPropinas){ ultimoResetPropinas = new Date().toISOString(); saveUltimoResetPropinas(); return; }
  const last = new Date(ultimoResetPropinas);
  const now  = new Date();
  const candidato = new Date(last.getFullYear(), last.getMonth(), diaReset, 0, 0, 0);
  if(candidato <= last) candidato.setMonth(candidato.getMonth()+1);
  if(now >= candidato){
    const h = loadHistoricoResets();
    h.push({ fecha: now.toISOString(), propinas: totalTips });
    saveHistoricoResets(h);
    totalTips = 0; saveTips();
    ultimoResetPropinas = now.toISOString(); saveUltimoResetPropinas();
    renderStockList(); renderResetPanel();
  }
}

function renderHistorialPanel(){
  const box = document.getElementById("historialPanel"); if(!box) return;
  const cierres = loadCierres();
  const resets  = loadHistoricoResets();
  let html = "";
  if(cierres.length > 0){
    html += "<div style='font-size:12px;font-weight:800;color:#94a3b8;letter-spacing:0.5px;margin-bottom:6px'>📜 ÚLTIMOS DEPÓSITOS</div>";
    cierres.slice(-10).reverse().forEach(c=>{
      const d = new Date(c.fecha);
      const fecha = d.toLocaleDateString("es-ES")+" "+d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});
      const icono = c.manual ? "📝 " : "";
      html += "<div style='display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #334155;font-size:13px'>" +
                "<span style='color:#94a3b8'>"+icono+fecha+"</span>" +
                "<span style='font-weight:800;color:#4ade80'>"+moneyText(c.total)+"</span></div>";
    });
  }
  if(resets.length > 0){
    html += "<div style='font-size:12px;font-weight:800;color:#94a3b8;letter-spacing:0.5px;margin:14px 0 6px'>🔄 ÚLTIMOS RESETS DE PROPINAS</div>";
    resets.slice(-10).reverse().forEach(r=>{
      const d = new Date(r.fecha);
      const fecha = d.toLocaleDateString("es-ES")+" "+d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});
      html += "<div style='display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #334155;font-size:13px'>" +
                "<span style='color:#94a3b8'>"+fecha+"</span>" +
                "<span style='font-weight:800;color:#fbbf24'>"+moneyText(r.propinas)+"</span></div>";
    });
  }
  box.innerHTML = html;
}

function loadCierres(){
  const s = safeStorage.get("uberCambioCierres");
  if(s){ try { return JSON.parse(s) || []; } catch(e){ return []; } }
  return [];
}
function saveCierres(c){ safeStorage.set("uberCambioCierres", JSON.stringify(c)); }

/* ---------- Depósito ---------- */
function abrirCierrePantalla(){
  const d = document.getElementById("drawer"); const o = document.getElementById("overlay");
  if(d) d.classList.remove("active");
  if(o) o.classList.remove("active");
  const p = document.getElementById("cierrePantalla");
  if(p) p.style.display = "block";
  const inp = document.getElementById("cierreInput"); if(inp) inp.value = "";
  const cont = document.getElementById("cierreResultado");
  if(cont){ cont.style.display = "none"; cont.innerHTML = ""; }
  const btn = document.getElementById("btnConfirmarCierre");
  if(btn) btn.style.display = "none";
  const manualBox = document.getElementById("depositoManualBox");
  if(manualBox) manualBox.style.display = "none";
  renderCierreHistorico();
}
function cerrarCierrePantalla(){
  const p = document.getElementById("cierrePantalla");
  if(p) p.style.display = "none";
}
function calcularCierre(){
  const cont = document.getElementById("cierreResultado");
  const btn  = document.getElementById("btnConfirmarCierre");
  const raw  = parseFloat(document.getElementById("cierreInput").value.replace(',','.'))||0;
  const target = Math.round(raw*100);
  if(!cont||!btn) return;
  if(target<=0){ cont.style.display="none"; cont.innerHTML=""; btn.style.display="none"; return; }
  const billetesStock = stock.slice(0,5);
  const res = findBilletes(target, billetesStock);
  if(!res || res.total===0){
    const maxB = stock.slice(0,5).reduce((s,n,i)=>s+n*denominations[i].c,0);
    let msg;
    if(maxB===0) msg = "⚠️ No tienes ningún billete en el inventario.<br>Añade billetes en Ajustes → Inventario.";
    else msg = "⚠️ No puedes formar "+moneyText(target)+".<br>En billetes tienes como máximo "+moneyText(maxB)+".";
    cont.innerHTML = "<div style='color:#ef4444;font-weight:700;font-size:14px;text-align:center;line-height:1.6'>"+msg+"</div>";
    cont.style.display="block"; btn.style.display="none"; return;
  }
  let html = "";
  html += "<div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;text-align:center'>💵 ENTREGAR EN BILLETES</div>";
  html += "<div style='font-size:32px;font-weight:900;color:#4ade80;margin:6px 0 14px;text-align:center'>"+moneyText(res.total)+"</div>";
  html += "<div class='change-grid'>";
  res.usados.forEach((n,i)=>{
    if(n>0){
      const d = denominations[i];
      html += "<div class='cash-item'><div class='badge'>x"+n+"</div><div class='bill-graphic "+d.class+"'>"+d.short+"</div></div>";
    }
  });
  html += "</div>";
  const sobrante = target - res.total;
  const totalEnCaja = stock.reduce((s,n,i)=>s+n*denominations[i].c,0);
  const quedaEnCaja = totalEnCaja - res.total;
  html += "<div style='margin-top:16px;padding-top:16px;border-top:1px solid #334155;text-align:center'>";
  if(sobrante>0){
    html += "<div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px'>SOBRANTE NO ENTREGABLE</div>" +
            "<div style='font-size:20px;font-weight:900;color:#eab308;margin-top:4px'>"+moneyText(sobrante)+"</div>" +
            "<div style='font-size:11px;color:#64748b;margin-top:2px'>No se puede dar en billetes</div>";
  }
  html += "<div style='margin-top:14px;padding:12px;background:#064e3b;border:1px solid #059669;border-radius:10px'>" +
            "<div style='font-size:12px;color:#4ade80;font-weight:800;letter-spacing:0.5px'>💼 TE QUEDA EN CAJA</div>" +
            "<div style='font-size:24px;font-weight:900;color:#4ade80;margin-top:4px'>"+moneyText(quedaEnCaja)+"</div>" +
            "<div style='font-size:11px;color:#94a3b8;margin-top:4px'>Después del depósito, en monedas y billetes restantes</div>" +
          "</div>";
  html += "</div>";
  cont.innerHTML = html;
  cont.style.display = "block"; btn.style.display = "block";
  btn.dataset.total  = String(res.total);
  btn.dataset.usados = JSON.stringify(res.usados);
}
function findBilletes(target, billetesStock){
  const denoms = [{c:10000,idx:0},{c:5000,idx:1},{c:2000,idx:2},{c:1000,idx:3},{c:500,idx:4}];
  const maxT = Math.floor(target/5)*5;
  for(let t=maxT;t>=0;t-=5){
    const r = buscarCombinacion(t, billetesStock, denoms);
    if(r) return { total: t, usados: r };
  }
  return { total: 0, usados: [0,0,0,0,0] };
}
function buscarCombinacion(target, stock, denoms){
  const u = [0,0,0,0,0];
  function bt(i, rest){
    if(rest===0) return true;
    if(i>=denoms.length) return false;
    const d = denoms[i];
    const max = Math.min(stock[d.idx], Math.floor(rest/d.c));
    for(let n=max;n>=0;n--){ u[i]=n; if(bt(i+1, rest-n*d.c)) return true; }
    u[i]=0; return false;
  }
  return bt(0,target) ? u : null;
}
function confirmarCierre(){
  const btn = document.getElementById("btnConfirmarCierre"); if(!btn) return;
  const total  = parseInt(btn.dataset.total)||0;
  const usados = JSON.parse(btn.dataset.usados||"[]");
  if(total<=0) return;
  if(!confirm("¿Confirmar depósito? Se entregarán "+moneyText(total)+" en billetes.\n\nLas propinas NO se tocan.")) return;
  for(let i=0;i<usados.length;i++) stock[i] = Math.max(0, stock[i] - usados[i]);
  saveStock(); renderStockList(); updateCashSummary();
  const cierres = loadCierres();
  cierres.push({ fecha: new Date().toISOString(), total: total });
  saveCierres(cierres); renderCierreHistorico();
  document.getElementById("cierreInput").value = "";
  const cont = document.getElementById("cierreResultado");
  if(cont){ cont.style.display = "none"; cont.innerHTML = ""; }
  btn.style.display = "none";
  alert("✅ Depósito realizado.\nEntregados: " + moneyText(total));
}
function renderCierreHistorico(){
  const box = document.getElementById("cierreHistorico"); if(!box) return;
  const cierres = loadCierres();
  if(cierres.length===0){ box.style.display="none"; box.innerHTML=""; return; }
  let html = "<div style='font-size:12px;font-weight:800;color:#94a3b8;letter-spacing:0.5px;margin-bottom:8px'>📜 ÚLTIMOS DEPÓSITOS</div>";
  cierres.slice(-10).reverse().forEach(c=>{
    const d = new Date(c.fecha);
    const fecha = d.toLocaleDateString("es-ES")+" · "+d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});
    const icono = c.manual ? "📝 " : "";
    html += "<div style='padding:8px 0;border-bottom:1px solid #334155;font-size:13px'>" +
              "<div style='display:flex;justify-content:space-between'>" +
                "<span style='color:#94a3b8'>"+icono+fecha+"</span>" +
                "<span style='font-weight:800;color:#4ade80'>"+moneyText(c.total)+"</span>" +
              "</div></div>";
  });
  box.innerHTML = html; box.style.display = "block";
}

/* ---------- Depósito manual ---------- */
function toggleDepositoManual(){
  const box = document.getElementById("depositoManualBox");
  if(!box) return;
  if(box.style.display === "none" || !box.style.display){
    box.style.display = "block";
    const hoy = new Date();
    const inpFecha = document.getElementById("depManualFecha");
    if(inpFecha && !inpFecha.value){
      const yyyy = hoy.getFullYear();
      const mm = String(hoy.getMonth()+1).padStart(2,'0');
      const dd = String(hoy.getDate()).padStart(2,'0');
      inpFecha.value = yyyy + "-" + mm + "-" + dd;
    }
    const inpHora = document.getElementById("depManualHora");
    if(inpHora && !inpHora.value){
      const hh = String(hoy.getHours()).padStart(2,'0');
      const mi = String(hoy.getMinutes()).padStart(2,'0');
      inpHora.value = hh + ":" + mi;
    }
  } else {
    box.style.display = "none";
  }
}
function añadirDepositoManual(){
  const fechaStr = document.getElementById("depManualFecha").value;
  const horaStr  = document.getElementById("depManualHora").value;
  const importeStr = document.getElementById("depManualImporte").value;
  const importe = Math.round((parseFloat(importeStr.replace(',','.'))||0) * 100);

  if(importe <= 0){ alert("Escribe un importe válido."); return; }
  if(!fechaStr){ alert("Elige una fecha."); return; }
  if(!horaStr){ alert("Elige una hora."); return; }

  const [y, m, d] = fechaStr.split("-").map(x => parseInt(x));
  const [hh, mi]  = horaStr.split(":").map(x => parseInt(x));
  const fechaCompleta = new Date(y, m-1, d, hh, mi, 0);

  const cierres = loadCierres();
  cierres.push({ fecha: fechaCompleta.toISOString(), total: importe, manual: true });
  saveCierres(cierres);
  renderCierreHistorico();

  document.getElementById("depManualImporte").value = "";
  const box = document.getElementById("depositoManualBox");
  if(box) box.style.display = "none";

  alert("✅ Depósito manual añadido al historial:\n" + moneyText(importe));
}

/* ---------- Diagnóstico ---------- */
function abrirDiagnostico(){
  const d = document.getElementById("drawer");
  const o = document.getElementById("overlay");
  if(d) d.classList.remove("active");
  if(o) o.classList.remove("active");
  const p = document.getElementById("diagnosticoPantalla");
  if(p) p.style.display = "block";
  renderDiagnostico();
}
function cerrarDiagnostico(){
  const p = document.getElementById("diagnosticoPantalla");
  if(p) p.style.display = "none";
}
function renderDiagnostico(){
  const cont = document.getElementById("diagnosticoContenido");
  if(!cont) return;
  const ops = statsOps.operations;
  let html = "";
  html += "<div class='card' style='margin:0 0 12px 0'>";
  html += "<div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:8px'>ESTADO DEL APRENDIZAJE</div>";
  if(ops < 10){
    const faltan = 10 - ops;
    html += "<div style='background:#1e3a8a;border:1px solid #3b82f6;border-radius:10px;padding:14px;text-align:center'>";
    html += "<div style='font-size:14px;color:#93c5fd;font-weight:700;line-height:1.5'>";
    html += "🧠 Aún aprendiendo<br><br>";
    html += "<span style='font-size:13px;color:#bfdbfe'>Llevo registradas <b>" + ops + "</b> operaciones.<br>Necesito al menos 10 para empezar a darte sugerencias fiables.";
    html += "<br><br>Faltan <b>" + faltan + "</b> operaciones más.</span>";
    html += "</div></div>";
  } else {
    html += "<div style='background:#064e3b;border:1px solid #059669;border-radius:10px;padding:12px;text-align:center'>";
    html += "<div style='font-size:13px;color:#4ade80;font-weight:700;line-height:1.5'>";
    html += "✅ Aprendizaje activo<br>";
    html += "<span style='font-size:12px;color:#a7f3d0'>Basado en <b>" + ops + "</b> operaciones registradas</span>";
    html += "</div></div>";
  }
  html += "</div>";

  if(ops > 0){
    html += "<div class='card' style='margin:0 0 12px 0'>";
    html += "<div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:10px'>📊 DATOS POR DENOMINACIÓN</div>";
    html += "<div style='display:grid;grid-template-columns:1.4fr 0.7fr 0.7fr 0.7fr 1fr;gap:6px;font-size:10px;color:#64748b;font-weight:700;padding-bottom:6px;border-bottom:1px solid #334155;text-align:right'>";
    html += "<span style='text-align:left'>DENOM.</span><span>STOCK</span><span>RECV</span><span>GAST</span><span>ESTIM.</span>";
    html += "</div>";
    denominations.forEach((d,i)=>{
      const stockN = stock[i];
      const recvN  = statsOps.received[i];
      const gastN  = statsOps.spent[i];
      const ritmo  = gastN / ops;
      let estim = "—";
      let color = "#64748b";
      if(ritmo > 0){
        const opsRestantes = Math.floor(stockN / ritmo);
        estim = "~" + opsRestantes + " ops";
        if(opsRestantes < 5)       color = "#ef4444";
        else if(opsRestantes < 15) color = "#fbbf24";
        else                       color = "#4ade80";
      }
      html += "<div style='display:grid;grid-template-columns:1.4fr 0.7fr 0.7fr 0.7fr 1fr;gap:6px;font-size:13px;color:#fff;padding:6px 0;border-bottom:1px solid #1e293b;text-align:right'>";
      html += "<span style='text-align:left;font-weight:700'>" + d.n + "</span>";
      html += "<span>" + stockN + "</span>";
      html += "<span style='color:#4ade80'>" + recvN + "</span>";
      html += "<span style='color:#fbbf24'>" + gastN + "</span>";
      html += "<span style='color:" + color + ";font-weight:800'>" + estim + "</span>";
      html += "</div>";
    });
    html += "</div>";
  }

  html += "<div class='card' style='margin:0 0 12px 0'>";
  html += "<div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:8px'>💡 CÓMO LEO ESTOS DATOS</div>";
  html += "<div style='font-size:12px;color:#94a3b8;line-height:1.7'>";
  html += "<b style='color:#4ade80'>RECV</b> → cuántas piezas has <b>recibido</b> de clientes en total.<br>";
  html += "<b style='color:#fbbf24'>GAST</b> → cuántas piezas has <b>devuelto</b> como cambio.<br>";
  html += "<b style='color:#38bdf8'>ESTIM.</b> → estimación de cuántas operaciones más podrás hacer con el stock actual.<br><br>";
  html += "<span style='color:#64748b'>Las sugerencias de compra se calculan a partir de estos datos.</span>";
  html += "</div></div>";

  cont.innerHTML = html;
}

/* ---------- Pantalla Límite y Máximos ---------- */
function abrirLimitePantalla(){
  const d = document.getElementById("drawer");
  const o = document.getElementById("overlay");
  if(d) d.classList.remove("active");
  if(o) o.classList.remove("active");
  const p = document.getElementById("limitePantalla");
  if(p) p.style.display = "block";
  renderReservaList();
  renderTopesList();
}
function cerrarLimitePantalla(){
  const p = document.getElementById("limitePantalla");
  if(p) p.style.display = "none";
}

/* ---------- Cambiar billete ---------- */
function abrirCambioPantalla(){
  const d = document.getElementById("drawer");
  const o = document.getElementById("overlay");
  if(d) d.classList.remove("active");
  if(o) o.classList.remove("active");
  const p = document.getElementById("cambioPantalla");
  if(p) p.style.display = "block";
  cambioState = { aEntregar: {}, aRecibir: {}, modo: null, orden: [], ordenRecibir: [] };
  renderCambioInicio();
}
function cerrarCambioPantalla(){
  const p = document.getElementById("cambioPantalla");
  if(p) p.style.display = "none";
}

function renderCambioInicio(){
  const cont = document.getElementById("cambioContenido");
  if(!cont) return;

  let html = "";
  html += "<div class='card' style='margin:0 0 12px 0'>";
  html += "<div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:8px'>¿QUÉ VAS A CAMBIAR?</div>";
  html += "<div style='font-size:12px;color:#64748b;margin-bottom:10px'>Pulsa los billetes que entregarás al banco. Puedes pulsar varias veces para sumar varios.</div>";
  html += "<div id='cambioBotones' style='display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:12px'></div>";
  html += "<div style='display:flex;justify-content:space-between;align-items:center;padding:10px;background:#1e293b;border-radius:8px;margin-bottom:12px'>";
  html += "<span style='font-size:13px;color:#94a3b8;font-weight:700'>Total a cambiar:</span>";
  html += "<span id='cambioTotal' style='font-size:18px;font-weight:900;color:#38bdf8'>0,00 €</span>";
  html += "</div>";
  html += "<button type='button' onclick='calcularCambio()' style='width:100%;background:#1e40af;color:#fff;border:1px solid #3b82f6;border-radius:10px;padding:12px;font-weight:700;font-size:14px;cursor:pointer;margin-bottom:8px'>🔀 Continuar</button>";
  html += "<div style='display:flex;gap:8px;margin-bottom:8px'>";
  html += "<button type='button' onclick='deshacerCambioEntregar()' style='flex:1;background:#78350f;color:#fbbf24;border:1px solid #b45309;border-radius:10px;padding:10px;font-weight:700;font-size:13px;cursor:pointer'>↩ Deshacer</button>";
  html += "<button type='button' onclick='resetCambioEntregar()' style='flex:1;background:#7f1d1d;color:#fff;border:1px solid #b91c1c;border-radius:10px;padding:10px;font-weight:700;font-size:13px;cursor:pointer'>🗑️ Limpiar todo</button>";
  html += "</div>";
  html += "<button type='button' onclick='cerrarCambioPantalla()' style='width:100%;background:#334155;color:#fff;border:none;border-radius:10px;padding:10px;font-weight:700;font-size:13px;cursor:pointer'>✖ Cancelar</button>";
  html += "</div>";

  html += "<div id='cambioHistorial'></div>";

  cont.innerHTML = html;

  const botones = document.getElementById("cambioBotones");
  [10000, 5000, 2000, 1000, 500].forEach(c=>{
    const wrap = document.createElement("div");
    wrap.style.cssText = "position:relative";
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = (c/100) + " €";
    b.style.cssText = "width:100%;background:#283548;border:1px solid #475569;color:#fff;font-weight:800;padding:12px 4px;font-size:14px;border-radius:10px;cursor:pointer";
    b.onclick = ()=>{
      cambioState.aEntregar[c] = (cambioState.aEntregar[c] || 0) + 1;
      cambioState.orden.push(c);
      actualizarCambioInicio();
    };
    const badge = document.createElement("div");
    badge.id = "cambioBadge" + c;
    badge.style.cssText = "position:absolute;top:-6px;right:-6px;background:#38bdf8;color:#0f172a;font-size:11px;font-weight:900;padding:2px 6px;border-radius:10px;display:none";
    wrap.appendChild(b); wrap.appendChild(badge);
    botones.appendChild(wrap);
  });

  actualizarCambioInicio();
  renderCambioHistorial();
}

function actualizarCambioInicio(){
  let total = 0;
  [10000, 5000, 2000, 1000, 500].forEach(c=>{
    const n = cambioState.aEntregar[c] || 0;
    total += c * n;
    const badge = document.getElementById("cambioBadge" + c);
    if(badge){
      if(n > 0){ badge.textContent = "x" + n; badge.style.display = "block"; }
      else { badge.style.display = "none"; }
    }
  });
  const el = document.getElementById("cambioTotal");
  if(el) el.textContent = moneyText(total);
}

function deshacerCambioEntregar(){
  if(!cambioState.orden) cambioState.orden = [];
  const last = cambioState.orden.pop();
  if(last == null) return;
  if(cambioState.aEntregar[last] > 0){
    cambioState.aEntregar[last]--;
    if(cambioState.aEntregar[last] <= 0) delete cambioState.aEntregar[last];
  }
  actualizarCambioInicio();
}

function resetCambioEntregar(){
  cambioState.aEntregar = {};
  cambioState.orden = [];
  actualizarCambioInicio();
}

function calcularCambio(){
  let total = 0;
  Object.keys(cambioState.aEntregar).forEach(c=>{ total += parseInt(c) * cambioState.aEntregar[c]; });
  if(total <= 0){ alert("Selecciona algún billete para cambiar."); return; }

  let errorStock = false;
  Object.keys(cambioState.aEntregar).forEach(k=>{
    const c = parseInt(k);
    const idx = denominations.findIndex(d=>d.c===c);
    if(idx >= 0 && stock[idx] < cambioState.aEntregar[c]) errorStock = true;
  });
  if(errorStock){ alert("No tienes tantos billetes de ese tipo en el inventario."); return; }

  if(statsOps.operations < 10){
    cambioState.modo = "pregunta";
    renderCambioSinDatos(total);
    return;
  }

  cambioState.modo = "auto";
  const minEntregado = Math.min(...Object.keys(cambioState.aEntregar).map(x=>parseInt(x)));
  cambioState.aRecibir = calcularCambioAutomatico(total, minEntregado);
  renderCambioResultado(total);
}

function renderCambioSinDatos(total){
  const cont = document.getElementById("cambioContenido");
  if(!cont) return;
  let html = "";
  html += "<div class='card' style='margin:0 0 12px 0;text-align:center'>";
  html += "<div style='font-size:14px;color:#fbbf24;font-weight:800;margin-bottom:10px'>🧠 Aún no tengo datos suficientes</div>";
  html += "<div style='font-size:13px;color:#94a3b8;line-height:1.6;margin-bottom:16px'>";
  html += "Para darte una sugerencia basada en tus hábitos necesito al menos 10 operaciones registradas.<br><br>";
  html += "Puedes elegir manualmente las piezas que quieres recibir a cambio.";
  html += "</div>";
  html += "<button type='button' onclick='pasarAModoManual(" + total + ")' style='width:100%;background:#1e40af;color:#fff;border:1px solid #3b82f6;border-radius:10px;padding:12px;font-weight:700;font-size:14px;cursor:pointer;margin-bottom:8px'>✍️ Elegir a mano</button>";
  html += "<button type='button' onclick='cerrarCambioPantalla()' style='width:100%;background:#334155;color:#fff;border:none;border-radius:10px;padding:10px;font-weight:700;font-size:13px;cursor:pointer'>✖ Cancelar</button>";
  html += "</div>";
  cont.innerHTML = html;
}

function pasarAModoManual(total){
  cambioState.modo = "manual";
  cambioState.aRecibir = {};
  cambioState.ordenRecibir = [];
  renderCambioManual(total);
}

function renderCambioManual(total){
  const cont = document.getElementById("cambioContenido");
  if(!cont) return;

  const minEntregado = Math.min(...Object.keys(cambioState.aEntregar).map(x=>parseInt(x)));
  const opciones = denominations.filter(d => d.c < minEntregado);

  let html = "";
  html += "<div class='card' style='margin:0 0 12px 0'>";
  html += "<div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:8px'>✍️ ELIGE A MANO</div>";
  html += "<div style='font-size:12px;color:#64748b;margin-bottom:10px'>Marca las piezas que quieres recibir. La suma debe coincidir con " + moneyText(total) + ".</div>";
  html += "<div id='cambioManBotones' style='display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px'></div>";
  html += "</div>";

  html += "<div class='card' style='margin:0 0 12px 0'>";
  html += "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:6px'>";
  html += "<span style='font-size:13px;color:#94a3b8'>Suma actual:</span>";
  html += "<span id='cambioManSuma' style='font-size:18px;font-weight:900;color:#38bdf8'>0,00 €</span>";
  html += "</div>";
  html += "<div style='display:flex;justify-content:space-between;align-items:center'>";
  html += "<span style='font-size:13px;color:#94a3b8'>Objetivo:</span>";
  html += "<span style='font-size:18px;font-weight:900;color:#4ade80'>" + moneyText(total) + "</span>";
  html += "</div>";
  html += "<div id='cambioManEstado' style='text-align:center;font-size:13px;font-weight:700;margin-top:10px'></div>";
  html += "</div>";

  html += "<button type='button' onclick='confirmarCambio(" + total + ")' id='cambioManBtn' style='width:100%;background:#059669;color:#fff;border:none;border-radius:10px;padding:12px;font-weight:700;font-size:14px;cursor:pointer;margin-bottom:8px'>✅ Confirmar cambio</button>";
  html += "<div style='display:flex;gap:8px;margin-bottom:8px'>";
  html += "<button type='button' onclick='deshacerCambioRecibir(" + total + ")' style='flex:1;background:#78350f;color:#fbbf24;border:1px solid #b45309;border-radius:10px;padding:10px;font-weight:700;font-size:13px;cursor:pointer'>↩ Deshacer</button>";
  html += "<button type='button' onclick='resetCambioManual(" + total + ")' style='flex:1;background:#7f1d1d;color:#fff;border:1px solid #b91c1c;border-radius:10px;padding:10px;font-weight:700;font-size:13px;cursor:pointer'>🗑️ Limpiar todo</button>";
  html += "</div>";
  html += "<button type='button' onclick='cerrarCambioPantalla()' style='width:100%;background:#334155;color:#fff;border:none;border-radius:10px;padding:10px;font-weight:700;font-size:13px;cursor:pointer'>✖ Cancelar</button>";

  cont.innerHTML = html;

  const botones = document.getElementById("cambioManBotones");
  opciones.forEach(d=>{
    const wrap = document.createElement("div");
    wrap.style.cssText = "position:relative";
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = d.n;
    b.style.cssText = "width:100%;background:#283548;border:1px solid #475569;color:#fff;font-weight:800;padding:10px 4px;font-size:13px;border-radius:10px;cursor:pointer";
    b.onclick = ()=>{
      cambioState.aRecibir[d.c] = (cambioState.aRecibir[d.c] || 0) + 1;
      if(!cambioState.ordenRecibir) cambioState.ordenRecibir = [];
      cambioState.ordenRecibir.push(d.c);
      actualizarCambioManual(total);
    };
    const badge = document.createElement("div");
    badge.id = "cambioManBadge" + d.c;
    badge.style.cssText = "position:absolute;top:-6px;right:-6px;background:#38bdf8;color:#0f172a;font-size:11px;font-weight:900;padding:2px 6px;border-radius:10px;display:none";
    wrap.appendChild(b); wrap.appendChild(badge);
    botones.appendChild(wrap);
  });

  actualizarCambioManual(total);
}

function resetCambioManual(total){
  cambioState.aRecibir = {};
  cambioState.ordenRecibir = [];
  renderCambioManual(total);
}

function deshacerCambioRecibir(total){
  if(!cambioState.ordenRecibir) cambioState.ordenRecibir = [];
  const last = cambioState.ordenRecibir.pop();
  if(last == null) return;
  if(cambioState.aRecibir[last] > 0){
    cambioState.aRecibir[last]--;
    if(cambioState.aRecibir[last] <= 0) delete cambioState.aRecibir[last];
  }
  actualizarCambioManual(total);
}

function actualizarCambioManual(total){
  let suma = 0;
  denominations.forEach(d=>{
    const n = cambioState.aRecibir[d.c] || 0;
    suma += d.c * n;
    const badge = document.getElementById("cambioManBadge" + d.c);
    if(badge){
      if(n > 0){ badge.textContent = "x" + n; badge.style.display = "block"; }
      else { badge.style.display = "none"; }
    }
  });

  const elSuma = document.getElementById("cambioManSuma");
  if(elSuma) elSuma.textContent = moneyText(suma);

  const estado = document.getElementById("cambioManEstado");
  const btn = document.getElementById("cambioManBtn");
  if(estado && btn){
    if(suma === total){
      estado.innerHTML = "<span style='color:#4ade80'>✅ Cuadra perfectamente</span>";
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
    } else if(suma < total){
      estado.innerHTML = "<span style='color:#fbbf24'>⚠️ Te faltan " + moneyText(total - suma) + "</span>";
      btn.style.opacity = "0.5";
      btn.style.pointerEvents = "none";
    } else {
      estado.innerHTML = "<span style='color:#ef4444'>⚠️ Te pasas por " + moneyText(suma - total) + "</span>";
      btn.style.opacity = "0.5";
      btn.style.pointerEvents = "none";
    }
  }
}

function confirmarCambio(total){
  let suma = 0;
  denominations.forEach(d=>{ suma += d.c * (cambioState.aRecibir[d.c] || 0); });
  if(suma !== total){ alert("La suma no cuadra con el importe."); return; }

  if(!confirm("¿Confirmar el cambio?\n\nEntregas lo seleccionado al banco y tu inventario se actualizará con las piezas marcadas.")) return;

  Object.keys(cambioState.aEntregar).forEach(k=>{
    const c = parseInt(k);
    const n = cambioState.aEntregar[c];
    const idx = denominations.findIndex(d=>d.c===c);
    if(idx >= 0 && n > 0) stock[idx] = Math.max(0, stock[idx] - n);
  });

  denominations.forEach(d=>{
    const n = cambioState.aRecibir[d.c] || 0;
    if(n > 0){
      const idx = denominations.findIndex(x=>x.c===d.c);
      if(idx >= 0) stock[idx] = Math.max(0, stock[idx] + n);
    }
  });

  const cambios = loadCambios();
  cambios.push({
    fecha: new Date().toISOString(),
    aEntregar: Object.assign({}, cambioState.aEntregar),
    aRecibir: Object.assign({}, cambioState.aRecibir),
    total: total
  });
  saveCambios(cambios);

  saveStock();
  renderStockList();
  updateCashSummary();
  alert("✅ Cambio confirmado. Inventario actualizado.");
  cerrarCambioPantalla();
}

/* ---------- Cálculo automático del cambio (repartido + stock) ---------- */
function calcularCambioAutomatico(total, billeteMasPequeno){
  const candidatas = denominations.filter(d => d.c < billeteMasPequeno);

  const topeEfectivo = {};
  denominations.forEach((d, i) => {
    const stockActual = stock[i] || 0;
    let tope = topesRecibir[d.c] != null ? topesRecibir[d.c] : 5;

    if (stockActual >= 30)       tope = 0;
    else if (stockActual >= 20)  tope = Math.min(tope, 1);
    else if (stockActual >= 10)  tope = Math.min(tope, 2);
    else if (stockActual <= 3)   tope = Math.min(tope + 3, 12);
    else if (stockActual <= 6)   tope = Math.min(tope + 1, 10);

    topeEfectivo[d.c] = tope;
  });

  let restante = total;
  const propuesta = {};

  const grupos = [
    candidatas.filter(d => d.c >= 1000).sort((a,b) => b.c - a.c),
    candidatas.filter(d => d.c >= 100 && d.c < 1000).sort((a,b) => b.c - a.c),
    candidatas.filter(d => d.c >= 10 && d.c < 100).sort((a,b) => b.c - a.c),
    candidatas.filter(d => d.c < 10).sort((a,b) => b.c - a.c)
  ];

  grupos.forEach(grupo => {
    grupo.forEach(d => {
      if(restante <= 0) return;
      const tope = topeEfectivo[d.c] || 0;
      if(tope <= 0) return;
      const cuantas = Math.min(Math.floor(restante / d.c), tope);
      if(cuantas > 0){
        propuesta[d.c] = (propuesta[d.c] || 0) + cuantas;
        restante -= cuantas * d.c;
      }
    });
  });

  if(restante > 0){
    const desc = candidatas.slice().sort((a,b) => b.c - a.c);
    for(const d of desc){
      if(restante <= 0) break;
      const idx = denominations.findIndex(x => x.c === d.c);
      if(stock[idx] > 40) continue;
      const cuantas = Math.floor(restante / d.c);
      if(cuantas > 0){
        propuesta[d.c] = (propuesta[d.c] || 0) + cuantas;
        restante -= cuantas * d.c;
      }
    }
  }

  return propuesta;
}

function renderCambioResultado(total){
  const cont = document.getElementById("cambioContenido");
  if(!cont) return;

  let html = "";
  html += "<div class='card' style='margin:0 0 12px 0'>";
  html += "<div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:12px'>🤖 PROPUESTA BASADA EN TUS HÁBITOS</div>";

  html += "<div style='font-size:12px;color:#4ade80;font-weight:800;letter-spacing:0.5px;margin-bottom:8px'>ENTREGAS AL BANCO</div>";
  html += "<div class='change-grid'>";
  Object.keys(cambioState.aEntregar).forEach(k=>{
    const c = parseInt(k);
    const n = cambioState.aEntregar[c];
    if(n > 0){
      const d = denominations.find(x=>x.c===c);
      if(d){
        html += "<div class='cash-item'>" +
                  "<div class='badge'>x" + n + "</div>" +
                  "<div class='bill-graphic " + d.class + "'>" + d.short + "</div>" +
                "</div>";
      }
    }
  });
  html += "</div>";

  html += "<div style='font-size:12px;color:#38bdf8;font-weight:800;letter-spacing:0.5px;margin:16px 0 8px;padding-top:14px;border-top:1px solid #334155'>PIDE QUE TE DEVUELVAN</div>";
  html += "<div class='change-grid'>";
  const orden = Object.keys(cambioState.aRecibir)
    .map(k => parseInt(k))
    .filter(c => cambioState.aRecibir[c] > 0)
    .sort((a,b) => b - a);
  orden.forEach(c=>{
    const n = cambioState.aRecibir[c];
    const d = denominations.find(x=>x.c===c);
    if(d){
      const clase = d.type === "bill" ? "bill-graphic " : "coin-graphic ";
      html += "<div class='cash-item'>" +
                "<div class='badge'>x" + n + "</div>" +
                "<div class='" + clase + d.class + "'>" + d.short + "</div>" +
              "</div>";
    }
  });
  html += "</div>";

  html += "<div style='display:flex;justify-content:space-between;padding:14px 0 0;margin-top:14px;border-top:1px solid #334155;font-size:16px;color:#fff'>" +
            "<span style='font-weight:800'>Total:</span>" +
            "<span style='font-weight:900;color:#4ade80'>" + moneyText(total) + "</span></div>";
  html += "</div>";

  html += "<button type='button' onclick='confirmarCambio(" + total + ")' style='width:100%;background:#059669;color:#fff;border:none;border-radius:10px;padding:12px;font-weight:700;font-size:14px;cursor:pointer;margin-bottom:8px'>✅ Confirmar cambio</button>";
  html += "<button type='button' onclick='pasarAModoManual(" + total + ")' style='width:100%;background:#334155;color:#fff;border:none;border-radius:10px;padding:12px;font-weight:700;font-size:14px;cursor:pointer;margin-bottom:8px'>✍️ Ajustar a mano</button>";
  html += "<button type='button' onclick='cerrarCambioPantalla()' style='width:100%;background:#1e293b;color:#94a3b8;border:1px solid #475569;border-radius:10px;padding:10px;font-weight:700;font-size:13px;cursor:pointer'>✖ Cancelar</button>";

  cont.innerHTML = html;
}

function renderCambioHistorial(){
  const box = document.getElementById("cambioHistorial");
  if(!box) return;
  const cambios = loadCambios();
  if(cambios.length === 0){ box.innerHTML = ""; return; }

  let html = "<div class='card' style='margin:0'>";
  html += "<div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;margin-bottom:8px'>📜 HISTORIAL DE CAMBIOS</div>";

  cambios.slice(-15).reverse().forEach(c=>{
    const d = new Date(c.fecha);
    const fecha = d.toLocaleDateString("es-ES") + " · " +
                  d.toLocaleTimeString("es-ES", {hour:"2-digit", minute:"2-digit"});

    const entregas = Object.keys(c.aEntregar).map(k=>{
      const cents = parseInt(k);
      const n = c.aEntregar[k];
      const pieza = denominations.find(x=>x.c===cents);
      const nom = pieza ? pieza.short : (cents/100)+"€";
      return n + "×" + nom;
    }).join(" + ");

    const recibidas = Object.keys(c.aRecibir).map(k=>{
      const cents = parseInt(k);
      const n = c.aRecibir[k];
      const pieza = denominations.find(x=>x.c===cents);
      const nom = pieza ? pieza.short : (cents/100)+"€";
      return n + "×" + nom;
    }).join(" + ");

    html += "<div style='padding:10px 0;border-bottom:1px solid #334155'>";
    html += "<div style='font-size:12px;color:#94a3b8;margin-bottom:4px'>📝 " + fecha + "</div>";
    html += "<div style='font-size:13px;color:#fff'><b>Cambio de " + moneyText(c.total) + "</b></div>";
    html += "<div style='font-size:12px;color:#4ade80;margin-top:2px'>→ " + entregas + "</div>";
    html += "<div style='font-size:12px;color:#38bdf8;margin-top:2px'>← " + recibidas + "</div>";
    html += "</div>";
  });

  html += "</div>";
  box.innerHTML = html;
}

/* ---------- Copia de seguridad ---------- */
function setupBackupUI(){
  let panelInv = document.getElementById("panelInventario");
  if(!panelInv) panelInv = document.getElementById("drawer");
  if(!panelInv) return;
  if(document.getElementById("backupBox")) return;
  const box = document.createElement("div");
  box.id = "backupBox";
  box.style.cssText = "margin-top:16px;border-top:1px solid #334155;padding-top:14px";
  const title = document.createElement("div");
  title.textContent = "COPIA DE SEGURIDAD";
  title.style.cssText = "font-size:12px;font-weight:800;color:#94a3b8;letter-spacing:0.5px;margin-bottom:8px";
  const btnExport = document.createElement("button");
  btnExport.type = "button"; btnExport.textContent = "💾 Guardar copia";
  btnExport.style.cssText = "width:100%;background:#334155;color:#fff;padding:12px;border-radius:10px;margin-bottom:8px;font-weight:700;font-size:15px;border:none;cursor:pointer";
  btnExport.onclick = exportInventory;
  const btnImport = document.createElement("button");
  btnImport.type = "button"; btnImport.textContent = "📂 Cargar copia";
  btnImport.style.cssText = btnExport.style.cssText;
  btnImport.onclick = () => fileInput.click();
  const fileInput = document.createElement("input");
  fileInput.type = "file"; fileInput.accept = "application/json,.json";
  fileInput.style.display = "none";
  fileInput.onchange = (e) => {
    const f = e.target.files[0];
    if(f) importInventory(f);
    fileInput.value = "";
  };
  box.appendChild(title); box.appendChild(btnExport); box.appendChild(btnImport); box.appendChild(fileInput);
  panelInv.appendChild(box);
}
async function exportInventory(){
  const data = {
    app:"uberCambioVTC", version:7,
    exportedAt:new Date().toISOString(),
    stock:stock, totalTips:totalTips, reservaMinima:reservaMinima,
    topesRecibir: topesRecibir,
    diaReset:diaReset, ultimoResetPropinas:ultimoResetPropinas,
    stats: statsOps,
    cierres: loadCierres(),
    historicoResets: loadHistoricoResets(),
    cambios: loadCambios()
  };
  const jsonStr = JSON.stringify(data, null, 2);
  const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g, "-");
  const filename = `cambio-vtc-${stamp}.json`;
  try {
    if (typeof navigator.canShare === "function" && typeof File !== "undefined") {
      const file = new File([jsonStr], filename, { type: "application/json" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Copia de seguridad VTC" });
        return;
      }
    }
  } catch (err) { if (err && err.name === "AbortError") return; }
  let downloadAttempted = false;
  try {
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.rel = "noopener";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    downloadAttempted = true;
  } catch (e) {}
  setTimeout(() => showCopyFallback(jsonStr, downloadAttempted), downloadAttempted ? 400 : 0);
}
function showCopyFallback(jsonStr, afterDownloadAttempt){
  const prev = document.getElementById("copyBackupModal");
  if(prev) prev.remove();
  const modal = document.createElement("div");
  modal.id = "copyBackupModal";
  modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px";
  const box = document.createElement("div");
  box.style.cssText = "background:#1e293b;color:#f8fafc;border-radius:14px;padding:16px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto";
  const title = document.createElement("h3");
  title.textContent = "Copia de seguridad";
  title.style.cssText = "margin:0 0 8px;font-size:16px";
  const info = document.createElement("p");
  info.textContent = afterDownloadAttempt
    ? "Si no se ha descargado, copia este texto y guárdalo como .json."
    : "Copia este texto y guárdalo como .json.";
  info.style.cssText = "font-size:13px;color:#94a3b8;margin:0 0 10px";
  const ta = document.createElement("textarea");
  ta.value = jsonStr; ta.readOnly = true;
  ta.style.cssText = "width:100%;height:180px;background:#0f172a;color:#f8fafc;border:1px solid #475569;border-radius:10px;padding:10px;font-family:monospace;font-size:12px";
  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:8px;margin-top:12px";
  const btnCopy = document.createElement("button");
  btnCopy.type = "button"; btnCopy.textContent = "📋 Copiar";
  btnCopy.style.cssText = "flex:1;background:#334155;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:700;cursor:pointer";
  btnCopy.onclick = async () => {
    ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length);
    try {
      if(navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(jsonStr);
      else document.execCommand("copy");
      btnCopy.textContent = "✅ Copiado";
      setTimeout(() => { btnCopy.textContent = "📋 Copiar"; }, 1500);
    } catch(e){
      try { document.execCommand("copy"); btnCopy.textContent = "✅ Copiado"; }
      catch(_) { btnCopy.textContent = "Selecciona y copia"; }
      setTimeout(() => { btnCopy.textContent = "📋 Copiar"; }, 1500);
    }
  };
  const btnClose = document.createElement("button");
  btnClose.type = "button"; btnClose.textContent = "Cerrar";
  btnClose.style.cssText = "flex:1;background:#0f172a;color:#f8fafc;border:1px solid #475569;padding:12px;border-radius:10px;font-weight:700;cursor:pointer";
  btnClose.onclick = () => modal.remove();
  modal.addEventListener("click", (e) => { if(e.target === modal) modal.remove(); });
  row.appendChild(btnCopy); row.appendChild(btnClose);
  box.appendChild(title); box.appendChild(info); box.appendChild(ta); box.appendChild(row);
  modal.appendChild(box); document.body.appendChild(modal);
  setTimeout(() => { ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length); }, 50);
}
function importInventory(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const data = JSON.parse(reader.result);
      if(!data || !Array.isArray(data.stock) || data.stock.length !== denominations.length){
        alert("El archivo no es una copia válida."); return;
      }
      if(!confirm("¿Reemplazar el inventario, propinas, reserva, topes, estadísticas e historial actuales?")) return;
      stock = data.stock.map(x => Math.max(0, parseInt(x) || 0));
      if(typeof data.totalTips === "number") totalTips = Math.max(0, data.totalTips);
      if(data.reservaMinima && typeof data.reservaMinima === "object"){
        reservaMinima = Object.assign({}, RESERVA_MINIMA_DEFAULT);
        denominations.forEach(d => {
          if(typeof data.reservaMinima[d.c] === "number")
            reservaMinima[d.c] = Math.max(0, parseInt(data.reservaMinima[d.c]) || 0);
        });
        safeStorage.set("uberCambioReserva", JSON.stringify(reservaMinima));
      }
      if(data.topesRecibir && typeof data.topesRecibir === "object"){
        topesRecibir = Object.assign({}, TOPES_DEFAULT);
        denominations.forEach(d => {
          if(typeof data.topesRecibir[d.c] === "number")
            topesRecibir[d.c] = Math.max(0, parseInt(data.topesRecibir[d.c]) || 0);
        });
        saveTopes();
      }
      if(typeof data.diaReset === "number"){
        diaReset = Math.max(1, Math.min(31, parseInt(data.diaReset)||20));
        saveDiaReset();
      }
      if(typeof data.ultimoResetPropinas === "string"){
        ultimoResetPropinas = data.ultimoResetPropinas;
        saveUltimoResetPropinas();
      }
      if(data.stats && typeof data.stats === "object"){
        statsOps = {
          operations: parseInt(data.stats.operations)||0,
          received: Array.isArray(data.stats.received) ? data.stats.received.map(x=>parseInt(x)||0) : new Array(denominations.length).fill(0),
          spent:    Array.isArray(data.stats.spent)    ? data.stats.spent.map(x=>parseInt(x)||0)    : new Array(denominations.length).fill(0)
        };
        saveStats();
      }
      if(Array.isArray(data.cierres)) saveCierres(data.cierres);
      if(Array.isArray(data.historicoResets)) saveHistoricoResets(data.historicoResets);
      if(Array.isArray(data.cambios)) saveCambios(data.cambios);
      saveStock(); saveTips(); renderStockList(); renderReservaList(); renderTopesList(); updateCashSummary();
      renderCierreHistorico(); renderResetPanel();
      alert("✅ Copia restaurada.");
    }catch(e){ alert("No se pudo leer el archivo."); }
  };
  reader.readAsText(file);
}

function init(){
  try { renderButtons(); }         catch(e){ console.error("renderButtons", e); }
  try { renderStockList(); }       catch(e){ console.error("renderStockList", e); }
  try { updateCashSummary(); }     catch(e){ console.error("updateCashSummary", e); }
  try { setupBackupUI(); }         catch(e){ console.error("setupBackupUI", e); }
  try { renderCierreHistorico(); } catch(e){ console.error("renderCierreHistorico", e); }
  try { checkAutoResetPropinas(); }catch(e){ console.error("checkAutoResetPropinas", e); }
}

init();