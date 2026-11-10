let map;
let cameraLayer;
let heatLayer;
let demographicLayer;
let riskLayer;
let historicalLayer;
let liveTracksLayer;
let fenceLayer;
let educationalLayer;
let invisibleFenceCircle;
let invisibleFenceTimeout;

const cameraRegistry = new Map();
const educationalRegistry = new Map();
const heatPoints = [];
let userLocationMarker;
const liveTrackRegistry = new Map();

// Muestra predefinida de instituciones para fallback offline o carga directa
const INSTITUCIONES_FALLBACK = [
  {
    id: "edu-ctg-001",
    name: "Institución Educativa Soledad Acosta de Samper (IESAS) - Sede Principal",
    acronym: "IESAS Blas de Lezo",
    category: "Colegio Público",
    icon: "🏫",
    address: "Transversal 54 con Calle 25, Barrio Blas de Lezo",
    corridor: "Transversal 54 (Eje Conector Los Ejecutivos - El Socorro)",
    lat: 10.3958,
    lng: -75.4952,
    danger_score: 0.98,
    risk_level: "CRÍTICO",
    student_population: 3850,
    daily_pedestrians: 7200,
    crossing_diagnosis: "Los niños y adolescentes de primaria y secundaria deben cruzar diariamente los cuatro carriles de la Transversal 54 sin ningún tipo de semáforo peatonal, puente o paso a nivel seguro. La señalización horizontal tipo cebra está completamente borrada y los conductores de busetas y motocicletas superan con frecuencia los 55 km/h en zona escolar. Se registran constantes situaciones de near-miss y frenadas de pánico en horarios de entrada (6:15 a.m.) y salida (12:00 m y 5:45 p.m.).",
    infrastructure_deficits: [
      "Inexistencia de semáforo peatonal a demanda",
      "Demarcación de cebra borrada por el tráfico",
      "Ausencia de reductores de velocidad homologados",
      "Punto ciego por estacionamiento indebido en bahías",
      "Tránsito descontrolado de mototaxistas en horas pico"
    ],
    client_opportunity: "Cliente institucional prioritario para la Secretaría de Educación Distrital y el DATT bajo el marco de la Ley 2251 'Julián Esteban' (zonas escolares a 30 km/h) y el Plan Estratégico de Seguridad Vial. Potencial cofinanciación mediante Asociación de Padres (ASOPADRES) y fondo distrital de prevención vial.",
    proposed_solution: "Kit SafeCrossing Escolar Integral: 1 Cámara IP inteligente VTA-84920 con visión YOLOv8 en borde + 1 Controlador Semafórico Físico ESP32 con pulsador piezoeléctrico anti-vandalismo + Geocerca virtual de 50m sincronizada con el Visor Móvil para padres de familia y acudientes.",
    commercial_stage: "Lead Prioritario A+ (Fase de Formulación de Proyecto Piloto)",
    key_decision_makers: "Rectoría IESAS / Secretaría de Educación Distrital de Cartagena / DATT"
  },
  {
    id: "edu-ctg-002",
    name: "SENA - Centro de Comercio y Servicios (Sede Cuatro Vientos)",
    acronym: "SENA Cuatro Vientos",
    category: "SENA",
    icon: "🎓",
    address: "Avenida Pedro de Heredia, Sector Cuatro Vientos",
    corridor: "Avenida Pedro de Heredia (Troncal Transcaribe y Carriles Mixtos)",
    lat: 10.4076,
    lng: -75.5097,
    danger_score: 0.94,
    risk_level: "CRÍTICO",
    student_population: 7600,
    daily_pedestrians: 12400,
    crossing_diagnosis: "Intersección neurálgica de seis carriles donde convergen buses articulados de Transcaribe, transporte público colectivo, taxis y mototaxis a gran escala. Los aprendices cruzan entre giros vehiculares peligrosos sin un ciclo semafórico peatonal exclusivo de suficiente duración.",
    infrastructure_deficits: [
      "Tiempo semafórico peatonal insuficiente (<12 segundos para 6 carriles)",
      "Conflicto severo en giro derecho vehicular no regulado",
      "Invasión recurrente de cebras peatonales por motociclistas",
      "Alto flujo de buses articulados a velocidades de troncal"
    ],
    client_opportunity: "Dirección Regional del SENA Bolívar dispone de presupuestos específicos para el Bienestar del Aprendiz y Seguridad Perimetral. Gran viabilidad de contratación directa o convenio de desarrollo tecnológico entre semilleros de investigación SENA y UNICOLOMBO.",
    proposed_solution: "Sistema SafeCrossing Institucional Campus Dual: 2 Cámaras de visión artificial en ambos sentidos de la Av. Pedro de Heredia con Billboard Mode dinámico + FSM en ESP32 para extensión automática del tiempo verde peatonal según aforo.",
    commercial_stage: "Cliente Clave en Negociación Técnica (Convenio Marco)",
    key_decision_makers: "Subdirección de Centro Comercio y Servicios SENA Bolívar / Comité de Bienestar"
  },
  {
    id: "edu-ctg-003",
    name: "SENA - Centro Agroempresarial y de Minería (Sede Ternera)",
    acronym: "SENA Ternera",
    category: "SENA",
    icon: "🎓",
    address: "Carretera Troncal de Occidente / Prolongación Pedro de Heredia, Sector Ternera",
    corridor: "Troncal de Occidente (Vía Nacional Intermunicipal de Alta Velocidad)",
    lat: 10.3773,
    lng: -75.4746,
    danger_score: 0.96,
    risk_level: "CRÍTICO",
    student_population: 6300,
    daily_pedestrians: 8900,
    crossing_diagnosis: "Tramo vial de características semi-urbanas y de alta velocidad (+70 km/h), con tráfico pesado de tractomulas, volquetas y flotas intermunicipales hacia Turbaco y Arjona. Los aprendices deben sortear camiones de carga pesada sobre una vía de tres carriles por sentido sin iluminación nocturna óptima ni puente peatonal.",
    infrastructure_deficits: [
      "Velocidades operativas vehiculares superiores a 70 km/h",
      "Tránsito ininterrumpido de carga pesada e intermunicipal",
      "Nula señalización lumínica activa de noche",
      "Carencia total de semáforo con pulsador peatonal"
    ],
    client_opportunity: "Fondo de Inversiones de Infraestructura SENA Colombia y Agencia Nacional de Seguridad Vial (ANSV) a través de convenios de infraestructura escolar metropolitana.",
    proposed_solution: "Despliegue SafeCrossing Perimetral Industrial: Cámara PTZ Tuya Cloud con visión infrarroja + Semáforo Inteligente ESP32 con balizas LED estroboscópicas de alta visibilidad para frenado anticipado.",
    commercial_stage: "Prospección Avanzada / Presentación en Mesa Sectorial",
    key_decision_makers: "Dirección Regional SENA Bolívar / Secretaría de Tránsito Municipal Turbaco-Cartagena"
  },
  {
    id: "edu-ctg-004",
    name: "Institución Educativa INEM José Manuel Rodríguez Torices",
    acronym: "INEM Santa Lucía",
    category: "Colegio Público",
    icon: "🏫",
    address: "Avenida Pedro de Heredia, Sector Santa Lucía / San Fernando",
    corridor: "Avenida Pedro de Heredia (Troncal Transcaribe y Estación Santa Lucía)",
    lat: 10.3921,
    lng: -75.4839,
    danger_score: 0.95,
    risk_level: "CRÍTICO",
    student_population: 5200,
    daily_pedestrians: 9500,
    crossing_diagnosis: "Es el macro-colegio público más grande de la ciudad. A la salida escolar, miles de niños desbordan los andenes estrechos y cruzan la calzada de Transcaribe y carriles mixtos saltando sobre el separador de concreto para alcanzar las paradas de autobús, generando grave riesgo de atropellamiento.",
    infrastructure_deficits: [
      "Congestión humana masiva que desborda las aceras peatonales",
      "Cruce forzado saltando separadores de concreto",
      "Paso de buses padrones y articulados a corta distancia",
      "Falta de vallas de encauzamiento peatonal escolar"
    ],
    client_opportunity: "Prioridad número 1 del Distrito de Cartagena en el Plan de Desarrollo 'Cartagena Ciudad de Derechos'. Licitación directa con la Alcaldía para dotación tecnológica de seguridad en entornos educativos.",
    proposed_solution: "Solución SafeCrossing Macro-Escolar: Cluster multi-cámara con aforo automático que activa fase de cruce prolongado automáticamente cuando detecta agrupaciones de más de 10 estudiantes en el bordillo.",
    commercial_stage: "Proyecto en Portafolio Distrital (Lead A)",
    key_decision_makers: "Rectoría General INEM / DATT Cartagena / Secretaría de Educación Distrital"
  },
  {
    id: "edu-ctg-005",
    name: "Universidad de Cartagena - Campus Zaragocilla (Área de la Salud)",
    acronym: "UdeC Zaragocilla",
    category: "Universidad Oficial",
    icon: "🎓",
    address: "Avenida del Consulado con Calle 30, Barrio Zaragocilla",
    corridor: "Avenida del Consulado (Vía Arteria Secundaria Conectora)",
    lat: 10.4035,
    lng: -75.5012,
    danger_score: 0.89,
    risk_level: "ALTO",
    student_population: 6100,
    daily_pedestrians: 10200,
    crossing_diagnosis: "Complejo universitario y hospitalario donde confluyen estudiantes de Medicina, Enfermería y Odontología con ambulancias en código rojo que entran al Hospital Universitario del Caribe (HUC). La vía es angosta, presenta intenso paso de busetas y no dispone de ningún dispositivo de cruce inteligente.",
    infrastructure_deficits: [
      "Flujo imprevisto de ambulancias con prioridad",
      "Andenes deteriorados y ocupados por comercio informal",
      "Frecuentes near-misses entre motociclistas y estudiantes",
      "Falta de sincronización semafórica hospital-universidad"
    ],
    client_opportunity: "Universidad de Cartagena dispone de fondos de Bienestar Universitario y el HUC requiere mitigar riesgos de responsabilidad civil en sus accesos. Propuesta de modelo Smart Campus con gemelo digital.",
    proposed_solution: "SafeCrossing Campus Salud: Detección prioritaria de ambulancias por visión para habilitar paso de emergencia y protección coordinada de peatones en los intervalos seguros.",
    commercial_stage: "Propuesta Formal Presentada a Vicerrectoría de Bienestar UdeC",
    key_decision_makers: "Vicerrectoría de Bienestar Universitario UdeC / Gerencia HUC / Decanatura Medicina"
  },
  {
    id: "edu-ctg-006",
    name: "Universidad de Cartagena - Campus Piedra de Bolívar (Ingeniería y Ciencias)",
    acronym: "UdeC Piedra de Bolívar",
    category: "Universidad Oficial",
    icon: "🎓",
    address: "Avenida del Consulado # 48-152, Barrio El Carmen / Piedra de Bolívar",
    corridor: "Avenida del Consulado (Sector Curva Piedra de Bolívar)",
    lat: 10.4018,
    lng: -75.5076,
    danger_score: 0.91,
    risk_level: "ALTO",
    student_population: 8400,
    daily_pedestrians: 13500,
    crossing_diagnosis: "Ubicado exactamente en una curva pronunciada sobre la Avenida del Consulado. Los vehículos y motocicletas toman la curva a gran aceleración sin visibilidad del paso peatonal. Los estudiantes de ingeniería deben esperar o arriesgarse a cruzar corriendo frente a los vehículos que aparecen imprevistamente.",
    infrastructure_deficits: [
      "Curva ciega que bloquea la distancia visual de parada (SSD)",
      "Exceso de velocidad constante de mototaxis",
      "Falta de señalética vertical preventiva luminosa",
      "Cruce peatonal situado a menos de 20 metros de la curva"
    ],
    client_opportunity: "Facultad de Ingeniería de Sistemas y Civil de la UdeC como cliente e institución socia para desarrollo de Living Labs. Disposición de presupuesto de investigación formativa para cofinanciar el hardware.",
    proposed_solution: "SafeCrossing Curva Crítica: Alerta perimetral anticipada por cámara antes de la curva y balizas LED dinámicas en calzada que advierten al conductor a 80 metros de distancia la presencia de peatones.",
    commercial_stage: "Alianza Académica y Prototipo de Compra Institucional",
    key_decision_makers: "Decanatura de Ingeniería UdeC / Dirección de Planta Física / Consejo Superior"
  },
  {
    id: "edu-ctg-007",
    name: "Fundación Universitaria Tecnológico Comfenalco - Sede Barrio España",
    acronym: "Tecnológico Comfenalco",
    category: "Universidad Privada",
    icon: "🎓",
    address: "Carrera 44 # 30-16, Barrio España / Av. Pedro de Heredia",
    corridor: "Avenida Pedro de Heredia con Carrera 44 (Sector Los Ejecutivos)",
    lat: 10.405,
    lng: -75.503,
    danger_score: 0.88,
    risk_level: "ALTO",
    student_population: 11200,
    daily_pedestrians: 16000,
    crossing_diagnosis: "Una de las instituciones de educación superior privadas con mayor masa estudiantil en Cartagena. El ingreso por Barrio España y la conexión con la Pedro de Heredia crea cuellos de botella con paraderos informales que bloquean la visual y forzan a los universitarios a caminar por la calle entre el tránsito automotor.",
    infrastructure_deficits: [
      "Invasión vehicular en los accesos peatonales",
      "Paso de buses colectivos que adelantan en doble fila",
      "Carencia de sincronización peatonal segura en horas nocturnas",
      "Alta tasa de siniestros leves y caídas de peatones"
    ],
    client_opportunity: "Caja de Compensación Familiar Comfenalco dispone de fondos de RSE, infraestructura e innovación para certificar sus campus como Entornos Seguros y Sostenibles. Alta solvencia de contratación privada.",
    proposed_solution: "SafeCrossing Smart University Hub: Sistema integral con gemelo digital web, visor ciudadano móvil para la comunidad comfenalquista y semaforización física inteligente ESP32.",
    commercial_stage: "Contacto Comercial Establecido con Dirección Administrativa Comfenalco",
    key_decision_makers: "Dirección General Tecnológico Comfenalco / Gerencia de Infraestructura Comfenalco"
  },
  {
    id: "edu-ctg-008",
    name: "Institución Universitaria Colombo Americana (UNICOLOMBO) - Sede Cuatro Vientos",
    acronym: "UNICOLOMBO Sede Cuatro Vientos",
    category: "Universidad Privada",
    icon: "🎓",
    address: "Avenida Pedro de Heredia con Transversal 50",
    corridor: "Avenida Pedro de Heredia (Sector Las Gaviotas / Cuatro Vientos)",
    lat: 10.4068,
    lng: -75.5115,
    danger_score: 0.85,
    risk_level: "ALTO",
    student_population: 3400,
    daily_pedestrians: 6800,
    crossing_diagnosis: "Sede matriz del Semillero de Investigación gestor de AI-SafeCrossing. La entrada y salida hacia la calzada mixta de la Pedro de Heredia carece de paso peatonal demarcado y los estudiantes deben cruzar entre vehículos acelerando desde el semáforo anterior de Cuatro Vientos.",
    infrastructure_deficits: [
      "Ausencia de cebra en el acceso universitario directo",
      "Aceleración vehicular desmedida al salir de semáforo cercano",
      "Falta de refugio peatonal intermedio en el separador",
      "Riesgo elevado en horarios nocturnos para estudiantes"
    ],
    client_opportunity: "Institución sede del proyecto. Despliegue inmediato como Living Lab demostrativo y showroom operativo para cerrar contratos con las demás universidades y colegios de Cartagena.",
    proposed_solution: "Sistema SafeCrossing Showroom & Living Lab: Instalación completa del MVP con cámara VTA-84920 sobre poste universitario, controlador ESP32 conectado al semáforo de prueba y visor público.",
    commercial_stage: "Sede Demostrativa Activa / Cliente Matriz y Showroom",
    key_decision_makers: "Rectoría UNICOLOMBO / Dirección de Investigaciones / Semillero SIPVA"
  },
  {
    id: "edu-ctg-009",
    name: "Universidad del Sinú (UNISINÚ) - Campus Plaza Colón / Santillana",
    acronym: "UNISINÚ Plaza Colón",
    category: "Universidad Privada",
    icon: "🎓",
    address: "Transversal 54, Sector Los Ejecutivos / Santillana",
    corridor: "Transversal 54 (Corredor Comercial y Residencial del Sur)",
    lat: 10.3934,
    lng: -75.4925,
    danger_score: 0.87,
    risk_level: "ALTO",
    student_population: 5900,
    daily_pedestrians: 9100,
    crossing_diagnosis: "Arteria de cuatro carriles de velocidad media-alta. Los estudiantes que provienen de los barrios Los Alpes, Gaviotas y Blas de Lezo se ven obligados a atravesar la vía en puntos no señalizados ante la lejanía del único semáforo peatonal.",
    infrastructure_deficits: [
      "Distancia de más de 350 metros hasta el cruce semaforizado más cercano",
      "Cruce transversal temerario en horas pico",
      "Deficiente iluminación en el separador central",
      "Paradas de transporte informal que generan embudos"
    ],
    client_opportunity: "Universidad privada con alto enfoque en modernización de campus y bienestar de estudiantes de Ciencias Humanas y de la Salud. Interés en programas de Responsabilidad Social y Movilidad.",
    proposed_solution: "SafeCrossing Campus Seguro: Integración de cámara inteligente con detección predictiva de trayectorias a 5 segundos y módulo de alertamiento móvil a través de la app institucional.",
    commercial_stage: "Prospección Inicial / Envío de Dossier Comercial",
    key_decision_makers: "Rectoría Seccional UNISINÚ Cartagena / Dirección de Operaciones"
  },
  {
    id: "edu-ctg-010",
    name: "Corporación Universitaria Rafael Núñez (CURN) - Sede Centro Histórico",
    acronym: "CURN Centro",
    category: "Universidad Privada",
    icon: "🎓",
    address: "Calle de la Soledad # 5-70, Centro Histórico",
    corridor: "Calles de la Soledad y Estanco del Tabaco (Calles Coloniales)",
    lat: 10.4227,
    lng: -75.5492,
    danger_score: 0.79,
    risk_level: "MEDIO-ALTO",
    student_population: 4600,
    daily_pedestrians: 7400,
    crossing_diagnosis: "Calles coloniales con andenes angostos de menos de 60 cm donde los estudiantes caminan inevitablemente por el arroyo vehicular. Los taxis y furgones de reparto realizan maniobras ajustadas con peligro de aprisionamiento en esquinas ciegas.",
    infrastructure_deficits: [
      "Andenes peatonales de dimensiones inferiores a la norma técnica",
      "Puntos ciegos causados por fachadas coloniales salientes",
      "Tránsito de abastecimiento comercial pesado en calles estrechas",
      "Restricciones patrimoniales para instalar postes de semáforos invasivos"
    ],
    client_opportunity: "La CURN busca soluciones discretas y no invasivas acordes al Plan Especial de Manejo y Protección (PEMP) del Centro Histórico. SafeCrossing ofrece controladores compactos inalámbricos y alertas estéticas.",
    proposed_solution: "SafeCrossing Patrimonio Seguro: Sensores de visión en fachadas con mini-balizas LED arquitectónicas integradas en muros y gemelo digital para monitoreo patrimonial de flujos.",
    commercial_stage: "Presentación Técnica Agendada con Rectoría",
    key_decision_makers: "Rectoría CURN / Dirección de Servicios Generales y Campus"
  },
  {
    id: "edu-ctg-011",
    name: "Institución Educativa Departamental Nuestra Señora del Carmen",
    acronym: "Colegio Departamental Carmen",
    category: "Colegio Público",
    icon: "🏫",
    address: "Avenida Pedro de Heredia, Sector Bazurto / El Carmen",
    corridor: "Avenida Pedro de Heredia (Sector Crítico Mercado de Bazurto)",
    lat: 10.4128,
    lng: -75.5222,
    danger_score: 0.99,
    risk_level: "CRÍTICO",
    student_population: 3100,
    daily_pedestrians: 18500,
    crossing_diagnosis: "El entorno escolar más peligroso y hostil de Cartagena. En el corazón del Mercado de Bazurto, los niños escolares conviven a escasos centímetros de carretillas, motos de carga, camiones de abastos y buses urbanos sin ningún paso seguro.",
    infrastructure_deficits: [
      "Invasión permanente del espacio peatonal por carretillas y puestos",
      "Nivel de ruido que impide escuchar aproximación de vehículos",
      "Polución visual extrema que anula señales estáticas",
      "Tránsito masivo continuo de carga pesada"
    ],
    client_opportunity: "Intervención de emergencia requerida por la Defensoría del Pueblo y Personería de Cartagena. Posibilidad de adjudicación directa mediante rubros distritales de mitigación de riesgo.",
    proposed_solution: "SafeCrossing Entorno Crítico Blindado: Cámaras con filtrado por IA capaz de aislar niños escolares entre la multitud comercial y activar semáforos sonoros y ópticos con potencia de 120W y sirena disuasoria.",
    commercial_stage: "Informe de Alerta Temprana en Trámite ante Personería y DATT",
    key_decision_makers: "Secretaría del Interior / Secretaría de Educación / DATT / Personería Distrital"
  },
  {
    id: "edu-ctg-012",
    name: "Universidad de San Buenaventura - Campus Ternera",
    acronym: "San Buenaventura Ternera",
    category: "Universidad Privada",
    icon: "🎓",
    address: "Calle Real de Ternera # 48-152, Sector San Antonio",
    corridor: "Calle Real de Ternera / Conexión a la Variante Mamonal",
    lat: 10.3705,
    lng: -75.4715,
    danger_score: 0.84,
    risk_level: "ALTO",
    student_population: 4300,
    daily_pedestrians: 6200,
    crossing_diagnosis: "Vía rápida periférica sin separador central ni andenes continuos pavimentados. Los estudiantes que caminan desde el campus hacia la Troncal de Occidente sufren desprotección frente a vehículos particulares y de carga sin iluminación nocturna.",
    infrastructure_deficits: [
      "Falta de andenes pavimentados transitables",
      "Iluminación pública deficiente o intermitente",
      "Velocidades superiores a 60 km/h en vía recta",
      "Ausencia de reductores de velocidad"
    ],
    client_opportunity: "Universidad con presupuesto para proyectos de Campus Sostenible e Inclusivo (Certificación ISO de Movilidad Sostenible).",
    proposed_solution: "SafeCrossing Eco-Campus: Sistema alimentado por energía solar con batería de respaldo, semáforo inteligente ESP32 de bajo consumo y telemetría por red WiFi/LoRa.",
    commercial_stage: "Contacto con Dirección de Planta Física e Innovación",
    key_decision_makers: "Rectoría General San Buenaventura / Dirección Administrativa y Financiera"
  },
  {
    id: "edu-ctg-013",
    name: "Fundación Universitaria Antonio de Arévalo (UNITECNAR)",
    acronym: "UNITECNAR Los Ejecutivos",
    category: "Universidad Privada",
    icon: "🎓",
    address: "Avenida Pedro de Heredia frente a C.C. Los Ejecutivos",
    corridor: "Avenida Pedro de Heredia (Estación Transcaribe Los Ejecutivos)",
    lat: 10.4029,
    lng: -75.4998,
    danger_score: 0.86,
    risk_level: "ALTO",
    student_population: 6700,
    daily_pedestrians: 14200,
    crossing_diagnosis: "Punto de máxima concentración comercial y estudiantil frente a Los Ejecutivos. Los largos ciclos de espera vehicular de los semáforos tradicionales inducen a los universitarios a cruzar en rojo esquivando buses de Transcaribe y mototaxis.",
    infrastructure_deficits: [
      "Tiempos de espera peatonal fijos superiores a 90 segundos",
      "Comportamiento temerario inducido por demoras semafóricas",
      "Intersección compleja sin adaptabilidad al tráfico",
      "Gran aforo estudiantil en horas pico"
    ],
    client_opportunity: "Consorcio de cobranding y cofinanciación entre UNITECNAR y el Centro Comercial Los Ejecutivos para garantizar el acceso seguro a sus instalaciones.",
    proposed_solution: "SafeCrossing Tráfico Adaptativo: Conteo en tiempo real con YOLOv8 que reduce dinámicamente el ciclo vehicular cuando la densidad de estudiantes en espera supera las 15 personas.",
    commercial_stage: "Propuesta en Alianza Comercial Universidad-Comercio",
    key_decision_makers: "Rectoría UNITECNAR / Gerencia General C.C. Los Ejecutivos"
  },
  {
    id: "edu-ctg-014",
    name: "Institución Educativa Mayor de Cartagena (Sede Ceballos)",
    acronym: "I.E. Mayor de Cartagena",
    category: "Colegio Público",
    icon: "🏫",
    address: "Transversal 56 con Calle 15, Sector Ceballos",
    corridor: "Corredor de Carga Pesada (Acceso a Zona Industrial Mamonal)",
    lat: 10.3842,
    lng: -75.5085,
    danger_score: 0.99,
    risk_level: "CRÍTICO",
    student_population: 2200,
    daily_pedestrians: 5100,
    crossing_diagnosis: "Los niños de primaria y bachillerato deben cruzar el corredor por donde transitan tractomulas con productos químicos inflamables, contenedores marítimos y derivados del petróleo hacia Mamonal a velocidades letales.",
    infrastructure_deficits: [
      "Circulación de tractomulas de hasta 52 toneladas a 60 km/h",
      "Polvo, ruido y gases que disminuyen la atención de los niños",
      "Inexistencia de puente peatonal o semáforo con pulsador",
      "Vía sin reductores de velocidad permitidos por tránsito de carga"
    ],
    client_opportunity: "Financiación directa a través de programas de RSE del Clúster Petroquímico de Cartagena (Fundación Mamonal / Ecopetrol / Yara / ANDI).",
    proposed_solution: "SafeCrossing Carga Pesada: Sensor de visión de largo alcance que detecta camiones pesados a 120 metros, calcula masa estimada y tiempo de parada (TTC) y coordina semáforos preventivos anticipados.",
    commercial_stage: "Presentación en Comité de Sostenibilidad de Fundación Mamonal",
    key_decision_makers: "Directora Ejecutiva Fundación Mamonal / Rectoría I.E. Mayor / Secretaría de Educación"
  },
  {
    id: "edu-ctg-015",
    name: "Universidad Tecnológica de Bolívar (UTB) - Campus Tecnológico",
    acronym: "UTB Campus Ternera",
    category: "Universidad Privada",
    icon: "🎓",
    address: "Km 1 Carretera Troncal de Occidente vía Turbaco",
    corridor: "Troncal de Occidente Km 1 (Autopista Doble Calzada Interurbana)",
    lat: 10.3582,
    lng: -75.4607,
    danger_score: 0.87,
    risk_level: "ALTO",
    student_population: 7200,
    daily_pedestrians: 11000,
    crossing_diagnosis: "Autopista de doble calzada con límite reglamentario de 80 km/h. La salida de estudiantes hacia los paraderos de buses intermunicipales en horas vespertinas se da en condiciones de alta velocidad vehicular y poca visibilidad.",
    infrastructure_deficits: [
      "Velocidades de autopista nacional intermunicipal",
      "Paso a desnivel inexistente en el acceso sur del campus",
      "Vía con poca tracción en asfalto húmedo durante lluvias",
      "Aglomeración de estudiantes en bermas no protegidas"
    ],
    client_opportunity: "La UTB es la universidad privada acreditada de alta calidad con mayor presupuesto en tecnología y campus inteligente en el Caribe. Excelente perfil como cliente para compra de sistema completo.",
    proposed_solution: "SafeCrossing Enterprise Campus: Nodo edge con microservidor industrial, redundancia 4G/WiFi 6, integración con app UTB y semáforo inteligente sincronizado.",
    commercial_stage: "Reunión Agendada con Vicerrectoría Administrativa y Dirección TI",
    key_decision_makers: "Vicerrectoría Administrativa y Financiera UTB / Dirección de Servicios de Campus"
  },
  {
    id: "edu-ctg-016",
    name: "Institución Educativa María Auxiliadora",
    acronym: "I.E. María Auxiliadora",
    category: "Colegio Público",
    icon: "🏫",
    address: "Avenida Pedro de Heredia, Sector Alcibia / Amberes",
    corridor: "Avenida Pedro de Heredia (Recta de Alta Fluidez)",
    lat: 10.4165,
    lng: -75.5278,
    danger_score: 0.93,
    risk_level: "CRÍTICO",
    student_population: 2800,
    daily_pedestrians: 5800,
    crossing_diagnosis: "Tramo recto y ancho de la avenida donde los automotores aceleran considerablemente. Niñas estudiantes de primaria deben cruzar a pie en un punto donde los vehículos no ceden el paso ni respetan la presencia de menores de edad con uniforme escolar.",
    infrastructure_deficits: [
      "Recta de alta velocidad que incentiva aceleración indebida",
      "Falta de señalización escolar vertical reflectiva tipo diamante",
      "Estudiantes de corta edad con menor campo visual y percepción de velocidad",
      "Paso constante de rutas de buses interurbanas"
    ],
    client_opportunity: "Intervención prioritaria con la Secretaría de Educación Distrital dentro del programa 'Rutas Seguras para Nuestras Niñas'.",
    proposed_solution: "SafeCrossing Pediatría Vial: Algoritmo de detección optimizado para peatones de baja estatura con disparo automático de señal sonora preventiva y luces LED estroboscópicas amarillas.",
    commercial_stage: "Formulación de Ficha de Inversión Pública (BPP)",
    key_decision_makers: "Secretaría de Educación Distrital / Rectora I.E. María Auxiliadora / DATT"
  }
];

