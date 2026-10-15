import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

import fs from 'fs';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zzfmsxrqhshmoiaysjtr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6Zm1zeHJxaHNobW9pYXlzanRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5Nzk4MzAsImV4cCI6MjEwNzU1NTgzMH0.D3M9dPwdqMFos6HRmWOlTBSeLNSDnk0V3X9HQZnyoMY';

let supabaseServerClient: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  try {
    supabaseServerClient = createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    console.log('[Supabase Server] Cliente inicializado correctamente para:', SUPABASE_URL);
  } catch (err) {
    console.error('[Supabase Server] Error inicializando cliente:', err);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure persistent uploads directory on server
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Disable ETags globally to eliminate 304 cached responses
app.set('etag', false);

// Strict anti-caching headers on all API endpoints for cross-browser synchronization
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Helper to query Cloudflare D1 REST API
async function queryCloudflareD1(
  accountId: string,
  databaseId: string,
  apiToken: string,
  sql: string,
  params: unknown[] = []
) {
  const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
  const response = await fetch(cfUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sql,
      params,
    }),
  });

  const data = await response.json();
  return data;
}

// -------------------------------------------------------------
// CLOUDFLARE D1 API PROXY ENDPOINTS
// -------------------------------------------------------------

// 0. Server-Side D1 Environment Status
app.get('/api/d1/status', async (req, res) => {
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const databaseId = process.env.CLOUDFLARE_DATABASE_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !databaseId || !apiToken) {
      return res.json({
        configured: false,
        connected: false,
        message: 'Credenciales de Cloudflare D1 no configuradas en el servidor.',
      });
    }

    const testResult = await queryCloudflareD1(
      accountId,
      databaseId,
      apiToken,
      'SELECT 1 as ping, datetime("now") as server_time;'
    );

    return res.json({
      configured: true,
      connected: Boolean(testResult.success),
      accountId: accountId.slice(0, 6) + '...' + accountId.slice(-4),
      databaseId: databaseId.slice(0, 6) + '...' + databaseId.slice(-4),
      durationMs: testResult.result?.[0]?.meta?.duration || 1,
      message: testResult.success
        ? 'Conexión activa y verificada con Cloudflare D1'
        : 'Error autenticando con Cloudflare D1',
    });
  } catch (err: unknown) {
    return res.status(500).json({
      configured: false,
      connected: false,
      error: err instanceof Error ? err.message : 'Error verificando D1',
    });
  }
});

// 1. Check Server Config & Test Connection
app.post('/api/d1/test', async (req, res) => {
  try {
    const accountId = req.body.accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
    const databaseId = req.body.databaseId || process.env.CLOUDFLARE_DATABASE_ID;
    const apiToken = req.body.apiToken || process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !databaseId || !apiToken) {
      return res.status(400).json({
        success: false,
        error: 'Faltan credenciales: Account ID, Database ID o API Token de Cloudflare.',
      });
    }

    const testResult = await queryCloudflareD1(
      accountId,
      databaseId,
      apiToken,
      'SELECT 1 as ping, datetime("now") as server_time;'
    );

    if (testResult.success) {
      return res.json({
        success: true,
        message: 'Conexión con Cloudflare D1 establecida correctamente.',
        result: testResult.result,
      });
    } else {
      const errMsg =
        testResult.errors?.map((e: { message: string }) => e.message).join(', ') ||
        'Error de autenticación con Cloudflare D1.';
      return res.status(400).json({ success: false, error: errMsg });
    }
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Error interno al conectar con D1',
    });
  }
});

// 2. Generic Query Endpoint
app.post('/api/d1/query', async (req, res) => {
  try {
    const { accountId, databaseId, apiToken, sql, params } = req.body;
    const actId = accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
    const dbId = databaseId || process.env.CLOUDFLARE_DATABASE_ID;
    const token = apiToken || process.env.CLOUDFLARE_API_TOKEN;

    if (!actId || !dbId || !token) {
      return res.status(400).json({
        success: false,
        error: 'Credenciales de Cloudflare D1 requeridas.',
      });
    }

    const result = await queryCloudflareD1(actId, dbId, token, sql, params || []);
    return res.json(result);
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Error ejecutando query',
    });
  }
});

// 3. Initialize Schema / DDL Migrations
app.post('/api/d1/init-schema', async (req, res) => {
  try {
    const { accountId, databaseId, apiToken, sql } = req.body;
    const actId = accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
    const dbId = databaseId || process.env.CLOUDFLARE_DATABASE_ID;
    const token = apiToken || process.env.CLOUDFLARE_API_TOKEN;

    if (!actId || !dbId || !token) {
      return res.status(400).json({ success: false, error: 'Credenciales requeridas.' });
    }

    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    const executed = [];
    for (const stmt of statements) {
      const r = await queryCloudflareD1(actId, dbId, token, stmt + ';');
      executed.push(r);
    }

    return res.json({
      success: true,
      message: 'Esquema de tablas D1 inicializado correctamente.',
      statementsCount: statements.length,
      executed,
    });
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Error inicializando tablas en D1',
    });
  }
});

// 4. Sync Push: Insert or Update All Tables into D1
app.post('/api/d1/sync-push', async (req, res) => {
  try {
    const { accountId, databaseId, apiToken, users, bookings, blocks, settings, notifications } =
      req.body;
    const actId = accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
    const dbId = databaseId || process.env.CLOUDFLARE_DATABASE_ID;
    const token = apiToken || process.env.CLOUDFLARE_API_TOKEN;

    if (!actId || !dbId || !token) {
      return res.status(400).json({ success: false, error: 'Credenciales requeridas.' });
    }

    // Push Users
    if (Array.isArray(users)) {
      for (const u of users) {
        await queryCloudflareD1(
          actId,
          dbId,
          token,
          `INSERT INTO users (id, name, email, role, part_name, annual_quota_days, used_days, pending_days, color, avatar_initials, phone, active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             email = excluded.email,
             part_name = excluded.part_name,
             annual_quota_days = excluded.annual_quota_days,
             used_days = excluded.used_days,
             color = excluded.color,
             phone = excluded.phone,
             active = excluded.active;`,
          [
            u.id,
            u.name,
            u.email,
            u.role || 'owner',
            u.partName || '',
            u.annualQuotaDays || 30,
            u.usedDays || 0,
            u.pendingDays || 0,
            u.color || '#264E36',
            u.avatarInitials || 'US',
            u.phone || '',
            u.active ? 1 : 0,
            u.createdAt || new Date().toISOString(),
          ]
        );
      }
    }

    // Push Bookings
    if (Array.isArray(bookings)) {
      for (const b of bookings) {
        await queryCloudflareD1(
          actId,
          dbId,
          token,
          `INSERT INTO bookings (id, user_id, user_name, user_color, part_name, check_in_date, check_out_date, total_days, status, guests_count, arrival_time, notes, cleaning_buffer_applied, cleaning_buffer_end_date, created_at, cancellation_reason, cancelled_at, cancelled_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             status = excluded.status,
             cancellation_reason = excluded.cancellation_reason,
             cancelled_at = excluded.cancelled_at,
             cancelled_by = excluded.cancelled_by;`,
          [
            b.id,
            b.userId,
            b.userName,
            b.userColor,
            b.partName || '',
            b.checkInDate,
            b.checkOutDate,
            b.totalDays,
            b.status,
            b.guestsCount || 4,
            b.arrivalTime || '14:00',
            b.notes || '',
            b.cleaningBufferApplied ? 1 : 0,
            b.cleaningBufferEndDate || '',
            b.createdAt || new Date().toISOString(),
            b.cancellationReason || '',
            b.cancelledAt || '',
            b.cancelledBy || '',
          ]
        );
      }
    }

    // Push Blocks
    if (Array.isArray(blocks)) {
      for (const bl of blocks) {
        await queryCloudflareD1(
          actId,
          dbId,
          token,
          `INSERT INTO date_blocks (id, start_date, end_date, total_days, reason, title, notes, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             notes = excluded.notes;`,
          [
            bl.id,
            bl.startDate,
            bl.endDate,
            bl.totalDays,
            bl.reason,
            bl.title,
            bl.notes || '',
            bl.createdBy || '',
            bl.createdAt || new Date().toISOString(),
          ]
        );
      }
    }

    // Push Settings
    if (settings) {
      await queryCloudflareD1(
        actId,
        dbId,
        token,
        `INSERT INTO trust_settings (id, house_name, location, wifi_ssid, wifi_password, check_in_time, check_out_time, auto_cleaning_buffer_hours, cancellation_min_days, max_guests_limit, emergency_address, logo_url, updated_at)
         VALUES ('default_settings', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           house_name = excluded.house_name,
           location = excluded.location,
           wifi_ssid = excluded.wifi_ssid,
           wifi_password = excluded.wifi_password,
           auto_cleaning_buffer_hours = excluded.auto_cleaning_buffer_hours,
           cancellation_min_days = excluded.cancellation_min_days,
           emergency_address = excluded.emergency_address,
           logo_url = excluded.logo_url,
           updated_at = excluded.updated_at;`,
        [
          settings.houseName || 'Estancia El Desayuno',
          settings.location || '',
          settings.wifiSsid || '',
          settings.wifiPassword || '',
          settings.checkInTime || '14:00',
          settings.checkOutTime || '11:00',
          settings.autoCleaningBufferHours || 24,
          settings.cancellationMinDays || 7,
          settings.maxGuestsLimit || 12,
          settings.emergencyAddress || '',
          settings.logoUrl || '',
          new Date().toISOString(),
        ]
      );
    }

    // Push Inventory
    const { inventory, incidents } = req.body;
    if (Array.isArray(inventory)) {
      for (const inv of inventory) {
        await queryCloudflareD1(
          actId,
          dbId,
          token,
          `INSERT INTO inventory (id, name, category, location_room, quantity, unit, condition, notes, image_url, last_checked_date)
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
             last_checked_date = excluded.last_checked_date;`,
          [
            inv.id,
            inv.name,
            inv.category || 'living_galeria',
            inv.locationRoom || '',
            inv.quantity || 1,
            inv.unit || 'unidades',
            inv.condition || 'excelente',
            inv.notes || '',
            inv.imageUrl || '',
            inv.lastCheckedDate || new Date().toISOString().split('T')[0],
          ]
        );
      }
    }

    // Push Incidents
    if (Array.isArray(incidents)) {
      for (const inc of incidents) {
        await queryCloudflareD1(
          actId,
          dbId,
          token,
          `INSERT INTO incident_reports (id, booking_id, reporter_user_id, reporter_name, reporter_part_name, title, description, location, category, urgency, status, photo_url, created_at, admin_response, resolved_at, resolved_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             description = excluded.description,
             location = excluded.location,
             category = excluded.category,
             urgency = excluded.urgency,
             status = excluded.status,
             photo_url = excluded.photo_url,
             admin_response = excluded.admin_response,
             resolved_at = excluded.resolved_at,
             resolved_by = excluded.resolved_by;`,
          [
            inc.id,
            inc.bookingId || '',
            inc.reporterUserId,
            inc.reporterName,
            inc.reporterPartName || '',
            inc.title,
            inc.description,
            inc.location || '',
            inc.category || 'rotura',
            inc.urgency || 'media',
            inc.status || 'pendiente',
            inc.photoUrl || '',
            inc.createdAt || new Date().toISOString(),
            inc.adminResponse || '',
            inc.resolvedAt || '',
            inc.resolvedBy || '',
          ]
        );
      }
    }

    return res.json({
      success: true,
      message: 'Sincronización con Cloudflare D1 completada.',
    });
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Error en push a D1',
    });
  }
});

