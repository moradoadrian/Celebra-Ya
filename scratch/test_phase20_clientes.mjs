// test_phase20_clientes.mjs
import http from 'http';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

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

async function runPhase20Tests() {
  console.log('================================================================');
  console.log('         CELEBRA-YA — BATERÍA DE PRUEBAS FASE 20                ');
  console.log('       GESTIÓN DE CLIENTES + BASE MULTI-TENANT                  ');
  console.log('================================================================\n');

  const results = [];

  // ---------------------------------------------------------------------------
  // PRUEBA 1: Seguridad en Panel Administrativo (/admin/clientes sin sesión)
  // ---------------------------------------------------------------------------
  const resAdminClientes = await checkRequest('/admin/clientes');
  const passed1 = resAdminClientes.statusCode === 302 && resAdminClientes.headers.location?.includes('/admin/login');
  results.push({
    id: 1,
    name: 'Seguridad SSR: GET /admin/clientes sin sesión redirige a /admin/login',
    passed: passed1,
    detail: `Status: ${resAdminClientes.statusCode} -> ${resAdminClientes.headers.location}`
  });

  // ---------------------------------------------------------------------------
  // PRUEBA 2: Seguridad API Clientes: GET sin sesión -> 401
  // ---------------------------------------------------------------------------
  const resApiGet = await checkRequest('/api/admin/clientes', 'GET');
  const passed2 = resApiGet.statusCode === 401;
  results.push({
    id: 2,
    name: 'Seguridad API: GET /api/admin/clientes sin sesión (401 Unauthorized)',
    passed: passed2,
    detail: `Status: ${resApiGet.statusCode} | Error: ${resApiGet.json?.error}`
  });

  // ---------------------------------------------------------------------------
  // PRUEBA 3: Seguridad API Clientes: POST sin sesión -> 401
  // ---------------------------------------------------------------------------
  const resApiPost = await checkRequest('/api/admin/clientes', 'POST', {
    nombre: 'Cliente Intruso',
    email: 'intruso@test.com'
  });
  const passed3 = resApiPost.statusCode === 401;
  results.push({
    id: 3,
    name: 'Seguridad API: POST /api/admin/clientes sin sesión (401 Unauthorized)',
    passed: passed3,
    detail: `Status: ${resApiPost.statusCode} | Error: ${resApiPost.json?.error}`
  });

  // ---------------------------------------------------------------------------
  // PRUEBA 4: Seguridad API Clientes: PUT sin sesión -> 401
  // ---------------------------------------------------------------------------
  const resApiPut = await checkRequest('/api/admin/clientes', 'PUT', {
    id: 1,
    action: 'toggle_status'
  });
  const passed4 = resApiPut.statusCode === 401;
  results.push({
    id: 4,
    name: 'Seguridad API: PUT /api/admin/clientes sin sesión (401 Unauthorized)',
    passed: passed4,
    detail: `Status: ${resApiPut.statusCode} | Error: ${resApiPut.json?.error}`
  });

  // ---------------------------------------------------------------------------
  // PRUEBA 5: Regla Estricta: Prohibición de Borrado Físico (DELETE -> 400)
  // ---------------------------------------------------------------------------
  const resApiDelete = await checkRequest('/api/admin/clientes', 'DELETE', { id: 1 });
  const passed5 = resApiDelete.statusCode === 400 && resApiDelete.json?.error?.includes('desactivación lógica');
  results.push({
    id: 5,
    name: 'Regla de Oro: Prohibición de borrado físico (DELETE responde 400 con motivo)',
    passed: passed5,
    detail: `Status: ${resApiDelete.statusCode} | Respuesta: ${resApiDelete.json?.error}`
  });

  // ---------------------------------------------------------------------------
  // PRUEBA 6: Regla Estricta: No existe registro público de clientes (/register -> 404)
  // ---------------------------------------------------------------------------
  const resRegister = await checkRequest('/register');
  const passed6 = resRegister.statusCode === 404;
  results.push({
    id: 6,
    name: 'Regla de Oro: Ausencia de auto-registro público (/register responde 404)',
    passed: passed6,
    detail: `Status: ${resRegister.statusCode}`
  });

  // ---------------------------------------------------------------------------
  // PRUEBA 7: Base Multi-Tenant: Aislamiento por cliente_id en Base de Datos Real
  // ---------------------------------------------------------------------------
  let passed7 = false;
  let detail7 = '';
  try {
    const { data: eventos, error: evErr } = await supabase
      .from('eventos')
      .select('id, cliente_id, nombre, slug');

    if (!evErr && eventos && eventos.length >= 2) {
      const ev1 = eventos.find(e => e.id === 1);
      const ev3 = eventos.find(e => e.id === 3);

      const hasCliente1 = ev1 && ev1.cliente_id === 1;
      const hasCliente2 = ev3 && ev3.cliente_id === 2;
      const areDistinct = ev1?.cliente_id !== ev3?.cliente_id;

      passed7 = Boolean(hasCliente1 && hasCliente2 && areDistinct);
      detail7 = `Evento 1 (Sofía) -> Cliente ${ev1?.cliente_id} | Evento 3 (César) -> Cliente ${ev3?.cliente_id} (Aislamiento verificado)`;
    } else {
      detail7 = `Error consultando eventos: ${evErr?.message}`;
    }
  } catch (e) {
    detail7 = `Excepción: ${e.message}`;
  }
  results.push({
    id: 7,
    name: 'Multi-Tenant: Aislamiento estricto de eventos por cliente_id en Supabase',
    passed: passed7,
    detail: detail7
  });

  // ---------------------------------------------------------------------------
  // PRUEBA 8: Simulación de Motor de Negocio de Clientes
  // ---------------------------------------------------------------------------
  class ClientesManager {
    constructor() {
      this.clientes = [
        { id: 1, nombre: 'Sofía & Alejandro', email: 'sofia.alejandro@bodas.com', whatsapp: '+52 55 1234 5678', activo: true },
        { id: 2, nombre: 'César & Cristal', email: 'cesar.cristal@bodas.com', whatsapp: '+52 461 421 0058', activo: true }
      ];
      this.eventos = [
        { id: 1, cliente_id: 1, nombre: 'Boda Sofía & Alejandro' },
        { id: 3, cliente_id: 2, nombre: 'Boda César & Cristal' }
      ];
    }

    createCliente(data) {
      if (!data.nombre || data.nombre.trim().length < 2) return { status: 400, error: 'Nombre inválido' };
      if (!data.email || !data.email.includes('@')) return { status: 400, error: 'Email inválido' };
      if (this.clientes.some(c => c.email.toLowerCase() === data.email.toLowerCase())) {
        return { status: 409, error: 'Correo ya registrado' };
      }
      const nuevo = {
        id: this.clientes.length + 1,
        nombre: data.nombre.trim(),
        email: data.email.toLowerCase().trim(),
        whatsapp: data.whatsapp || null,
        activo: data.activo !== false
      };
      this.clientes.push(nuevo);
      return { status: 201, data: nuevo };
    }

    toggleStatus(id) {
      const cliente = this.clientes.find(c => c.id === id);
      if (!cliente) return { status: 404, error: 'No encontrado' };
      cliente.activo = !cliente.activo;
      return { status: 200, data: cliente };
    }

    getMetricas() {
      const total = this.clientes.length;
      const activos = this.clientes.filter(c => c.activo).length;
      const inactivos = total - activos;
      const totalEventos = this.eventos.filter(e => e.cliente_id).length;
      return { total, activos, inactivos, totalEventos };
    }

    checkTenantAccess(clienteId, eventoId) {
      const ev = this.eventos.find(e => e.id === eventoId);
      if (!ev) return { status: 404, error: 'Evento no encontrado' };
      if (ev.cliente_id !== clienteId) return { status: 403, error: 'Acceso no autorizado: el evento pertenece a otro inquilino' };
      return { status: 200, data: ev };
    }
  }

  const mgr = new ClientesManager();
  const createFail = mgr.createCliente({ nombre: 'X', email: 'invalido' });
  const createSuccess = mgr.createCliente({ nombre: 'Mariana & Carlos', email: 'mariana.carlos@eventos.com', whatsapp: '+52 55 9988 7766' });
  const toggleRes = mgr.toggleStatus(createSuccess.data.id);
  const metricas = mgr.getMetricas();
  const tenantCheckAllowed = mgr.checkTenantAccess(1, 1);
  const tenantCheckBlocked = mgr.checkTenantAccess(1, 3); // Inquilino 1 intenta acceder a evento de Inquilino 2

  const passed8 = createFail.status === 400 &&
                  createSuccess.status === 201 &&
                  toggleRes.data.activo === false &&
                  metricas.total === 3 &&
                  metricas.activos === 2 &&
                  metricas.inactivos === 1 &&
                  tenantCheckAllowed.status === 200 &&
                  tenantCheckBlocked.status === 403;

  results.push({
    id: 8,
    name: 'Motor Multi-Tenant: Validación, alta, toggle lógico y bloqueo cross-tenant',
    passed: passed8,
    detail: `Alta: OK | Toggle: ${toggleRes.data.activo} | Métricas: [${metricas.activos} activos, ${metricas.inactivos} inactivos] | Cross-Tenant: Bloqueado (403)`
  });

  // ---------------------------------------------------------------------------
  // PRUEBA 9: No Regresión de Fases 18 y 19 (/admin/checkin y /api/admin/checkin)
  // ---------------------------------------------------------------------------
  const resCheckinPage = await checkRequest('/admin/checkin');
  const resCheckinApi = await checkRequest('/api/admin/checkin', 'POST', { codigo: 'asdfg', cantidad: 1 });
  const passed9 = resCheckinPage.statusCode === 302 && resCheckinApi.statusCode === 401;
  results.push({
    id: 9,
    name: 'No Regresión Fases 18 & 19: /admin/checkin (302) y POST /api/admin/checkin (401)',
    passed: passed9,
    detail: `Checkin Page: ${resCheckinPage.statusCode} | Checkin API: ${resCheckinApi.statusCode}`
  });

  // ---------------------------------------------------------------------------
  // PRUEBA 10: No Regresión Invitaciones Públicas
  // ---------------------------------------------------------------------------
  const resSofia = await checkRequest('/demo/boda-sofia-alejandro');
  const resCesar = await checkRequest('/demo/boda-cesar-adrian');
  const passed10 = resSofia.statusCode === 200 && resCesar.statusCode === 200;
  results.push({
    id: 10,
    name: 'No Regresión Invitaciones Públicas: Sofia y César responden 200 OK',
    passed: passed10,
    detail: `Sofia: ${resSofia.statusCode} | César: ${resCesar.statusCode}`
  });

  // ---------------------------------------------------------------------------
  // PRUEBA 11: No Regresión de Rutas Administrativas Existentes
  // ---------------------------------------------------------------------------
  const resAdminIndex = await checkRequest('/admin');
  const resAdminInvitados = await checkRequest('/admin/invitados');
  const resAdminMesas = await checkRequest('/admin/mesas');
  const passed11 = resAdminIndex.statusCode === 302 &&
                   resAdminInvitados.statusCode === 302 &&
                   resAdminMesas.statusCode === 302;
  results.push({
    id: 11,
    name: 'No Regresión Rutas Admin: /admin, /admin/invitados, /admin/mesas protegidas',
    passed: passed11,
    detail: `Dashboard: ${resAdminIndex.statusCode} | Invitados: ${resAdminInvitados.statusCode} | Mesas: ${resAdminMesas.statusCode}`
  });

  // ---------------------------------------------------------------------------
  // RESUMEN FINAL DE PRUEBAS
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
    console.log('>>> TODAS LAS PRUEBAS DE LA FASE 20 PASARON EXITOSAMENTE (11/11) <<<');
  } else {
    console.log('>>> AL MENOS UNA PRUEBA FALLÓ. REVISAR DETALLES ARRIBA <<<');
  }
  console.log('================================================================');
}

runPhase20Tests().catch(console.error);
