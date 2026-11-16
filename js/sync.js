// js/sync.js
// Detecta si estamos en GitHub Pages (PC) o en la app del móvil
const esPC = window.location.hostname.includes("github.io") || window.location.hostname !== "localhost" && !window.Capacitor;

if (esPC) {
  console.log("💻 Modo PC detectado. Preparando conexión con el móvil...");
  
  // 1. Activar los estilos de pantalla ancha
  document.body.classList.add('modo-desktop');

  // 2. Preguntar IP al usuario si no la tiene guardada
  let ipMovil = localStorage.getItem("uberCambioIpMovil");
  
  if (!ipMovil) {
    ipMovil = prompt("💻 MODO PC ACTIVADO\n\nEscribe la IP que te muestra el móvil (ej: 192.168.1.58):", "192.168.1.");
    if (ipMovil) {
      localStorage.setItem("uberCambioIpMovil", ipMovil.replace("http://", "").replace(":8080", ""));
    }
  }

  // 3. Interceptar los guardados para enviarlos al móvil
  const guardarOriginal = safeStorage.set;
  safeStorage.set = function(k, v) {
    guardarOriginal.call(safeStorage, k, v); // Guarda en el PC
    
    // Si tenemos la IP, enviamos el cambio al móvil
    if (ipMovil) {
      fetch(`http://${ipMovil}:8080/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: k, value: v })
      }).then(() => {
          console.log("✅ Sincronizado con el móvil:", k);
      }).catch(e => {
          console.warn("❌ No se pudo sincronizar con el móvil (¿Está el Modo Web activo?):", e);
      });
    }
  };
  
  // Añadir un botón flotante para cambiar la IP si se equivoca
  setTimeout(() => {
      const btnIp = document.createElement("button");
      btnIp.innerHTML = `📡 IP: ${ipMovil || 'Sin conexión'}`;
      btnIp.style.cssText = "position:fixed;bottom:20px;right:20px;background:#0891b2;color:#fff;padding:10px 15px;border-radius:20px;font-weight:bold;border:none;cursor:pointer;z-index:99999;box-shadow:0 4px 10px rgba(0,0,0,0.5);";
      btnIp.onclick = () => {
          const nuevaIp = prompt("Cambiar IP del móvil:", ipMovil);
          if(nuevaIp) {
              localStorage.setItem("uberCambioIpMovil", nuevaIp.replace("http://", "").replace(":8080", ""));
              location.reload();
          }
      };
      document.body.appendChild(btnIp);
  }, 1000);
}