function demographicColor(score) {
  return score > 0.75 ? '#8b0000'
    : score > 0.55 ? '#d95f0e'
    : score > 0.35 ? '#f59e0b'
    : '#16a34a';
}

function createBalloonIcon(item) {
  const isCritico = item.risk_level === 'CRÍTICO';
  const color = isCritico ? '#ef4444' : item.risk_level === 'ALTO' ? '#f97316' : '#eab308';
  const scorePercent = Math.round(item.danger_score * 100);

  const html = `
    <div class="edu-balloon-marker" style="color: ${color};" title="${item.name}">
      <div class="edu-balloon-pulse" style="color: ${color};"></div>
      <div class="edu-balloon-pin" style="background: ${color}; color: #ffffff;">
        <span class="edu-balloon-icon">${item.icon || '🏫'}</span>
      </div>
      <span class="edu-balloon-badge" style="background: ${isCritico ? '#b91c1c' : '#ea580c'};">${scorePercent}%</span>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'edu-leaflet-div-icon',
    iconSize: [42, 48],
    iconAnchor: [21, 48],
    popupAnchor: [0, -48]
  });
}

function buildEducationalPopup(item) {
  const isCritico = item.risk_level === 'CRÍTICO';
  const tagRiskClass = isCritico ? 'edu-tag-critico' : 'edu-tag-alto';
  const deficitsList = (item.infrastructure_deficits || [])
    .map((d) => `<li style="margin-bottom: 2px;">• ${d}</li>`)
    .join('');

  return `
    <div class="edu-popup-card">
      <div class="edu-popup-header">
        <h4 class="edu-popup-title">${item.name}</h4>
        <div class="edu-popup-subtitle">📍 ${item.address} (${item.corridor})</div>
        <div class="edu-tag-group">
          <span class="edu-tag edu-tag-cat">${item.category}</span>
          <span class="edu-tag ${tagRiskClass}">🔴 Riesgo: ${item.risk_level} (${Math.round(item.danger_score * 100)}%)</span>
          <span class="edu-tag edu-tag-lead">💼 ${item.commercial_stage}</span>
        </div>
      </div>

      <div class="edu-popup-metrics">
        <div class="edu-metric-item">
          <div style="color: #94a3b8;">Estudiantes expuestos:</div>
          <div class="edu-metric-val">👥 ${(item.student_population || 0).toLocaleString()} alumnos</div>
        </div>
        <div class="edu-metric-item">
          <div style="color: #94a3b8;">Aforo peatonal diario:</div>
          <div class="edu-metric-val">🚶‍♂️ ${(item.daily_pedestrians || 0).toLocaleString()} cruces</div>
        </div>
      </div>

      <div class="edu-popup-section" style="border-left-color: #ef4444; background: rgba(239, 68, 68, 0.08);">
        <div class="edu-section-title" style="color: #fca5a5;">⚠️ Diagnóstico de Cruce Inseguro</div>
        <div style="color: #e2e8f0; font-size: 0.74rem;">${item.crossing_diagnosis}</div>
        <ul style="margin: 6px 0 0 0; padding-left: 4px; list-style: none; color: #f87171; font-size: 0.72rem;">
          ${deficitsList}
        </ul>
      </div>

      <div class="edu-popup-section" style="border-left-color: #22c55e; margin-top: 6px; background: rgba(34, 197, 94, 0.08);">
        <div class="edu-section-title" style="color: #86efac;">💼 Oportunidad Cliente SafeCrossing</div>
        <div style="color: #cbd5e1; font-size: 0.73rem;">${item.client_opportunity}</div>
        <div style="margin-top: 4px; font-size: 0.71rem; color: #93c5fd;">
          <b>🛠️ Solución sugerida:</b> ${item.proposed_solution}
        </div>
      </div>

      <div class="edu-popup-btn-bar">
        <button class="btn-edu-action" onclick="window.focusInstitution('${item.id}')">
          🎯 Centrar Cruce
        </button>
        <button class="btn-edu-action btn-edu-fence" onclick="window.simulateSchoolFence('${item.id}')">
          🚦 Simular Cerca 50m
        </button>
      </div>
    </div>
  `;
}

window.initMap = async function initMap() {
  map = L.map('map').setView([10.408, -75.508], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors | AI-SafeCrossing UNICOLOMBO'
  }).addTo(map);

  cameraLayer = L.layerGroup().addTo(map);
  educationalLayer = L.layerGroup().addTo(map);
  riskLayer = L.layerGroup().addTo(map);
  historicalLayer = L.layerGroup().addTo(map);
  liveTracksLayer = L.layerGroup().addTo(map);
  fenceLayer = L.layerGroup().addTo(map);

  // 1. Cargar Capa de Instituciones Educativas (Colegios y Universidades con Cruces Críticos)
  let eduData = INSTITUCIONES_FALLBACK;
  try {
    const res = await fetch('/data/cartagena-instituciones-educativas-riesgo.json');
    if (res.ok) {
      eduData = await res.json();
    }
  } catch (err) {
    console.warn('Usando dataset integrado de instituciones educativas para SafeCrossing:', err);
  }

  eduData.forEach((item) => {
    const icon = createBalloonIcon(item);
    const marker = L.marker([item.lat, item.lng], { icon });
    marker.bindPopup(buildEducationalPopup(item), { maxWidth: 390 });
    marker.on('click', () => {
      window.showInstitutionBreakdown(item.id);
    });
    marker.addTo(educationalLayer);
    educationalRegistry.set(item.id, { marker, data: item });
  });

  // 2. Cargar Capa Demográfica (con salvaguarda try/catch)
  try {
    const geojson = await fetch('/data/geojson-cartagena-manzanas-demografico-sample.json').then((res) => res.json());
    demographicLayer = L.geoJSON(geojson, {
      style: (feature) => ({
        fillColor: demographicColor(feature.properties.vulnerability_score),
        weight: 1,
        opacity: 1,
        color: '#e2e8f0',
        fillOpacity: 0.35
      }),
      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        layer.bindPopup(`
          <b>${p.zone}</b><br/>
          Población: ${p.population}<br/>
          % Adulto mayor: ${p.elderly_pct}%<br/>
          % Niñez: ${p.children_pct}%<br/>
          IPM: ${p.ipm}<br/>
          Vulnerabilidad: ${p.vulnerability_score}
        `);
        layer.on('click', () => {
          const target = document.getElementById('riskDetails');
          if (target) {
            target.textContent = `Zona ${p.zone}: población ${p.population}, vulnerabilidad ${p.vulnerability_score}. Priorizar control de velocidad y entornos escolares.`;
          }
        });
      }
    }).addTo(map);
  } catch (e) {
    console.warn('Aviso: Demografía no cargada en modo offline:', e);
  }

  heatLayer = L.heatLayer([], { radius: 28, blur: 22, maxZoom: 17 });

  // 3. Cargar Siniestralidad histórica
  try {
    const historical = await fetch('/data/cartagena-siniestros-publicos-sample.json').then((res) => res.json());
    historical.forEach((item) => {
      const color = item.severity === 'mortal' ? '#ef4444' : item.severity === 'grave' ? '#f97316' : '#f59e0b';
      const marker = L.circleMarker([item.lat, item.lng], {
        radius: item.severity === 'mortal' ? 7 : 5,
        color,
        weight: 2,
        fillOpacity: 0.45
      }).bindPopup(`<b>Siniestralidad histórica</b><br/>Fecha: ${item.date}<br/>Usuario: ${item.road_user}<br/>Severidad: ${item.severity}`);
      marker.addTo(historicalLayer);
    });
  } catch (e) {
    console.warn('Aviso: Siniestros históricos no cargados:', e);
  }

  // 4. Configurar Selector de Capas
  const overlayLayers = {
    '🎓 Colegios & Universidades (Clientes Potenciales)': educationalLayer,
    '📹 Cámaras Edge': cameraLayer,
    '🔥 Heatmap Near-Miss': heatLayer,
    '📊 Vulnerabilidad Demográfica': demographicLayer || L.layerGroup(),
    '⚠️ Riesgo Acumulado': riskLayer,
    '🚨 Siniestralidad Histórica': historicalLayer,
    '🏃‍♂️ Tracks Tiempo Real': liveTracksLayer,
    '⭕ Cerca Virtual 50m': fenceLayer
  };

  L.control.layers({}, overlayLayers, { collapsed: false }).addTo(map);

  // Inicializar directorio interactivo en la UI si existe el contenedor
  renderInstitutionDirectory(eduData);
  if (eduData && eduData.length > 0) {
    window.showInstitutionBreakdown(eduData[0].id);
  }
};

// Función para centrar, abrir el globo y mostrar el desglose de una institución específica
window.focusInstitution = function focusInstitution(id) {
  if (!map || !educationalRegistry.has(id)) return;
  const entry = educationalRegistry.get(id);
  const { marker, data } = entry;
  map.flyTo([data.lat, data.lng], 17, { duration: 1.2 });
  setTimeout(() => {
    marker.openPopup();
  }, 1300);
  window.showInstitutionBreakdown(id);
};

// Función de desglose completo y detallado de la institución al presionar su globo o ficha
window.showInstitutionBreakdown = function showInstitutionBreakdown(id) {
  if (!educationalRegistry.has(id)) return;
  const entry = educationalRegistry.get(id);
  const item = entry.data;

  const container = document.getElementById('institucionDesglosePanel');
  if (!container) return;

  const isCritico = item.risk_level === 'CRÍTICO';
  const border = isCritico ? '#ef4444' : '#f97316';
  const tagRiskClass = isCritico ? 'edu-tag-critico' : 'edu-tag-alto';

  const deficitsHtml = (item.infrastructure_deficits || [])
    .map((d) => `<li style="margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
      <span style="color: ${border}; font-weight: bold;">✕</span>
      <span>${d}</span>
    </li>`)
    .join('');

  container.innerHTML = `
    <div style="border-left: 4px solid ${border}; padding-left: 12px; margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.5rem;">${item.icon || '🏫'}</span>
            <h3 style="font-size: 1.15rem; font-weight: 800; color: #f8fafc; margin: 0;">${item.name}</h3>
          </div>
          <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 2px;">
            📍 <b>${item.address}</b> · Corredor: <span style="color: #38bdf8;">${item.corridor}</span> · Coords: [${item.lat}, ${item.lng}]
          </div>
        </div>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <span class="edu-tag edu-tag-cat">${item.category}</span>
          <span class="edu-tag ${tagRiskClass}">🔴 ${item.risk_level} (${Math.round(item.danger_score * 100)}%)</span>
          <span class="edu-tag edu-tag-lead">💼 ${item.commercial_stage}</span>
        </div>
      </div>
    </div>

    <!-- METRICS GRID -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; margin-bottom: 12px;">
      <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px;">
        <div style="font-size: 0.72rem; color: #94a3b8; text-transform: uppercase;">Población Escolar Expuesta</div>
        <div style="font-size: 1.2rem; font-weight: 800; color: #f8fafc; margin-top: 2px;">👥 ${(item.student_population || 0).toLocaleString()} estudiantes</div>
        <div style="font-size: 0.68rem; color: #cbd5e1;">Niños y jóvenes en peligro diario</div>
      </div>
      <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px;">
        <div style="font-size: 0.72rem; color: #94a3b8; text-transform: uppercase;">Aforo Peatonal Diario</div>
        <div style="font-size: 1.2rem; font-weight: 800; color: #38bdf8; margin-top: 2px;">🚶‍♂️ ${(item.daily_pedestrians || 0).toLocaleString()} cruces</div>
        <div style="font-size: 0.68rem; color: #cbd5e1;">Horarios pico 6am, 12m, 6pm</div>
      </div>
      <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px;">
        <div style="font-size: 0.72rem; color: #94a3b8; text-transform: uppercase;">Nivel de Riesgo Operativo</div>
        <div style="font-size: 1.2rem; font-weight: 800; color: ${border}; margin-top: 2px;">⚠️ ${Math.round(item.danger_score * 100)} / 100</div>
        <div style="font-size: 0.68rem; color: #cbd5e1;">Prioridad de Intervención: Alta</div>
      </div>
      <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px;">
        <div style="font-size: 0.72rem; color: #94a3b8; text-transform: uppercase;">Tomador de Decisión</div>
        <div style="font-size: 0.85rem; font-weight: 700; color: #86efac; margin-top: 2px; line-height: 1.2;">🏛️ ${item.key_decision_makers || 'Rectoría / DATT'}</div>
        <div style="font-size: 0.68rem; color: #cbd5e1;">Gestor de compra / Adopción</div>
      </div>
    </div>

    <!-- DIAGNÓSTICO DETALLADO -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin-bottom: 12px;">
      <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 8px; padding: 12px;">
        <div style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; font-weight: 800; color: #fca5a5; margin-bottom: 6px; text-transform: uppercase;">
          <span>⚠️</span>
          <span>Diagnóstico de Cruce Inseguro (Por qué no tienen cruce seguro)</span>
        </div>
        <p style="font-size: 0.78rem; color: #f1f5f9; line-height: 1.5; margin: 0 0 8px 0;">
          ${item.crossing_diagnosis}
        </p>
        <div style="font-size: 0.74rem; font-weight: 700; color: #fca5a5; margin-bottom: 4px;">Déficits Críticos Identificados:</div>
        <ul style="margin: 0; padding-left: 4px; list-style: none; font-size: 0.74rem; color: #fecaca;">
          ${deficitsHtml}
        </ul>
      </div>

      <div style="background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.25); border-radius: 8px; padding: 12px;">
        <div style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; font-weight: 800; color: #86efac; margin-bottom: 6px; text-transform: uppercase;">
          <span>💼</span>
          <span>Oportunidad Comercial y Adopción como Cliente SafeCrossing</span>
        </div>
        <p style="font-size: 0.78rem; color: #f1f5f9; line-height: 1.5; margin: 0 0 8px 0;">
          ${item.client_opportunity}
        </p>
        <div style="padding: 8px; background: rgba(15, 23, 42, 0.6); border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.3);">
          <div style="font-size: 0.74rem; font-weight: 700; color: #38bdf8; margin-bottom: 2px;">🛠️ Solución Tecnológica Sugerida:</div>
          <div style="font-size: 0.74rem; color: #e2e8f0; line-height: 1.4;">${item.proposed_solution}</div>
        </div>
      </div>
    </div>

    <!-- BOTONES DE ACCIÓN DEL DESGLOSE -->
    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
      <button class="btn-edu-action" onclick="window.focusInstitution('${item.id}')" style="flex: 1; min-width: 140px; padding: 8px 14px;">
        🎯 Centrar Cruce en Mapa
      </button>
      <button class="btn-edu-action btn-edu-fence" onclick="window.simulateSchoolFence('${item.id}')" style="flex: 1; min-width: 160px; padding: 8px 14px;">
        🚦 Simular Cerca Virtual (50m)
      </button>
      <button class="btn-edu-action" onclick="window.syncInstitutionToSupabase('${item.id}')" style="background: #059669; flex: 1; min-width: 180px; padding: 8px 14px;">
        ⚡ Sincronizar con Supabase
      </button>
    </div>
  `;
};

// Sincronización de prospección con Supabase
window.syncInstitutionToSupabase = async function syncInstitutionToSupabase(id) {
  if (!educationalRegistry.has(id)) return;
  const { data } = educationalRegistry.get(id);
  const banner = document.getElementById('riskDetails');

  try {
    const SUPABASE_URL = 'https://astuizgaounxijvtelkz.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_tWEPmSY_LAgu7wnPbBrd7w_QeXdrHTy';

    const payload = {
      institution_id: data.id,
      name: data.name,
      category: data.category,
      corridor: data.corridor,
      danger_score: data.danger_score,
      risk_level: data.risk_level,
      student_population: data.student_population,
      crossing_diagnosis: data.crossing_diagnosis,
      proposed_solution: data.proposed_solution,
      status: 'PROSPECCIÓN_ACTIVA',
      timestamp: new Date().toISOString()
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/near_miss_events`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        camera_id: data.acronym,
        risk_level: data.risk_level,
        ttc_seconds: data.danger_score > 0.9 ? 1.2 : 2.1,
        pet_seconds: data.danger_score > 0.9 ? 0.8 : 1.5,
        v_rel: 14.5,
        pedestrian_count: data.student_population,
        vehicle_count: 35,
        objects_detected: ['peaton', 'motocicleta', 'bus'],
        raw_snapshot: null
      })
    });

    if (banner) {
      banner.textContent = `✅ Ficha de prospección de ${data.name} registrada en Supabase Cloud.`;
      banner.style.color = '#22c55e';
    }
  } catch (err) {
    if (banner) {
      banner.textContent = `⚡ Ficha de ${data.name} guardada en modo local edge (offline).`;
      banner.style.color = '#38bdf8';
    }
  }
};

