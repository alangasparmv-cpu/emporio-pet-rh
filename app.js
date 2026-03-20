const $ = (id) => document.getElementById(id);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const STORAGE_KEYS = {
  settings: 'emporio_rh_settings_v7',
  admin: 'emporio_rh_admin_v7',
  session: 'emporio_rh_session_v7',
  templates: 'emporio_rh_templates_v7',
  history: 'emporio_rh_history_v7'
};

const DEFAULT_TEMPLATES = [
  {
    name: 'Ficha cadastral',
    content: `FICHA CADASTRAL

Nome: {{full_name}}
CPF: {{cpf}}
RG: {{rg}}
Cargo: {{role}}
Setor: {{sector}}
Data de admissão: {{hire_date}}
Endereço: {{address}}
Telefone: {{mobile}}

Leme/SP, {{today}}

Assinatura: __________________________________`
  },
  {
    name: 'Contrato de experiência',
    content: `CONTRATO DE EXPERIÊNCIA

Colaborador: {{full_name}}
CPF: {{cpf}}
Cargo: {{role}}
Data de admissão: {{hire_date}}
Prazo de experiência: {{trial_days}} dias

Declaro estar ciente das condições do período de experiência.

Leme/SP, {{today}}

Assinatura do colaborador: _______________________`
  },
  {
    name: 'Termo de responsabilidade',
    content: `TERMO DE RESPONSABILIDADE

Eu, {{full_name}}, CPF {{cpf}}, ocupante do cargo de {{role}}, declaro responsabilidade pelas informações prestadas e pelo uso adequado dos recursos da empresa.

Endereço: {{address}}
Telefone: {{mobile}}

Data: {{today}}

Assinatura: __________________________________`
  }
];

const state = {
  supabase: null,
  settingsUnlocked: false,
  employees: [],
  editingEmployee: null,
  currentPhotoFile: null,
  currentDocuments: [],
  signatureDataUrl: '',
  signaturePad: null
};

const getJSON = (k, def) => JSON.parse(localStorage.getItem(k) || JSON.stringify(def));
const setJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));

const hashString = (v) => {
  let h = 0;
  for (let i = 0; i < v.length; i++) {
    h = ((h << 5) - h) + v.charCodeAt(i);
    h |= 0;
  }
  return String(h);
};

const maskCPF = (v) => {
  v = v.replace(/\D/g, '').slice(0, 11);
  v = v.replace(/(\d{3})(\d)/, '$1.$2');
  v = v.replace(/(\d{3})(\d)/, '$1.$2');
  return v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

function validarCPF(cpf) {
  cpf = String(cpf || '').replace(/\D/g, '');

  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += Number(cpf.charAt(i)) * (10 - i);
  }

  let dig1 = 11 - (soma % 11);
  if (dig1 >= 10) dig1 = 0;
  if (dig1 !== Number(cpf.charAt(9))) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += Number(cpf.charAt(i)) * (11 - i);
  }

  let dig2 = 11 - (soma % 11);
  if (dig2 >= 10) dig2 = 0;
  if (dig2 !== Number(cpf.charAt(10))) return false;

  return true;
}

function validarCampoCPF() {
  const input = $('cpf');
  if (!input) return true;

  const valor = input.value.trim();
  if (!valor) {
    input.setCustomValidity('');
    input.style.borderColor = '';
    return true;
  }

  if (!validarCPF(valor)) {
    input.setCustomValidity('CPF inválido');
    input.style.borderColor = '#dc2626';
    return false;
  }

  input.setCustomValidity('');
  input.style.borderColor = '';
  return true;
}

const maskRG = (v) => {
  v = v.replace(/\D/g, '').slice(0, 9);
  v = v.replace(/(\d{2})(\d)/, '$1.$2');
  v = v.replace(/(\d{3})(\d)/, '$1.$2');
  return v.replace(/(\d{3})(\d{1})$/, '$1-$2');
};

const maskPhone = (v) => {
  v = v.replace(/\D/g, '').slice(0, 11);
  return v.length <= 10
    ? v.replace(/(\d{0,2})(\d{0,4})(\d{0,4})/, (_, a, b, c) => `${a ? `(${a}` : ''}${a && a.length === 2 ? ') ' : ''}${b}${c ? '-' + c : ''}`.trim())
    : v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
};

const maskCEP = (v) => v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d{1,3})/, '$1-$2');
const todayISO = () => new Date().toISOString().slice(0, 10);
const formatDate = (s) => s ? new Date(`${s}T00:00:00`).toLocaleDateString('pt-BR') : '';
const addDays = (s, d) => {
  if (!s) return null;
  const x = new Date(`${s}T00:00:00`);
  x.setDate(x.getDate() + Number(d || 0));
  return x.toISOString().slice(0, 10);
};
const diffDays = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000);
const initials = (n = '') => n.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('');
const employeeAddress = (e) => [e.address_street, e.address_number, e.address_complement, e.address_neighborhood, e.address_city, e.address_state].filter(Boolean).join(', ');

