const BASE = (import.meta.env.VITE_API_URL || '') + '/api';
export const KEYS = { customer: 'rv_customer', admin: 'rv_admin', staff: 'rv_staff' };
export const getSession = (panel) => { try { return JSON.parse(localStorage.getItem(KEYS[panel])); } catch { return null; } };
export const setSession = (panel, s) => (s ? localStorage.setItem(KEYS[panel], JSON.stringify(s)) : localStorage.removeItem(KEYS[panel]));

async function raw(panel, path, opts = {}) {
  const token = getSession(panel)?.token;
  const isForm = opts.body instanceof FormData;
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { ...(isForm ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers },
    body: opts.body && !isForm && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body,
  });
  if (res.status === 401 && token && !path.startsWith('/auth/')) { setSession(panel, null); window.dispatchEvent(new Event('rv-logout')); }
  return res;
}
export const api = (panel = 'customer') => {
  const call = async (path, opts) => {
    const res = await raw(panel, path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Something went wrong');
    return data;
  };
  return {
    get: (p) => call(p), post: (p, body) => call(p, { method: 'POST', body }), put: (p, body) => call(p, { method: 'PUT', body }),
    patch: (p, body) => call(p, { method: 'PATCH', body }), del: (p) => call(p, { method: 'DELETE' }),
    upload: (files) => { const f = new FormData(); [...files].forEach(x => f.append('images', x)); return call('/upload', { method: 'POST', body: f }); },
    // Authenticated file fetch -> open in a new tab (invoices, CSV)
    openHtml: async (p) => { const r = await raw(panel, p); if (!r.ok) throw new Error('Could not load'); const b = await r.blob(); window.open(URL.createObjectURL(b), '_blank'); },
    download: async (p, name) => { const r = await raw(panel, p); if (!r.ok) throw new Error('Download failed'); const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = name; a.click(); },
  };
};
