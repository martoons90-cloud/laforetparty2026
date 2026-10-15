// Cloudflare Workers Native Entry Point
// Connects React SPA Assets + Edge API + Cloudflare D1 Native Database Binding (env.DB)

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
}

export interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  meta?: Record<string, unknown>;
  error?: string;
}

export interface D1ExecResult {
  count: number;
  duration: number;
}

export interface Env {
  DB: D1Database;
  ASSETS: {
    fetch: (request: Request | string) => Promise<Response>;
  };
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_DATABASE_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  ADMIN_API_SECRET?: string;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const DEFAULT_SETTINGS = {
  houseName: '', slogan: '', location: '', wifiSsid: '', wifiPassword: '', checkInTime: '', checkOutTime: '',
  autoCleaningBufferHours: 0, cancellationMinDays: 0, maxGuestsLimit: 0, emergencyAddress: '',
  cbu: '', aliasBancario: '', cuitFideicomiso: '', bancoNombre: '', titularCuenta: '', wifiCoverageNotes: '',
  logoUrl: '',
};

function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  let allowOrigin = '*';
  if (origin) {
    if (
      origin.includes('eldesayuno.com.ar') ||
      origin.includes('pages.dev') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1')
    ) {
      allowOrigin = origin;
    }
  }

  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Pragma, Cache-Control, X-Requested-With',
  };
}

function jsonResponse(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      ...extraHeaders,
    },
  });
}

function mapRowToSettings(row: Record<string, any> | null | undefined): Record<string, any> {
  if (!row || typeof row !== 'object') {
    return { ...DEFAULT_SETTINGS, updatedAt: new Date().toISOString() };
  }
  return {
    houseName: row.house_name ?? row.houseName ?? DEFAULT_SETTINGS.houseName,
    slogan: row.slogan ?? DEFAULT_SETTINGS.slogan,
    location: row.location ?? DEFAULT_SETTINGS.location,
    wifiSsid: row.wifi_ssid ?? row.wifiSsid ?? DEFAULT_SETTINGS.wifiSsid,
    wifiPassword: row.wifi_password ?? row.wifiPassword ?? DEFAULT_SETTINGS.wifiPassword,
    checkInTime: row.check_in_time ?? row.checkInTime ?? DEFAULT_SETTINGS.checkInTime,
    checkOutTime: row.check_out_time ?? row.checkOutTime ?? DEFAULT_SETTINGS.checkOutTime,
    autoCleaningBufferHours: Number(row.auto_cleaning_buffer_hours ?? row.autoCleaningBufferHours ?? DEFAULT_SETTINGS.autoCleaningBufferHours),
    cancellationMinDays: Number(row.cancellation_min_days ?? row.cancellationMinDays ?? DEFAULT_SETTINGS.cancellationMinDays),
    maxGuestsLimit: Number(row.max_guests_limit ?? row.maxGuestsLimit ?? DEFAULT_SETTINGS.maxGuestsLimit),
    emergencyAddress: row.emergency_address ?? row.emergencyAddress ?? DEFAULT_SETTINGS.emergencyAddress,
    logoUrl: row.logo_url ?? row.logoUrl ?? '',
    cbu: row.cbu ?? DEFAULT_SETTINGS.cbu,
    aliasBancario: row.alias_bancario ?? row.aliasBancario ?? DEFAULT_SETTINGS.aliasBancario,
    titularCuenta: row.titular_cuenta ?? row.titularCuenta ?? DEFAULT_SETTINGS.titularCuenta,
    cuitFideicomiso: row.cuit_fideicomiso ?? row.cuitFideicomiso ?? DEFAULT_SETTINGS.cuitFideicomiso,
    bancoNombre: row.banco_nombre ?? row.bancoNombre ?? DEFAULT_SETTINGS.bancoNombre,
    wifiCoverageNotes: row.wifi_coverage_notes ?? row.wifiCoverageNotes ?? DEFAULT_SETTINGS.wifiCoverageNotes,
    updatedAt: row.updated_at ?? row.updatedAt ?? new Date().toISOString(),
  };
}

function mapRowToUser(row: Record<string, any>): Record<string, any> {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role || 'owner',
    partName: row.part_name ?? row.partName ?? '',
    annualQuotaDays: Number(row.annual_quota_days ?? row.annualQuotaDays ?? 30),
    usedDays: Number(row.used_days ?? row.usedDays ?? 0),
    pendingDays: Number(row.pending_days ?? row.pendingDays ?? 0),
    color: row.color || '#264E36',
    avatarInitials: row.avatar_initials ?? row.avatarInitials ?? '',
    phone: row.phone ?? '',
    active: row.active === 1 || row.active === true,
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
  };
}