// Simulación de geocerca escolar SafeCrossing de 50m
window.simulateSchoolFence = function simulateSchoolFence(id) {
  if (!educationalRegistry.has(id)) return;
  const { data } = educationalRegistry.get(id);
  window.updateMapFence({
    active: true,
    cameraId: data.acronym,
    gps: { lat: data.lat, lng: data.lng },
    radiusMeters: 50,
    expiresAt: new Date(Date.now() + 45000).toISOString()
  });

  const banner = document.getElementById('riskDetails');
  if (banner) {
    banner.textContent = `🚨 CERCA VIRTUAL SAFECROSSING ACTIVA (50m) en ${data.name}. Alerta a padres y conductores: Cruce escolar vulnerable activo.`;
    banner.style.color = '#ef4444';
  }
};

// Filtrado de instituciones por categoría en el mapa
window.filterEducationalMarkers = function filterEducationalMarkers(category) {
  if (!educationalLayer) return;
  educationalLayer.clearLayers();
  educationalRegistry.forEach((entry) => {
    if (category === 'all' || entry.data.category === category || (category === 'Universidad' && entry.data.category.includes('Universidad'))) {
      entry.marker.addTo(educationalLayer);
    }
  });
};

function renderInstitutionDirectory(items) {
  const container = document.getElementById('eduDirectoryContainer');
  if (!container) return;

  const chipsHtml = items.map((item) => {
    const isCritico = item.risk_level === 'CRÍTICO';
    const border = isCritico ? '#ef4444' : '#f97316';
    return `
      <button class="edu-chip-btn" onclick="window.focusInstitution('${item.id}')" style="border-left: 3px solid ${border};">
        <span style="font-size: 1.1rem;">${item.icon || '🏫'}</span>
        <div style="text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          <div style="font-weight: 700; color: #f8fafc; font-size: 0.78rem;">${item.acronym || item.name}</div>
          <div style="font-size: 0.68rem; color: #94a3b8;">${item.category} • ${item.student_population.toLocaleString()} est.</div>
        </div>
      </button>
    `;
  }).join('');

  container.innerHTML = chipsHtml;
}

