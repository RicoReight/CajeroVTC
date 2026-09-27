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
  1: 30, 2: 30, 5: 30,
  10: 25, 20: 25, 50: 20,
  100: 20, 200: 20,
  500: 8, 1000: 8,
  2000: 5, 5000: 3, 10000: 2
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

function toggleMenu(){
  const drawer = document.getElementById("drawer");
  const overlay = document.getElementById("overlay");
  if(!drawer || !overlay) return;
  drawer.classList.toggle("active");
  overlay.classList.toggle("active");
}

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

function findSmartChange(target, availableStock) {
  let bestSolution = null;
  let minScore = Infinity;

  function backtrack(index, currentTarget, currentUsed, score) {
    if (currentTarget === 0) {
      if (score < minScore) {
        minScore = score;
        bestSolution = [...currentUsed];
      }
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

  if(price <= 0 || paid === 0){
    resultDiv.style.display = "none";
    return;
  }

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
      badge.className = "badge";
      badge.textContent = "x" + n;

      const graphic = document.createElement("div");
      graphic.className = (d.type === "bill" ? "bill-graphic " : "coin-graphic ") + d.class;
      graphic.textContent = d.short;

      item.appendChild(badge);
      item.appendChild(graphic);
      changeGrid.appendChild(item);
    }
  });

  resultDiv.style.display = "block";
}

function confirmTransaction(){
  if(!pendingTransaction){
    alert("Introduce un precio y el dinero recibido.");
    return;
  }

  for(let i = 0; i < stock.length; i++){
    stock[i] += pendingTransaction.incoming[i] - pendingTransaction.used[i];
  }

  if(pendingTransaction.tip > 0){
    totalTips += pendingTransaction.tip;
    saveTips();
  }

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

function renderStockList(){
  const box = document.getElementById("stockList");
  if(!box) return;
  box.innerHTML = "";
  stockInputs = [];

  const tipEl = document.getElementById("totalTipDisplay");
  if(tipEl) tipEl.textContent = "Propinas: " + moneyText(totalTips);

  denominations.forEach((d, i) => {
    const row = document.createElement("div");
    row.className = "stock-item";

    const title = document.createElement("span");
    title.textContent = d.n;
    title.style.fontWeight = "700";

    const ctrl = document.createElement("div");
    ctrl.className = "stock-ctrl";

    const btnMinus = document.createElement("button");
    btnMinus.textContent = "-";
    btnMinus.onclick = () => updateStockVal(i, stock[i] - 1);

    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.value = stock[i];
    input.onchange = (e) => updateStockVal(i, parseInt(e.target.value) || 0);

    const btnPlus = document.createElement("button");
    btnPlus.textContent = "+";
    btnPlus.onclick = () => updateStockVal(i, stock[i] + 1);

    ctrl.appendChild(btnMinus);
    ctrl.appendChild(input);
    ctrl.appendChild(btnPlus);

    row.appendChild(title);
    row.appendChild(ctrl);
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
    saveStock();
    saveTips();
    renderStockList();
    if(received.length > 0) calculate();
  }
}

/* ---------- Auto reset propinas ---------- */
function checkAutoResetPropinas(){
  if(!ultimoResetPropinas){
    ultimoResetPropinas = new Date().toISOString();
    saveUltimoResetPropinas();
    return;
  }
  const last = new Date(ultimoResetPropinas);
  const now  = new Date();
  const candidato = new Date(last.getFullYear(), last.getMonth(), diaReset, 0, 0, 0);
  if(candidato <= last) candidato.setMonth(candidato.getMonth()+1);
  if(now >= candidato){
    totalTips = 0;
    saveTips();
    ultimoResetPropinas = now.toISOString();
    saveUltimoResetPropinas();
    renderStockList();
  }
}

/* ---------- Init ---------- */
function init(){
  try { renderButtons(); }         catch(e){ console.error("renderButtons", e); }
  try { renderStockList(); }       catch(e){ console.error("renderStockList", e); }
  try { updateCashSummary(); }     catch(e){ console.error("updateCashSummary", e); }
  try { checkAutoResetPropinas(); }catch(e){ console.error("checkAutoResetPropinas", e); }

  // Ocultar splash
  const splash = document.getElementById("splash");
  if(splash){
    setTimeout(() => {
      splash.classList.add("oculto");
      setTimeout(() => { if(splash.parentNode) splash.parentNode.removeChild(splash); }, 500);
    }, 600);
  }
}

init();