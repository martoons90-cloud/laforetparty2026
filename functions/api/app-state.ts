// Cloudflare Pages Functions - Native Edge API for /api/app-state
// Automatically executed by Cloudflare Pages when deployed

interface Env {
  DB?: any;
  KV?: any;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_DATABASE_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
}

const CF_ACCOUNT_ID = 'b36aef318f314d0aaaef32a2155d9841';
const CF_DATABASE_ID = 'f0474948-373a-4522-833b-36eb13858100';
const CF_API_TOKEN = '';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Pragma, Cache-Control',
};

const DEFAULT_SETTINGS = {
  houseName: '', slogan: '', location: '', wifiSsid: '', wifiPassword: '', checkInTime: '', checkOutTime: '',
  autoCleaningBufferHours: 0, cancellationMinDays: 0, maxGuestsLimit: 0, emergencyAddress: '',
  cbu: '', aliasBancario: '', cuitFideicomiso: '', bancoNombre: '', titularCuenta: '', wifiCoverageNotes: '',
  logoUrl: '',
};

function mapRowToSettings(row: any): Record<string, any> {
  if (!row || typeof row !== 'object') return { ...DEFAULT_SETTINGS };
  return {
    houseName: row.house_name ?? row.houseName ?? DEFAULT_SETTINGS.houseName,
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
    slogan: row.slogan ?? DEFAULT_SETTINGS.slogan,
    updatedAt: row.updated_at ?? row.updatedAt ?? new Date().toISOString(),
  };
}

