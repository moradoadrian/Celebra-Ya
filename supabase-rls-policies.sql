-- ==============================================================================
-- CELEBRA-YA: POLÍTICAS RLS Y PERMISOS CORREGIDOS (IDEMPOTENTE)
-- Corrección: Comparación de public.eventos.estado como VARCHAR ('true')
-- Aplicar en el SQL Editor de Supabase (https://supabase.com/dashboard/project/thznthspspdcayqlilwq/sql)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CONCEDER PRIVILEGIOS SELECT A NIVEL DE TABLA (ÚNICAMENTE 5 TABLAS)
-- ------------------------------------------------------------------------------
GRANT SELECT ON public.ubicaciones TO anon, authenticated;
GRANT SELECT ON public.programa_evento TO anon, authenticated;
GRANT SELECT ON public.galeria TO anon, authenticated;
GRANT SELECT ON public.historias TO anon, authenticated;
GRANT SELECT ON public.mesa_regalos TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2. HABILITAR ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.ubicaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programa_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.galeria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mesa_regalos ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 3. ELIMINAR POLÍTICAS PREVIAS SI EXISTEN (EVITA ERROR POR DUPLICADOS O PARCIALES)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Permitir lectura publica de ubicaciones de eventos activos" ON public.ubicaciones;
DROP POLICY IF EXISTS "Permitir lectura publica de programa de eventos activos" ON public.programa_evento;
DROP POLICY IF EXISTS "Permitir lectura publica de galeria de eventos activos" ON public.galeria;
DROP POLICY IF EXISTS "Permitir lectura publica de historias de eventos activos" ON public.historias;
DROP POLICY IF EXISTS "Permitir lectura publica de mesa_regalos de eventos activos" ON public.mesa_regalos;

-- ------------------------------------------------------------------------------
-- 4. CREAR POLÍTICAS RLS (SELECT ÚNICAMENTE SI eventos.estado = 'true')
-- ------------------------------------------------------------------------------

-- A) ubicaciones
CREATE POLICY "Permitir lectura publica de ubicaciones de eventos activos"
ON public.ubicaciones
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.eventos
    WHERE eventos.id = ubicaciones.evento_id
    AND eventos.estado = 'true'
  )
);

-- B) programa_evento
CREATE POLICY "Permitir lectura publica de programa de eventos activos"
ON public.programa_evento
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.eventos
    WHERE eventos.id = programa_evento.evento_id
    AND eventos.estado = 'true'
  )
);

-- C) galeria
CREATE POLICY "Permitir lectura publica de galeria de eventos activos"
ON public.galeria
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.eventos
    WHERE eventos.id = galeria.evento_id
    AND eventos.estado = 'true'
  )
);

-- D) historias
CREATE POLICY "Permitir lectura publica de historias de eventos activos"
ON public.historias
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.eventos
    WHERE eventos.id = historias.evento_id
    AND eventos.estado = 'true'
  )
);

-- E) mesa_regalos
CREATE POLICY "Permitir lectura publica de mesa_regalos de eventos activos"
ON public.mesa_regalos
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.eventos
    WHERE eventos.id = mesa_regalos.evento_id
    AND eventos.estado = 'true'
  )
);

-- ==============================================================================
-- FASE 16: PASES DIGITALES Y CONFIRMACIÓN RSVP EN public.invitados
-- Aplicar en el SQL Editor de Supabase (https://supabase.com/dashboard/project/thznthspspdcayqlilwq/sql)
-- ==============================================================================

-- 1. Agregar columna pases_confirmados (aditiva y no destructiva)
ALTER TABLE public.invitados ADD COLUMN IF NOT EXISTS pases_confirmados INTEGER DEFAULT NULL;

-- 2. Restricción de integridad: nunca permitir pases_confirmados < 0
ALTER TABLE public.invitados DROP CONSTRAINT IF EXISTS check_pases_confirmados_non_negative;
ALTER TABLE public.invitados ADD CONSTRAINT check_pases_confirmados_non_negative
  CHECK (pases_confirmados IS NULL OR pases_confirmados >= 0);

-- 3. Otorgar permisos sobre la tabla
-- Administrador autenticado: lectura, inserción, actualización, eliminación
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitados TO authenticated;
-- Invitados públicos (anon): lectura y actualización de confirmación RSVP
GRANT SELECT, UPDATE ON public.invitados TO anon;

-- 4. Habilitar Row Level Security (RLS) en public.invitados
ALTER TABLE public.invitados ENABLE ROW LEVEL SECURITY;

-- 5. Eliminar políticas previas de invitados si existen para evitar conflictos
DROP POLICY IF EXISTS "Permitir gestion total de invitados a usuarios autenticados" ON public.invitados;
DROP POLICY IF EXISTS "Permitir lectura publica de invitado por codigo" ON public.invitados;
DROP POLICY IF EXISTS "Permitir actualizacion RSVP de invitado por codigo" ON public.invitados;

-- 6. Política para administradores autenticados (acceso total a su gestión)
CREATE POLICY "Permitir gestion total de invitados a usuarios autenticados"
ON public.invitados
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 7. Política para visitantes públicos: lectura de su invitación por código
CREATE POLICY "Permitir lectura publica de invitado por codigo"
ON public.invitados
FOR SELECT
TO anon
USING (true);

-- 8. Política para visitantes públicos: actualización de su RSVP por código
CREATE POLICY "Permitir actualizacion RSVP de invitado por codigo"
ON public.invitados
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

