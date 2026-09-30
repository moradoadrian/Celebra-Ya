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
-- ⚠️ Los permisos anon y las políticas "USING (true)" de esta fase quedaron
--    reemplazados por la FASE 25 (acceso público solo vía funciones RPC).
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

-- ==============================================================================
-- FASE 17: MESAS Y ASIGNACIÓN DE INVITADOS (SEATING PLAN)
-- Aplicar en el SQL Editor de Supabase (https://supabase.com/dashboard/project/thznthspspdcayqlilwq/sql)
-- ==============================================================================

-- 1. TABLA public.mesas
CREATE TABLE IF NOT EXISTS public.mesas (
  id BIGSERIAL PRIMARY KEY,
  evento_id BIGINT NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  capacidad INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_mesas_numero_positive CHECK (numero > 0),
  CONSTRAINT check_mesas_capacidad_positive CHECK (capacidad > 0),
  CONSTRAINT unique_mesa_numero_por_evento UNIQUE (evento_id, numero)
);

-- 2. TABLA public.mesa_invitados (Relación de invitados a mesa)
CREATE TABLE IF NOT EXISTS public.mesa_invitados (
  id BIGSERIAL PRIMARY KEY,
  mesa_id BIGINT NOT NULL REFERENCES public.mesas(id) ON DELETE CASCADE,
  invitado_id BIGINT NOT NULL REFERENCES public.invitados(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Regla: Un invitado solamente puede pertenecer a una mesa al mismo tiempo
  CONSTRAINT unique_invitado_mesa UNIQUE (invitado_id)
);

-- 3. PERMISOS Y PRIVILEGIOS
-- Rol authenticated (administrador): gestión total
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mesas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mesa_invitados TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 4. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.mesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mesa_invitados ENABLE ROW LEVEL SECURITY;

-- 5. POLÍTICAS RLS (authenticated)
DROP POLICY IF EXISTS "Permitir gestion total de mesas a usuarios autenticados" ON public.mesas;
CREATE POLICY "Permitir gestion total de mesas a usuarios autenticados"
ON public.mesas
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir gestion total de mesa_invitados a usuarios autenticados" ON public.mesa_invitados;
CREATE POLICY "Permitir gestion total de mesa_invitados a usuarios autenticados"
ON public.mesa_invitados
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ==============================================================================
-- FASE 18: CONTROL DE ACCESO, QR Y CHECK-IN DE INVITADOS
-- Aplicar en el SQL Editor de Supabase (https://supabase.com/dashboard/project/thznthspspdcayqlilwq/sql)
-- ==============================================================================

-- 1. TABLA public.checkins (Historial persistente de accesos por invitación)
CREATE TABLE IF NOT EXISTS public.checkins (
  id BIGSERIAL PRIMARY KEY,
  evento_id BIGINT NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  invitado_id BIGINT NOT NULL REFERENCES public.invitados(id) ON DELETE CASCADE,
  cantidad INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  CONSTRAINT check_checkins_cantidad_positive CHECK (cantidad > 0)
);

-- 2. ÍNDICES DE RENDIMIENTO Y CONSULTA RÁPIDA
CREATE INDEX IF NOT EXISTS idx_checkins_evento_id ON public.checkins(evento_id);
CREATE INDEX IF NOT EXISTS idx_checkins_invitado_id ON public.checkins(invitado_id);
CREATE INDEX IF NOT EXISTS idx_checkins_created_at ON public.checkins(created_at DESC);

-- 3. PERMISOS Y PRIVILEGIOS
-- Rol authenticated (administrador): gestión total de check-ins
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkins TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.checkins_id_seq TO authenticated;

-- 4. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

-- 5. POLÍTICAS RLS PARA CHECK-INS (authenticated)
DROP POLICY IF EXISTS "Permitir gestion total de checkins a usuarios autenticados" ON public.checkins;
CREATE POLICY "Permitir gestion total de checkins a usuarios autenticados"
ON public.checkins
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 6. FUNCIÓN ATÓMICA Y TRANSACCIONAL: registrar_checkin (Protección ante concurrencia)
CREATE OR REPLACE FUNCTION public.registrar_checkin(
    p_codigo TEXT,
    p_cantidad INTEGER,
    p_evento_id BIGINT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invitado RECORD;
    v_pases_utilizados INTEGER;
    v_pases_disponibles INTEGER;
    v_checkin_id BIGINT;
BEGIN
    -- Validar cantidad
    IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
        RETURN json_build_object('success', false, 'status', 400, 'error', 'La cantidad debe ser un entero mayor a 0.');
    END IF;

    -- Bloquear y obtener al invitado para evitar condiciones de carrera (FOR UPDATE)
    SELECT * INTO v_invitado
    FROM public.invitados
    WHERE UPPER(TRIM(codigo)) = UPPER(TRIM(p_codigo))
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'status', 404, 'error', 'Invitación no encontrada. El código no corresponde a un invitado válido.');
    END IF;

    -- Validar aislamiento por evento
    IF p_evento_id IS NOT NULL AND v_invitado.evento_id <> p_evento_id THEN
        RETURN json_build_object('success', false, 'status', 403, 'error', 'El invitado no pertenece al evento especificado.');
    END IF;

    -- Validar RSVP
    IF v_invitado.confirmado IS NULL THEN
        RETURN json_build_object('success', false, 'status', 409, 'error', 'RSVP pendiente: Este invitado todavía no ha confirmado su asistencia.');
    END IF;

    IF v_invitado.confirmado = false THEN
        RETURN json_build_object('success', false, 'status', 409, 'error', 'Invitación rechazada: El invitado indicó que no asistirá.');
    END IF;

    -- Validar pases confirmados
    IF v_invitado.pases_confirmados IS NULL OR v_invitado.pases_confirmados <= 0 THEN
        RETURN json_build_object('success', false, 'status', 409, 'error', 'El invitado no cuenta con pases confirmados.');
    END IF;

    -- Calcular pases ya utilizados
    SELECT COALESCE(SUM(cantidad), 0) INTO v_pases_utilizados
    FROM public.checkins
    WHERE invitado_id = v_invitado.id;

    v_pases_disponibles := v_invitado.pases_confirmados - v_pases_utilizados;

    IF v_pases_disponibles <= 0 THEN
        RETURN json_build_object('success', false, 'status', 400, 'error', 'Entrada completa: Todos los pases confirmados ya fueron utilizados.');
    END IF;

    IF p_cantidad > v_pases_disponibles THEN
        RETURN json_build_object(
            'success', false,
            'status', 400,
            'error', format('No es posible registrar %s personas. Solo quedan %s pases disponibles.', p_cantidad, v_pases_disponibles)
        );
    END IF;

    -- Insertar registro en checkins
    INSERT INTO public.checkins (evento_id, invitado_id, cantidad)
    VALUES (v_invitado.evento_id, v_invitado.id, p_cantidad)
    RETURNING id INTO v_checkin_id;

    -- Retornar resultado exitoso con métricas actualizadas
    RETURN json_build_object(
        'success', true,
        'status', 200,
        'message', 'Entrada registrada correctamente.',
        'data', json_build_object(
            'checkin_id', v_checkin_id,
            'invitado_id', v_invitado.id,
            'nombre', v_invitado.nombre,
            'evento_id', v_invitado.evento_id,
            'cantidad', p_cantidad,
            'pases_confirmados', v_invitado.pases_confirmados,
            'pases_utilizados', v_pases_utilizados + p_cantidad,
            'pases_disponibles', v_pases_disponibles - p_cantidad
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_checkin(TEXT, INTEGER, BIGINT) TO authenticated;

-- ==============================================================================
-- FASE 20: GESTIÓN DE CLIENTES Y BASE MULTI-TENANT
-- Aplicar en el SQL Editor de Supabase (https://supabase.com/dashboard/project/thznthspspdcayqlilwq/sql)
-- ==============================================================================

-- 1. TABLA public.clientes (Garantizar columnas y restricciones)
CREATE TABLE IF NOT EXISTS public.clientes (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT,
  telefono TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Asegurar columnas aditivas de forma segura y no destructiva
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS telefono TEXT DEFAULT NULL;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS whatsapp TEXT DEFAULT NULL;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW());

-- 2. Asegurar que public.eventos.cliente_id referencie a public.clientes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'eventos' AND column_name = 'cliente_id'
  ) THEN
    ALTER TABLE public.eventos ADD COLUMN cliente_id BIGINT REFERENCES public.clientes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Índices de consulta rápida y aislamiento multi-tenant
CREATE INDEX IF NOT EXISTS idx_clientes_email ON public.clientes(email);
CREATE INDEX IF NOT EXISTS idx_clientes_activo ON public.clientes(activo);
CREATE INDEX IF NOT EXISTS idx_eventos_cliente_id ON public.eventos(cliente_id);

-- 4. Inserción idempotente de clientes para los eventos reales existentes
INSERT INTO public.clientes (id, nombre, email, whatsapp, telefono, activo)
VALUES
  (1, 'Sofía & Alejandro', 'sofia.alejandro@bodas.com', '+52 55 1234 5678', '5512345678', true),
  (2, 'César & Cristal', 'cesar.cristal@bodas.com', '+52 461 421 0058', '4614210058', true)
ON CONFLICT (id) DO UPDATE
SET nombre = EXCLUDED.nombre,
    email = EXCLUDED.email,
    whatsapp = EXCLUDED.whatsapp,
    activo = COALESCE(public.clientes.activo, true);

-- Sincronizar la secuencia id de public.clientes
SELECT setval(pg_get_serial_sequence('public.clientes', 'id'), coalesce(max(id), 1)) FROM public.clientes;

-- 5. Privilegios y permisos: SOLO usuarios autenticados (administradores)
GRANT SELECT, INSERT, UPDATE ON public.clientes TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
REVOKE ALL ON public.clientes FROM anon;

-- 6. Habilitar Row Level Security (RLS) en public.clientes
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- 7. Política RLS: Acceso total para administradores autenticados
DROP POLICY IF EXISTS "Permitir gestion total de clientes a usuarios autenticados" ON public.clientes;
CREATE POLICY "Permitir gestion total de clientes a usuarios autenticados"
ON public.clientes
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ==============================================================================
-- FASE 25: ENDURECIMIENTO DE SEGURIDAD (ROL ADMIN, RLS DE INVITADOS, RPC)
-- Reemplaza las políticas permisivas de las fases 16, 17, 18 y 20.
-- Aplicar en el SQL Editor de Supabase. Es idempotente.
--
-- ANTES de aplicar (o inmediatamente después), marca tu cuenta como administradora
-- o perderás el acceso al panel (ver paso 0). Después cierra sesión y vuelve a entrar
-- para que el JWT incluya el rol.
-- ==============================================================================

-- 0. Asignar rol admin a las cuentas administradoras (app_metadata solo es editable
--    con privilegios de servidor, el usuario no puede modificarlo desde el cliente).
--    Reemplaza el correo y ejecuta una vez por cada administrador:
-- UPDATE auth.users
--   SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
--   WHERE email = 'TU_CORREO_ADMIN@ejemplo.com';

-- 1. Función auxiliar: ¿el JWT actual pertenece a un administrador?
--    Debe coincidir con isAdmin() en src/lib/admin-auth.ts
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- 2. public.invitados: el rol anon ya no tiene acceso directo a la tabla.
--    La invitación pública y el RSVP pasan por las funciones del paso 5.
DROP POLICY IF EXISTS "Permitir lectura publica de invitado por codigo" ON public.invitados;
DROP POLICY IF EXISTS "Permitir actualizacion RSVP de invitado por codigo" ON public.invitados;
REVOKE ALL ON public.invitados FROM anon;

-- 3. Tablas administrativas: acceso total solo para administradores
DROP POLICY IF EXISTS "Permitir gestion total de invitados a usuarios autenticados" ON public.invitados;
DROP POLICY IF EXISTS "Solo administradores gestionan invitados" ON public.invitados;
CREATE POLICY "Solo administradores gestionan invitados"
ON public.invitados FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Permitir gestion total de mesas a usuarios autenticados" ON public.mesas;
DROP POLICY IF EXISTS "Solo administradores gestionan mesas" ON public.mesas;
CREATE POLICY "Solo administradores gestionan mesas"
ON public.mesas FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Permitir gestion total de mesa_invitados a usuarios autenticados" ON public.mesa_invitados;
DROP POLICY IF EXISTS "Solo administradores gestionan mesa_invitados" ON public.mesa_invitados;
CREATE POLICY "Solo administradores gestionan mesa_invitados"
ON public.mesa_invitados FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Permitir gestion total de checkins a usuarios autenticados" ON public.checkins;
DROP POLICY IF EXISTS "Solo administradores gestionan checkins" ON public.checkins;
CREATE POLICY "Solo administradores gestionan checkins"
ON public.checkins FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Permitir gestion total de clientes a usuarios autenticados" ON public.clientes;
DROP POLICY IF EXISTS "Solo administradores gestionan clientes" ON public.clientes;
CREATE POLICY "Solo administradores gestionan clientes"
ON public.clientes FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 4. Tablas de contenido cuyas políticas de escritura no están en este archivo:
--    una política RESTRICTIVA se combina con AND sobre las permisivas existentes,
--    así que un usuario autenticado sin rol admin queda bloqueado sin importar
--    qué políticas se hayan creado desde el dashboard. (Solo tiene efecto si RLS
--    está habilitado en la tabla: ver la consulta de diagnóstico al final.)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['eventos', 'ubicaciones', 'programa_evento', 'galeria', 'historias', 'mesa_regalos']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Restringir autenticados a administradores" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Restringir autenticados a administradores" ON public.%I
         AS RESTRICTIVE FOR ALL TO authenticated
         USING (public.is_admin()) WITH CHECK (public.is_admin())',
      t
    );
  END LOOP;
END $$;

-- 5. Funciones públicas para la invitación (reemplazan el acceso anon a invitados)

-- 5.A Consulta de una invitación por código dentro de un evento publicado.
--     Devuelve solo los campos que necesita el pase digital (sin teléfono).
CREATE OR REPLACE FUNCTION public.obtener_invitacion(
    p_codigo TEXT,
    p_evento_id BIGINT
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invitado RECORD;
BEGIN
    IF p_codigo IS NULL OR btrim(p_codigo) = '' OR p_evento_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT i.id, i.evento_id, i.nombre, i.numero_pases, i.confirmado, i.pases_confirmados, i.codigo
    INTO v_invitado
    FROM public.invitados i
    JOIN public.eventos e ON e.id = i.evento_id
    WHERE i.codigo = btrim(p_codigo)
      AND i.evento_id = p_evento_id
      AND e.estado = 'true'
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    RETURN row_to_json(v_invitado);
END;
$$;

-- 5.B Registro de RSVP: solo modifica confirmado y pases_confirmados del invitado
--     cuyo código y evento coinciden, con las reglas de pases aplicadas en la BD.
CREATE OR REPLACE FUNCTION public.responder_rsvp(
    p_codigo TEXT,
    p_evento_id BIGINT,
    p_confirmado BOOLEAN,
    p_pases INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invitado RECORD;
    v_max_pases INTEGER;
    v_pases INTEGER;
BEGIN
    IF p_codigo IS NULL OR btrim(p_codigo) = '' OR p_evento_id IS NULL OR p_confirmado IS NULL THEN
        RETURN json_build_object('success', false, 'status', 400, 'error', 'Datos de confirmación incompletos.');
    END IF;

    SELECT i.* INTO v_invitado
    FROM public.invitados i
    JOIN public.eventos e ON e.id = i.evento_id
    WHERE i.codigo = btrim(p_codigo)
      AND i.evento_id = p_evento_id
      AND e.estado = 'true'
    LIMIT 1
    FOR UPDATE OF i;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'status', 404, 'error', 'Invitación no encontrada con el código proporcionado.');
    END IF;

    v_max_pases := GREATEST(1, COALESCE(v_invitado.numero_pases, 1));

    IF p_confirmado THEN
        IF p_pases IS NULL OR p_pases < 1 THEN
            RETURN json_build_object('success', false, 'status', 400, 'error', 'Para confirmar asistencia, la cantidad de personas debe ser de al menos 1.');
        END IF;
        IF p_pases > v_max_pases THEN
            RETURN json_build_object('success', false, 'status', 400, 'error',
                format('La cantidad de personas solicitada (%s) supera el máximo permitido de pases asignados (%s).', p_pases, v_max_pases));
        END IF;
        v_pases := p_pases;
    ELSE
        v_pases := 0;
    END IF;

    UPDATE public.invitados
    SET confirmado = p_confirmado,
        pases_confirmados = v_pases
    WHERE id = v_invitado.id;

    RETURN json_build_object(
        'success', true,
        'status', 200,
        'data', json_build_object(
            'id', v_invitado.id,
            'nombre', v_invitado.nombre,
            'confirmado', p_confirmado,
            'pases_confirmados', v_pases,
            'numero_pases', v_max_pases
        )
    );
END;
$$;

-- Supabase concede EXECUTE a anon/authenticated por defecto en funciones nuevas:
-- se revoca todo y se concede explícitamente solo lo necesario.
REVOKE ALL ON FUNCTION public.obtener_invitacion(TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.responder_rsvp(TEXT, BIGINT, BOOLEAN, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_invitacion(TEXT, BIGINT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.responder_rsvp(TEXT, BIGINT, BOOLEAN, INTEGER) TO anon, authenticated;

-- 6. registrar_checkin: exige rol admin, fija search_path y deja de ser ejecutable
--    por anon (antes heredaba EXECUTE de PUBLIC y era SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.registrar_checkin(
    p_codigo TEXT,
    p_cantidad INTEGER,
    p_evento_id BIGINT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invitado RECORD;
    v_pases_utilizados INTEGER;
    v_pases_disponibles INTEGER;
    v_checkin_id BIGINT;
BEGIN
    -- SECURITY DEFINER ignora RLS: validar explícitamente el rol del llamador
    IF NOT public.is_admin() THEN
        RETURN json_build_object('success', false, 'status', 403, 'error', 'Acceso denegado: se requiere rol de administrador.');
    END IF;

    -- Validar cantidad
    IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
        RETURN json_build_object('success', false, 'status', 400, 'error', 'La cantidad debe ser un entero mayor a 0.');
    END IF;

    -- Bloquear y obtener al invitado para evitar condiciones de carrera (FOR UPDATE)
    SELECT * INTO v_invitado
    FROM public.invitados
    WHERE UPPER(TRIM(codigo)) = UPPER(TRIM(p_codigo))
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'status', 404, 'error', 'Invitación no encontrada. El código no corresponde a un invitado válido.');
    END IF;

    -- Validar aislamiento por evento
    IF p_evento_id IS NOT NULL AND v_invitado.evento_id <> p_evento_id THEN
        RETURN json_build_object('success', false, 'status', 403, 'error', 'El invitado no pertenece al evento especificado.');
    END IF;

    -- Validar RSVP
    IF v_invitado.confirmado IS NULL THEN
        RETURN json_build_object('success', false, 'status', 409, 'error', 'RSVP pendiente: Este invitado todavía no ha confirmado su asistencia.');
    END IF;

    IF v_invitado.confirmado = false THEN
        RETURN json_build_object('success', false, 'status', 409, 'error', 'Invitación rechazada: El invitado indicó que no asistirá.');
    END IF;

    -- Validar pases confirmados
    IF v_invitado.pases_confirmados IS NULL OR v_invitado.pases_confirmados <= 0 THEN
        RETURN json_build_object('success', false, 'status', 409, 'error', 'El invitado no cuenta con pases confirmados.');
    END IF;

    -- Calcular pases ya utilizados
    SELECT COALESCE(SUM(cantidad), 0) INTO v_pases_utilizados
    FROM public.checkins
    WHERE invitado_id = v_invitado.id;

    v_pases_disponibles := v_invitado.pases_confirmados - v_pases_utilizados;

    IF v_pases_disponibles <= 0 THEN
        RETURN json_build_object('success', false, 'status', 400, 'error', 'Entrada completa: Todos los pases confirmados ya fueron utilizados.');
    END IF;

    IF p_cantidad > v_pases_disponibles THEN
        RETURN json_build_object(
            'success', false,
            'status', 400,
            'error', format('No es posible registrar %s personas. Solo quedan %s pases disponibles.', p_cantidad, v_pases_disponibles)
        );
    END IF;

    -- Insertar registro en checkins
    INSERT INTO public.checkins (evento_id, invitado_id, cantidad)
    VALUES (v_invitado.evento_id, v_invitado.id, p_cantidad)
    RETURNING id INTO v_checkin_id;

    -- Retornar resultado exitoso con métricas actualizadas
    RETURN json_build_object(
        'success', true,
        'status', 200,
        'message', 'Entrada registrada correctamente.',
        'data', json_build_object(
            'checkin_id', v_checkin_id,
            'invitado_id', v_invitado.id,
            'nombre', v_invitado.nombre,
            'evento_id', v_invitado.evento_id,
            'cantidad', p_cantidad,
            'pases_confirmados', v_invitado.pases_confirmados,
            'pases_utilizados', v_pases_utilizados + p_cantidad,
            'pases_disponibles', v_pases_disponibles - p_cantidad
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_checkin(TEXT, INTEGER, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_checkin(TEXT, INTEGER, BIGINT) TO authenticated;

-- 7. Diagnóstico (solo lectura): verifica que RLS esté habilitado y revisa las políticas.
--    Cualquier tabla con rowsecurity = false ignora TODAS las políticas anteriores.
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- SELECT tablename, policyname, permissive, roles, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;


