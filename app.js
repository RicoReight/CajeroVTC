"use strict";

/* ---------- Acceso seguro a localStorage ---------- */
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
  10000: 0, 5000: 0, 2000: 1, 1000: 1, 500: 1,
  200: 2, 100: 2, 50: 3, 20: 5, 10: 5, 5: 3, 2: 3, 1: 5
};

const DIA_RESET_DEFAULT = 20;

let stock = loadStock();
let totalTips = loadTips();
let reservaMinima = loadReserva();
let received = [];
let pendingTransaction = null;
let stockInputs = [];
let reservaInputs = [];
let summaryTimer = null;

function loadStock(){
  const saved = safeStorage.get("uberCambioStock");
  if(saved){
    try{
      const a = JSON.parse(saved);
      if(Array.isArray(a) && a.length === denominations.length)
        return a.map(x => Math.max(0, parseInt(x) || 0));
    }catch(e){}
  }
  return [0, 0, 2, 3, 4, 10, 10, 20, 40, 10, 10, 10, 10];
}

function loadTips(){ return parseInt(safeStorage.get("uberCambioTips")) || 0; }

function loadReserva(){
  const base = Object.assign({}, RESERVA_MINIMA_DEFAULT);
  const saved = safeStorage.get("uberCambioReserva");
  if(saved){
    try{
      const obj = JSON.parse(saved);
      if(obj && typeof obj === "object"){
        denominations.forEach(d => {
          if(typeof obj[d.c] === "number") base[d.c] = Math.max(0, parseInt(obj[d.c]) || 0);
        });
      }
    }catch(e){}
  }
  return base;
}

function saveStock(){
  safeStorage.set("uberCambioStock", JSON.stringify(stock));
  scheduleCashSummary();
}
function saveTips(){ safeStorage.set("uberCambioTips", String(totalTips)); }
function saveReserva(){
  safeStorage.set("uberCambioReserva", JSON.stringify(reservaMinima));
  scheduleCashSummary();
  if(received.length > 0) calculate();
}

function moneyText(c){
  return (c/100).toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2})+" €";
}

/* ---------- Reset automático mensual ---------- */

function getDiaReset(){
  const d = parseInt(safeStorage.get("uberCambioDiaReset"));
  if(d >= 1 && d <= 31) return d;
  return DIA_RESET_DEFAULT;
}

