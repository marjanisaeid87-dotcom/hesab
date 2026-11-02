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

// ---------------------------------------------------------------- cheques & installments tab
async function renderDebtsTab() {
  const body = S.sub === 'cheques' ? await renderCheques() : await renderDebts();
  return `<div class="head"><h2>چک و اقساط</h2>
    <div class="subnav"><button data-act="sub" data-id="cheques" class="${S.sub === 'cheques' ? 'on' : ''}">چک‌ها</button><button data-act="sub" data-id="debts" class="${S.sub === 'debts' ? 'on' : ''}">بدهی، طلب و اقساط</button></div></div>${body}`;
}

const CHQ_STATUS = { pending: ['در انتظار', ''], cleared: ['پاس / وصول شد', 'green'], bounced: ['برگشتی', 'red'], cancelled: ['باطل', ''] };
async function renderCheques() {
  const chqs = await S.db.list('cheques', { order: 'due_date' });
  const today = todayIso(), in7 = addDaysIso(today, 7);
  const pend = chqs.filter((c) => c.status === 'pending');
  const recv = sum(pend.filter((c) => c.direction === 'received'), (c) => c.amount);
  const iss = sum(pend.filter((c) => c.direction === 'issued'), (c) => c.amount);
  const soon = pend.filter((c) => c.due_date <= in7);
  const accs = byId(S.accounts);
  const row = (c) => {
    const out = c.direction === 'issued';
    const od = c.status === 'pending' && c.due_date < today;
    const info = [c.serial ? `سریال ${esc(c.serial)}` : '', esc(c.bank || ''), c.account_id ? esc(accs[c.account_id]?.name || '') : ''].filter(Boolean).join(' · ');
    const acts = c.status === 'pending'
      ? `<button class="btn sm" data-act="clearchq" data-id="${c.id}">${out ? 'پاس شد' : 'وصول شد'}</button><button class="icon-btn" data-act="bouncechq" data-id="${c.id}" title="برگشت خورد">⤺</button>`
      : `<button class="icon-btn" data-act="reopenchq" data-id="${c.id}" title="بازگشت به حالت در انتظار">↺</button>`;
    return `<div class="rem ${od ? 'overdue' : c.status !== 'pending' ? 'done' : ''}">
      <span class="pill ${out ? 'red' : 'green'}">${out ? 'پرداختی' : 'دریافتی'}</span>
      <span class="who"><b>${esc(c.person)}</b> <span class="pill ${CHQ_STATUS[c.status][1]}">${CHQ_STATUS[c.status][0]}</span><br>
        <small class="when muted">${fmtJ(c.due_date)}${c.status === 'pending' ? ` · ${relDays(c.due_date)}` : c.cleared_date ? ` · ${fmtJ(c.cleared_date)}` : ''}${info ? ' · ' + info : ''}</small></span>
      ${money(c.amount, out ? 'exp' : 'inc')}
      <span class="row" style="gap:2px">${acts}<button class="icon-btn" data-act="editchq" data-id="${c.id}" title="ویرایش">✎</button><button class="icon-btn" data-act="delchq" data-id="${c.id}" title="حذف">🗑</button></span></div>`;
  };
  const done = chqs.filter((c) => c.status !== 'pending').reverse();
  return `
  <div class="grid g3 mb">
    <div class="card stat"><div class="label">چک‌های دریافتی در انتظار</div><div class="value inc">${fmt(recv)}</div><div class="hint">${faNum(pend.filter((c) => c.direction === 'received').length)} فقره</div></div>
    <div class="card stat"><div class="label">چک‌های پرداختی در انتظار</div><div class="value exp">${fmt(iss)}</div><div class="hint">${faNum(pend.filter((c) => c.direction === 'issued').length)} فقره</div></div>
    <div class="card stat"><div class="label">سررسید تا ۷ روز آینده</div><div class="value ${soon.length ? 'wrn' : ''}">${faNum(soon.length)} <small class="muted" style="font-size:13px">فقره</small></div><div class="hint">${soon.some((c) => c.due_date < today) ? '<span class="exp">شامل چک معوق</span>' : '&nbsp;'}</div></div>
  </div>
  <div class="card mb"><div class="row between" style="margin-bottom:6px"><h3 style="margin:0">در انتظار</h3><button class="btn primary sm" data-act="newchq">+ چک جدید</button></div>
    ${pend.map(row).join('') || '<p class="empty">چک در انتظاری ندارید.</p>'}</div>
  ${done.length ? `<details class="card"><summary><b>انجام‌شده / برگشتی</b> <span class="small muted">(${faNum(done.length)})</span></summary><div style="margin-top:8px">${done.map(row).join('')}</div></details>` : ''}`;
}

function chqModal(c = null) {
  let dir = c?.direction || 'received';
  const v = { ...(c || {}) };
  const html = () => `
    <h3>${c ? 'ویرایش چک' : 'چک جدید'}</h3>
    <div class="seg two"><button type="button" data-dir="received" class="${dir === 'received' ? 'on' : ''}">دریافتی (از دیگران)</button><button type="button" data-dir="issued" class="${dir === 'issued' ? 'on' : ''}">پرداختی (صادره من)</button></div>
    <label>${dir === 'received' ? 'صادرکننده / از طرف' : 'در وجه'}<input name="person" required maxlength="80" value="${esc(v.person || '')}"></label>
    ${amountField('amount', v.amount)}
    ${dateField('due', v.due_date || todayIso(), 'تاریخ سررسید')}
    <div class="two-col">
      <label>شماره سریال<input name="serial" maxlength="40" value="${esc(v.serial || '')}" placeholder="اختیاری" inputmode="numeric" dir="ltr"></label>
      <label>بانک<input name="bank" maxlength="60" value="${esc(v.bank || '')}" placeholder="اختیاری"></label>
    </div>
    <label>${dir === 'received' ? 'واریز به حساب' : 'از حساب'}<select name="account_id"><option value="">— بعداً انتخاب می‌کنم —</option>${accountOptions(v.account_id)}</select></label>
    <label>توضیحات<input name="note" maxlength="300" value="${esc(v.note || '')}"></label>
    <div class="actions">${cancelBtn}<button class="btn primary">ذخیره</button></div>`;
  openModal(html(), async (fd) => {
    const amount = parseAmount(fd.get('amount')), due = parseJ(fd.get('due'));
    if (!amount || !due) { toast('مبلغ و تاریخ سررسید را درست وارد کنید.'); return false; }
    const row = { direction: dir, person: fd.get('person').trim(), amount, due_date: due, serial: toEn(fd.get('serial')).trim() || null, bank: fd.get('bank').trim() || null,
      account_id: fd.get('account_id') ? +fd.get('account_id') : null, note: fd.get('note').trim() || null };
    if (c) await S.db.update('cheques', c.id, row); else await S.db.insert('cheques', row);
    toast('ذخیره شد ✓'); render();
  });
  $('#modalForm').onclick = (e) => {
    const b = e.target.closest('[data-dir]'); if (!b) return;
    const f = $('#modalForm'); Object.assign(v, { person: f.person.value, amount: parseAmount(f.amount.value), serial: f.serial.value, bank: f.bank.value, note: f.note.value, account_id: +f.account_id.value || null });
    const d = parseJ(f.due.value); if (d) v.due_date = d;
    dir = b.dataset.dir; f.innerHTML = html();
  };
}