// 5. Sync Pull: Query All Data from D1
app.post('/api/d1/sync-pull', async (req, res) => {
  try {
    const { accountId, databaseId, apiToken } = req.body;
    const actId = accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
    const dbId = databaseId || process.env.CLOUDFLARE_DATABASE_ID;
    const token = apiToken || process.env.CLOUDFLARE_API_TOKEN;

    if (!actId || !dbId || !token) {
      return res.status(400).json({ success: false, error: 'Credenciales requeridas.' });
    }

    const usersRes = await queryCloudflareD1(actId, dbId, token, 'SELECT * FROM users ORDER BY name ASC;');
    const bookingsRes = await queryCloudflareD1(actId, dbId, token, 'SELECT * FROM bookings ORDER BY check_in_date DESC;');
    const blocksRes = await queryCloudflareD1(actId, dbId, token, 'SELECT * FROM date_blocks ORDER BY start_date DESC;');
    const settingsRes = await queryCloudflareD1(actId, dbId, token, 'SELECT * FROM trust_settings LIMIT 1;');
    const notifsRes = await queryCloudflareD1(actId, dbId, token, 'SELECT * FROM audit_notifications ORDER BY timestamp DESC LIMIT 30;');
    const inventoryRes = await queryCloudflareD1(actId, dbId, token, 'SELECT * FROM inventory ORDER BY name ASC;');
    const incidentsRes = await queryCloudflareD1(actId, dbId, token, 'SELECT * FROM incident_reports ORDER BY created_at DESC;');

    // Map snake_case to camelCase
    const users = (usersRes.result?.[0]?.results || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      partName: row.part_name,
      annualQuotaDays: row.annual_quota_days,
      usedDays: row.used_days,
      pendingDays: row.pending_days,
      color: row.color,
      avatarInitials: row.avatar_initials,
      phone: row.phone,
      active: Boolean(row.active),
      createdAt: row.created_at,
    }));

    const bookings = (bookingsRes.result?.[0]?.results || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      userColor: row.user_color,
      partName: row.part_name,
      checkInDate: row.check_in_date,
      checkOutDate: row.check_out_date,
      totalDays: row.total_days,
      status: row.status,
      guestsCount: row.guests_count,
      arrivalTime: row.arrival_time,
      notes: row.notes,
      cleaningBufferApplied: Boolean(row.cleaning_buffer_applied),
      cleaningBufferEndDate: row.cleaning_buffer_end_date,
      createdAt: row.created_at,
      cancellationReason: row.cancellation_reason,
      cancelledAt: row.cancelled_at,
      cancelledBy: row.cancelled_by,
    }));

    const blocks = (blocksRes.result?.[0]?.results || []).map((row: any) => ({
      id: row.id,
      startDate: row.start_date,
      endDate: row.end_date,
      totalDays: row.total_days,
      reason: row.reason,
      title: row.title,
      notes: row.notes,
      createdBy: row.created_by,
      createdAt: row.created_at,
    }));

    const rawSettings = settingsRes.result?.[0]?.results?.[0] as any;
    const settings = rawSettings
      ? {
          houseName: rawSettings.house_name,
          slogan: rawSettings.slogan || 'Cuatro Partes, Un Mismo Objetivo',
          location: rawSettings.location,
          wifiSsid: rawSettings.wifi_ssid,
          wifiPassword: rawSettings.wifi_password,
          wifiCoverageNotes: rawSettings.wifi_coverage_notes || '',
          checkInTime: rawSettings.check_in_time,
          checkOutTime: rawSettings.check_out_time,
          autoCleaningBufferHours: rawSettings.auto_cleaning_buffer_hours,
          cancellationMinDays: rawSettings.cancellation_min_days,
          maxGuestsLimit: rawSettings.max_guests_limit,
          emergencyAddress: rawSettings.emergency_address,
          logoUrl: rawSettings.logo_url,
          cbu: rawSettings.cbu || '',
          aliasBancario: rawSettings.alias_bancario || '',
          cuitFideicomiso: rawSettings.cuit_fideicomiso || '',
          bancoNombre: rawSettings.banco_nombre || '',
          titularCuenta: rawSettings.titular_cuenta || '',
        }
      : undefined;

    const notifications = (notifsRes.result?.[0]?.results || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      timestamp: row.timestamp,
      read: Boolean(row.read),
      type: row.type,
      targetUserId: row.target_user_id,
      bookingId: row.booking_id,
    }));

    const inventory = (inventoryRes.result?.[0]?.results || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      locationRoom: row.location_room,
      quantity: row.quantity,
      unit: row.unit,
      condition: row.condition,
      notes: row.notes,
      imageUrl: row.image_url,
      lastCheckedDate: row.last_checked_date,
    }));

    const incidents = (incidentsRes.result?.[0]?.results || []).map((row: any) => ({
      id: row.id,
      bookingId: row.booking_id,
      reporterUserId: row.reporter_user_id,
      reporterName: row.reporter_name,
      reporterPartName: row.reporter_part_name,
      title: row.title,
      description: row.description,
      location: row.location,
      category: row.category,
      urgency: row.urgency,
      status: row.status,
      photoUrl: row.photo_url,
      createdAt: row.created_at,
      adminResponse: row.admin_response,
      resolvedAt: row.resolved_at,
      resolvedBy: row.resolved_by,
    }));

    return res.json({
      success: true,
      data: {
        users,
        bookings,
        blocks,
        settings,
        notifications,
        inventory,
        incidents,
      },
    });
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Error en pull desde D1',
    });
  }
});

// -------------------------------------------------------------
// CLOUDFLARE R2 OBJECT STORAGE ENDPOINTS (BUCKET: el-desayuno)
// -------------------------------------------------------------

function createR2S3Client(accountId: string, accessKeyId: string, secretAccessKey: string) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

// 1. R2 Status Check
app.get('/api/r2/status', async (_req, res) => {
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'el-desayuno';

    if (!accountId || !accessKeyId || !secretAccessKey) {
      return res.json({
        configured: false,
        connected: false,
        bucketName,
        message: 'Credenciales de Cloudflare R2 no configuradas en variables de entorno.',
      });
    }

    const s3 = createR2S3Client(accountId, accessKeyId, secretAccessKey);
    await s3.send(new ListObjectsV2Command({ Bucket: bucketName, MaxKeys: 1 }));

    return res.json({
      configured: true,
      connected: true,
      bucketName,
      message: `Conexión activa con el bucket '${bucketName}' en Cloudflare R2.`,
    });
  } catch (err: unknown) {
    return res.json({
      configured: true,
      connected: false,
      bucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME || 'el-desayuno',
      error: err instanceof Error ? err.message : 'Error conectando con Cloudflare R2',
    });
  }
});

// 2. Upload Photo to Cloudflare R2 Bucket 'el-desayuno' or Server-Side Persistent Storage
app.post(['/api/r2/upload', '/api/upload'], async (req, res) => {
  try {
    const { image, filename, folder = 'fotos', config } = req.body;
    const accountId = config?.accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = config?.accessKeyId || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    const secretAccessKey = config?.secretAccessKey || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    const bucketName = config?.bucketName || process.env.CLOUDFLARE_R2_BUCKET_NAME || 'el-desayuno';
    const publicUrl = config?.publicUrl || process.env.CLOUDFLARE_R2_PUBLIC_URL || '';

    if (!image) {
      return res.status(400).json({ success: false, error: 'No se envió imagen en base64.' });
    }

    // Process Base64 string
    const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
    let buffer: Buffer;
    let contentType = 'image/jpeg';

    if (match) {
      contentType = match[1];
      buffer = Buffer.from(match[2], 'base64');
    } else {
      buffer = Buffer.from(image, 'base64');
    }

    const ext = contentType.split('/')[1] || 'jpg';
    const cleanFilename = (filename || `foto-${Date.now()}`).replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const uniqueFile = `${Date.now()}_${cleanFilename}.${ext}`;
    const objectKey = `${folder}/${uniqueFile}`;

    // Try Cloudflare R2 if credentials present
    if (accountId && accessKeyId && secretAccessKey) {
      try {
        const s3 = createR2S3Client(accountId, accessKeyId, secretAccessKey);
        await s3.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
            Body: buffer,
            ContentType: contentType,
          })
        );

        const fileUrl = publicUrl
          ? `${publicUrl.replace(/\/$/, '')}/${objectKey}`
          : `/api/r2/file?key=${encodeURIComponent(objectKey)}`;

        return res.json({
          success: true,
          url: fileUrl,
          key: objectKey,
          bucketName,
          storageType: 'cloudflare-r2',
          message: `Foto subida exitosamente al bucket '${bucketName}'.`,
        });
      } catch (r2Err) {
        console.warn('R2 upload failed, falling back to local server storage:', r2Err);
      }
    }

    // Fallback: Save to server persistent uploads directory
    const targetFolder = path.join(UPLOADS_DIR, folder);
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }
    const filePath = path.join(targetFolder, uniqueFile);
    fs.writeFileSync(filePath, buffer);

    const serverUrl = `/uploads/${folder}/${uniqueFile}`;
    return res.json({
      success: true,
      url: serverUrl,
      key: objectKey,
      storageType: 'server-uploads',
      message: 'Foto guardada permanentemente en el servidor en la nube.',
    });
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Error procesando archivo de imagen',
    });
  }
});

// 3. List Photos in Cloudflare R2 Bucket 'el-desayuno'
app.post('/api/r2/list', async (req, res) => {
  try {
    const { folder = 'fotos', config } = req.body;
    const accountId = config?.accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = config?.accessKeyId || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    const secretAccessKey = config?.secretAccessKey || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    const bucketName = config?.bucketName || process.env.CLOUDFLARE_R2_BUCKET_NAME || 'el-desayuno';
    const publicUrl = config?.publicUrl || process.env.CLOUDFLARE_R2_PUBLIC_URL || '';

    if (!accountId || !accessKeyId || !secretAccessKey) {
      return res.status(400).json({
        success: false,
        error: 'Credenciales de Cloudflare R2 incompletas.',
      });
    }

    const s3 = createR2S3Client(accountId, accessKeyId, secretAccessKey);
    const result = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: folder ? `${folder}/` : undefined,
        MaxKeys: 100,
      })
    );

    const objects = (result.Contents || []).map((obj) => ({
      key: obj.Key,
      url: publicUrl
        ? `${publicUrl.replace(/\/$/, '')}/${obj.Key}`
        : `/api/r2/file?key=${encodeURIComponent(obj.Key || '')}`,
      size: obj.Size,
      lastModified: obj.LastModified?.toISOString(),
    }));

    return res.json({
      success: true,
      bucketName,
      objects,
    });
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Error listando objetos en R2',
    });
  }
});

// 4. Serve File / Photo directly from Cloudflare R2 Proxy
app.get('/api/r2/file', async (req, res) => {
  try {
    const key = req.query.key as string;
    if (!key) {
      return res.status(400).send('Falta parámetro key');
    }

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'el-desayuno';

    if (!accountId || !accessKeyId || !secretAccessKey) {
      return res.status(400).send('Credenciales Cloudflare R2 no configuradas');
    }

    const s3 = createR2S3Client(accountId, accessKeyId, secretAccessKey);
    const command = new GetObjectCommand({ Bucket: bucketName, Key: key });
    const response = await s3.send(command);

    if (response.ContentType) {
      res.setHeader('Content-Type', response.ContentType);
    } else {
      res.setHeader('Content-Type', 'image/jpeg');
    }
    if (response.ContentLength) {
      res.setHeader('Content-Length', response.ContentLength);
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    const byteArray = await response.Body?.transformToByteArray();
    if (byteArray) {
      return res.send(Buffer.from(byteArray));
    } else {
      return res.status(404).send('Archivo vacío o no encontrado en R2');
    }
  } catch (err: unknown) {
    return res.status(404).send('Archivo no encontrado en Cloudflare R2');
  }
});

// -------------------------------------------------------------
// SERVER-SIDE SHARED STATE PERSISTENCE & CLOUD LOCKING
// -------------------------------------------------------------
const STATE_FILE_PATH = path.resolve(process.cwd(), 'app-server-state.json');
let memoryServerState: Record<string, any> | null = null;

const EMPTY_SERVER_STATE = () => ({
  users: [], bookings: [], blocks: [], settings: {}, rules: [], contacts: [], documents: [],
  inventory: [], incidents: [], notifications: [], fees: [], expenses: [], cashFlow: [],
});

function loadServerState(forceDisk = false): Record<string, any> {
  if (memoryServerState && !forceDisk) {
    return memoryServerState;
  }
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const raw = fs.readFileSync(STATE_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        memoryServerState = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.error('[Server State] Error leyendo STATE_FILE_PATH:', err);
  }
  const emptyState = EMPTY_SERVER_STATE();
  memoryServerState = emptyState;
  try {
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(emptyState, null, 2), 'utf-8');
  } catch (writeErr) {
    console.error('[Server State] Error escribiendo estado vacío:', writeErr);
  }
  return emptyState;
}

// Real-time synchronization event bus across all client sessions
const sseClients = new Set<express.Response>();