function initSupabase() {
  const s = getJSON(STORAGE_KEYS.settings, {});
  state.supabase = (s.url && s.key && window.supabase) ? window.supabase.createClient(s.url, s.key) : null;
}

async function logAction(action, details) {
  const entry = {
    action,
    details,
    created_at: new Date().toISOString(),
    user_email: getJSON(STORAGE_KEYS.session, {}).email || 'administrador'
  };

  const hist = getJSON(STORAGE_KEYS.history, []);
  hist.unshift(entry);
  setJSON(STORAGE_KEYS.history, hist.slice(0, 200));

  if (state.supabase) {
    try {
      await state.supabase.from('audit_logs').insert(entry);
    } catch (e) {}
  }

  renderHistory();
}

function setupLoginScreen() {
  const admin = getJSON(STORAGE_KEYS.admin, null);

  if ($('setup-box')) $('setup-box').classList.toggle('hidden', !!admin);
  if ($('btn-create-admin')) $('btn-create-admin').classList.toggle('hidden', !!admin);
  if ($('btn-login')) $('btn-login').classList.toggle('hidden', !admin);
  if ($('login-message')) {
    $('login-message').textContent = admin ? '' : 'Defina o primeiro acesso do administrador.';
  }
}

function showApp() {
  if ($('login-screen')) $('login-screen').classList.add('hidden');
  if ($('main-app')) $('main-app').classList.remove('hidden');
  if ($('logged-user-label')) $('logged-user-label').textContent = getJSON(STORAGE_KEYS.session, {}).email || 'Administrador';
  initSupabase();
  loadSettingsIntoUI();
  loadTemplatesIntoUI();
  loadEmployees();
  renderHistory();
}

function showLogin() {
  if ($('main-app')) $('main-app').classList.add('hidden');
  if ($('login-screen')) $('login-screen').classList.remove('hidden');
  setupLoginScreen();
}

async function handleCreateAdmin() {
  const emailField = $('login-email');
  const passwordField = $('login-password');
  const msg = $('login-message');

  if (!emailField || !passwordField || !msg) {
    alert('Campos de login não encontrados no HTML.');
    return;
  }

  const email = emailField.value.trim().toLowerCase();
  const password = passwordField.value;

  if (!email || !password || password.length < 4) {
    msg.textContent = 'Informe e-mail e uma senha com pelo menos 4 caracteres.';
    return;
  }

  setJSON(STORAGE_KEYS.admin, { email, passwordHash: hashString(password) });
  setJSON(STORAGE_KEYS.session, { email, loggedAt: new Date().toISOString() });

  try {
    await logAction('setup_admin', 'Administrador inicial configurado');
  } catch (e) {}

  msg.textContent = '';
  showApp();
}

function handleLogin() {
  const admin = getJSON(STORAGE_KEYS.admin, null);
  const emailField = $('login-email');
  const passwordField = $('login-password');
  const msg = $('login-message');

  if (!emailField || !passwordField || !msg) {
    alert('Campos de login não encontrados no HTML.');
    return;
  }

  const email = emailField.value.trim().toLowerCase();
  const password = passwordField.value;

  if (admin && email === admin.email && hashString(password) === admin.passwordHash) {
    setJSON(STORAGE_KEYS.session, { email, loggedAt: new Date().toISOString() });
    showApp();
  } else {
    msg.textContent = 'E-mail ou senha inválidos.';
  }
}

function logout() {
  localStorage.removeItem(STORAGE_KEYS.session);
  state.settingsUnlocked = false;
  showLogin();
}

function switchView(view) {
  $$('.view').forEach(v => v.classList.add('hidden'));
  $$('.nav-btn').forEach(b => b.classList.remove('active'));
  if ($(`view-${view}`)) $(`view-${view}`).classList.remove('hidden');
  document.querySelector(`.nav-btn[data-view="${view}"]`)?.classList.add('active');
}

function loadSettingsIntoUI() {
  const s = getJSON(STORAGE_KEYS.settings, {});
  if ($('supabase-url')) $('supabase-url').value = s.url || '';
  if ($('supabase-key')) $('supabase-key').value = s.key || '';
  if ($('bucket-photos')) $('bucket-photos').value = s.photoBucket || 'employee-photos';
  if ($('bucket-docs')) $('bucket-docs').value = s.docBucket || 'employee-documents';
}

function updateSettingsLockUI() {
  if ($('settings-lock')) $('settings-lock').classList.toggle('hidden', state.settingsUnlocked);
  if ($('settings-panel')) $('settings-panel').classList.toggle('hidden', !state.settingsUnlocked);
}

function unlockSettings() {
  const admin = getJSON(STORAGE_KEYS.admin, null);
  const pass = $('settings-password')?.value || '';

  if (admin && hashString(pass) === admin.passwordHash) {
    state.settingsUnlocked = true;
    if ($('settings-message')) $('settings-message').textContent = 'Configurações desbloqueadas.';
  } else {
    if ($('settings-message')) $('settings-message').textContent = 'Senha incorreta.';
  }

  updateSettingsLockUI();
}

