# MARCO LEGAL, CONFORMIDAD NORMATIVA Y BLINDAJE JURÍDICO
## AI-SafeCrossing (S.I.P.V.A.) — Plataforma de Seguridad Vial Inteligente

**Proyecto:** AI-SafeCrossing — Sistema Inteligente de Protección Vial Activa (*Edge-to-Cloud*)  
**Entidad / Semillero:** Semillero de Investigación UNICOLOMBO (Cartagena de Indias, Colombia)  
**Clasificación Tecnológica:** Dispositivo Autónomo No Invasivo de Asistencia y Señalización Activa Peatonal  
**Versión:** 2.0-Legal Compliance  
**Fecha:** Noviembre 2026  

---

## 1. DECLARACIÓN DE CONFORMIDAD Y BLINDAJE JURÍDICO

AI-SafeCrossing ha sido concebido, diseñado y calibrado en estricta observancia del ordenamiento jurídico colombiano e internacional. El sistema opera **100% dentro del marco legal vigente**, estructurado bajo el principio de **Seguridad Pasiva y Asistencial No Punitiva**, garantizando que ninguna de sus funcionalidades vulnere derechos fundamentales, normatividad de tránsito, regulaciones de protección de datos personales ni competencias de concesiones de transporte público.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        MAPA DE CONFORMIDAD JURÍDICA INTEGRAL                           │
├─────────────────────────┬─────────────────────────┬────────────────────────────────────┤
│ EJE NORMATIVO           │ LEY / REGULACIÓN        │ MECANISMO DE CUMPLIMIENTO TÉCNICO  │
├─────────────────────────┼─────────────────────────┼────────────────────────────────────┤
│ 1. Protección de Datos  │ Ley Estatutaria 1581/12 │ Arquitectura Edge AI: memoria RAM  │
│    y Habeas Data        │ Decreto 1377/13 (SIC)   │ volátil. Cero biometría facial,    │
│                         │ Circular 002/19 (SIC)   │ cero LPR (placas) y cero video BD. │
├─────────────────────────┼─────────────────────────┼────────────────────────────────────┤
│ 2. Código Nacional de   │ Ley 769 de 2002         │ Prioridad peatonal (Arts. 57 y 58).│
│    Tránsito Terrestre   │ Ley 1811/16 (Bici)      │ Reducción de velocidad en zonas    │
│                         │ Ley 2251/22 (J. Esteban)│ escolares a 30 km/h (Art. 74).     │
├─────────────────────────┼─────────────────────────┼────────────────────────────────────┤
│ 3. Señalización Vial    │ Resolución 1885 de 2015 │ Señalización luminosa intermitente │
│    del MinTransporte    │ (Manual Señalización)   │ ámbar a 50-60 destellos/minuto.    │
│                         │ Capítulos 7 y 8         │ Tiempo de despeje a marcha 0.8 m/s.│
├─────────────────────────┼─────────────────────────┼────────────────────────────────────┤
│ 4. No Invasión de Redes │ Ley 105/93 y régimen de │ Total desconexión física. Cero     │
│    y Concesiones Viales │ concesiones de tránsito │ cables o intervención de armarios  │
│                         │ municipal (DATT)        │ semafóricos. Sincronización óptica.│
├─────────────────────────┼─────────────────────────┼────────────────────────────────────┤
│ 5. Espectro y Redes     │ Resolución 181 de 2019  │ Bandas libres ISM (2.4 GHz) para   │
│    Inalámbricas         │ de la ANE               │ microcontroladores ESP32 (PIRE<100mW)│
├─────────────────────────┼─────────────────────────┼────────────────────────────────────┤
│ 6. Ética en IA y        │ CONPES 3975 de 2019     │ Principios de IA confiable UNESCO: │
│    Gobernanza           │ Directrices UNESCO 2021 │ explicabilidad, no discriminación  │
│                         │ ODS 3, 9 y 11           │ y supervisión humana permanente.   │
├─────────────────────────┼─────────────────────────┼────────────────────────────────────┤
│ 7. Contratación Pública │ Ley 80/93, Ley 1150/07  │ Mínima cuantía y Convenios de CTeI │
│    y Viabilidad B2G     │ Decreto 393/91 (CTeI)   │ con entes territoriales/alcaldías. │
└─────────────────────────┴─────────────────────────┴────────────────────────────────────┘
```

---

## 2. PROTECCIÓN DE DATOS PERSONALES Y PRIVACIDAD (LEY 1581 DE 2012)

### 2.1 Cumplimiento de la Ley Estatutaria 1581 de 2012 y Decreto 1377 de 2013
El tratamiento de información visual en espacios públicos urbanos está regulado en Colombia por la Ley 1581 de 2012 y supervisado por la Delegatura para la Protección de Datos Personales de la Superintendencia de Industria y Comercio (SIC).

AI-SafeCrossing cumple a cabalidad con todos los principios rectores del régimen general de protección de datos:

1. **Principio de Legalidad y Finalidad Legítima:**
   - La captura óptica tiene como **única y exclusiva finalidad** la protección de la vida humana, la prevención de siniestros viales en tiempo real y el modelado cinemático estadístico de cuasi-colisiones (*near-misses*).
   - No persigue fines comerciales, publicitarios ni de monitoreo de conductas privadas.

2. **Principio de Libertad y Proporcionalidad:**
   - El sistema aplica el estándar internacional de **Privacidad por Diseño (*Privacy-by-Design*)** y **Privacidad por Defecto (*Privacy-by-Default*)**.
   - No se capturan más datos de los estrictamente necesarios para calcular la trayectoria y velocidad de los objetos en la calzada.

3. **Inexistencia de Datos Biométricos Sensibles (*Zero Facial Recognition*):**
   - El motor de inferencia neuronal (Ultralytics YOLOv8) está configurado exclusivamente para detección de categorías genéricas de clases viales: `peaton`, `bicicleta`, `motocicleta`, `automovil`, `bus`.
   - **No cuenta con modelos de reconocimiento facial, mapeo de rasgos biométricos ni estimación de identidad.**

4. **Inexistencia de Lectura de Placas Punitivas (*Zero LPR / ANPR*):**
   - El sistema **no ejecuta reconocimiento óptico de caracteres (OCR) sobre placas vehiculares** ni está vinculado a bases de datos de comparendos o RUNT.
   - Su vocación es 100% preventiva y asistencial, no sancionatoria.

5. **Destrucción Inmediata de Fotogramas en Memoria Volátil (*Zero Raw-Video Storage*):**
   - El flujo de video RTSP proveniente de la cámara IP se procesa directamente en la memoria volátil (RAM) del procesador de borde.
   - Tras extraer las coordenadas matemáticas de las cajas delimitadoras (*bounding boxes*) y calcular los vectores cinemáticos ($TTC$ y $PET$), **los fotogramas se sobreescriben y eliminan de inmediato**.
   - No se almacenan grabaciones de video continuo en discos duros locales ni en servidores cloud.

6. **Métricas Cinemáticas Puramente Despersonalizadas:**
   - Los únicos datos registrados en la base de datos de auditoría institucional son variables físicas y numéricas:
     $$\text{Registro} = \{\text{timestamp}, \text{tipo\_actor}, v_{\text{rel}}, \text{TTC}, \text{PET}, \text{severidad\_riesgo}\}$$
   - Ninguno de estos datos permite identificar de forma directa o indirecta a persona natural alguna.

---

## 3. CÓDIGO NACIONAL DE TRÁNSITO Y ENFOQUE "SISTEMA SEGURO"

### 3.1 Ley 769 de 2002 (Código Nacional de Tránsito Terrestre)
AI-SafeCrossing opera como una herramienta tecnológica al servicio del cumplimiento efectivo de las disposiciones de protección a los actores vulnerables consagradas en la Ley 769 de 2002:

* **Artículo 57 (Circulación Peatonal):** El sistema resguarda las zonas delimitadas para el paso seguro de peatones (cebras y cruces peatonales), garantizando que el usuario vulnerable cuente con advertencia activa durante su trayectoria de cruce.
* **Artículo 63 (Respeto a los Derechos de los Peatones):** Exige a los conductores de vehículos y motocicletas dar prelación al peatón en las zonas de cruce. AI-SafeCrossing alerta activamente al conductor mediante balizas LED y estrobos visuales cuando un peatón ingresa a la cebra, asegurando la visibilidad anticipada que previene la infracción y el siniestro.
* **Artículo 74 (Reducción de Velocidad):** Obliga a los conductores a reducir la velocidad a un máximo de **30 km/h** en zonas escolares, residenciales y proximidades a hospitales. La telemetría cinemática de SafeCrossing calcula la velocidad de aproximación vehicular y emite alertas escalonadas (*BAJO, MEDIO, ALTO, CRÍTICO*) cuando el vehículo se acerca a velocidades que comprometen la distancia de frenado.

### 3.2 Ley 2251 de 2022 ("Ley Julián Esteban") y Estrategia Visión Cero
La Ley 2251 de 2022 adoptó formalmente para Colombia el enfoque de **Sistema Seguro** promovido por la Organización Mundial de la Salud (OMS):
* Reconoce que el cuerpo humano tiene una tolerancia biomecánica limitada ante el impacto y que **el sistema vial debe diseñarse para perdonar el error humano**.
* Insta a los entes territoriales (alcaldías y secretarías de tránsito) a adoptar tecnologías innovadoras para proteger a niños, ciclistas y peatones.
* AI-SafeCrossing encaja de forma directa en los mandatos de la Ley 2251, al proporcionar a las administraciones municipales la herramienta técnica para auditar y mitigar puntos críticos antes de que ocurran fatalidades.

### 3.3 Ley 1811 de 2016 (Incentivo al Uso de la Bicicleta)
Otorga garantías de seguridad a los ciclistas en la infraestructura vial compartida. AI-SafeCrossing clasifica activamente las clases `bicicleta` y `ciclista`, extendiendo la protección dinámica a los usuarios de micromovilidad en intersecciones de alto conflicto.

---

## 4. ESPECIFICACIONES TÉCNICAS DEL MANUAL DE SEÑALIZACIÓN VIAL

### 4.1 Resolución 1885 de 2015 del Ministerio de Transporte
El *Manual de Señalización Vial de Colombia* establece las condiciones para dispositivos de control y regulación del tránsito:

1. **Clasificación Funcional:**
   - AI-SafeCrossing se clasifica normativamente bajo el **Capítulo 8 (Señalización Luminosa Especial)** y el **Capítulo 7 (Dispositivos para Pasos Peatonales)** como un *Sistema Asistencial de Advertencia Dinámica*.
   - No sustituye la señalización reglamentaria oficial (SR-30 / cebra horizontal), sino que la complementa de forma activa.

2. **Balizas de Advertencia Intermitente:**
   - La señalización luminosa exterior gobernada por el microcontrolador ESP32 utiliza destellos de advertencia en color ámbar/amarillo a una frecuencia calibrada de **50 a 60 destellos por minuto**, en estricto cumplimiento del numeral 8.3 del Manual de Señalización.

3. **Cálculo de Tiempos de Cruce para Población Vulnerable:**
   - Mientras los semáforos estáticos convencionales calculan el tiempo de despeje con base en una velocidad de marcha estándar de $1.2 \text{ m/s}$, AI-SafeCrossing calibra el despeje a **$0.8 \text{ m/s}$**, garantizando el tiempo suficiente para personas mayores, niños y personas con discapacidad física (Resolución 1885, Numeral 7.4.2).

---

## 5. PRINCIPIO DE AISLAMIENTO FÍSICO Y NO INVASIÓN (BLINDAJE JURÍDICO)

### 5.1 Desconexión Total del Semáforo Municipal y Cero Responsabilidad Civil
Una de las mayores fortalezas jurídicas de AI-SafeCrossing es su **total y absoluta desconexión física de la red semafórica municipal**:

```
┌────────────────────────────────────────┐         ┌────────────────────────────────────────┐
│     SEMÁFORO MUNICIPAL EXISTENTE       │         │   ESTACIÓN AUTÓNOMA AI-SAFECROSSING    │
│  (Propiedad DATT / Concesión Vial)     │         │              (SafeNode)                │
│                                        │         │                                        │
│  • Concesión pública regulada          │         │  • Microcontrolador ESP32 independiente│
│  • Armario controlador bajo llave      │         │  • Cámara IP / Edge AI (YOLOv8)        │
│  • Cableado y alimentación exclusiva   │         │  • Balizas LED de advertencia propias  │
│  • Responsabilidad civil del operador  │         │  • Alarma acústica direccional propia  │
└───────────────────┬────────────────────┘         │  • Alimentación o batería LiFePO4      │
                    │                              └───────────────────▲────────────────────┘
                    │                                                  │
                    │         SINCRONIZACIÓN PASIVA ÓPTICA             │
                    │         (Cero cables · Cero contacto)            │
                    └- - - - - - - - - - - - - - - - - - - - - - - - - ┘
                      La cámara de SafeCrossing detecta la luz del
                      semáforo en su campo visual (ROI) y sincroniza
                      las alertas con el ciclo, SIN TOCAR EL EQUIPO.