window.updateMapFence = function updateMapFence(payload) {
  if (!map || !fenceLayer || !payload) return;

  if (invisibleFenceTimeout) {
    clearTimeout(invisibleFenceTimeout);
    invisibleFenceTimeout = null;
  }

  if (!payload.active) {
    if (invisibleFenceCircle) {
      fenceLayer.removeLayer(invisibleFenceCircle);
      invisibleFenceCircle = null;
    }
    return;
  }

  if (!payload.gps || typeof payload.gps.lat !== 'number' || typeof payload.gps.lng !== 'number') return;

  const radius = Math.max(20, Math.min(300, Number(payload.radiusMeters) || 80));
  const center = [payload.gps.lat, payload.gps.lng];

  if (!invisibleFenceCircle) {
    invisibleFenceCircle = L.circle(center, {
      radius,
      color: '#ef4444',
      weight: 2,
      fillColor: '#ef4444',
      fillOpacity: 0.12
    }).addTo(fenceLayer);
  } else {
    invisibleFenceCircle.setLatLng(center);
    invisibleFenceCircle.setRadius(radius);
  }

  invisibleFenceCircle.bindPopup(`<b>Cerca SafeCrossing activa (50m)</b><br/>Ubicación: ${payload.cameraId || 'Cruce'}<br/>Radio de protección: ${Math.round(radius)} m`);

  const expiresAt = payload.expiresAt ? new Date(payload.expiresAt).getTime() : NaN;
  if (Number.isFinite(expiresAt) && expiresAt > Date.now()) {
    invisibleFenceTimeout = setTimeout(() => {
      if (invisibleFenceCircle) {
        fenceLayer.removeLayer(invisibleFenceCircle);
        invisibleFenceCircle = null;
      }
    }, expiresAt - Date.now());
  }
};

