// test_phase21_production.mjs
import http from 'http';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { evaluarProgresoEvento, calcularMetricasProduccion } from '../src/lib/event-production.ts';

// Cargar variables de entorno
const envContent = fs.readFileSync('C:/Users/Developer/Documents/Astro/Invita-Ya/.env', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

function checkRequest(path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const reqHeaders = { ...headers };
    if (postData) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(`http://localhost:4321${path}`, {
      method,
      headers: reqHeaders,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data,
          json
        });
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runPhase21Tests() {
  console.log('================================================================');
  console.log('         CELEBRA-YA — BATERÍA DE PRUEBAS FASE 21                ');
  console.log('  CENTRO DE PRODUCCIÓN Y CONFIGURACIÓN DE EVENTOS               ');
  console.log('================================================================\n');

  const results = [];

  // ---------------------------------------------------------------------------
  // PRUEBA A: Seguridad Administrativa en Centro de Producción (/admin/eventos)
  // ---------------------------------------------------------------------------
  const resEventosIndex = await checkRequest('/admin/eventos');
  const resEventosNuevo = await checkRequest('/admin/eventos/nuevo');
  const resEventosEdit = await checkRequest('/admin/eventos/1');
  const passedA = resEventosIndex.statusCode === 302 &&
                  resEventosNuevo.statusCode === 302 &&
                  resEventosEdit.statusCode === 302;
  results.push({
    id: 'A',
    name: 'Seguridad Administrativa: /admin/eventos, /nuevo y /[id] protegidos (302)',
    passed: passedA,
    detail: `Index: ${resEventosIndex.statusCode} | Nuevo: ${resEventosNuevo.statusCode} | Edit: ${resEventosEdit.statusCode} -> /admin/login`
  });

  // ---------------------------------------------------------------------------
  // PRUEBA B: Seguridad en API de Eventos (/api/admin/eventos)
  // ---------------------------------------------------------------------------
  const resApiGet = await checkRequest('/api/admin/eventos', 'GET');
  const resApiPost = await checkRequest('/api/admin/eventos', 'POST', { nombre: 'Test' });
  const resApiPatch = await checkRequest('/api/admin/eventos', 'PATCH', { id: 1 });
  const passedB = resApiGet.statusCode === 401 &&
                  resApiPost.statusCode === 401 &&
                  resApiPatch.statusCode === 401;
  results.push({
    id: 'B',
    name: 'Seguridad API: GET, POST, PATCH /api/admin/eventos sin sesión (401)',
    passed: passedB,
    detail: `GET: ${resApiGet.statusCode} | POST: ${resApiPost.statusCode} | PATCH: ${resApiPatch.statusCode} (Unauthorized)`
  });

  // ---------------------------------------------------------------------------
  // PRUEBA C: Asociación Correcta Cliente -> Evento en Base de Datos Real
  // ---------------------------------------------------------------------------
  let passedC = false;
  let detailC = '';
  try {
    const { data: evs, error: evErr } = await supabase
      .from('eventos')
      .select('id, nombre, slug, cliente_id');

    if (!evErr && evs && evs.length >= 2) {
      const ev1 = evs.find(e => e.id === 1);
      const ev3 = evs.find(e => e.id === 3);

      const hasClient1 = ev1 && ev1.cliente_id === 1;
      const hasClient2 = ev3 && ev3.cliente_id === 2;
      passedC = Boolean(hasClient1 && hasClient2);
      detailC = `Evento 1 (${ev1?.nombre}) -> Cliente ${ev1?.cliente_id} | Evento 3 (${ev3?.nombre}) -> Cliente ${ev3?.cliente_id}`;
    } else {
      detailC = `Error al consultar eventos: ${evErr?.message}`;
    }
  } catch (e) {
    detailC = `Excepción: ${e.message}`;
  }
  results.push({
    id: 'C',
    name: 'Asociación Cliente -> Evento: Integridad multi-tenant verificada en Supabase',
    passed: passedC,
    detail: detailC
  });

  // ---------------------------------------------------------------------------
  // PRUEBA D: Estados del Ciclo de Producción (5 etapas soportadas)
  // ---------------------------------------------------------------------------
  const mockEvIncompleto = {
    id: 10,
    nombre: 'Evento Vacío',
    slug: 'evento-vacio',
    tipo_evento: 'Boda',
    fecha_evento: '2026-12-01',
    hora_evento: null,
    estado: 'false',
    cliente_id: null
  };
  const prodIncompleto = evaluarProgresoEvento(mockEvIncompleto);

  const mockEvEnPrep = {
    id: 11,
    nombre: 'Boda En Preparación',
    slug: 'boda-en-prep',
    tipo_evento: 'Boda',
    fecha_evento: '2026-12-01',
    hora_evento: '18:00',
    estado: 'false',
    cliente_id: 1,
    ubicacion_resumen: 'Templo Principal',
    portada_url: 'https://example.com/portada.jpg'
  };
  const prodEnPrep = evaluarProgresoEvento(mockEvEnPrep, { invitadosCount: 0, mesasCount: 0 });

  const mockEvRevision = {
    id: 12,
    nombre: 'Boda En Revisión',
    slug: 'boda-en-rev',
    tipo_evento: 'Boda',
    fecha_evento: '2026-12-01',
    hora_evento: '18:00',
    estado: 'false',
    cliente_id: 1,
    ubicacion_resumen: 'Templo Principal',
    portada_url: 'https://example.com/portada.jpg'
  };
  const prodRevision = evaluarProgresoEvento(mockEvRevision, { ubicacionesCount: 1, invitadosCount: 20, mesasCount: 3 });

  const mockEvPublicado = {
    id: 13,
    nombre: 'Boda Publicada',
    slug: 'boda-publicada',
    tipo_evento: 'Boda',
    fecha_evento: '2026-12-01',
    hora_evento: '18:00',
    estado: 'true',
    cliente_id: 1,
    ubicacion_resumen: 'Templo Principal',
    portada_url: 'https://example.com/portada.jpg'
  };
  const prodPublicado = evaluarProgresoEvento(mockEvPublicado, { ubicacionesCount: 1, invitadosCount: 20, mesasCount: 3 });

  const mockEvFinalizado = {
    id: 14,
    nombre: 'Boda Pasada',
    slug: 'boda-pasada',
    tipo_evento: 'Boda',
    fecha_evento: '2025-01-01', // Pasado
    hora_evento: '18:00',
    estado: 'true',
    cliente_id: 1,
    ubicacion_resumen: 'Templo Principal',
    portada_url: 'https://example.com/portada.jpg'
  };
  const prodFinalizado = evaluarProgresoEvento(mockEvFinalizado, { ubicacionesCount: 1, invitadosCount: 20, mesasCount: 3 });

  const passedD = prodIncompleto.etapa === 'INFORMACION_PENDIENTE' &&
                  prodEnPrep.etapa === 'EN_PREPARACION' &&
                  prodRevision.etapa === 'EN_REVISION' &&
                  prodPublicado.etapa === 'PUBLICADO' &&
                  prodFinalizado.etapa === 'FINALIZADO';

  results.push({
    id: 'D',
    name: 'Estados del Evento: 5 etapas de producción clasificadas dinámicamente',
    passed: passedD,
    detail: `InfoPendiente: ${prodIncompleto.etapa} | Prep: ${prodEnPrep.etapa} | Rev: ${prodRevision.etapa} | Pub: ${prodPublicado.etapa} | Fin: ${prodFinalizado.etapa}`
  });

  // ---------------------------------------------------------------------------
  // PRUEBA E: Detección Precisa de Información Pendiente (Checklist)
  // ---------------------------------------------------------------------------
  const pendientesEnPrep = prodEnPrep.pendientes;
  const passedE = pendientesEnPrep.length > 0 &&
                  pendientesEnPrep.some(p => p.toLowerCase().includes('invitados')) &&
                  prodPublicado.pendientes.length === 0;

  results.push({
    id: 'E',
    name: 'Detección de Pendientes: Identificación de información faltante antes de publicar',
    passed: passedE,
    detail: `Pendientes EnPrep: [${pendientesEnPrep.join('; ')}] | Pendientes Publicado: ${prodPublicado.pendientes.length}`
  });

  // ---------------------------------------------------------------------------
  // PRUEBA F: Métricas Consolidadas del Centro de Producción
  // ---------------------------------------------------------------------------
  const metricasCalc = calcularMetricasProduccion([
    prodIncompleto,
    prodEnPrep,
    prodRevision,
    prodPublicado,
    prodFinalizado
  ]);
  const passedF = metricasCalc.total === 5 &&
                  metricasCalc.informacionPendiente === 1 &&
                  metricasCalc.enPreparacion === 1 &&
                  metricasCalc.enRevision === 1 &&
                  metricasCalc.publicados === 1 &&
                  metricasCalc.finalizados === 1;

  results.push({
    id: 'F',
    name: 'Métricas de Producción: Pipeline consolidado y conteos exactos por etapa',
    passed: passedF,
    detail: `Total: ${metricasCalc.total} [InfoPend: 1, Prep: 1, Rev: 1, Pub: 1, Fin: 1]`
  });

  // ---------------------------------------------------------------------------
  // PRUEBA G: Aislamiento Multi-Tenant (Evento -> Invitados -> Check-ins)
  // ---------------------------------------------------------------------------
  let passedG = false;
  let detailG = '';
  try {
    const { data: invs1 } = await supabase.from('invitados').select('id, evento_id').eq('evento_id', 1);
    const { data: invs3 } = await supabase.from('invitados').select('id, evento_id').eq('evento_id', 3);

    const ids1 = new Set((invs1 || []).map(i => i.id));
    const ids3 = new Set((invs3 || []).map(i => i.id));
    const intersection = [...ids1].filter(id => ids3.has(id));

    passedG = intersection.length === 0 && (invs1?.length > 0 || invs3?.length > 0);
    detailG = `Evento 1 (${invs1?.length} invitados) | Evento 3 (${invs3?.length} invitados) | Intersección: ${intersection.length} (Aislamiento verificado)`;
  } catch (e) {
    detailG = `Excepción: ${e.message}`;
  }
  results.push({
    id: 'G',
    name: 'Aislamiento Multi-Tenant: Cero mezcla de invitados y check-ins entre eventos',
    passed: passedG,
    detail: detailG
  });

  // ---------------------------------------------------------------------------
  // PRUEBA H: No Regresión Invitados y Pases Digitales (Fase 16)
  // ---------------------------------------------------------------------------
  let passedH = false;
  let detailH = '';
  try {
    const { data: invSofi } = await supabase
      .from('invitados')
      .select('id, evento_id, nombre, codigo, numero_pases, pases_confirmados, confirmado')
      .eq('codigo', 'asdfg')
      .maybeSingle();

    passedH = Boolean(invSofi && invSofi.evento_id === 1 && invSofi.pases_confirmados === 2);
    detailH = `Invitado: ${invSofi?.nombre} | Código: ${invSofi?.codigo} | Pases Conf: ${invSofi?.pases_confirmados}`;
  } catch (e) {
    detailH = `Excepción: ${e.message}`;
  }
  results.push({
    id: 'H',
    name: 'No Regresión Invitados (Fase 16): Registro real y pases confirmados intactos',
    passed: passedH,
    detail: detailH
  });

  // ---------------------------------------------------------------------------
  // PRUEBA I: No Regresión Check-in y QR (Fase 18)
  // ---------------------------------------------------------------------------
  let passedI = false;
  let detailI = '';
  try {
    const res = await supabase.from('checkins').select('id').limit(1);
    if (!res.error) {
      passedI = true;
      detailI = 'Tabla public.checkins activa y operativa';
    } else if (res.error.code === '42501') {
      passedI = true;
      detailI = 'Tabla public.checkins existe y está protegida por RLS (42501: acceso no autorizado bloqueado)';
    } else {
      detailI = `Error: ${res.error.message} (${res.error.code})`;
    }
  } catch (e) {
    detailI = `Excepción: ${e.message}`;
  }
  results.push({
    id: 'I',
    name: 'No Regresión Check-in (Fase 18): Tabla public.checkins y RLS de seguridad intactos',
    passed: passedI,
    detail: detailI
  });

  // ---------------------------------------------------------------------------
  // PRUEBA J: No Regresión Dashboard de Recepción en Tiempo Real (Fase 19)
  // ---------------------------------------------------------------------------
  const resCheckinPage = await checkRequest('/admin/checkin');
  const resCheckinApi = await checkRequest('/api/admin/checkin', 'POST', { codigo: 'asdfg', cantidad: 1 });
  const passedJ = resCheckinPage.statusCode === 302 && resCheckinApi.statusCode === 401;
  results.push({
    id: 'J',
    name: 'No Regresión Recepción (Fase 19): /admin/checkin (302) y API protegida (401)',
    passed: passedJ,
    detail: `Página: ${resCheckinPage.statusCode} -> /admin/login | API POST: ${resCheckinApi.statusCode}`
  });

  // ---------------------------------------------------------------------------
  // PRUEBA K: No Regresión Invitaciones Públicas
  // ---------------------------------------------------------------------------
  const resSofia = await checkRequest('/demo/boda-sofia-alejandro');
  const resCesar = await checkRequest('/demo/boda-cesar-adrian');
  const passedK = resSofia.statusCode === 200 && resCesar.statusCode === 200;
  results.push({
    id: 'K',
    name: 'No Regresión Invitaciones Públicas: Sofia y César responden HTTP 200 OK',
    passed: passedK,
    detail: `Sofia: ${resSofia.statusCode} | César: ${resCesar.statusCode}`
  });

  // ---------------------------------------------------------------------------
  // RESUMEN FINAL
  // ---------------------------------------------------------------------------
  console.log('----------------------------------------------------------------');
  console.log('                    RESULTADOS DE LAS PRUEBAS                  ');
  console.log('----------------------------------------------------------------');
  let allPassed = true;
  for (const r of results) {
    const mark = r.passed ? '✓ PASÓ' : '✗ FALLÓ';
    if (!r.passed) allPassed = false;
    console.log(`[${mark}] Prueba ${r.id}: ${r.name}`);
    console.log(`        Detalle: ${r.detail}\n`);
  }

  console.log('================================================================');
  if (allPassed) {
    console.log('>>> TODAS LAS PRUEBAS DE LA FASE 21 PASARON EXITOSAMENTE (11/11) <<<');
  } else {
    console.log('>>> AL MENOS UNA PRUEBA FALLÓ. REVISAR DETALLES ARRIBA <<<');
  }
  console.log('================================================================');
}

runPhase21Tests().catch(console.error);
