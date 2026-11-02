'use strict';
/* =====================================================================
   حساب شخصی — برنامه حسابداری شخصی ابری
   Front-end: HTML/JS خالص  |  Back-end: Supabase (Auth + Postgres + RLS)
   ===================================================================== */
(() => {

// ---------------------------------------------------------------- helpers
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FA = '۰۱۲۳۴۵۶۷۸۹', AR = '٠١٢٣٤٥٦٧٨٩';
const toEn = (s) => String(s ?? '').replace(/[۰-۹]/g, (d) => FA.indexOf(d)).replace(/[٠-٩]/g, (d) => AR.indexOf(d));
const faNum = (s) => String(s).replace(/\d/g, (d) => FA[d]);
const pad = (n) => String(n).padStart(2, '0');
const nf = new Intl.NumberFormat('fa-IR');
const fmt = (n) => nf.format(Math.round(Number(n) || 0));
const parseAmount = (v) => Number(toEn(v).replace(/[^\d]/g, '')) || 0;
const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));

// ---------------------------------------------------------------- Jalali calendar
function g2j(gy, gm, gd) {
  const gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 355666 + 365 * gy + ~~((gy2 + 3) / 4) - ~~((gy2 + 99) / 100) + ~~((gy2 + 399) / 400) + gd + gdm[gm - 1];
  let jy = -1595 + 33 * ~~(days / 12053); days %= 12053;
  jy += 4 * ~~(days / 1461); days %= 1461;
  if (days > 365) { jy += ~~((days - 1) / 365); days = (days - 1) % 365; }
  const jm = days < 186 ? 1 + ~~(days / 31) : 7 + ~~((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return [jy, jm, jd];
}
function j2g(jy, jm, jd) {
  jy += 1595;
  let days = -355668 + 365 * jy + ~~(jy / 33) * 8 + ~~(((jy % 33) + 3) / 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * ~~(days / 146097); days %= 146097;
  if (days > 36524) { gy += 100 * ~~(--days / 36524); days %= 36524; if (days >= 365) days++; }
  gy += 4 * ~~(days / 1461); days %= 1461;
  if (days > 365) { gy += ~~((days - 1) / 365); days = (days - 1) % 365; }
  let gd = days + 1;
  const ml = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (gm = 0; gm < 13 && gd > ml[gm]; gm++) gd -= ml[gm];
  return [gy, gm, gd];
}
const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
const isoParts = (iso) => iso.split('-').map(Number);
const isoToJ = (iso) => g2j(...isoParts(iso));
const jToIso = (jy, jm, jd) => { const [y, m, d] = j2g(jy, jm, jd); return `${y}-${pad(m)}-${pad(d)}`; };
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const addDaysIso = (iso, n) => { const [y, m, d] = isoParts(iso); const t = new Date(Date.UTC(y, m - 1, d + n)); return t.toISOString().slice(0, 10); };
const daysBetween = (a, b) => (Date.UTC(...isoParts(b).map((v, i) => (i === 1 ? v - 1 : v))) - Date.UTC(...isoParts(a).map((v, i) => (i === 1 ? v - 1 : v)))) / 864e5;
const monthLen = (jy, jm) => (jm <= 6 ? 31 : jm <= 11 ? 30 : daysBetween(jToIso(jy, 12, 1), jToIso(jy + 1, 1, 1)));
const addMonth = (jy, jm, k) => { const t = jy * 12 + (jm - 1) + k; return [Math.floor(t / 12), (t % 12) + 1]; };
const monthRange = (jy, jm) => [jToIso(jy, jm, 1), jToIso(jy, jm, monthLen(jy, jm))];
const fmtJ = (iso) => { if (!iso) return ''; const [y, m, d] = isoToJ(iso); return faNum(`${y}/${pad(m)}/${pad(d)}`); };
const fmtJin = (iso) => { const [y, m, d] = isoToJ(iso); return `${y}/${pad(m)}/${pad(d)}`; };
const monthTitle = ([jy, jm]) => `${MONTHS[jm - 1]} ${faNum(jy)}`;
const weekday = (iso) => { const [y, m, d] = isoParts(iso); return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]; };
function parseJ(str) {
  const p = toEn(str).trim().split(/[\/\-.\s]+/).map(Number);
  if (p.length !== 3 || p.some(isNaN)) return null;
  let [y, m, d] = p;
  if (y < 100) y += 1400;
  if (m < 1 || m > 12 || d < 1 || d > monthLen(y, m)) return null;
  return jToIso(y, m, d);
}

// ---------------------------------------------------------------- settings (per device)
const store = {
  get(k, def) { try { const v = localStorage.getItem('hs_' + k); return v === null ? def : JSON.parse(v); } catch { return def; } },
  set(k, v) { try { localStorage.setItem('hs_' + k, JSON.stringify(v)); } catch {} },
};
const prefs = { unit: store.get('unit', 'تومان'), lockMin: store.get('lockMin', 15) };
const money = (n, cls = '') => `<span class="num-txt ${cls}">${fmt(n)} <small class="muted">${esc(prefs.unit)}</small></span>`;

// ---------------------------------------------------------------- backends
function supabaseBackend(client) {
  const apply = (q, o) => {
    for (const [k, v] of Object.entries(o.eq || {})) q = q.eq(k, v);
    for (const [k, v] of Object.entries(o.gte || {})) q = q.gte(k, v);
    for (const [k, v] of Object.entries(o.lte || {})) q = q.lte(k, v);
    if (o.order) q = q.order(o.order, { ascending: o.asc !== false }).order('id', { ascending: o.asc !== false });
    return q;
  };
  const chk = ({ data, error }) => { if (error) throw error; return data; };
  return {
    async list(table, o = {}) {
      const size = 1000; let from = 0, all = [];
      for (;;) {
        const data = chk(await apply(client.from(table).select(o.select || '*'), o).range(from, from + size - 1));
        all = all.concat(data);
        if (data.length < size) return all;
        from += size;
      }
    },
    async insert(table, row) { return chk(await client.from(table).insert(row).select().single()); },
    async insertMany(table, rows) { return chk(await client.from(table).insert(rows).select()); },
    async update(table, id, patch) { return chk(await client.from(table).update(patch).eq('id', id).select().single()); },
    async remove(table, id) { chk(await client.from(table).delete().eq('id', id)); },
    async balances() { return this.list('account_balances', { order: 'id' }); },
  };
}

function demoBackend() {
  const KEY = 'hs_demo_db';
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch {}
  db = db || { seq: 1, t: { accounts: [], categories: [], transactions: [], debts: [], installments: [] } };
  const save = () => localStorage.setItem(KEY, JSON.stringify(db));
  const fk = () => { const e = new Error('fk'); e.code = '23503'; return e; };
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const defaults = {
    accounts: { kind: 'bank', opening_balance: 0, archived: false },
    categories: { color: '#64748b' },
    transactions: { to_account_id: null, category_id: null, installment_id: null, note: null },
    debts: { settled: false, note: null },
    installments: { paid: false, paid_date: null },
  };
  return {
    async list(table, o = {}) {
      let r = db.t[table].filter((x) =>
        Object.entries(o.eq || {}).every(([k, v]) => x[k] === v) &&
        Object.entries(o.gte || {}).every(([k, v]) => x[k] >= v) &&
        Object.entries(o.lte || {}).every(([k, v]) => x[k] <= v));
      if (o.order) { const d = o.asc === false ? -1 : 1; r.sort((a, b) => (a[o.order] < b[o.order] ? -d : a[o.order] > b[o.order] ? d : (a.id - b.id) * d)); }
      return clone(r);
    },
    async insert(table, row) { const r = { ...defaults[table], ...row, id: db.seq++, created_at: new Date().toISOString() }; db.t[table].push(r); save(); return clone(r); },
    async insertMany(table, rows) { const out = []; for (const r of rows) out.push(await this.insert(table, r)); return out; },
    async update(table, id, patch) { const r = db.t[table].find((x) => x.id === id); Object.assign(r, patch); save(); return clone(r); },
    async remove(table, id) {
      const T = db.t;
      if (table === 'accounts' && T.transactions.some((x) => x.account_id === id || x.to_account_id === id)) throw fk();
      if (table === 'categories') T.transactions.forEach((x) => { if (x.category_id === id) x.category_id = null; });
      if (table === 'debts') {
        const ids = T.installments.filter((i) => i.debt_id === id).map((i) => i.id);
        T.transactions.forEach((x) => { if (ids.includes(x.installment_id)) x.installment_id = null; });
        T.installments = T.installments.filter((i) => i.debt_id !== id);
      }
      if (table === 'installments') T.transactions.forEach((x) => { if (x.installment_id === id) x.installment_id = null; });
      T[table] = T[table].filter((x) => x.id !== id); save();
    },
    async balances() {
      return db.t.accounts.map((a) => {
        let b = a.opening_balance;
        for (const t of db.t.transactions) {
          if (t.account_id === a.id) b += t.kind === 'income' ? t.amount : -t.amount;
          if (t.kind === 'transfer' && t.to_account_id === a.id) b += t.amount;
        }
        return { ...clone(a), balance: b };
      });
    },
  };
}

// ---------------------------------------------------------------- state
const S = { db: null, client: null, demo: false, tab: 'dash', month: null, accounts: [], categories: [], filters: { kind: '', account: '', category: '', q: '' } };
{ const [y, m] = isoToJ(todayIso()); S.month = [y, m]; }

// ---------------------------------------------------------------- UI helpers
let toastTimer;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2800); }
function errMsg(e) {
  const m = String(e?.message || e || '');
  if (e?.code === '23503') return 'این مورد در تراکنش‌ها استفاده شده و قابل حذف نیست (می‌توانید بایگانی‌اش کنید).';
  if (/fetch|network|Load failed/i.test(m)) return 'اتصال به سرور برقرار نشد. اینترنت را بررسی کنید.';
  if (/JWT|token/i.test(m)) { logout('نشست شما منقضی شد؛ دوباره وارد شوید.'); return 'نشست منقضی شد.'; }
  return 'خطا: ' + m;
}
const dlg = () => $('#modal');
let modalSubmit = null;
function openModal(html, onSubmit) {
  const form = $('#modalForm');
  form.innerHTML = html;
  modalSubmit = onSubmit;
  dlg().showModal();
  const first = form.querySelector('input:not([type=hidden]):not([type=checkbox]),select');
  if (first && !matchMedia('(pointer:coarse)').matches) first.focus();
}
function confirmBox(text, okLabel = 'بله، حذف شود') {
  return new Promise((resolve) => {
    openModal(`<h3>تأیید</h3><p>${esc(text)}</p><div class="actions"><button value="cancel" formnovalidate class="btn">انصراف</button><button class="btn primary">${esc(okLabel)}</button></div>`, () => { resolve(true); });
    dlg().addEventListener('close', () => resolve(false), { once: true });
  });
}
const cancelBtn = '<button value="cancel" formnovalidate class="btn">انصراف</button>';
const dateField = (name, iso, label = 'تاریخ') => `
  <label>${label}<div class="date-in">
    <button type="button" class="btn sm" data-dshift="-1" title="روز قبل">−</button>
    <input name="${name}" value="${fmtJin(iso)}" required placeholder="۱۴۰۵/۰۱/۰۱" inputmode="numeric">
    <button type="button" class="btn sm" data-dshift="1" title="روز بعد">+</button>
    <button type="button" class="btn sm" data-dtoday>امروز</button>
  </div></label>`;