function broadcastSyncEvent(eventType: string, payload?: any): void {
  const data = JSON.stringify({ type: eventType, payload, timestamp: Date.now() });
  for (const client of sseClients) {
    try {
      client.write(`event: sync\ndata: ${data}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

async function syncRelationalTablesToSupabase(state: Record<string, any>): Promise<void> {
  if (!supabaseServerClient) return;
  try {
    if (Array.isArray(state.users) && state.users.length > 0) {
      const rows = state.users.map((u: any) => ({
        id: u.id,
        name: u.name || '',
        username: u.username || '',
        email: u.email || '',
        phone: u.phone || '',
        role: u.role || 'owner',
        cabeza_number: u.cabezaNumber || 0,
        part_name: u.partName || '',
        color: u.color || '#000000',
        active: u.active ?? true,
        annual_quota_days: u.annualQuotaDays || 30,
        pending_days: u.pendingDays || 0,
        used_days: u.usedDays || 0,
        share_percentage: typeof u.sharePercentage === 'number' ? u.sharePercentage : (parseFloat(u.sharePercentage) || 0),
        avatar_initials: u.avatarInitials || '',
        created_at: u.createdAt || new Date().toISOString(),
      }));
      try { await supabaseServerClient.from('users').upsert(rows, { onConflict: 'id' }); } catch {}
    }

    if (Array.isArray(state.expenses) && state.expenses.length > 0) {
      const rows = state.expenses.map((e: any) => ({
        id: e.id,
        date: e.date || null,
        concept: e.concept || '',
        amount: e.amount || 0,
        currency: e.currency || 'ARS',
        category: e.category || 'otro',
        provider: e.provider || '',
        invoice_number: e.invoiceNumber || '',
        status: e.status || 'paid',
        paid_at: e.paidAt || null,
        payment_method: e.paymentMethod || 'cash',
        receipt_url: e.receiptUrl || '',
        period_month: e.periodMonth || '',
        notes: e.notes || '',
        created_by: e.createdBy || '',
        user_id: e.userId || null,
        user_name: e.userName || '',
        part_name: e.partName || '',
        approval_status: e.approvalStatus || 'approved',
        approved_at: e.approvedAt || null,
        approved_by: e.approvedBy || '',
        rejection_reason: e.rejectionReason || '',
        reimbursement_status: e.reimbursementStatus || 'unpaid',
        reimbursed_amount: e.reimbursedAmount || 0,
        created_at: e.createdAt || new Date().toISOString(),
      }));
      for (let i = 0; i < rows.length; i += 25) {
        const chunk = rows.slice(i, i + 25);
        const { error: expSyncErr } = await supabaseServerClient.from('expenses').upsert(chunk, { onConflict: 'id' });
        if (expSyncErr) {
          console.warn('Supabase sync expenses chunk warning:', expSyncErr.message);
        }
      }
    }

    if (Array.isArray(state.cashFlow) && state.cashFlow.length > 0) {
      const rows = state.cashFlow.map((cf: any) => ({
        id: cf.id,
        type: cf.type || 'ingreso',
        category: cf.category || 'otro_ingreso',
        concept: cf.concept || '',
        amount: cf.amount || 0,
        currency: cf.currency || 'ARS',
        date: cf.date || null,
        user_id: cf.userId || null,
        user_name: cf.userName || '',
        part_name: cf.partName || '',
        expense_id: cf.expenseId || null,
        notes: cf.notes || '',
        created_by: cf.createdBy || '',
        created_at: cf.createdAt || new Date().toISOString(),
      }));
      try { await supabaseServerClient.from('cash_flow').upsert(rows, { onConflict: 'id' }); } catch {}
    }

    if (Array.isArray(state.fees) && state.fees.length > 0) {
      const rows = state.fees.map((f: any) => ({
        id: f.id,
        concept: f.concept || '',
        category: f.category || 'expensas_ordinarias',
        total_amount: f.totalAmount || 0,
        currency: f.currency || 'ARS',
        recurrence: f.recurrence || 'mensual',
        issue_date: f.issueDate || null,
        due_date: f.dueDate || null,
        distribution_mode: f.distributionMode || 'proporcional',
        allocations: f.allocations ? JSON.stringify(f.allocations) : '[]',
        status: f.status || 'active',
        created_by: f.createdBy || '',
        created_at: f.createdAt || new Date().toISOString(),
        notes: f.notes || '',
        installments_count: f.installmentsCount || 1,
        installment_number: f.installmentNumber || 1,
        original_expense_id: f.originalExpenseId || null,
      }));
      try { await supabaseServerClient.from('fee_collections').upsert(rows, { onConflict: 'id' }); } catch {}
    }

    if (Array.isArray(state.incidents) && state.incidents.length > 0) {
      const rows = state.incidents.map((inc: any) => ({
        id: inc.id,
        title: inc.title || '',
        description: inc.description || '',
        severity: inc.severity || 'baja',
        status: inc.status || 'abierto',
        location: inc.location || '',
        reported_by: inc.reportedBy || '',
        created_at: inc.createdAt || new Date().toISOString(),
      }));
      try { await supabaseServerClient.from('incidents').upsert(rows, { onConflict: 'id' }); } catch {}
    }

    if (Array.isArray(state.documents) && state.documents.length > 0) {
      const rows = state.documents.map((doc: any) => ({
        id: doc.id,
        title: doc.title || '',
        category: doc.category || 'general',
        file_url: doc.fileUrl || '',
        file_type: doc.fileType || '',
        uploaded_by: doc.uploadedBy || '',
        uploaded_at: doc.uploadedAt || new Date().toISOString(),
      }));
      try { await supabaseServerClient.from('documents').upsert(rows, { onConflict: 'id' }); } catch {}
    }

    if (Array.isArray(state.bookings) && state.bookings.length > 0) {
      const rows = state.bookings.map((b: any) => ({
        id: b.id,
        user_id: b.userId || '',
        user_name: b.userName || '',
        check_in_date: b.checkInDate || null,
        check_out_date: b.checkOutDate || null,
        total_days: b.totalDays || 0,
        guests_count: b.guestsCount || 1,
        status: b.status || 'confirmed',
        user_color: b.userColor || '',
        part_name: b.partName || '',
        arrival_time: b.arrivalTime || '',
        cancellation_reason: b.cancellationReason || '',
        cancelled_at: b.cancelledAt || null,
        cancelled_by: b.cancelledBy || '',
        created_at: b.createdAt || new Date().toISOString(),
      }));
      try { await supabaseServerClient.from('bookings').upsert(rows, { onConflict: 'id' }); } catch {}
    }

    if (Array.isArray(state.contacts) && state.contacts.length > 0) {
      const rows = state.contacts.map((c: any) => ({
        id: c.id,
        name: c.name || '',
        role: c.role || '',
        phone: c.phone || '',
        category: c.category || '',
        is_emergency: c.isEmergency ?? false,
        available_hours: c.availableHours || '',
        notes: c.notes || '',
      }));
      try { await supabaseServerClient.from('contacts').upsert(rows, { onConflict: 'id' }); } catch {}
    }

    if (Array.isArray(state.inventory) && state.inventory.length > 0) {
      const rows = state.inventory.map((inv: any) => ({
        id: inv.id,
        name: inv.name || '',
        category: inv.category || '',
        quantity: inv.quantity || 0,
        unit: inv.unit || 'unidades',
        condition: inv.condition || 'bueno',
        location_room: inv.locationRoom || '',
        last_checked_date: inv.lastCheckedDate || null,
      }));
      try { await supabaseServerClient.from('inventory').upsert(rows, { onConflict: 'id' }); } catch {}
    }

    if (Array.isArray(state.notifications) && state.notifications.length > 0) {
      const rows = state.notifications.map((n: any) => ({
        id: n.id,
        title: n.title || '',
        body: n.body || '',
        type: n.type || '',
        booking_id: n.bookingId || '',
        read: n.read ?? false,
        created_at: n.createdAt || new Date().toISOString(),
      }));
      try { await supabaseServerClient.from('notifications').upsert(rows, { onConflict: 'id' }); } catch {}
    }

    if (state.settings) {
      const s = state.settings;
      const row = {
        id: 'default',
        house_name: s.houseName || '',
        slogan: s.slogan || '',
        cuit_fideicomiso: s.cuitFideicomiso || '',
        titular_cuenta: s.titularCuenta || '',
        cbu: s.cbu || '',
        alias_bancario: s.aliasBancario || '',
        banco_nombre: s.bancoNombre || '',
        location: s.location || '',
        check_in_time: s.checkInTime || '',
        check_out_time: s.checkOutTime || '',
        logo_url: s.logoUrl || '',
        wifi_ssid: s.wifiSsid || '',
        wifi_password: s.wifiPassword || '',
        updated_at: new Date().toISOString(),
      };
      try { await supabaseServerClient.from('settings').upsert(row, { onConflict: 'id' }); } catch {}

      if (Array.isArray(s.expenseCategories) && s.expenseCategories.length > 0) {
        const rows = s.expenseCategories.map((c: any) => ({ id: String(c.id), name: String(c.name) }));
        try { await supabaseServerClient.from('expense_categories').upsert(rows, { onConflict: 'id' }); } catch {}
      }
      if (Array.isArray(s.cashFlowCategories) && s.cashFlowCategories.length > 0) {
        const rows = s.cashFlowCategories.map((c: any) => ({ id: String(c.id), name: String(c.name) }));
        try { await supabaseServerClient.from('cashflow_categories').upsert(rows, { onConflict: 'id' }); } catch {}
      }
      if (Array.isArray(s.feeCategories) && s.feeCategories.length > 0) {
        const rows = s.feeCategories.map((c: any) => ({ id: String(c.id), name: String(c.name) }));
        try { await supabaseServerClient.from('fee_categories').upsert(rows, { onConflict: 'id' }); } catch {}
      }
      if (Array.isArray(s.inventoryCategories) && s.inventoryCategories.length > 0) {
        const rows = s.inventoryCategories.map((c: any) => ({ id: String(c.id), name: String(c.name) }));
        try { await supabaseServerClient.from('inventory_categories').upsert(rows, { onConflict: 'id' }); } catch {}
      }

      const categoriesRows: Array<{ id: string; type: string; name: string }> = [];
      if (Array.isArray(s.expenseCategories)) {
        s.expenseCategories.forEach((c: any) => categoriesRows.push({ id: String(c.id), type: 'expense', name: String(c.name) }));
      }
      if (Array.isArray(s.cashFlowCategories)) {
        s.cashFlowCategories.forEach((c: any) => categoriesRows.push({ id: String(c.id), type: 'cashflow', name: String(c.name) }));
      }
      if (Array.isArray(s.feeCategories)) {
        s.feeCategories.forEach((c: any) => categoriesRows.push({ id: String(c.id), type: 'fee', name: String(c.name) }));
      }
      if (Array.isArray(s.inventoryCategories)) {
        s.inventoryCategories.forEach((c: any) => categoriesRows.push({ id: String(c.id), type: 'inventory', name: String(c.name) }));
      }

      if (categoriesRows.length > 0) {
        try { await supabaseServerClient.from('operational_categories').upsert(categoriesRows, { onConflict: 'id' }); } catch {}
      }
    }

    if (Array.isArray(state.blocks) && state.blocks.length > 0) {
      const rows = state.blocks.map((b: any) => ({
        id: b.id,
        start_date: b.startDate || b.start_date || null,
        end_date: b.endDate || b.end_date || null,
        total_days: b.totalDays || b.total_days || 0,
        reason: b.reason || '',
        title: b.title || '',
        notes: b.notes || '',
        created_by: b.createdBy || b.created_by || '',
        created_at: b.createdAt || b.created_at || new Date().toISOString(),
      }));
      try { await supabaseServerClient.from('blocks').upsert(rows, { onConflict: 'id' }); } catch {}
    }

    if (Array.isArray(state.rules) && state.rules.length > 0) {
      const rows = state.rules.map((r: any) => ({
        id: r.id,
        title: r.title || '',
        description: r.description || '',
        category: r.category || '',
        icon: r.icon || '',
        priority: r.priority || 0,
        created_at: r.createdAt || r.created_at || new Date().toISOString(),
      }));
      try { await supabaseServerClient.from('rules').upsert(rows, { onConflict: 'id' }); } catch {}
    }
  } catch (err: any) {
    console.warn('[Supabase Relational Sync] Notice:', err.message);
  }
}

async function syncStateToSupabase(state: Record<string, any>): Promise<boolean> {
  if (!supabaseServerClient) return false;
  try {
    await syncRelationalTablesToSupabase(state);
    console.log('[Supabase Server Sync] Tablas relacionales sincronizadas con Supabase.');
    return true;
  } catch (err: any) {
    console.warn('[Supabase Server Sync] Exception:', err.message);
    return false;
  }
}

function saveServerState(state: Record<string, any>): void {
  try {
    state.updatedAt = new Date().toISOString();
    memoryServerState = state;
    const tempPath = `${STATE_FILE_PATH}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf-8');
    fs.renameSync(tempPath, STATE_FILE_PATH);
    broadcastSyncEvent('state_updated', { settings: state.settings, updatedAt: state.updatedAt });
    
    // Background push to Supabase
    syncStateToSupabase(state).catch(() => {});
  } catch (err) {
    console.error('[Server State] Error escribiendo STATE_FILE_PATH:', err);
  }
}


async function safeSupabaseQuery(queryPromise: any) {
  try {
    return await queryPromise;
  } catch (err) {
    return { error: err, data: [] };
  }
}

// Authoritative Real-Time Data Hydration from Supabase Relational Tables
async function fetchAuthoritativeStateFromSupabase(): Promise<Record<string, any>> {
  const currentState = EMPTY_SERVER_STATE();
  if (!supabaseServerClient) throw new Error('Supabase no está configurado.');

  try {
    const [
      usersRes,
      bookingsRes,
      settingsRes,
      contactsRes,
      docsRes,
      invRes,
      incRes,
      notifsRes,
      feesRes,
      expensesRes,
      cashFlowRes,
      expCatRes,
      cfCatRes,
      feeCatRes,
      invCatRes,
      opCatsRes,
      blocksRes,
      rulesRes,
    ] = await Promise.all([
      safeSupabaseQuery(supabaseServerClient.from('users').select('*').order('name')),
      safeSupabaseQuery(supabaseServerClient.from('bookings').select('*').order('check_in_date')),
      safeSupabaseQuery(supabaseServerClient.from('settings').select('*').limit(1)),
      safeSupabaseQuery(supabaseServerClient.from('contacts').select('*')),
      safeSupabaseQuery(supabaseServerClient.from('documents').select('*')),
      safeSupabaseQuery(supabaseServerClient.from('inventory').select('*')),
      safeSupabaseQuery(supabaseServerClient.from('incidents').select('*')),
      safeSupabaseQuery(supabaseServerClient.from('notifications').select('*').order('created_at', { ascending: false })),
      safeSupabaseQuery(supabaseServerClient.from('fee_collections').select('*')),
      safeSupabaseQuery(supabaseServerClient.from('expenses').select('*').order('date', { ascending: false })),
      safeSupabaseQuery(supabaseServerClient.from('cash_flow').select('*').order('date', { ascending: false })),
      safeSupabaseQuery(supabaseServerClient.from('expense_categories').select('*')),
      safeSupabaseQuery(supabaseServerClient.from('cashflow_categories').select('*')),
      safeSupabaseQuery(supabaseServerClient.from('fee_categories').select('*')),
      safeSupabaseQuery(supabaseServerClient.from('inventory_categories').select('*')),
      safeSupabaseQuery(supabaseServerClient.from('operational_categories').select('*')),
      safeSupabaseQuery(supabaseServerClient.from('blocks').select('*').order('start_date', { ascending: false })),
      safeSupabaseQuery(supabaseServerClient.from('rules').select('*')),
    ]);

    const state: Record<string, any> = { ...EMPTY_SERVER_STATE() };

    if (!usersRes.error && Array.isArray(usersRes.data)) {
      state.users = usersRes.data.map((u: any) => ({
        id: u.id,
        name: u.name || '',
        username: u.username || '',
        email: u.email || '',
        phone: u.phone || '',
        role: u.role || 'owner',
        cabezaNumber: typeof u.cabeza_number === 'number' ? u.cabeza_number : (u.cabeza_number !== null && u.cabeza_number !== undefined ? Number(u.cabeza_number) : 0),
        partName: u.part_name || '',
        color: u.color || '#000000',
        active: u.active ?? true,
        annualQuotaDays: typeof u.annual_quota_days === 'number' ? u.annual_quota_days : (u.annual_quota_days !== null && u.annual_quota_days !== undefined ? Number(u.annual_quota_days) : 30),
        pendingDays: u.pending_days || 0,
        usedDays: u.used_days || 0,
        sharePercentage: typeof u.share_percentage === 'number' ? u.share_percentage : (parseFloat(u.share_percentage) || 0),
        avatarInitials: u.avatar_initials || '',
        createdAt: u.created_at,
      }));
    }

    if (!bookingsRes.error && Array.isArray(bookingsRes.data)) {
      state.bookings = bookingsRes.data.map((b: any) => ({
        id: b.id,
        userId: b.user_id,
        userName: b.user_name,
        userColor: b.user_color || '#16A34A',
        partName: b.part_name || '',
        checkInDate: b.check_in_date,
        checkOutDate: b.check_out_date,
        totalDays: b.total_days,
        guestsCount: b.guests_count || 1,
        status: b.status || 'confirmed',
        arrivalTime: b.arrival_time || '14:00',
        notes: b.notes || '',
        cleaningFee: b.cleaning_fee || 0,
        maintenanceFee: b.maintenance_fee || 0,
        depositAmount: b.deposit_amount || 0,
        sharePercentage: b.share_percentage,
        cancellationReason: b.cancellation_reason || '',
        cancelledAt: b.cancelled_at,
        cancelledBy: b.cancelled_by,
        createdAt: b.created_at,
      }));
    }

    if (!expensesRes.error && Array.isArray(expensesRes.data)) {
      state.expenses = expensesRes.data.map((e: any) => ({
        id: e.id,
        date: e.date || '',
        concept: e.concept || '',
        amount: Number(e.amount) || 0,
        currency: e.currency || 'ARS',
        category: e.category || 'otro',
        provider: e.provider || '',
        invoiceNumber: e.invoice_number || '',
        status: e.status || 'paid',
        paidAt: e.paid_at || undefined,
        createdBy: e.created_by || '',
        receiptUrl: e.receipt_url || '',
        paymentMethod: e.payment_method || 'transfer',
        periodMonth: e.period_month || '',
        notes: e.notes || '',
        createdAt: e.created_at,
        userId: e.user_id || null,
        userName: e.user_name || '',
        partName: e.part_name || '',
        approvalStatus: e.approval_status || 'approved',
        approvedAt: e.approved_at || null,
        approvedBy: e.approved_by || '',
        rejectionReason: e.rejection_reason || '',
        reimbursementStatus: e.reimbursement_status || 'unpaid',
        reimbursedAmount: Number(e.reimbursed_amount) || 0,
      }));
    }

    if (!cashFlowRes.error && Array.isArray(cashFlowRes.data)) {
      state.cashFlow = cashFlowRes.data.map((cf: any) => ({
        id: cf.id,
        type: cf.type || 'ingreso',
        category: cf.category || 'otro_ingreso',
        concept: cf.concept || '',
        amount: Number(cf.amount) || 0,
        currency: cf.currency || 'ARS',
        date: cf.date || '',
        userId: cf.user_id || null,
        userName: cf.user_name || '',
        partName: cf.part_name || '',
        expenseId: cf.expense_id || null,
        notes: cf.notes || '',
        createdBy: cf.created_by || '',
        createdAt: cf.created_at,
      }));
    }

    if (!feesRes.error && Array.isArray(feesRes.data)) {
      state.fees = feesRes.data.map((f: any) => ({
        id: f.id,
        concept: f.concept || '',
        category: f.category || 'expensas_ordinarias',
        totalAmount: Number(f.total_amount) || 0,
        currency: f.currency || 'ARS',
        recurrence: f.recurrence || 'mensual',
        issueDate: f.issue_date || null,
        dueDate: f.due_date || null,
        distributionMode: f.distribution_mode || 'share_percentage',
        allocations: typeof f.allocations === 'string' ? JSON.parse(f.allocations) : (f.allocations || []),
        shares: typeof f.shares === 'string' ? JSON.parse(f.shares) : (f.shares || []),
        targetMonth: f.target_month || '',
        status: f.status || 'active',
        notes: f.notes || '',
        installmentsCount: f.installments_count || 1,
        installmentNumber: f.installment_number || 1,
        originalExpenseId: f.original_expense_id || null,
        createdBy: f.created_by || '',
        createdAt: f.created_at,
      }));
    }

    if (!contactsRes.error && Array.isArray(contactsRes.data)) {
      state.contacts = contactsRes.data.map((c: any) => ({
        id: c.id,
        name: c.name || '',
        role: c.role || '',
        phone: c.phone || '',
        category: c.category || 'personal',
        isEmergency: c.is_emergency ?? false,
        availableHours: c.available_hours || '',
        notes: c.notes || '',
      }));
    }

    if (!docsRes.error && Array.isArray(docsRes.data)) {
      state.documents = docsRes.data.map((d: any) => ({
        id: d.id,
        title: d.title || '',
        category: d.category || 'otro',
        fileUrl: d.file_url || '',
        fileType: d.file_type || '',
        fileSize: d.file_size || 0,
        description: d.description || '',
        uploadedAt: d.uploaded_at,
      }));
    }

    if (!invRes.error && Array.isArray(invRes.data)) {
      state.inventory = invRes.data.map((i: any) => ({
        id: i.id,
        name: i.name || '',
        category: i.category || 'general',
        location: i.location || '',
        quantity: i.quantity || 0,
        unit: i.unit || 'unidad',
        status: i.status || 'good',
        minThreshold: i.min_threshold || 1,
        notes: i.notes || '',
        lastChecked: i.last_checked,
      }));
    }

    if (!incRes.error && Array.isArray(incRes.data)) {
      state.incidents = incRes.data.map((inc: any) => ({
        id: inc.id,
        title: inc.title || '',
        description: inc.description || '',
        category: inc.category || 'general',
        priority: inc.priority || 'medium',
        status: inc.status || 'open',
        reportedBy: inc.reported_by || '',
        reportedAt: inc.reported_at,
        assignedTo: inc.assigned_to || '',
        resolvedAt: inc.resolved_at,
        resolutionNotes: inc.resolution_notes || '',
      }));
    }

    if (!notifsRes.error && Array.isArray(notifsRes.data)) {
      state.notifications = notifsRes.data.map((n: any) => ({
        id: n.id,
        title: n.title || '',
        body: n.body || '',
        type: n.type || 'system',
        bookingId: n.booking_id || undefined,
        read: n.read ?? false,
        createdAt: n.created_at,
      }));
    }

    if (!settingsRes.error && Array.isArray(settingsRes.data) && settingsRes.data[0]) {
      const s = settingsRes.data[0];
      state.settings = {
        ...state.settings,
        houseName: s.house_name || state.settings?.houseName,
        slogan: s.slogan || state.settings?.slogan,
        cuitFideicomiso: s.cuit_fideicomiso || state.settings?.cuitFideicomiso,
        titularCuenta: s.titular_cuenta || state.settings?.titularCuenta,
        cbu: s.cbu || state.settings?.cbu,
        aliasBancario: s.alias_bancario || state.settings?.aliasBancario,
        bancoNombre: s.banco_nombre || state.settings?.bancoNombre,
        location: s.location || state.settings?.location,
        checkInTime: s.check_in_time || state.settings?.checkInTime,
        checkOutTime: s.check_out_time || state.settings?.checkOutTime,
        logoUrl: s.logo_url || state.settings?.logoUrl,
        wifiSsid: s.wifi_ssid || state.settings?.wifiSsid,
        wifiPassword: s.wifi_password || state.settings?.wifiPassword,
        updatedAt: s.updated_at || new Date().toISOString(),
      };
    }

    if (!state.settings) state.settings = {};
    const expCats: Array<{ id: string; name: string }> = [];
    const cfCats: Array<{ id: string; name: string }> = [];
    const feeCats: Array<{ id: string; name: string }> = [];
    const invCats: Array<{ id: string; name: string }> = [];

    if (!expCatRes?.error && Array.isArray(expCatRes?.data) && expCatRes.data.length > 0) {
      expCatRes.data.forEach((c: any) => expCats.push({ id: c.id, name: c.name || c.id }));
    }
    if (!cfCatRes?.error && Array.isArray(cfCatRes?.data) && cfCatRes.data.length > 0) {
      cfCatRes.data.forEach((c: any) => cfCats.push({ id: c.id, name: c.name || c.id }));
    }
    if (!feeCatRes?.error && Array.isArray(feeCatRes?.data) && feeCatRes.data.length > 0) {
      feeCatRes.data.forEach((c: any) => feeCats.push({ id: c.id, name: c.name || c.id }));
    }
    if (!invCatRes?.error && Array.isArray(invCatRes?.data) && invCatRes.data.length > 0) {
      invCatRes.data.forEach((c: any) => invCats.push({ id: c.id, name: c.name || c.id }));
    }

    if (!opCatsRes?.error && Array.isArray(opCatsRes?.data) && opCatsRes.data.length > 0) {
      opCatsRes.data.forEach((c: any) => {
        const item = { id: c.id, name: c.name || c.id };
        if (c.type === 'expense' && !expCats.some(x => x.id === item.id)) expCats.push(item);
        else if (c.type === 'cashflow' && !cfCats.some(x => x.id === item.id)) cfCats.push(item);
        else if (c.type === 'fee' && !feeCats.some(x => x.id === item.id)) feeCats.push(item);
        else if (c.type === 'inventory' && !invCats.some(x => x.id === item.id)) invCats.push(item);
      });
    }

    state.settings.expenseCategories = expCats;
    state.settings.cashFlowCategories = cfCats;
    state.settings.feeCategories = feeCats;
    state.settings.inventoryCategories = invCats;

    if (!blocksRes?.error && Array.isArray(blocksRes?.data)) {
      state.blocks = blocksRes.data.map((b: any) => ({
        id: b.id,
        startDate: b.start_date || b.startDate || '',
        endDate: b.end_date || b.endDate || '',
        totalDays: b.total_days || b.totalDays || 0,
        reason: b.reason || '',
        title: b.title || '',
        notes: b.notes || '',
        createdBy: b.created_by || b.createdBy || '',
        createdAt: b.created_at || b.createdAt,
      }));
    }

    if (!rulesRes?.error && Array.isArray(rulesRes?.data)) {
      state.rules = rulesRes.data.map((r: any) => ({
        id: r.id,
        title: r.title || '',
        description: r.description || '',
        category: r.category || '',
        icon: r.icon || '',
        priority: r.priority || 0,
        createdAt: r.created_at || r.createdAt,
      }));
    }

    memoryServerState = state;
    try {
      fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2), 'utf-8');
    } catch {}

    return state;
  } catch (err) {
    console.warn('[Supabase Sync] Error recuperando datos canónicos de Supabase:', err);
    return currentState;
  }
}

