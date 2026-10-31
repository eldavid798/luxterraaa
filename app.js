/* ══════════════════════════════════════════
   LUXTERRA PRESUPUESTOS — app.js
   Versión 2.0 — Materiales + Etapas separados
══════════════════════════════════════════ */
'use strict';

const DB_KEY = 'luxPresup_v2';
let db = loadDB();
let currentBudgetId = null;
let currentMats     = [];   // [{id, name, store, qty, unit, price}]
let currentEtapas   = [];   // [{id, name, activities, days, cost}]

/* ══════════════════════════════════════════
   PERSISTENCIA
══════════════════════════════════════════ */
function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return {
    budgets: [],
    clients: [],
    settings: {
      company: '', slogan: '', rep: '',
      phone: '', phone2: '', email: '',
      city: '', instagram: '',
      currency: 'MXN', logo: ''
    }
  };
}

function saveDB() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch(e) {
    showToast('Error al guardar. Memoria llena.');
  }
}

/* ══════════════════════════════════════════
   UTILIDADES
══════════════════════════════════════════ */
function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function fmt(n) {
  const sym = db.settings.currency === 'USD' ? 'USD ' : '$';
  return sym + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function showToast(msg, duration = 2400) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  t.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.classList.add('hidden'), 300);
  }, duration);
}

function totalMats(mats) {
  return (mats || []).reduce((s, m) => s + (m.qty * m.price), 0);
}

function totalEtapas(etapas) {
  return (etapas || []).reduce((s, e) => s + (Number(e.cost) || 0), 0);
}

/* ══════════════════════════════════════════
   NAVEGACIÓN
══════════════════════════════════════════ */
let activeScreen = 'screen-home';

function openScreen(id) {
  const prev = document.getElementById(activeScreen);
  const next = document.getElementById(id);
  if (!next || id === activeScreen) return;
  prev.classList.remove('active');
  next.classList.add('active');
  activeScreen = id;
  switch(id) {
    case 'screen-home':     renderHome();    break;
    case 'screen-budgets':  renderBudgets(); break;
    case 'screen-clients':  renderClients(); break;
    case 'screen-settings': loadSettings();  break;
  }
}

/* ══════════════════════════════════════════
   HOME
══════════════════════════════════════════ */
function renderHome() {
  // Nombre empresa en topbar
  const name = db.settings.company || 'Presupuestos';
  document.getElementById('topbar-name').textContent = name;
  // Logo topbar
  const topLogo = document.getElementById('topbar-logo');
  if (db.settings.logo) {
    topLogo.src = db.settings.logo;
    topLogo.classList.remove('hidden');
  } else {
    topLogo.classList.add('hidden');
  }
  // Stat semanal
  const week = Date.now() - 7 * 86400000;
  const active = db.budgets.filter(b => new Date(b.date).getTime() > week).length;
  document.getElementById('stat-active').textContent = active;
  // Lista reciente
  const list = document.getElementById('budget-list-home');
  const recent = [...db.budgets].sort((a,b) => b.updatedAt - a.updatedAt).slice(0, 4);
  list.innerHTML = recent.length ? recent.map(budgetCard).join('') : `
    <div class="empty-state">
      <div class="empty-icon">🏗️</div>
      <p>Sin presupuestos aún.<br>Crea el primero arriba.</p>
    </div>`;
}

/* ══════════════════════════════════════════
   PRESUPUESTOS — LISTA
══════════════════════════════════════════ */
function renderBudgets() {
  const list = document.getElementById('budget-list-all');
  const sorted = [...db.budgets].sort((a,b) => b.updatedAt - a.updatedAt);
  list.innerHTML = sorted.length ? sorted.map(budgetCard).join('') : `
    <div class="empty-state">
      <div class="empty-icon">📋</div>
      <p>No hay presupuestos.<br>Toca + para crear uno.</p>
    </div>`;
}

function budgetCard(b) {
  const total = totalMats(b.mats) + totalEtapas(b.etapas);
  return `
  <div class="budget-card">
    <div class="budget-badge">🏠</div>
    <div class="budget-info" onclick="editBudget('${b.id}')">
      <div class="budget-name">${b.name || 'Sin nombre'}${b.variant ? ' — ' + b.variant : ''}</div>
      <div class="budget-meta">${b.client || 'Sin cliente'} · ${b.date || ''}</div>
    </div>
    <div class="budget-total">${fmt(total)}</div>
    <div class="budget-actions">
      <button class="card-action-btn" onclick="duplicateBudget('${b.id}')" title="Duplicar">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>
      <button class="card-action-btn danger" onclick="deleteBudget('${b.id}')" title="Eliminar">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3,6 5,6 21,6"/><path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1v2"/></svg>
      </button>
    </div>
  </div>`;
}

function filterBudgets() {
  const q = document.getElementById('budget-search').value.toLowerCase();
  const list = document.getElementById('budget-list-all');
  const matches = db.budgets
    .filter(b => (b.name||'').toLowerCase().includes(q) || (b.client||'').toLowerCase().includes(q))
    .sort((a,b) => b.updatedAt - a.updatedAt);
  list.innerHTML = matches.map(budgetCard).join('') ||
    '<p style="padding:20px;color:var(--mid);text-align:center">Sin resultados</p>';
}

