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
  // Sync desktop
  const titles = {'screen-home':'Inicio','screen-budgets':'Presupuestos','screen-clients':'Clientes','screen-settings':'Configuración','screen-budget-edit':'Editar Presupuesto'};
  const tb = document.getElementById('desktop-topbar-title');
  if (tb) tb.textContent = titles[id] || '';
  const map = {'screen-home':'home','screen-budgets':'budgets','screen-clients':'clients','screen-settings':'settings','screen-budget-edit':'edit'};
  ['home','budgets','clients','settings','edit'].forEach(k => { const b = document.getElementById('snav-'+k); if(b) b.classList.remove('active'); });
  const ak = map[id]; if (ak) { const b = document.getElementById('snav-'+ak); if(b) b.classList.add('active'); }
  const eb = document.getElementById('snav-edit');
  if (eb) eb.style.display = id === 'screen-budget-edit' ? 'flex' : 'none';
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
  const company = s.company || 'LUXTERRA';
  const city    = s.city    || '';

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

  // Header azul con logo centrado — igual en todas las páginas
  const headerHtml = s.logo
    ? `<div class="pdf-header"><img src="${s.logo}" class="pdf-logo" alt="${company}"/>${s.slogan ? `<div class="pdf-slogan">— ${s.slogan} —</div>` : ''}</div>`
    : `<div class="pdf-header"><div class="pdf-company-text">${company}</div>${s.slogan ? `<div class="pdf-slogan">— ${s.slogan} —</div>` : ''}</div>`;

  // Marca de agua diagonal
  const watermark = `<div class="watermark" aria-hidden="true"><div class="wm-name">${company}</div>${s.slogan ? `<div class="wm-slogan">${s.slogan.toUpperCase()}</div>` : ''}</div>`;

  // Footer igual en todas las páginas
  const footer = (n) => `<div class="pdf-footer"><span>${company}${city ? ' | ' + city : ''}</span><span>Página ${n}</span></div>`;

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

/* ═══ RESET ═══ */
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Inter',sans-serif; color:#1C1C1C; font-size:9.5pt; background:#fff; }

/* ═══ PÁGINA ═══ */
.page { position:relative; overflow:hidden; page-break-after:always; display:flex; flex-direction:column; min-height:100vh; }
.page:last-child { page-break-after:auto; }
.page-content { padding:24px 36px 70px; position:relative; z-index:1; flex:1; }

