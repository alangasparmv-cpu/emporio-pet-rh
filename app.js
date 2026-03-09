const APP_STORAGE_KEY = 'emporio_pet_rh_config_v4';

const state = {
  client: null,
  employees: [],
  filteredEmployees: [],
  photoFile: null,
  photoRemoved: false,
  editingId: null,
  config: {
    url: '',
    key: '',
    bucket: 'employee-photos',
  },
};

const $ = (id) => document.getElementById(id);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const fields = {
  employeeId: $('employeeId'),
  full_name: $('full_name'),
  birth_date: $('birth_date'),
  cpf: $('cpf'),
  rg: $('rg'),
  phone: $('phone'),
  mobile: $('mobile'),
  email: $('email'),
  address: $('address'),
  role: $('role'),
  sector: $('sector'),
  hire_date: $('hire_date'),
  status: $('status'),
  contract_type: $('contract_type'),
  salary: $('salary'),
  emergency_name: $('emergency_name'),
  emergency_phone: $('emergency_phone'),
  notes: $('notes'),
};

function showToast(message, isError = false) {
  const toast = $('toast');
  toast.textContent = message;
  toast.style.background = isError ? '#8b1e1e' : '#111827';
  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function saveConfig() {
  localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(state.config));
}

function loadConfig() {
  try {
    const raw = localStorage.getItem(APP_STORAGE_KEY);
    if (!raw) return;
    const cfg = JSON.parse(raw);
    state.config = { ...state.config, ...cfg };
  } catch (_) {}
}

function fillSettingsForm() {
  $('supabaseUrl').value = state.config.url || '';
  $('supabaseKey').value = state.config.key || '';
  $('storageBucket').value = state.config.bucket || 'employee-photos';
}

function updateCloudStatus(connected) {
  const status = $('cloudStatus');
  status.textContent = connected ? 'Conectado' : 'Desconectado';
  status.className = `cloud-status ${connected ? 'online' : 'offline'}`;
}

function switchView(view) {
  const map = {
    dashboard: ['Dashboard', 'Visão geral da equipe e alertas importantes.'],
    employees: ['Funcionários', 'Busca, filtros e lista completa da equipe.'],
    new: [state.editingId ? 'Editar funcionário' : 'Novo funcionário', 'Cadastro completo de colaboradores.'],
    settings: ['Configurações', 'Conexão do sistema com o Supabase.'],
  };
  $$('.view').forEach(v => v.classList.remove('active'));
  $(`#view-${view}`).classList.add('active');
  $$('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  $('pageTitle').textContent = map[view][0];
  $('pageSubtitle').textContent = map[view][1];
}

function normalize(text) {
  return (text || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function onlyDigits(value) {
  return (value || '').replace(/\D/g, '');
}

function maskCPF(value) {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskRG(value) {
  const digits = onlyDigits(value).slice(0, 9);
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1})$/, '$1-$2');
}

function maskPhone(value) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return '—';
  return `${d}/${m}/${y}`;
}

function formatCurrency(value) {
  const num = Number(value || 0);
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseCurrency(value) {
  if (!value) return 0;
  const cleaned = value.toString().replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, '');
  return Number(cleaned || 0);
}

function formatCurrencyInput(value) {
  const num = parseCurrency(value);
  return num ? num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
}