function deleteBudget(id) {
  if (!confirm('¿Eliminar este presupuesto?')) return;
  db.budgets = db.budgets.filter(b => b.id !== id);
  saveDB();
  renderBudgets();
  showToast('Presupuesto eliminado');
}

function duplicateBudget(id) {
  const b = db.budgets.find(x => x.id === id);
  if (!b) return;
  const copy = JSON.parse(JSON.stringify(b));
  copy.id = uid();
  copy.name = b.name + ' (copia)';
  copy.updatedAt = Date.now();
  copy.date = today();
  db.budgets.unshift(copy);
  saveDB();
  renderBudgets();
  showToast('✅ Presupuesto duplicado');
}

/* ══════════════════════════════════════════
   NUEVO / EDITAR PRESUPUESTO
══════════════════════════════════════════ */
function newBudget() {
  currentBudgetId = null;
  currentMats     = [];
  currentEtapas   = [];
  document.getElementById('edit-title').textContent    = 'Nuevo Presupuesto';
  document.getElementById('f-name').value    = '';
  document.getElementById('f-variant').value = '';
  document.getElementById('f-client').value  = '';
  document.getElementById('f-phone').value   = '';
  document.getElementById('f-email').value   = '';
  document.getElementById('f-date').value    = today();
  document.getElementById('f-folio').value   = generateFolio();
  document.getElementById('f-notes').value   = '';
  renderMats();
  renderEtapas();
  recalcTotals();
  openScreen('screen-budget-edit');
}

function editBudget(id) {
  const b = db.budgets.find(x => x.id === id);
  if (!b) return;
  currentBudgetId = id;
  currentMats     = JSON.parse(JSON.stringify(b.mats   || []));
  currentEtapas   = JSON.parse(JSON.stringify(b.etapas || []));
  document.getElementById('edit-title').textContent    = 'Editar Presupuesto';
  document.getElementById('f-name').value    = b.name    || '';
  document.getElementById('f-variant').value = b.variant || '';
  document.getElementById('f-client').value  = b.client  || '';
  document.getElementById('f-phone').value   = b.phone   || '';
  document.getElementById('f-email').value   = b.email   || '';
  document.getElementById('f-date').value    = b.date    || today();
  document.getElementById('f-folio').value   = b.folio   || '';
  document.getElementById('f-notes').value   = b.notes   || '';
  renderMats();
  renderEtapas();
  recalcTotals();
  openScreen('screen-budget-edit');
}

function cancelBudgetEdit() {
  openScreen('screen-budgets');
}

function saveBudget() {
  const name = document.getElementById('f-name').value.trim();
  if (!name) { showToast('Escribe el nombre de la obra'); return; }
  const b = {
    id:         currentBudgetId || uid(),
    name,
    variant:    document.getElementById('f-variant').value.trim(),
    client:     document.getElementById('f-client').value.trim(),
    phone:      document.getElementById('f-phone').value.trim(),
    email:      document.getElementById('f-email').value.trim(),
    date:       document.getElementById('f-date').value || today(),
    folio:      document.getElementById('f-folio').value.trim(),
    notes:      document.getElementById('f-notes').value.trim(),
    mats:       currentMats,
    etapas:     currentEtapas,
    updatedAt:  Date.now(),
  };
  if (currentBudgetId) {
    const idx = db.budgets.findIndex(x => x.id === currentBudgetId);
    if (idx >= 0) db.budgets[idx] = b;
  } else {
    db.budgets.unshift(b);
  }
  saveDB();
  showToast('✅ Presupuesto guardado');
  openScreen('screen-home');
  renderHome();
}

function generateFolio() {
  const n = (db.budgets.length + 1).toString().padStart(3, '0');
  const prefix = (db.settings.company || 'LUX').slice(0,3).toUpperCase();
  return `${prefix}-${n}`;
}

/* ── MATERIALES ── */
function renderMats() {
  const cont = document.getElementById('mat-container');
  if (!currentMats.length) { cont.innerHTML = ''; recalcTotals(); return; }
  cont.innerHTML = currentMats.map((m, i) => {
    const total = m.qty * m.price;
    return `
    <div class="mat-row">
      <div class="mat-row-main" onclick="openMatForm(${i})">
        <div class="mat-row-name">${m.name}</div>
        <div class="mat-row-meta">${m.store ? m.store + ' · ' : ''}${m.qty} ${m.unit} × ${fmt(m.price)}</div>
      </div>
      <div class="mat-row-total">${fmt(total)}</div>
      <button class="item-delete" onclick="removeMat(${i})">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3,6 5,6 21,6"/><path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1v2"/></svg>
      </button>
    </div>`;
  }).join('');
  recalcTotals();
}

function removeMat(i) {
  currentMats.splice(i, 1);
  renderMats();
}

function openMatForm(idx) {
  const m = idx !== null ? currentMats[idx] : null;
  document.getElementById('mat-form-title').textContent = m ? 'Editar Material' : 'Agregar Material';
  document.getElementById('mf-id').value    = idx !== null ? idx : '';
  document.getElementById('mf-name').value  = m?.name  || '';
  document.getElementById('mf-store').value = m?.store || '';
  document.getElementById('mf-qty').value   = m?.qty   || '';
  document.getElementById('mf-unit').value  = m?.unit  || 'pza';
  document.getElementById('mf-price').value = m?.price || '';
  document.getElementById('modal-mat-form').classList.remove('hidden');
}