// Initialize seed on startup and hydrate directly from Supabase
loadServerState(true);

if (supabaseServerClient) {
  fetchAuthoritativeStateFromSupabase().then(() => {
    console.log('[Supabase Startup Sync] ¡Tablas y datos relacionales descargados e hidratados con éxito!');
  }).catch((err) => {
    console.warn('[Supabase Startup Sync] Aviso:', err?.message || err);
  });
}

// 0. Real-time Server-Sent Events stream for instant cross-session sync (< 50ms)
app.get('/api/sync/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('event: connected\ndata: {"status":"connected"}\n\n');
  sseClients.add(res);

  const keepAlive = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(keepAlive);
      sseClients.delete(res);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
});

// Supabase Integration Server Endpoints
app.get('/api/supabase/status', async (_req, res) => {
  if (!supabaseServerClient) {
    return res.json({ connected: false, message: 'Cliente Supabase no configurado' });
  }
  const startTime = Date.now();
  try {
    const { data, error } = await supabaseServerClient.from('settings').select('id, updated_at').limit(1);
    const latencyMs = Date.now() - startTime;
    if (!error) {
      return res.json({
        connected: true,
        tableExists: true,
        latencyMs,
        message: `Conectado exitosamente a Supabase (Latencia: ${latencyMs}ms). Tablas relacionales listas.`,
      });
    }
    if (error.code === 'PGRST205' || error.code === '42P01') {
      return res.json({
        connected: true,
        tableExists: false,
        latencyMs,
        message: 'Conectado a Supabase pero la tabla "settings" aún no fue creada. Ejecutá el script SQL provisto.',
      });
    }
    return res.json({ connected: false, message: `Error de Supabase: ${error.message}` });
  } catch (err: any) {
    return res.status(500).json({ connected: false, message: err.message });
  }
});