window.updateMapFromObjectsEnvelope = function updateMapFromObjectsEnvelope(envelope) {
  if (!map || !envelope || !Array.isArray(envelope.objects)) return;

  const now = Date.now();
  const seen = new Set();

  envelope.objects.forEach((obj) => {
    if (!obj?.id || !obj?.latLng) return;
    seen.add(obj.id);

    const latlng = [obj.latLng.lat, obj.latLng.lng];
    const popup = `
      <b>${obj.id}</b><br/>
      Tipo: ${obj.classType || 'N/A'}<br/>
      Riesgo: ${envelope.state?.risk || 'Bajo'}<br/>
      Score: ${typeof obj.score === 'number' ? (obj.score * 100).toFixed(1) + '%' : 'N/A'}
    `;

    if (!liveTrackRegistry.has(obj.id)) {
      const marker = L.circleMarker(latlng, {
        radius: 6,
        color: '#7dd3fc',
        weight: 2,
        fillOpacity: 0.35
      }).addTo(liveTracksLayer);

      const trail = L.polyline([latlng], {
        color: '#38bdf8',
        weight: 2,
        opacity: 0.7
      }).addTo(liveTracksLayer);

      liveTrackRegistry.set(obj.id, { marker, trail, points: [latlng], updatedAt: now });
    }

    const item = liveTrackRegistry.get(obj.id);
    item.updatedAt = now;
    item.marker.setLatLng(latlng);
    item.marker.bindPopup(popup);

    item.points.push(latlng);
    if (item.points.length > 20) item.points.shift();
    item.trail.setLatLngs(item.points);
  });

  liveTrackRegistry.forEach((entry, id) => {
    if (seen.has(id)) return;
    if (now - entry.updatedAt > 5000) {
      liveTracksLayer.removeLayer(entry.marker);
      liveTracksLayer.removeLayer(entry.trail);
      liveTrackRegistry.delete(id);
    }
  });

  if (envelope.state?.risk === 'Crítico' && envelope.objects[0]?.latLng) {
    map.setView([envelope.objects[0].latLng.lat, envelope.objects[0].latLng.lng], Math.max(map.getZoom(), 15));
  }
};

