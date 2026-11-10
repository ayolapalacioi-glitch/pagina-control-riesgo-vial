# -*- coding: utf-8 -*-
"""
generate_event_dossier_docx.py
Generador automatizado del Dossier Ejecutivo para Eventos de Innovación y Emprendimiento
Proyecto: AI-SafeCrossing (S.I.P.V.A.)
Estructurado en los 4 Módulos Oficiales:
- Módulo 1: Discovery (Design Thinking & Human-Centered Design)
- Módulo 2: Business Modelling
- Módulo 3: Sustainability (Finance & Ethics)
- Módulo 4: Validate & Pitch (Prototyping & Pitching)
"""

import os
import sys
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_PATH = os.path.join(BASE_DIR, "DOSSIER_EVENTO_AI_SAFECROSSING.docx")

def set_cell_background(cell, fill_hex):
    """Asigna color de fondo a una celda de tabla."""
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=120, bottom=120, left=150, right=150):
    """Asigna márgenes internos a una celda."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def add_header(doc, text, level=1):
    p = doc.add_paragraph()
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    run.bold = True
    run.font.name = "Arial"
    
    if level == 1:
        p.paragraph_format.space_before = Pt(16)
        p.paragraph_format.space_after = Pt(6)
        run.font.size = Pt(15)
        run.font.color.rgb = RGBColor(0, 75, 147) # Unicolombo Blue
        # Subrayado decorativo
        pBdr = parse_xml(f'<w:pBdr {nsdecls("w")}><w:bottom w:val="single" w:sz="12" w:space="4" w:color="0284C7"/></w:pBdr>')
        p._p.get_or_add_pPr().append(pBdr)
    elif level == 2:
        p.paragraph_format.space_before = Pt(12)
        p.paragraph_format.space_after = Pt(4)
        run.font.size = Pt(12.5)
        run.font.color.rgb = RGBColor(2, 132, 199) # Sky Blue
    elif level == 3:
        p.paragraph_format.space_before = Pt(8)
        p.paragraph_format.space_after = Pt(3)
        run.font.size = Pt(11)
        run.font.color.rgb = RGBColor(30, 41, 59) # Slate Dark
    return p

def add_p(doc, text="", bold_prefix=None, italic=False, space_after=5):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.15
    
    if bold_prefix:
        r_pre = p.add_run(bold_prefix)
        r_pre.bold = True
        r_pre.font.name = "Calibri"
        r_pre.font.size = Pt(10)
        r_pre.font.color.rgb = RGBColor(15, 23, 42)
        
    if text:
        r_txt = p.add_run(text)
        r_txt.italic = italic
        r_txt.font.name = "Calibri"
        r_txt.font.size = Pt(10)
        r_txt.font.color.rgb = RGBColor(51, 65, 85)
    return p

def add_callout(doc, text, title="INSIGHT / NOTA CLAVE", color_hex="0284C7", bg_hex="F0F9FF"):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    set_cell_background(cell, bg_hex)
    set_cell_margins(cell, top=100, bottom=100, left=180, right=150)
    
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(f'<w:tcBorders {nsdecls("w")}><w:left w:val="single" w:sz="24" w:space="0" w:color="{color_hex}"/><w:top w:val="none"/><w:right w:val="none"/><w:bottom w:val="none"/></w:tcBorders>')
    tcPr.append(borders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.15
    run_t = p.add_run(f"📌 {title}: ")
    run_t.bold = True
    run_t.font.name = "Calibri"
    run_t.font.size = Pt(9.5)
    run_t.font.color.rgb = RGBColor(2, 132, 199)
    
    run_b = p.add_run(text)
    run_b.italic = True
    run_b.font.name = "Calibri"
    run_b.font.size = Pt(9.5)
    run_b.font.color.rgb = RGBColor(30, 41, 59)
    
    p_sp = doc.add_paragraph()
    p_sp.paragraph_format.space_before = Pt(0)
    p_sp.paragraph_format.space_after = Pt(4)

def format_table_headers(table, col_widths=None, header_bg="004B93"):
    for cell in table.rows[0].cells:
        set_cell_background(cell, header_bg)
        set_cell_margins(cell, top=100, bottom=100, left=120, right=120)
        for p in cell.paragraphs:
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for r in p.runs:
                r.bold = True
                r.font.name = "Arial"
                r.font.size = Pt(9)
                r.font.color.rgb = RGBColor(255, 255, 255)
                
    for row_idx, row in enumerate(table.rows[1:], start=1):
        bg = "F8FAFC" if row_idx % 2 == 1 else "FFFFFF"
        for cell in row.cells:
            set_cell_background(cell, bg)
            set_cell_margins(cell, top=80, bottom=80, left=100, right=100)
            for p in cell.paragraphs:
                p.paragraph_format.space_before = Pt(0)
                p.paragraph_format.space_after = Pt(0)
                for r in p.runs:
                    r.font.name = "Calibri"
                    r.font.size = Pt(8.5)
                    r.font.color.rgb = RGBColor(30, 41, 59)
                    
    if col_widths:
        for row in table.rows:
            for idx, width in enumerate(col_widths):
                if idx < len(row.cells):
                    row.cells[idx].width = width

def build_docx():
    print(f"Iniciando generación de Word: {OUTPUT_PATH}")
    doc = docx.Document()
    
    # Configurar márgenes de página
    sections = doc.sections
    for s in sections:
        s.top_margin = Inches(0.8)
        s.bottom_margin = Inches(0.8)
        s.left_margin = Inches(0.9)
        s.right_margin = Inches(0.9)
        
    # --- PORTADA EJECUTIVA ---
    p_pre = doc.add_paragraph()
    p_pre.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_pre.paragraph_format.space_before = Pt(30)
    p_pre.paragraph_format.space_after = Pt(6)
    r_pre = p_pre.add_run("PROGRAMA DE EMPRENDIMIENTO, INNOVACIÓN Y ACELERACIÓN")
    r_pre.bold = True
    r_pre.font.name = "Arial"
    r_pre.font.size = Pt(11)
    r_pre.font.color.rgb = RGBColor(2, 132, 199)
    
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(6)
    p_title.paragraph_format.space_after = Pt(12)
    r_title = p_title.add_run("DOSSIER MAESTRO DEL PROYECTO\nAI-SAFECROSSING (S.I.P.V.A.)")
    r_title.bold = True
    r_title.font.name = "Arial"
    r_title.font.size = Pt(22)
    r_title.font.color.rgb = RGBColor(0, 75, 147)
    
    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_before = Pt(4)
    p_sub.paragraph_format.space_after = Pt(20)
    r_sub = p_sub.add_run("Sistema Inteligente de Protección Vial Activa — Visión Cero Colombia\nAdaptación Oficial a las 4 Fases Metodológicas de Evaluación")
    r_sub.italic = True
    r_sub.font.name = "Calibri"
    r_sub.font.size = Pt(13)
    r_sub.font.color.rgb = RGBColor(100, 116, 139)
    
    # Cuadro resumen institucional
    tbl_meta = doc.add_table(rows=4, cols=2)
    tbl_meta.alignment = WD_TABLE_ALIGNMENT.CENTER
    col_w = [Inches(2.5), Inches(4.2)]
    meta_data = [
        ("Entidad / Origen:", "Semillero de Investigación UNICOLOMBO (Cartagena, Colombia)"),
        ("Área de Enfoque:", "Smart Cities, Visión Artificial en el Borde (Edge AI), IoT & Seguridad Vial"),
        ("Marco Normativo y ODS:", "Visión Cero · Sistema Seguro ANSV · Ley 769 / Ley 1581 · ODS 3, 9 y 11"),
        ("Estado de Maduración:", "Nivel TRL-6 (Prototipo digital-físico validado en entorno real simulado)")
    ]
    for idx, (label, val) in enumerate(meta_data):
        row = tbl_meta.rows[idx]
        c0, c1 = row.cells[0], row.cells[1]
        c0.width, c1.width = col_w[0], col_w[1]
        set_cell_background(c0, "F1F5F9")
        set_cell_background(c1, "FFFFFF")
        set_cell_margins(c0, 60, 60, 100, 100)
        set_cell_margins(c1, 60, 60, 100, 100)
        
        p0 = c0.paragraphs[0]
        p0.paragraph_format.space_after = Pt(0)
        r0 = p0.add_run(label)
        r0.bold = True
        r0.font.name = "Arial"
        r0.font.size = Pt(9)
        r0.font.color.rgb = RGBColor(0, 75, 147)
        
        p1 = c1.paragraphs[0]
        p1.paragraph_format.space_after = Pt(0)
        r1 = p1.add_run(val)
        r1.font.name = "Calibri"
        r1.font.size = Pt(9.5)
        r1.font.color.rgb = RGBColor(30, 41, 59)
        
    doc.add_page_break()
    
    # ==========================================
    # MÓDULO 1: DISCOVERY
    # ==========================================
    add_header(doc, "MÓDULO 1: DISCOVERY (DESIGN THINKING & HUMAN-CENTERED DESIGN)", level=1)
    
    add_header(doc, "1.1 Lanzamiento del Reto y Acuerdos de Equipo", level=2)
    add_p(doc, "El proyecto AI-SafeCrossing adopta el marco del Doble Diamante (Double Diamond) estructurado en cuatro fases: Descubrir, Definir, Desarrollar y Entregar. Su propósito es erradicar la siniestralidad de los actores viales vulnerables (peatones, ciclistas y motociclistas) transformando cruces obsoletos en pasos inteligentes de alta velocidad de respuesta.")
    
    add_header(doc, "1.1.1 Definición de Roles del Equipo", level=3)
    tbl_roles = doc.add_table(rows=5, cols=4)
    tbl_roles.alignment = WD_TABLE_ALIGNMENT.CENTER
    role_headers = ["Rol en Equipo", "Perfil Profesional", "Responsabilidades Clave", "Métrica de Éxito (KPI)"]
    for i, h in enumerate(role_headers):
        tbl_roles.rows[0].cells[i].paragraphs[0].text = h
    roles_data = [
        ("Hacker (CTO)", "Ing. Sistemas / Cómputo Embebido", "Pipeline YOLOv8, RTSP go2rtc, firmware ESP32, comunicación WebSocket y cálculo de TTC.", "Inferencia <8 ms, latencia E2E <100 ms, uptime >99.5%."),
        ("Hustler (CEO)", "Estratega Negocios / GovTech", "Modelo B2G/B2B, relacionamiento DATT/ANSV, análisis financiero, consecución de capital y pitch.", "2 cartas de intención (LOI), 1 piloto municipal acordado."),
        ("Hipster (CPO)", "Diseñador UI/UX & Ergonomía", "Centro de Mando Web, visor ciudadano móvil QR, experiencia de señalización y accesibilidad.", "Tasa de escaneo QR >40%, tiempo comprensión cruce <1.5 s."),
        ("Researcher (Ops)", "Investigador / Marco Vial", "Entrevistas de campo, análisis normativo (Ley 769, Manual Señalización), experimentación.", "48 entrevistas ejecutadas, 3 Test Cards completadas.")
    ]
    for r_idx, r_vals in enumerate(roles_data, start=1):
        for c_idx, val in enumerate(r_vals):
            tbl_roles.rows[r_idx].cells[c_idx].paragraphs[0].text = val
    format_table_headers(tbl_roles, [Inches(1.2), Inches(1.5), Inches(2.5), Inches(1.6)])
    
    add_header(doc, "1.1.2 Team Charter y Acuerdos de Trabajo", level=3)
    add_p(doc, "Se establecieron como valores innegociables: (1) La vida humana como prioridad absoluta ante cualquier optimización técnica; (2) Principio Fail-Safe estricto; (3) Cero vigilancia punitiva ciudadana (privacidad por diseño). Los rituales de trabajo contemplan Daily Standups de 15 minutos sincrónicos, Sprint Reviews semanales y una regla de 'desacuerdo constructivo basado en datos' con pruebas rápidas de 48 horas.")
    
    add_header(doc, "1.2 Mapeo del Sistema y Delimitación del Problema", level=2)
    add_p(doc, "Se analizó el ecosistema vial de Cartagena y ciudades intermedias colombianas, identificando el bucle vicioso donde el semáforo ciego con tiempos fijos impacienta al peatón, fomenta el cruce arriesgado e invisibiliza las cuasi-colisiones diarias ante las autoridades.")
    
    add_callout(doc, "En Colombia fallecen más de 8,400 personas al año en siniestros viales; el 61% son actores vulnerables (peatones, ciclistas y motociclistas). Las Secretarías de Movilidad solo gestionan la seguridad con 'estadísticas de sangre', pues no existe infraestructura que registre los eventos de cuasi-colisión previos.", title="MAGNITUD DEL PROBLEMA")
    
    add_header(doc, "1.2.1 Causa Raíz: Diagrama de Ishikawa (6M) y 5 Por Qués", level=3)
    add_p(doc, "El análisis de causa raíz desglosa la problemática en 6 ejes: Métodos (ciclos fijos temporizados sin aforo real); Máquinas (semáforos ciegos y cámaras de fotomulta costosas y punitivas); Personas (fatiga e imprudencia de conductores y peatones obligados a sortear el tráfico); Medio Ambiente (baja iluminación nocturna y lluvias tropicales); Mediciones (invisibilidad de los near-misses); y Materiales (pulsadores peatonales rotos).")
    add_p(doc, "El análisis de los 5 Por Qués evidenció que la ciudad no instala cruces inteligentes porque las alternativas del mercado internacional cuestan más de $15,000 USD por esquina y requieren infraestructura centralizada que los municipios no pueden costear masivamente.")
    
    add_callout(doc, "¿Cómo podríamos dotar a los pasos peatonales críticos de percepción inteligente y reacción física en tiempo real para evitar colisiones entre vehículos y peatones vulnerables, a una fracción del costo de la infraestructura tradicional y proveyendo datos predictivos a las autoridades?", title="PREGUNTA RETO HMW (HOW MIGHT WE)")
    
    add_header(doc, "1.2.2 Principio Arquitectónico Innegociable: Desconexión Total del Semáforo Municipal", level=3)
    add_callout(doc, "DECLARACIÓN ARQUITECTÓNICA INNEGOCIABLE: AI-SafeCrossing NO ES UN SISTEMA DE SEMAFORIZACIÓN INTELIGENTE NI ESTÁ CONECTADO AL SEMÁFORO MUNICIPAL. Opera de manera 100% aislada, no invasiva y autónoma como Estación Independiente de Señalización Activa y Prevención Peatonal (SafeNode). Puede sincronizarse de forma pasiva con el ciclo del semáforo existente mediante visión artificial óptica (la cámara detecta la luz del semáforo en su campo visual), pero JAMÁS se cablea, empalma, puentea ni abre el gabinete del semáforo de la ciudad por ninguna razón.", title="BLINDAJE JURÍDICO Y ARQUITECTURA NO INVASIVA", color_hex="DC2626", bg_hex="FEF2F2")
    add_p(doc, "Esta desconexión absoluta garantiza: (1) Cero fricción legal con concesiones viales o secretarías de tránsito, evitando traslados de responsabilidad civil ante siniestros; (2) Despliegue plug-and-play en 30 minutos sin abrir zanjas en el asfalto ni alterar la red eléctrica pública; y (3) Protección universal en cruces sin semáforos: más del 70% de las muertes peatonales ocurren en cebras escolares, hospitalarias o barriales donde no existe ningún semáforo, llevando señalización activa donde la infraestructura convencional jamás llega.")
    
    # ==========================================
    # MÓDULO 2: BUSINESS MODELLING
    # ==========================================
    add_header(doc, "MÓDULO 2: BUSINESS MODELLING", level=1)
    
    add_header(doc, "2.1 Descubrimiento de Clientes (Customer Discovery)", level=2)
    add_p(doc, "Bajo la metodología The Mom Test, se ejecutaron 48 entrevistas en campo en Cartagena sin mencionar el producto, enfocándose en hábitos, miedos pasados y presupuesto. Se definieron 3 arquetipos: Doña Carmen (63 años, peatona con movilidad reducida), Carlos (32 años, motociclista de reparto) y el Ing. Roberto Vélez (47 años, Director Técnico de Semafórica municipal).")
    
    add_header(doc, "2.1.1 Los 5 Insights Validados", level=3)
    insights = [
        ("Insight 1 - Desconfianza en botones: ", "El 92% de los peatones no oprime el pulsador porque asume que está desconectado o dañado."),
        ("Insight 2 - Desfase en tiempo de marcha: ", "Adultos mayores requieren 22.4 s en promedio para cruzar, frente a los 16 s que otorgan los ciclos oficiales."),
        ("Insight 3 - Ceguera nocturna del conductor: ", "El 78% de los motociclistas ha experimentado frenadas de emergencia en cebras por falta de iluminación previa."),
        ("Insight 4 - Dolores de la autoridad vial: ", "Los ingenieros de tránsito no pueden justificar reductores de velocidad ante organismos de control sin datos de riesgo previo."),
        ("Insight 5 - Rechazo a la fotomulta: ", "El 88% de los ciudadanos repudia las cámaras recaudatorias, pero aprueba con entusiasmo sistemas de alerta que salvan vidas.")
    ]
    for pre, txt in insights:
        add_p(doc, txt, bold_prefix=pre, space_after=3)
        
    add_header(doc, "2.2 Lienzo de Propuesta de Valor (Value Proposition Canvas)", level=2)
    add_p(doc, "Nuestra solución articula el SafeNode IoT (controlador ESP32 + balizas LED) con el motor SafeVision Core (YOLOv8 + proxy go2rtc) y un Visor Móvil QR de 50 metros. Resuelve las frustraciones del cliente B2G reduciendo costos en un 80% frente a radares importados, erradicando muertes peatonales y entregando reportes diarios auditables en PDF y CSV.")
    
    add_header(doc, "2.3 Ideación y Selección de Conceptos", level=2)
    add_p(doc, "Mediante Crazy 8's y SCAMPER se exploraron alternativas como resaltos físicos de asfalto, cámaras punitivas y apps con GPS. La matriz de priorización multicriterio (Impacto 40%, Viabilidad 30%, Escalabilidad 30%) otorgó a la arquitectura híbrida Edge-IoT + Visión Artificial + Alertas Móviles una calificación líder de 9.05 / 10.")
    
    add_header(doc, "2.4 Business Model Canvas y Supuestos Críticos", level=2)
    add_p(doc, "El modelo de negocio opera como B2G primario (Secretarías de Tránsito) y B2B secundario (concesiones viales, puertos, campus). Los ingresos combinan la venta de hardware SafeNode ($1,250 USD) con la suscripción mensual SaaS ($90 USD/mes por cruce). Se jerarquizaron los supuestos de fe (LOFA), priorizando la validación de la adopción del visor QR ciudadano y la latencia sub-100 ms ante fluctuaciones de red.")
    
    # ==========================================
    # MÓDULO 3: SUSTAINABILITY
    # ==========================================
    add_header(doc, "MÓDULO 3: SUSTAINABILITY (FINANCE & ETHICS)", level=1)
    
    add_header(doc, "3.1 Modelos de Ingresos y Unit Economics", level=2)
    add_p(doc, "El modelo económico está optimizado para contratos institucionales por lotes de 10 intersecciones, generando flujos de caja predecibles y de alto margen:")
    
    tbl_unit = doc.add_table(rows=7, cols=2)
    tbl_unit.alignment = WD_TABLE_ALIGNMENT.CENTER
    unit_rows = [
        ("Métrica Unitaria por Intersección", "Valor Financiero Proyectado"),
        ("Precio Venta Hardware (CAPEX) / Costo Ensamble (COGS)", "$1,250 USD / $550 USD (Margen Bruto: 56.0%)"),
        ("Tarifa Mensual SaaS (OPEX) / Costo Servidor Cloud", "$90 USD/mes / $15 USD/mes (Margen Bruto: 83.3%)"),
        ("Costo Adquisición Cliente (CAC) por Lote Institucional (10 cruces)", "$2,400 USD total ($240 USD prorrateado por cruce)"),
        ("Lifetime Value (LTV) por Cruce a 36 meses", "$4,490 USD ($3,400 USD de margen de contribución)"),
        ("Relación LTV / CAC por Contrato Institucional", "14.1x ($34,000 margen total lote / $2,400 CAC)"),
        ("Periodo de Recuperación de Inversión (Payback)", "3.5 meses tras el despliegue del contrato")
    ]
    for r_idx, (m, v) in enumerate(unit_rows):
        tbl_unit.rows[r_idx].cells[0].paragraphs[0].text = m
        tbl_unit.rows[r_idx].cells[1].paragraphs[0].text = v
    format_table_headers(tbl_unit, [Inches(3.8), Inches(2.9)])
    
    add_header(doc, "3.2 Modelo Financiero a 12 Meses y Punto de Equilibrio", level=2)
    add_p(doc, "La proyección contempla instalar 25 intersecciones en el primer año (2 en M1, alcanzando 25 en M11). Los ingresos brutos totales alcanzan $44,490 USD ($31,250 por hardware y $13,240 por SaaS recurrente). El Punto de Equilibrio Operativo (Break-Even) se consolida en el Mes 8 con 18 cruces activos.")
    add_p(doc, "La ruta de financiación articula: (1) Capital no dilutivo vía Fondo Emprender SENA y MinCiencias ($20,000 USD); (2) Piloto cofinanciado con DATT Cartagena ($15,000 USD); y (3) Ronda Semilla de $50,000 USD para expansión a 25 cruces.")
    
    add_header(doc, "3.3 Ética Empresarial, Cumplimiento e Innovación Responsable", level=2)
    add_p(doc, "AI-SafeCrossing opera 100% dentro de la ley colombiana, contando con un blindaje jurídico integral estructurado en 8 pilares normativos:")
    
    tbl_legal = doc.add_table(rows=9, cols=3)
    tbl_legal.alignment = WD_TABLE_ALIGNMENT.CENTER
    legal_headers = ["Eje Normativo", "Ley / Regulación Oficial", "Mecanismo de Cumplimiento Técnico"]
    for i, h in enumerate(legal_headers):
        tbl_legal.rows[0].cells[i].paragraphs[0].text = h
    legal_data = [
        ("Protección de Datos / Habeas Data", "Ley Estatutaria 1581/2012 y Dec. 1377/2013 (SIC)", "Edge AI en RAM volátil. Cero reconocimiento facial, cero lectura de placas (LPR) y cero almacenamiento de video."),
        ("Código Nacional de Tránsito", "Ley 769 de 2002 (Arts. 57, 58, 63 y 74)", "Prelación peatonal en cebra y exigencia de velocidad máx. 30 km/h en zonas escolares mediante alertas escalonadas."),
        ("Sistema Seguro y Visión Cero", "Ley 2251 de 2022 (Ley Julián Esteban)", "Mitigación de vulnerabilidad biomecánica del peatón con infraestructura inteligente basada en evidencia."),
        ("Manual de Señalización Vial", "Resolución 1885/2015 MinTransporte (Caps. 7 y 8)", "Balizas ámbar intermitentes a 50-60 destellos/min. Tiempo de despeje peatonal a velocidad de 0.8 m/s para ancianos."),
        ("Aislamiento de Redes Públicas", "Ley 105/1993 y Concesiones de Tránsito", "Total desconexión física de la red semafórica. SafeNode opera con electrónica propia y sincronización óptica."),
        ("Espectro y Telecomunicaciones", "Resolución 181 de 2019 de la ANE", "Uso libre de banda ISM de 2.4 GHz en microcontrolador ESP32 con potencia PIRE < 100 mW (sin licencia requerida)."),
        ("Ética en Inteligencia Artificial", "CONPES 3975 de 2019 y UNESCO 2021", "Algoritmos cinemáticos explicables (TTC/PET) basados en física determinista y mitigación de sesgos en diversidad de marcha."),
        ("Contratación Pública (B2G)", "Ley 80/1993, Ley 1150/2007 y Dec. 393/1991", "Viabilidad de compra directa por Mínima Cuantía y Convenios de Cooperación CTeI con semilleros de UNICOLOMBO.")
    ]
    for r_idx, r_vals in enumerate(legal_data, start=1):
        for c_idx, val in enumerate(r_vals):
            tbl_legal.rows[r_idx].cells[c_idx].paragraphs[0].text = val
    format_table_headers(tbl_legal, [Inches(1.8), Inches(2.2), Inches(2.8)])
    
    # ==========================================
    # MÓDULO 4: VALIDATE & PITCH
    # ==========================================
    add_header(doc, "MÓDULO 4: VALIDATE & PITCH (PROTOTYPING & PITCHING)", level=1)
    
    add_header(doc, "4.1 Prototipado Rápido y Arquitectura del MVP", level=2)
    add_p(doc, "La solución evolucionó desde wireframes de papel y pruebas tipo Concierge en andén hasta un prototipo digital-físico TRL-6 completamente funcional: cámara RTSP desacoplada con proxy go2rtc a 30 FPS, inferencia asíncrona YOLOv8 en 5 ms, seguimiento temporal cinemático (TTC, PET, vRel), microcontrolador ESP32 con servidor web embebido y FSM determinista, Centro de Mando Web Leaflet/Chart.js y Visor Móvil QR con geocerca de 50 metros.")
    
    add_header(doc, "4.2 Diseño de Experimentos (Test & Learning Cards)", level=2)
    add_p(doc, "Se formularon 3 Test Cards y se documentaron 3 Learning Cards metodológicas:")
    add_p(doc, "Se comprobó una adopción del 43.8% del código QR en peatones jóvenes y adultos, pero nula en mayores de 65 años. Se decidió reforzar el zumbador acústico físico de 85 dB en el poste gobernado por el ESP32 para asegurar accesibilidad universal.", bold_prefix="• Experimento 1 (Usabilidad Ciudadana): ")
    add_p(doc, "100 pruebas de frenada a escala validaron una latencia E2E promedio de 68 ms. Ante caídas de red Wi-Fi, se implementó una FSM autónoma en el ESP32 con temporizador de guardia que opera de forma Fail-Safe independiente.", bold_prefix="• Experimento 2 (Latencia y Fail-Safe): ")
    add_p(doc, "Ingenieros viales confirmaron que el mayor valor institucional para la alcaldía no es solo el semáforo, sino la auditoría diaria en PDF/CSV con mapas de calor de near-misses para sustentar obras viales.", bold_prefix="• Experimento 3 (Aceptación B2G): ")
    
    add_header(doc, "4.3 Pitch de Inversión en Inglés (Investment Pitch Deck)", level=2)
    add_p(doc, "Estructura de 10 diapositivas adaptada para jurados internacionales y fondos de capital de riesgo:")
    
    pitch_slides = [
        ("Slide 1: Title & Hook", "AI-SafeCrossing: Active Pedestrian Protection with Real-Time Edge AI."),
        ("Slide 2: The Problem", "1.35M deaths globally; 8,400+ in Colombia. 50-year-old blind traffic lights operate without pre-crash data."),
        ("Slide 3: The Solution", "Intelligent zebra crossings with eyes, brain, and active IoT reflexes in <100ms."),
        ("Slide 4: Technology", "Edge YOLOv8 inference (5ms), kinematic TTC/PET conflict engine, deterministic ESP32 Fail-Safe."),
        ("Slide 5: Market Size", "TAM: $14.2B Global Smart Traffic; SAM: $240M Andean Region; SOM: $6.2M (2,500 Colombian crossings)."),
        ("Slide 6: Business Model", "Hybrid B2G/B2B: Hardware Kit ($1,250 USD) + SaaS ($90/mo). LTV/CAC: 14.1x, Payback: 3.5 months."),
        ("Slide 7: Traction & Data", "Functional MVP, 112 citizen tests in Cartagena, 68ms latency verified, 2 LOIs in progress."),
        ("Slide 8: Competition", "80% cheaper than foreign radars ($15k+), proactive milisecond prevention vs post-event fines."),
        ("Slide 9: Team", "Multidisciplinary execution: Hacker (AI/IoT), Hustler (Gov B2G), Hipster (UI/UX), Researcher (Road Law)."),
        ("Slide 10: The Ask", "Seeking $50,000 USD Seed Investment to deploy 25 smart intersections and reach break-even in M8.")
    ]
    for s_title, s_desc in pitch_slides:
        add_p(doc, s_desc, bold_prefix=f"{s_title}: ", space_after=3)
        
    add_header(doc, "4.3.1 Guion Verbal en Inglés (Word-for-Word Pitch Script)", level=3)
    add_p(doc, "“Distinguished jury: Have you ever felt that surge of adrenaline when stepping onto a crosswalk because an oncoming motorcycle won't slow down? Globally, over 1.35 million people die each year—over 61% are vulnerable pedestrians and riders. Why? Because traffic lights rely on 50-year-old blind timers, and cities only act after fatal accidents occur.")
    add_p(doc, "AI-SafeCrossing gives crossings their own eyes (RTSP cameras), brain (Edge YOLOv8 analyzing collision risk via TTC in 5ms), and active reflexes: triggering visual LED beacons and acoustic alarms on our ESP32 IoT controller in under 100ms, while alerting pedestrians via an instant QR geofence without app downloads.")
    add_p(doc, "Our hybrid B2G/B2B model combines a $1,250 USD hardware installation fee with a $90/month SaaS subscription for continuous audit heatmaps and automated PDF daily reports, delivering a 14.1x LTV/CAC ratio. With a functional MVP tested in Cartagena, we are seeking $50,000 USD to deploy 25 intersections and reach break-even within 8 months. Join us in making urban streets safe for everyone. Thank you.”", italic=True)
    
    add_header(doc, "4.3.2 Guía de Defensa ante Inversores (Investor Q&A)", level=3)
    qas = [
        ("Q1: ¿Cómo mitigan los lentos ciclos de venta gubernamentales? ", "Clasificamos bajo Mínima Cuantía y Convenios de Cooperación CTeI (adjudicación en semanas, no años) y diversificamos con concesiones privadas B2B."),
        ("Q2: ¿Cuál es su responsabilidad civil en caso de accidente? ", "Operamos como sistema de señalización asistencial bajo la Ley 769. La caja negra de auditoría criptográfica con TTC/PET deslinda responsabilidades y sirve de prueba pericial."),
        ("Q3: ¿Por qué Siemens o FLIR no los aplastan? ", "Sus sistemas cuestan $50k+ USD por cruce y no están diseñados para ciudades de LatAm. Nuestra arquitectura abierta en microcontroladores de $10 USD y despliegue en 30 minutos sin zanjas nos da una ventaja ágil insuperable."),
        ("Q4: ¿Qué ocurre con lluvias tropicales o cortes de luz? ", "Redundancia en 3 capas: visión infrarroja aumentada contra lluvia, respaldo de batería LiFePO4 de 8 horas y modo Fail-Safe autónomo en el ESP32 si se pierde la red."),
        ("Q5: ¿Cómo escalarán a cientos de ciudades? ", "Modelo plug-and-play para empresas de señalización e infraestructura vial. Al ser una estación 100% desconectada del semáforo municipal, no requiere permisos de intervención eléctrica ni obras civiles complejas, permitiendo instalar un SafeNode en 30 minutos en cualquier paso de cebra urbano.")
    ]
    for q, a in qas:
        add_p(doc, a, bold_prefix=q, space_after=4)
        
    doc.save(OUTPUT_PATH)
    print(f"Documento Word guardado exitosamente en: {OUTPUT_PATH}")

if __name__ == "__main__":
    build_docx()