function saveConnectionSettings() {
  setJSON(STORAGE_KEYS.settings, {
    url: $('supabase-url')?.value.trim() || '',
    key: $('supabase-key')?.value.trim() || '',
    photoBucket: $('bucket-photos')?.value.trim() || 'employee-photos',
    docBucket: $('bucket-docs')?.value.trim() || 'employee-documents'
  });

  initSupabase();
  if ($('connection-result')) $('connection-result').textContent = 'Configurações salvas neste navegador.';
}

async function testConnection() {
  if ($('connection-result')) $('connection-result').textContent = 'Testando conexão...';

  if (!state.supabase) {
    if ($('connection-result')) $('connection-result').textContent = 'Preencha URL e chave corretamente.';
    return;
  }

  try {
    const { error } = await state.supabase.from('employees').select('id', { count: 'exact', head: true });
    if (error) throw error;
    if ($('connection-result')) $('connection-result').textContent = 'Conexão realizada com sucesso.';
  } catch (e) {
    if ($('connection-result')) $('connection-result').textContent = `Falha na conexão: ${e.message}`;
  }
}

async function loadEmployees() {
  if (!state.supabase) {
    state.employees = [];
    renderEmployees();
    renderDashboard();
    populateEmployeeSelects();
    return;
  }

  try {
    const { data, error } = await state.supabase.from('employees').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    state.employees = data || [];
    renderEmployees();
    renderDashboard();
    populateEmployeeSelects();
  } catch (e) {
    alert(`Erro ao carregar funcionários: ${e.message}`);
  }
}

function applyFilters() {
  const term = $('search-employee')?.value.trim().toLowerCase() || '';
  const status = $('filter-status')?.value || '';

  return state.employees.filter(emp => {
    const hay = [emp.full_name, emp.role, emp.cpf, emp.phone, emp.mobile].filter(Boolean).join(' ').toLowerCase();
    return (!term || hay.includes(term)) && (!status || emp.status === status);
  });
}

function renderEmployees() {
  const c = $('employee-list');
  if (!c) return;

  const list = applyFilters();

  c.innerHTML = list.length
    ? list.map(emp => `
      <article class="employee-card">
        <div class="employee-top">
          ${emp.photo_url
            ? `<img src="${emp.photo_url}" class="avatar" alt="${emp.full_name}">`
            : `<div class="avatar">${initials(emp.full_name)}</div>`
          }
          <div>
            <strong>${emp.full_name || '-'}</strong>
            <div class="muted">${emp.role || 'Sem cargo'}</div>
            <span class="badge ${emp.status || 'ativo'}">${emp.status || 'ativo'}</span>
          </div>
        </div>
        <div class="muted">
          CPF: ${emp.cpf || '-'}<br>
          Admissão: ${formatDate(emp.hire_date)}<br>
          Setor: ${emp.sector || '-'}
        </div>
        <div class="employee-actions">
          <button class="secondary" onclick="window.editEmployee('${emp.id}')">Editar</button>
          <button class="secondary" onclick="window.setEmployeeStatus('${emp.id}','ativo')">Ativar</button>
          <button class="secondary" onclick="window.setEmployeeStatus('${emp.id}','afastado')">Afastar</button>
          <button class="secondary" onclick="window.setEmployeeStatus('${emp.id}','desligado')">Desligar</button>
          <button class="danger-outline" onclick="window.deleteEmployee('${emp.id}')">Excluir</button>
        </div>
      </article>
    `).join('')
    : '<div class="card">Nenhum funcionário encontrado.</div>';
}

function renderDashboard() {
  const total = state.employees.length;
  const active = state.employees.filter(e => e.status === 'ativo').length;
  const away = state.employees.filter(e => e.status === 'afastado').length;
  const dismissed = state.employees.filter(e => e.status === 'desligado').length;
  const month = new Date().getMonth() + 1;
  const birthdays = state.employees.filter(e => (e.birth_date || '').slice(5, 7) === String(month).padStart(2, '0')).length;
  const trials = state.employees.filter(e => e.hire_date && (() => {
    const left = diffDays(todayISO(), addDays(e.hire_date, e.trial_days || 90));
    return left >= 0 && left <= 7;
  })()).length;

  if ($('stat-total')) $('stat-total').textContent = total;
  if ($('stat-active')) $('stat-active').textContent = active;
  if ($('stat-away')) $('stat-away').textContent = away;
  if ($('stat-dismissed')) $('stat-dismissed').textContent = dismissed;
  if ($('stat-trial')) $('stat-trial').textContent = trials;
  if ($('stat-birthdays')) $('stat-birthdays').textContent = birthdays;

  const alerts = [];

  state.employees.forEach(e => {
    if (e.hire_date) {
      const left = diffDays(todayISO(), addDays(e.hire_date, e.trial_days || 90));
      if (left >= 0 && left <= 7) alerts.push(`⚠ ${e.full_name} completa o período de experiência em ${left} dia(s).`);
    }

    if ((e.birth_date || '').slice(5, 7) === String(month).padStart(2, '0')) {
      alerts.push(`🎂 ${e.full_name} faz aniversário este mês.`);
    }
  });

  if ($('alerts-list')) {
    $('alerts-list').innerHTML = alerts.length
      ? alerts.map(a => `<div class="list-item">${a}</div>`).join('')
      : '<div class="list-item">Nenhum alerta no momento.</div>';
  }
}

