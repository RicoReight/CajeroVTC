// js/sync.js
// Detecta si estamos abriendo la app desde una IP (PC/Tablet) en lugar de localhost
const esPC = window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/) !== null;

if (esPC) {
  console.log("💻 Modo PC/Tablet detectado. Sincronizando con el móvil...");
  
  // 1. Activar los estilos de pantalla ancha
  document.body.classList.add('modo-desktop');

  // 2. Configurar la URL para sincronizar
  const apiSyncUrl = `http://${window.location.hostname}:${window.location.port || 8080}/sync`;

  // 3. Interceptar los guardados para enviarlos al móvil
  const guardarOriginal = safeStorage.set;
  safeStorage.set = function(k, v) {
    guardarOriginal.call(safeStorage, k, v); // Guarda en el PC
    
    // Enviar al móvil
    fetch(apiSyncUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: k, value: v })
    }).then(() => {
        console.log("✅ Sincronizado con el móvil:", k);
    }).catch(e => {
        console.warn("❌ No se pudo sincronizar con el móvil (¿Estás en la misma red?):", e);
    });
  };
}