function getUltimoReset(){
  const s = safeStorage.get("uberCambioUltimoReset");
  if(!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function guardarDiaReset(){
  const input = document.getElementById("diaResetInput");
  if(!input) return;
  let d = parseInt(input.value) || DIA_RESET_DEFAULT;
  if(d < 1) d = 1;
  if(d > 31) d = 31;
  input.value = d;
  safeStorage.set("uberCambioDiaReset", String(d));
  actualizarInfoReset();
  checkAutoReset();
}

function actualizarInfoReset(){
  const info = document.getElementById("ultimoResetInfo");
  if(!info) return;
  const ult = getUltimoReset();
  const dia = getDiaReset();
  if(!ult){
    info.textContent = "Día configurado: " + dia + " (aún no se ha reseteado)";
    return;
  }
  const f = ult.toLocaleDateString("es-ES") + " " + ult.toLocaleTimeString("es-ES", {hour:"2-digit", minute:"2-digit"});
  info.textContent = "Último reset: " + f;
}

function checkAutoReset(){
  const dia = getDiaReset();
  const ahora = new Date();
  const resetEsteMes = new Date(ahora.getFullYear(), ahora.getMonth(), dia, 0, 0, 0, 0);
  const ult = getUltimoReset();

  if(!ult){
    if(ahora >= resetEsteMes){
      safeStorage.set("uberCambioUltimoReset", resetEsteMes.toISOString());
    } else {
      const anterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, dia, 0, 0, 0, 0);
      safeStorage.set("uberCambioUltimoReset", anterior.toISOString());
    }
    actualizarInfoReset();
    return false;
  }

  if(ahora >= resetEsteMes && ult < resetEsteMes){
    totalTips = 0;
    saveTips();
    safeStorage.remove("uberCambioCierres");
    safeStorage.set("uberCambioUltimoReset", resetEsteMes.toISOString());
    return true;
  }

  return false;
}

/* ---------- Resumen de caja ---------- */

function scheduleCashSummary(){
  if(summaryTimer) clearTimeout(summaryTimer);
  summaryTimer = setTimeout(() => { summaryTimer = null; updateCashSummary(); }, 120);
}

function updateCashSummary(){
  let grandTotal = 0;
  denominations.forEach((d, i) => { grandTotal += d.c * stock[i]; });
  const totalEl = document.getElementById("totalCashDisplay");
  if(totalEl) totalEl.textContent = moneyText(grandTotal);

  const checks = [
    ["status20",   2000], ["status30",   3000], ["status50",   5000],
    ["status80",   8000], ["status100", 10000]
  ];
  const disponible = stockDisponible();
  const cache = Object.create(null);
  checks.forEach(([id, target]) => {
    if(!(target in cache)) cache[target] = estadoPara(target, disponible);
    setStatusBadge(id, cache[target]);
  });
}

function estadoPara(target, disponible){
  if(canMakeAmount(target, disponible)) return "yes";
  if(canMakeAmount(target, stock))      return "warn";
  return "no";
}

function stockDisponible(){
  return stock.map((n, i) =>
    Math.max(0, n - (reservaMinima[denominations[i].c] || 0))
  );
}

function canMakeAmount(target, availableStock){
  if(target <= 0) return true;
  const reachable = new Uint8Array(target + 1);
  reachable[0] = 1;
  for(let i = 0; i < denominations.length; i++){
    const v = denominations[i].c;
    const m = availableStock[i];
    if(m <= 0 || v > target) continue;
    const used = new Int32Array(target + 1).fill(-1);
    for(let t = 0; t <= target; t++) if(reachable[t]) used[t] = 0;
    for(let t = 0; t + v <= target; t++){
      if(used[t] < 0) continue;
      if(used[t] < m && used[t + v] < 0){
        reachable[t + v] = 1;
        used[t + v] = used[t] + 1;
      }
    }
  }
  return reachable[target] === 1;
}

function setStatusBadge(elemId, estado){
  const el = document.getElementById(elemId);
  if(!el) return;
  el.style.background = "";
  el.style.color = "";
  if(estado === "yes"){
    el.textContent = "SÍ"; el.className = "status-badge yes";
  } else if(estado === "warn"){
    el.textContent = "MÍN"; el.className = "status-badge warn";
    el.style.background = "#eab308"; el.style.color = "#000";
  } else {
    el.textContent = "NO"; el.className = "status-badge no";
  }
}

/* ---------- Menú + pestañas ---------- */

function toggleMenu(){
  const drawer = document.getElementById("drawer");
  const overlay = document.getElementById("overlay");
  if(!drawer || !overlay) return;
  drawer.classList.toggle("active");
  overlay.classList.toggle("active");
}

function switchDrawerTab(tab){
  const panels = {
    inventario: document.getElementById("panelInventario"),
    reserva:    document.getElementById("panelReserva"),
    reseteos:   document.getElementById("panelReseteos")
  };
  const tabs = {
    inventario: document.getElementById("tabInventario"),
    reserva:    document.getElementById("tabReserva"),
    reseteos:   document.getElementById("tabReseteos")
  };
  const active   = "flex:1;padding:8px;border-radius:10px;border:1px solid #475569;background:#334155;color:#fff;font-weight:700;cursor:pointer;font-size:12px";
  const inactive = "flex:1;padding:8px;border-radius:10px;border:1px solid #475569;background:#1e293b;color:#94a3b8;font-weight:700;cursor:pointer;font-size:12px";

  Object.keys(panels).forEach(k => {
    if(panels[k]) panels[k].style.display = (k === tab) ? "block" : "none";
    if(tabs[k])   tabs[k].style.cssText   = (k === tab) ? active : inactive;
  });

  if(tab === "inventario") renderStockList();
  if(tab === "reserva")    renderReservaList();
  if(tab === "reseteos")   cargarPanelReseteos();
}

function cargarPanelReseteos(){
  const input = document.getElementById("diaResetInput");
  if(input) input.value = getDiaReset();
  actualizarInfoReset();
}

/* ---------- Botones de dinero ---------- */

function renderButtons(){
  const box = document.getElementById("moneyButtons");
  if(!box) return;
  box.innerHTML = "";

  const billTitle = document.createElement("div");
  billTitle.className = "section"; billTitle.textContent = "Billetes"; box.appendChild(billTitle);

  denominations.slice(0,5).forEach((d)=>{
    const b = document.createElement("button");
    b.type = "button"; b.className = "money"; b.textContent = d.n;
    b.addEventListener("click", () => addMoney(d.c));
    box.appendChild(b);
  });

  const coinTitle = document.createElement("div");
  coinTitle.className = "section"; coinTitle.textContent = "Monedas"; box.appendChild(coinTitle);

  denominations.slice(5).forEach((d)=>{
    const b = document.createElement("button");
    b.type = "button"; b.className = "money"; b.textContent = d.n;
    b.addEventListener("click", () => addMoney(d.c));
    box.appendChild(b);
  });
}

function addMoney(c){ received.push(c); updateReceived(); calculate(); }
function undoMoney(){ received.pop(); updateReceived(); calculate(); }

function updateReceived(){
  const total = received.reduce((a,b) => a + b, 0);
  const el = document.getElementById("paidDisplay");
  if(el) el.textContent = moneyText(total);
}

function setAllTip(){
  const rawPrice = parseFloat(document.getElementById("price").value.replace(',', '.')) || 0;
  const price = Math.round(rawPrice * 100);
  const paid = received.reduce((a,b) => a + b, 0);
  if(paid > price && price > 0){
    const tipValue = (paid - price) / 100;
    document.getElementById("tip").value = tipValue.toFixed(2);
    calculate();
  }
}

/* ---------- findSmartChange ---------- */
function findSmartChange(target, availableStock) {
  let bestSolution = null;
  let minScore = Infinity;
  function backtrack(index, currentTarget, currentUsed, score) {
    if (currentTarget === 0) {
      if (score < minScore) { minScore = score; bestSolution = [...currentUsed]; }
      return;
    }
    if (index >= denominations.length || currentTarget < 0) return;
    if (score >= minScore) return;
    const coinVal = denominations[index].c;
    const maxPossible = Math.min(availableStock[index], Math.floor(currentTarget / coinVal));
    for (let count = maxPossible; count >= 0; count--) {
      currentUsed[index] = count;
      const penalty = (denominations[index].type === 'coin' && coinVal <= 200) ? count * 2 : count;
      backtrack(index + 1, currentTarget - (count * coinVal), currentUsed, score + penalty);
      currentUsed[index] = 0;
    }
  }
  const initialUsed = Array(denominations.length).fill(0);
  backtrack(0, target, initialUsed, 0);
  return bestSolution;
}

/* ---------- calculate ---------- */
function calculate(){
  const rawPrice = parseFloat(document.getElementById("price").value.replace(',', '.')) || 0;
  const price = Math.round(rawPrice * 100);
  const paid = received.reduce((a,b) => a + b, 0);
  const rawTip = parseFloat(document.getElementById("tip").value.replace(',', '.')) || 0;
  const tip = Math.round(rawTip * 100);

  const resultDiv = document.getElementById("changeResult");
  const changeTotal = document.getElementById("changeTotal");
  const changeGrid = document.getElementById("changeGrid");

  pendingTransaction = null;
  if(price <= 0 || paid === 0){ resultDiv.style.display = "none"; return; }

  const totalCharge = price + tip;
  if(paid < totalCharge){
    changeTotal.textContent = "FALTAN " + moneyText(totalCharge - paid);
    changeGrid.innerHTML = "";
    resultDiv.style.display = "block";
    return;
  }

  const incoming = Array(denominations.length).fill(0);
  received.forEach(c => {
    const i = denominations.findIndex(d => d.c === c);
    if(i >= 0) incoming[i]++;
  });

  const available = stock.map((n, i) => n + incoming[i]);
  const targetChange = paid - totalCharge;

  if (targetChange === 0) {
    pendingTransaction = { incoming, used: Array(denominations.length).fill(0), tip, tocaReserva: false };
    changeTotal.textContent = tip > 0 ? "PAGO EXACTO (Propina: " + moneyText(tip) + ")" : "PAGO EXACTO. SIN CAMBIO.";
    changeGrid.innerHTML = "";
    resultDiv.style.display = "block";
    return;
  }

  const disponible = available.map((n, i) =>
    Math.max(0, n - (reservaMinima[denominations[i].c] || 0))
  );
  let used = findSmartChange(targetChange, disponible);
  let tocaReserva = false;

  if(!used){
    used = findSmartChange(targetChange, available);
    tocaReserva = !!used;
  }

  if(!used){
    changeTotal.textContent = "SIN CAMBIO ÓPTIMO PARA DEVOLVER " + moneyText(targetChange);
    changeGrid.innerHTML = "";
    resultDiv.style.display = "block";
    return;
  }

  pendingTransaction = { incoming, used, tip, tocaReserva };

  let header = "DEVOLVER: " + moneyText(targetChange);
  if(tocaReserva) header += " ⚠️ (toca límite mínimo)";
  changeTotal.textContent = header;
  changeGrid.innerHTML = "";

  used.forEach((n, i) => {
    if(n > 0){
      const d = denominations[i];
      const item = document.createElement("div");
      item.className = "cash-item";
      const badge = document.createElement("div");
      badge.className = "badge"; badge.textContent = "x" + n;
      const graphic = document.createElement("div");
      graphic.className = (d.type === "bill" ? "bill-graphic " : "coin-graphic ") + d.class;
      graphic.textContent = d.short;
      item.appendChild(badge); item.appendChild(graphic);
      changeGrid.appendChild(item);
    }
  });
  resultDiv.style.display = "block";
}

function confirmTransaction(){
  if(!pendingTransaction){ alert("Introduce un precio y el dinero recibido."); return; }
  for(let i = 0; i < stock.length; i++){
    stock[i] += pendingTransaction.incoming[i] - pendingTransaction.used[i];
  }
  if(pendingTransaction.tip > 0){ totalTips += pendingTransaction.tip; saveTips(); }
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
    const panel = document.getElementById("panelInventario") || document.getElementById("drawer");
    if(!panel) return;
    box = document.createElement("div");
    box.id = "stockList";
    panel.appendChild(box);
  }
  box.innerHTML = "";
  stockInputs = [];

  const tipEl = document.getElementById("totalTipDisplay");
  if(tipEl) tipEl.textContent = "💶 Propinas: " + moneyText(totalTips);

  denominations.forEach((d, i) => {
    const row = document.createElement("div");
    row.className = "stock-item";
    const title = document.createElement("span");
    title.textContent = d.n; title.style.fontWeight = "700";
    const ctrl = document.createElement("div");
    ctrl.className = "stock-ctrl";

    const btnMinus = document.createElement("button");
    btnMinus.type = "button"; btnMinus.textContent = "-";
    btnMinus.onclick = () => updateStockVal(i, stock[i] - 1);

    const input = document.createElement("input");
    input.type = "number"; input.min = "0"; input.value = stock[i];
    input.onchange = (e) => updateStockVal(i, parseInt(e.target.value) || 0);

    const btnPlus = document.createElement("button");
    btnPlus.type = "button"; btnPlus.textContent = "+";
    btnPlus.onclick = () => updateStockVal(i, stock[i] + 1);

    ctrl.appendChild(btnMinus); ctrl.appendChild(input); ctrl.appendChild(btnPlus);
    row.appendChild(title); row.appendChild(ctrl);
    box.appendChild(row);
    stockInputs[i] = input;
  });
}