function renderHistory() {
  const local = getJSON(STORAGE_KEYS.history, []);
  if (!$('history-list')) return;

  $('history-list').innerHTML = local.length
    ? local.slice(0, 10).map(h => `
      <div class="list-item">
        <strong>${h.action}</strong><br>
        ${h.details}<br>
        <span class="muted">${new Date(h.created_at).toLocaleString('pt-BR')}</span>
      </div>
    `).join('')
    : '<div class="list-item">Sem movimentações registradas.</div>';
}

function populateEmployeeSelects() {
  if (!$('doc-employee-select')) return;

  $('doc-employee-select').innerHTML = ['<option value="">Selecione</option>']
    .concat(state.employees.map(e => `<option value="${e.id}">${e.full_name}</option>`))
    .join('');
}

function activateTab(tab) {
  $$('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  ['personal', 'professional', 'documents'].forEach(name => {
    if ($(`tab-${name}`)) $(`tab-${name}`).classList.toggle('hidden', name !== tab);
    if ($(`tab-${name}`)) $(`tab-${name}`).classList.toggle('active', name === tab);
  });
}

function updatePhotoPreview(url) {
  if ($('employee-photo-preview')) $('employee-photo-preview').src = url || '';
  if ($('employee-photo-preview')) $('employee-photo-preview').classList.toggle('hidden', !url);
  if ($('photo-placeholder')) $('photo-placeholder').classList.toggle('hidden', !!url);
}

function initSignaturePad() {
  const canvas = $('signature-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#111';

  let drawing = false;

  const clearCanvas = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    state.signatureDataUrl = '';
  };

  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };
  };

  const start = (e) => {
    drawing = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    if (e.cancelable) e.preventDefault();
  };

  const move = (e) => {
    if (!drawing) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    state.signatureDataUrl = canvas.toDataURL('image/png');
    if (e.cancelable) e.preventDefault();
  };

  const end = (e) => {
    if (!drawing) return;
    drawing = false;
    state.signatureDataUrl = canvas.toDataURL('image/png');
    if (e?.cancelable) e.preventDefault();
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (canvas.setPointerCapture) {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (_) {}
    }
    start(e);
  });

  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', end);

  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end, { passive: false });

  $('btn-clear-signature')?.addEventListener('click', clearCanvas);

  state.signaturePad = { canvas, ctx, clear: clearCanvas };
}

async function loadEmployeeDocuments(employeeId) {
  if (!state.supabase || !employeeId) return;

  const { data, error } = await state.supabase
    .from('employee_documents')
    .select('*')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false });

  if (!error && $('employee-documents-list')) {
    state.currentDocuments = data || [];
    $('employee-documents-list').innerHTML = state.currentDocuments.length
      ? state.currentDocuments.map(doc => `
        <div class="list-item" style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
          <div>
            <strong>${doc.document_type || 'Documento'}</strong><br>
            <span class="muted">${doc.file_name || 'Arquivo enviado'}</span>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <a href="${doc.file_url}" target="_blank" class="secondary" style="text-decoration:none;padding:8px 12px;border-radius:6px;">Visualizar</a>
          </div>
        </div>
      `).join('')
      : '<div class="list-item">Nenhum documento enviado.</div>';
  }
}

function openEmployeeModal(employee = null) {
  state.editingEmployee = employee;
  state.currentPhotoFile = null;

  if ($('employee-modal-title')) $('employee-modal-title').textContent = employee ? 'Editar funcionário' : 'Novo funcionário';
  if ($('employee-form')) $('employee-form').reset();
  if ($('employee-id')) $('employee-id').value = employee?.id || '';
  if ($('employee-documents-list')) $('employee-documents-list').innerHTML = '';

  if (employee) {
    [
      ['full-name', 'full_name'],
      ['nationality', 'nationality'],
['place-of-birth', 'place_of_birth'],
['marital-status', 'marital_status'],
['dependents', 'dependents'],
      ['status', 'status'],
      ['cpf', 'cpf'],
      ['rg', 'rg'],
      ['birth-date', 'birth_date'],
      ['phone', 'phone'],
      ['mobile', 'mobile'],
      ['email', 'email'],
      ['cep', 'cep'],
      ['address-street', 'address_street'],
      ['address-number', 'address_number'],
      ['address-complement', 'address_complement'],
      ['address-neighborhood', 'address_neighborhood'],
      ['address-city', 'address_city'],
      ['address-state', 'address_state'],
      ['emergency-name', 'emergency_name'],
      ['emergency-phone', 'emergency_phone'],
      ['role', 'role'],
      ['sector', 'sector'],
      ['hire-date', 'hire_date'],
      ['contract-type', 'contract_type'],
      ['salary', 'salary'],
      ['trial-days', 'trial_days'],
      ['notes', 'notes']
    ].forEach(([id, key]) => {
      if ($(id)) $(id).value = employee[key] || '';
    });

    updatePhotoPreview(employee.photo_url || '');
    loadEmployeeDocuments(employee.id);
  } else {
    if ($('status')) $('status').value = 'ativo';
    if ($('trial-days')) $('trial-days').value = 90;
    updatePhotoPreview('');
  }

  activateTab('personal');
  if ($('employee-modal')) $('employee-modal').classList.remove('hidden');
}