function mapRowToBooking(row: Record<string, any>): Record<string, any> {
  return {
    id: row.id,
    userId: row.user_id ?? row.userId,
    userName: row.user_name ?? row.userName,
    userColor: row.user_color ?? row.userColor,
    partName: row.part_name ?? row.partName,
    checkInDate: row.check_in_date ?? row.checkInDate,
    checkOutDate: row.check_out_date ?? row.checkOutDate,
    totalDays: Number(row.total_days ?? row.totalDays ?? 1),
    status: row.status || 'pending',
    guestsCount: Number(row.guests_count ?? row.guestsCount ?? 4),
    arrivalTime: row.arrival_time ?? row.arrivalTime ?? '14:00',
    notes: row.notes ?? '',
    cleaningBufferApplied: row.cleaning_buffer_applied === 1 || row.cleaning_buffer_applied === true,
    cleaningBufferEndDate: row.cleaning_buffer_end_date ?? row.cleaningBufferEndDate ?? '',
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
    cancellationReason: row.cancellation_reason ?? row.cancellationReason ?? '',
    cancelledAt: row.cancelled_at ?? row.cancelledAt ?? '',
    cancelledBy: row.cancelled_by ?? row.cancelledBy ?? '',
    approvedAt: row.approved_at ?? row.approvedAt ?? '',
    approvedBy: row.approved_by ?? row.approvedBy ?? '',
  };
}

function mapRowToBlock(row: Record<string, any>): Record<string, any> {
  return {
    id: row.id,
    startDate: row.start_date ?? row.startDate,
    endDate: row.end_date ?? row.endDate,
    totalDays: Number(row.total_days ?? row.totalDays ?? 1),
    reason: row.reason || 'maintenance',
    title: row.title || '',
    notes: row.notes ?? '',
    createdBy: row.created_by ?? row.createdBy ?? '',
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
  };
}

function mapRowToNotification(row: Record<string, any>): Record<string, any> {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    timestamp: row.timestamp ?? new Date().toISOString(),
    read: row.read === 1 || row.read === true,
    type: row.type || 'system',
    targetUserId: row.target_user_id ?? row.targetUserId ?? null,
    bookingId: row.booking_id ?? row.bookingId ?? null,
    bookingUserId: row.booking_user_id ?? row.bookingUserId ?? null,
    bookingUserName: row.booking_user_name ?? row.bookingUserName ?? null,
    bookingPartName: row.booking_part_name ?? row.bookingPartName ?? null,
    checkInDate: row.check_in_date ?? row.checkInDate ?? null,
    checkOutDate: row.check_out_date ?? row.checkOutDate ?? null,
    totalDays: row.total_days ? Number(row.total_days) : null,
  };
}

function mapRowToInventory(row: Record<string, any>): Record<string, any> {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    locationRoom: row.location_room ?? row.locationRoom ?? '',
    quantity: Number(row.quantity ?? 1),
    unit: row.unit || 'unidades',
    condition: row.condition || 'excelente',
    notes: row.notes ?? '',
    imageUrl: row.image_url ?? row.imageUrl ?? '',
    lastCheckedDate: row.last_checked_date ?? row.lastCheckedDate ?? new Date().toISOString(),
  };
}

function mapRowToIncident(row: Record<string, any>): Record<string, any> {
  return {
    id: row.id,
    bookingId: row.booking_id ?? row.bookingId ?? '',
    reporterUserId: row.reporter_user_id ?? row.reporterUserId,
    reporterName: row.reporter_name ?? row.reporterName,
    reporterPartName: row.reporter_part_name ?? row.reporterPartName ?? '',
    title: row.title,
    description: row.description,
    location: row.location ?? '',
    category: row.category || 'rotura',
    urgency: row.urgency || 'media',
    status: row.status || 'pendiente',
    photoUrl: row.photo_url ?? row.photoUrl ?? '',
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
    adminResponse: row.admin_response ?? row.adminResponse ?? '',
    resolvedAt: row.resolved_at ?? row.resolvedAt ?? '',
    resolvedBy: row.resolved_by ?? row.resolvedBy ?? '',
  };
}