function updateStockVal(index, val){
  stock[index] = Math.max(0, val);
  if(stockInputs[index]) stockInputs[index].value = stock[index];
  saveStock();
}

/* ---------- Límite mínimo (antes Reserva) ---------- */

function renderReservaList(){
  let box = document.getElementById("reservaList");
  if(!box){
    const panel = document.getElementById("panelReserva") || document.getElementById("drawer");
    if(!panel) return;
    box = document.createElement("div");
    box.id = "reservaList";
    panel.appendChild(box);
  }
  box.innerHTML = "";
  reservaInputs = [];

  denominations.forEach((d, i) => {
    const row = document.createElement("div");
    row.className = "stock-item";
    const title = document.createElement("span");
    title.textContent = d.n; title.style.fontWeight = "700";
    const ctrl = document.createElement("div");
    ctrl.className = "stock-ctrl";

    const btnMinus = document.createElement("button");
    btnMinus.type = "button"; btnMinus.textContent = "-";
    btnMinus.onclick = () => updateReservaVal(i, (reservaMinima[d.c] || 0) - 1);

    const input = document.createElement("input");
    input.type = "number"; input.min = "0"; input.value = reservaMinima[d.c] || 0;
    input.onchange = (e) => updateReservaVal(i, parseInt(e.target.value) || 0);

    const btnPlus = document.createElement("button");
    btnPlus.type = "button"; btnPlus.textContent = "+";
    btnPlus.onclick = () => updateReservaVal(i, (reservaMinima[d.c] || 0) + 1);

    ctrl.appendChild(btnMinus); ctrl.appendChild(input); ctrl.appendChild(btnPlus);
    row.appendChild(title); row.appendChild(ctrl);
    box.appendChild(row);
    reservaInputs[i] = input;
  });
}

