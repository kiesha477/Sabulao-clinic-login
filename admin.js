// ---------- Helpers ----------
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const pad = n => String(n).padStart(2, '0');
const dateKey = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;   // local date (hindi UTC)
const todayKey = () => { const t = new Date(); return dateKey(t.getFullYear(), t.getMonth(), t.getDate()); };
const empty = (cols, msg) => `<tr><td colspan="${cols}" class="px-4 py-8 text-center text-gray-400">${msg}</td></tr>`;
const peso = n => '₱' + Number(n).toLocaleString('en-PH');

const SERVICES = { Consultation: 500, Laboratory: 350, Diagnostics: 800, Vaccination: 400, 'Check-up': 600 };
const BADGE = { confirmed: 'bg-green-50 text-green-700', pending: 'bg-amber-50 text-amber-700', cancelled: 'bg-red-50 text-red-700' };

// ---------- Data ----------
function getPatients() {
  const db = load('client_db', {});
  const accounts = Object.keys(db).map(u => {
    const d = db[u], o = d && typeof d === 'object';
    return { name: o && d.fullName ? d.fullName : u, username: u, email: o && d.email || '—', mobile: o && d.mobile || '—' };
  });
  const walkins = load('patient_db', []).map(p => ({ name: p.name, username: 'walk-in', email: p.email || '—', mobile: p.mobile }));
  return accounts.concat(walkins);
}
const appts = () => load('appointment_db', []);

// ---------- Navigation ----------
const renderers = { dashboard: renderDashboard, patients: renderPatients, appointments: renderAppointments, records: renderRecords, pharmacy: renderPharmacy, reports: renderReports, settings: () => {} };

function show(view) {
  if (!renderers[view]) view = 'dashboard';
  document.querySelectorAll('[data-panel]').forEach(p => p.classList.toggle('hidden', p.dataset.panel !== view));
  document.querySelectorAll('.nav[data-view]').forEach(a => a.classList.toggle('bg-white/15', a.dataset.view === view));
  renderers[view]();
  $('sidebar').classList.add('-translate-x-full');
  $('backdrop').classList.add('hidden');
}

// ---------- Dashboard ----------
function patientRows(list) {
  return list.length ? list.map(p => `<tr><td class="px-4 py-3 font-medium">${esc(p.name)}</td><td class="px-4 py-3 text-gray-600">${p.username === 'walk-in' ? 'walk-in' : '@' + esc(p.username)}</td><td class="px-4 py-3 text-gray-600">${esc(p.email)}</td><td class="px-4 py-3 text-gray-600">${esc(p.mobile)}</td></tr>`).join('')
    : empty(4, 'No patients found.');
}
function apptRow(a, withAction) {
  const s = a.status || 'pending';
  const act = withAction ? `<td class="px-4 py-3 whitespace-nowrap">${s === 'pending' ? `<button data-act="confirmed" data-id="${a.id}" class="text-green-700 font-semibold hover:underline mr-3">Confirm</button>` : ''}${s !== 'cancelled' ? `<button data-act="cancelled" data-id="${a.id}" class="text-red-600 font-semibold hover:underline">Cancel</button>` : ''}</td>` : '';
  return `<tr><td class="px-4 py-3">${esc(a.date)}</td><td class="px-4 py-3">${esc(a.time)}</td><td class="px-4 py-3 font-medium">${esc(a.patient)}</td><td class="px-4 py-3 text-gray-600">${esc(a.service)}</td><td class="px-4 py-3"><span class="px-2.5 py-1 rounded-full text-xs font-medium ${BADGE[s]}">${s}</span></td>${act}</tr>`;
}
function renderDashboard() {
  const all = appts(), t = todayKey(), q = $('searchInput').value.trim().toLowerCase();
  const patients = getPatients();
  $('todayDate').textContent = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  $('statPatients').textContent = patients.length;
  $('statAppointments').textContent = all.filter(a => a.date === t && a.status !== 'cancelled').length;
  $('statServices').textContent = Object.keys(SERVICES).length;
  $('statRevenue').textContent = peso(all.filter(a => a.status === 'confirmed').reduce((s, a) => s + (a.fee || 0), 0));
  const upcoming = all.filter(a => a.date >= t && a.status !== 'cancelled').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 5);
  $('dashAppts').innerHTML = upcoming.length ? upcoming.map(a => apptRow(a, false)).join('') : empty(5, 'No upcoming appointments.');
  $('dashPatients').innerHTML = patientRows(filterPatients(patients, q).slice(0, 5));
}
const filterPatients = (list, q) => q ? list.filter(p => p.name.toLowerCase().includes(q) || p.username.toLowerCase().includes(q)) : list;