/* ═══ MARCA DE AGUA ═══ */
.watermark { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-35deg); text-align:center; pointer-events:none; z-index:0; opacity:0.055; user-select:none; }
.wm-name { font-size:60pt; font-weight:900; letter-spacing:4px; color:#1a3a5c; line-height:1; }
.wm-slogan { font-size:12pt; font-weight:700; letter-spacing:6px; color:#1a3a5c; margin-top:6px; }

/* ═══ HEADER AZUL ═══ */
.pdf-header { background:#1a3a5c; color:#fff; padding:16px 36px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:4px; }
.pdf-logo { max-height:50px; max-width:200px; object-fit:contain; filter:brightness(0) invert(1); }
.pdf-company-text { font-size:20pt; font-weight:900; letter-spacing:3px; color:#fff; }
.pdf-slogan { font-size:7pt; color:rgba(255,255,255,0.65); letter-spacing:.14em; margin-top:1px; }

/* ═══ FOOTER ═══ */
.pdf-footer { position:absolute; bottom:0; left:0; right:0; background:#1a3a5c; color:rgba(255,255,255,0.8); padding:7px 36px; font-size:7.5pt; display:flex; justify-content:space-between; align-items:center; letter-spacing:.04em; text-transform:uppercase; z-index:2; }

/* ═══ TABLA CLIENTE (pág 1) ═══ */
.client-table { width:100%; border-collapse:collapse; margin:20px 0 18px; }
.client-table td { padding:8px 12px; border:1px solid #dce4ef; font-size:9pt; }
.client-table .ct-label { background:#f0f4f8; font-weight:700; font-size:7.5pt; text-transform:uppercase; letter-spacing:.05em; color:#1a3a5c; width:28%; }

/* ═══ TÍTULO OBRA ═══ */
.obra-title { font-size:20pt; font-weight:800; margin:20px 0 4px; line-height:1.2; }
.obra-sub { font-size:10pt; color:#555; margin-bottom:16px; }

/* ═══ PILARES ═══ */
.pres-p { margin-bottom:9px; line-height:1.6; font-size:9.5pt; }
.pres-pillars { display:grid; grid-template-columns:1fr 1fr 1fr; gap:0; margin:14px 0; border:1px solid #dce4ef; }
.pillar { padding:12px 14px; border-right:1px solid #dce4ef; }
.pillar:last-child { border-right:none; }
.pillar-title { background:#1a3a5c; color:#fff; padding:4px 8px; font-size:7.5pt; font-weight:700; text-transform:uppercase; letter-spacing:.07em; margin-bottom:7px; }
.pillar-desc { font-size:8.5pt; color:#444; line-height:1.5; }

/* ═══ BARRA TOTALES (pág 1) ═══ */
.totals-bar { display:grid; grid-template-columns:1fr 1fr 1fr; border:1px solid #dce4ef; margin-top:18px; }
.tot-cell { padding:10px 14px; border-right:1px solid #dce4ef; }
.tot-cell:last-child { border-right:none; background:#1a3a5c; }
.tot-label { font-size:7pt; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:#1a3a5c; margin-bottom:3px; }
.tot-cell:last-child .tot-label { color:rgba(255,255,255,0.7); }
.tot-value { font-size:13pt; font-weight:800; }
.tot-cell:last-child .tot-value { color:#fff; }

/* ═══ SECCIÓN TÍTULO ═══ */
.section-title { font-size:17pt; font-weight:800; margin:0 0 16px; }

/* ═══ TABLAS ═══ */
table { width:100%; border-collapse:collapse; margin-bottom:10px; }
.tbl-header { background:#1a3a5c; color:#fff; }
.tbl-header th { padding:8px 10px; font-size:7.5pt; text-transform:uppercase; letter-spacing:.05em; text-align:left; font-weight:600; }
td { padding:7px 10px; font-size:8.5pt; border-bottom:1px solid #eee; vertical-align:top; }
tr:nth-child(even) td { background:#f7f8fc; }
.num { text-align:right; }
.tbl-total-row td { background:#f0f4f8 !important; font-weight:700; border-top:2px solid #1a3a5c; font-size:9.5pt; }
.act-line { display:block; font-size:8pt; color:#444; line-height:1.55; }
.act-line::before { content:'• '; }

/* ═══ RESUMEN (pág 4) ═══ */
.resumen-table { width:100%; border-collapse:collapse; margin-bottom:20px; }
.resumen-table td { padding:9px 12px; border-bottom:1px solid #eee; font-size:10pt; }
.resumen-table td:last-child { text-align:right; font-weight:600; }
.resumen-total td { background:#1a3a5c !important; color:#fff !important; font-weight:800; font-size:12pt; border:none; }

/* ═══ NOTAS ═══ */
.notes-box { border-left:3px solid #1a3a5c; padding:10px 14px; margin:14px 0; font-size:8.5pt; color:#444; background:#f8f9fb; line-height:1.6; }

/* ═══ ENTREGA ═══ */
.entrega-section { margin:18px 0 14px; }
.entrega-section h2 { font-size:12pt; font-weight:800; margin-bottom:8px; }
.check-list { list-style:none; }
.check-list li { padding:5px 0; font-size:9.5pt; }
.check-list li::before { content:'✓ '; font-weight:800; color:#1a3a5c; }

/* ═══ FIRMAS ═══ */
.firma-section h2 { font-size:12pt; font-weight:800; margin-bottom:16px; }
.firma-grid { display:grid; grid-template-columns:1fr 1fr; gap:50px; }
.firma-block h3 { font-size:8.5pt; font-weight:700; text-transform:uppercase; letter-spacing:.06em; margin-bottom:16px; color:#1a3a5c; border-bottom:2px solid #1a3a5c; padding-bottom:5px; }
.firma-line { border-bottom:1.5px solid #bbb; margin-bottom:4px; height:30px; }
.firma-label { font-size:7.5pt; color:#999; margin-bottom:14px; }

/* ═══ PRINT ═══ */
@media print {
  @page { margin:0; size:letter; }
  .page { page-break-after:always; min-height:100vh; }
  .page:last-child { page-break-after:auto; }
}
</style>
</head>
<body>

<!-- ═══════════ PÁGINA 1: PORTADA ═══════════ -->
<div class="page">
  ${watermark}
  ${headerHtml}
  <div class="page-content">
    <div class="obra-title">${name}</div>
    ${variant ? `<div class="obra-sub">${variant}</div>` : ''}

    <table class="client-table">
      <tr>
        <td class="ct-label">Cliente</td><td>${client}</td>
        <td class="ct-label">Fecha</td><td>${date}</td>
      </tr>
      ${folio || s.rep ? `<tr>
        ${folio ? `<td class="ct-label">Folio</td><td>${folio}</td>` : '<td colspan="2"></td>'}
        ${s.rep  ? `<td class="ct-label">Representante</td><td>${s.rep}</td>` : '<td colspan="2"></td>'}
      </tr>` : ''}
    </table>

    <p class="pres-p">Entendemos que cada proyecto es una inversión importante. Por ello trabajamos bajo tres principios fundamentales:</p>
    <div class="pres-pillars">
      <div class="pillar"><div class="pillar-title">Diseño</div><div class="pillar-desc">Desarrollamos soluciones funcionales y modernas.</div></div>
      <div class="pillar"><div class="pillar-title">Calidad</div><div class="pillar-desc">Utilizamos materiales de primera y mano de obra especializada.</div></div>
      <div class="pillar"><div class="pillar-title">Durabilidad</div><div class="pillar-desc">Construimos espacios pensados para permanecer y agregar valor a la propiedad.</div></div>
    </div>
    <p class="pres-p">Nuestro compromiso es entregar proyectos con altos estándares de calidad, cuidando cada detalle desde la planeación hasta la entrega final.</p>

    <div class="totals-bar">
      <div class="tot-cell"><div class="tot-label">Materiales</div><div class="tot-value">$${Number(matTotal).toLocaleString('es-MX',{minimumFractionDigits:2})}</div></div>
      <div class="tot-cell"><div class="tot-label">Mano de obra</div><div class="tot-value">$${Number(laborTotal).toLocaleString('es-MX',{minimumFractionDigits:2})}</div></div>
      <div class="tot-cell"><div class="tot-label">Total</div><div class="tot-value">$${Number(total).toLocaleString('es-MX',{minimumFractionDigits:2})}</div></div>
    </div>
  </div>
  ${footer(1)}
</div>

<!-- ═══════════ PÁGINA 2: MATERIALES ═══════════ -->
${currentMats.length ? `
<div class="page">
  ${watermark}
  ${headerHtml}
  <div class="page-content">
    <div class="section-title">Lista de materiales</div>
    <table>
      <thead class="tbl-header">
        <tr><th>Material</th><th>Proveedor</th><th>Cant.</th><th>Unid.</th><th>P. Unit.</th><th>Total</th></tr>
      </thead>
      <tbody>
        ${matRows}
        <tr class="tbl-total-row"><td colspan="5"><strong>Total Materiales</strong></td><td class="num">$${Number(matTotal).toLocaleString('es-MX',{minimumFractionDigits:2})}</td></tr>
      </tbody>
    </table>
  </div>
  ${footer(2)}
</div>` : ''}

<!-- ═══════════ PÁGINA 3: MANO DE OBRA ═══════════ -->
${currentEtapas.length ? `
<div class="page">
  ${watermark}
  ${headerHtml}
  <div class="page-content">
    <div class="section-title">Mano de obra</div>
    <table>
      <thead class="tbl-header">
        <tr><th>Etapa</th><th>Actividades</th><th>Tiempo</th><th>Costo</th></tr>
      </thead>
      <tbody>
        ${etapaRows}
        <tr class="tbl-total-row"><td colspan="3"><strong>Total Mano de Obra</strong></td><td class="num">$${Number(laborTotal).toLocaleString('es-MX',{minimumFractionDigits:2})}</td></tr>
      </tbody>
    </table>
  </div>
  ${footer(3)}
</div>` : ''}

<!-- ═══════════ PÁGINA 4: RESUMEN + ENTREGA + FIRMAS ═══════════ -->
<div class="page">
  ${watermark}
  ${headerHtml}
  <div class="page-content">
    <div class="section-title">Resumen y aceptación</div>
    <table class="resumen-table">
      <tbody>
        <tr><td>Materiales</td><td>$${Number(matTotal).toLocaleString('es-MX',{minimumFractionDigits:2})}</td></tr>
        <tr><td>Mano de obra</td><td>$${Number(laborTotal).toLocaleString('es-MX',{minimumFractionDigits:2})}</td></tr>
        <tr class="resumen-total"><td><strong>Total del Presupuesto</strong></td><td><strong>$${Number(total).toLocaleString('es-MX',{minimumFractionDigits:2})}</strong></td></tr>
      </tbody>
    </table>

    ${notes ? `<div class="notes-box"><strong>Notas y condiciones:</strong><br/>${notes}</div>` : ''}

    <div class="entrega-section">
      <h2>Entrega del proyecto</h2>
      <p style="margin-bottom:10px;font-size:9.5pt;">La obra será entregada:</p>
      <ul class="check-list">
        <li>Limpia.</li>
        <li>Funcionando al 100%.</li>
        <li>Con revisión conjunta con el cliente.</li>
        <li>Lista para su uso inmediato.</li>
      </ul>
    </div>

    <div class="firma-section">
      <h2>Aceptación de la propuesta</h2>
      <div class="firma-grid">
        <div class="firma-block">
          <h3>Cliente</h3>
          <div class="firma-label">Nombre</div><div class="firma-line"></div>
          <div class="firma-label">Firma</div><div class="firma-line"></div>
          <div class="firma-label">Fecha</div><div class="firma-line"></div>
        </div>
        <div class="firma-block">
          <h3>${s.rep || company}</h3>
          <div class="firma-label">Representante</div><div class="firma-line"></div>
          <div class="firma-label">Firma</div><div class="firma-line"></div>
          <div class="firma-label">Fecha</div><div class="firma-line"></div>
        </div>
      </div>
    </div>
  </div>
  ${footer(4)}
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
  if (!prompt) {
    showAIError('Escribe una descripción de la obra primero.');
    return;
  }

  const btn = document.getElementById('ai-gen-btn');
  btn.disabled = true;
  document.getElementById('ai-btn-text').innerHTML =
    '<span class="ai-spinner"></span>Generando…';
  document.getElementById('ai-error').classList.add('hidden');

  const systemPrompt = `Eres un asistente experto en construcción y remodelación en México.
Tu tarea es generar presupuestos de obra estructurados en formato JSON.
Cuando el usuario describa una obra, debes responder ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin backticks, sin explicaciones.

El JSON debe tener exactamente esta estructura:
{
  "name": "Nombre corto de la obra",
  "variant": "Descripción adicional o variante (puede ser vacío)",
  "notes": "Condiciones, observaciones o notas importantes",
  "mats": [
    {
      "name": "Nombre del material",
      "store": "Tienda sugerida (Home Depot, Construrama, etc.)",
      "qty": 10,
      "unit": "pza",
      "price": 85.00
    }
  ],
  "etapas": [
    {
      "name": "Nombre de la etapa",
      "activities": "Actividad 1\nActividad 2\nActividad 3",
      "days": "2-3 días",
      "cost": 3500.00
    }
  ]
}

Reglas importantes:
- Las unidades válidas son: pza, m², m, m³, kg, lt, rollo, bolsa, galón, global
- Los precios deben ser en pesos mexicanos (MXN), realistas para el mercado actual
- Incluye todos los materiales necesarios, no omitas consumibles (clavos, tornillos, mezcla, etc.)
- Las etapas representan mano de obra: sepáralas de forma lógica
- Si el usuario no da precios, estímalos con base en el mercado de Baja California / Ensenada, MX
- Responde SOLO con el JSON, nada más`;

  try {
    const response = await fetch('/api/ai-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-5-5',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Error ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // Limpiar posibles backticks si el modelo los incluyó
    const clean = rawText.replace(/```json|```/gi, '').trim();
    let budget;
    try {
      budget = JSON.parse(clean);
    } catch {
      throw new Error('La IA no devolvió un JSON válido. Intenta con una descripción más detallada.');
    }

    // Validar estructura mínima
    if (!budget.name) throw new Error('El presupuesto generado no tiene nombre de obra.');

    // Agregar IDs a materiales y etapas
    (budget.mats || []).forEach(m => { m.id = uid(); });
    (budget.etapas || []).forEach(e => { e.id = uid(); });

    // Cerrar modal y cargar en el formulario de edición
    closeModalById('modal-ai-gen');
    loadAIBudget(budget);

  } catch (err) {
    showAIError(err.message || 'Ocurrió un error. Verifica tu conexión e intenta de nuevo.');
    btn.disabled = false;
    document.getElementById('ai-btn-text').innerHTML = 'Generar presupuesto';
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
/* ══ DESKTOP ══ */
function isDesktop() { return window.innerWidth >= 900; }

function applyLayout() {
  const d = isDesktop();
  const s = document.getElementById('desktop-sidebar');
  const t = document.getElementById('desktop-topbar');
  if (s) s.style.display = d ? 'flex' : 'none';
  if (t) t.style.display  = d ? 'flex' : 'none';
}

function syncSidebarBrand() {
  const s = db.settings;
  const n = document.getElementById('sidebar-name');
  if (n) n.textContent = s.company || 'Presupuestos';
  const l = document.getElementById('sidebar-logo');
  if (l) { if (s.logo) { l.src = s.logo; l.style.display = 'block'; } else { l.style.display = 'none'; } }
}

function desktopNav(id) { openScreen(id); }
/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  applyLayout();
  renderHome();
  syncSidebarBrand();
  const fdate = document.getElementById('f-date');
  if (fdate) fdate.value = today();
});
window.addEventListener('resize', applyLayout);