function updateReservaVal(index, val){
  const d = denominations[index];
  reservaMinima[d.c] = Math.max(0, val);
  if(reservaInputs[index]) reservaInputs[index].value = reservaMinima[d.c];
  saveReserva();
}

function resetReserva(){
  if(!confirm("¿Restaurar el límite mínimo a los valores por defecto?")) return;
  reservaMinima = Object.assign({}, RESERVA_MINIMA_DEFECTO_RESERVA_PLACEHOLDER);
  saveReserva();
  renderReservaList();
}

/* ---------- Reseteos manuales ---------- */

function resetPropinasAhora(){
  if(!confirm("¿Poner las propinas a 0,00 €?")) return;
  totalTips = 0;
  saveTips();
  renderStockList();
  alert("✅ Propinas reseteadas.");
}

function resetHistorialAhora(){
  if(!confirm("¿Borrar el historial de ingresos a base?")) return;
  safeStorage.remove("uberCambioCierres");
  renderIngresoHistorico();
  alert("✅ Historial borrado.");
}

function resetInventarioAhora(){
  if(!confirm("¿Poner TODO el inventario a cero? (Las propinas y el historial no se tocan)")) return;
  stock = Array(denominations.length).fill(0);
  saveStock();
  renderStockList();
  updateCashSummary();
  alert("✅ Inventario a cero.");
}