const amountField = (name, v, label = 'مبلغ') => `<label>${label} (${esc(prefs.unit)})<input class="num" name="${name}" inputmode="numeric" required autocomplete="off" value="${v ? Number(v).toLocaleString('en-US') : ''}"></label>`;
const accountOptions = (sel, includeArchived = false) => S.accounts.filter((a) => includeArchived || !a.archived || a.id === sel).map((a) => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${esc(a.name)}</option>`).join('');
const catOptions = (kind, sel) => '<option value="">— بدون دسته —</option>' + S.categories.filter((c) => c.kind === kind).map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
const monthNav = () => `<div class="month-nav"><button class="icon-btn" data-act="mprev" title="ماه قبل">→</button><span>${monthTitle(S.month)}</span><button class="icon-btn" data-act="mnext" title="ماه بعد">←</button></div>`;

// modal-wide interactions
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-dshift],[data-dtoday]');
  if (!b) return;
  const inp = b.parentElement.querySelector('input');
  const iso = parseJ(inp.value) || todayIso();
  inp.value = fmtJin(b.dataset.dtoday !== undefined ? todayIso() : addDaysIso(iso, Number(b.dataset.dshift)));
});
document.addEventListener('input', (e) => {
  if (!e.target.classList.contains('num')) return;
  const n = parseAmount(e.target.value);
  e.target.value = n ? n.toLocaleString('en-US') : '';
});

// ---------------------------------------------------------------- auth
const authStorage = {
  remember: () => store.get('remember', false),
  getItem(k) { return localStorage.getItem(k) ?? sessionStorage.getItem(k); },
  setItem(k, v) { (this.remember() ? localStorage : sessionStorage).setItem(k, v); },
  removeItem(k) { localStorage.removeItem(k); sessionStorage.removeItem(k); },
};

function showLogin(msg = '') {
  $('#app').classList.add('hidden');
  $('#view').innerHTML = '';
  $('#login').classList.remove('hidden');
  $('#loginMsg').textContent = msg;
  $('#remember').checked = store.get('remember', false);
}

let fails = 0, lockUntil = 0;
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!S.client) return;
  if (Date.now() < lockUntil) { $('#loginMsg').textContent = `تلاش زیاد؛ ${faNum(Math.ceil((lockUntil - Date.now()) / 1000))} ثانیه صبر کنید.`; return; }
  const btn = $('#loginBtn'); btn.disabled = true; $('#loginMsg').textContent = '';
  store.set('remember', $('#remember').checked);
  const { error } = await S.client.auth.signInWithPassword({ email: $('#email').value.trim(), password: $('#password').value });
  btn.disabled = false;
  if (error) {
    fails++;
    if (fails >= 5) { lockUntil = Date.now() + 60000; fails = 0; }
    $('#loginMsg').textContent = /fetch|network/i.test(error.message) ? 'اتصال به سرور برقرار نشد.' : 'ایمیل یا رمز عبور اشتباه است.';
    return;
  }
  $('#password').value = '';
  fails = 0;
  startApp();
});
$('#demoBtn').addEventListener('click', () => { sessionStorage.setItem('hs_demo_on', '1'); S.demo = true; startApp(); });

async function logout(msg = '') {
  stopIdle();
  if (S.demo) { sessionStorage.removeItem('hs_demo_on'); S.demo = false; }
  else if (S.client) { try { await S.client.auth.signOut(); } catch {} }
  showLogin(msg);
}

// auto-lock on inactivity
let lastActive = Date.now(), idleTimer = null;
const touch = () => { lastActive = Date.now(); };
function checkIdle() { if (prefs.lockMin > 0 && Date.now() - lastActive > prefs.lockMin * 60000) logout('به دلیل عدم فعالیت، برای امنیت خارج شدید.'); }
function startIdle() {
  lastActive = Date.now();
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((ev) => window.addEventListener(ev, touch, { passive: true }));
  document.addEventListener('visibilitychange', checkIdle);
  idleTimer = setInterval(checkIdle, 15000);
}
function stopIdle() { clearInterval(idleTimer); document.removeEventListener('visibilitychange', checkIdle); }

// ---------------------------------------------------------------- data
async function loadRefs() {
  const [accs, cats] = await Promise.all([S.db.list('accounts', { order: 'id' }), S.db.list('categories', { order: 'name' })]);
  S.accounts = accs; S.categories = cats;
}
const DEFAULT_CATS = {
  expense: [['خوراک و خرید روزانه', '#ef4444'], ['رستوران و بیرون', '#f97316'], ['حمل‌ونقل و بنزین', '#eab308'], ['قبوض و شارژ', '#8b5cf6'], ['اجاره و مسکن', '#6366f1'], ['درمان', '#ec4899'], ['پوشاک', '#14b8a6'], ['تفریح و سفر', '#06b6d4'], ['آموزش', '#3b82f6'], ['اقساط و بدهی', '#64748b'], ['سایر هزینه‌ها', '#94a3b8']],
  income: [['حقوق', '#16a34a'], ['اضافه‌کار و پاداش', '#22c55e'], ['کار آزاد', '#84cc16'], ['سود و بازدهی', '#10b981'], ['وصول طلب', '#0d9488'], ['سایر درآمدها', '#65a30d']],
};
async function seedIfEmpty() {
  if (S.accounts.length || S.categories.length) return;
  await S.db.insertMany('accounts', [{ name: 'نقد', kind: 'cash', opening_balance: 0 }, { name: 'کارت بانکی', kind: 'card', opening_balance: 0 }]);
  const rows = [];
  for (const kind of ['expense', 'income']) for (const [name, color] of DEFAULT_CATS[kind]) rows.push({ name, kind, color });
  await S.db.insertMany('categories', rows);
  await loadRefs();
}
async function getOrCreateCat(name, kind) {
  let c = S.categories.find((x) => x.name === name && x.kind === kind);
  if (!c) { c = await S.db.insert('categories', { name, kind, color: kind === 'income' ? '#0d9488' : '#64748b' }); S.categories.push(c); }
  return c.id;
}

// ---------------------------------------------------------------- app shell
async function startApp() {
  S.db = S.demo ? demoBackend() : supabaseBackend(S.client);
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#demoTag').classList.toggle('hidden', !S.demo);
  $('#view').innerHTML = '<p class="empty">در حال بارگذاری…</p>';
  try { await loadRefs(); await seedIfEmpty(); } catch (e) { toast(errMsg(e)); }
  startIdle();
  render();
}

$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]'); if (!b) return;
  S.tab = b.dataset.tab;
  $$('#tabs button').forEach((x) => x.classList.toggle('active', x === b));
  window.scrollTo(0, 0);
  render();
});
$('#fab').addEventListener('click', () => txModal());

async function render() {
  const v = $('#view');
  try {
    if (S.tab === 'dash') v.innerHTML = await renderDash();
    else if (S.tab === 'tx') v.innerHTML = await renderTx();
    else if (S.tab === 'debts') v.innerHTML = await renderDebts();
    else v.innerHTML = await renderSettings();
  } catch (e) { v.innerHTML = `<p class="empty">${esc(errMsg(e))}</p>`; }
}

// ---------------------------------------------------------------- dashboard
async function renderDash() {
  const [from12] = monthRange(...addMonth(...S.month, -11));
  const [mFrom, mTo] = monthRange(...S.month);
  const in30 = addDaysIso(todayIso(), 30);
  const [txs, bals, insts, debts] = await Promise.all([
    S.db.list('transactions', { gte: { tx_date: from12 }, lte: { tx_date: mTo }, select: 'id,kind,amount,tx_date,category_id' }),
    S.db.balances(),
    S.db.list('installments', { eq: { paid: false }, lte: { due_date: in30 }, order: 'due_date' }),
    S.db.list('debts'),
  ]);
  const month = txs.filter((t) => t.tx_date >= mFrom);
  const inc = sum(month.filter((t) => t.kind === 'income'), (t) => t.amount);
  const exp = sum(month.filter((t) => t.kind === 'expense'), (t) => t.amount);
  const net = inc - exp;

  // balances
  const active = bals.filter((a) => !a.archived);
  const balHtml = active.map((a) => `<div class="acc"><span>${esc(a.name)}</span>${money(a.balance, a.balance < 0 ? 'exp' : '')}</div>`).join('')
    + `<div class="acc"><b>جمع موجودی</b><b>${money(sum(active, (a) => a.balance))}</b></div>`;

  // expense by category
  const cats = byId(S.categories);
  const byCat = {};
  month.filter((t) => t.kind === 'expense').forEach((t) => { byCat[t.category_id ?? 0] = (byCat[t.category_id ?? 0] || 0) + Number(t.amount); });
  const catRows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const maxCat = catRows[0]?.[1] || 1;
  const catHtml = catRows.length ? catRows.map(([cid, v]) => {
    const c = cats[cid] || { name: 'بدون دسته', color: '#94a3b8' };
    return `<div class="hbar"><span title="${esc(c.name)}">${esc(c.name)}</span><div class="track"><div class="fill" style="width:${(v / maxCat) * 100}%;background:${esc(c.color)}"></div></div><span class="num-txt">${fmt(v)} <small class="muted">(${faNum(Math.round((v / exp) * 100))}٪)</small></span></div>`;
  }).join('') : '<p class="empty">هزینه‌ای در این ماه ثبت نشده.</p>';

  // 12 months chart
  const months = Array.from({ length: 12 }, (_, i) => addMonth(...S.month, i - 11));
  const series = months.map(([y, m]) => {
    const [a, b] = monthRange(y, m);
    const ts = txs.filter((t) => t.tx_date >= a && t.tx_date <= b);
    return { y, m, i: sum(ts.filter((t) => t.kind === 'income'), (t) => t.amount), e: sum(ts.filter((t) => t.kind === 'expense'), (t) => t.amount) };
  });
  const maxV = Math.max(1, ...series.map((s) => Math.max(s.i, s.e)));
  const chart = `<div class="vchart">${series.map((s) => `<div class="col" title="${MONTHS[s.m - 1]} ${faNum(s.y)} — درآمد: ${fmt(s.i)} / هزینه: ${fmt(s.e)}"><div class="pair"><div class="b i" style="height:${(s.i / maxV) * 100}%"></div><div class="b e" style="height:${(s.e / maxV) * 100}%"></div></div></div>`).join('')}</div>
    <div class="vlabels">${series.map((s) => `<span>${MONTHS[s.m - 1].slice(0, 3)}</span>`).join('')}</div>
    <div class="legend"><span><i class="dot" style="background:var(--income)"></i>درآمد</span><span><i class="dot" style="background:var(--expense)"></i>هزینه</span></div>`;

  // upcoming installments
  const dmap = byId(debts);
  const today = todayIso();
  const upHtml = insts.length ? insts.map((i) => {
    const d = dmap[i.debt_id]; if (!d) return '';
    const od = i.due_date < today;
    return `<div class="inst ${od ? 'overdue' : ''}"><span class="pill ${d.direction === 'borrow' ? 'red' : 'green'}">${d.direction === 'borrow' ? 'پرداخت' : 'دریافت'}</span><span>${esc(d.person)} <span class="d small">${fmtJ(i.due_date)}${od ? ' (گذشته)' : ''}</span></span>${money(i.amount)}<button class="btn sm" data-act="payinst" data-id="${i.id}">ثبت</button></div>`;
  }).join('') : '<p class="muted small">قسط سررسید‌شده یا نزدیکی ندارید.</p>';

  return `
  <div class="row between" style="margin-bottom:14px"><h2>خلاصه ماه</h2>${monthNav()}</div>
  <div class="grid g3" style="margin-bottom:14px">
    <div class="card stat"><div class="label">درآمد</div><div class="value inc">${fmt(inc)}</div></div>
    <div class="card stat"><div class="label">هزینه</div><div class="value exp">${fmt(exp)}</div></div>
    <div class="card stat"><div class="label">مانده (پس‌انداز)</div><div class="value ${net < 0 ? 'exp' : 'inc'}">${fmt(net)}</div></div>
  </div>
  <div class="grid g2">
    <div class="card"><h3>موجودی حساب‌ها</h3><div class="acc-list">${balHtml}</div></div>
    <div class="card"><h3>اقساط ۳۰ روز آینده و معوق</h3>${upHtml}</div>
    <div class="card"><h3>هزینه‌ها بر اساس دسته — ${monthTitle(S.month)}</h3>${catHtml}</div>
    <div class="card"><h3>درآمد و هزینه ۱۲ ماه اخیر</h3>${chart}</div>
  </div>`;
}

// ---------------------------------------------------------------- transactions
let txCache = [];
async function renderTx() {
  const [from, to] = monthRange(...S.month);
  txCache = await S.db.list('transactions', { gte: { tx_date: from }, lte: { tx_date: to }, order: 'tx_date', asc: false });
  const f = S.filters;
  const accs = byId(S.accounts), cats = byId(S.categories);
  const q = f.q.trim();
  const list = txCache.filter((t) =>
    (!f.kind || t.kind === f.kind) &&
    (!f.account || t.account_id === +f.account || t.to_account_id === +f.account) &&
    (!f.category || t.category_id === +f.category) &&
    (!q || (t.note || '').includes(q) || (cats[t.category_id]?.name || '').includes(q)));
  const inc = sum(list.filter((t) => t.kind === 'income'), (t) => t.amount);
  const exp = sum(list.filter((t) => t.kind === 'expense'), (t) => t.amount);

  let html = '', lastDay = '';
  for (const t of list) {
    if (t.tx_date !== lastDay) { lastDay = t.tx_date; html += `<div class="tx-day">${weekday(t.tx_date)} ${fmtJ(t.tx_date)}</div>`; }
    const c = cats[t.category_id];
    const color = t.kind === 'transfer' ? 'var(--transfer)' : c?.color || '#94a3b8';
    const title = t.kind === 'transfer' ? `انتقال: ${esc(accs[t.account_id]?.name)} ← ${esc(accs[t.to_account_id]?.name)}` : esc(c?.name || (t.kind === 'income' ? 'درآمد' : 'هزینه'));
    const sub = [t.kind !== 'transfer' ? esc(accs[t.account_id]?.name) : '', esc(t.note || '')].filter(Boolean).join(' · ');
    const cls = t.kind === 'income' ? 'inc' : t.kind === 'expense' ? 'exp' : 'trf';
    const sign = t.kind === 'income' ? '+' : t.kind === 'expense' ? '−' : '';
    html += `<div class="tx"><div class="ic" style="background:${esc(color)}">${t.kind === 'transfer' ? '⇄' : esc((c?.name || '•').slice(0, 1))}</div>
      <div><div class="title">${title}</div><div class="sub">${sub}</div></div>
      <div class="num-txt ${cls}">${sign}${fmt(t.amount)}</div>
      <div><button class="icon-btn" data-act="edittx" data-id="${t.id}" title="ویرایش">✎</button><button class="icon-btn" data-act="deltx" data-id="${t.id}" title="حذف">🗑</button></div></div>`;
  }
  const catOpts = '<option value="">همه دسته‌ها</option>' + S.categories.map((c) => `<option value="${c.id}" ${+f.category === c.id ? 'selected' : ''}>${esc(c.name)} (${c.kind === 'income' ? 'درآمد' : 'هزینه'})</option>`).join('');
  return `
  <div class="row between" style="margin-bottom:14px"><h2>تراکنش‌ها</h2>${monthNav()}</div>
  <div class="filters">
    <select data-filter="kind"><option value="">همه انواع</option><option value="expense" ${f.kind === 'expense' ? 'selected' : ''}>هزینه</option><option value="income" ${f.kind === 'income' ? 'selected' : ''}>درآمد</option><option value="transfer" ${f.kind === 'transfer' ? 'selected' : ''}>انتقال</option></select>
    <select data-filter="account"><option value="">همه حساب‌ها</option>${S.accounts.map((a) => `<option value="${a.id}" ${+f.account === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>
    <select data-filter="category">${catOpts}</select>
    <input data-filter="q" placeholder="جستجو در توضیحات…" value="${esc(f.q)}">
  </div>
  <div class="card row between small" style="margin-bottom:6px"><span>${faNum(list.length)} تراکنش</span><span>درآمد: <b class="inc">${fmt(inc)}</b></span><span>هزینه: <b class="exp">${fmt(exp)}</b></span></div>
  ${html || '<p class="empty">تراکنشی برای این ماه پیدا نشد. با دکمه + ثبت کنید.</p>'}`;
}

function txModal(t = null) {
  if (!S.accounts.filter((a) => !a.archived).length) { toast('ابتدا در تنظیمات یک حساب بسازید.'); return; }
  let kind = t?.kind || 'expense';
  const defAcc = t?.account_id || store.get('lastAcc', null) || S.accounts.find((a) => !a.archived)?.id;
  const html = () => `
    <h3>${t ? 'ویرایش تراکنش' : 'ثبت تراکنش'}</h3>
    <div class="seg"><button type="button" data-kind="expense" class="${kind === 'expense' ? 'on' : ''}">هزینه</button><button type="button" data-kind="income" class="${kind === 'income' ? 'on' : ''}">درآمد</button><button type="button" data-kind="transfer" class="${kind === 'transfer' ? 'on' : ''}">انتقال</button></div>
    ${amountField('amount', t?.amount)}
    <div class="two-col">
      <label>${kind === 'transfer' ? 'از حساب' : 'حساب'}<select name="account_id" required>${accountOptions(defAcc)}</select></label>
      ${kind === 'transfer'
        ? `<label>به حساب<select name="to_account_id" required>${accountOptions(t?.to_account_id || S.accounts.find((a) => !a.archived && a.id !== defAcc)?.id)}</select></label>`
        : `<label>دسته<select name="category_id">${catOptions(kind, t?.category_id)}</select></label>`}
    </div>
    ${dateField('tx_date', t?.tx_date || todayIso())}
    <label>توضیحات<input name="note" maxlength="300" value="${esc(t?.note || '')}" placeholder="اختیاری"></label>
    <div class="actions">${cancelBtn}<button class="btn primary">ذخیره</button></div>`;
  openModal(html(), async (fd) => {
    const amount = parseAmount(fd.get('amount'));
    const date = parseJ(fd.get('tx_date'));
    if (!amount) { toast('مبلغ را وارد کنید.'); return false; }
    if (!date) { toast('تاریخ نامعتبر است (مثال: ۱۴۰۵/۰۸/۱۱).'); return false; }
    const row = { kind, amount, account_id: +fd.get('account_id'), tx_date: date, note: fd.get('note').trim() || null, to_account_id: null, category_id: null };
    if (kind === 'transfer') { row.to_account_id = +fd.get('to_account_id'); if (row.to_account_id === row.account_id) { toast('حساب مبدأ و مقصد یکی است.'); return false; } }
    else row.category_id = fd.get('category_id') ? +fd.get('category_id') : null;
    if (t) await S.db.update('transactions', t.id, row); else await S.db.insert('transactions', row);
    store.set('lastAcc', row.account_id);
    toast('ذخیره شد ✓');
    render();
  });
  // kind switch keeps typed values
  $('#modalForm').onclick = (e) => {
    const b = e.target.closest('[data-kind]'); if (!b) return;
    const f = $('#modalForm'); const keep = { amount: f.amount.value, tx_date: f.tx_date.value, note: f.note.value };
    kind = b.dataset.kind; f.innerHTML = html();
    Object.entries(keep).forEach(([k, v]) => { f[k].value = v; });
  };
}

// ---------------------------------------------------------------- debts & installments
async function renderDebts() {
  const [debts, insts] = await Promise.all([S.db.list('debts', { order: 'start_date', asc: false }), S.db.list('installments', { order: 'due_date' })]);
  const today = todayIso();
  const byDebt = {};
  insts.forEach((i) => (byDebt[i.debt_id] = byDebt[i.debt_id] || []).push(i));
  const remain = (d) => d.settled ? 0 : Math.max(0, d.total_amount - sum((byDebt[d.id] || []).filter((i) => i.paid), (i) => i.amount));
  const owe = sum(debts.filter((d) => d.direction === 'borrow'), remain);
  const owed = sum(debts.filter((d) => d.direction === 'lend'), remain);

  const card = (d) => {
    const is = byDebt[d.id] || [];
    const paid = sum(is.filter((i) => i.paid), (i) => i.amount);
    const pct = Math.min(100, d.settled ? 100 : (paid / d.total_amount) * 100);
    const rows = is.map((i) => `<div class="inst ${i.paid ? 'paid' : i.due_date < today ? 'overdue' : ''}">
        <span class="pill ${i.paid ? 'green' : ''}">${i.paid ? 'پرداخت‌شده' : 'باز'}</span>
        <span class="d">${fmtJ(i.due_date)}${i.paid && i.paid_date ? ` <small class="muted">(پرداخت ${fmtJ(i.paid_date)})</small>` : ''}</span>
        ${money(i.amount)}
        <span>${i.paid ? `<button class="icon-btn" data-act="unpayinst" data-id="${i.id}" title="لغو پرداخت">↺</button>` : `<button class="btn sm" data-act="payinst" data-id="${i.id}">${d.direction === 'borrow' ? 'پرداخت' : 'دریافت'}</button>`}<button class="icon-btn" data-act="delinst" data-id="${i.id}" title="حذف قسط">🗑</button></span>
      </div>`).join('');
    return `<div class="card debt">
      <div class="row between"><div><b>${esc(d.person)}</b> <span class="pill ${d.direction === 'borrow' ? 'red' : 'green'}">${d.direction === 'borrow' ? 'بدهی من' : 'طلب من'}</span> ${d.settled ? '<span class="pill green">تسویه‌شده</span>' : ''}</div>
        <div><button class="icon-btn" data-act="adddinst" data-id="${d.id}" title="افزودن قسط">＋</button><button class="icon-btn" data-act="editdebt" data-id="${d.id}" title="ویرایش">✎</button><button class="icon-btn" data-act="deldebt" data-id="${d.id}" title="حذف">🗑</button></div></div>
      <div class="row small muted">از ${fmtJ(d.start_date)} · کل: ${money(d.total_amount)} · پرداخت‌شده: ${money(paid)} · مانده: <b>${money(remain(d))}</b></div>
      ${d.note ? `<div class="small muted">${esc(d.note)}</div>` : ''}
      <div class="progress"><div style="width:${pct}%"></div></div>
      ${is.length ? `<details ${d.settled ? '' : 'open'}><summary class="small muted">${faNum(is.length)} قسط</summary>${rows}</details>` : '<p class="small muted">قسطی تعریف نشده؛ با ＋ اضافه کنید.</p>'}
    </div>`;
  };
  const open = debts.filter((d) => !d.settled), closed = debts.filter((d) => d.settled);
  return `
  <div class="row between" style="margin-bottom:14px"><h2>بدهی، طلب و اقساط</h2><button class="btn primary" data-act="newdebt">+ مورد جدید</button></div>
  <div class="grid g2" style="margin-bottom:14px">
    <div class="card stat"><div class="label">مانده بدهی‌های من</div><div class="value exp">${fmt(owe)}</div></div>
    <div class="card stat"><div class="label">مانده طلب‌های من</div><div class="value inc">${fmt(owed)}</div></div>
  </div>
  ${open.map(card).join('') || '<p class="empty">بدهی یا طلب بازی ندارید.</p>'}
  ${closed.length ? `<details><summary class="muted" style="margin:10px 0">تسویه‌شده‌ها (${faNum(closed.length)})</summary>${closed.map(card).join('')}</details>` : ''}`;
}

function debtModal(d = null) {
  let dir = d?.direction || 'borrow';
  const html = () => `
    <h3>${d ? 'ویرایش' : 'بدهی / طلب جدید'}</h3>
    ${d ? '' : `<div class="seg two"><button type="button" data-dir="borrow" class="${dir === 'borrow' ? 'on' : ''}">بدهی من (وام، قرض)</button><button type="button" data-dir="lend" class="${dir === 'lend' ? 'on' : ''}">طلب من</button></div>`}
    <label>${dir === 'borrow' ? 'طلبکار (شخص / بانک)' : 'بدهکار (شخص)'}<input name="person" required maxlength="80" value="${esc(d?.person || '')}"></label>
    ${amountField('total', d?.total_amount, 'مبلغ کل')}
    ${dateField('start', d?.start_date || todayIso(), 'تاریخ شروع')}
    <label>توضیحات<input name="note" maxlength="200" value="${esc(d?.note || '')}"></label>
    ${d ? `<label class="check"><input type="checkbox" name="settled" ${d.settled ? 'checked' : ''}> تسویه شده</label>` : `
    <fieldset style="border:1px solid var(--line);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:10px">
      <legend class="small muted">ساخت خودکار اقساط (اختیاری)</legend>
      <div class="two-col"><label>تعداد اقساط<input class="num" name="count" inputmode="numeric" placeholder="مثلاً ۱۲"></label>
      <label>فاصله (ماه)<input class="num" name="every" inputmode="numeric" value="1"></label></div>
      ${dateField('first', todayIso(), 'سررسید اولین قسط')}
      <p class="small muted" style="margin:0">مبلغ هر قسط = مبلغ کل ÷ تعداد (اگر مبلغ اقساط با سود متفاوت است، «مبلغ کل» را مجموع همه اقساط وارد کنید).</p>
    </fieldset>`}
    <div class="actions">${cancelBtn}<button class="btn primary">ذخیره</button></div>`;
  openModal(html(), async (fd) => {
    const total = parseAmount(fd.get('total')); const start = parseJ(fd.get('start'));
    if (!total || !start) { toast('مبلغ و تاریخ را درست وارد کنید.'); return false; }
    const row = { person: fd.get('person').trim(), total_amount: total, start_date: start, note: fd.get('note').trim() || null };
    if (d) { row.settled = !!fd.get('settled'); await S.db.update('debts', d.id, row); }
    else {
      const count = parseAmount(fd.get('count')); const every = Math.max(1, parseAmount(fd.get('every')));
      const first = parseJ(fd.get('first'));
      if (count && !first) { toast('تاریخ اولین قسط نامعتبر است.'); return false; }
      if (count > 360) { toast('تعداد اقساط زیاد است.'); return false; }
      const debt = await S.db.insert('debts', { ...row, direction: dir });
      if (count) {
        const [fy, fm, fdd] = isoToJ(first); const each = Math.floor(total / count);
        const rows = Array.from({ length: count }, (_, k) => {
          const [y, m] = addMonth(fy, fm, k * every);
          return { debt_id: debt.id, due_date: jToIso(y, m, Math.min(fdd, monthLen(y, m))), amount: k === count - 1 ? total - each * (count - 1) : each };
        });
        await S.db.insertMany('installments', rows);
      }
    }
    toast('ذخیره شد ✓'); render();
  });
  $('#modalForm').onclick = (e) => {
    const b = e.target.closest('[data-dir]'); if (!b) return;
    const f = $('#modalForm'); const keep = { person: f.person.value, total: f.total.value, note: f.note.value };
    dir = b.dataset.dir; f.innerHTML = html(); Object.entries(keep).forEach(([k, v]) => { f[k].value = v; });
  };
}

async function payInstModal(id) {
  const [inst] = await S.db.list('installments', { eq: { id } });
  const [debt] = await S.db.list('debts', { eq: { id: inst.debt_id } });
  const borrow = debt.direction === 'borrow';
  openModal(`
    <h3>${borrow ? 'پرداخت قسط' : 'دریافت قسط'} — ${esc(debt.person)}</h3>
    <p class="muted small" style="margin:0">سررسید ${fmtJ(inst.due_date)} · مبلغ ${money(inst.amount)}</p>
    ${dateField('paid_date', todayIso(), borrow ? 'تاریخ پرداخت' : 'تاریخ دریافت')}
    <label class="check"><input type="checkbox" name="mk" checked> ثبت به‌عنوان ${borrow ? 'هزینه' : 'درآمد'} در حساب</label>
    <label>${borrow ? 'از حساب' : 'به حساب'}<select name="account_id">${accountOptions(store.get('lastAcc', null) || S.accounts.find((a) => !a.archived)?.id)}</select></label>
    <div class="actions">${cancelBtn}<button class="btn primary">ثبت</button></div>`, async (fd) => {
    const date = parseJ(fd.get('paid_date')); if (!date) { toast('تاریخ نامعتبر است.'); return false; }
    if (fd.get('mk')) {
      const category_id = await getOrCreateCat(borrow ? 'اقساط و بدهی' : 'وصول طلب', borrow ? 'expense' : 'income');
      await S.db.insert('transactions', { kind: borrow ? 'expense' : 'income', amount: inst.amount, account_id: +fd.get('account_id'), category_id, installment_id: inst.id, tx_date: date, note: `قسط ${debt.person}` });
    }
    await S.db.update('installments', inst.id, { paid: true, paid_date: date });
    const all = await S.db.list('installments', { eq: { debt_id: debt.id } });
    if (all.every((i) => i.paid || i.id === inst.id) && sum(all, (i) => i.amount) >= debt.total_amount) await S.db.update('debts', debt.id, { settled: true });
    toast('ثبت شد ✓'); render();
  });
}

function addInstModal(debtId) {
  openModal(`<h3>افزودن قسط / پرداخت</h3>${amountField('amount', 0)}${dateField('due', todayIso(), 'سررسید')}
    <div class="actions">${cancelBtn}<button class="btn primary">افزودن</button></div>`, async (fd) => {
    const amount = parseAmount(fd.get('amount')), due = parseJ(fd.get('due'));
    if (!amount || !due) { toast('مبلغ و تاریخ را درست وارد کنید.'); return false; }
    await S.db.insert('installments', { debt_id: debtId, amount, due_date: due });
    render();
  });
}

// ---------------------------------------------------------------- settings
const ACC_KINDS = { cash: 'نقد', bank: 'حساب بانکی', card: 'کارت', wallet: 'کیف پول', other: 'سایر' };
async function renderSettings() {
  const bals = byId(await S.db.balances());
  const accHtml = S.accounts.map((a) => `<div class="list-item"><span>${esc(a.name)} <small class="muted">${ACC_KINDS[a.kind] || ''}${a.archived ? ' · بایگانی' : ''}</small></span><span class="row">${money(bals[a.id]?.balance ?? 0)}<button class="icon-btn" data-act="editacc" data-id="${a.id}">✎</button><button class="icon-btn" data-act="delacc" data-id="${a.id}">🗑</button></span></div>`).join('');
  const catList = (kind) => S.categories.filter((c) => c.kind === kind).map((c) => `<div class="list-item"><span><i class="swatch" style="background:${esc(c.color)}"></i>${esc(c.name)}</span><span><button class="icon-btn" data-act="editcat" data-id="${c.id}">✎</button><button class="icon-btn" data-act="delcat" data-id="${c.id}">🗑</button></span></div>`).join('');
  let email = 'حالت نمایشی';
  if (!S.demo) { try { email = (await S.client.auth.getUser()).data.user?.email || ''; } catch {} }
  return `
  <h2>تنظیمات</h2>
  <div class="grid g2">
    <div class="card"><div class="row between"><h3>حساب‌ها و کیف پول‌ها</h3><button class="btn sm" data-act="newacc">+ حساب</button></div>${accHtml || '<p class="muted">حسابی ندارید.</p>'}</div>
    <div class="card"><div class="row between"><h3>دسته‌بندی‌ها</h3><button class="btn sm" data-act="newcat">+ دسته</button></div>
      <p class="small muted" style="margin:6px 0 0">هزینه</p>${catList('expense')}<p class="small muted" style="margin:12px 0 0">درآمد</p>${catList('income')}</div>
    <div class="card"><h3>نمایش و امنیت این دستگاه</h3>
      <div class="two-col">
        <label>واحد پول<select data-pref="unit"><option ${prefs.unit === 'تومان' ? 'selected' : ''}>تومان</option><option ${prefs.unit === 'ریال' ? 'selected' : ''}>ریال</option></select></label>
        <label>خروج خودکار پس از عدم فعالیت<select data-pref="lockMin">${[[5, '۵ دقیقه'], [15, '۱۵ دقیقه'], [30, '۳۰ دقیقه'], [60, '۱ ساعت'], [0, 'هرگز']].map(([v, l]) => `<option value="${v}" ${prefs.lockMin === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      </div>
      <p class="small muted">روی سیستم‌های شرکت و سازمان، هنگام ورود تیک «مرا به خاطر بسپار» را نزنید تا با بستن مرورگر، خروج انجام شود.</p>
    </div>
    <div class="card"><h3>حساب کاربری</h3>
      <p class="small">کاربر: <span dir="ltr">${esc(email)}</span></p>
      <div class="row">${S.demo ? '' : '<button class="btn" data-act="chpass">تغییر رمز عبور</button>'}<button class="btn danger" data-act="logout">خروج</button></div>
      <h3 style="margin-top:18px">پشتیبان‌گیری</h3>
      <div class="row"><button class="btn" data-act="csv">خروجی Excel (CSV) تراکنش‌ها</button><button class="btn" data-act="json">پشتیبان کامل (JSON)</button></div>
    </div>
  </div>`;
}

function accModal(a = null) {
  openModal(`<h3>${a ? 'ویرایش حساب' : 'حساب جدید'}</h3>
    <label>نام<input name="name" required maxlength="60" value="${esc(a?.name || '')}" placeholder="مثلاً کارت ملت"></label>
    <label>نوع<select name="kind">${Object.entries(ACC_KINDS).map(([k, v]) => `<option value="${k}" ${(a?.kind || 'card') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label>موجودی اولیه (${esc(prefs.unit)})<input class="num" name="opening" inputmode="numeric" value="${a ? Number(a.opening_balance).toLocaleString('en-US') : ''}" placeholder="0"></label>
    ${a ? `<label class="check"><input type="checkbox" name="archived" ${a.archived ? 'checked' : ''}> بایگانی (در فرم‌ها نمایش داده نشود)</label>` : ''}
    <div class="actions">${cancelBtn}<button class="btn primary">ذخیره</button></div>`, async (fd) => {
    const row = { name: fd.get('name').trim(), kind: fd.get('kind'), opening_balance: parseAmount(fd.get('opening')) };
    if (a) { row.archived = !!fd.get('archived'); await S.db.update('accounts', a.id, row); } else await S.db.insert('accounts', row);
    await loadRefs(); render();
  });
}
function catModal(c = null) {
  openModal(`<h3>${c ? 'ویرایش دسته' : 'دسته جدید'}</h3>
    <label>نام<input name="name" required maxlength="40" value="${esc(c?.name || '')}"></label>
    ${c ? '' : '<label>نوع<select name="kind"><option value="expense">هزینه</option><option value="income">درآمد</option></select></label>'}
    <label>رنگ<input type="color" name="color" value="${esc(c?.color || '#0ea5e9')}" style="height:42px;padding:4px"></label>
    <div class="actions">${cancelBtn}<button class="btn primary">ذخیره</button></div>`, async (fd) => {
    const row = { name: fd.get('name').trim(), color: fd.get('color') };
    if (c) await S.db.update('categories', c.id, row); else await S.db.insert('categories', { ...row, kind: fd.get('kind') });
    await loadRefs(); render();
  });
}
function passModal() {
  openModal(`<h3>تغییر رمز عبور</h3>
    <label>رمز جدید (حداقل ۱۰ کاراکتر)<input type="password" name="p1" minlength="10" required autocomplete="new-password" dir="ltr"></label>
    <label>تکرار رمز جدید<input type="password" name="p2" minlength="10" required autocomplete="new-password" dir="ltr"></label>
    <div class="actions">${cancelBtn}<button class="btn primary">تغییر</button></div>`, async (fd) => {
    if (fd.get('p1') !== fd.get('p2')) { toast('رمزها یکسان نیستند.'); return false; }
    const { error } = await S.client.auth.updateUser({ password: fd.get('p1') });
    if (error) throw error;
    toast('رمز عبور تغییر کرد ✓');
  });
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function exportCsv() {
  const txs = await S.db.list('transactions', { order: 'tx_date' });
  const accs = byId(S.accounts), cats = byId(S.categories);
  const K = { income: 'درآمد', expense: 'هزینه', transfer: 'انتقال' };
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['تاریخ', 'نوع', 'مبلغ', 'حساب', 'به حساب', 'دسته', 'توضیحات'].map(q).join(',')];
  for (const t of txs) lines.push([fmtJin(t.tx_date), K[t.kind], t.amount, accs[t.account_id]?.name, accs[t.to_account_id]?.name, cats[t.category_id]?.name, t.note].map(q).join(','));
  download(`hesab-${fmtJin(todayIso()).replace(/\//g, '-')}.csv`, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
}
async function exportJson() {
  const out = { exported_at: new Date().toISOString() };
  for (const t of ['accounts', 'categories', 'transactions', 'debts', 'installments']) out[t] = await S.db.list(t, { order: 'id' });
  download(`hesab-backup-${fmtJin(todayIso()).replace(/\//g, '-')}.json`, JSON.stringify(out, null, 2), 'application/json');
}

// ---------------------------------------------------------------- view event delegation
$('#view').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const id = Number(b.dataset.id);
  try {
    switch (b.dataset.act) {
      case 'mprev': S.month = addMonth(...S.month, -1); return render();
      case 'mnext': S.month = addMonth(...S.month, 1); return render();
      case 'edittx': return txModal(txCache.find((t) => t.id === id));
      case 'deltx': if (await confirmBox('این تراکنش حذف شود؟')) { await S.db.remove('transactions', id); toast('حذف شد'); render(); } return;
      case 'newdebt': return debtModal();
      case 'editdebt': return debtModal((await S.db.list('debts', { eq: { id } }))[0]);
      case 'deldebt': if (await confirmBox('این مورد و همه اقساطش حذف شود؟ (تراکنش‌های ثبت‌شده باقی می‌مانند)')) { await S.db.remove('debts', id); render(); } return;
      case 'adddinst': return addInstModal(id);
      case 'payinst': return payInstModal(id);
      case 'unpayinst':
        if (await confirmBox('پرداخت این قسط لغو و تراکنش مربوط به آن حذف شود؟', 'بله، لغو شود')) {
          for (const t of await S.db.list('transactions', { eq: { installment_id: id } })) await S.db.remove('transactions', t.id);
          const [inst] = await S.db.list('installments', { eq: { id } });
          await S.db.update('installments', id, { paid: false, paid_date: null });
          await S.db.update('debts', inst.debt_id, { settled: false });
          render();
        } return;
      case 'delinst': if (await confirmBox('این قسط حذف شود؟')) { await S.db.remove('installments', id); render(); } return;
      case 'newacc': return accModal();
      case 'editacc': return accModal(S.accounts.find((a) => a.id === id));
      case 'delacc': if (await confirmBox('این حساب حذف شود؟')) { await S.db.remove('accounts', id); await loadRefs(); render(); } return;
      case 'newcat': return catModal();
      case 'editcat': return catModal(S.categories.find((c) => c.id === id));
      case 'delcat': if (await confirmBox('این دسته حذف شود؟ (تراکنش‌ها بدون دسته می‌شوند)')) { await S.db.remove('categories', id); await loadRefs(); render(); } return;
      case 'chpass': return passModal();
      case 'logout': return logout();
      case 'csv': return exportCsv();
      case 'json': return exportJson();
    }
  } catch (err) { toast(errMsg(err)); }
});
let qTimer;
$('#view').addEventListener('input', (e) => {
  const f = e.target.dataset.filter; if (!f) return;
  S.filters[f] = e.target.value;
  if (f === 'q') { clearTimeout(qTimer); qTimer = setTimeout(async () => { const pos = e.target.selectionStart; await render(); const i = $('[data-filter=q]'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } }, 300); }
  else render();
});
$('#view').addEventListener('change', (e) => {
  const p = e.target.dataset.pref; if (!p) return;
  prefs[p] = p === 'lockMin' ? Number(e.target.value) : e.target.value;
  store.set(p, prefs[p]); toast('ذخیره شد ✓');
  if (p === 'unit') render();
});
$('#modalForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (e.submitter?.value === 'cancel') { dlg().close(); return; }
  const btns = $$('button', e.target); btns.forEach((b) => (b.disabled = true));
  try { const r = await modalSubmit?.(new FormData(e.target), e.target); if (r !== false) dlg().close(); }
  catch (err) { toast(errMsg(err)); }
  finally { btns.forEach((b) => (b.disabled = false)); }
});

// ---------------------------------------------------------------- boot
async function boot() {
  const cfg = window.APP_CONFIG || {};
  const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !/YOUR/.test(cfg.SUPABASE_URL + cfg.SUPABASE_ANON_KEY);
  if (!configured) {
    $('#demoBox').classList.remove('hidden');
    $('#loginBtn').disabled = true;
    if (sessionStorage.getItem('hs_demo_on')) { S.demo = true; return startApp(); }
    return showLogin();
  }
  S.client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { storage: authStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  S.client.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT' && !$('#app').classList.contains('hidden')) showLogin(); });
  const { data } = await S.client.auth.getSession();
  if (data.session) startApp(); else showLogin();
}
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
boot();
})();