// ---------- Patients ----------
function renderPatients() {
  $('patientsBody').innerHTML = patientRows(filterPatients(getPatients(), $('searchInput').value.trim().toLowerCase()));
}
$('patientForm').addEventListener('submit', e => {
  e.preventDefault();
  const list = load('patient_db', []);
  list.push({ name: $('pName').value.trim(), mobile: $('pMobile').value, age: $('pAge').value, gender: $('pGender').value, email: $('pEmail').value.trim() });
  save('patient_db', list);
  e.target.reset();
  renderPatients();
});

// ---------- Appointments: calendar + dynamic time slots ----------
const cal = { y: new Date().getFullYear(), m: new Date().getMonth(), date: null, time: null };

function slotTimes() {                       // 8:00 AM - 4:30 PM, every 30 min, skip lunch (12-1 PM)
  const out = [];
  for (let mins = 8 * 60; mins < 17 * 60; mins += 30) {
    if (mins >= 12 * 60 && mins < 13 * 60) continue;
    const h = Math.floor(mins / 60), mm = mins % 60;
    out.push({ mins, label: `${h % 12 || 12}:${pad(mm)} ${h < 12 ? 'AM' : 'PM'}` });
  }
  return out;
}
function drawCalendar() {
  $('calTitle').textContent = new Date(cal.y, cal.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const first = new Date(cal.y, cal.m, 1).getDay(), days = new Date(cal.y, cal.m + 1, 0).getDate(), t = todayKey();
  let html = '<div></div>'.repeat(first);
  for (let d = 1; d <= days; d++) {
    const key = dateKey(cal.y, cal.m, d), off = key < t || new Date(cal.y, cal.m, d).getDay() === 0;
    const cls = key === cal.date ? 'bg-[#0f4c4a] text-white font-semibold' : off ? 'text-gray-300 cursor-not-allowed' : key === t ? 'ring-1 ring-[#0f4c4a] hover:bg-teal-50' : 'hover:bg-teal-50';
    html += `<button type="button" data-day="${key}" ${off ? 'disabled' : ''} class="py-2 rounded-lg ${cls}">${d}</button>`;
  }
  $('calGrid').innerHTML = html;
}
function drawSlots() {
  if (!cal.date) return;
  $('slotDate').textContent = '· ' + new Date(cal.date + 'T00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const taken = appts().filter(a => a.date === cal.date && a.status !== 'cancelled').map(a => a.time);
  const now = new Date(), nowMins = now.getHours() * 60 + now.getMinutes(), isToday = cal.date === todayKey();
  $('slotGrid').innerHTML = slotTimes().map(s => {
    const off = taken.includes(s.label) || (isToday && s.mins <= nowMins);
    const cls = s.label === cal.time ? 'bg-[#0f4c4a] text-white border-[#0f4c4a]' : off ? 'bg-gray-100 text-gray-300 line-through cursor-not-allowed' : 'hover:bg-teal-50 border-gray-300';
    return `<button type="button" data-slot="${s.label}" ${off ? 'disabled' : ''} class="py-2 rounded-lg border text-sm ${cls}">${s.label}</button>`;
  }).join('');
}
function renderAppointments() {
  drawCalendar(); drawSlots();
  const p = getPatients();
  $('aPatient').innerHTML = p.length ? p.map(x => `<option>${esc(x.name)}</option>`).join('') : '<option value="">No patients yet</option>';
  $('aService').innerHTML = Object.keys(SERVICES).map(s => `<option>${s} (${peso(SERVICES[s])})</option>`).join('');
  const all = appts().slice().sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  $('apptBody').innerHTML = all.length ? all.map(a => apptRow(a, true)).join('') : empty(6, 'No appointments yet. Pick a date and time above.');
}
$('calGrid').addEventListener('click', e => {
  const b = e.target.closest('[data-day]'); if (!b) return;
  cal.date = b.dataset.day; cal.time = null; drawCalendar(); drawSlots();
});
$('slotGrid').addEventListener('click', e => {
  const b = e.target.closest('[data-slot]'); if (!b) return;
  cal.time = b.dataset.slot; drawSlots();
});
$('prevMonth').addEventListener('click', () => { if (--cal.m < 0) { cal.m = 11; cal.y--; } drawCalendar(); });
$('nextMonth').addEventListener('click', () => { if (++cal.m > 11) { cal.m = 0; cal.y++; } drawCalendar(); });
$('apptForm').addEventListener('submit', e => {
  e.preventDefault();
  const msg = $('aMsg'); msg.classList.remove('hidden');
  const patient = $('aPatient').value, service = $('aService').value.replace(/ \(.*\)$/, '');
  if (!cal.date || !cal.time || !patient) { msg.className = 'text-sm text-red-600'; msg.textContent = 'Choose a date, a time, and a patient first.'; return; }
  const list = appts();
  if (list.some(a => a.date === cal.date && a.time === cal.time && a.status !== 'cancelled')) { msg.className = 'text-sm text-red-600'; msg.textContent = 'That time was just taken. Pick another.'; drawSlots(); return; }
  list.push({ id: Date.now(), date: cal.date, time: cal.time, patient, service, fee: SERVICES[service], status: 'pending' });
  save('appointment_db', list);
  msg.className = 'text-sm text-green-700'; msg.textContent = `Booked ${service} for ${patient} on ${cal.date} at ${cal.time}.`;
  cal.time = null; renderAppointments();
});
$('apptBody').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const list = appts(), a = list.find(x => String(x.id) === b.dataset.id);
  if (a) { a.status = b.dataset.act; save('appointment_db', list); renderAppointments(); }
});