function resetTodoAhora(){
  if(!confirm("⚠️ Esto borrará: inventario, propinas e historial de ingresos.\n\n¿Continuar?")) return;
  stock = Array(denominations.length).fill(0);
  totalTips = 0;
  saveStock();
  saveTips();
  safeStorage.remove("uberCambioCierres");
  renderStockList();
  updateCashSummary();
  renderIngresoHistorico();
  alert("✅ Todo reseteado.");
}

/* ---------- Ingreso a Base ---------- */

function loadCierres(){
  const saved = safeStorage.get("uberCambioCierres");
  if(saved){ try { return JSON.parse(saved) || []; } catch(e){ return []; } }
  return [];
}
function saveCierres(c){ safeStorage.set("uberCambioCierres", JSON.stringify(c)); }

function abrirIngresoPantalla(){
  const drawer = document.getElementById("drawer");
  const overlay = document.getElementById("overlay");
  if(drawer)  drawer.classList.remove("active");
  if(overlay) overlay.classList.remove("active");

  const pantalla = document.getElementById("ingresoPantalla");
  if(pantalla) pantalla.style.display = "block";

  const inp = document.getElementById("ingresoInput");
  if(inp) inp.value = "";
  const cont = document.getElementById("ingresoResultado");
  if(cont){ cont.style.display = "none"; cont.innerHTML = ""; }
  const btn = document.getElementById("btnConfirmarIngreso");
  if(btn) btn.style.display = "none";

  renderIngresoHistorico();
}

function cerrarIngresoPantalla(){
  const pantalla = document.getElementById("ingresoPantalla");
  if(pantalla) pantalla.style.display = "none";
}

