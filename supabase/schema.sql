-- ==============================================================================
-- SCHEMA SUPABASE: AI-SAFECROSSING (S.I.P.V.A.) - CARTAGENA DE INDIAS
-- ==============================================================================

-- 1. Tabla de Señalización Activa (Gemelo Digital ESP32)
CREATE TABLE IF NOT EXISTS active_signaling_state (
    id SERIAL PRIMARY KEY,
    pedestrian_detected BOOLEAN DEFAULT FALSE,
    vehicle_detected BOOLEAN DEFAULT FALSE,
    status_label VARCHAR(50) DEFAULT 'ESPERA',
    indicator_color VARCHAR(20) DEFAULT 'GRIS',
    last_update TIMESTAMPTZ DEFAULT NOW()
);

-- Asegurar registro inicial
INSERT INTO active_signaling_state (id, pedestrian_detected, vehicle_detected, status_label, indicator_color)
VALUES (1, FALSE, FALSE, 'ESPERA', 'GRIS')
ON CONFLICT (id) DO NOTHING;

-- 2. Tabla de Eventos de Riesgo y Near-Misses
CREATE TABLE IF NOT EXISTS near_miss_events (
    id BIGSERIAL PRIMARY KEY,
    camera_id VARCHAR(100) NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    ttc_seconds NUMERIC(5,2),
    pet_seconds NUMERIC(5,2),
    v_rel NUMERIC(6,2),
    pedestrian_count INT DEFAULT 0,
    vehicle_count INT DEFAULT 0,
    objects_detected JSONB DEFAULT '[]'::jsonb,
    raw_snapshot TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_near_miss_timestamp ON near_miss_events (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_near_miss_risk ON near_miss_events (risk_level);

-- 3. Tabla de Instituciones Educativas y Entornos Escolares Críticos
CREATE TABLE IF NOT EXISTS instituciones_educativas (
    id VARCHAR(50) PRIMARY KEY,
    nombre TEXT NOT NULL,
    sigla VARCHAR(50),
    categoria VARCHAR(50) NOT NULL,
    direccion TEXT NOT NULL,
    corredor TEXT NOT NULL,
    lat NUMERIC(9,6) NOT NULL,
    lng NUMERIC(9,6) NOT NULL,
    danger_score NUMERIC(4,2) NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    student_population INT NOT NULL,
    daily_pedestrians INT NOT NULL,
    crossing_diagnosis TEXT NOT NULL,
    infrastructure_deficits JSONB DEFAULT '[]'::jsonb,
    client_opportunity TEXT NOT NULL,
    proposed_solution TEXT NOT NULL,
    commercial_stage VARCHAR(100) NOT NULL,
    key_decision_makers TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsqueda
CREATE INDEX IF NOT EXISTS idx_instituciones_categoria ON instituciones_educativas (categoria);
CREATE INDEX IF NOT EXISTS idx_instituciones_riesgo ON instituciones_educativas (risk_level);

-- 4. Habilitar Row Level Security (RLS) con políticas públicas de lectura
ALTER TABLE active_signaling_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE near_miss_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE instituciones_educativas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública active_signaling_state" ON active_signaling_state FOR SELECT USING (true);
CREATE POLICY "Actualización pública active_signaling_state" ON active_signaling_state FOR ALL USING (true);

CREATE POLICY "Lectura pública near_miss_events" ON near_miss_events FOR SELECT USING (true);
CREATE POLICY "Inserción pública near_miss_events" ON near_miss_events FOR INSERT WITH CHECK (true);

CREATE POLICY "Lectura pública instituciones_educativas" ON instituciones_educativas FOR SELECT USING (true);
CREATE POLICY "Actualización instituciones_educativas" ON instituciones_educativas FOR ALL USING (true);
