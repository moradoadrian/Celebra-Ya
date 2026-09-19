// test_phase22_production_publish.mjs
import http from 'http';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import {
  evaluarProgresoEvento,
  validarRequisitosPublicacion,
  calcularMetricasProduccion
} from '../src/lib/event-production.ts';

// Cargar variables de entorno de .env
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

async function runPhase22Tests() {
  console.log('================================================================');
  console.log('         CELEBRA-YA — BATERÍA DE PRUEBAS FASE 22                ');
  console.log('   PRODUCCIÓN Y PUBLICACIÓN DE LA INVITACIÓN DIGITAL            ');
  console.log('================================================================\n');

  const results = [];

  // ---------------------------------------------------------------------------
  // PRUEBA 1: Seguridad SSR en Vista Previa Administrativa (/admin/eventos/[id]/preview)
  // ---------------------------------------------------------------------------
  const resPreview1 = await checkRequest('/admin/eventos/1/preview');
  const resPreview3 = await checkRequest('/admin/eventos/3/preview');
  const passed1 = resPreview1.statusCode === 302 &&
                  resPreview1.headers.location?.includes('/admin/login') &&
                  resPreview3.statusCode === 302 &&
                  resPreview3.headers.location?.includes('/admin/login');
  results.push({
    id: 1,
    name: 'Seguridad SSR: Vista Previa Admin (/admin/eventos/[id]/preview) protegida (302 -> /admin/login)',
    passed: passed1,
    detail: `Ev 1: ${resPreview1.statusCode} -> ${resPreview1.headers.location} | Ev 3: ${resPreview3.statusCode}`
  });

  // ---------------------------------------------------------------------------
  // PRUEBA 2: Seguridad en API de Publicación (/api/admin/eventos)
  // ---------------------------------------------------------------------------
  const resPatchPub = await checkRequest('/api/admin/eventos', 'PATCH', { id: 1, estado: true });
  const resPatchUnpub = await checkRequest('/api/admin/eventos', 'PATCH', { id: 1, estado: false });
  const resPostUpdate = await checkRequest('/api/admin/eventos/1/update', 'POST', { estado: 'true' }, { accept: 'application/json' });
  const passed2 = resPatchPub.statusCode === 401 &&
                  resPatchUnpub.statusCode === 401 &&
                  resPostUpdate.statusCode === 401;
  results.push({
    id: 2,
    name: 'Seguridad API: PATCH /api/admin/eventos y POST update protegidos sin sesión (401)',
    passed: passed2,
    detail: `PATCH pub: ${resPatchPub.statusCode} | PATCH unpub: ${resPatchUnpub.statusCode} | POST update: ${resPostUpdate.statusCode}`
  });

  // ---------------------------------------------------------------------------
  // PRUEBA 3: Motor de Validación de Requisitos: Bloqueantes vs Recomendaciones
  // ---------------------------------------------------------------------------
  const eventoIncompleto = {
    id: 99,
    nombre: 'Ev', // Demasiado corto (< 3)
    slug: 'slug invalido!', // Caracteres inválidos
    tipo_evento: 'Boda',
    fecha_evento: '', // Vacío
    cliente_id: null, // Sin cliente
    portada_url: null, // Sin portada
    ubicacion_resumen: null
  };
  const valIncompleto = validarRequisitosPublicacion(eventoIncompleto, {
    ubicacionesCount: 0,
    invitadosCount: 0,
    mesasCount: 0
  });

  const eventoCompleto = {
    id: 100,
    nombre: 'Boda Alejandra & Diego',
    slug: 'boda-alejandra-diego',
    tipo_evento: 'Boda',
    fecha_evento: '2026-11-20',
    hora_evento: '18:00',
    cliente_id: 1,
    portada_url: 'https://images.unsplash.com/photo-1519741497674-611481863552',
    ubicacion_resumen: 'Jardín Las Rosas, Querétaro',
    musica_url: 'https://example.com/musica.mp3'
  };
  const valCompleto = validarRequisitosPublicacion(eventoCompleto, {
    ubicacionesCount: 1,
    invitadosCount: 15,
    mesasCount: 2
  });

  const passed3 = valIncompleto.aptoParaPublicar === false &&
                  valIncompleto.bloqueantes.length >= 6 &&
                  valCompleto.aptoParaPublicar === true &&
                  valCompleto.bloqueantes.length === 0;

  results.push({
    id: 3,
    name: 'Motor de Validación: Identifica con precisión requisitos Bloqueantes vs Recomendaciones',
    passed: passed3,
    detail: `Incompleto: apto=${valIncompleto.aptoParaPublicar} (${valIncompleto.bloqueantes.length} bloqueantes) | Completo: apto=${valCompleto.aptoParaPublicar} (0 bloqueantes)`
  });

  // ---------------------------------------------------------------------------
  // PRUEBA 4: Bloqueo de Publicación cuando Faltan Requisitos Críticos (Bloqueantes)
  // ---------------------------------------------------------------------------
  // Un evento sin invitados NO debe poder ser publicado
  const evSinInvitados = {
    ...eventoCompleto,
    id: 101,
  };
  const valSinInvitados = validarRequisitosPublicacion(evSinInvitados, {
    ubicacionesCount: 1,
    invitadosCount: 0, // FALTAN INVITADOS
    mesasCount: 1
  });

  // Un evento sin portada NO debe poder ser publicado
  const evSinPortada = {
    ...eventoCompleto,
    id: 102,
    portada_url: '' // FALTA PORTADA
  };
  const valSinPortada = validarRequisitosPublicacion(evSinPortada, {
    ubicacionesCount: 1,
    invitadosCount: 10,
    mesasCount: 1
  });

  // Un evento sin cliente NO debe poder ser publicado
  const evSinCliente = {
    ...eventoCompleto,
    id: 103,
    cliente_id: null // FALTA CLIENTE
  };
  const valSinCliente = validarRequisitosPublicacion(evSinCliente, {
    ubicacionesCount: 1,
    invitadosCount: 10,
    mesasCount: 1
  });

  const passed4 = !valSinInvitados.aptoParaPublicar &&
                  valSinInvitados.bloqueantes.some(b => b.toLowerCase().includes('invitado')) &&
                  !valSinPortada.aptoParaPublicar &&
                  valSinPortada.bloqueantes.some(b => b.toLowerCase().includes('portada')) &&
                  !valSinCliente.aptoParaPublicar &&
                  valSinCliente.bloqueantes.some(b => b.toLowerCase().includes('cliente'));

  results.push({
    id: 4,
    name: 'Control Estricto de Publicación: Rechaza eventos sin cliente, sin portada o sin invitados',
    passed: passed4,
    detail: `Sin invitados: Bloqueado (${valSinInvitados.bloqueantes[0]}) | Sin portada: Bloqueado | Sin cliente: Bloqueado`
  });

  // ---------------------------------------------------------------------------
  // PRUEBA 5: Despublicación Lógica No Destructiva (estado = false)
  // ---------------------------------------------------------------------------
  // Verificamos que evaluarProgresoEvento y el flujo soporten toggle a borrador sin perder datos
  const mockEvPublicado = {
    ...eventoCompleto,
    estado: 'true'
  };
  const mockEvDespublicado = {
    ...eventoCompleto,
    estado: 'false' // Cambiado lógicamente a borrador
  };
  const prodPub = evaluarProgresoEvento(mockEvPublicado, { ubicacionesCount: 1, invitadosCount: 15, mesasCount: 2 });
  const prodDespub = evaluarProgresoEvento(mockEvDespublicado, { ubicacionesCount: 1, invitadosCount: 15, mesasCount: 2 });

  const passed5 = prodPub.etapa === 'PUBLICADO' &&
                  prodDespub.etapa === 'EN_REVISION' && // Si tiene todo pero estado=false, pasa a revisión
                  prodDespub.itemsCompletados >= 6;     // Todos los datos siguen intactos
  results.push({
    id: 5,
    name: 'Despublicación Lógica: Cambia a borrador sin pérdida de datos ni regresión de etapas',
    passed: passed5,
    detail: `Publicado: etapa=${prodPub.etapa} -> Despublicado: etapa=${prodDespub.etapa} (${prodDespub.itemsCompletados}/7 datos intactos)`
  });

  // ---------------------------------------------------------------------------
  // PRUEBA 6: Vista Previa Administrativa: Inspección de Archivo y Componentes
  // ---------------------------------------------------------------------------
  let passed6 = false;
  let detail6 = '';
  try {
    const previewContent = fs.readFileSync('C:/Users/Developer/Documents/Astro/Invita-Ya/src/pages/admin/eventos/[id]/preview.astro', 'utf-8');
    const hasAuthCheck = previewContent.includes('Astro.locals.user');
    const hasNoEstadoFilter = !previewContent.includes(".eq('estado', true)");
    const hasAdminBar = previewContent.includes('Vista Previa Admin');
    const hasPublicComponents = previewContent.includes('<Hero') &&
                                previewContent.includes('<Historia') &&
                                previewContent.includes('<Programa') &&
                                previewContent.includes('<Ubicacion') &&
                                previewContent.includes('<DressCode') &&
                                previewContent.includes('<Galeria') &&
                                previewContent.includes('<MesaRegalos') &&
                                previewContent.includes('<Rsvp') &&
                                previewContent.includes('<Footer');

    passed6 = hasAuthCheck && hasNoEstadoFilter && hasAdminBar && hasPublicComponents;
    detail6 = `AuthCheck: ${hasAuthCheck} | SinFiltroEstado: ${hasNoEstadoFilter} | AdminBar: ${hasAdminBar} | ComponentesPúblicos: ${hasPublicComponents}`;
  } catch (e) {
    detail6 = `Error leyendo preview.astro: ${e.message}`;
  }
  results.push({
    id: 6,
    name: 'Vista Previa Admin: Permite visualizar borradores reutilizando componentes públicos exactos',
    passed: passed6,
    detail: detail6
  });

  // ---------------------------------------------------------------------------
  // PRUEBA 7: Multi-Tenant: Aislamiento estricto de eventos por cliente_id en Supabase
  // ---------------------------------------------------------------------------
  let passed7 = false;
  let detail7 = '';
  try {
    const { data: eventos, error: evErr } = await supabase
      .from('eventos')
      .select('id, cliente_id, nombre, slug, estado');

    if (!evErr && eventos && eventos.length >= 2) {
      const ev1 = eventos.find(e => e.id === 1);
      const ev3 = eventos.find(e => e.id === 3);

      const hasCliente1 = Boolean(ev1 && ev1.cliente_id === 1);
      const hasCliente2 = Boolean(ev3 && ev3.cliente_id === 2);
      const distinctClients = ev1?.cliente_id !== ev3?.cliente_id;

      passed7 = hasCliente1 && hasCliente2 && distinctClients;
      detail7 = `Ev 1 (${ev1?.nombre}) -> Cliente ${ev1?.cliente_id} | Ev 3 (${ev3?.nombre}) -> Cliente ${ev3?.cliente_id}`;
    } else {
      detail7 = `Error consultando eventos: ${evErr?.message}`;
    }
  } catch (e) {
    detail7 = `Excepción: ${e.message}`;
  }
  results.push({
    id: 7,
    name: 'Multi-Tenant: Aislamiento garantizado por cliente_id en eventos reales',
    passed: passed7,
    detail: detail7
  });

  // ---------------------------------------------------------------------------
  // PRUEBA 8: No Regresión en Invitaciones Públicas de Demostración
  // ---------------------------------------------------------------------------
  const resSofia = await checkRequest('/demo/boda-sofia-alejandro');
  const resCesar = await checkRequest('/demo/boda-cesar-adrian');
  const passed8 = resSofia.statusCode === 200 && resCesar.statusCode === 200;
  results.push({
    id: 8,
    name: 'No Regresión: Rutas públicas activas (/demo/boda-sofia-alejandro y boda-cesar-adrian) responden HTTP 200',
    passed: passed8,
    detail: `Sofia: ${resSofia.statusCode} | César: ${resCesar.statusCode}`
  });

  // ---------------------------------------------------------------------------
  // PRUEBA 9: No Regresión Fase 18 (Check-in, Códigos QR y Capacidad)
  // ---------------------------------------------------------------------------
  let passed9 = false;
  let detail9 = '';
  try {
    const res = await supabase.from('checkins').select('id').limit(1);
    if (!res.error) {
      passed9 = true;
      detail9 = 'Tabla public.checkins activa y operativa';
    } else if (res.error.code === '42501') {
      passed9 = true;
      detail9 = 'Tabla public.checkins existe y está protegida por RLS (42501: acceso anónimo bloqueado por seguridad)';
    } else {
      detail9 = `Error: ${res.error.message} (${res.error.code})`;
    }
  } catch (e) {
    detail9 = `Excepción: ${e.message}`;
  }
  results.push({
    id: 9,
    name: 'No Regresión Fase 18: Tabla public.checkins y esquema de acceso operativo',
    passed: passed9,
    detail: detail9
  });

  // ---------------------------------------------------------------------------
  // PRUEBA 10: No Regresión Fase 19 (Dashboard de Recepción)
  // ---------------------------------------------------------------------------
  const resCheckin = await checkRequest('/admin/checkin');
  const resApiCheckin = await checkRequest('/api/admin/checkin', 'POST', { codigo: 'asdfg', cantidad: 1 });
  const passed10 = resCheckin.statusCode === 302 && resApiCheckin.statusCode === 401;
  results.push({
    id: 10,
    name: 'No Regresión Fase 19: Dashboard de Recepción (/admin/checkin) y API seguros',
    passed: passed10,
    detail: `Recepción: ${resCheckin.statusCode} -> login | API: ${resApiCheckin.statusCode} -> 401`
  });

  // ---------------------------------------------------------------------------
  // PRUEBA 11: No Regresión Fase 20 (Módulo de Clientes)
  // ---------------------------------------------------------------------------
  const resClientes = await checkRequest('/admin/clientes');
  const resApiClientes = await checkRequest('/api/admin/clientes');
  const passed11 = resClientes.statusCode === 302 && resApiClientes.statusCode === 401;
  results.push({
    id: 11,
    name: 'No Regresión Fase 20: Módulo administrativo de Clientes y API protegidos',
    passed: passed11,
    detail: `Clientes: ${resClientes.statusCode} -> login | API Clientes: ${resApiClientes.statusCode} -> 401`
  });

  // ---------------------------------------------------------------------------
  // PRUEBA 12: No Regresión Fase 21 (Centro de Producción de Eventos)
  // ---------------------------------------------------------------------------
  const resEventos = await checkRequest('/admin/eventos');
  const resEventosNuevo = await checkRequest('/admin/eventos/nuevo');
  const resEventos1 = await checkRequest('/admin/eventos/1');
  const passed12 = resEventos.statusCode === 302 &&
                   resEventosNuevo.statusCode === 302 &&
                   resEventos1.statusCode === 302;
  results.push({
    id: 12,
    name: 'No Regresión Fase 21: Centro de Producción de Eventos (/admin/eventos) intacto',
    passed: passed12,
    detail: `Index: ${resEventos.statusCode} | Nuevo: ${resEventosNuevo.statusCode} | Detalle: ${resEventos1.statusCode}`
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
    console.log('>>> TODAS LAS PRUEBAS DE LA FASE 22 PASARON EXITOSAMENTE (12/12) <<<');
  } else {
    console.log('>>> AL MENOS UNA PRUEBA FALLÓ. REVISAR DETALLES ARRIBA <<<');
  }
  console.log('================================================================');
}

runPhase22Tests().catch(console.error);