function calcularIngreso(){
  const cont = document.getElementById("ingresoResultado");
  const btn  = document.getElementById("btnConfirmarIngreso");
  const raw  = parseFloat(document.getElementById("ingresoInput").value.replace(',', '.')) || 0;
  const target = Math.round(raw * 100);

  if(!cont || !btn) return;
  if(target <= 0){ cont.style.display = "none"; cont.innerHTML = ""; btn.style.display = "none"; return; }

  const billetesStock = stock.slice(0, 5);
  const res = findBilletes(target, billetesStock);

  if(!res || res.total === 0){
    const maxBilletes = stock.slice(0,5).reduce((sum, n, i) =>
      sum + n * denominations[i].c, 0);
    let msg = "";
    if(maxBilletes === 0){
      msg = "⚠️ No tienes ningún billete en el inventario.<br>Añade billetes en Ajustes → Inventario.";
    } else {
      msg = "⚠️ No puedes formar " + moneyText(target) + ".<br>" +
            "En billetes tienes como máximo " + moneyText(maxBilletes) + ".";
    }
    cont.innerHTML = "<div style='color:#ef4444;font-weight:700;font-size:14px;text-align:center;line-height:1.6'>" + msg + "</div>";
    cont.style.display = "block";
    btn.style.display = "none";
    return;
  }

  let html = "";
  html += "<div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px;text-align:center'>💵 ENTREGAR EN BILLETES</div>";
  html += "<div style='font-size:32px;font-weight:900;color:#4ade80;margin:6px 0 14px;text-align:center'>" + moneyText(res.total) + "</div>";
  html += "<div class='change-grid'>";
  res.usados.forEach((n, i) => {
    if(n > 0){
      const d = denominations[i];
      html += "<div class='cash-item'>" +
                "<div class='badge'>x" + n + "</div>" +
                "<div class='bill-graphic " + d.class + "'>" + d.short + "</div>" +
              "</div>";
    }
  });
  html += "</div>";

  const sobrante      = target - res.total;
  const totalEnCaja   = stock.reduce((sum, n, i) => sum + n * denominations[i].c, 0);
  const quedaEnCaja   = totalEnCaja - res.total;

  html += "<div style='margin-top:16px;padding-top:16px;border-top:1px solid #334155;text-align:center'>";

  if(sobrante > 0){
    html += "<div style='font-size:12px;color:#f87171;font-weight:800;letter-spacing:0.5px'>⚠️ TE QUITARÁN DE LA NÓMINA</div>" +
            "<div style='font-size:22px;font-weight:900;color:#ef4444;margin-top:4px'>-" + moneyText(sobrante) + "</div>" +
            "<div style='font-size:11px;color:#94a3b8;margin-top:2px'>Lo que no entregas en billetes</div>";
  }

  html += "<div style='margin-top:14px;padding:12px;background:#064e3b;border:1px solid #059669;border-radius:10px'>" +
            "<div style='font-size:12px;color:#4ade80;font-weight:800;letter-spacing:0.5px'>💼 TE QUEDA EN CAJA</div>" +
            "<div style='font-size:24px;font-weight:900;color:#4ade80;margin-top:4px'>" + moneyText(quedaEnCaja) + "</div>" +
            "<div style='font-size:11px;color:#94a3b8;margin-top:4px'>Después del ingreso, en monedas y billetes restantes</div>" +
          "</div>";

  html += "</div>";

  cont.innerHTML = html;
  cont.style.display = "block";
  btn.style.display = "block";
  btn.dataset.total  = String(res.total);
  btn.dataset.usados = JSON.stringify(res.usados);
}

function findBilletes(target, billetesStock){
  const denoms = [
    {c:10000, idx:0}, {c:5000, idx:1}, {c:2000, idx:2},
    {c:1000,  idx:3}, {c:500,  idx:4}
  ];
  const maxTarget = Math.floor(target / 5) * 5;
  for(let t = maxTarget; t >= 0; t -= 5){
    const res = buscarCombinacion(t, billetesStock, denoms);
    if(res) return { total: t, usados: res };
  }
  return { total: 0, usados: [0,0,0,0,0] };
}