// ---------- Medical records ----------
function renderRecords() {
  const p = getPatients();
  $('rPatient').innerHTML = p.length ? p.map(x => `<option>${esc(x.name)}</option>`).join('') : '<option value="">No patients yet</option>';
  const list = load('record_db', []).slice().reverse();
  $('recordBody').innerHTML = list.length ? list.map(r => `<tr><td class="px-4 py-3">${esc(r.date)}</td><td class="px-4 py-3 font-medium">${esc(r.patient)}</td><td class="px-4 py-3">${esc(r.diagnosis)}</td><td class="px-4 py-3 text-gray-600">${esc(r.notes)}</td></tr>`).join('') : empty(4, 'No medical records yet.');
}
$('recordForm').addEventListener('submit', e => {
  e.preventDefault();
  const list = load('record_db', []);
  list.push({ patient: $('rPatient').value, date: $('rDate').value, diagnosis: $('rDiag').value.trim(), notes: $('rNotes').value.trim() });
  save('record_db', list); e.target.reset(); renderRecords();
});

// ---------- Pharmacy ----------
function renderPharmacy() {
  const list = load('pharmacy_db', []);
  $('pharmBody').innerHTML = list.length ? list.map(m => `<tr><td class="px-4 py-3 font-medium">${esc(m.name)}</td><td class="px-4 py-3 ${m.stock < 10 ? 'text-red-600 font-semibold' : ''}">${esc(m.stock)}</td><td class="px-4 py-3">${peso(m.price)}</td></tr>`).join('') : empty(3, 'No medicines yet.');
}
$('pharmForm').addEventListener('submit', e => {
  e.preventDefault();
  const list = load('pharmacy_db', []);
  list.push({ name: $('mName').value.trim(), stock: Number($('mStock').value), price: Number($('mPrice').value) });
  save('pharmacy_db', list); e.target.reset(); renderPharmacy();
});

// ---------- Reports ----------
function renderReports() {
  const all = appts(), done = all.filter(a => a.status === 'confirmed');
  const cards = [['Patients', getPatients().length], ['Appointments', all.length], ['Confirmed', done.length], ['Revenue', peso(done.reduce((s, a) => s + (a.fee || 0), 0))]];
  $('reportBox').innerHTML = cards.map(c => `<div class="card"><p class="text-sm text-gray-500">${c[0]}</p><p class="text-3xl font-bold mt-1">${c[1]}</p></div>`).join('');
  $('reportBody').innerHTML = Object.keys(SERVICES).map(s => {
    const n = done.filter(a => a.service === s);
    return `<tr><td class="px-4 py-3 font-medium">${s}</td><td class="px-4 py-3">${n.length}</td><td class="px-4 py-3">${peso(n.reduce((x, a) => x + (a.fee || 0), 0))}</td></tr>`;
  }).join('');
}

// ---------- Settings ----------
$('resetBtn').addEventListener('click', () => {
  if (!confirm('Clear all walk-in patients, appointments, records, and medicines?')) return;
  ['patient_db', 'appointment_db', 'record_db', 'pharmacy_db'].forEach(k => localStorage.removeItem(k));
  cal.date = cal.time = null; show('dashboard');
});

// ---------- Page setup (laging nasa dulo para tapos na ang lahat ng const) ----------
function init() {
  document.querySelectorAll('[data-view]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); history.replaceState(null, '', '#' + a.dataset.view); show(a.dataset.view); }));
  $('adminLogoutBtn').addEventListener('click', () => { sessionStorage.removeItem('currentUser'); window.location.href = 'login.html'; });
  $('menuBtn').addEventListener('click', () => { $('sidebar').classList.remove('-translate-x-full'); $('backdrop').classList.remove('hidden'); });
  $('backdrop').addEventListener('click', () => { $('sidebar').classList.add('-translate-x-full'); $('backdrop').classList.add('hidden'); });
  $('searchInput').addEventListener('input', () => { const v = location.hash.slice(1); (v === 'patients' ? renderPatients : renderDashboard)(); });
  show(location.hash.slice(1) || 'dashboard');
}

const user = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
if (!user || user.role !== 'admin') window.location.replace('login.html');
else init();