function saveMat() {
  const name  = document.getElementById('mf-name').value.trim();
  const qty   = parseFloat(document.getElementById('mf-qty').value);
  const price = parseFloat(document.getElementById('mf-price').value);
  if (!name)         { showToast('Escribe el nombre del material'); return; }
  if (!qty || qty<=0){ showToast('Ingresa una cantidad válida'); return; }
  const mat = {
    id:    uid(),
    name,
    store: document.getElementById('mf-store').value.trim(),
    qty,
    unit:  document.getElementById('mf-unit').value,
    price: price || 0,
  };
  const idxVal = document.getElementById('mf-id').value;
  if (idxVal !== '') {
    currentMats[parseInt(idxVal)] = mat;
  } else {
    currentMats.push(mat);
  }
  document.getElementById('modal-mat-form').classList.add('hidden');
  renderMats();
}

/* ── ETAPAS ── */
function renderEtapas() {
  const cont = document.getElementById('etapa-container');
  if (!currentEtapas.length) { cont.innerHTML = ''; recalcTotals(); return; }
  cont.innerHTML = currentEtapas.map((e, i) => `
    <div class="etapa-row">
      <div class="etapa-row-main" onclick="openEtapaForm(${i})">
        <div class="etapa-row-name">${e.name}</div>
        <div class="etapa-row-meta">${e.days ? e.days + ' · ' : ''}${e.activities ? e.activities.split('\n').filter(Boolean).length + ' actividades' : ''}</div>
      </div>
      <div class="etapa-row-cost">${fmt(e.cost)}</div>
      <button class="item-delete" onclick="removeEtapa(${i})">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3,6 5,6 21,6"/><path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1v2"/></svg>
      </button>
    </div>`).join('');
  recalcTotals();
}

function removeEtapa(i) {
  currentEtapas.splice(i, 1);
  renderEtapas();
}

function openEtapaForm(idx) {
  const e = idx !== null ? currentEtapas[idx] : null;
  document.getElementById('etapa-form-title').textContent = e ? 'Editar Etapa' : 'Agregar Etapa';
  document.getElementById('ef-id').value         = idx !== null ? idx : '';
  document.getElementById('ef-name').value       = e?.name       || '';
  document.getElementById('ef-activities').value = e?.activities || '';
  document.getElementById('ef-days').value       = e?.days       || '';
  document.getElementById('ef-cost').value       = e?.cost       || '';
  document.getElementById('modal-etapa-form').classList.remove('hidden');
}

function saveEtapa() {
  const name = document.getElementById('ef-name').value.trim();
  if (!name) { showToast('Escribe el nombre de la etapa'); return; }
  const etapa = {
    id:         uid(),
    name,
    activities: document.getElementById('ef-activities').value.trim(),
    days:       document.getElementById('ef-days').value.trim(),
    cost:       parseFloat(document.getElementById('ef-cost').value) || 0,
  };
  const idxVal = document.getElementById('ef-id').value;
  if (idxVal !== '') {
    currentEtapas[parseInt(idxVal)] = etapa;
  } else {
    currentEtapas.push(etapa);
  }
  document.getElementById('modal-etapa-form').classList.add('hidden');
  renderEtapas();
}

/* ── TOTALES ── */
function recalcTotals() {
  const matTotal   = totalMats(currentMats);
  const laborTotal = totalEtapas(currentEtapas);
  const total      = matTotal + laborTotal;
  document.getElementById('t-mat-subtotal').textContent   = fmt(matTotal);
  document.getElementById('t-labor-subtotal').textContent = fmt(laborTotal);
  document.getElementById('t-materials').textContent      = fmt(matTotal);
  document.getElementById('t-labor').textContent          = fmt(laborTotal);
  document.getElementById('t-total').textContent          = fmt(total);
}

/* ══════════════════════════════════════════
   CLIENTES
══════════════════════════════════════════ */
function renderClients() {
  const list = document.getElementById('client-list');
  if (!db.clients.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">👷</div><p>Sin clientes aún.<br>Toca + para agregar.</p></div>`;
    return;
  }
  list.innerHTML = db.clients.map(cl => `
    <div class="client-card" onclick="openClientForm('${cl.id}')">
      <div class="client-avatar">${(cl.name||'?')[0].toUpperCase()}</div>
      <div class="client-info">
        <div class="client-name">${cl.name}</div>
        <div class="client-meta">${cl.phone || ''}${cl.email ? ' · '+cl.email : ''}</div>
      </div>
      <svg class="client-edit" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,18 15,12 9,6"/></svg>
    </div>`).join('');
}

function openClientForm(id) {
  const cl = id ? db.clients.find(x => x.id === id) : null;
  document.getElementById('client-form-title').textContent = cl ? 'Editar Cliente' : 'Nuevo Cliente';
  document.getElementById('clif-id').value    = cl?.id    || '';
  document.getElementById('clif-name').value  = cl?.name  || '';
  document.getElementById('clif-phone').value = cl?.phone || '';
  document.getElementById('clif-email').value = cl?.email || '';
  document.getElementById('clif-addr').value  = cl?.addr  || '';
  document.getElementById('modal-client-form').classList.remove('hidden');
}