function buscarCombinacion(target, stock, denoms){
  const usados = [0,0,0,0,0];
  function bt(i, restante){
    if(restante === 0) return true;
    if(i >= denoms.length) return false;
    const d = denoms[i];
    const max = Math.min(stock[d.idx], Math.floor(restante / d.c));
    for(let n = max; n >= 0; n--){
      usados[i] = n;
      if(bt(i + 1, restante - n * d.c)) return true;
    }
    usados[i] = 0;
    return false;
  }
  return bt(0, target) ? usados : null;
}

function confirmarIngreso(){
  const btn = document.getElementById("btnConfirmarIngreso");
  if(!btn) return;
  const total  = parseInt(btn.dataset.total) || 0;
  const usados = JSON.parse(btn.dataset.usados || "[]");
  if(total <= 0) return;

  if(!confirm("¿Confirmar ingreso a base? Se entregarán " + moneyText(total) + " en billetes.")) return;

  for(let i = 0; i < usados.length; i++){
    stock[i] = Math.max(0, stock[i] - usados[i]);
  }

  saveStock();
  renderStockList();
  updateCashSummary();

  const cierres = loadCierres();
  cierres.push({
    fecha: new Date().toISOString(),
    total: total
  });
  saveCierres(cierres);
  renderIngresoHistorico();

  document.getElementById("ingresoInput").value = "";
  const cont = document.getElementById("ingresoResultado");
  if(cont){ cont.style.display = "none"; cont.innerHTML = ""; }
  btn.style.display = "none";

  alert("✅ Ingreso realizado.\nEntregados: " + moneyText(total));
}

function renderIngresoHistorico(){
  const box = document.getElementById("ingresoHistorico");
  if(!box) return;
  const cierres = loadCierres();
  if(cierres.length === 0){ box.style.display = "none"; box.innerHTML = ""; return; }

  let html = "<div style='font-size:12px;font-weight:800;color:#94a3b8;letter-spacing:0.5px;margin-bottom:8px'>📜 INGRESOS A BASE (últimos 10)</div>";
  cierres.slice(-10).reverse().forEach(c => {
    const dd = new Date(c.fecha);
    const fecha = dd.toLocaleDateString("es-ES") + " " +
                  dd.toLocaleTimeString("es-ES", {hour:"2-digit", minute:"2-digit"});
    html += "<div style='padding:8px 0;border-bottom:1px solid #334155;font-size:13px;display:flex;justify-content:space-between'>" +
              "<span style='color:#94a3b8'>" + fecha + "</span>" +
              "<span style='font-weight:800;color:#4ade80'>" + moneyText(c.total) + "</span>" +
            "</div>";
  });
  box.innerHTML = html;
  box.style.display = "block";
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

  box.appendChild(title);
  box.appendChild(btnExport);
  box.appendChild(btnImport);
  box.appendChild(fileInput);
  panelInv.appendChild(box);
}

async function exportInventory(){
  const data = {
    app: "uberCambioVTC", version: 4,
    exportedAt: new Date().toISOString(),
    stock: stock,
    totalTips: totalTips,
    reservaMinima: reservaMinima,
    diaReset: getDiaReset()
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
      if(!confirm("¿Reemplazar el inventario, propinas y límite mínimo actuales?")) return;
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
      if(typeof data.diaReset === "number"){
        safeStorage.set("uberCambioDiaReset", String(data.diaReset));
      }
      saveStock(); saveTips(); renderStockList(); renderReservaList(); updateCashSummary();
      alert("✅ Copia restaurada.");
    }catch(e){ alert("No se pudo leer el archivo."); }
  };
  reader.readAsText(file);
}

/* ---------- Init ---------- */

function init(){
  checkAutoReset();

  try { renderButtons(); }         catch(e){ console.error(e); }
  try { renderStockList(); }       catch(e){ console.error(e); }
  try { renderReservaList(); }     catch(e){ console.error(e); }
  try { updateCashSummary(); }     catch(e){ console.error(e); }
  try { setupBackupUI(); }         catch(e){ console.error(e); }
  try { renderIngresoHistorico(); }catch(e){ console.error(e); }
}

init();