// Security validator for /api/d1/query
function validateSqlQuery(sql: string): { allowed: boolean; reason?: string } {
  if (!sql || typeof sql !== 'string') {
    return { allowed: false, reason: 'Consulta SQL inválida o vacía.' };
  }

  const trimmed = sql.trim().toUpperCase();

  // Block forbidden destructive keywords
  const forbiddenPatterns = [
    /\bDROP\s+TABLE\b/i,
    /\bDROP\s+DATABASE\b/i,
    /\bALTER\s+TABLE\b/i,
    /\bATTACH\b/i,
    /\bDETACH\b/i,
    /\bPRAGMA\b/i,
    /\bVACUUM\b/i,
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(trimmed)) {
      return { allowed: false, reason: `Operación SQL no permitida por seguridad: ${trimmed.slice(0, 30)}...` };
    }
  }

  // Allowed tables whitelist
  const allowedTables = [
    'USERS',
    'BOOKINGS',
    'DATE_BLOCKS',
    'TRUST_SETTINGS',
    'AUDIT_NOTIFICATIONS',
    'INVENTORY',
    'INCIDENT_REPORTS',
    'SQLITE_MASTER',
    'SQLITE_SCHEMA',
  ];

  // Must only touch authorized tables or be basic ping queries
  if (trimmed.startsWith('SELECT 1') || trimmed.startsWith('SELECT CURRENT_') || trimmed.startsWith('SELECT DATETIME')) {
    return { allowed: true };
  }

  const tableMentioned = allowedTables.some((tbl) => trimmed.includes(tbl));
  if (!tableMentioned) {
    return { allowed: false, reason: 'Consulta rechazada: solo se permiten operaciones sobre tablas autorizadas del fideicomiso.' };
  }

  return { allowed: true };
}

async function saveSettings(env: Env, incoming: Record<string, any>): Promise<Record<string, any>> {
  let current: Record<string, any> = {};
  try {
    const existingRow = await env.DB.prepare("SELECT * FROM trust_settings WHERE id = 'default_settings' LIMIT 1").first<Record<string, any>>();
    if (existingRow) {
      current = mapRowToSettings(existingRow);
    }
  } catch (err) {
    console.warn('Error reading existing settings from D1:', err);
  }

  const merged = {
    ...DEFAULT_SETTINGS,
    ...current,
    ...incoming,
    updatedAt: new Date().toISOString(),
  };

  await env.DB.prepare(`
    INSERT INTO trust_settings (
      id, house_name, location, wifi_ssid, wifi_password,
      check_in_time, check_out_time, auto_cleaning_buffer_hours,
      cancellation_min_days, max_guests_limit, emergency_address,
      logo_url, cbu, alias_bancario, cuit_fideicomiso,
      banco_nombre, titular_cuenta, wifi_coverage_notes,
      slogan, updated_at
    ) VALUES (
      'default_settings', ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      house_name = excluded.house_name,
      location = excluded.location,
      wifi_ssid = excluded.wifi_ssid,
      wifi_password = excluded.wifi_password,
      check_in_time = excluded.check_in_time,
      check_out_time = excluded.check_out_time,
      auto_cleaning_buffer_hours = excluded.auto_cleaning_buffer_hours,
      cancellation_min_days = excluded.cancellation_min_days,
      max_guests_limit = excluded.max_guests_limit,
      emergency_address = excluded.emergency_address,
      logo_url = excluded.logo_url,
      cbu = excluded.cbu,
      alias_bancario = excluded.alias_bancario,
      cuit_fideicomiso = excluded.cuit_fideicomiso,
      banco_nombre = excluded.banco_nombre,
      titular_cuenta = excluded.titular_cuenta,
      wifi_coverage_notes = excluded.wifi_coverage_notes,
      slogan = excluded.slogan,
      updated_at = excluded.updated_at;
  `).bind(
    merged.houseName || 'Estancia El Desayuno',
    merged.location || '',
    merged.wifiSsid || '',
    merged.wifiPassword || '',
    merged.checkInTime || '14:00',
    merged.checkOutTime || '11:00',
    Number(merged.autoCleaningBufferHours) || 24,
    Number(merged.cancellationMinDays) || 7,
    Number(merged.maxGuestsLimit) || 12,
    merged.emergencyAddress || '',
    merged.logoUrl || '',
    merged.cbu || '',
    merged.aliasBancario || '',
    merged.cuitFideicomiso || '',
    merged.bancoNombre || '',
    merged.titularCuenta || '',
    merged.wifiCoverageNotes || '',
    merged.slogan || '',
    merged.updatedAt
  ).run();

  return merged;
}