function saveClient() {
  const name = document.getElementById('clif-name').value.trim();
  if (!name) { showToast('Escribe el nombre del cliente'); return; }
  const existingId = document.getElementById('clif-id').value;
  const cl = {
    id:    existingId || uid(),
    name,
    phone: document.getElementById('clif-phone').value.trim(),
    email: document.getElementById('clif-email').value.trim(),
    addr:  document.getElementById('clif-addr').value.trim(),
  };
  if (existingId) {
    const idx = db.clients.findIndex(x => x.id === existingId);
    if (idx >= 0) db.clients[idx] = cl;
  } else {
    db.clients.push(cl);
  }
  saveDB();
  document.getElementById('modal-client-form').classList.add('hidden');
  renderClients();
  showToast('✅ Cliente guardado');
}

/* Modal picker de cliente desde presupuesto */
function openClientPicker() {
  if (!db.clients.length) {
    showToast('Agrega clientes en la sección Clientes');
    return;
  }
  const list = document.getElementById('client-picker-list');
  list.innerHTML = db.clients.map(cl => `
    <div class="picker-client-row" onclick="pickClient('${cl.id}')">
      <div class="client-avatar small">${(cl.name||'?')[0].toUpperCase()}</div>
      <div>
        <div class="picker-client-name">${cl.name}</div>
        <div class="picker-client-meta">${cl.phone || ''}${cl.email ? ' · '+cl.email : ''}</div>
      </div>
    </div>`).join('');
  document.getElementById('modal-client-picker').classList.remove('hidden');
}

function pickClient(id) {
  const cl = db.clients.find(x => x.id === id);
  if (!cl) return;
  document.getElementById('f-client').value = cl.name;
  document.getElementById('f-phone').value  = cl.phone || '';
  document.getElementById('f-email').value  = cl.email || '';
  document.getElementById('modal-client-picker').classList.add('hidden');
}

/* ══════════════════════════════════════════
   CONFIGURACIÓN
══════════════════════════════════════════ */
function loadSettings() {
  const s = db.settings;
  document.getElementById('s-company').value   = s.company   || '';
  document.getElementById('s-slogan').value    = s.slogan    || '';
  document.getElementById('s-rep').value       = s.rep       || '';
  document.getElementById('s-phone').value     = s.phone     || '';
  document.getElementById('s-phone2').value    = s.phone2    || '';
  document.getElementById('s-email').value     = s.email     || '';
  document.getElementById('s-city').value      = s.city      || '';
  document.getElementById('s-instagram').value = s.instagram || '';
  document.getElementById('s-currency').value  = s.currency  || 'MXN';
  if (s.logo) {
    document.getElementById('logo-preview').src = s.logo;
    document.getElementById('logo-preview').classList.remove('hidden');
    document.getElementById('logo-placeholder').style.display = 'none';
    document.getElementById('logo-remove-btn').style.display  = 'inline-flex';
  }
}

function saveSettings() {
  db.settings = {
    ...db.settings,
    company:   document.getElementById('s-company').value.trim(),
    slogan:    document.getElementById('s-slogan').value.trim(),
    rep:       document.getElementById('s-rep').value.trim(),
    phone:     document.getElementById('s-phone').value.trim(),
    phone2:    document.getElementById('s-phone2').value.trim(),
    email:     document.getElementById('s-email').value.trim(),
    city:      document.getElementById('s-city').value.trim(),
    instagram: document.getElementById('s-instagram').value.trim(),
    currency:  document.getElementById('s-currency').value,
  };
  saveDB();
  showToast('✅ Configuración guardada');
  renderHome();
}

function handleLogoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 500000) { showToast('El logo debe pesar menos de 500 KB'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    db.settings.logo = e.target.result;
    saveDB();
    document.getElementById('logo-preview').src = e.target.result;
    document.getElementById('logo-preview').classList.remove('hidden');
    document.getElementById('logo-placeholder').style.display = 'none';
    document.getElementById('logo-remove-btn').style.display  = 'inline-flex';
    renderHome();
    showToast('✅ Logo guardado');
  };
  reader.readAsDataURL(file);
}

function removeLogo() {
  db.settings.logo = '';
  saveDB();
  document.getElementById('logo-preview').classList.add('hidden');
  document.getElementById('logo-placeholder').style.display = 'block';
  document.getElementById('logo-remove-btn').style.display  = 'none';
  renderHome();
  showToast('Logo eliminado');
}

function resetData() {
  if (!confirm('¿Seguro? Se borrarán TODOS los presupuestos, clientes y configuración.')) return;
  localStorage.removeItem(DB_KEY);
  db = loadDB();
  showToast('Datos borrados');
  openScreen('screen-home');
  renderHome();
}

