// Cloudflare Pages Functions - Native Edge API for /api/settings
// Automatically executed by Cloudflare Pages when deployed

interface Env {
  DB?: any; // Cloudflare D1 Database binding
  KV?: any; // Cloudflare KV binding
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_DATABASE_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
}

const DEFAULT_SETTINGS = {
  houseName: '', slogan: '', location: '', wifiSsid: '', wifiPassword: '', checkInTime: '', checkOutTime: '',
  autoCleaningBufferHours: 0, cancellationMinDays: 0, maxGuestsLimit: 0, emergencyAddress: '',
  cbu: '', aliasBancario: '', cuitFideicomiso: '', bancoNombre: '', titularCuenta: '', wifiCoverageNotes: '',
  logoUrl: '',
};

const CF_ACCOUNT_ID = 'b36aef318f314d0aaaef32a2155d9841';
const CF_DATABASE_ID = 'f0474948-373a-4522-833b-36eb13858100';
const CF_API_TOKEN = '';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Pragma, Cache-Control',
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

async function fetchCurrentSettingsFromD1(env: Env): Promise<Record<string, any>> {
  // 1. Try D1 binding
  if (env.DB) {
    try {
      const row = await env.DB.prepare("SELECT * FROM trust_settings WHERE id = 'default_settings' LIMIT 1").first();
      if (row) return mapRowToSettings(row);
    } catch (e) {
      console.warn('env.DB read error:', e);
    }
  }

  // 2. Try REST API
  const actId = env.CLOUDFLARE_ACCOUNT_ID || CF_ACCOUNT_ID;
  const dbId = env.CLOUDFLARE_DATABASE_ID || CF_DATABASE_ID;
  const token = env.CLOUDFLARE_API_TOKEN || CF_API_TOKEN;

  if (actId && dbId && token) {
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${actId}/d1/database/${dbId}/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sql: "SELECT * FROM trust_settings WHERE id = 'default_settings' LIMIT 1;" }),
        }
      );
      const data: any = await res.json();
      const row = data?.result?.[0]?.results?.[0];
      if (row) return mapRowToSettings(row);
    } catch (e) {
      console.warn('REST D1 read error:', e);
    }
  }

  return { ...DEFAULT_SETTINGS };
}

export const onRequestOptions = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const onRequestGet = async (context: any) => {
  const { env } = context;
  try {
    const settings = await fetchCurrentSettingsFromD1(env);
    return new Response(JSON.stringify({ success: true, settings }), { headers: CORS_HEADERS });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message, settings: DEFAULT_SETTINGS }), {
      headers: CORS_HEADERS,
    });
  }
};

export const onRequestPost = async (context: any) => {
  const { request, env } = context;

  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ success: false, error: 'Datos no válidos' }), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    // 1. Fetch current settings so we NEVER overwrite omitted fields with blanks
    const current = await fetchCurrentSettingsFromD1(env);
    const merged: Record<string, any> = { ...DEFAULT_SETTINGS, ...current };

    // Apply only provided non-undefined values
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined && value !== null) {
        merged[key] = value;
      }
    }
    merged.updatedAt = new Date().toISOString();

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

    let saved = false;

    // Save to env.DB if available
    if (env.DB) {
      try {
        await env.DB.prepare(sql).bind(...params).run();
        saved = true;
      } catch (d1Err) {
        console.warn('env.DB write error:', d1Err);
      }
    }

    // Otherwise or as reliable fallback, write to REST API
    const actId = env.CLOUDFLARE_ACCOUNT_ID || CF_ACCOUNT_ID;
    const dbId = env.CLOUDFLARE_DATABASE_ID || CF_DATABASE_ID;
    const token = env.CLOUDFLARE_API_TOKEN || CF_API_TOKEN;

    if (!saved && actId && dbId && token) {
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
        saved = true;
      } catch (restErr) {
        console.warn('REST D1 write error:', restErr);
      }
    }

    // Also persist in KV if available
    if (env.KV) {
      try {
        await env.KV.put('trust_settings', JSON.stringify(merged));
      } catch (kvErr) {
        console.warn('KV write error:', kvErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        settings: merged,
        message: 'Ajustes guardados y sincronizados en Cloudflare D1.',
      }),
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
};

export const onRequestPut = onRequestPost;