function closeEmployeeModal() {
  if ($('employee-modal')) $('employee-modal').classList.add('hidden');
}

async function uploadFileToBucket(file, bucket, prefix) {
  if (!state.supabase) throw new Error('Configure o Supabase antes de enviar arquivos.');

  const ext = file.name.split('.').pop() || 'bin';
  const name = `${prefix}-${Date.now()}.${ext}`;

  const { error } = await state.supabase.storage.from(bucket).upload(name, file, { upsert: true });
  if (error) throw error;

  return state.supabase.storage.from(bucket).getPublicUrl(name).data.publicUrl;
}

async function uploadEmployeeDocument() {
  const employeeId = $('employee-id')?.value || '';
  const file = $('employee-document-file')?.files?.[0];
  const type = $('employee-document-type')?.value.trim() || 'Documento';

  if (!employeeId) return alert('Salve o funcionário antes de enviar documentos.');
  if (!file) return alert('Selecione um arquivo.');

  try {
    const s = getJSON(STORAGE_KEYS.settings, {});
    const url = await uploadFileToBucket(file, s.docBucket || 'employee-documents', `doc-${employeeId}`);

    const { error } = await state.supabase.from('employee_documents').insert({
      employee_id: employeeId,
      document_type: type,
      file_url: url,
      file_name: file.name
    });

    if (error) throw error;

    if ($('employee-document-file')) $('employee-document-file').value = '';
    if ($('employee-document-type')) $('employee-document-type').value = '';
    await loadEmployeeDocuments(employeeId);
    await logAction('upload_document', `Documento enviado para ${state.editingEmployee?.full_name || employeeId}`);
  } catch (e) {
    alert(`Erro ao enviar documento: ${e.message}`);
  }
}

async function saveEmployee(event) {
  event.preventDefault();

  if (!state.supabase) return alert('Configure a conexão com o Supabase antes de salvar.');

  const cpfInformado = $('cpf')?.value.trim() || '';
  if (!validarCPF(cpfInformado)) {
    alert('CPF inválido. Verifique o número digitado.');
    $('cpf')?.focus();
    validarCampoCPF();
    return;
  }

  const id = $('employee-id')?.value || crypto.randomUUID();

  const payload = {
    nationality: $('nationality')?.value.trim() || '',
place_of_birth: $('place-of-birth')?.value.trim() || '',
marital_status: $('marital-status')?.value || '',
dependents: $('dependents')?.value.trim() || '',
    id,
    full_name: $('full-name')?.value.trim() || '',
    status: $('status')?.value || 'ativo',
    cpf: cpfInformado,
    rg: $('rg')?.value.trim() || '',
    birth_date: $('birth-date')?.value || null,
    phone: $('phone')?.value.trim() || '',
    mobile: $('mobile')?.value.trim() || '',
    email: $('email')?.value.trim() || '',
    cep: $('cep')?.value.trim() || '',
    address_street: $('address-street')?.value.trim() || '',
    address_number: $('address-number')?.value.trim() || '',
    address_complement: $('address-complement')?.value.trim() || '',
    address_neighborhood: $('address-neighborhood')?.value.trim() || '',
    address_city: $('address-city')?.value.trim() || '',
    address_state: $('address-state')?.value.trim() || '',
    emergency_name: $('emergency-name')?.value.trim() || '',
    emergency_phone: $('emergency-phone')?.value.trim() || '',
    role: $('role')?.value.trim() || '',
    sector: $('sector')?.value.trim() || '',
    hire_date: $('hire-date')?.value || null,
    contract_type: $('contract-type')?.value.trim() || '',
    salary: Number($('salary')?.value || 0),
    trial_days: Number($('trial-days')?.value || 90),
    notes: $('notes')?.value.trim() || '',
    updated_at: new Date().toISOString()
  };

  try {
    if (state.currentPhotoFile) {
      const s = getJSON(STORAGE_KEYS.settings, {});
      payload.photo_url = await uploadFileToBucket(state.currentPhotoFile, s.photoBucket || 'employee-photos', `photo-${id}`);
    } else if (state.editingEmployee?.photo_url) {
      payload.photo_url = state.editingEmployee.photo_url;
    }

    if (!state.editingEmployee) payload.created_at = new Date().toISOString();

    const { error } = await state.supabase.from('employees').upsert(payload);
    if (error) throw error;

    await logAction(state.editingEmployee ? 'edit_employee' : 'create_employee', `${payload.full_name} (${payload.status})`);
    closeEmployeeModal();
    await loadEmployees();
  } catch (e) {
    alert(`Erro ao salvar funcionário: ${e.message}`);
  }
}