export const onRequestOptions = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const onRequestGet = async (context: any) => {
  const { env } = context;

  try {
    // 1. If Cloudflare D1 is bound as 'DB'
    if (env.DB) {
      try {
        const [usersRes, bookingsRes, blocksRes, settingsRes] = await Promise.all([
          env.DB.prepare('SELECT * FROM users ORDER BY name ASC').all(),
          env.DB.prepare('SELECT * FROM bookings ORDER BY check_in_date DESC').all(),
          env.DB.prepare('SELECT * FROM date_blocks ORDER BY start_date DESC').all(),
          env.DB.prepare("SELECT * FROM trust_settings WHERE id = 'default_settings' LIMIT 1").first(),
        ]);

        const users = (usersRes.results || []).map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          partName: u.part_name,
          annualQuotaDays: u.annual_quota_days,
          usedDays: u.used_days,
          color: u.color,
          avatarInitials: u.avatar_initials,
          active: Boolean(u.active),
        }));

        const bookings = (bookingsRes.results || []).map((b: any) => ({
          id: b.id,
          userId: b.user_id,
          userName: b.user_name,
          userColor: b.user_color,
          partName: b.part_name,
          checkInDate: b.check_in_date,
          checkOutDate: b.check_out_date,
          totalDays: b.total_days,
          status: b.status,
          guestsCount: b.guests_count,
          arrivalTime: b.arrival_time,
          notes: b.notes,
        }));

        const blocks = (blocksRes.results || []).map((bl: any) => ({
          id: bl.id,
          startDate: bl.start_date,
          endDate: bl.end_date,
          totalDays: bl.total_days,
          reason: bl.reason,
          title: bl.title,
          notes: bl.notes,
        }));

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              users,
              bookings,
              blocks,
              settings: mapRowToSettings(settingsRes),
            },
          }),
          { headers: CORS_HEADERS }
        );
      } catch (dbErr) {
        console.warn('env.DB read error in /api/app-state:', dbErr);
      }
    }

    // 2. Fallback to Cloudflare D1 REST API
    const actId = env.CLOUDFLARE_ACCOUNT_ID || CF_ACCOUNT_ID;
    const dbId = env.CLOUDFLARE_DATABASE_ID || CF_DATABASE_ID;
    const token = env.CLOUDFLARE_API_TOKEN || CF_API_TOKEN;

    if (actId && dbId && token) {
      try {
        const cfRes = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${actId}/d1/database/${dbId}/query`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sql: `
                SELECT * FROM users ORDER BY name ASC;
                SELECT * FROM bookings ORDER BY check_in_date DESC;
                SELECT * FROM date_blocks ORDER BY start_date DESC;
                SELECT * FROM trust_settings WHERE id = 'default_settings' LIMIT 1;
              `,
            }),
          }
        );
        const cfData: any = await cfRes.json();
        const results = cfData?.result || [];

        const usersRaw = results[0]?.results || [];
        const bookingsRaw = results[1]?.results || [];
        const blocksRaw = results[2]?.results || [];
        const settingsRow = results[3]?.results?.[0];

        const users = usersRaw.map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          partName: u.part_name,
          annualQuotaDays: u.annual_quota_days,
          usedDays: u.used_days,
          color: u.color,
          avatarInitials: u.avatar_initials,
          active: Boolean(u.active),
        }));

        const bookings = bookingsRaw.map((b: any) => ({
          id: b.id,
          userId: b.user_id,
          userName: b.user_name,
          userColor: b.user_color,
          partName: b.part_name,
          checkInDate: b.check_in_date,
          checkOutDate: b.check_out_date,
          totalDays: b.total_days,
          status: b.status,
          guestsCount: b.guests_count,
          arrivalTime: b.arrival_time,
          notes: b.notes,
        }));

        const blocks = blocksRaw.map((bl: any) => ({
          id: bl.id,
          startDate: bl.start_date,
          endDate: bl.end_date,
          totalDays: bl.total_days,
          reason: bl.reason,
          title: bl.title,
          notes: bl.notes,
        }));

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              users,
              bookings,
              blocks,
              settings: mapRowToSettings(settingsRow),
            },
          }),
          { headers: CORS_HEADERS }
        );
      } catch (restErr) {
        console.warn('REST D1 query error in /api/app-state:', restErr);
      }
    }

    if (env.KV) {
      const raw = await env.KV.get('app_state');
      if (raw) {
        return new Response(JSON.stringify({ success: true, data: JSON.parse(raw) }), { headers: CORS_HEADERS });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          settings: DEFAULT_SETTINGS,
        },
      }),
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: CORS_HEADERS });
  }
};

export const onRequestPost = async (context: any) => {
  const { request, env } = context;

  try {
    const data = await request.json();
    if (!data || typeof data !== 'object') {
      return new Response(JSON.stringify({ success: false, error: 'Datos no válidos' }), { status: 400, headers: CORS_HEADERS });
    }

    // If incoming payload has settings, persist safely to D1
    if (data.settings && typeof data.settings === 'object') {
      const actId = env.CLOUDFLARE_ACCOUNT_ID || CF_ACCOUNT_ID;
      const dbId = env.CLOUDFLARE_DATABASE_ID || CF_DATABASE_ID;
      const token = env.CLOUDFLARE_API_TOKEN || CF_API_TOKEN;

      const merged = { ...DEFAULT_SETTINGS, ...data.settings, updatedAt: new Date().toISOString() };
      const sql = `INSERT OR REPLACE INTO trust_settings (
        id, house_name, location, wifi_ssid, wifi_password, check_in_time, check_out_time,
        auto_cleaning_buffer_hours, cancellation_min_days, max_guests_limit, emergency_address,
        logo_url, cbu, alias_bancario, cuit_fideicomiso, banco_nombre, titular_cuenta,
        wifi_coverage_notes, slogan, updated_at
      ) VALUES ('default_settings', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;

      const params = [
        merged.houseName || 'Estancia El Desayuno',
        merged.location || '',
        merged.wifiSsid || '',
        merged.wifiPassword || '',
        merged.checkInTime || '14:00',
        merged.checkOutTime || '11:00',
        Number(merged.autoCleaningBufferHours || 24),
        Number(merged.cancellationMinDays || 7),
        Number(merged.maxGuestsLimit || 12),
        merged.emergencyAddress || '',
        merged.logoUrl || '',
        merged.cbu || '',
        merged.aliasBancario || '',
        merged.cuitFideicomiso || '',
        merged.bancoNombre || '',
        merged.titularCuenta || '',
        merged.wifiCoverageNotes || '',
        merged.slogan || 'Cuatro Partes, Un Mismo Objetivo',
        merged.updatedAt,
      ];

      if (env.DB) {
        try {
          await env.DB.prepare(sql).bind(...params).run();
        } catch (e) {
          console.warn('env.DB write error in /api/app-state:', e);
        }
      } else if (actId && dbId && token) {
        try {
          await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${actId}/d1/database/${dbId}/query`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ sql, params }),
            }
          );
        } catch (e) {
          console.warn('REST D1 write error in /api/app-state:', e);
        }
      }
    }

    if (env.KV) {
      await env.KV.put('app_state', JSON.stringify(data));
    }

    return new Response(JSON.stringify({ success: true, message: 'Estado guardado' }), { headers: CORS_HEADERS });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: CORS_HEADERS });
  }
};