function isValidCPF(cpf) {
  const clean = onlyDigits(cpf);
  if (clean.length !== 11 || /^(\d)\1+$/.test(clean)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(clean[i]) * (10 - i);
  let digit1 = 11 - (sum % 11);
  if (digit1 >= 10) digit1 = 0;
  if (digit1 !== Number(clean[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(clean[i]) * (11 - i);
  let digit2 = 11 - (sum % 11);
  if (digit2 >= 10) digit2 = 0;
  return digit2 === Number(clean[10]);
}

function applyMasks() {
  fields.cpf.addEventListener('input', (e) => e.target.value = maskCPF(e.target.value));
  fields.rg.addEventListener('input', (e) => e.target.value = maskRG(e.target.value));
  [fields.phone, fields.mobile, fields.emergency_phone].forEach(input => {
    input.addEventListener('input', (e) => e.target.value = maskPhone(e.target.value));
  });
  fields.salary.addEventListener('blur', (e) => e.target.value = formatCurrencyInput(e.target.value));
}

function clearPhotoPreview() {
  $('photoPreview').src = '';
  $('photoPreview').style.display = 'none';
  $('photoPlaceholder').classList.remove('hidden');
}

function setPhotoPreview(src) {
  if (!src) return clearPhotoPreview();
  $('photoPreview').src = src;
  $('photoPreview').style.display = 'block';
  $('photoPlaceholder').classList.add('hidden');
}

function resetForm() {
  $('employeeForm').reset();
  fields.employeeId.value = '';
  state.editingId = null;
  state.photoFile = null;
  state.photoRemoved = false;
  clearPhotoPreview();
  $('formTitle').textContent = 'Cadastro de funcionário';
  $('btnCancelEdit').classList.add('hidden');
  switchView('new');
}

function fillRoleSuggestions() {
  const set = new Set(state.employees.map(emp => emp.role).filter(Boolean));
  $('roleSuggestions').innerHTML = [...set].sort().map(role => `<option value="${role}"></option>`).join('');
}

function getTrialDaysLeft(hireDate) {
  if (!hireDate) return null;
  const start = new Date(`${hireDate}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 90);
  const diff = Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24));
  return diff;
}

function buildInfoLines(employee) {
  return [
    employee.cpf ? `CPF: ${employee.cpf}` : null,
    employee.mobile ? `Celular: ${employee.mobile}` : employee.phone ? `Telefone: ${employee.phone}` : null,
    employee.hire_date ? `Admissão: ${formatDate(employee.hire_date)}` : null,
    employee.salary ? `Salário: ${formatCurrency(employee.salary)}` : null,
  ].filter(Boolean);
}

function employeeCard(employee) {
  const tpl = $('employeeCardTemplate').content.firstElementChild.cloneNode(true);
  const avatar = tpl.querySelector('.employee-avatar');
  avatar.src = employee.photo_url || 'https://placehold.co/120x120?text=Foto';
  tpl.querySelector('h4').textContent = employee.full_name || 'Sem nome';
  tpl.querySelector('.employee-role').textContent = employee.role || 'Cargo não informado';
  tpl.querySelector('.employee-sector').textContent = employee.sector || 'Setor não informado';
  const pill = tpl.querySelector('.status-pill');
  pill.textContent = (employee.status || 'ativo').replace(/^./, c => c.toUpperCase());
  pill.classList.add(employee.status || 'ativo');
  tpl.querySelector('.employee-info').innerHTML = buildInfoLines(employee).map(line => `<div>${line}</div>`).join('');
  tpl.querySelector('.btn-edit').addEventListener('click', () => startEdit(employee.id));
  return tpl;
}

function renderEmployees() {
  const list = $('employeeList');
  list.innerHTML = '';
  const filtered = filterEmployees();
  state.filteredEmployees = filtered;
  $('listCount').textContent = `${filtered.length} registro${filtered.length === 1 ? '' : 's'}`;

  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state-inline">Nenhum funcionário encontrado com os filtros aplicados.</div>';
    return;
  }
  filtered.forEach(employee => list.appendChild(employeeCard(employee)));
}

function filterEmployees() {
  const q = normalize($('searchInput').value);
  const status = normalize($('filterStatus').value);
  const sector = normalize($('filterSector').value);
  const role = normalize($('filterRole').value);

  return state.employees.filter(emp => {
    const hay = normalize([
      emp.full_name, emp.cpf, emp.role, emp.sector, emp.phone, emp.mobile, emp.email
    ].join(' '));
    const matchesQ = !q || hay.includes(q);
    const matchesStatus = !status || normalize(emp.status) === status;
    const matchesSector = !sector || normalize(emp.sector).includes(sector);
    const matchesRole = !role || normalize(emp.role).includes(role);
    return matchesQ && matchesStatus && matchesSector && matchesRole;
  });
}

function renderDashboard() {
  const total = state.employees.length;
  const active = state.employees.filter(e => e.status === 'ativo').length;
  const trial = state.employees.filter(e => e.status === 'experiencia').length;
  const inactive = state.employees.filter(e => e.status === 'desligado').length;

  $('statTotal').textContent = total;
  $('statActive').textContent = active;
  $('statTrial').textContent = trial;
  $('statInactive').textContent = inactive;

  const alerts = $('trialAlerts');
  const peopleInTrial = state.employees
    .filter(e => e.status === 'experiencia' && e.hire_date)
    .map(e => ({ ...e, daysLeft: getTrialDaysLeft(e.hire_date) }))
    .filter(e => e.daysLeft !== null && e.daysLeft <= 30)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  alerts.innerHTML = peopleInTrial.length
    ? peopleInTrial.map(emp => `
      <div class="list-item">
        <div>
          <strong>${emp.full_name}</strong>
          <div class="muted">Admissão: ${formatDate(emp.hire_date)}</div>
        </div>
        <div><strong>${emp.daysLeft < 0 ? 'Vencido' : emp.daysLeft + ' dias'}</strong></div>
      </div>`).join('')
    : 'Nenhum alerta no momento.';

  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const birthdays = state.employees
    .filter(e => e.birth_date && e.birth_date.slice(5, 7) === month)
    .sort((a, b) => a.birth_date.slice(8, 10).localeCompare(b.birth_date.slice(8, 10)));

  $('birthdayList').innerHTML = birthdays.length
    ? birthdays.map(emp => `
      <div class="list-item">
        <div>
          <strong>${emp.full_name}</strong>
          <div class="muted">${emp.role || 'Cargo não informado'}</div>
        </div>
        <div><strong>${emp.birth_date.slice(8, 10)}/${emp.birth_date.slice(5, 7)}</strong></div>
      </div>`).join('')
    : 'Nenhum aniversariante encontrado.';

  const recent = [...state.employees]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 6);
  const recentEl = $('recentEmployees');
  recentEl.innerHTML = '';
  if (!recent.length) {
    recentEl.innerHTML = '<div class="empty-state-inline">Nenhum cadastro recente.</div>';
  } else {
    recent.forEach(emp => recentEl.appendChild(employeeCard(emp)));
  }
}

function renderAll() {
  fillRoleSuggestions();
  renderEmployees();
  renderDashboard();
}

async function initSupabase() {
  if (!state.config.url || !state.config.key) {
    updateCloudStatus(false);
    return false;
  }
  try {
    state.client = window.supabase.createClient(state.config.url, state.config.key);
    const { error } = await state.client.from('employees').select('id').limit(1);
    if (error) throw error;
    updateCloudStatus(true);
    return true;
  } catch (error) {
    updateCloudStatus(false);
    showToast(`Falha ao conectar no Supabase: ${error.message}`, true);
    return false;
  }
}

async function loadEmployees() {
  if (!state.client) return;
  const { data, error } = await state.client
    .from('employees')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    showToast(`Erro ao carregar funcionários: ${error.message}`, true);
    return;
  }
  state.employees = data || [];
  renderAll();
}

async function uploadPhotoIfNeeded(existingUrl = '') {
  if (!state.client) return existingUrl || '';
  if (state.photoRemoved) return '';
  if (!state.photoFile) return existingUrl || '';

  const ext = (state.photoFile.name.split('.').pop() || 'jpg').toLowerCase();
  const fileName = `employee-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const bucket = state.config.bucket || 'employee-photos';

  const { error: uploadError } = await state.client.storage
    .from(bucket)
    .upload(fileName, state.photoFile, { upsert: false, cacheControl: '3600' });

  if (uploadError) throw uploadError;

  const { data } = state.client.storage.from(bucket).getPublicUrl(fileName);
  return data.publicUrl;
}

function collectFormData() {
  const payload = {
    full_name: fields.full_name.value.trim(),
    birth_date: fields.birth_date.value || null,
    cpf: fields.cpf.value.trim() || null,
    rg: fields.rg.value.trim() || null,
    phone: fields.phone.value.trim() || null,
    mobile: fields.mobile.value.trim() || null,
    email: fields.email.value.trim() || null,
    address: fields.address.value.trim() || null,
    role: fields.role.value.trim() || null,
    sector: fields.sector.value.trim() || null,
    hire_date: fields.hire_date.value || null,
    status: fields.status.value || 'ativo',
    contract_type: fields.contract_type.value || 'clt',
    salary: parseCurrency(fields.salary.value || 0),
    emergency_name: fields.emergency_name.value.trim() || null,
    emergency_phone: fields.emergency_phone.value.trim() || null,
    notes: fields.notes.value.trim() || null,
    updated_at: new Date().toISOString(),
  };

  if (!payload.full_name) throw new Error('Informe o nome completo.');
  if (payload.cpf && !isValidCPF(payload.cpf)) throw new Error('CPF inválido. Verifique o número digitado.');
  return payload;
}

async function saveEmployee(event) {
  event.preventDefault();
  if (!state.client) {
    showToast('Configure o Supabase antes de salvar.', true);
    switchView('settings');
    return;
  }

  try {
    const payload = collectFormData();
    const current = state.employees.find(emp => emp.id === state.editingId);
    payload.photo_url = await uploadPhotoIfNeeded(current?.photo_url || '');

    let response;
    if (state.editingId) {
      response = await state.client
        .from('employees')
        .update(payload)
        .eq('id', state.editingId)
        .select()
        .single();
    } else {
      payload.created_at = new Date().toISOString();
      response = await state.client
        .from('employees')
        .insert(payload)
        .select()
        .single();
    }

    if (response.error) throw response.error;

    showToast(state.editingId ? 'Funcionário atualizado com sucesso.' : 'Funcionário cadastrado com sucesso.');
    resetForm();
    await loadEmployees();
    switchView('employees');
  } catch (error) {
    showToast(error.message || 'Erro ao salvar funcionário.', true);
  }
}

function startEdit(id) {
  const employee = state.employees.find(emp => emp.id === id);
  if (!employee) return;
  state.editingId = id;
  fields.employeeId.value = id;
  fields.full_name.value = employee.full_name || '';
  fields.birth_date.value = employee.birth_date || '';
  fields.cpf.value = employee.cpf || '';
  fields.rg.value = employee.rg || '';
  fields.phone.value = employee.phone || '';
  fields.mobile.value = employee.mobile || '';
  fields.email.value = employee.email || '';
  fields.address.value = employee.address || '';
  fields.role.value = employee.role || '';
  fields.sector.value = employee.sector || '';
  fields.hire_date.value = employee.hire_date || '';
  fields.status.value = employee.status || 'ativo';
  fields.contract_type.value = employee.contract_type || 'clt';
  fields.salary.value = employee.salary ? formatCurrencyInput(employee.salary) : '';
  fields.emergency_name.value = employee.emergency_name || '';
  fields.emergency_phone.value = employee.emergency_phone || '';
  fields.notes.value = employee.notes || '';
  setPhotoPreview(employee.photo_url || '');
  state.photoFile = null;
  state.photoRemoved = false;
  $('formTitle').textContent = `Editar funcionário: ${employee.full_name}`;
  $('btnCancelEdit').classList.remove('hidden');
  switchView('new');
}

function bindEvents() {
  $$('.nav-btn').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
  $('btnOpenSettings').addEventListener('click', () => switchView('settings'));
  $('btnNewEmployeeTop').addEventListener('click', () => resetForm());
  $('btnRefresh').addEventListener('click', loadEmployees);
  $('btnCancelEdit').addEventListener('click', resetForm);
  $('employeeForm').addEventListener('submit', saveEmployee);

  $('photoInput').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    state.photoFile = file;
    state.photoRemoved = false;
    setPhotoPreview(URL.createObjectURL(file));
  });

  $('btnRemovePhoto').addEventListener('click', () => {
    state.photoFile = null;
    state.photoRemoved = true;
    clearPhotoPreview();
  });

  ['searchInput', 'filterStatus', 'filterSector', 'filterRole'].forEach(id => {
    $(id).addEventListener('input', renderEmployees);
    $(id).addEventListener('change', renderEmployees);
  });

  $('btnSaveSettings').addEventListener('click', async () => {
    state.config.url = $('supabaseUrl').value.trim();
    state.config.key = $('supabaseKey').value.trim();
    state.config.bucket = $('storageBucket').value.trim() || 'employee-photos';
    saveConfig();
    const ok = await initSupabase();
    if (ok) {
      showToast('Configurações salvas com sucesso.');
      await loadEmployees();
      switchView('dashboard');
    }
  });

  $('btnTestConnection').addEventListener('click', async () => {
    state.config.url = $('supabaseUrl').value.trim();
    state.config.key = $('supabaseKey').value.trim();
    state.config.bucket = $('storageBucket').value.trim() || 'employee-photos';
    const ok = await initSupabase();
    showToast(ok ? 'Conexão realizada com sucesso.' : 'Não foi possível conectar.', !ok);
  });
}

async function bootstrap() {
  loadConfig();
  fillSettingsForm();
  bindEvents();
  applyMasks();
  clearPhotoPreview();
  $('btnCancelEdit').classList.add('hidden');

  const connected = await initSupabase();
  if (connected) {
    await loadEmployees();
  } else {
    switchView('settings');
  }
}

bootstrap();
