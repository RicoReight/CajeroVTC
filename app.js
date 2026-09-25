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

function loadTips(){
  return parseInt(safeStorage.get("uberCambioTips")) || 0;
}

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
    reserva:    document.getElementById("panelReserva")
  };
  const tabs = {
    inventario: document.getElementById("tabInventario"),
    reserva:    document.getElementById("tabReserva")
  };
  const active   = "flex:1;padding:8px;border-radius:10px;border:1px solid #475569;background:#334155;color:#fff;font-weight:700;cursor:pointer;font-size:12px";
  const inactive = "flex:1;padding:8px;border-radius:10px;border:1px solid #475569;background:#1e293b;color:#94a3b8;font-weight:700;cursor:pointer;font-size:12px";

  Object.keys(panels).forEach(k => {
    if(panels[k]) panels[k].style.display = (k === tab) ? "block" : "none";
    if(tabs[k])   tabs[k].style.cssText   = (k === tab) ? active : inactive;
  });

  if(tab === "inventario") renderStockList();
  if(tab === "reserva")    renderReservaList();
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

/* ---------- Mostrar precio en grande al cliente ---------- */

function mostrarPrecio(){
  const inp = document.getElementById("price");
  if(!inp) return;
  const raw = parseFloat(inp.value.replace(',', '.')) || 0;
  if(raw <= 0){
    alert("Escribe primero el precio del viaje.");
    return;
  }
  const el = document.getElementById("precioGrande");
  if(el) el.textContent = moneyText(Math.round(raw * 100));
  const pantalla = document.getElementById("precioPantalla");
  if(pantalla) pantalla.style.display = "flex";
}

function cerrarPrecio(){
  const pantalla = document.getElementById("precioPantalla");
  if(pantalla) pantalla.style.display = "none";
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
  if(tocaReserva) header += " ⚠️ (toca reserva mínima)";
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

function resetStock(){
  if(confirm("¿Seguro que quieres poner a CERO la caja y las propinas?")){
    stock = Array(denominations.length).fill(0);
    totalTips = 0;
    saveStock(); saveTips(); renderStockList();
    if(received.length > 0) calculate();
  }
}

/* ---------- Reserva mínima ---------- */

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
  if(!confirm("¿Restaurar la reserva mínima a los valores por defecto?")) return;
  reservaMinima = Object.assign({}, RESERVA_MINIMA_DEFAULT);
  saveReserva();
  renderReservaList();
}

/* ---------- Cierre de caja ---------- */

function loadCierres(){
  const saved = safeStorage.get("uberCambioCierres");
  if(saved){ try { return JSON.parse(saved) || []; } catch(e){ return []; } }
  return [];
}
function saveCierres(c){ safeStorage.set("uberCambioCierres", JSON.stringify(c)); }

function abrirCierrePantalla(){
  const drawer = document.getElementById("drawer");
  const overlay = document.getElementById("overlay");
  if(drawer)  drawer.classList.remove("active");
  if(overlay) overlay.classList.remove("active");

  const pantalla = document.getElementById("cierrePantalla");
  if(pantalla) pantalla.style.display = "block";

  const inp = document.getElementById("cierreInput");
  if(inp) inp.value = "";
  const cont = document.getElementById("cierreResultado");
  if(cont){ cont.style.display = "none"; cont.innerHTML = ""; }
  const btn = document.getElementById("btnConfirmarCierre");
  if(btn) btn.style.display = "none";

  renderCierreHistorico();
}

function cerrarCierrePantalla(){
  const pantalla = document.getElementById("cierrePantalla");
  if(pantalla) pantalla.style.display = "none";
}

function calcularCierre(){
  const cont = document.getElementById("cierreResultado");
  const btn  = document.getElementById("btnConfirmarCierre");
  const raw  = parseFloat(document.getElementById("cierreInput").value.replace(',', '.')) || 0;
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

  // BILLETES A ENTREGAR
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

  // CÁLCULOS FINALES
  const sobrante      = target - res.total;
  const totalEnCaja   = stock.reduce((sum, n, i) => sum + n * denominations[i].c, 0);
  const quedaEnCaja   = totalEnCaja - res.total;

  html += "<div style='margin-top:16px;padding-top:16px;border-top:1px solid #334155;text-align:center'>";

  if(sobrante > 0){
    html += "<div style='font-size:12px;color:#94a3b8;font-weight:800;letter-spacing:0.5px'>SOBRANTE NO ENT