async function setEmployeeStatus(id, status) {
  const emp = state.employees.find(e => e.id === id);
  if (!emp || !state.supabase) return;

  try {
    const { error } = await state.supabase
      .from('employees')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    await logAction('status_employee', `${emp.full_name} alterado para ${status}`);
    await loadEmployees();
  } catch (e) {
    alert(`Erro ao alterar status: ${e.message}`);
  }
}

async function deleteEmployee(id) {
  const emp = state.employees.find(e => e.id === id);
  if (!emp || !state.supabase) return;

  if (!confirm(`Excluir definitivamente ${emp.full_name}? Essa ação não pode ser desfeita.`)) return;

  try {
    await state.supabase.from('employee_documents').delete().eq('employee_id', id);

    const { error } = await state.supabase.from('employees').delete().eq('id', id);
    if (error) throw error;

    await logAction('delete_employee', `${emp.full_name} foi excluído definitivamente`);
    await loadEmployees();
  } catch (e) {
    alert(`Erro ao excluir: ${e.message}`);
  }
}

async function deleteEmployeeDocument(id) {
  if (!confirm('Excluir este documento?')) return;

  try {
    const { error } = await state.supabase
      .from('employee_documents')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await loadEmployeeDocuments(state.editingEmployee.id);
  } catch (e) {
    alert('Erro ao excluir documento: ' + e.message);
  }
}

window.editEmployee = (id) => {
  const emp = state.employees.find(e => e.id === id);
  if (emp) openEmployeeModal(emp);
};

window.setEmployeeStatus = setEmployeeStatus;
window.deleteEmployee = deleteEmployee;

async function searchCEP() {
  const cep = $('cep')?.value.replace(/\D/g, '') || '';
  if (cep.length !== 8) return alert('Digite um CEP válido.');

  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const d = await r.json();

    if (d.erro) throw new Error('CEP não encontrado.');

    if ($('address-street')) $('address-street').value = d.logradouro || '';
    if ($('address-neighborhood')) $('address-neighborhood').value = d.bairro || '';
    if ($('address-city')) $('address-city').value = d.localidade || '';
    if ($('address-state')) $('address-state').value = d.uf || '';
  } catch (e) {
    alert(e.message || 'Não foi possível consultar o CEP.');
  }
}

function bindMasks() {
  if ($('cpf')) {
    $('cpf').addEventListener('input', e => {
      e.target.value = maskCPF(e.target.value);
      e.target.setCustomValidity('');
      e.target.style.borderColor = '';
    });
    $('cpf').addEventListener('blur', validarCampoCPF);
  }

  if ($('rg')) $('rg').addEventListener('input', e => e.target.value = maskRG(e.target.value));
  if ($('phone')) $('phone').addEventListener('input', e => e.target.value = maskPhone(e.target.value));
  if ($('mobile')) $('mobile').addEventListener('input', e => e.target.value = maskPhone(e.target.value));
  if ($('emergency-phone')) $('emergency-phone').addEventListener('input', e => e.target.value = maskPhone(e.target.value));
  if ($('cep')) $('cep').addEventListener('input', e => e.target.value = maskCEP(e.target.value));
  if ($('cep')) $('cep').addEventListener('blur', searchCEP);
}

function loadTemplatesIntoUI() {
  const templates = getJSON(STORAGE_KEYS.templates, []);
  const use = templates.length ? templates : DEFAULT_TEMPLATES;

  if (!templates.length) setJSON(STORAGE_KEYS.templates, DEFAULT_TEMPLATES);

  if ($('doc-template-select')) {
    $('doc-template-select').innerHTML = use.map((t, i) => `<option value="${i}">${t.name}</option>`).join('');
  }

  if ($('templates-list')) {
    $('templates-list').innerHTML = use.map((t, i) => `
      <div class="list-item">
        <strong>${t.name}</strong><br>
        <button class="secondary mt-12" onclick="window.loadTemplateToForm(${i})">Editar modelo</button>
      </div>
    `).join('');
  }
}

window.loadTemplateToForm = (i) => {
  const t = getJSON(STORAGE_KEYS.templates, DEFAULT_TEMPLATES)[i];
  if (t) {
    if ($('template-name')) $('template-name').value = t.name;
    if ($('template-content')) $('template-content').value = t.content;
  }
};

function saveTemplateFromForm() {
  const name = $('template-name')?.value.trim() || '';
  const content = $('template-content')?.value.trim() || '';

  if (!name || !content) return alert('Preencha nome e conteúdo do modelo.');

  const t = getJSON(STORAGE_KEYS.templates, DEFAULT_TEMPLATES);
  const i = t.findIndex(x => x.name.toLowerCase() === name.toLowerCase());
  const item = { name, content };

  if (i >= 0) t[i] = item;
  else t.push(item);

  setJSON(STORAGE_KEYS.templates, t);
  loadTemplatesIntoUI();
  if ($('template-name')) $('template-name').value = '';
  if ($('template-content')) $('template-content').value = '';
}