/* ══════════════════════════════════════════
   RESPALDO
══════════════════════════════════════════ */
function exportData() {
  const payload = JSON.stringify(db, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `luxterra_respaldo_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('✅ Respaldo descargado');
}

function importData() {
  const input  = document.createElement('input');
  input.type   = 'file';
  input.accept = '.json,application/json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!parsed.budgets) { showToast('❌ Archivo inválido'); return; }
        if (!confirm(`¿Restaurar? Se reemplazarán ${parsed.budgets.length} presupuesto(s).`)) return;
        db = parsed;
        saveDB();
        showToast('✅ Datos restaurados');
        renderHome();
      } catch(err) { showToast('❌ No se pudo leer el archivo'); }
    };
    reader.readAsText(file);
  };
  document.body.appendChild(input);
  input.click();
  document.body.removeChild(input);
}

/* ══════════════════════════════════════════
   CERRAR MODALES
══════════════════════════════════════════ */
function closeModal(id, event) {
  if (!event || event.target.classList.contains('modal-overlay')) {
    document.getElementById(id).classList.add('hidden');
  }
}

/* ══════════════════════════════════════════
   WHATSAPP
══════════════════════════════════════════ */
function shareWhatsApp() {
  const name    = document.getElementById('f-name').value    || 'Presupuesto';
  const variant = document.getElementById('f-variant').value || '';
  const client  = document.getElementById('f-client').value  || '';
  const phone   = document.getElementById('f-phone').value   || '';
  const date    = document.getElementById('f-date').value    || today();
  const folio   = document.getElementById('f-folio').value   || '';
  const notes   = document.getElementById('f-notes').value   || '';
  const s       = db.settings;

  const matTotal   = totalMats(currentMats);
  const laborTotal = totalEtapas(currentEtapas);
  const total      = matTotal + laborTotal;

  let msg = `*${s.company || 'PRESUPUESTO'}*\n`;
  if (s.slogan) msg += `_${s.slogan}_\n`;
  msg += `\n📋 *${name}*${variant ? ' — ' + variant : ''}\n`;
  if (folio)  msg += `Folio: ${folio}\n`;
  if (client) msg += `👤 Cliente: ${client}\n`;
  msg += `📅 Fecha: ${date}\n\n`;

  if (currentMats.length) {
    msg += `*MATERIALES:*\n`;
    currentMats.forEach(m => {
      msg += `• ${m.name}${m.store ? ' ('+m.store+')' : ''} — ${m.qty} ${m.unit} × ${fmt(m.price)} = *${fmt(m.qty*m.price)}*\n`;
    });
    msg += `Subtotal materiales: *${fmt(matTotal)}*\n\n`;
  }

  if (currentEtapas.length) {
    msg += `*MANO DE OBRA:*\n`;
    currentEtapas.forEach(e => {
      msg += `• ${e.name}${e.days ? ' ('+e.days+')' : ''} — *${fmt(e.cost)}*\n`;
    });
    msg += `Subtotal mano de obra: *${fmt(laborTotal)}*\n\n`;
  }

  msg += `─────────────────\n`;
  msg += `*TOTAL: ${fmt(total)}*\n`;

  if (notes) msg += `\n📝 ${notes}\n`;
  if (s.city)  msg += `\n📍 ${s.city}`;
  if (s.phone) msg += ` | ☎️ ${s.phone}`;

  const encoded = encodeURIComponent(msg);
  const url = phone
    ? `https://wa.me/52${phone.replace(/\D/g,'')}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
  window.open(url, '_blank');
}

/* ══════════════════════════════════════════
   GENERACIÓN DE PDF — fiel al estilo Luxterra
══════════════════════════════════════════ */
function generatePDF() {
  const name    = document.getElementById('f-name').value    || 'Presupuesto';
  const variant = document.getElementById('f-variant').value || '';
  const client  = document.getElementById('f-client').value  || '—';
  const phone   = document.getElementById('f-phone').value   || '—';
  const email   = document.getElementById('f-email').value   || '';
  const date    = document.getElementById('f-date').value    || today();
  const folio   = document.getElementById('f-folio').value   || '';
  const notes   = document.getElementById('f-notes').value   || '';
  const s       = db.settings;

  const matTotal   = totalMats(currentMats);
  const laborTotal = totalEtapas(currentEtapas);
  const total      = matTotal + laborTotal;

  // Tabla de materiales
  const matRows = currentMats.map((m, i) => `
    <tr>
      <td>${m.name}</td>
      <td>${m.store || '—'}</td>
      <td class="num">${m.qty}</td>
      <td>${m.unit}</td>
      <td class="num">$${Number(m.price).toLocaleString('es-MX',{minimumFractionDigits:2})}</td>
      <td class="num total-cell">$${Number(m.qty*m.price).toLocaleString('es-MX',{minimumFractionDigits:2})}</td>
    </tr>`).join('');

  // Tabla de etapas
  const etapaRows = currentEtapas.map(e => {
    const acts = (e.activities||'').split('\n').filter(Boolean);
    return `
    <tr>
      <td class="etapa-name-cell">${e.name}</td>
      <td class="acts-cell">${acts.map(a=>`<span class="act-line">${a}</span>`).join('')}</td>
      <td class="num">${e.days || '—'}</td>
      <td class="num total-cell">$${Number(e.cost).toLocaleString('es-MX',{minimumFractionDigits:2})}</td>
    </tr>`; }).join('');

  const logoHtml = s.logo
    ? `<img src="${s.logo}" class="pdf-logo" alt="Logo"/>`
    : `<div class="pdf-company-text">${s.company || 'PRESUPUESTO DE OBRA'}</div>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>${name}${variant ? ' — '+variant : ''}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Inter',sans-serif; color:#1C1C1C; font-size:9.5pt; background:#fff; }
.page { padding:28px 36px; min-height:100vh; position:relative; }
.page-break { page-break-after:always; }

/* Encabezado */
.pdf-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; padding-bottom:14px; border-bottom:3px solid #1C1C1C; }
.pdf-logo { max-height:55px; max-width:180px; object-fit:contain; }
.pdf-company-text { font-size:20pt; font-weight:800; letter-spacing:-0.5px; }
.pdf-slogan { font-size:7.5pt; color:#888; margin-top:3px; letter-spacing:.08em; text-transform:uppercase; }
.folio-box { text-align:right; }
.folio-box .folio-num { font-size:13pt; font-weight:800; }
.folio-box .folio-date { font-size:8pt; color:#666; margin-top:3px; }
.page-num { position:absolute; top:16px; right:16px; background:#1a3a5c; color:#fff; width:28px; height:28px; border-radius:3px; display:flex; align-items:center; justify-content:center; font-size:9pt; font-weight:700; }

/* Info box */
.info-box { border:1.5px solid #1a3a5c; margin-bottom:22px; }
.info-box-header { background:#1a3a5c; color:#fff; padding:6px 12px; font-size:8pt; font-weight:700; letter-spacing:.06em; text-transform:uppercase; }
.info-box-body { padding:10px 12px; font-size:9pt; line-height:1.7; }
.info-box-body a { color:#1a3a5c; }

/* Texto presentación */
.pres-section { margin:16px 0; }
.pres-title { font-size:14pt; font-weight:800; margin-bottom:14px; }
.pres-p { margin-bottom:9px; line-height:1.6; }
.pres-pillars { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; margin:18px 0; }
.pillar { border-left:3px solid #1a3a5c; padding-left:10px; }
.pillar-title { font-weight:700; font-size:9.5pt; margin-bottom:3px; }
.pillar-desc  { font-size:8.5pt; color:#555; line-height:1.5; }

/* Sección título */
.section-title { font-size:13pt; font-weight:700; margin:18px 0 12px; }

/* Tablas */
table { width:100%; border-collapse:collapse; margin-bottom:10px; }
.tbl-header { background:#1a3a5c; color:#fff; }
.tbl-header th { padding:7px 8px; font-size:7.5pt; text-transform:uppercase; letter-spacing:.04em; text-align:left; font-weight:600; }
td { padding:6px 8px; font-size:8.5pt; border-bottom:1px solid #eee; vertical-align:top; }
tr:nth-child(even) td { background:#f7f8fc; }
.num { text-align:right; }
.total-cell { font-weight:600; }
.etapa-name-cell { font-weight:600; width:22%; }
.acts-cell { width:48%; }
.act-line { display:block; font-size:8pt; color:#444; line-height:1.5; }
.act-line::before { content:'• '; }

/* Tabla total material */
.tbl-total-row td { background:#f0f4f8 !important; font-weight:700; border-top:2px solid #1a3a5c; }

/* Presupuesto final */
.pres-final { margin:22px 0 16px; }
.pres-final-title { background:#1a3a5c; color:#fff; padding:7px 12px; font-size:9pt; font-weight:700; letter-spacing:.06em; text-transform:uppercase; text-align:center; }
.pres-final-table { width:100%; border-collapse:collapse; }
.pres-final-table td { padding:8px 12px; border-bottom:1px solid #e0e0e0; font-size:10pt; }
.pres-final-table td:last-child { text-align:right; font-weight:600; }
.pres-final-total td { background:#F5B800; font-weight:800; font-size:12pt; }

/* Entrega */
.entrega-section { margin:18px 0; }
.entrega-section h2 { font-size:12pt; font-weight:800; margin-bottom:10px; }
.check-list { list-style:none; }
.check-list li { padding:4px 0; font-size:9.5pt; }
.check-list li::before { content:'✓ '; font-weight:700; }

/* Firma */
.firma-section { margin:22px 0; }
.firma-section h2 { font-size:12pt; font-weight:800; margin-bottom:14px; }
.firma-grid { display:grid; grid-template-columns:1fr 1fr; gap:40px; }
.firma-block h3 { font-size:9pt; font-weight:700; text-transform:uppercase; letter-spacing:.05em; margin-bottom:14px; }
.firma-line { border-bottom:1.5px solid #1a3a5c; margin-bottom:6px; height:28px; }
.firma-label { font-size:8pt; color:#888; }

/* Contacto */
.contact-section { text-align:center; padding:24px 0 12px; }
.contact-logo-wrap { margin-bottom:10px; }
.contact-logo { max-height:60px; max-width:200px; object-fit:contain; }
.contact-company { font-size:14pt; font-weight:800; margin-bottom:4px; }
.contact-slogan { font-size:8pt; color:#888; letter-spacing:.08em; text-transform:uppercase; margin-bottom:16px; }
.contact-divider { border:none; border-bottom:2px solid #1a3a5c; width:60%; margin:10px auto; }
.contact-items { display:flex; justify-content:center; flex-wrap:wrap; gap:10px 28px; margin-top:12px; }
.contact-item { font-size:9pt; display:flex; align-items:center; gap:5px; }
.contact-tagline { margin-top:20px; font-size:9pt; color:#555; font-style:italic; }

/* Notas */
.notes-box { border-top:1px solid #ddd; padding-top:10px; margin-top:14px; font-size:8pt; color:#555; }

/* Print */
@media print {
  @page { margin:14mm 16mm; }
  .page-break { page-break-after:always; }
}
</style>
</head>
<body>

<!-- ═══ PÁGINA 1: PRESENTACIÓN ═══ -->
<div class="page page-break">
  <div class="page-num">1</div>
  <div class="pdf-header">
    <div>
      ${logoHtml}
      ${s.slogan ? `<div class="pdf-slogan">${s.slogan}</div>` : ''}
    </div>
    <div class="folio-box">
      ${folio ? `<div class="folio-num">Folio: ${folio}</div>` : ''}
      <div class="folio-date">Fecha: ${date}</div>
    </div>
  </div>

  <div class="info-box">
    <div class="info-box-header">Información</div>
    <div class="info-box-body">
      ${s.rep ? `<strong>${s.rep}</strong><br/>` : ''}
      ${s.email ? `Email: <a href="mailto:${s.email}">${s.email}</a><br/>` : ''}
      ${s.phone ? `Celular: ${s.phone}` : ''}${s.phone2 ? ` · ${s.phone2}` : ''}<br/>
      <br/>
      <strong>Nombre:</strong> ${client}<br/>
      ${email ? `<strong>Email cliente:</strong> ${email}<br/>` : ''}
      ${phone !== '—' ? `<strong>Teléfono:</strong> ${phone}<br/>` : ''}
      <strong>Proyecto:</strong> ${name}${variant ? ' — ' + variant : ''}
    </div>
  </div>

  <div class="pres-section">
    <div class="pres-title">${s.company || 'PRESUPUESTO DE OBRA'}</div>
    <p class="pres-p">Entendemos que cada proyecto es una inversión importante.</p>
    <p class="pres-p">Por ello trabajamos bajo tres principios fundamentales:</p>
    <div class="pres-pillars">
      <div class="pillar">
        <div class="pillar-title">Diseño</div>
        <div class="pillar-desc">Desarrollamos soluciones funcionales y modernas.</div>
      </div>
      <div class="pillar">
        <div class="pillar-title">Calidad</div>
        <div class="pillar-desc">Utilizamos materiales de primera y mano de obra especializada.</div>
      </div>
      <div class="pillar">
        <div class="pillar-title">Durabilidad</div>
        <div class="pillar-desc">Construimos espacios pensados para permanecer y agregar valor a la propiedad.</div>
      </div>
    </div>
    <p class="pres-p">Nuestro compromiso es entregar proyectos con altos estándares de calidad, cuidando cada detalle desde la planeación hasta la entrega final.</p>
  </div>
</div>

<!-- ═══ PÁGINA 2: MATERIALES + MANO DE OBRA ═══ -->
<div class="page page-break">
  <div class="page-num">2</div>
  <div class="pdf-header">
    ${logoHtml}
    <div class="folio-box">
      <div class="folio-num">${name}${variant ? ' — ' + variant : ''}</div>
      <div class="folio-date">Cliente: ${client}</div>
    </div>
  </div>

  ${currentMats.length ? `
  <div class="section-title">Lista de Materiales</div>
  <table>
    <thead class="tbl-header">
      <tr><th>Material</th><th>Tienda</th><th>Cant.</th><th>Unid.</th><th>P. Unit.</th><th>Total</th></tr>
    </thead>
    <tbody>
      ${matRows}
      <tr class="tbl-total-row"><td colspan="5">Total Material</td><td class="num">$${Number(matTotal).toLocaleString('es-MX',{minimumFractionDigits:2})}</td></tr>
    </tbody>
  </table>` : ''}

  ${currentEtapas.length ? `
  <div class="section-title" style="margin-top:22px">Mano de Obra</div>
  <table>
    <thead class="tbl-header">
      <tr><th>Etapa</th><th>Actividades</th><th>Tiempo</th><th>Costo</th></tr>
    </thead>
    <tbody>
      ${etapaRows}
      <tr class="tbl-total-row"><td colspan="3">Subtotal Mano de Obra</td><td class="num">$${Number(laborTotal).toLocaleString('es-MX',{minimumFractionDigits:2})}</td></tr>
    </tbody>
  </table>` : ''}

  <div class="pres-final">
    <div class="pres-final-title">Presupuesto Final</div>
    <table class="pres-final-table">
      <tr><td>Materiales</td><td>$${Number(matTotal).toLocaleString('es-MX',{minimumFractionDigits:2})}</td></tr>
      <tr><td>Total mano de obra</td><td>$${Number(laborTotal).toLocaleString('es-MX',{minimumFractionDigits:2})}</td></tr>
      <tr class="pres-final-total"><td>Total</td><td>$${Number(total).toLocaleString('es-MX',{minimumFractionDigits:2})}</td></tr>
    </table>
  </div>

  ${notes ? `<div class="notes-box"><strong>Notas y condiciones:</strong><br/>${notes}</div>` : ''}
</div>

<!-- ═══ PÁGINA 3: ENTREGA + FIRMA ═══ -->
<div class="page page-break">
  <div class="page-num">3</div>
  <div class="pdf-header">
    ${logoHtml}
    <div class="folio-box">
      <div class="folio-num">${folio || name}</div>
      <div class="folio-date">${date}</div>
    </div>
  </div>

  <div class="entrega-section">
    <h2>ENTREGA DEL PROYECTO</h2>
    <p style="margin-bottom:12px;font-size:9.5pt;">La obra será entregada:</p>
    <ul class="check-list">
      <li>Limpia.</li>
      <li>Funcionando al 100%.</li>
      <li>Con revisión conjunta con el cliente.</li>
      <li>Lista para su uso inmediato.</li>
    </ul>
  </div>

  <div class="firma-section">
    <h2>ACEPTACIÓN DE LA PROPUESTA</h2>
    <div class="firma-grid">
      <div class="firma-block">
        <h3>Cliente</h3>
        <div style="margin-bottom:12px"><div class="firma-label">Nombre</div><div class="firma-line"></div></div>
        <div style="margin-bottom:12px"><div class="firma-label">Firma</div><div class="firma-line"></div></div>
        <div><div class="firma-label">Fecha</div><div class="firma-line"></div></div>
      </div>
      <div class="firma-block">
        <h3>${s.company || 'Contratista'}</h3>
        <div style="margin-bottom:12px"><div class="firma-label">Representante</div><div class="firma-line"></div></div>
        <div style="margin-bottom:12px"><div class="firma-label">Firma</div><div class="firma-line"></div></div>
        <div><div class="firma-label">Fecha</div><div class="firma-line"></div></div>
      </div>
    </div>
  </div>
</div>

<!-- ═══ PÁGINA 4: CONTACTO ═══ -->
<div class="page">
  <div class="page-num">4</div>
  <div class="contact-section">
    <div class="contact-logo-wrap">
      ${s.logo ? `<img src="${s.logo}" class="contact-logo" alt="Logo"/>` : ''}
    </div>
    <div class="contact-company">${s.company || ''}</div>
    ${s.slogan ? `<div class="contact-slogan">${s.slogan}</div>` : ''}
    <hr class="contact-divider"/>
    <div class="contact-items">
      ${s.phone ? `<div class="contact-item">📞 ${s.phone}</div>` : ''}
      ${s.phone2 ? `<div class="contact-item">📞 ${s.phone2}</div>` : ''}
      ${s.email ? `<div class="contact-item">✉️ ${s.email}</div>` : ''}
      ${s.city ? `<div class="contact-item">📍 ${s.city}</div>` : ''}
      ${s.instagram ? `<div class="contact-item">📷 ${s.instagram}</div>` : ''}
    </div>
    ${s.slogan ? `<div class="contact-tagline">"Construimos espacios con diseño, calidad y durabilidad"</div>` : ''}
  </div>
</div>

<script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    showToast('Activa pop-ups para generar el PDF');
  }
}

/* ══════════════════════════════════════════
   IA — GENERADOR DE PRESUPUESTOS
══════════════════════════════════════════ */

function openNewBudgetModal() {
  document.getElementById('modal-new-budget').classList.remove('hidden');
}

function openAIGenerator() {
  document.getElementById('ai-prompt').value = '';
  document.getElementById('ai-error').classList.add('hidden');
  const btn = document.getElementById('ai-gen-btn');
  btn.disabled = false;
  document.getElementById('ai-btn-text').innerHTML = 'Generar presupuesto';
  document.getElementById('modal-ai-gen').classList.remove('hidden');
}

function closeModalById(id) {
  document.getElementById(id).classList.add('hidden');
}

async function generateWithAI() {
  const prompt = document.getElementById('ai-prompt').value.trim();
  if (!prompt) { showAIError('Escribe una descripción de la obra primero.'); return; }
  const btn = document.getElementById('ai-gen-btn');
  btn.disabled = true;
  document.getElementById('ai-btn-text').innerHTML = '<span class="ai-spinner"></span>Generando…';
  document.getElementById('ai-error').classList.add('hidden');
  try {
    const res = await fetch('/api/ai-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: 'Eres experto en construcción en México. Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin backticks, sin explicaciones. Estructura: {"name":"string","variant":"string","notes":"string","mats":[{"name":"string","store":"string","qty":1,"unit":"pza","price":0}],"etapas":[{"name":"string","activities":"string","days":"string","cost":0}]}. Unidades válidas: pza,m²,m,m³,kg,lt,rollo,bolsa,galón,global. Precios en MXN para Ensenada BC México.',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const text = await res.text();
    const data = JSON.parse(text);
    const budget = JSON.parse(data.content[0].text);
    (budget.mats || []).forEach(m => { m.id = uid(); });
    (budget.etapas || []).forEach(e => { e.id = uid(); });
    closeModalById('modal-ai-gen');
    loadAIBudget(budget);
  } catch (err) {
    showAIError('Error: ' + err.message);
    btn.disabled = false;
    document.getElementById('ai-btn-text').textContent = 'Generar presupuesto';
  }
}

function loadAIBudget(budget) {
  // Inicializar pantalla de edición con datos de IA
  currentBudgetId = null;
  currentMats     = budget.mats   || [];
  currentEtapas   = budget.etapas || [];

  document.getElementById('edit-title').textContent    = '✨ Presupuesto generado';
  document.getElementById('f-name').value    = budget.name    || '';
  document.getElementById('f-variant').value = budget.variant || '';
  document.getElementById('f-client').value  = '';
  document.getElementById('f-phone').value   = '';
  document.getElementById('f-email').value   = '';
  document.getElementById('f-date').value    = today();
  document.getElementById('f-folio').value   = generateFolio();
  document.getElementById('f-notes').value   = budget.notes   || '';

  renderMats();
  renderEtapas();
  recalcTotals();
  openScreen('screen-budget-edit');
  showToast('✨ Presupuesto generado — revisa y ajusta');
}

function showAIError(msg) {
  const el = document.getElementById('ai-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  renderHome();
  const fdate = document.getElementById('f-date');
  if (fdate) fdate.value = today();
});