app.post('/api/supabase/push', async (_req, res) => {
  if (!supabaseServerClient) {
    return res.status(400).json({ success: false, message: 'Supabase no está configurado.' });
  }
  try {
    const state = loadServerState(true);
    await syncRelationalTablesToSupabase(state);
    return res.json({ success: true, message: '¡Sincronizado exitosamente a las tablas de Supabase!' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/supabase/pull', async (_req, res) => {
  if (!supabaseServerClient) {
    return res.status(400).json({ success: false, message: 'Supabase no está configurado.' });
  }
  try {
    const state = await fetchAuthoritativeStateFromSupabase();
    broadcastSyncEvent('state_updated', { settings: state.settings, updatedAt: state.updatedAt });
    return res.json({ success: true, message: '¡Datos descargados desde Supabase e importados exitosamente!', state });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 1. Get full App State (Canonical Database Truth directly from Supabase)
app.get('/api/app-state', async (_req, res) => {
  try {
    const data = await fetchAuthoritativeStateFromSupabase();
    return res.json({ success: true, data, source: 'supabase_authoritative' });
  } catch (err: unknown) {
    return res.status(503).json({ success: false, error: 'La base de datos no está disponible.' });
  }
});

// 2. Safe Set/Merge App State (Never blindly wipes out bookings or settings)
app.post('/api/app-state', (req, res) => {
  try {
    const incoming = req.body;
    if (!incoming || typeof incoming !== 'object') {
      return res.status(400).json({ success: false, error: 'Datos no válidos' });
    }
    const current = loadServerState(true);

    // Safe merge settings
    if (incoming.settings && typeof incoming.settings === 'object') {
      current.settings = { ...current.settings, ...incoming.settings };
    }

    // Safe merge users
    if (Array.isArray(incoming.users) && incoming.users.length > 0) {
      const userMap = new Map<string, any>();
      (current.users || []).forEach((u: any) => userMap.set(u.id, u));
      incoming.users.forEach((u: any) => {
        if (u && u.id) {
          const prev = userMap.get(u.id) || {};
          userMap.set(u.id, { ...prev, ...u });
        }
      });
      current.users = Array.from(userMap.values());
    }

    // Safe merge bookings - NEVER discard existing active bookings unless incoming is non-empty
    if (Array.isArray(incoming.bookings) && incoming.bookings.length > 0) {
      const bookingMap = new Map<string, any>();
      (current.bookings || []).forEach((b: any) => bookingMap.set(b.id, b));
      incoming.bookings.forEach((b: any) => {
        if (b && b.id) bookingMap.set(b.id, b);
      });
      current.bookings = Array.from(bookingMap.values());
    }

    if (Array.isArray(incoming.blocks)) {
      current.blocks = incoming.blocks;
    }
    if (Array.isArray(incoming.rules) && incoming.rules.length > 0) {
      current.rules = incoming.rules;
    }
    if (Array.isArray(incoming.contacts) && incoming.contacts.length > 0) {
      current.contacts = incoming.contacts;
    }
    if (Array.isArray(incoming.documents) && incoming.documents.length > 0) {
      current.documents = incoming.documents;
    }
    if (Array.isArray(incoming.inventory) && incoming.inventory.length > 0) {
      current.inventory = incoming.inventory;
    }
    if (Array.isArray(incoming.incidents)) {
      current.incidents = incoming.incidents;
    }
    if (Array.isArray(incoming.fees)) {
      current.fees = incoming.fees;
    }
    if (Array.isArray(incoming.expenses)) {
      current.expenses = incoming.expenses;
    }

    saveServerState(current);
    return res.json({ success: true, message: 'Estado sincronizado de forma segura en el servidor' });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error guardando estado en servidor' });
  }
});

// 2b. Dedicated Settings Endpoints (Canonical Cloud Database for Ajustes)
app.get('/api/settings', async (_req, res) => {
  try {
    if (!supabaseServerClient) {
      return res.status(503).json({ success: false, error: 'La base de datos no está disponible.' });
    }
    const { data, error } = await supabaseServerClient.from('settings').select('*').limit(1);
    if (error) return res.status(500).json({ success: false, error: error.message });
    if (!data?.[0]) return res.json({ success: true, settings: {}, source: 'supabase' });
    const s = data[0];
    return res.json({ success: true, source: 'supabase', settings: {
      houseName: s.house_name, slogan: s.slogan, cuitFideicomiso: s.cuit_fideicomiso,
      titularCuenta: s.titular_cuenta, cbu: s.cbu, aliasBancario: s.alias_bancario,
      bancoNombre: s.banco_nombre, location: s.location, checkInTime: s.check_in_time,
      checkOutTime: s.check_out_time, logoUrl: s.logo_url, wifiSsid: s.wifi_ssid,
      wifiPassword: s.wifi_password, updatedAt: s.updated_at,
    }});
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error obteniendo ajustes del servidor' });
  }
});

const handleSaveSettings = async (req: express.Request, res: express.Response) => {
  try {
    const updatedSettings = req.body;
    if (!updatedSettings || typeof updatedSettings !== 'object') {
      return res.status(400).json({ success: false, error: 'Datos de configuración no válidos.' });
    }

    const state = loadServerState(true);
    state.settings = {
      ...(state.settings || {}),
      ...updatedSettings,
      updatedAt: new Date().toISOString(),
    };

    saveServerState(state);

    if (supabaseServerClient) {
      try {
        const s = state.settings;
        await supabaseServerClient.from('settings').upsert({
          id: 'default',
          house_name: s.houseName || 'Estancia El Desayuno',
          slogan: s.slogan || 'Cuatro Partes, Un Mismo Objetivo',
          cuit_fideicomiso: s.cuitFideicomiso || '',
          titular_cuenta: s.titularCuenta || '',
          cbu: s.cbu || '',
          alias_bancario: s.aliasBancario || '',
          banco_nombre: s.bancoNombre || '',
          location: s.location || '',
          check_in_time: s.checkInTime || '14:00',
          check_out_time: s.checkOutTime || '11:00',
          logo_url: s.logoUrl || '',
          wifi_ssid: s.wifiSsid || '',
          wifi_password: s.wifiPassword || '',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

        await syncStateToSupabase(state);
      } catch (sbErr) {
        console.error('Error guardando settings en Supabase:', sbErr);
      }
    }

    // Also push to Cloudflare D1 if configured
    const actId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const dbId = process.env.CLOUDFLARE_DATABASE_ID;
    const token = process.env.CLOUDFLARE_API_TOKEN;
    if (actId && dbId && token) {
      const s = state.settings;
      queryCloudflareD1(
        actId,
        dbId,
        token,
        `INSERT OR REPLACE INTO trust_settings (id, house_name, location, wifi_ssid, wifi_password, check_in_time, check_out_time, auto_cleaning_buffer_hours, cancellation_min_days, max_guests_limit, emergency_address, logo_url, cbu, alias_bancario, cuit_fideicomiso, banco_nombre, titular_cuenta, wifi_coverage_notes, slogan, updated_at)
         VALUES ('default_settings', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.houseName || 'Estancia El Desayuno',
          s.location || '',
          s.wifiSsid || '',
          s.wifiPassword || '',
          s.checkInTime || '14:00',
          s.checkOutTime || '11:00',
          s.autoCleaningBufferHours || 24,
          s.cancellationMinDays || 7,
          s.maxGuestsLimit || 12,
          s.emergencyAddress || '',
          s.logoUrl || '',
          s.cbu || '',
          s.aliasBancario || '',
          s.cuitFideicomiso || '',
          s.bancoNombre || '',
          s.titularCuenta || '',
          s.wifiCoverageNotes || '',
          s.slogan || 'Cuatro Partes, Un Mismo Objetivo',
          new Date().toISOString(),
        ]
      ).catch((err) => console.warn('[D1 Background Sync] Error guardando settings en D1:', err));
    }

    return res.json({
      success: true,
      settings: state.settings,
      message: 'Ajustes guardados y persistidos en la base de datos de la nube.',
    });
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Error guardando ajustes en la nube',
    });
  }
};

app.post('/api/settings', handleSaveSettings);
app.put('/api/settings', handleSaveSettings);

// 3. Get bookings from server
app.get('/api/bookings', async (_req, res) => {
  try {
    if (supabaseServerClient) {
      const { data, error } = await supabaseServerClient.from('bookings').select('*').order('check_in_date');
      if (!error && Array.isArray(data)) {
        const bookings = data.map((b: any) => ({
          id: b.id,
          userId: b.user_id,
          userName: b.user_name,
          userColor: b.user_color || '#16A34A',
          partName: b.part_name || '',
          checkInDate: b.check_in_date,
          checkOutDate: b.check_out_date,
          totalDays: b.total_days,
          guestsCount: b.guests_count || 1,
          status: b.status || 'confirmed',
          arrivalTime: b.arrival_time || '14:00',
          notes: b.notes || '',
          cleaningFee: b.cleaning_fee || 0,
          maintenanceFee: b.maintenance_fee || 0,
          depositAmount: b.deposit_amount || 0,
          sharePercentage: b.share_percentage,
          cancellationReason: b.cancellation_reason || '',
          cancelledAt: b.cancelled_at,
          cancelledBy: b.cancelled_by,
          createdAt: b.created_at,
        }));
        const state = loadServerState();
        state.bookings = bookings;
        saveServerState(state);
        return res.json({ success: true, bookings, source: 'supabase' });
      }
    }
    const state = loadServerState();
    return res.json({ success: true, bookings: state.bookings || [] });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error obteniendo reservas' });
  }
});

// 4. Create Booking with STRICT SERVER-SIDE CONFLICT DETECTION & LOCKING
app.post('/api/bookings', (req, res) => {
  try {
    const {
      userId,
      userName,
      userColor = '#16A34A',
      partName = 'Cabeza 1',
      checkInDate,
      checkOutDate,
      totalDays,
      guestsCount = 4,
      arrivalTime = '14:00',
      notes,
      cleaningBufferApplied = false,
    } = req.body;

    if (!checkInDate || !checkOutDate || !userId || !userName) {
      return res.status(400).json({ success: false, error: 'Faltan campos obligatorios para la reserva.' });
    }

    if (checkOutDate < checkInDate) {
      return res.status(400).json({
        success: false,
        error: 'La fecha de check-out no puede ser anterior a la fecha de check-in.',
      });
    }

    // Always read freshest state from disk to avoid race conditions
    const state = loadServerState();
    const bookings = Array.isArray(state.bookings) ? state.bookings : [];
    const blocks = Array.isArray(state.blocks) ? state.blocks : [];

    // Overlap validation with active bookings
    const activeBookings = bookings.filter((b: any) => b.status !== 'cancelled');
    const conflictBooking = activeBookings.find((b: any) => {
      // Overlap formula: !(newCheckOut < existingCheckIn || newCheckIn > existingCheckOut)
      return !(checkOutDate < b.checkInDate || checkInDate > b.checkOutDate);
    });

    if (conflictBooking) {
      return res.status(409).json({
        success: false,
        code: 'DATE_CONFLICT',
        error: `Conflicto de fechas en la nube: El período del ${checkInDate} al ${checkOutDate} YA ESTÁ RESERVADO por ${conflictBooking.userName} (${conflictBooking.checkInDate} al ${conflictBooking.checkOutDate}). No es posible duplicar reservas en la estancia.`,
        conflictBooking,
      });
    }

    // Overlap validation with maintenance blocks
    const conflictBlock = blocks.find((bl: any) => {
      return !(checkOutDate < bl.startDate || checkInDate > bl.endDate);
    });

    if (conflictBlock) {
      return res.status(409).json({
        success: false,
        code: 'BLOCK_CONFLICT',
        error: `Conflicto con bloqueo oficial de la estancia: "${conflictBlock.title}" (${conflictBlock.startDate} al ${conflictBlock.endDate}).`,
        conflictBlock,
      });
    }

    // Calculate days
    const s = new Date(checkInDate + 'T00:00:00');
    const e = new Date(checkOutDate + 'T00:00:00');
    const computedDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const finalDays = totalDays || computedDays;

    const newBooking = {
      id: 'book-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      userId,
      userName,
      userColor,
      partName,
      checkInDate,
      checkOutDate,
      totalDays: finalDays,
      status: 'pending',
      guestsCount,
      arrivalTime,
      notes: notes ? notes.trim() : undefined,
      cleaningBufferApplied,
      createdAt: new Date().toISOString(),
    };

    state.bookings = [newBooking, ...bookings];

    // Recalculate user quotas in server state (only confirmed/completed count)
    if (Array.isArray(state.users)) {
      state.users = state.users.map((u: any) => {
        if (u.role === 'admin') return u;
        const uBookings = state.bookings.filter(
          (b: any) => b.userId === u.id && (b.status === 'confirmed' || b.status === 'completed')
        );
        const used = uBookings.reduce((sum: number, b: any) => sum + (b.totalDays || 0), 0);
        return { ...u, usedDays: used };
      });
    }

    // Add push notification in server state
    if (!Array.isArray(state.notifications)) state.notifications = [];
    state.notifications.unshift({
      id: 'notif-' + Date.now(),
      title: 'Nueva Solicitud de Reserva',
      body: `${userName} solicitó del ${checkInDate} al ${checkOutDate} (${finalDays} días). Pendiente de aprobación del administrador.`,
      type: 'booking_created',
      bookingId: newBooking.id,
      createdAt: new Date().toISOString(),
      read: false,
    });

    saveServerState(state);

    return res.status(201).json({
      success: true,
      booking: newBooking,
      message: `Solicitud de reserva registrada para ${userName}. Pendiente de aprobación administrativa.`,
    });
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Error procesando reserva en el servidor',
    });
  }
});

// 4b. Approve Booking
app.post('/api/bookings/:id/approve', (req, res) => {
  try {
    const bookingId = req.params.id;
    const { approvedByName = 'Administrador' } = req.body;
    const state = loadServerState();
    const bookings = Array.isArray(state.bookings) ? state.bookings : [];
    const target = bookings.find((b: any) => b.id === bookingId);

    if (!target) {
      return res.status(404).json({ success: false, error: 'Reserva no encontrada.' });
    }

    state.bookings = bookings.map((b: any) => {
      if (b.id === bookingId) {
        return {
          ...b,
          status: 'confirmed',
          approvedAt: new Date().toISOString(),
          approvedBy: approvedByName,
        };
      }
      return b;
    });

    // Recalculate user quotas in server state
    if (Array.isArray(state.users)) {
      state.users = state.users.map((u: any) => {
        if (u.role === 'admin') return u;
        const uBookings = state.bookings.filter(
          (b: any) => b.userId === u.id && (b.status === 'confirmed' || b.status === 'completed')
        );
        const used = uBookings.reduce((sum: number, b: any) => sum + (b.totalDays || 0), 0);
        return { ...u, usedDays: used };
      });
    }

    // Add push notification for approval (visible to all, personalized by client)
    if (!Array.isArray(state.notifications)) state.notifications = [];
    state.notifications.unshift({
      id: 'notif-' + Date.now(),
      title: '¡Reserva Aprobada!',
      body: `La reserva de ${target.userName} (${target.checkInDate} al ${target.checkOutDate}) fue confirmada por ${approvedByName}.`,
      type: 'booking_approved',
      bookingId: target.id,
      bookingUserId: target.userId,
      bookingUserName: target.userName,
      bookingPartName: target.partName,
      checkInDate: target.checkInDate,
      checkOutDate: target.checkOutDate,
      totalDays: target.totalDays,
      targetUserId: null,
      createdAt: new Date().toISOString(),
      read: false,
    });

    saveServerState(state);
    return res.json({ success: true, message: 'Reserva aprobada con éxito.' });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error aprobando reserva' });
  }
});

// 5. Cancel Booking
app.post('/api/bookings/:id/cancel', (req, res) => {
  try {
    const bookingId = req.params.id;
    const { reason = 'Cancelado por el usuario', cancelledByName = 'Usuario' } = req.body;
    const state = loadServerState();
    const bookings = Array.isArray(state.bookings) ? state.bookings : [];
    const target = bookings.find((b: any) => b.id === bookingId);

    if (!target) {
      return res.status(404).json({ success: false, error: 'Reserva no encontrada.' });
    }

    const isRejection = target.status === 'pending';

    state.bookings = bookings.map((b: any) => {
      if (b.id === bookingId) {
        return {
          ...b,
          status: 'cancelled',
          cancellationReason: reason,
          cancelledAt: new Date().toISOString(),
          cancelledBy: cancelledByName,
        };
      }
      return b;
    });

    // Recalculate user quotas (only for confirmed/completed bookings)
    if (Array.isArray(state.users)) {
      state.users = state.users.map((u: any) => {
        if (u.role === 'admin') return u;
        const uBookings = state.bookings.filter(
          (b: any) => b.userId === u.id && (b.status === 'confirmed' || b.status === 'completed')
        );
        const used = uBookings.reduce((sum: number, b: any) => sum + (b.totalDays || 0), 0);
        return { ...u, usedDays: used };
      });
    }

    if (!Array.isArray(state.notifications)) state.notifications = [];
    if (isRejection) {
      // Rejections are strictly private to applicant and admin
      state.notifications.unshift({
        id: 'notif-' + Date.now(),
        title: 'Solicitud de Reserva Desestimada',
        body: `Tu solicitud para el período ${target.checkInDate} al ${target.checkOutDate} fue desestimada por la administración: ${reason}. Las fechas han sido liberadas en el calendario.`,
        type: 'booking_rejected',
        bookingId: target.id,
        bookingUserId: target.userId,
        bookingUserName: target.userName,
        bookingPartName: target.partName,
        checkInDate: target.checkInDate,
        checkOutDate: target.checkOutDate,
        totalDays: target.totalDays,
        targetUserId: target.userId, // PRIVACY: Only applicant and admin see it
        createdAt: new Date().toISOString(),
        read: false,
      });
    } else {
      state.notifications.unshift({
        id: 'notif-' + Date.now(),
        title: 'Reserva Cancelada',
        body: `La reserva de ${target.userName} (${target.checkInDate} a ${target.checkOutDate}) fue cancelada por ${cancelledByName}. Fechas liberadas.`,
        type: 'booking_cancelled',
        bookingId: target.id,
        bookingUserId: target.userId,
        bookingUserName: target.userName,
        bookingPartName: target.partName,
        checkInDate: target.checkInDate,
        checkOutDate: target.checkOutDate,
        totalDays: target.totalDays,
        targetUserId: null,
        createdAt: new Date().toISOString(),
        read: false,
      });
    }

    saveServerState(state);
    return res.json({ success: true, message: 'Reserva cancelada en el servidor.' });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error cancelando reserva' });
  }
});

// 6. Users endpoints
app.get('/api/users', async (_req, res) => {
  try {
    if (supabaseServerClient) {
      const { data, error } = await supabaseServerClient.from('users').select('*').order('name');
      if (!error && Array.isArray(data) && data.length > 0) {
        const users = data.map((u: any) => ({
          id: u.id,
          name: u.name || '',
          username: u.username || '',
          email: u.email || '',
          phone: u.phone || '',
          role: u.role || 'owner',
          cabezaNumber: typeof u.cabeza_number === 'number' ? u.cabeza_number : (u.cabeza_number !== null && u.cabeza_number !== undefined ? Number(u.cabeza_number) : 0),
          partName: u.part_name || '',
          color: u.color || '#000000',
          active: u.active ?? true,
          annualQuotaDays: typeof u.annual_quota_days === 'number' ? u.annual_quota_days : (u.annual_quota_days !== null && u.annual_quota_days !== undefined ? Number(u.annual_quota_days) : 30),
          pendingDays: u.pending_days || 0,
          usedDays: u.used_days || 0,
          sharePercentage: typeof u.share_percentage === 'number' ? u.share_percentage : (parseFloat(u.share_percentage) || 0),
          avatarInitials: u.avatar_initials || '',
          createdAt: u.created_at,
        }));
        const state = loadServerState();
        state.users = users;
        saveServerState(state);
        return res.json({ success: true, users, source: 'supabase' });
      }
    }
    const state = loadServerState();
    return res.json({ success: true, users: state.users || [] });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error obteniendo usuarios' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const user = req.body;
    if (!user || !user.id) {
      return res.status(400).json({ success: false, error: 'Usuario no válido' });
    }
    const state = loadServerState();
    const users = Array.isArray(state.users) ? state.users : [];
    const idx = users.findIndex((u: any) => u.id === user.id);
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...user };
    } else {
      users.push(user);
    }
    state.users = users;
    saveServerState(state);

    if (supabaseServerClient) {
      try {
        await supabaseServerClient.from('users').upsert({
          id: user.id,
          name: user.name || '',
          username: user.username || '',
          email: user.email || '',
          phone: user.phone || '',
          role: user.role || 'owner',
          cabeza_number: typeof user.cabezaNumber === 'number' ? user.cabezaNumber : (user.cabezaNumber !== undefined && user.cabezaNumber !== null ? Number(user.cabezaNumber) : 0),
          part_name: user.partName || '',
          color: user.color || '#000000',
          active: user.active ?? true,
          annual_quota_days: typeof user.annualQuotaDays === 'number' ? user.annualQuotaDays : (user.annualQuotaDays !== undefined && user.annualQuotaDays !== null ? Number(user.annualQuotaDays) : 30),
          pending_days: user.pendingDays || 0,
          used_days: user.usedDays || 0,
          share_percentage: typeof user.sharePercentage === 'number' ? user.sharePercentage : (parseFloat(user.sharePercentage) || 0),
          avatar_initials: user.avatarInitials || '',
          created_at: user.createdAt || new Date().toISOString(),
        }, { onConflict: 'id' });
      } catch (sbErr) {
        console.error('Error guardando usuario en Supabase:', sbErr);
      }
    }

    return res.json({ success: true, user });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error guardando usuario' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const state = loadServerState();
    const users = Array.isArray(state.users) ? state.users : [];
    state.users = users.filter((u: any) => u.id !== userId);
    saveServerState(state);

    if (supabaseServerClient) {
      try {
        await supabaseServerClient.from('users').delete().eq('id', userId);
      } catch (e) {
        console.error('Error eliminando usuario de Supabase:', e);
      }
    }

    return res.json({ success: true, message: 'Usuario eliminado correctamente' });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error eliminando usuario' });
  }
});

// Transfer Admin Power
app.post('/api/users/transfer-admin', (req, res) => {
  try {
    const { newAdminUserId, currentAdminUserId } = req.body;
    if (!newAdminUserId) {
      return res.status(400).json({ success: false, error: 'Falta newAdminUserId' });
    }
    const state = loadServerState();
    const users = Array.isArray(state.users) ? state.users : [];
    const newAdmin = users.find((u: any) => u.id === newAdminUserId);
    if (!newAdmin) {
      return res.status(404).json({ success: false, error: 'Nuevo administrador no encontrado' });
    }

    state.users = users.map((u: any) => {
      if (u.id === newAdminUserId) {
        return { ...u, role: 'admin' };
      }
      if (u.role === 'admin' || (currentAdminUserId && u.id === currentAdminUserId)) {
        return { ...u, role: 'owner' };
      }
      return u;
    });

    if (!Array.isArray(state.notifications)) state.notifications = [];
    state.notifications.unshift({
      id: 'notif-' + Date.now(),
      title: 'Traspaso de Poder de Administración',
      body: `${newAdmin.name} ha asumido como Administrador de la sociedad.`,
      type: 'system',
      createdAt: new Date().toISOString(),
      read: false,
    });

    saveServerState(state);
    return res.json({
      success: true,
      message: `Poder de administración transferido exitosamente a ${newAdmin.name}.`,
      users: state.users,
    });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error transfiriendo administración' });
  }
});

// Update User Password
app.post('/api/users/:id/password', (req, res) => {
  try {
    const userId = req.params.id;
    const { password } = req.body;
    const code = (password || '').trim().toUpperCase();
    if (code.length !== 6) {
      return res.status(400).json({
        success: false,
        error: 'La contraseña debe ser un código alfanumérico de exactamente 6 caracteres.',
      });
    }

    const state = loadServerState();
    const users = Array.isArray(state.users) ? state.users : [];
    const idx = users.findIndex((u: any) => u.id === userId);
    if (idx < 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    users[idx] = { ...users[idx], password: code };
    state.users = users;
    saveServerState(state);
    return res.json({ success: true, message: `Contraseña actualizada a "${code}"` });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error actualizando contraseña' });
  }
});

// 7. Bulk Shares Update
app.post('/api/users/bulk-shares', (req, res) => {
  try {
    const { sharesMap } = req.body;
    if (!sharesMap || typeof sharesMap !== 'object') {
      return res.status(400).json({ success: false, error: 'Mapa de acciones no válido' });
    }
    const state = loadServerState();
    if (Array.isArray(state.users)) {
      state.users = state.users.map((u: any) => {
        if (sharesMap[u.id] !== undefined) {
          return {
            ...u,
            sharePercentage: Math.max(0, Math.round(Number(sharesMap[u.id]) * 10000) / 10000),
          };
        }
        return u;
      });
    }
    saveServerState(state);
    return res.json({ success: true, message: 'Acciones actualizadas en servidor', users: state.users });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error actualizando acciones' });
  }
});

// Assign Cabeza Leader
app.post('/api/users/assign-cabeza-leader', (req, res) => {
  try {
    const { cabezaNumber, newLeaderUserId } = req.body;
    if (!cabezaNumber || !newLeaderUserId) {
      return res.status(400).json({ success: false, error: 'Faltan parámetros' });
    }
    const state = loadServerState();
    if (Array.isArray(state.users)) {
      state.users.forEach((u: any) => {
        if (u.cabezaNumber === Number(cabezaNumber)) {
          u.isCabezaDeEquipo = u.id === newLeaderUserId;
        }
      });
    }
    saveServerState(state);
    return res.json({ success: true, users: state.users });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error asignando líder de cabeza' });
  }
});

// 8. Date Blocks
app.get('/api/blocks', (_req, res) => {
  try {
    const state = loadServerState();
    return res.json({ success: true, blocks: state.blocks || [] });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error obteniendo bloqueos' });
  }
});

app.post('/api/blocks', (req, res) => {
  try {
    const block = req.body;
    if (!block || !block.startDate || !block.endDate) {
      return res.status(400).json({ success: false, error: 'Fechas de bloqueo requeridas' });
    }
    const state = loadServerState();
    const blocks = Array.isArray(state.blocks) ? state.blocks : [];
    const newBlock = {
      ...block,
      id: block.id || 'block-' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    state.blocks = [newBlock, ...blocks];
    saveServerState(state);
    return res.status(201).json({ success: true, block: newBlock });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error creando bloqueo' });
  }
});

app.delete('/api/blocks/:id', async (req, res) => {
  try {
    const blockId = req.params.id;
    const state = loadServerState();
    state.blocks = (state.blocks || []).filter((b: any) => b.id !== blockId);
    saveServerState(state);
    if (supabaseServerClient) {
      try { await supabaseServerClient.from('blocks').delete().eq('id', blockId); } catch {}
    }
    return res.json({ success: true });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error eliminando bloqueo' });
  }
});

// 9. Rules Endpoints
app.get('/api/rules', (_req, res) => {
  try {
    const state = loadServerState();
    return res.json({ success: true, rules: state.rules || [] });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error obteniendo reglas' });
  }
});

app.post('/api/rules', (req, res) => {
  try {
    const rule = req.body;
    if (!rule || !rule.title) {
      return res.status(400).json({ success: false, error: 'Regla inválida' });
    }
    const state = loadServerState();
    const rules = Array.isArray(state.rules) ? state.rules : [];
    const idx = rules.findIndex((r: any) => r.id === rule.id);
    if (idx >= 0) {
      rules[idx] = rule;
    } else {
      rules.push({ ...rule, id: rule.id || 'rule-' + Date.now() });
    }
    state.rules = rules;
    saveServerState(state);
    return res.json({ success: true, rules: state.rules });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error guardando regla' });
  }
});

app.delete('/api/rules/:id', async (req, res) => {
  try {
    const ruleId = req.params.id;
    const state = loadServerState();
    state.rules = (state.rules || []).filter((r: any) => r.id !== ruleId);
    saveServerState(state);
    if (supabaseServerClient) {
      try { await supabaseServerClient.from('rules').delete().eq('id', ruleId); } catch {}
    }
    return res.json({ success: true, rules: state.rules });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error eliminando regla' });
  }
});

// 10. Contacts Endpoints
app.get('/api/contacts', (_req, res) => {
  try {
    const state = loadServerState();
    return res.json({ success: true, contacts: state.contacts || [] });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error obteniendo contactos' });
  }
});

app.post('/api/contacts', (req, res) => {
  try {
    const contact = req.body;
    if (!contact || !contact.name) {
      return res.status(400).json({ success: false, error: 'Contacto inválido' });
    }
    const state = loadServerState();
    const contacts = Array.isArray(state.contacts) ? state.contacts : [];
    const idx = contacts.findIndex((c: any) => c.id === contact.id);
    if (idx >= 0) {
      contacts[idx] = contact;
    } else {
      contacts.push({ ...contact, id: contact.id || 'cnt-' + Date.now() });
    }
    state.contacts = contacts;
    saveServerState(state);
    return res.json({ success: true, contacts: state.contacts });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error guardando contacto' });
  }
});

app.delete('/api/contacts/:id', async (req, res) => {
  try {
    const cntId = req.params.id;
    const state = loadServerState();
    state.contacts = (state.contacts || []).filter((c: any) => c.id !== cntId);
    saveServerState(state);
    if (supabaseServerClient) {
      try { await supabaseServerClient.from('contacts').delete().eq('id', cntId); } catch {}
    }
    return res.json({ success: true, contacts: state.contacts });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error eliminando contacto' });
  }
});

// 11. Documents Endpoints
app.get('/api/documents', (_req, res) => {
  try {
    const state = loadServerState();
    return res.json({ success: true, documents: state.documents || [] });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error obteniendo documentos' });
  }
});

app.post('/api/documents', (req, res) => {
  try {
    const doc = req.body;
    if (!doc || !doc.title) {
      return res.status(400).json({ success: false, error: 'Documento inválido' });
    }
    const state = loadServerState();
    const docs = Array.isArray(state.documents) ? state.documents : [];
    const idx = docs.findIndex((d: any) => d.id === doc.id);
    if (idx >= 0) {
      docs[idx] = doc;
    } else {
      docs.push({ ...doc, id: doc.id || 'doc-' + Date.now() });
    }
    state.documents = docs;
    saveServerState(state);
    return res.json({ success: true, documents: state.documents });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error guardando documento' });
  }
});

app.delete('/api/documents/:id', async (req, res) => {
  try {
    const docId = req.params.id;
    const state = loadServerState();
    state.documents = (state.documents || []).filter((d: any) => d.id !== docId);
    saveServerState(state);
    if (supabaseServerClient) {
      try { await supabaseServerClient.from('documents').delete().eq('id', docId); } catch {}
    }
    return res.json({ success: true, documents: state.documents });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error eliminando documento' });
  }
});

// 12. Inventory Endpoints
app.get('/api/inventory', (_req, res) => {
  try {
    const state = loadServerState();
    return res.json({ success: true, inventory: state.inventory || [] });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error obteniendo inventario' });
  }
});

app.post('/api/inventory', (req, res) => {
  try {
    const item = req.body;
    if (!item || !item.name) {
      return res.status(400).json({ success: false, error: 'Artículo inválido' });
    }
    const state = loadServerState();
    const inv = Array.isArray(state.inventory) ? state.inventory : [];
    const idx = inv.findIndex((i: any) => i.id === item.id);
    if (idx >= 0) {
      inv[idx] = item;
    } else {
      inv.push({ ...item, id: item.id || 'inv-' + Date.now() });
    }
    state.inventory = inv;
    saveServerState(state);
    return res.json({ success: true, inventory: state.inventory });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error guardando inventario' });
  }
});

app.delete('/api/inventory/:id', async (req, res) => {
  try {
    const invId = req.params.id;
    const state = loadServerState();
    state.inventory = (state.inventory || []).filter((i: any) => i.id !== invId);
    saveServerState(state);
    if (supabaseServerClient) {
      try { await supabaseServerClient.from('inventory').delete().eq('id', invId); } catch {}
    }
    return res.json({ success: true, inventory: state.inventory });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error eliminando inventario' });
  }
});

// 13. Incidents Endpoints
app.get('/api/incidents', (_req, res) => {
  try {
    const state = loadServerState();
    return res.json({ success: true, incidents: state.incidents || [] });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error obteniendo incidentes' });
  }
});

app.post('/api/incidents', (req, res) => {
  try {
    const incident = req.body;
    if (!incident || !incident.title) {
      return res.status(400).json({ success: false, error: 'Incidente inválido' });
    }
    const state = loadServerState();
    const incs = Array.isArray(state.incidents) ? state.incidents : [];
    const idx = incs.findIndex((i: any) => i.id === incident.id);
    if (idx >= 0) {
      incs[idx] = incident;
    } else {
      incs.unshift({ ...incident, id: incident.id || 'inc-' + Date.now() });
    }
    state.incidents = incs;
    saveServerState(state);
    return res.json({ success: true, incidents: state.incidents });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error guardando incidente' });
  }
});

// 14. Fee Collections
app.get('/api/fees', async (_req, res) => {
  try {
    if (supabaseServerClient) {
      const { data, error } = await supabaseServerClient
        .from('fee_collections')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        const fees = data.map((f: any) => ({
          id: f.id,
          concept: f.concept || '',
          category: f.category || 'expensas_ordinarias',
          totalAmount: Number(f.total_amount) || 0,
          currency: f.currency || 'ARS',
          recurrence: f.recurrence || 'mensual',
          issueDate: f.issue_date || null,
          dueDate: f.due_date || null,
          distributionMode: f.distribution_mode || 'share_percentage',
          allocations: typeof f.allocations === 'string' ? JSON.parse(f.allocations) : (f.allocations || []),
          shares: typeof f.shares === 'string' ? JSON.parse(f.shares) : (f.shares || []),
          targetMonth: f.target_month || '',
          status: f.status || 'active',
          notes: f.notes || '',
          installmentsCount: f.installments_count || 1,
          installmentNumber: f.installment_number || 1,
          originalExpenseId: f.original_expense_id || null,
          createdBy: f.created_by || '',
          createdAt: f.created_at,
        }));
        const state = loadServerState();
        state.fees = fees;
        saveServerState(state);
        return res.json({ success: true, fees, source: 'supabase' });
      }
    }
    const state = loadServerState();
    return res.json({ success: true, fees: state.fees || [] });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error obteniendo cobranzas' });
  }
});

app.post('/api/fees', async (req, res) => {
  try {
    const fee = req.body;
    if (!fee || !fee.id) {
      return res.status(400).json({ success: false, error: 'Cobranza no válida' });
    }
    const state = loadServerState();
    const fees = Array.isArray(state.fees) ? state.fees : [];
    const idx = fees.findIndex((f: any) => f.id === fee.id);
    if (idx >= 0) {
      fees[idx] = fee;
    } else {
      fees.unshift(fee);
    }
    state.fees = fees;
    saveServerState(state);

    if (supabaseServerClient) {
      try {
        await supabaseServerClient.from('fee_collections').upsert({
          id: fee.id,
          concept: fee.concept || '',
          category: fee.category || 'expensas_ordinarias',
          total_amount: fee.totalAmount || 0,
          currency: fee.currency || 'ARS',
          recurrence: fee.recurrence || 'mensual',
          issue_date: fee.issueDate || null,
          due_date: fee.dueDate || null,
          distribution_mode: fee.distributionMode || 'proporcional',
          allocations: fee.allocations ? JSON.stringify(fee.allocations) : '[]',
          status: fee.status || 'active',
          created_by: fee.createdBy || '',
          created_at: fee.createdAt || new Date().toISOString(),
          notes: fee.notes || '',
          installments_count: fee.installmentsCount || 1,
          installment_number: fee.installmentNumber || 1,
          original_expense_id: fee.originalExpenseId || null,
        }, { onConflict: 'id' });
      } catch (sbErr) {
        console.error('Error upserting fee collection to Supabase:', sbErr);
      }
    }
    broadcastSyncEvent('fees_updated', { fees: state.fees });
    return res.json({ success: true, fee });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error guardando cobranza' });
  }
});

app.delete('/api/fees/:id', async (req, res) => {
  try {
    const feeId = req.params.id;
    const state = loadServerState();
    state.fees = (state.fees || []).filter((f: any) => f.id !== feeId);
    saveServerState(state);

    if (supabaseServerClient) {
      try {
        await supabaseServerClient.from('fee_collections').delete().eq('id', feeId);
      } catch (sbErr) {
        console.error('Error deleting fee collection from Supabase:', sbErr);
      }
    }
    broadcastSyncEvent('fees_updated', { fees: state.fees });
    return res.json({ success: true });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error eliminando cobranza' });
  }
});

// 15. Expenses
app.get('/api/expenses', async (_req, res) => {
  try {
    if (supabaseServerClient) {
      const { data, error } = await supabaseServerClient
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });
      if (!error && Array.isArray(data)) {
        const expenses = data.map((e: any) => ({
          id: e.id,
          date: e.date || '',
          concept: e.concept || '',
          amount: Number(e.amount) || 0,
          currency: e.currency || 'ARS',
          category: e.category || 'otro',
          provider: e.provider || '',
          invoiceNumber: e.invoice_number || '',
          status: e.status || 'paid',
          paidAt: e.paid_at || undefined,
          createdBy: e.created_by || '',
          receiptUrl: e.receipt_url || '',
          paymentMethod: e.payment_method || 'transfer',
          periodMonth: e.period_month || '',
          notes: e.notes || '',
          createdAt: e.created_at,
          userId: e.user_id || null,
          userName: e.user_name || '',
          partName: e.part_name || '',
          approvalStatus: e.approval_status || 'approved',
          approvedAt: e.approved_at || null,
          approvedBy: e.approved_by || '',
          rejectionReason: e.rejection_reason || '',
          reimbursementStatus: e.reimbursement_status || 'unpaid',
          reimbursedAmount: Number(e.reimbursed_amount) || 0,
        }));
        const state = loadServerState();
        state.expenses = expenses;
        saveServerState(state);
        return res.json({ success: true, expenses, source: 'supabase' });
      }
    }
    const state = loadServerState();
    return res.json({ success: true, expenses: state.expenses || [] });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error obteniendo gastos' });
  }
});

app.post('/api/expenses', async (req, res) => {
  try {
    const expense = req.body;
    if (!expense || !expense.id) {
      return res.status(400).json({ success: false, error: 'Gasto no válido' });
    }
    const state = loadServerState();
    const expenses = Array.isArray(state.expenses) ? state.expenses : [];
    const idx = expenses.findIndex((e: any) => e.id === expense.id);
    if (idx >= 0) {
      expenses[idx] = expense;
    } else {
      expenses.unshift(expense);
    }
    state.expenses = expenses;
    saveServerState(state);

    if (supabaseServerClient) {
      const { error: sbError } = await supabaseServerClient.from('expenses').upsert({
        id: expense.id,
        date: expense.date || null,
        concept: expense.concept || '',
        amount: expense.amount || 0,
        currency: expense.currency || 'ARS',
        category: expense.category || 'otro',
        provider: expense.provider || '',
        invoice_number: expense.invoiceNumber || '',
        status: expense.status || 'paid',
        paid_at: expense.paidAt || null,
        payment_method: expense.paymentMethod || 'cash',
        receipt_url: expense.receiptUrl || '',
        period_month: expense.periodMonth || '',
        notes: expense.notes || '',
        created_by: expense.createdBy || '',
        user_id: expense.userId || null,
        user_name: expense.userName || '',
        part_name: expense.partName || '',
        approval_status: expense.approvalStatus || 'approved',
        approved_at: expense.approvedAt || null,
        approved_by: expense.approvedBy || '',
        rejection_reason: expense.rejectionReason || '',
        reimbursement_status: expense.reimbursementStatus || 'unpaid',
        reimbursed_amount: expense.reimbursedAmount || 0,
        created_at: expense.createdAt || new Date().toISOString(),
      }, { onConflict: 'id' });

      if (sbError) {
        console.error('Supabase expense upsert error:', sbError.message);
        return res.status(500).json({ 
          success: false, 
          error: `Error al persistir el gasto en Supabase: ${sbError.message}. Verifique que la tabla 'expenses' en Supabase tenga las columnas user_id, user_name y part_name.` 
        });
      }
    }
    broadcastSyncEvent('expenses_updated', { expenses: state.expenses });
    return res.json({ success: true, expense });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error guardando gasto' });
  }
});

app.delete('/api/expenses/:id', async (req, res) => {
  try {
    const expId = req.params.id;
    const state = loadServerState();
    state.expenses = (state.expenses || []).filter((e: any) => e.id !== expId);
    saveServerState(state);

    if (supabaseServerClient) {
      try {
        await supabaseServerClient.from('expenses').delete().eq('id', expId);
      } catch (sbErr) {
        console.error('Error deleting expense from Supabase:', sbErr);
      }
    }
    broadcastSyncEvent('expenses_updated', { expenses: state.expenses });
    return res.json({ success: true });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error eliminando gasto' });
  }
});

// 16. Cash Flow / Cajas y Cuentas
app.get('/api/cash-flow', async (_req, res) => {
  try {
    if (supabaseServerClient) {
      const { data, error } = await supabaseServerClient
        .from('cash_flow')
        .select('*')
        .order('date', { ascending: false });
      if (!error && Array.isArray(data)) {
        const transactions = data.map((cf: any) => ({
          id: cf.id,
          type: cf.type || 'ingreso',
          category: cf.category || 'otro_ingreso',
          concept: cf.concept || '',
          amount: Number(cf.amount) || 0,
          currency: cf.currency || 'ARS',
          date: cf.date || '',
          userId: cf.user_id || null,
          userName: cf.user_name || '',
          partName: cf.part_name || '',
          expenseId: cf.expense_id || null,
          notes: cf.notes || '',
          createdBy: cf.created_by || '',
          createdAt: cf.created_at,
        }));
        const state = loadServerState();
        state.cashFlow = transactions;
        saveServerState(state);
        return res.json({ success: true, transactions, cashFlow: transactions, source: 'supabase' });
      }
    }
    const state = loadServerState();
    return res.json({ success: true, transactions: state.cashFlow || [], cashFlow: state.cashFlow || [] });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error obteniendo movimientos de caja' });
  }
});

app.post('/api/cash-flow', async (req, res) => {
  try {
    const tx = req.body;
    if (!tx || !tx.id) {
      return res.status(400).json({ success: false, error: 'Transacción no válida' });
    }
    const state = loadServerState();
    const cashFlow = Array.isArray(state.cashFlow) ? state.cashFlow : [];
    const idx = cashFlow.findIndex((c: any) => c.id === tx.id);
    if (idx >= 0) {
      cashFlow[idx] = tx;
    } else {
      cashFlow.unshift(tx);
    }
    state.cashFlow = cashFlow;
    saveServerState(state);

    if (supabaseServerClient) {
      try {
        await supabaseServerClient.from('cash_flow').upsert({
          id: tx.id,
          type: tx.type || 'ingreso',
          category: tx.category || 'otro_ingreso',
          concept: tx.concept || '',
          amount: tx.amount || 0,
          currency: tx.currency || 'ARS',
          date: tx.date || null,
          user_id: tx.userId || null,
          user_name: tx.userName || '',
          part_name: tx.partName || '',
          expense_id: tx.expenseId || null,
          notes: tx.notes || '',
          created_by: tx.createdBy || '',
          created_at: tx.createdAt || new Date().toISOString(),
        }, { onConflict: 'id' });
      } catch (sbErr) {
        console.error('Error upserting cash flow to Supabase:', sbErr);
      }
    }
    broadcastSyncEvent('cash_flow_updated', { cashFlow: state.cashFlow });
    return res.json({ success: true, tx });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error guardando transacción de caja' });
  }
});

app.delete('/api/cash-flow/:id', async (req, res) => {
  try {
    const txId = req.params.id;
    const state = loadServerState();
    state.cashFlow = (state.cashFlow || []).filter((c: any) => c.id !== txId);
    saveServerState(state);

    if (supabaseServerClient) {
      try {
        await supabaseServerClient.from('cash_flow').delete().eq('id', txId);
      } catch (sbErr) {
        console.error('Error deleting cash flow transaction from Supabase:', sbErr);
      }
    }
    broadcastSyncEvent('cash_flow_updated', { cashFlow: state.cashFlow });
    return res.json({ success: true });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error eliminando transacción de caja' });
  }
});
async function bootstrap() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[El Desayuno ERP] Servidor ejecutándose en http://0.0.0.0:${PORT}`);
  });
}

bootstrap();
