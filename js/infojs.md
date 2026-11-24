📑 Resumen de la Estructura (Actualizado)

01. core.js (El motor)
- Constantes del dinero (billetes, monedas).
- Variables globales del estado (stock, propinas, festivos).
- Funciones de guardar/cargar en el móvil y utilidades de texto y fechas.

02. calculadora.js (Pantalla principal)
- Lógica del botón "Calcular" y el algoritmo de cambio.
- Botón de guardar operación y lectura de precios por OCR.
- NUEVO: Al guardar un viaje, enlaza la operación con el estado de la jornada (etiqueta si es un viaje de Uber en modo "Ocupado", y guarda el estado en ese momento).

03. caja.js (Menú Caja)
- Lista de billetes/monedas en caja y aviso de monedas sobrantes para la hucha.
- NUEVO: El sistema de recomendaciones ahora es inteligente y basado en el aprendizaje real. Ya no te pide billetes grandes si no los usas (evita decirte "pide 50€ al banco"), pero sí te avisa si acumulas demasiados.

04. calendario.js (Días de trabajo)
- Calendario visual, lógica de vacaciones, festivos, días personales y archivos .ics.

05. herramientas.js (Herramientas)
- Depósitos, Modo Peaje, Reponer Caja, PINs, Hucha y diagnóstico.
- NUEVO: Arreglado el bug de "Cambiar Billetes" (ya no deja seleccionar más piezas de las que hay en stock).
- NUEVO: La recomendación de cambio ahora usa la Hucha primero y te manda a depositar al banco si no hay hueco para cambiar.
- NUEVO: Inyecta el botón del estado de la jornada al lado del widget del coche en la pantalla principal.

06. mapa.js (Mapas)
- Lógica del GPS, mapa de Leaflet, polígonos (AMB, ZBE) e historial de rutas.
- NUEVO: Añadidas flechas de dirección en las rutas (PolylineDecorator).
- NUEVO: Las rutas se pintan de colores según el estado en el que estabas (Azul=Libre, Rojo=Ocupado, Naranja=Incidencia, Morado=Descanso, Gris=Fuera App).
- NUEVO: Incluye el panel de resumen diario con los KMs del día y el desglose de horas.

07. sistema.js (Sistema y arranque)
- Panel de reseteos, borrados de historial, configuración de notificaciones push y función init().

08. jornada.js (NUEVO - Control de Jornada y Tiempos)
- Cerebro de la jornada. Controla los 5 estados: ⚫ Fuera App (Offline), 🟢 Libre, 🔴 Ocupado, 🟠 Incidencia y 🟣 Descanso.
- Arranca el cronómetro al asignar el coche y lo detiene al liberarlo.
- Muestra un reloj en vivo en el botón del estado (ej. "🟢 LIBRE · 02:15").
- Calcula y guarda los tiempos de cada estado.
- Genera el "Resumen de Fin de Jornada" al liberar el coche (efectivo, propinas, KMs, horas efectivas y desglose).
- Guarda un historial de las últimas 31 jornadas con todos los datos y su interfaz de pantalla para consultarlo.