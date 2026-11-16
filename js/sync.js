// js/sync.js
// Detecta si estamos abriendo la app desde la IP del móvil (PC o Tablet)
const esPC = window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" && window.location.hostname !== "" && !window.location.href.includes("github.io");

if (esPC) {
  console.log("💻 Modo PC/Tablet detectado. Sincronizando con el móvil...");
  
  // 1. Activar los estilos de pantalla ancha
  document.body.classList.add('modo-desktop');

  // 2. Interceptar los guardados para enviarlos al móvil
  const guardarOriginal = safeStorage.set;
  safeStorage.set = function(k, v) {
    guardarOriginal.call(safeStorage, k, v); // Guarda en el PC
    // Envía el cambio al móvil por Wi-Fi
    fetch('/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: k, value: v })
    }).catch(e => console.warn("No se pudo enviar al móvil:", e));
  };
}