async function clearChqModal(id) {
  const [c] = await S.db.list('cheques', { eq: { id } });
  const out = c.direction === 'issued';
  const kind = out ? 'expense' : 'income';
  openModal(`
    <h3>${out ? 'پاس شدن چک' : 'وصول چک'} — ${esc(c.person)}</h3>
    <p class="muted small" style="margin:0">سررسید ${fmtJ(c.due_date)} · مبلغ ${money(c.amount)}</p>
    ${dateField('date', c.due_date <= todayIso() ? c.due_date : todayIso(), out ? 'تاریخ پاس شدن' : 'تاریخ وصول')}
    <label class="check"><input type="checkbox" name="mk" checked> ثبت به‌عنوان ${out ? 'هزینه' : 'درآمد'} در حساب</label>
    <div class="two-col">
      <label>${out ? 'از حساب' : 'به حساب'}<select name="account_id">${accountOptions(c.account_id || store.get('lastAcc', null) || S.accounts.find((a) => !a.archived)?.id)}</select></label>
      <label>دسته<select name="category_id">${catOptions(kind, null)}</select></label>
    </div>
    <p class="small muted" style="margin:0">اگر این چک بابت بدهی یا طلبی است که قبلاً ثبت کرده‌اید، تیک بالا را بردارید تا دوبار حساب نشود.</p>
    <div class="actions">${cancelBtn}<button class="btn primary">ثبت</button></div>`, async (fd) => {
    const date = parseJ(fd.get('date')); if (!date) { toast('تاریخ نامعتبر است.'); return false; }
    let tx_id = null;
    if (fd.get('mk')) {
      const category_id = fd.get('category_id') ? +fd.get('category_id') : await getOrCreateCat(out ? 'پرداخت چک' : 'وصول چک', kind);
      tx_id = (await S.db.insert('transactions', { kind, amount: c.amount, account_id: +fd.get('account_id'), category_id, tx_date: date, note: `چک ${out ? 'به' : 'از'} ${c.person}${c.serial ? ' — ' + c.serial : ''}` })).id;
    }
    await S.db.update('cheques', c.id, { status: 'cleared', cleared_date: date, tx_id, account_id: +fd.get('account_id') || c.account_id });
    toast('ثبت شد ✓'); render();
  });
}
async function setChqStatus(id, status) {
  const [c] = await S.db.list('cheques', { eq: { id } });
  if (status === 'pending' && c.tx_id) {
    if (!(await confirmBox('چک به حالت «در انتظار» برگردد و تراکنش ثبت‌شده‌اش حذف شود؟', 'بله'))) return;
    await S.db.update('cheques', id, { tx_id: null });
    await S.db.remove('transactions', c.tx_id);
  } else if (status === 'bounced' && !(await confirmBox('این چک برگشتی ثبت شود؟', 'بله، برگشت خورد'))) return;
  await S.db.update('cheques', id, { status, cleared_date: status === 'pending' ? null : todayIso() });
  render();
}