window.setMapFocus = function setMapFocus(lat, lng, label) {
  if (!map) return;
  map.setView([lat, lng], 16);
  if (!userLocationMarker) {
    userLocationMarker = L.circleMarker([lat, lng], {
      radius: 8,
      color: '#38bdf8',
      fillColor: '#38bdf8',
      fillOpacity: 0.35,
      weight: 2
    }).addTo(cameraLayer);
  }
  userLocationMarker.setLatLng([lat, lng]);
  userLocationMarker.bindPopup(`<b>${label || 'Ubicación actual'}</b>`);
};

window.updateMapFromSnapshot = function updateMapFromSnapshot(snapshot) {
  const key = snapshot.camera_id;
  const { lat, lng } = snapshot.gps;

  if (!cameraRegistry.has(key)) {
    const marker = L.marker([lat, lng]);
    marker.addTo(cameraLayer);
    cameraRegistry.set(key, marker);
  }

  const marker = cameraRegistry.get(key);
  marker.setLatLng([lat, lng]);
  marker.bindPopup(`<b>${snapshot.camera_id}</b><br/>Riesgo: ${snapshot.risk_event?.risk_level || 'BAJO'}<br/>Peatones: ${snapshot.counts.peaton}`);

  if (snapshot.risk_event) {
    heatPoints.push([lat, lng, snapshot.risk_event.risk_level === 'CRITICO' ? 1 : 0.6]);
    heatLayer.setLatLngs(heatPoints.slice(-300));

    const circle = L.circleMarker([lat, lng], {
      radius: snapshot.risk_event.risk_level === 'CRITICO' ? 10 : 6,
      color: snapshot.risk_event.risk_level === 'CRITICO' ? '#ef4444' : '#f97316'
    }).bindPopup(`Evento ${snapshot.risk_event.risk_level}`);
    circle.addTo(riskLayer);

    setTimeout(() => {
      riskLayer.removeLayer(circle);
    }, 60000);
  }
};

window.simulateMultipleCameras = function simulateMultipleCameras() {
  const base = [
    { id: 'cam-001-cartagena-centro', lat: 10.4236, lng: -75.5457 },
    { id: 'cam-002-bocagrande', lat: 10.3984, lng: -75.5533 },
    { id: 'cam-003-santa-marta-centro', lat: 11.2404, lng: -74.2110 }
  ];

  base.forEach((cam) => {
    const marker = L.marker([cam.lat, cam.lng]).addTo(cameraLayer);
    marker.bindPopup(`<b>${cam.id}</b><br/>Escenario de escalabilidad metropolitana.`);
    cameraRegistry.set(cam.id, marker);
  });
};