function renderDocumentPreview() {
  const employeeId = $('doc-employee-select')?.value || '';
  const templateIndex = $('doc-template-select')?.value || 0;
  const emp = state.employees.find(e => e.id === employeeId);
  const t = getJSON(STORAGE_KEYS.templates, DEFAULT_TEMPLATES)[templateIndex] || DEFAULT_TEMPLATES[0];

  if (!emp || !t) {
    if ($('doc-preview')) $('doc-preview').textContent = 'Selecione um funcionário e um modelo.';
    return;
  }

  let text = t.content;
  const vars = {
    full_name: emp.full_name || '',
    cpf: emp.cpf || '',
    rg: emp.rg || '',
    role: emp.role || '',
    sector: emp.sector || '',
    address: employeeAddress(emp),
    mobile: emp.mobile || '',
    hire_date: formatDate(emp.hire_date),
    trial_days: emp.trial_days || 90,
    today: new Date().toLocaleDateString('pt-BR')
  };

  Object.entries(vars).forEach(([k, v]) => text = text.replaceAll(`{{${k}}}`, v ?? ''));
  if ($('doc-preview')) $('doc-preview').textContent = text;
}

function printPreview() {
  const html = $('doc-preview')?.textContent || '';
  const w = window.open('', '_blank');
  w.document.write(`<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;padding:24px;line-height:1.5">${html.replaceAll('<', '&lt;')}</pre>`);
  w.document.close();
  w.print();
}

function generateEmployeePdf() {
  const employeeId = $('employee-id')?.value;
  if (!employeeId) return alert('Salve o funcionário antes de gerar a ficha em PDF.');

  const emp = state.employees.find(e => e.id === employeeId);
  if (!emp) return alert('Funcionário não encontrado.');

  const w = window.open('', '_blank');

  const photoHtml = emp.photo_url
    ? `<img src="${emp.photo_url}" style="width:120px;height:120px;object-fit:cover;border-radius:8px;border:1px solid #ccc;">`
    : `<div style="width:120px;height:120px;border:1px solid #ccc;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#666;">Sem foto</div>`;

  const docsHtml = (state.currentDocuments && state.currentDocuments.length)
    ? state.currentDocuments.map(doc => `
        <tr>
          <td style="padding:8px;border:1px solid #ccc;">${doc.document_type || 'Documento'}</td>
          <td style="padding:8px;border:1px solid #ccc;">
            <a href="${doc.file_url}" target="_blank">Abrir arquivo</a>
          </td>
        </tr>
      `).join('')
    : `<tr><td colspan="2" style="padding:8px;border:1px solid #ccc;">Nenhum documento anexado.</td></tr>`;

  w.document.write(`
    <html>
    <head>
      <title>Ficha do Funcionário</title>
    </head>
    <body style="font-family:Arial,sans-serif;padding:24px;color:#222;">
      <h1 style="margin-bottom:8px;">Ficha do Funcionário</h1>
      <p style="margin-top:0;color:#666;">Empório Pet RH</p>

      <div style="display:flex;gap:24px;align-items:flex-start;margin-bottom:24px;">
        <div>${photoHtml}</div>
        <div>
          <p><strong>Nome:</strong> ${emp.full_name || '-'}</p>
          <p><strong>Status:</strong> ${emp.status || '-'}</p>
          <p><strong>CPF:</strong> ${emp.cpf || '-'}</p>
          <p><strong>RG:</strong> ${emp.rg || '-'}</p>
          <p><strong>Data de nascimento:</strong> ${formatDate(emp.birth_date) || '-'}</p>
          <p><strong>Telefone:</strong> ${emp.phone || '-'}</p>
          <p><strong>Celular:</strong> ${emp.mobile || '-'}</p>
          <p><strong>E-mail:</strong> ${emp.email || '-'}</p>
        </div>
      </div>

      <h2>Endereço</h2>
      <p>${employeeAddress(emp) || '-'}</p>
      <p><strong>CEP:</strong> ${emp.cep || '-'}</p>

      <h2>Dados profissionais</h2>
      <p><strong>Cargo:</strong> ${emp.role || '-'}</p>
      <p><strong>Setor:</strong> ${emp.sector || '-'}</p>
      <p><strong>Admissão:</strong> ${formatDate(emp.hire_date) || '-'}</p>
      <p><strong>Contrato:</strong> ${emp.contract_type || '-'}</p>
      <p><strong>Salário:</strong> ${emp.salary ? Number(emp.salary).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</p>
      <p><strong>Período de experiência:</strong> ${emp.trial_days || '-'} dias</p>
      <p><strong>Observações:</strong> ${emp.notes || '-'}</p>

      <h2>Documentos anexados</h2>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="padding:8px;border:1px solid #ccc;text-align:left;">Tipo</th>
            <th style="padding:8px;border:1px solid #ccc;text-align:left;">Arquivo</th>
          </tr>
        </thead>
        <tbody>
          ${docsHtml}
        </tbody>
      </table>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `);

  w.document.close();
}