```

* **No invasión de activos públicos:** No se abren los gabinetes del DATT ni de los operadores semafóricos concesionados. No se empalman relés a la alimentación del semáforo.
* **Exclusión de culpa en fallos externos:** Si la red semafórica municipal presenta un apagón, cortocircuito o descalibración, AI-SafeCrossing no puede ser señalado como causante de la falla, ya que opera de manera energéticamente y eléctricamente aislada.
* **Sincronización Óptica Pasiva:** La sincronización con la fase verde/roja de la vía se efectúa observando la luz con la cámara (visión artificial por software) o mediante modelado temporal, sin que exista intercambio eléctrico alguno.

---

## 6. REGULACIÓN DE TELECOMUNICACIONES Y ESPECTRO RADIOELÉCTRICO

### 6.1 Resolución 181 de 2019 de la Agencia Nacional del Espectro (ANE)
* El microcontrolador ESP32 y la cámara IP operan en la banda de **2.4 GHz (2400 a 2483.5 MHz)**, designada legalmente en Colombia por la ANE como **banda libre de uso no comercial (Industrial, Scientific and Medical - ISM)**.
* La potencia isotrópica radiada equivalente (PIRE) de los módulos transmisores no supera los **100 mW (20 dBm)**, cumpliendo a cabalidad con los límites técnicos que eximen al dispositivo de requerir licencia previa de telecomunicaciones.

---

## 7. POLÍTICA NACIONAL DE INTELIGENCIA ARTIFICIAL ÉTICA

### 7.1 CONPES 3975 de 2019 y Recomendaciones de la UNESCO
El sistema se adscribe a los lineamientos éticos del documento CONPES 3975 (Política Nacional para la Transformación Digital e IA) y los estándares de la UNESCO (2021):

* **Principio de Transparencia y Explicabilidad:** La lógica cinemática ($TTC$, $PET$) está basada en leyes de física clásica y geometría determinista, garantizando que cualquier alerta o evento de near-miss pueda ser auditado, reproducido e interpretado por un perito judicial o ingeniero vial.
* **Principio de No Discriminación e Inclusión:** El modelo de visión artificial ha sido calibrado para evitar sesgos frente a usuarios en sillas de ruedas, personas con andadores, bastones, niños pequeños o personas cargando paquetes, asegurando idéntica sensibilidad de detección sin importar condición física, género o etnia.
* **Principio de Supervisión Humana (Human-in-the-Loop):** La plataforma no toma decisiones penales ni sancionatorias autónomas. Todos los reportes diarios generados en PDF sirven como insumo técnico de soporte para que los ingenieros de tránsito y las autoridades tomen decisiones de infraestructura basadas en evidencia.

---

## 8. MECANISMOS DE CONTRATACIÓN PÚBLICA Y VIABILIDAD B2G

Para que los municipios y alcaldías puedan implementar AI-SafeCrossing de forma ágil y legal, el proyecto encaja en dos rutas contractuales de la legislación colombiana:

1. **Modalidad de Mínima Cuantía (Ley 1150 de 2007, Art. 2, Numeral 5):**
   - El despliegue de kits piloto (lotes de 1 a 10 cruces por un valor inferior al 10% de la menor cuantía municipal) permite contratación directa o selección abreviada simplificada en menos de 15 días hábiles, sin los tiempos muertos de grandes licitaciones públicas.
2. **Convenios Especiales de Cooperación en Ciencia y Tecnología (CTeI):**
   - Amparados por el **Decreto Ley 393 de 1991**, la **Ley 1286 de 2009** y la **Ley 2162 de 2021 (MinCiencias)**, las alcaldías distritales (como la Alcaldía de Cartagena y el DATT) están facultadas para suscribir convenios de cofinanciación y pruebas piloto con instituciones de educación superior y sus semilleros de investigación (UNICOLOMBO) de forma directa y expedita.

---

## 9. CONCLUSIÓN Y DICTAMEN DE CONFORMIDAD LEGAL

> **DICTAMEN DE CONFORMIDAD JURÍDICA:**  
> AI-SafeCrossing (S.I.P.V.A.) opera en **total y estricta conformidad con el marco legal colombiano e internacional**.  
> El sistema:
> 1. **No viola la privacidad ni el Habeas Data** (cero reconocimiento facial, cero lectura de placas, procesamiento en RAM volátil).
> 2. **No invade ni interfiere la red semafórica municipal** (aislamiento físico total con sincronización óptica pasiva).
> 3. **Cumple con el Código Nacional de Tránsito y el Manual de Señalización Vial** (prioridad peatonal y balizas reglamentarias).
> 4. **Respeta el régimen de telecomunicaciones y el uso del espectro de la ANE** (bandas libres ISM a baja potencia).
> 5. **Cumple con los principios éticos de IA del CONPES 3975 y la UNESCO** (transparencia física y cero sesgos).

*Documento formal de blindaje jurídico y soporte normativo para jurados, inversores y entidades públicas gubernamentales.*