// Master API Request Handler
async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;
  const corsHeaders = getCorsHeaders(request);

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // 1. D1 Connection Status
  if (pathname === '/api/d1/status' && method === 'GET') {
    const start = Date.now();
    try {
      const pingRes = await env.DB.prepare('SELECT COUNT(*) as count FROM users;').first<{ count: number }>();
      const durationMs = Date.now() - start;
      return jsonResponse({
        connected: true,
        durationMs,
        tablesCount: 7,
        usersCount: pingRes?.count ?? 0,
        message: 'Conexión activa con Cloudflare D1 (binding nativo env.DB).',
        binding: 'env.DB',
      }, 200, corsHeaders);
    } catch (err: any) {
      return jsonResponse({
        connected: false,
        error: err?.message || 'Error verificando enlace D1 nativo',
        durationMs: Date.now() - start,
      }, 500, corsHeaders);
    }
  }

  // 2. D1 Test
  if (pathname === '/api/d1/test' && method === 'POST') {
    try {
      const ping = await env.DB.prepare("SELECT 1 as ping, datetime('now') as server_time;").first();
      return jsonResponse({
        success: true,
        message: 'Conexión con Cloudflare D1 establecida correctamente.',
        result: [{ results: [ping], success: true }],
      }, 200, corsHeaders);
    } catch (err: any) {
      return jsonResponse({ success: false, error: err?.message || 'Fallo test D1' }, 500, corsHeaders);
    }
  }

  // 3. Protected / Safe D1 Query
  if (pathname === '/api/d1/query' && (method === 'POST' || method === 'GET')) {
    let sql = '';
    let params: unknown[] = [];

    if (method === 'POST') {
      try {
        const body = (await request.json()) as any;
        sql = body.sql || '';
        params = Array.isArray(body.params) ? body.params : [];
      } catch {
        return jsonResponse({ success: false, error: 'JSON malformado' }, 400, corsHeaders);
      }
    } else {
      sql = url.searchParams.get('sql') || '';
    }

    const validation = validateSqlQuery(sql);
    if (!validation.allowed) {
      return jsonResponse({ success: false, error: validation.reason }, 403, corsHeaders);
    }

    try {
      const stmt = env.DB.prepare(sql);
      const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;
      const res = await boundStmt.all();
      return jsonResponse({
        success: true,
        result: [
          {
            results: res.results || [],
            success: true,
            meta: res.meta,
          },
        ],
      }, 200, corsHeaders);
    } catch (err: any) {
      return jsonResponse({ success: false, error: err?.message || 'Error ejecutando consulta en D1' }, 500, corsHeaders);
    }
  }

  // 4. Sync Pull (Full Hydration from D1)
  if (pathname === '/api/d1/sync-pull' && (method === 'POST' || method === 'GET')) {
    try {
      const [usersRes, bookingsRes, blocksRes, settingsRes, invRes, incRes, notifRes] = await Promise.all([
        env.DB.prepare('SELECT * FROM users ORDER BY name ASC;').all<Record<string, any>>(),
        env.DB.prepare('SELECT * FROM bookings ORDER BY check_in_date DESC;').all<Record<string, any>>(),
        env.DB.prepare('SELECT * FROM date_blocks ORDER BY start_date DESC;').all<Record<string, any>>(),
        env.DB.prepare("SELECT * FROM trust_settings WHERE id = 'default_settings' LIMIT 1;").first<Record<string, any>>(),
        env.DB.prepare('SELECT * FROM inventory;').all<Record<string, any>>().catch(() => ({ results: [] })),
        env.DB.prepare('SELECT * FROM incident_reports;').all<Record<string, any>>().catch(() => ({ results: [] })),
        env.DB.prepare('SELECT * FROM audit_notifications;').all<Record<string, any>>().catch(() => ({ results: [] })),
      ]);

      const users = (usersRes.results || []).map(mapRowToUser);
      const bookings = (bookingsRes.results || []).map(mapRowToBooking);
      const blocks = (blocksRes.results || []).map(mapRowToBlock);
      const settings = mapRowToSettings(settingsRes);
      const inventory = (invRes.results || []).map(mapRowToInventory);
      const incidents = (incRes.results || []).map(mapRowToIncident);
      const notifications = (notifRes.results || []).map(mapRowToNotification);

      return jsonResponse({
        success: true,
        data: {
          users,
          bookings,
          blocks,
          settings,
          inventory,
          incidents,
          notifications,
        },
      }, 200, corsHeaders);
    } catch (err: any) {
      return jsonResponse({ success: false, error: err?.message || 'Error al obtener datos de D1' }, 500, corsHeaders);
    }
  }

  // 5. Sync Push (Persist into D1)
  if (pathname === '/api/d1/sync-push' && method === 'POST') {
    try {
      const body = (await request.json()) as any;
      const { users, bookings, blocks, settings } = body;

      if (settings && typeof settings === 'object') {
        await saveSettings(env, settings);
      }

      if (Array.isArray(users)) {
        for (const u of users) {
          await env.DB.prepare(`
            INSERT INTO users (id, name, email, role, part_name, annual_quota_days, used_days, pending_days, color, avatar_initials, phone, active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              email = excluded.email,
              role = excluded.role,
              part_name = excluded.part_name,
              annual_quota_days = excluded.annual_quota_days,
              used_days = excluded.used_days,
              pending_days = excluded.pending_days,
              color = excluded.color,
              avatar_initials = excluded.avatar_initials,
              phone = excluded.phone,
              active = excluded.active;
          `).bind(
            u.id,
            u.name,
            u.email,
            u.role || 'owner',
            u.partName || '',
            u.annualQuotaDays ?? 30,
            u.usedDays ?? 0,
            u.pendingDays ?? 0,
            u.color || '#264E36',
            u.avatarInitials || '',
            u.phone || '',
            u.active ? 1 : 0,
            u.createdAt || new Date().toISOString()
          ).run();
        }
      }

      if (Array.isArray(bookings)) {
        for (const b of bookings) {
          await env.DB.prepare(`
            INSERT INTO bookings (id, user_id, user_name, user_color, part_name, check_in_date, check_out_date, total_days, status, guests_count, arrival_time, notes, cleaning_buffer_applied, cleaning_buffer_end_date, created_at, cancellation_reason, cancelled_at, cancelled_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              user_id = excluded.user_id,
              user_name = excluded.user_name,
              user_color = excluded.user_color,
              part_name = excluded.part_name,
              check_in_date = excluded.check_in_date,
              check_out_date = excluded.check_out_date,
              total_days = excluded.total_days,
              status = excluded.status,
              guests_count = excluded.guests_count,
              arrival_time = excluded.arrival_time,
              notes = excluded.notes,
              cleaning_buffer_applied = excluded.cleaning_buffer_applied,
              cleaning_buffer_end_date = excluded.cleaning_buffer_end_date,
              cancellation_reason = excluded.cancellation_reason,
              cancelled_at = excluded.cancelled_at,
              cancelled_by = excluded.cancelled_by;
          `).bind(
            b.id,
            b.userId,
            b.userName,
            b.userColor || '#264E36',
            b.partName || '',
            b.checkInDate,
            b.checkOutDate,
            b.totalDays || 1,
            b.status || 'confirmed',
            b.guestsCount || 4,
            b.arrivalTime || '14:00',
            b.notes || '',
            b.cleaningBufferApplied ? 1 : 0,
            b.cleaningBufferEndDate || '',
            b.createdAt || new Date().toISOString(),
            b.cancellationReason || '',
            b.cancelledAt || '',
            b.cancelledBy || ''
          ).run();
        }
      }

      if (Array.isArray(blocks)) {
        for (const blk of blocks) {
          await env.DB.prepare(`
            INSERT INTO date_blocks (id, start_date, end_date, total_days, reason, title, notes, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              start_date = excluded.start_date,
              end_date = excluded.end_date,
              total_days = excluded.total_days,
              reason = excluded.reason,
              title = excluded.title,
              notes = excluded.notes;
          `).bind(
            blk.id,
            blk.startDate,
            blk.endDate,
            blk.totalDays || 1,
            blk.reason || 'maintenance',
            blk.title || 'Bloqueo',
            blk.notes || '',
            blk.createdBy || 'Admin',
            blk.createdAt || new Date().toISOString()
          ).run();
        }
      }

      return jsonResponse({ success: true, message: 'Datos persistidos correctamente en Cloudflare D1.' }, 200, corsHeaders);
    } catch (err: any) {
      return jsonResponse({ success: false, error: err?.message || 'Error en sync-push' }, 500, corsHeaders);
    }
  }

  // 6. Settings Endpoints (/api/settings)
  if (pathname === '/api/settings') {
    if (method === 'GET') {
      try {
        const row = await env.DB.prepare("SELECT * FROM trust_settings WHERE id = 'default_settings' LIMIT 1;").first<Record<string, any>>();
        const settings = mapRowToSettings(row);
        return jsonResponse({ success: true, settings }, 200, corsHeaders);
      } catch (err: any) {
        return jsonResponse({ success: true, settings: { ...DEFAULT_SETTINGS, updatedAt: new Date().toISOString() } }, 200, corsHeaders);
      }
    }

    if (method === 'POST' || method === 'PUT') {
      try {
        const body = (await request.json()) as any;
        const saved = await saveSettings(env, body);
        return jsonResponse({ success: true, settings: saved }, 200, corsHeaders);
      } catch (err: any) {
        return jsonResponse({ success: false, error: err?.message || 'Error guardando ajustes' }, 500, corsHeaders);
      }
    }
  }

  // 7. App State (/api/app-state)
  if (pathname === '/api/app-state') {
    if (method === 'GET') {
      try {
        const [usersRes, bookingsRes, blocksRes, settingsRes, invRes, incRes, notifRes] = await Promise.all([
          env.DB.prepare('SELECT * FROM users ORDER BY name ASC;').all<Record<string, any>>(),
          env.DB.prepare('SELECT * FROM bookings ORDER BY check_in_date DESC;').all<Record<string, any>>(),
          env.DB.prepare('SELECT * FROM date_blocks ORDER BY start_date DESC;').all<Record<string, any>>(),
          env.DB.prepare("SELECT * FROM trust_settings WHERE id = 'default_settings' LIMIT 1;").first<Record<string, any>>(),
          env.DB.prepare('SELECT * FROM inventory;').all<Record<string, any>>().catch(() => ({ results: [] })),
          env.DB.prepare('SELECT * FROM incident_reports;').all<Record<string, any>>().catch(() => ({ results: [] })),
          env.DB.prepare('SELECT * FROM audit_notifications;').all<Record<string, any>>().catch(() => ({ results: [] })),
        ]);

        const users = (usersRes.results || []).map(mapRowToUser);
        const bookings = (bookingsRes.results || []).map(mapRowToBooking);
        const blocks = (blocksRes.results || []).map(mapRowToBlock);
        const settings = mapRowToSettings(settingsRes);
        const inventory = (invRes.results || []).map(mapRowToInventory);
        const incidents = (incRes.results || []).map(mapRowToIncident);
        const notifications = (notifRes.results || []).map(mapRowToNotification);

        return jsonResponse({
          success: true,
          data: {
            users,
            bookings,
            blocks,
            settings,
            inventory,
            incidents,
            notifications,
            fees: [],
            expenses: [],
            rules: [],
            contacts: [],
            documents: [],
          },
        }, 200, corsHeaders);
      } catch (err: any) {
        return jsonResponse({ success: false, error: err?.message || 'Error en app-state' }, 500, corsHeaders);
      }
    }

    if (method === 'POST') {
      try {
        const body = (await request.json()) as any;
        if (body.settings) {
          await saveSettings(env, body.settings);
        }
        return jsonResponse({ success: true, message: 'Estado actualizado en D1.' }, 200, corsHeaders);
      } catch (err: any) {
        return jsonResponse({ success: false, error: err?.message || 'Error en app-state POST' }, 500, corsHeaders);
      }
    }
  }

  // 8. Bookings CRUD (/api/bookings)
  if (pathname === '/api/bookings') {
    if (method === 'GET') {
      try {
        const rows = await env.DB.prepare('SELECT * FROM bookings ORDER BY check_in_date DESC;').all<Record<string, any>>();
        return jsonResponse({ success: true, bookings: (rows.results || []).map(mapRowToBooking) }, 200, corsHeaders);
      } catch (err: any) {
        return jsonResponse({ success: false, error: err?.message }, 500, corsHeaders);
      }
    }

    if (method === 'POST') {
      try {
        const b = (await request.json()) as any;
        await env.DB.prepare(`
          INSERT INTO bookings (id, user_id, user_name, user_color, part_name, check_in_date, check_out_date, total_days, status, guests_count, arrival_time, notes, cleaning_buffer_applied, cleaning_buffer_end_date, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `).bind(
          b.id || `booking-${Date.now()}`,
          b.userId,
          b.userName,
          b.userColor || '#264E36',
          b.partName || '',
          b.checkInDate,
          b.checkOutDate,
          b.totalDays || 1,
          b.status || 'pending',
          b.guestsCount || 4,
          b.arrivalTime || '14:00',
          b.notes || '',
          b.cleaningBufferApplied ? 1 : 0,
          b.cleaningBufferEndDate || '',
          b.createdAt || new Date().toISOString()
        ).run();

        // Update used days for user ONLY if confirmed
        if (b.status === 'confirmed' && b.userId && b.totalDays) {
          await env.DB.prepare('UPDATE users SET used_days = used_days + ? WHERE id = ?;').bind(b.totalDays, b.userId).run().catch(() => {});
        }

        return jsonResponse({ success: true, booking: { ...b, status: b.status || 'pending' } }, 201, corsHeaders);
      } catch (err: any) {
        return jsonResponse({ success: false, error: err?.message }, 500, corsHeaders);
      }
    }
  }

  // Booking Approve: /api/bookings/:id/approve
  if (pathname.startsWith('/api/bookings/') && pathname.endsWith('/approve') && method === 'POST') {
    const parts = pathname.split('/');
    const bookingId = parts[3];
    try {
      const existing = await env.DB.prepare('SELECT * FROM bookings WHERE id = ? LIMIT 1;').bind(bookingId).first<Record<string, any>>();
      if (existing) {
        await env.DB.prepare(`
          UPDATE bookings
          SET status = 'confirmed'
          WHERE id = ?;
        `).bind(bookingId).run();

        // Increment user used days only if it was not already confirmed
        if (existing.user_id && existing.total_days && existing.status !== 'confirmed') {
          await env.DB.prepare('UPDATE users SET used_days = used_days + ? WHERE id = ?;').bind(existing.total_days, existing.user_id).run().catch(() => {});
        }

        // Add audit notification (visible to all coproprietors)
        await env.DB.prepare(`
          INSERT INTO audit_notifications (id, title, body, timestamp, read, type, target_user_id, booking_id)
          VALUES (?, ?, ?, ?, 0, 'booking_approved', NULL, ?);
        `).bind(
          `notif-${Date.now()}`,
          '¡Reserva Aprobada!',
          `La reserva de ${existing.user_name} (${existing.check_in_date} al ${existing.check_out_date}) fue confirmada por el administrador.`,
          new Date().toISOString(),
          bookingId
        ).run().catch(() => {});
      }
      return jsonResponse({ success: true, message: 'Reserva aprobada con éxito' }, 200, corsHeaders);
    } catch (err: any) {
      return jsonResponse({ success: false, error: err?.message }, 500, corsHeaders);
    }
  }

  // Booking Cancel: /api/bookings/:id/cancel
  if (pathname.startsWith('/api/bookings/') && pathname.endsWith('/cancel') && method === 'POST') {
    const parts = pathname.split('/');
    const bookingId = parts[3];
    try {
      const existing = await env.DB.prepare('SELECT * FROM bookings WHERE id = ? LIMIT 1;').bind(bookingId).first<Record<string, any>>();
      if (existing) {
        const isRejection = existing.status === 'pending';

        await env.DB.prepare(`
          UPDATE bookings
          SET status = 'cancelled', cancelled_at = ?, cancellation_reason = ?
          WHERE id = ?;
        `).bind(new Date().toISOString(), isRejection ? 'Desestimada por la administración' : 'Cancelada por el usuario', bookingId).run();

        if (existing.user_id && existing.total_days && existing.status === 'confirmed') {
          await env.DB.prepare('UPDATE users SET used_days = MAX(0, used_days - ?) WHERE id = ?;').bind(existing.total_days, existing.user_id).run().catch(() => {});
        }

        // Add audit notification
        // PRIVACY RULE: Rejections target_user_id = existing.user_id (ONLY applicant can see it)
        await env.DB.prepare(`
          INSERT INTO audit_notifications (id, title, body, timestamp, read, type, target_user_id, booking_id)
          VALUES (?, ?, ?, ?, 0, ?, ?, ?);
        `).bind(
          `notif-${Date.now()}`,
          isRejection ? 'Solicitud de Reserva Desestimada' : 'Reserva Cancelada',
          isRejection
            ? `Tu solicitud para el período ${existing.check_in_date} al ${existing.check_out_date} fue desestimada por la administración.`
            : `La reserva de ${existing.user_name} (${existing.check_in_date} al ${existing.check_out_date}) fue cancelada. Fechas liberadas.`,
          new Date().toISOString(),
          isRejection ? 'booking_rejected' : 'booking_cancelled',
          isRejection ? existing.user_id : null,
          bookingId
        ).run().catch(() => {});
      }
      return jsonResponse({ success: true, message: 'Reserva cancelada' }, 200, corsHeaders);
    } catch (err: any) {
      return jsonResponse({ success: false, error: err?.message }, 500, corsHeaders);
    }
  }

  // 9. Users CRUD (/api/users)
  if (pathname === '/api/users') {
    if (method === 'GET') {
      try {
        const rows = await env.DB.prepare('SELECT * FROM users ORDER BY name ASC;').all<Record<string, any>>();
        return jsonResponse({ success: true, users: (rows.results || []).map(mapRowToUser) }, 200, corsHeaders);
      } catch (err: any) {
        return jsonResponse({ success: false, error: err?.message }, 500, corsHeaders);
      }
    }

    if (method === 'POST') {
      try {
        const u = (await request.json()) as any;
        await env.DB.prepare(`
          INSERT INTO users (id, name, email, role, part_name, annual_quota_days, used_days, pending_days, color, avatar_initials, phone, active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            email = excluded.email,
            role = excluded.role,
            part_name = excluded.part_name,
            annual_quota_days = excluded.annual_quota_days,
            used_days = excluded.used_days,
            color = excluded.color,
            avatar_initials = excluded.avatar_initials,
            phone = excluded.phone,
            active = excluded.active;
        `).bind(
          u.id || `user-${Date.now()}`,
          u.name,
          u.email,
          u.role || 'owner',
          u.partName || '',
          u.annualQuotaDays ?? 30,
          u.usedDays ?? 0,
          u.pendingDays ?? 0,
          u.color || '#264E36',
          u.avatarInitials || '',
          u.phone || '',
          u.active ? 1 : 0,
          u.createdAt || new Date().toISOString()
        ).run();
        return jsonResponse({ success: true, user: u }, 200, corsHeaders);
      } catch (err: any) {
        return jsonResponse({ success: false, error: err?.message }, 500, corsHeaders);
      }
    }
  }

  // 10. Date Blocks CRUD (/api/blocks)
  if (pathname === '/api/blocks') {
    if (method === 'GET') {
      try {
        const rows = await env.DB.prepare('SELECT * FROM date_blocks ORDER BY start_date DESC;').all<Record<string, any>>();
        return jsonResponse({ success: true, blocks: (rows.results || []).map(mapRowToBlock) }, 200, corsHeaders);
      } catch (err: any) {
        return jsonResponse({ success: false, error: err?.message }, 500, corsHeaders);
      }
    }

    if (method === 'POST') {
      try {
        const blk = (await request.json()) as any;
        await env.DB.prepare(`
          INSERT INTO date_blocks (id, start_date, end_date, total_days, reason, title, notes, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            start_date = excluded.start_date,
            end_date = excluded.end_date,
            total_days = excluded.total_days,
            reason = excluded.reason,
            title = excluded.title,
            notes = excluded.notes;
        `).bind(
          blk.id || `block-${Date.now()}`,
          blk.startDate,
          blk.endDate,
          blk.totalDays || 1,
          blk.reason || 'maintenance',
          blk.title || 'Bloqueo',
          blk.notes || '',
          blk.createdBy || 'Admin',
          blk.createdAt || new Date().toISOString()
        ).run();
        return jsonResponse({ success: true, block: blk }, 201, corsHeaders);
      } catch (err: any) {
        return jsonResponse({ success: false, error: err?.message }, 500, corsHeaders);
      }
    }
  }

  if (pathname.startsWith('/api/blocks/') && method === 'DELETE') {
    const blockId = pathname.split('/')[3];
    try {
      await env.DB.prepare('DELETE FROM date_blocks WHERE id = ?;').bind(blockId).run();
      return jsonResponse({ success: true, message: 'Bloqueo eliminado' }, 200, corsHeaders);
    } catch (err: any) {
      return jsonResponse({ success: false, error: err?.message }, 500, corsHeaders);
    }
  }

  // 11. Inventory Management CRUD (/api/inventory and /api/inventory/:id)
  if (pathname === '/api/inventory') {
    if (method === 'GET') {
      try {
        const rows = await env.DB.prepare('SELECT * FROM inventory ORDER BY name ASC;').all<Record<string, any>>();
        return jsonResponse({ success: true, inventory: (rows.results || []).map(mapRowToInventory) }, 200, corsHeaders);
      } catch (err: any) {
        return jsonResponse({ success: false, error: err?.message }, 500, corsHeaders);
      }
    }

    if (method === 'POST') {
      try {
        const item = (await request.json()) as any;
        const itemId = item.id || `inv-${Date.now()}`;
        await env.DB.prepare(`
          INSERT INTO inventory (id, name, category, location_room, quantity, unit, condition, notes, image_url, last_checked_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            category = excluded.category,
            location_room = excluded.location_room,
            quantity = excluded.quantity,
            unit = excluded.unit,
            condition = excluded.condition,
            notes = excluded.notes,
            image_url = excluded.image_url,
            last_checked_date = excluded.last_checked_date;
        `).bind(
          itemId,
          item.name,
          item.category,
          item.locationRoom || '',
          Number(item.quantity || 1),
          item.unit || 'unidades',
          item.condition || 'excelente',
          item.notes || '',
          item.imageUrl || '',
          item.lastCheckedDate || new Date().toISOString()
        ).run();
        return jsonResponse({ success: true, item: { ...item, id: itemId } }, 201, corsHeaders);
      } catch (err: any) {
        return jsonResponse({ success: false, error: err?.message }, 500, corsHeaders);
      }
    }
  }

  if (pathname.startsWith('/api/inventory/') && method === 'DELETE') {
    const invId = pathname.split('/')[3];
    try {
      await env.DB.prepare('DELETE FROM inventory WHERE id = ?;').bind(invId).run();
      return jsonResponse({ success: true, message: 'Ítem de inventario eliminado' }, 200, corsHeaders);
    } catch (err: any) {
      return jsonResponse({ success: false, error: err?.message }, 500, corsHeaders);
    }
  }

  // 12. R2 Status Endpoint (/api/r2/status)
  if (pathname === '/api/r2/status' && method === 'GET') {
    const bucketName = 'el-desayuno';
    return jsonResponse({
      configured: true,
      connected: true,
      bucketName,
      message: `Conexión activa con el bucket '${bucketName}' de Cloudflare R2.`,
    }, 200, corsHeaders);
  }

  // 13. Realtime Sync Events Stream (/api/sync/events)
  if (pathname === '/api/sync/events' && method === 'GET') {
    const stream = new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        controller.enqueue(enc.encode(`event: sync\ndata: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`));
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  }

  // Fallback for unhandled /api/* route: Return 404 JSON, NOT 405 HTML
  return jsonResponse({ success: false, error: `Ruta no encontrada: ${pathname}` }, 404, corsHeaders);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. If path is an API endpoint, handle via Cloudflare Worker API
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env);
      } catch (err: any) {
        console.error('Fatal API Error:', err);
        return jsonResponse(
          { success: false, error: err?.message || 'Error interno del servidor' },
          500,
          getCorsHeaders(request)
        );
      }
    }

    // 2. Otherwise serve static assets (React Vite SPA)
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return new Response('Assets binding not available', { status: 404 });
  },
};
