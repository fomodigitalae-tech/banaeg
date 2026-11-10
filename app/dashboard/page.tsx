'use client';

import { useState, useEffect, useCallback } from 'react';

interface Order {
  id: number;
  customerName: string;
  middleName: string;
  phone: string;
  nationalId: string;
  watchName: string;
  watchColor: string;
  status: string;
  createdAt: string;
}

const statusLabel: Record<string, string> = { new: 'جديد', reviewed: 'قيد المراجعة', completed: 'مكتمل' };
const fmt = new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
const todayStr = () => new Intl.DateTimeFormat('en-CA').format(new Date());

function escapeHtml(v: unknown) {
  return String(v ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[c] ?? c));
}

export default function DashboardPage() {
  const [token, setToken] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [password, setPassword] = useState('');
  const [loginErr, setLoginErr] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('admin_token');
    if (saved) { setToken(saved); setLoggedIn(true); }
  }, []);

  const loadOrders = useCallback(async (t: string) => {
    if (!t) return;
    try {
      const res = await fetch('/api/orders', { headers: { Authorization: `Bearer ${t}` } });
      if (res.status === 401) { logout(); return; }
      if (!res.ok) return;
      const data = await res.json();
      setOrders(data.orders);
      setLastUpdate(fmt.format(new Date()));
      setLoading(false);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (loggedIn && token) {
      loadOrders(token);
      const iv = setInterval(() => loadOrders(token), 5000);
      return () => clearInterval(iv);
    }
  }, [loggedIn, token, loadOrders]);

  async function doLogin() {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success) {
        setToken(data.token);
        localStorage.setItem('admin_token', data.token);
        setLoggedIn(true);
        setLoginErr(false);
      } else {
        setLoginErr(true);
      }
    } catch {
      setLoginErr(true);
    }
  }

  function logout() {
    setToken('');
    setLoggedIn(false);
    localStorage.removeItem('admin_token');
  }

  async function updateStatus(id: number, status: string) {
    await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    loadOrders(token);
  }

  if (!loggedIn) {
    return (
      <div className="login-wrap">
        <div className="login-box">
          <div style={{ fontSize: 48 }}>⌾</div>
          <h1>لوحة الإدارة</h1>
          <p className="sub">أدخل كلمة المرور للوصول إلى لوحة التحكم</p>
          {loginErr && <div className="login-err" style={{ display: 'block' }}>كلمة المرور غير صحيحة</div>}
          <input
            type="password"
            placeholder="كلمة المرور"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doLogin()}
            autoFocus
          />
          <button onClick={doLogin}>دخول</button>
        </div>
      </div>
    );
  }

  const newCount = orders.filter((o) => o.status === 'new').length;
  const todayCount = orders.filter((o) => String(o.createdAt).slice(0, 10) === todayStr()).length;

  return (
    <div className="dash-shell">
      <header className="dash-header">
        <div className="dash-header-inner">
          <a className="dash-brand" href="/">
            <span className="dash-mark">⌾</span>
            <span><strong>لوحة ساعة الأهلي</strong><small>البنك الأهلي المصري</small></span>
          </a>
          <button className="dash-logout" onClick={logout}>تسجيل الخروج</button>
        </div>
      </header>
      <main className="dash-main">
        <div className="dash-title-row">
          <div><span className="dash-eyebrow">إدارة الطلبات</span><h1>طلبات الساعات الذكية</h1></div>
          <p>{lastUpdate ? `آخر تحديث: ${lastUpdate}` : '—'}</p>
        </div>
        <div className="dash-stats">
          <div className="dash-stat"><span>إجمالي الطلبات</span><strong>{orders.length}</strong></div>
          <div className="dash-stat"><span>طلبات جديدة</span><strong>{newCount}</strong></div>
          <div className="dash-stat"><span>طلبات اليوم</span><strong>{todayCount}</strong></div>
        </div>
        <section className="dash-table-wrap">
          {loading ? (
            <div className="dash-loading">جارٍ تحميل الطلبات...</div>
          ) : orders.length === 0 ? (
            <div className="dash-empty">لا توجد طلبات حتى الآن.</div>
          ) : (
            <table className="dash-table">
              <thead>
                <tr><th>العميل</th><th>الهاتف</th><th>الرقم القومي</th><th>الساعة واللون</th><th>وقت الطلب</th><th>الحالة</th></tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="dash-customer">{o.customerName}<small>{o.middleName}</small></td>
                    <td dir="ltr">{o.phone}</td>
                    <td dir="ltr">{o.nationalId}</td>
                    <td>
                      <span className="dash-watch">
                        <i className="dash-dot" style={o.watchColor === 'روز' ? { background: '#c59b91' } : o.watchColor === 'أسود' ? { background: '#222' } : o.watchColor === 'أبيض' ? { background: '#d5dcd7', border: '1px solid #bac4bd' } : undefined} />
                        {o.watchName} — {o.watchColor}
                      </span>
                    </td>
                    <td>{fmt.format(new Date(o.createdAt))}</td>
                    <td>
                      <select className="dash-status" value={o.status} onChange={(e) => updateStatus(o.id, e.target.value)}>
                        {Object.entries(statusLabel).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}