// ---------------------------------------------------------------- annual report
async function renderReport() {
  const y = S.year;
  const [from] = monthRange(y - 1, 1), [, to] = monthRange(y, 12);
  const txs = await S.db.list('transactions', { gte: { tx_date: from }, lte: { tx_date: to }, select: 'id,kind,amount,tx_date,category_id,account_id' });
  const [yFrom] = monthRange(y, 1);
  const cur = txs.filter((t) => t.tx_date >= yFrom), prev = txs.filter((t) => t.tx_date < yFrom);
  const tot = (arr, k) => sum(arr.filter((t) => t.kind === k), (t) => t.amount);
  const inc = tot(cur, 'income'), exp = tot(cur, 'expense'), pInc = tot(prev, 'income'), pExp = tot(prev, 'expense');
  const rows = Array.from({ length: 12 }, (_, i) => {
    const [a, b] = monthRange(y, i + 1); const ts = cur.filter((t) => t.tx_date >= a && t.tx_date <= b);
    return { y, m: i + 1, i: tot(ts, 'income'), e: tot(ts, 'expense') };
  });
  const [ty, tm] = isoToJ(todayIso());
  const monthsSoFar = y < ty ? 12 : y === ty ? tm : 0;
  let cum = 0;
  const tr = rows.map((r) => { cum += r.i - r.e; const n = r.i - r.e; return `<tr><td>${MONTHS[r.m - 1]}</td><td class="n inc">${fmt(r.i)}</td><td class="n exp">${fmt(r.e)}</td><td class="n ${n < 0 ? 'exp' : ''}">${fmt(n)}</td><td class="n muted">${fmt(cum)}</td><td class="n muted">${r.i ? faNum(Math.round((n / r.i) * 100)) + '٪' : '—'}</td></tr>`; }).join('');
  const cats = byId(S.categories);
  const group = (k) => { const o = {}; cur.filter((t) => t.kind === k).forEach((t) => { o[t.category_id ?? 0] = (o[t.category_id ?? 0] || 0) + Number(t.amount); }); return o; };
  const expCat = group('expense'), incCat = group('income');
  const change = (c, p) => (p ? `${c >= p ? '▲' : '▼'} ${faNum(Math.abs(Math.round(((c - p) / p) * 100)))}٪ نسبت به ${faNum(y - 1)}` : '&nbsp;');
  const catTable = (o, total) => {
    const list = Object.entries(o).sort((a, b) => b[1] - a[1]);
    if (!list.length) return '<p class="empty">موردی ثبت نشده.</p>';
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>دسته</th><th class="n">جمع سال</th><th class="n">میانگین ماهانه</th><th class="n">سهم</th></tr></thead><tbody>${list.map(([cid, v]) => {
      const c = cats[cid] || { name: 'بدون دسته', color: '#94a3b8' };
      return `<tr><td><i class="swatch" style="background:${esc(c.color)}"></i>${esc(c.name)}</td><td class="n">${fmt(v)}</td><td class="n muted">${fmt(v / (monthsSoFar || 12))}</td><td class="n muted">${faNum(Math.round((v / (total || 1)) * 100))}٪</td></tr>`;
    }).join('')}</tbody></table></div>`;
  };
  return `
  <div class="head"><h2>گزارش سالانه</h2>
    <div class="row"><div class="month-nav"><button class="icon-btn" data-act="yprev" title="سال قبل">→</button><span>سال ${faNum(y)}</span><button class="icon-btn" data-act="ynext" title="سال بعد">←</button></div>
    <button class="btn sm" data-act="yearcsv">خروجی Excel</button></div></div>
  <div class="grid g4 mb">
    <div class="card stat"><div class="label">کل درآمد</div><div class="value inc">${fmt(inc)}</div><div class="hint">${change(inc, pInc)}</div></div>
    <div class="card stat"><div class="label">کل هزینه</div><div class="value exp">${fmt(exp)}</div><div class="hint">${change(exp, pExp)}</div></div>
    <div class="card stat"><div class="label">پس‌انداز سال</div><div class="value ${inc - exp < 0 ? 'exp' : 'inc'}">${fmt(inc - exp)}</div><div class="hint">${inc ? faNum(Math.round(((inc - exp) / inc) * 100)) + '٪ درآمد' : '&nbsp;'}</div></div>
    <div class="card stat"><div class="label">میانگین هزینه ماهانه</div><div class="value">${fmt(exp / (monthsSoFar || 12))}</div><div class="hint">${monthsSoFar ? `بر اساس ${faNum(monthsSoFar)} ماه` : '&nbsp;'}</div></div>
  </div>
  <div class="grid g2 mb">
    <div class="card"><h3>نمودار ماهانه ${faNum(y)}</h3>${barChart(rows)}</div>
    <div class="card"><h3>هزینه‌ها بر اساس دسته</h3>${catBars(expCat, cats, exp) || '<p class="empty">هزینه‌ای ثبت نشده.</p>'}</div>
  </div>
  <div class="card mb"><h3>جدول ماه‌به‌ماه</h3><div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>ماه</th><th class="n">درآمد</th><th class="n">هزینه</th><th class="n">مانده</th><th class="n">مانده تجمعی</th><th class="n">نرخ پس‌انداز</th></tr></thead>
    <tbody>${tr}</tbody>
    <tfoot><tr><td>جمع</td><td class="n inc">${fmt(inc)}</td><td class="n exp">${fmt(exp)}</td><td class="n">${fmt(inc - exp)}</td><td></td><td class="n">${inc ? faNum(Math.round(((inc - exp) / inc) * 100)) + '٪' : '—'}</td></tr></tfoot>
  </table></div></div>
  <div class="grid g2">
    <div class="card"><h3>جزئیات هزینه‌ها</h3>${catTable(expCat, exp)}</div>
    <div class="card"><h3>جزئیات درآمدها</h3>${catTable(incCat, inc)}</div>
  </div>`;
}
async function exportYearCsv() {
  const y = S.year; const [from] = monthRange(y, 1), [, to] = monthRange(y, 12);
  const txs = await S.db.list('transactions', { gte: { tx_date: from }, lte: { tx_date: to } });
  const cats = byId(S.categories);
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [[`گزارش سالانه ${y}`].map(q).join(','), '', ['ماه', 'درآمد', 'هزینه', 'مانده'].map(q).join(',')];
  let ti = 0, te = 0;
  for (let m = 1; m <= 12; m++) {
    const [a, b] = monthRange(y, m); const ts = txs.filter((t) => t.tx_date >= a && t.tx_date <= b);
    const i = sum(ts.filter((t) => t.kind === 'income'), (t) => t.amount), e = sum(ts.filter((t) => t.kind === 'expense'), (t) => t.amount);
    ti += i; te += e; lines.push([MONTHS[m - 1], i, e, i - e].map(q).join(','));
  }
  lines.push(['جمع', ti, te, ti - te].map(q).join(','), '', ['دسته', 'نوع', 'جمع سال'].map(q).join(','));
  const g = {}; txs.filter((t) => t.kind !== 'transfer').forEach((t) => { const k = `${t.kind}|${t.category_id ?? 0}`; g[k] = (g[k] || 0) + Number(t.amount); });
  Object.entries(g).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => { const [kind, cid] = k.split('|'); lines.push([cats[cid]?.name || 'بدون دسته', kind === 'income' ? 'درآمد' : 'هزینه', v].map(q).join(',')); });
  download(`gozaresh-${y}.csv`, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
}

// ---------------------------------------------------------------- settings (per device)
const store = {
  get(k, def) { try { const v = localStorage.getItem('hs_' + k); return v === null ? def : JSON.parse(v); } catch { return def; } },
  set(k, v) { try { localStorage.setItem('hs_' + k, JSON.stringify(v)); } catch {} },
};
const prefs = { unit: store.get('unit', 'تومان'), lockMin: store.get('lockMin', 15), theme: store.get('theme', 'auto') };
const money = (n, cls = '') => `<span class="num-txt ${cls}">${fmt(n)} <small class="muted">${esc(prefs.unit)}</small></span>`;
const relDays = (iso) => {
  const n = daysBetween(todayIso(), iso);
  return n === 0 ? 'امروز' : n === 1 ? 'فردا' : n === -1 ? 'دیروز' : n > 0 ? `${faNum(n)} روز دیگر` : `${faNum(-n)} روز گذشته`;
};
const softBg = (c) => `background:color-mix(in srgb, ${c} 14%, transparent);color:${c}`;

// ---------------------------------------------------------------- theme
const THEME_LABEL = { auto: 'خودکار (مطابق سیستم)', light: 'روشن', dark: 'تاریک' };
function applyTheme() {
  const r = document.documentElement;
  if (prefs.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', prefs.theme);
  const dark = prefs.theme === 'dark' || (prefs.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const btn = document.getElementById('themeBtn');
  if (btn) { btn.textContent = dark ? '☀' : '☾'; btn.title = 'تم: ' + THEME_LABEL[prefs.theme]; }
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#151F1F' : '#16A6A1');
}
function setTheme(t) { prefs.theme = t; store.set('theme', t); applyTheme(); }
applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

// ---------------------------------------------------------------- recurring helpers
function nextRecDate(r) {
  const [y, m] = isoToJ(r.next_date);
  const [ny, nm] = addMonth(y, m, r.every_months || 1);
  return jToIso(ny, nm, Math.min(r.day_of_month, monthLen(ny, nm)));
}
const EVERY_LABEL = { 1: 'ماهانه', 2: 'هر ۲ ماه', 3: 'هر ۳ ماه (فصلی)', 6: 'هر ۶ ماه', 12: 'سالانه' };

// ---------------------------------------------------------------- voice → transaction
const NUMW = { 'صفر': 0, 'یک': 1, 'یه': 1, 'دو': 2, 'سه': 3, 'چهار': 4, 'پنج': 5, 'شش': 6, 'شیش': 6, 'هفت': 7, 'هشت': 8, 'نه': 9, 'ده': 10,
  'یازده': 11, 'دوازده': 12, 'سیزده': 13, 'چهارده': 14, 'پانزده': 15, 'پونزده': 15, 'شانزده': 16, 'شونزده': 16, 'هفده': 17, 'هیفده': 17,
  'هجده': 18, 'هیجده': 18, 'نوزده': 19, 'بیست': 20, 'سی': 30, 'چهل': 40, 'پنجاه': 50, 'شصت': 60, 'هفتاد': 70, 'هشتاد': 80, 'نود': 90,
  'صد': 100, 'یکصد': 100, 'دویست': 200, 'سیصد': 300, 'چهارصد': 400, 'پانصد': 500, 'پونصد': 500, 'ششصد': 600, 'شیشصد': 600,
  'هفتصد': 700, 'هشتصد': 800, 'نهصد': 900, 'نیم': 0.5 };
const SCALES = { 'هزار': 1e3, 'تومن': 0, 'میلیون': 1e6, 'ملیون': 1e6, 'میلیارد': 1e9 };
// همه عددهای جمله را پیدا می‌کند و بزرگ‌ترین را به‌عنوان مبلغ برمی‌گرداند
function parsePersianAmount(text) {
  const toks = toEn(text).replace(/(\d)[,٬،](?=\d{3})/g, '$1').replace(/٫/g, '.').split(/[\s‌]+/).filter(Boolean);
  const spans = []; let total = 0, cur = 0, open = false;
  const close = () => { if (open) spans.push(total + cur); total = 0; cur = 0; open = false; };
  for (let i = 0; i < toks.length; i++) {
    let w = toks[i]; const nx = toks[i + 1] || '';
    if (w.length > 1 && w[0] === 'و' && !(w in NUMW) && ((w.slice(1) in NUMW) || SCALES[w.slice(1)] || /^\d/.test(w.slice(1)))) w = w.slice(1);
    if (/^\d+(\.\d+)?$/.test(w)) {
      if (open && cur && !total && cur >= 1000) close();       // دو عدد رقمی پشت سر هم
      cur += Number(w); open = true;
    } else if (w in NUMW && (w !== 'نه' || open || nx in SCALES || nx in NUMW)) { cur += NUMW[w]; open = true; }
    else if (SCALES[w]) { total += (cur || 1) * SCALES[w]; cur = 0; open = true; }
    else if (w === 'و' || /^(تومان|تومن|ریال)$/.test(w)) continue;
    else close();
  }
  close();
  return Math.round(Math.max(0, ...spans));
}
const VOICE_CATS = [
  [/ناهار|شام|صبحانه|رستوران|فست ?فود|کافه|پیتزا|ساندویچ/, 'رستوران'],
  [/نان|نون|میوه|سوپر|بقالی|گوشت|مرغ|لبنیات|خواربار|خرید روزانه/, 'خوراک'],
  [/بنزین|تاکسی|اسنپ|تپسی|مترو|اتوبوس|پارکینگ/, 'حمل'],
  [/قبض|برق|گاز|شارژ|اینترنت|موبایل|تلفن/, 'قبوض'],
  [/اجاره|رهن/, 'اجاره'],
  [/دکتر|دارو|درمان|آزمایش|دندان/, 'درمان'],
  [/لباس|کفش|پوشاک/, 'پوشاک'],
  [/سینما|سفر|تفریح|هتل|بلیط/, 'تفریح'],
  [/کتاب|کلاس|دوره|آموزش|شهریه/, 'آموزش'],
  [/قسط/, 'اقساط'],
  [/اضافه ?کار|پاداش|عیدی/, 'اضافه'],
  [/حقوق/, 'حقوق'],
  [/پروژه|کار آزاد/, 'کار آزاد'],
  [/سود/, 'سود'],
];
function parseVoice(raw) {
  const text = toEn(raw).replace(/ي/g, 'ی').replace(/ك/g, 'ک');
  const out = { note: raw.trim() };
  out.kind = /انتقال|منتقل/.test(text) ? 'transfer' : /درآمد|درامد|واریز|دریافت|حقوق|گرفتم|پاداش|عیدی|سود|اضافه ?کار/.test(text) ? 'income' : 'expense';
  out.amount = parsePersianAmount(text);
  const accs = S.accounts.filter((a) => !a.archived);
  const hits = accs.filter((a) => text.includes(a.name)).sort((a, b) => text.indexOf(a.name) - text.indexOf(b.name));
  let acc = hits[0];
  if (!acc && /نقد/.test(text)) acc = accs.find((a) => a.kind === 'cash');
  if (!acc && /کارت|بانک/.test(text)) acc = accs.find((a) => a.kind === 'card') || accs.find((a) => a.kind === 'bank');
  if (acc) out.account_id = acc.id;
  if (out.kind === 'transfer' && hits[1]) out.to_account_id = hits[1].id;
  if (out.kind !== 'transfer') {
    const cats = S.categories.filter((c) => c.kind === out.kind);
    let cat = cats.filter((c) => text.includes(c.name)).sort((a, b) => b.name.length - a.name.length)[0];
    if (!cat) for (const [re, key] of VOICE_CATS) if (re.test(text)) { cat = cats.find((c) => c.name.includes(key)); if (cat) break; }
    if (cat) out.category_id = cat.id;
  }
  return out;
}
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

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
    async removeAll(table) { chk(await client.from(table).delete().gte('id', 0)); },
    async balances() { return this.list('account_balances', { order: 'id' }); },
  };
}

function demoBackend() {
  const KEY = 'hs_demo_db';
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch {}
  db = db || { seq: 1, t: {} };
  for (const t of ['accounts', 'categories', 'transactions', 'debts', 'installments', 'recurring', 'cheques']) db.t[t] = db.t[t] || [];
  const save = () => localStorage.setItem(KEY, JSON.stringify(db));
  const fk = () => { const e = new Error('fk'); e.code = '23503'; return e; };
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const defaults = {
    accounts: { kind: 'bank', opening_balance: 0, archived: false },
    categories: { color: '#64748b' },
    transactions: { to_account_id: null, category_id: null, installment_id: null, note: null },
    debts: { settled: false, note: null },
    installments: { paid: false, paid_date: null },
    recurring: { to_account_id: null, category_id: null, note: null, every_months: 1, active: true },
    cheques: { serial: null, bank: null, account_id: null, status: 'pending', cleared_date: null, tx_id: null, note: null },
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
      if (table === 'accounts') { T.recurring = T.recurring.filter((r) => r.account_id !== id && r.to_account_id !== id); T.cheques.forEach((c) => { if (c.account_id === id) c.account_id = null; }); }
      if (table === 'categories') T.recurring.forEach((r) => { if (r.category_id === id) r.category_id = null; });
      if (table === 'transactions') T.cheques.forEach((c) => { if (c.tx_id === id) c.tx_id = null; });
      T[table] = T[table].filter((x) => x.id !== id); save();
    },
    async removeAll(table) { db.t[table] = []; save(); },
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
const S = { db: null, client: null, demo: false, tab: 'dash', sub: 'cheques', year: null, month: null, accounts: [], categories: [], filters: { kind: '', account: '', category: '', q: '' } };
{ const [y, m] = isoToJ(todayIso()); S.month = [y, m]; S.year = y; }

// ---------------------------------------------------------------- UI helpers
let toastTimer;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2800); }
function errMsg(e) {
  const m = String(e?.message || e || '');
  if (e?.code === '23503') return 'این مورد در تراکنش‌ها استفاده شده و قابل حذف نیست (می‌توانید بایگانی‌اش کنید).';
  if (/recurring|cheques/.test(m) && /schema cache|does not exist|not find/i.test(m)) return 'جدول‌های جدید ساخته نشده‌اند؛ فایل update-2.sql را در Supabase → SQL Editor اجرا کنید.';
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
  await render();
  try {
    const soon = (await loadReminders(3)).filter((r) => r.type !== 'rec');
    if (soon.length) toast(`🔔 ${faNum(soon.length)} چک/قسط تا ۳ روز آینده (یا معوق) دارید.`);
  } catch {}
}

$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]'); if (!b) return;
  S.tab = b.dataset.tab;
  $$('#tabs button').forEach((x) => x.classList.toggle('active', x === b));
  window.scrollTo(0, 0);
  render();
});
$('#fab').addEventListener('click', () => txModal());
$('#themeBtn').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  setTheme(dark ? 'light' : 'dark');
  if (S.tab === 'settings') render();
});

async function render() {
  const v = $('#view');
  try {
    if (S.tab === 'dash') v.innerHTML = await renderDash();
    else if (S.tab === 'tx') v.innerHTML = await renderTx();
    else if (S.tab === 'debts') v.innerHTML = await renderDebtsTab();
    else if (S.tab === 'report') v.innerHTML = await renderReport();
    else v.innerHTML = await renderSettings();
  } catch (e) { v.innerHTML = `<p class="empty">${esc(errMsg(e))}</p>`; }
}

// ---------------------------------------------------------------- reminders (installments + cheques + recurring)
async function loadReminders(days = 30) {
  const until = addDaysIso(todayIso(), days);
  const [insts, debts, chqs, recs] = await Promise.all([
    S.db.list('installments', { eq: { paid: false }, lte: { due_date: until }, order: 'due_date' }),
    S.db.list('debts'),
    S.db.list('cheques', { eq: { status: 'pending' }, lte: { due_date: until }, order: 'due_date' }).catch(() => []),
    S.db.list('recurring', { eq: { active: true }, lte: { next_date: until }, order: 'next_date' }).catch(() => []),
  ]);
  const dmap = byId(debts), cats = byId(S.categories);
  const items = [];
  for (const i of insts) { const d = dmap[i.debt_id]; if (d) items.push({ type: 'inst', id: i.id, date: i.due_date, amount: i.amount, out: d.direction === 'borrow', label: `قسط ${d.person}` }); }
  for (const c of chqs) items.push({ type: 'chq', id: c.id, date: c.due_date, amount: c.amount, out: c.direction === 'issued', label: `چک ${c.direction === 'issued' ? 'پرداختی به' : 'دریافتی از'} ${c.person}` });
  for (const r of recs) items.push({ type: 'rec', id: r.id, date: r.next_date, amount: r.amount, out: r.kind !== 'income', label: r.note || cats[r.category_id]?.name || (r.kind === 'income' ? 'درآمد تکراری' : 'هزینه تکراری') });
  return items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
const REM_TYPE = { inst: ['قسط', 'brand'], chq: ['چک', 'warn'], rec: ['تکراری', ''] };
function reminderRow(it) {
  const od = it.date < todayIso();
  const act = it.type === 'inst' ? `<button class="btn sm" data-act="payinst" data-id="${it.id}">${it.out ? 'پرداخت' : 'دریافت'}</button>`
    : it.type === 'chq' ? `<button class="btn sm" data-act="clearchq" data-id="${it.id}">${it.out ? 'پاس شد' : 'وصول شد'}</button>`
    : `<span class="row" style="gap:2px"><button class="btn sm" data-act="dorec" data-id="${it.id}">ثبت</button><button class="icon-btn" data-act="skiprec" data-id="${it.id}" title="این دوره رد شود">⤼</button></span>`;
  return `<div class="rem ${od ? 'overdue' : ''}"><span class="pill ${REM_TYPE[it.type][1]}">${REM_TYPE[it.type][0]}</span>
    <span class="who">${esc(it.label)}<br><small class="when muted">${fmtJ(it.date)} · ${relDays(it.date)}</small></span>
    ${money(it.amount, it.out ? 'exp' : 'inc')}${act}</div>`;
}

// ---------------------------------------------------------------- dashboard
async function renderDash() {
  const [from12] = monthRange(...addMonth(...S.month, -11));
  const [mFrom, mTo] = monthRange(...S.month);
  const [pFrom, pTo] = monthRange(...addMonth(...S.month, -1));
  const [txs, bals, rems] = await Promise.all([
    S.db.list('transactions', { gte: { tx_date: from12 }, lte: { tx_date: mTo }, select: 'id,kind,amount,tx_date,category_id' }),
    S.db.balances(),
    loadReminders(30),
  ]);
  const month = txs.filter((t) => t.tx_date >= mFrom);
  const prev = txs.filter((t) => t.tx_date >= pFrom && t.tx_date <= pTo);
  const tot = (arr, k) => sum(arr.filter((t) => t.kind === k), (t) => t.amount);
  const inc = tot(month, 'income'), exp = tot(month, 'expense'), net = inc - exp;
  const pInc = tot(prev, 'income'), pExp = tot(prev, 'expense');
  const delta = (cur, p, goodUp) => {
    if (!p) return '<div class="hint">&nbsp;</div>';
    const d = Math.round(((cur - p) / p) * 100); if (!d) return '<div class="hint">مثل ماه قبل</div>';
    const good = goodUp ? d > 0 : d < 0;
    return `<div class="hint"><span class="${good ? 'inc' : 'exp'}">${d > 0 ? '▲' : '▼'} ${faNum(Math.abs(d))}٪</span> نسبت به ماه قبل</div>`;
  };

  const active = bals.filter((a) => !a.archived);
  const balHtml = active.map((a) => `<div class="acc"><span>${esc(a.name)}</span>${money(a.balance, a.balance < 0 ? 'exp' : '')}</div>`).join('')
    + `<div class="acc"><b>جمع موجودی</b><b>${money(sum(active, (a) => a.balance))}</b></div>`;

  const cats = byId(S.categories);
  const byCat = {};
  month.filter((t) => t.kind === 'expense').forEach((t) => { byCat[t.category_id ?? 0] = (byCat[t.category_id ?? 0] || 0) + Number(t.amount); });
  const catHtml = catBars(byCat, cats, exp) || '<p class="empty">هزینه‌ای در این ماه ثبت نشده.</p>';

  const months = Array.from({ length: 12 }, (_, i) => addMonth(...S.month, i - 11));
  const series = months.map(([y, m]) => {
    const [a, b] = monthRange(y, m);
    const ts = txs.filter((t) => t.tx_date >= a && t.tx_date <= b);
    return { y, m, i: tot(ts, 'income'), e: tot(ts, 'expense') };
  });

  const remHtml = rems.length ? rems.slice(0, 8).map(reminderRow).join('') + (rems.length > 8 ? `<p class="small muted">و ${faNum(rems.length - 8)} مورد دیگر…</p>` : '')
    : '<p class="muted small">در ۳۰ روز آینده سررسیدی ندارید.</p>';

  return `
  <div class="head"><h2>خلاصه ماه</h2>${monthNav()}</div>
  <div class="grid g3 mb">
    <div class="card stat"><div class="label">درآمد</div><div class="value inc">${fmt(inc)}</div>${delta(inc, pInc, true)}</div>
    <div class="card stat"><div class="label">هزینه</div><div class="value exp">${fmt(exp)}</div>${delta(exp, pExp, false)}</div>
    <div class="card stat"><div class="label">مانده (پس‌انداز)</div><div class="value ${net < 0 ? 'exp' : 'inc'}">${fmt(net)}</div><div class="hint">${inc ? `${faNum(Math.round((net / inc) * 100))}٪ درآمد` : '&nbsp;'}</div></div>
  </div>
  <div class="grid g2">
    <div class="card"><h3>یادآوری‌ها — ۳۰ روز آینده</h3>${remHtml}</div>
    <div class="card"><h3>موجودی حساب‌ها</h3>${balHtml}</div>
    <div class="card"><h3>هزینه‌ها بر اساس دسته — ${monthTitle(S.month)}</h3>${catHtml}</div>
    <div class="card"><h3>درآمد و هزینه ۱۲ ماه اخیر</h3>${barChart(series)}</div>
  </div>`;
}
function catBars(byCat, cats, total) {
  const rows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return '';
  const max = rows[0][1] || 1;
  return rows.map(([cid, v]) => {
    const c = cats[cid] || { name: 'بدون دسته', color: '#94a3b8' };
    return `<div class="hbar"><span title="${esc(c.name)}">${esc(c.name)}</span><div class="track"><div class="fill" style="width:${(v / max) * 100}%;background:${esc(c.color)}"></div></div><span class="num-txt">${fmt(v)} <small class="muted">${faNum(Math.round((v / (total || 1)) * 100))}٪</small></span></div>`;
  }).join('');
}
function barChart(series) {
  const maxV = Math.max(1, ...series.map((s) => Math.max(s.i, s.e)));
  return `<div class="vchart">${series.map((s) => `<div class="col" title="${MONTHS[s.m - 1]} ${faNum(s.y)} — درآمد: ${fmt(s.i)} / هزینه: ${fmt(s.e)}"><div class="pair"><div class="b i" style="height:${(s.i / maxV) * 100}%"></div><div class="b e" style="height:${(s.e / maxV) * 100}%"></div></div></div>`).join('')}</div>
    <div class="vlabels">${series.map((s) => `<span>${MONTHS[s.m - 1].slice(0, 3)}</span>`).join('')}</div>
    <div class="legend"><span><i class="dot" style="background:var(--brand)"></i>درآمد</span><span><i class="dot" style="background:var(--expense)"></i>هزینه</span></div>`;
}

// ---------------------------------------------------------------- transactions
let txCache = [];
async function renderTx() {
  const [from, to] = monthRange(...S.month);
  const [txs, recs] = await Promise.all([
    S.db.list('transactions', { gte: { tx_date: from }, lte: { tx_date: to }, order: 'tx_date', asc: false }),
    S.db.list('recurring', { order: 'next_date' }).catch(() => null),
  ]);
  txCache = txs;
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
    const color = t.kind === 'transfer' ? 'var(--transfer)' : esc(c?.color || '#94a3b8');
    const title = t.kind === 'transfer' ? `انتقال: ${esc(accs[t.account_id]?.name)} ← ${esc(accs[t.to_account_id]?.name)}` : esc(c?.name || (t.kind === 'income' ? 'درآمد' : 'هزینه'));
    const sub = [t.kind !== 'transfer' ? esc(accs[t.account_id]?.name) : '', esc(t.note || '')].filter(Boolean).join(' · ');
    const cls = t.kind === 'income' ? 'inc' : t.kind === 'expense' ? 'exp' : 'trf';
    const sign = t.kind === 'income' ? '+' : t.kind === 'expense' ? '−' : '';
    html += `<div class="tx"><div class="ic" style="${softBg(color)}">${t.kind === 'transfer' ? '⇄' : esc((c?.name || '•').slice(0, 1))}</div>
      <div><div class="title">${title}</div><div class="sub">${sub}</div></div>
      <div class="num-txt ${cls}">${sign}${fmt(t.amount)}</div>
      <div><button class="icon-btn" data-act="edittx" data-id="${t.id}" title="ویرایش">✎</button><button class="icon-btn" data-act="deltx" data-id="${t.id}" title="حذف">🗑</button></div></div>`;
  }
  const catOpts = '<option value="">همه دسته‌ها</option>' + S.categories.map((c) => `<option value="${c.id}" ${+f.category === c.id ? 'selected' : ''}>${esc(c.name)} (${c.kind === 'income' ? 'درآمد' : 'هزینه'})</option>`).join('');

  // recurring list
  const recHtml = recs === null ? `<p class="small exp">${esc(errMsg(new Error('recurring does not exist')))}</p>`
    : recs.length ? recs.map((r) => {
      const name = r.note || cats[r.category_id]?.name || (r.kind === 'transfer' ? 'انتقال' : r.kind === 'income' ? 'درآمد' : 'هزینه');
      return `<div class="rem ${r.active ? '' : 'done'}"><span class="pill ${r.kind === 'income' ? 'green' : r.kind === 'expense' ? 'red' : 'brand'}">${EVERY_LABEL[r.every_months] || `هر ${faNum(r.every_months)} ماه`}</span>
        <span class="who">${esc(name)}<br><small class="muted">${r.active ? `بعدی: ${fmtJ(r.next_date)} (${relDays(r.next_date)})` : 'غیرفعال'} · ${esc(accs[r.account_id]?.name || '')}</small></span>
        ${money(r.amount, r.kind === 'income' ? 'inc' : r.kind === 'expense' ? 'exp' : 'trf')}
        <span><button class="icon-btn" data-act="editrec" data-id="${r.id}" title="ویرایش">✎</button><button class="icon-btn" data-act="delrec" data-id="${r.id}" title="حذف">🗑</button></span></div>`;
    }).join('') : '<p class="small muted">مثلاً حقوق، اجاره، قبوض یا اقساط ماهانه را اینجا تعریف کنید تا هر ماه در داشبورد یادآوری و با یک کلیک ثبت شوند.</p>';

  return `
  <div class="head"><h2>تراکنش‌ها</h2>${monthNav()}</div>
  <details class="card mb" ${store.get('recOpen', false) ? 'open' : ''} id="recBox"><summary><b>تراکنش‌های تکراری</b> <span class="small muted">(${faNum(recs?.length || 0)})</span></summary>
    <div style="margin-top:10px">${recHtml}</div>
    <div class="row" style="margin-top:10px"><button class="btn soft sm" data-act="newrec">+ تراکنش تکراری جدید</button></div>
  </details>
  <div class="filters">
    <select data-filter="kind"><option value="">همه انواع</option><option value="expense" ${f.kind === 'expense' ? 'selected' : ''}>هزینه</option><option value="income" ${f.kind === 'income' ? 'selected' : ''}>درآمد</option><option value="transfer" ${f.kind === 'transfer' ? 'selected' : ''}>انتقال</option></select>
    <select data-filter="account"><option value="">همه حساب‌ها</option>${S.accounts.map((a) => `<option value="${a.id}" ${+f.account === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>
    <select data-filter="category">${catOpts}</select>
    <input data-filter="q" placeholder="جستجو در توضیحات…" value="${esc(f.q)}">
  </div>
  <div class="card row between small" style="margin-bottom:6px;padding:12px 18px"><span>${faNum(list.length)} تراکنش</span><span>درآمد: <b class="inc">${fmt(inc)}</b></span><span>هزینه: <b class="exp">${fmt(exp)}</b></span></div>
  ${html || '<p class="empty">تراکنشی برای این ماه پیدا نشد. با دکمه + ثبت کنید.</p>'}`;
}

/* فرم ثبت/ویرایش تراکنش
   t: تراکنش موجود (ویرایش) | opts.prefill: مقادیر اولیه | opts.onSaved(row): بعد از ذخیره | opts.title */
function txModal(t = null, opts = {}) {
  if (!S.accounts.filter((a) => !a.archived).length) { toast('ابتدا در تنظیمات یک حساب بسازید.'); return; }
  const v = { ...(opts.prefill || {}), ...(t || {}) };
  let kind = v.kind || 'expense';
  let heard = '';
  const isNew = !t && !opts.onSaved;
  const defAcc = () => v.account_id || store.get('lastAcc', null) || S.accounts.find((a) => !a.archived)?.id;
  const html = () => `
    <div class="modal-head"><h3>${opts.title || (t ? 'ویرایش تراکنش' : 'ثبت تراکنش')}</h3>${isNew ? '<button type="button" class="mic" id="micBtn" title="ثبت با صدا">🎤</button>' : ''}</div>
    ${heard ? `<div class="heard">🎙 «${esc(heard)}»</div>` : ''}
    <div class="seg"><button type="button" data-kind="expense" class="${kind === 'expense' ? 'on' : ''}">هزینه</button><button type="button" data-kind="income" class="${kind === 'income' ? 'on' : ''}">درآمد</button><button type="button" data-kind="transfer" class="${kind === 'transfer' ? 'on' : ''}">انتقال</button></div>
    ${amountField('amount', v.amount)}
    <div class="two-col">
      <label>${kind === 'transfer' ? 'از حساب' : 'حساب'}<select name="account_id" required>${accountOptions(defAcc())}</select></label>
      ${kind === 'transfer'
        ? `<label>به حساب<select name="to_account_id" required>${accountOptions(v.to_account_id || S.accounts.find((a) => !a.archived && a.id !== defAcc())?.id)}</select></label>`
        : `<label>دسته<select name="category_id">${catOptions(kind, v.category_id)}</select></label>`}
    </div>
    ${dateField('tx_date', v.tx_date || todayIso())}
    <label>توضیحات<input name="note" maxlength="300" value="${esc(v.note || '')}" placeholder="اختیاری"></label>
    ${isNew ? `<label class="check"><input type="checkbox" name="repeat"> هر ماه تکرار شود (افزودن به تراکنش‌های تکراری)</label>` : ''}
    <div class="actions">${cancelBtn}<button class="btn primary">ذخیره</button></div>`;
  const keepValues = () => {
    const f = $('#modalForm');
    v.amount = parseAmount(f.amount.value) || v.amount; v.note = f.note.value; v.account_id = +f.account_id.value;
    const d = parseJ(f.tx_date.value); if (d) v.tx_date = d;
    if (f.category_id) v.category_id = +f.category_id.value || null;
  };
  openModal(html(), async (fd) => {
    const amount = parseAmount(fd.get('amount'));
    const date = parseJ(fd.get('tx_date'));
    if (!amount) { toast('مبلغ را وارد کنید.'); return false; }
    if (!date) { toast('تاریخ نامعتبر است (مثال: ۱۴۰۵/۰۸/۱۱).'); return false; }
    const row = { kind, amount, account_id: +fd.get('account_id'), tx_date: date, note: fd.get('note').trim() || null, to_account_id: null, category_id: null };
    if (kind === 'transfer') { row.to_account_id = +fd.get('to_account_id'); if (row.to_account_id === row.account_id) { toast('حساب مبدأ و مقصد یکی است.'); return false; } }
    else row.category_id = fd.get('category_id') ? +fd.get('category_id') : null;
    if (t) await S.db.update('transactions', t.id, row); else await S.db.insert('transactions', row);
    if (fd.get('repeat')) {
      const [y, m, d] = isoToJ(date); const [ny, nm] = addMonth(y, m, 1);
      await S.db.insert('recurring', { kind, amount, account_id: row.account_id, to_account_id: row.to_account_id, category_id: row.category_id, note: row.note,
        every_months: 1, day_of_month: d, next_date: jToIso(ny, nm, Math.min(d, monthLen(ny, nm))), active: true });
    }
    if (opts.onSaved) await opts.onSaved(row);
    store.set('lastAcc', row.account_id);
    toast('ذخیره شد ✓');
    render();
  });
  $('#modalForm').onclick = (e) => {
    const b = e.target.closest('[data-kind]');
    if (b) { keepValues(); kind = b.dataset.kind; if (v.category_id && S.categories.find((c) => c.id === v.category_id)?.kind !== kind) v.category_id = null; $('#modalForm').innerHTML = html(); return; }
    if (e.target.closest('#micBtn')) startVoice();
  };
  function startVoice() {
    if (!SR) { toast('مرورگر شما ثبت صوتی را پشتیبانی نمی‌کند؛ از Chrome یا Safari استفاده کنید.'); return; }
    const rec = new SR(); rec.lang = 'fa-IR'; rec.interimResults = false; rec.maxAlternatives = 1;
    const btn = $('#micBtn'); btn.classList.add('on');
    toast('بگویید… مثلاً «ناهار ۲۵۰ هزار تومان از کارت»');
    rec.onresult = (ev) => {
      heard = ev.results[0][0].transcript;
      const p = parseVoice(heard);
      kind = p.kind; Object.assign(v, { note: p.note, amount: p.amount || v.amount, category_id: p.category_id || null });
      if (p.account_id) v.account_id = p.account_id;
      if (p.to_account_id) v.to_account_id = p.to_account_id;
      $('#modalForm').innerHTML = html();
      if (!p.amount) toast('مبلغ را متوجه نشدم؛ لطفاً وارد کنید.');
    };
    rec.onerror = (ev) => toast(ev.error === 'not-allowed' ? 'اجازه دسترسی به میکروفون داده نشد.' : ev.error === 'network' ? 'تشخیص گفتار به اینترنت (سرویس گوگل) نیاز دارد.' : 'صدا تشخیص داده نشد؛ دوباره امتحان کنید.');
    rec.onend = () => $('#micBtn')?.classList.remove('on');
    try { rec.start(); } catch { btn.classList.remove('on'); }
  }
}

// ---------------------------------------------------------------- recurring transactions
function recModal(r = null) {
  if (!S.accounts.filter((a) => !a.archived).length) { toast('ابتدا یک حساب بسازید.'); return; }
  let kind = r?.kind || 'expense';
  const v = { ...(r || {}) };
  const html = () => `
    <h3>${r ? 'ویرایش تراکنش تکراری' : 'تراکنش تکراری جدید'}</h3>
    <div class="seg"><button type="button" data-kind="expense" class="${kind === 'expense' ? 'on' : ''}">هزینه</button><button type="button" data-kind="income" class="${kind === 'income' ? 'on' : ''}">درآمد</button><button type="button" data-kind="transfer" class="${kind === 'transfer' ? 'on' : ''}">انتقال</button></div>
    <label>عنوان<input name="note" maxlength="300" value="${esc(v.note || '')}" placeholder="مثلاً اجاره خانه، حقوق شرکت" required></label>
    ${amountField('amount', v.amount, 'مبلغ (حدودی؛ موقع ثبت قابل تغییر است)')}
    <div class="two-col">
      <label>${kind === 'transfer' ? 'از حساب' : 'حساب'}<select name="account_id">${accountOptions(v.account_id || S.accounts.find((a) => !a.archived)?.id)}</select></label>
      ${kind === 'transfer' ? `<label>به حساب<select name="to_account_id">${accountOptions(v.to_account_id)}</select></label>` : `<label>دسته<select name="category_id">${catOptions(kind, v.category_id)}</select></label>`}
    </div>
    <div class="two-col">
      <label>تکرار<select name="every">${Object.entries(EVERY_LABEL).map(([k, l]) => `<option value="${k}" ${(v.every_months || 1) == k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>&nbsp;<span class="small muted">روز ماه از «سررسید بعدی» گرفته می‌شود.</span></label>
    </div>
    ${dateField('next', v.next_date || todayIso(), 'سررسید بعدی')}
    ${r ? `<label class="check"><input type="checkbox" name="active" ${r.active ? 'checked' : ''}> فعال</label>` : ''}
    <div class="actions">${cancelBtn}<button class="btn primary">ذخیره</button></div>`;
  openModal(html(), async (fd) => {
    const amount = parseAmount(fd.get('amount')), next = parseJ(fd.get('next'));
    if (!amount || !next) { toast('مبلغ و تاریخ را درست وارد کنید.'); return false; }
    const row = { kind, amount, note: fd.get('note').trim(), account_id: +fd.get('account_id'), every_months: +fd.get('every'), next_date: next, day_of_month: isoToJ(next)[2],
      to_account_id: kind === 'transfer' ? +fd.get('to_account_id') : null, category_id: kind !== 'transfer' && fd.get('category_id') ? +fd.get('category_id') : null };
    if (row.to_account_id && row.to_account_id === row.account_id) { toast('حساب مبدأ و مقصد یکی است.'); return false; }
    if (r) { row.active = !!fd.get('active'); await S.db.update('recurring', r.id, row); } else await S.db.insert('recurring', { ...row, active: true });
    toast('ذخیره شد ✓'); render();
  });
  $('#modalForm').onclick = (e) => {
    const b = e.target.closest('[data-kind]'); if (!b) return;
    const f = $('#modalForm'); v.note = f.note.value; v.amount = parseAmount(f.amount.value); v.account_id = +f.account_id.value; const d = parseJ(f.next.value); if (d) v.next_date = d;
    v.every_months = +f.every.value; kind = b.dataset.kind; v.category_id = null; f.innerHTML = html();
  };
}
async function doRecurring(id) {
  const [r] = await S.db.list('recurring', { eq: { id } });
  txModal(null, {
    title: 'ثبت تراکنش تکراری',
    prefill: { kind: r.kind, amount: r.amount, account_id: r.account_id, to_account_id: r.to_account_id, category_id: r.category_id, note: r.note, tx_date: r.next_date <= todayIso() ? r.next_date : todayIso() },
    onSaved: async () => { await S.db.update('recurring', r.id, { next_date: nextRecDate(r) }); },
  });
}
async function skipRecurring(id) {
  const [r] = await S.db.list('recurring', { eq: { id } });
  if (await confirmBox(`ثبت «${r.note || 'این مورد'}» برای ${fmtJ(r.next_date)} رد شود و به دوره بعد برود؟`, 'بله، رد شود')) {
    await S.db.update('recurring', id, { next_date: nextRecDate(r) }); render();
  }
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
  <div class="grid g3 mb">
    <div class="card stat"><div class="label">مانده بدهی‌های من</div><div class="value exp">${fmt(owe)}</div></div>
    <div class="card stat"><div class="label">مانده طلب‌های من</div><div class="value inc">${fmt(owed)}</div></div>
    <div class="card stat" style="display:flex;align-items:center;justify-content:center"><button class="btn primary" data-act="newdebt">+ بدهی / طلب / وام جدید</button></div>
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
      <label style="margin-bottom:10px">تم برنامه<select data-pref="theme">${Object.entries(THEME_LABEL).map(([k, l]) => `<option value="${k}" ${prefs.theme === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
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
      <div class="row"><button class="btn" data-act="csv">خروجی Excel (CSV) تراکنش‌ها</button><button class="btn" data-act="json">پشتیبان کامل (JSON)</button><button class="btn" data-act="restore">بازیابی از پشتیبان</button></div>
      <input type="file" id="restoreFile" accept=".json,application/json" hidden>
      <p class="small muted">بازیابی، همه اطلاعات فعلی را با محتوای فایل پشتیبان جایگزین می‌کند.</p>
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
const TABLES = ['accounts', 'categories', 'transactions', 'debts', 'installments', 'recurring', 'cheques'];
async function exportJson(prefix = 'hesab-backup') {
  const out = { app: 'hesab-shakhsi', version: 1, exported_at: new Date().toISOString() };
  for (const t of TABLES) out[t] = await S.db.list(t, { order: 'id' }).catch(() => []);
  const stamp = fmtJin(todayIso()).replace(/\//g, '-') + '_' + new Date().toTimeString().slice(0, 5).replace(':', '');
  download(`${prefix}-${stamp}.json`, JSON.stringify(out, null, 2), 'application/json');
}

// ---------- restore from JSON backup ----------
function validateBackup(b) {
  if (!b || typeof b !== 'object') throw new Error('فایل پشتیبان معتبر نیست.');
  b.recurring = Array.isArray(b.recurring) ? b.recurring : []; b.cheques = Array.isArray(b.cheques) ? b.cheques : [];   // پشتیبان‌های قدیمی
  for (const t of TABLES) if (!Array.isArray(b[t])) throw new Error(`فایل پشتیبان ناقص است (${t}).`);
  const ids = (t) => new Set(b[t].map((r) => r.id));
  const acc = ids('accounts'), cat = ids('categories'), debt = ids('debts'), inst = ids('installments');
  const okAmt = (v) => Number.isFinite(Number(v)) && Number(v) >= 0;
  for (const a of b.accounts) if (!a.name || !Number.isFinite(Number(a.opening_balance ?? 0))) throw new Error('حساب نامعتبر در فایل.');
  for (const c of b.categories) if (!c.name || !['income', 'expense'].includes(c.kind)) throw new Error('دسته نامعتبر در فایل.');
  for (const d of b.debts) if (!d.person || !['borrow', 'lend'].includes(d.direction) || !okAmt(d.total_amount)) throw new Error('بدهی/طلب نامعتبر در فایل.');
  for (const i of b.installments) if (!debt.has(i.debt_id) || !okAmt(i.amount) || !i.due_date) throw new Error('قسط نامعتبر در فایل.');
  for (const t of b.transactions) {
    if (!['income', 'expense', 'transfer'].includes(t.kind) || !okAmt(t.amount) || !t.tx_date || !acc.has(t.account_id)) throw new Error('تراکنش نامعتبر در فایل.');
    if (t.kind === 'transfer' && !acc.has(t.to_account_id)) throw new Error('انتقال نامعتبر در فایل.');
    if (t.category_id != null && !cat.has(t.category_id)) t.category_id = null;
    if (t.installment_id != null && !inst.has(t.installment_id)) t.installment_id = null;
  }
  b.recurring = b.recurring.filter((r) => acc.has(r.account_id) && okAmt(r.amount) && r.next_date && (r.kind !== 'transfer' || acc.has(r.to_account_id)));
  b.cheques = b.cheques.filter((c) => c.person && ['received', 'issued'].includes(c.direction) && okAmt(c.amount) && c.due_date);
}
async function insertChunks(table, rows) {
  const out = [];
  for (let i = 0; i < rows.length; i += 500) out.push(...(await S.db.insertMany(table, rows.slice(i, i + 500))));
  return out;
}
async function restoreBackup(file) {
  let b;
  try { b = JSON.parse(await file.text()); validateBackup(b); }
  catch (e) { toast(e instanceof SyntaxError ? 'فایل JSON قابل خواندن نیست.' : e.message); return; }
  const when = b.exported_at ? fmtJ(b.exported_at.slice(0, 10)) : 'نامشخص';
  const ok = await confirmBox(`پشتیبان تاریخ ${when} شامل ${faNum(b.accounts.length)} حساب، ${faNum(b.transactions.length)} تراکنش و ${faNum(b.debts.length)} بدهی/طلب است. همه اطلاعات فعلی پاک و این پشتیبان جایگزین می‌شود. قبل از شروع، یک نسخه از اطلاعات فعلی هم دانلود می‌شود. ادامه می‌دهید؟`, 'بله، بازیابی کن');
  if (!ok) return;
  const v = $('#view'); v.innerHTML = '<p class="empty">در حال بازیابی… لطفاً صفحه را نبندید.</p>';
  try {
    await exportJson('hesab-before-restore');           // safety copy of current data
    for (const t of ['cheques', 'recurring']) await S.db.removeAll(t).catch(() => {});
    for (const t of ['transactions', 'installments', 'debts', 'categories', 'accounts']) await S.db.removeAll(t);
    // one-by-one so each old id maps to its new id reliably
    const insertMap = async (table, oldRows, newRows) => { const m = {}; for (let i = 0; i < oldRows.length; i++) m[oldRows[i].id] = (await S.db.insert(table, newRows[i])).id; return m; };
    const A = (await insertMap('accounts', b.accounts, b.accounts.map((a) => ({ name: a.name, kind: a.kind || 'other', opening_balance: Number(a.opening_balance) || 0, archived: !!a.archived }))));
    const C = (await insertMap('categories', b.categories, b.categories.map((c) => ({ name: c.name, kind: c.kind, color: c.color || '#64748b' }))));
    const D = (await insertMap('debts', b.debts, b.debts.map((d) => ({ person: d.person, direction: d.direction, total_amount: Number(d.total_amount), start_date: d.start_date, note: d.note ?? null, settled: !!d.settled }))));
    const I = (await insertMap('installments', b.installments, b.installments.map((i) => ({ debt_id: D[i.debt_id], due_date: i.due_date, amount: Number(i.amount), paid: !!i.paid, paid_date: i.paid_date ?? null }))));
    const txOld = b.transactions;
    const txNew = await insertChunks('transactions', txOld.map((t) => ({
      kind: t.kind, amount: Number(t.amount), account_id: A[t.account_id], to_account_id: t.kind === 'transfer' ? A[t.to_account_id] : null,
      category_id: t.category_id != null ? C[t.category_id] : null, installment_id: t.installment_id != null ? I[t.installment_id] : null,
      tx_date: t.tx_date, note: t.note ?? null,
    })));
    const TX = Object.fromEntries(txOld.map((t, i) => [t.id, txNew[i]?.id]));
    if (b.recurring.length) await insertChunks('recurring', b.recurring.map((r) => ({ kind: r.kind, amount: Number(r.amount), account_id: A[r.account_id], to_account_id: r.to_account_id != null ? A[r.to_account_id] : null,
      category_id: r.category_id != null ? C[r.category_id] ?? null : null, note: r.note ?? null, every_months: r.every_months || 1, day_of_month: r.day_of_month || isoToJ(r.next_date)[2], next_date: r.next_date, active: r.active !== false })));
    if (b.cheques.length) await insertChunks('cheques', b.cheques.map((c) => ({ direction: c.direction, person: c.person, amount: Number(c.amount), due_date: c.due_date, serial: c.serial ?? null, bank: c.bank ?? null,
      account_id: c.account_id != null ? A[c.account_id] ?? null : null, status: c.status || 'pending', cleared_date: c.cleared_date ?? null, tx_id: c.tx_id != null ? TX[c.tx_id] ?? null : null, note: c.note ?? null })));
    await loadRefs();
    toast('بازیابی با موفقیت انجام شد ✓');
  } catch (e) {
    toast('بازیابی کامل نشد: ' + errMsg(e) + ' — فایل «hesab-before-restore» دانلود شده است.');
  }
  render();
}

// ---------------------------------------------------------------- view event delegation
$('#view').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const id = Number(b.dataset.id);
  try {
    switch (b.dataset.act) {
      case 'mprev': S.month = addMonth(...S.month, -1); return render();
      case 'mnext': S.month = addMonth(...S.month, 1); return render();
      case 'yprev': S.year--; return render();
      case 'ynext': S.year++; return render();
      case 'yearcsv': return exportYearCsv();
      case 'sub': S.sub = b.dataset.id; return render();
      case 'newrec': return recModal();
      case 'editrec': return recModal((await S.db.list('recurring', { eq: { id } }))[0]);
      case 'delrec': if (await confirmBox('این تراکنش تکراری حذف شود؟ (تراکنش‌های ثبت‌شده باقی می‌مانند)')) { await S.db.remove('recurring', id); render(); } return;
      case 'dorec': return doRecurring(id);
      case 'skiprec': return skipRecurring(id);
      case 'newchq': return chqModal();
      case 'editchq': return chqModal((await S.db.list('cheques', { eq: { id } }))[0]);
      case 'delchq': if (await confirmBox('این چک حذف شود؟ (اگر تراکنشی برایش ثبت شده، باقی می‌ماند)')) { await S.db.remove('cheques', id); render(); } return;
      case 'clearchq': return clearChqModal(id);
      case 'bouncechq': return setChqStatus(id, 'bounced');
      case 'reopenchq': return setChqStatus(id, 'pending');
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
      case 'restore': return $('#restoreFile').click();
    }
  } catch (err) { toast(errMsg(err)); }
});
$('#view').addEventListener('toggle', (e) => { if (e.target.id === 'recBox') store.set('recOpen', e.target.open); }, true);
let qTimer;
$('#view').addEventListener('input', (e) => {
  const f = e.target.dataset.filter; if (!f) return;
  S.filters[f] = e.target.value;
  if (f === 'q') { clearTimeout(qTimer); qTimer = setTimeout(async () => { const pos = e.target.selectionStart; await render(); const i = $('[data-filter=q]'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } }, 300); }
  else render();
});
$('#view').addEventListener('change', (e) => {
  if (e.target.id === 'restoreFile') { const f = e.target.files[0]; e.target.value = ''; if (f) restoreBackup(f); return; }
  const p = e.target.dataset.pref; if (!p) return;
  prefs[p] = p === 'lockMin' ? Number(e.target.value) : e.target.value;
  store.set(p, prefs[p]); toast('ذخیره شد ✓');
  if (p === 'theme') applyTheme();
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