const loadDefaultTemplates = () => {
  setJSON(STORAGE_KEYS.templates, DEFAULT_TEMPLATES);
  loadTemplatesIntoUI();
};

function exportCsv(rows, filename) {
  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

const exportEmployeesCsv = (detailed = false) => exportCsv([
  ...(detailed
    ? [['Nome', 'Status', 'CPF', 'RG', 'Nascimento', 'Telefone', 'Celular', 'Email', 'Cargo', 'Setor', 'Admissão', 'Contrato', 'Salário', 'CEP', 'Endereço', 'Emergência', 'Tel. Emergência', 'Observações']]
    : [['Nome', 'Status', 'Cargo', 'Setor', 'CPF', 'Celular']]
  ),
  ...state.employees.map(e => detailed
    ? [e.full_name, e.status, e.cpf, e.rg, formatDate(e.birth_date), e.phone, e.mobile, e.email, e.role, e.sector, formatDate(e.hire_date), e.contract_type, e.salary, e.cep, employeeAddress(e), e.emergency_name, e.emergency_phone, e.notes]
    : [e.full_name, e.status, e.role, e.sector, e.cpf, e.mobile]
  )
], detailed ? 'funcionarios-completo.csv' : 'funcionarios.csv');

const exportHistoryCsv = () => exportCsv(
  [['Ação', 'Detalhes', 'Usuário', 'Data'], ...getJSON(STORAGE_KEYS.history, []).map(h => [h.action, h.details, h.user_email, new Date(h.created_at).toLocaleString('pt-BR')])],
  'historico-rh.csv'
);

function registerPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

function bindIfExists(id, eventName, handler) {
  const el = $(id);
  if (el) el.addEventListener(eventName, handler);
}

function bindEvents() {
  bindIfExists('toggle-login-pass', 'click', () => {
    if ($('login-password')) {
      $('login-password').type = $('login-password').type === 'password' ? 'text' : 'password';
    }
  });

  bindIfExists('btn-create-admin', 'click', handleCreateAdmin);
  bindIfExists('btn-login', 'click', handleLogin);
  bindIfExists('btn-logout', 'click', logout);

  $$('.nav-btn').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));

  bindIfExists('btn-unlock-settings', 'click', unlockSettings);
  bindIfExists('btn-save-settings', 'click', saveConnectionSettings);
  bindIfExists('btn-test-connection', 'click', testConnection);
  bindIfExists('btn-refresh', 'click', loadEmployees);
  bindIfExists('btn-new-employee', 'click', () => openEmployeeModal());

  const employeeForm = $('employee-form');
  if (employeeForm) employeeForm.addEventListener('submit', saveEmployee);

  bindIfExists('btn-search-cep', 'click', searchCEP);
  bindIfExists('search-employee', 'input', renderEmployees);
  bindIfExists('filter-status', 'change', renderEmployees);

  bindIfExists('btn-select-photo', 'click', () => $('employee-photo-file')?.click());
  bindIfExists('btn-camera-photo', 'click', () => $('employee-photo-camera')?.click());

  bindIfExists('employee-photo-file', 'change', (e) => {
    state.currentPhotoFile = e.target.files[0];
    if (state.currentPhotoFile) updatePhotoPreview(URL.createObjectURL(state.currentPhotoFile));
  });

  bindIfExists('employee-photo-camera', 'change', (e) => {
    state.currentPhotoFile = e.target.files[0];
    if (state.currentPhotoFile) updatePhotoPreview(URL.createObjectURL(state.currentPhotoFile));
  });

  bindIfExists('btn-remove-photo', 'click', () => {
    state.currentPhotoFile = null;
    updatePhotoPreview('');
  });

  $$('.tab-btn').forEach(btn => btn.addEventListener('click', () => activateTab(btn.dataset.tab)));

  bindIfExists('btn-upload-document', 'click', uploadEmployeeDocument);

  $$('[data-close-modal="true"]').forEach(el => el.addEventListener('click', closeEmployeeModal));

  bindIfExists('btn-save-template', 'click', saveTemplateFromForm);
  bindIfExists('btn-load-default-templates', 'click', loadDefaultTemplates);
  bindIfExists('btn-render-doc', 'click', renderDocumentPreview);
  bindIfExists('btn-print-doc', 'click', printPreview);
  bindIfExists('btn-generate-employee-pdf', 'click', generateEmployeePdf);
  bindIfExists('btn-export-csv', 'click', () => exportEmployeesCsv(false));
  bindIfExists('btn-export-detailed-csv', 'click', () => exportEmployeesCsv(true));
  bindIfExists('btn-export-history-csv', 'click', exportHistoryCsv);
}

function bootstrap() {
  bindEvents();
  bindMasks();
  initSignaturePad();
  setupLoginScreen();

  const session = getJSON(STORAGE_KEYS.session, null);
  if (session && getJSON(STORAGE_KEYS.admin, null)) {
    showApp();
  } else {
    showLogin();
  }

  updateSettingsLockUI();
  registerPWA();
}

document.addEventListener('DOMContentLoaded', bootstrap);
