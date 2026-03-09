
const APP_STORAGE_KEY = 'emporio_pet_rh_config_v6';
const TEMPLATE_STORAGE_KEY = 'emporio_pet_rh_templates_v6';

const state = {
  client: null,
  employees: [],
  filteredEmployees: [],
  documents: [],
  templates: [],
  photoFile: null,
  photoRemoved: false,
  documentFile: null,
  installPrompt: null,
  editingId: null,
  selectedEmployeeId: null,
  config: { url: '', key: '', bucket: 'employee-photos', docsBucket: 'employee-documents' }
};

const $ = (id) => document.getElementById(id);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const views = {
  dashboard: ['Dashboard', 'Visão geral da equipe, documentos e experiência.'],
  employees: ['Funcionários', 'Busca, filtros e acesso à ficha completa.'],
  new: ['Cadastro', 'Novo colaborador, edição e foto por galeria ou câmera.'],
  documents: ['Documentos', 'Modelos para impressão e anexos dos funcionários.'],
  settings: ['Configurações', 'Conexão do sistema com o Supabase.'],
  detail: ['Ficha do funcionário', 'Visualização detalhada e impressão.']
};

const defaultTemplates = [
  {
    id: crypto.randomUUID(),
    title: 'Declaração simples',
    category: 'RH',
    content: 'DECLARAÇÃO\n\nDeclaro para os devidos fins que {{full_name}}, CPF {{cpf}}, ocupa o cargo de {{role}} no setor {{sector}} desde {{hire_date_br}}.\n\nLeme/SP, {{today}}.\n\n________________________________\nResponsável'
  },
  {
    id: crypto.randomUUID(),
    title: 'Recibo de entrega de documentos',
    category: 'Admissão',
    content: 'RECIBO DE ENTREGA DE DOCUMENTOS\n\nEu, {{full_name}}, CPF {{cpf}}, confirmo a entrega dos documentos solicitados pelo Empório Pet RH nesta data {{today}}.\n\nAssinatura: ______________________________'
  }
];

function showToast(message, ms = 2200) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('show'), ms);
}

function saveConfig() {
  localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(state.config));
}

function loadConfig() {
  const raw = localStorage.getItem(APP_STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    state.config = { ...state.config, ...parsed };
  } catch {}
}

function saveTemplatesLocal() {
  localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(state.templates));
}

function loadTemplatesLocal() {
  const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
  if (!raw) {
    state.templates = [...defaultTemplates];
    saveTemplatesLocal();
    return;
  }
  try {
    state.templates = JSON.parse(raw) || [];
  } catch {
    state.templates = [...defaultTemplates];
  }
}

function switchView(view) {
  $$('.view').forEach(v => v.classList.remove('active'));
  $$('.nav-btn').forEach(b => b.classList.remove('active'));
  const viewEl = $(`view-${view}`);
  if (viewEl) viewEl.classList.add('active');
  const navBtn = document.querySelector(`.nav-btn[data-view="${view}"]`);
  if (navBtn) navBtn.classList.add('active');
  $('pageTitle').textContent = views[view]?.[0] || 'Empório Pet RH';
  $('pageSubtitle').textContent = views[view]?.[1] || '';
}

function setCloudStatus(isOnline, text = '') {
  const el = $('cloudStatus');
  el.textContent = text || (isOnline ? 'Conectado' : 'Desconectado');
  el.classList.toggle('online', !!isOnline);
  el.classList.toggle('offline', !isOnline);
}

function createClient() {
  if (!state.config.url || !state.config.key) {
    state.client = null;
    setCloudStatus(false, 'Configuração pendente');
    return null;
  }
  try {
    state.client = window.supabase.createClient(state.config.url, state.config.key);
    setCloudStatus(true, 'Conectado');
    return state.client;
  } catch (error) {
    state.client = null;
    setCloudStatus(false, 'Erro na conexão');
    showToast('Erro ao criar conexão com o Supabase');
    return null;
  }
}

function moneyBR(value) {
  const n = Number(value || 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dateBR(value) {
  if (!value) return '-';
  const [y,m,d] = String(value).split('-');
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function maskCEP(v) { return v.replace(/\D/g,'').replace(/(\d{5})(\d)/,'$1-$2').slice(0,9); }
function maskCPF(v) {
  v = v.replace(/\D/g,'').slice(0,11);
  v = v.replace(/(\d{3})(\d)/,'$1.$2');
  v = v.replace(/(\d{3})(\d)/,'$1.$2');
  v = v.replace(/(\d{3})(\d{1,2})$/,'$1-$2');
  return v;
}
function maskPhone(v) {
  v = v.replace(/\D/g,'').slice(0,11);
  if (v.length <= 10) return v.replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{4})(\d)/,'$1-$2');
  return v.replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{5})(\d)/,'$1-$2');
}
function maskRG(v) {
  v = v.replace(/[^\dxX]/g,'').slice(0,9);
  if (v.length <= 2) return v;
  if (v.length <= 5) return v.replace(/(\d{2})(\w+)/,'$1.$2');
  if (v.length <= 8) return v.replace(/(\d{2})(\w{3})(\w+)/,'$1.$2.$3');
  return v.replace(/(\d{2})(\w{3})(\w{3})(\w)/,'$1.$2.$3-$4');
}

function validateCPF(cpf) {
  cpf = String(cpf || '').replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i=0;i<9;i++) sum += Number(cpf[i]) * (10-i);
  let rev = (sum * 10) % 11; if (rev === 10) rev = 0;
  if (rev !== Number(cpf[9])) return false;
  sum = 0;
  for (let i=0;i<10;i++) sum += Number(cpf[i]) * (11-i);
  rev = (sum * 10) % 11; if (rev === 10) rev = 0;
  return rev === Number(cpf[10]);
}

function slugify(text) {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/(^-|-$)/g,'').toLowerCase();
}

function setPhotoPreview(src = '') {
  $('photoPreview').src = src || '';
  $('photoPreview').style.display = src ? 'block' : 'none';
  $('photoPlaceholder').style.display = src ? 'none' : 'grid';
}

function mergeAddress() {
  const parts = [
    $('address_street').value,
    $('address_number').value ? `, ${$('address_number').value}` : '',
    $('address_complement').value ? ` - ${$('address_complement').value}` : '',
    $('address_neighborhood').value ? ` - ${$('address_neighborhood').value}` : '',
    $('address_city').value ? ` - ${$('address_city').value}` : '',
    $('address_state').value ? `/${$('address_state').value.toUpperCase()}` : ''
  ];
  $('address').value = parts.join('').trim();
}

async function lookupCEP() {
  const cep = $('cep').value.replace(/\D/g, '');
  if (cep.length !== 8) return showToast('Digite um CEP válido com 8 números');
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await res.json();
    if (data.erro) return showToast('CEP não encontrado');
    $('address_street').value = data.logradouro || '';
    $('address_neighborhood').value = data.bairro || '';
    $('address_city').value = data.localidade || '';
    $('address_state').value = (data.uf || '').toUpperCase();
    mergeAddress();
    showToast('Endereço preenchido pelo CEP');
  } catch {
    showToast('Erro ao consultar CEP');
  }
}

function getFormPayload() {
  return {
    full_name: $('full_name').value.trim(),
    birth_date: $('birth_date').value || null,
    cpf: $('cpf').value.trim(),
    rg: $('rg').value.trim(),
    phone: $('phone').value.trim(),
    mobile: $('mobile').value.trim(),
    email: $('email').value.trim(),
    cep: $('cep').value.trim(),
    address_street: $('address_street').value.trim(),
    address_number: $('address_number').value.trim(),
    address_complement: $('address_complement').value.trim(),
    address_neighborhood: $('address_neighborhood').value.trim(),
    address_city: $('address_city').value.trim(),
    address_state: $('address_state').value.trim().toUpperCase(),
    address: $('address').value.trim(),
    role: $('role').value.trim(),
    sector: $('sector').value.trim(),
    hire_date: $('hire_date').value || null,
    status: $('status').value,
    contract_type: $('contract_type').value,
    salary: $('salary').value || 0,
    emergency_name: $('emergency_name').value.trim(),
    emergency_phone: $('emergency_phone').value.trim(),
    notes: $('notes').value.trim(),
  };
}

function resetForm() {
  $('employeeForm').reset();
  $('employeeId').value = '';
  state.editingId = null;
  state.photoFile = null;
  state.photoRemoved = false;
  setPhotoPreview('');
  $('formTitle').textContent = 'Cadastro de funcionário';
  $('status').value = 'ativo';
  $('contract_type').value = 'clt';
  switchView('new');
}

function fillForm(employee) {
  resetForm();
  state.editingId = employee.id;
  $('employeeId').value = employee.id || '';
  Object.entries(employee).forEach(([k,v]) => {
    const el = $(k);
    if (el && el.tagName !== 'IMG') el.value = v ?? '';
  });
  setPhotoPreview(employee.photo_url || '');
  $('formTitle').textContent = `Editar funcionário · ${employee.full_name || ''}`;
  mergeAddress();
  switchView('new');
}

async function uploadToStorage(bucket, file, pathPrefix = 'uploads') {
  if (!file) return null;
  if (!state.client) throw new Error('Sem conexão');
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const fileName = `${pathPrefix}/${Date.now()}-${slugify(file.name.replace(`.${ext}`, ''))}.${ext}`;
  const { error } = await state.client.storage.from(bucket).upload(fileName, file, { upsert: true });
  if (error) throw error;
  const { data } = state.client.storage.from(bucket).getPublicUrl(fileName);
  return data.publicUrl;
}

async function saveEmployee(event) {
  event.preventDefault();
  if (!state.client) return showToast('Configure o Supabase antes de salvar');
  const payload = getFormPayload();
  if (!payload.full_name) return showToast('Informe o nome do funcionário');
  if (payload.cpf && !validateCPF(payload.cpf)) return showToast('CPF inválido');
  mergeAddress();
  payload.address = $('address').value.trim();
  payload.updated_at = new Date().toISOString();
  try {
    let photoUrl = null;
    if (state.photoFile) {
      photoUrl = await uploadToStorage(state.config.bucket, state.photoFile, 'employees/photos');
      payload.photo_url = photoUrl;
    } else if (state.photoRemoved) {
      payload.photo_url = null;
    }
    let response;
    if (state.editingId) {
      response = await state.client.from('employees').update(payload).eq('id', state.editingId).select().single();
    } else {
      response = await state.client.from('employees').insert(payload).select().single();
    }
    if (response.error) throw response.error;
    showToast(state.editingId ? 'Funcionário atualizado com sucesso' : 'Funcionário cadastrado com sucesso');
    resetForm();
    await loadEmployees();
    await loadDocuments();
    switchView('employees');
  } catch (error) {
    console.error(error);
    showToast(`Erro ao salvar funcionário: ${error.message || 'verifique o banco'}`);
  }
}

async function loadEmployees() {
  if (!state.client) return;
  const { data, error } = await state.client.from('employees').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error(error);
    showToast('Erro ao carregar funcionários');
    return;
  }
  state.employees = data || [];
  state.filteredEmployees = [...state.employees];
  renderRoleSuggestions();
  syncEmployeeSelects();
  renderDashboard();
  applyFilters();
  if (state.selectedEmployeeId) {
    const employee = state.employees.find(e => e.id === state.selectedEmployeeId);
    if (employee) renderEmployeeDetail(employee);
  }
}

async function loadDocuments() {
  if (!state.client) return;
  const { data, error } = await state.client.from('employee_documents').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error(error);
    showToast('Erro ao carregar documentos');
    return;
  }
  state.documents = data || [];
  renderDocumentList();
  renderDashboard();
  if (state.selectedEmployeeId) {
    const employee = state.employees.find(e => e.id === state.selectedEmployeeId);
    if (employee) renderEmployeeDetail(employee);
  }
}

function applyFilters() {
  const search = $('searchInput').value.trim().toLowerCase();
  const status = $('filterStatus').value.trim().toLowerCase();
  const sector = $('filterSector').value.trim().toLowerCase();
  const role = $('filterRole').value.trim().toLowerCase();
  state.filteredEmployees = state.employees.filter(emp => {
    const searchable = [emp.full_name, emp.cpf, emp.role, emp.phone, emp.mobile, emp.email].join(' ').toLowerCase();
    return (!search || searchable.includes(search)) &&
      (!status || String(emp.status || '').toLowerCase() === status) &&
      (!sector || String(emp.sector || '').toLowerCase().includes(sector)) &&
      (!role || String(emp.role || '').toLowerCase().includes(role));
  });
  renderEmployeeList();
}

function getStatusClass(status='') { return ['ativo','experiencia','afastado','desligado'].includes(status) ? status : 'ativo'; }

function employeeCardHTML(emp) {
  const avatar = emp.photo_url || '';
  return `
    <article class="employee-card">
      <div class="employee-top">
        <img class="employee-avatar" src="${avatar}" onerror="this.src=''; this.style.background='#eef2f7';" alt="${emp.full_name || ''}" />
        <div class="employee-meta">
          <h4>${emp.full_name || '-'}</h4>
          <p class="employee-role">${emp.role || 'Sem cargo'}</p>
          <p class="employee-sector">${emp.sector || 'Sem setor'}</p>
        </div>
        <span class="status-pill ${getStatusClass(emp.status)}">${emp.status || 'ativo'}</span>
      </div>
      <div class="employee-info">
        <div><strong>CPF:</strong> ${emp.cpf || '-'}</div>
        <div><strong>Telefone:</strong> ${emp.mobile || emp.phone || '-'}</div>
        <div><strong>Admissão:</strong> ${dateBR(emp.hire_date)}</div>
      </div>
      <div class="employee-actions">
        <button class="btn btn-light" type="button" data-action="view" data-id="${emp.id}">Ver ficha</button>
        <button class="btn btn-primary" type="button" data-action="edit" data-id="${emp.id}">Editar</button>
      </div>
    </article>`;
}

function renderEmployeeList() {
  $('listCount').textContent = `${state.filteredEmployees.length} registro(s)`;
  const list = $('employeeList');
  if (!state.filteredEmployees.length) {
    list.innerHTML = '<div class="empty-state-inline">Nenhum funcionário encontrado.</div>';
    return;
  }
  list.innerHTML = state.filteredEmployees.map(employeeCardHTML).join('');
}

function trialDaysRemaining(hireDate) {
  if (!hireDate) return null;
  const start = new Date(`${hireDate}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 90);
  const diff = Math.ceil((end - new Date()) / 86400000);
  return diff;
}

function renderDashboard() {
  const total = state.employees.length;
  const active = state.employees.filter(e => e.status === 'ativo').length;
  const trial = state.employees.filter(e => e.status === 'experiencia').length;
  const inactive = state.employees.filter(e => e.status === 'desligado').length;
  const now = new Date();
  const month = now.getMonth() + 1;
  const birthdays = state.employees.filter(e => String(e.birth_date || '').slice(5,7) === String(month).padStart(2, '0'));
  $('statTotal').textContent = total;
  $('statActive').textContent = active;
  $('statTrial').textContent = trial;
  $('statInactive').textContent = inactive;
  $('statDocs').textContent = state.documents.length;
  $('statBirthdays').textContent = birthdays.length;

  const alerts = state.employees
    .filter(e => e.status === 'experiencia')
    .map(e => ({ ...e, days: trialDaysRemaining(e.hire_date) }))
    .filter(e => e.days !== null && e.days <= 30)
    .sort((a,b) => a.days - b.days);
  $('trialAlerts').innerHTML = alerts.length ? alerts.map(e =>
    `<div class="list-item"><div><strong>${e.full_name}</strong><div class="muted">${e.role || '-'} · admissão ${dateBR(e.hire_date)}</div></div><strong>${e.days < 0 ? 'Vencido' : `${e.days} dia(s)`}</strong></div>`
  ).join('') : 'Nenhum alerta no momento.';

  $('birthdayList').innerHTML = birthdays.length ? birthdays.map(e =>
    `<div class="list-item"><div><strong>${e.full_name}</strong><div class="muted">${e.role || '-'} · ${e.sector || '-'}</div></div><strong>${dateBR(e.birth_date).slice(0,5)}</strong></div>`
  ).join('') : 'Nenhum aniversariante encontrado.';

  $('recentEmployees').innerHTML = state.employees.slice(0,6).map(employeeCardHTML).join('') || '<div class="empty-state-inline">Nenhum funcionário cadastrado.</div>';

  $('recentDocuments').innerHTML = state.documents.length ? state.documents.slice(0,6).map(doc => {
    const emp = state.employees.find(e => e.id === doc.employee_id);
    return `<div class="list-item"><div><strong>${doc.document_type || 'Documento'}</strong><div class="muted">${emp?.full_name || 'Funcionário'} · ${new Date(doc.created_at).toLocaleDateString('pt-BR')}</div></div><a class="btn btn-light" href="${doc.file_url || '#'}" target="_blank">Abrir</a></div>`;
  }).join('') : 'Nenhum documento encontrado.';

  $('templateSummary').innerHTML = state.templates.length ? state.templates.slice(0,6).map(t =>
    `<div class="list-item"><div><strong>${t.title}</strong><div class="muted">${t.category || 'Sem categoria'}</div></div><span class="badge">Modelo</span></div>`
  ).join('') : 'Nenhum modelo cadastrado.';
}

function renderRoleSuggestions() {
  const roles = [...new Set(state.employees.map(e => e.role).filter(Boolean))].sort();
  $('roleSuggestions').innerHTML = roles.map(role => `<option value="${role}"></option>`).join('');
}

function syncEmployeeSelects() {
  const options = ['<option value="">Selecione</option>'].concat(state.employees.map(e => `<option value="${e.id}">${e.full_name}</option>`));
  ['docEmployeeSelect','uploadEmployeeSelect'].forEach(id => { $(id).innerHTML = options.join(''); });
}

function templateOptionsHTML() {
  return ['<option value="">Selecione um modelo</option>'].concat(state.templates.map(t => `<option value="${t.id}">${t.title}</option>`)).join('');
}

function renderTemplateSelectors() {
  $('templateSelect').innerHTML = templateOptionsHTML();
  $('docTemplateSelect').innerHTML = templateOptionsHTML();
}

function renderTemplateVars() {
  const vars = ['{{full_name}}','{{cpf}}','{{rg}}','{{role}}','{{sector}}','{{hire_date_br}}','{{birth_date_br}}','{{address}}','{{phone}}','{{mobile}}','{{email}}','{{status}}','{{contract_type}}','{{salary}}','{{today}}'];
  $('templateVars').innerHTML = vars.map(v => `<button class="tag" type="button" data-var="${v}">${v}</button>`).join('');
}

function clearTemplateForm() {
  $('templateSelect').value = '';
  $('templateTitle').value = '';
  $('templateCategory').value = '';
  $('templateContent').value = '';
}

function fillTemplateForm(template) {
  if (!template) return clearTemplateForm();
  $('templateSelect').value = template.id;
  $('templateTitle').value = template.title || '';
  $('templateCategory').value = template.category || '';
  $('templateContent').value = template.content || '';
}

function saveTemplate() {
  const selectedId = $('templateSelect').value;
  const payload = {
    id: selectedId || crypto.randomUUID(),
    title: $('templateTitle').value.trim(),
    category: $('templateCategory').value.trim(),
    content: $('templateContent').value.trim()
  };
  if (!payload.title || !payload.content) return showToast('Informe título e conteúdo do modelo');
  const index = state.templates.findIndex(t => t.id === payload.id);
  if (index >= 0) state.templates[index] = payload; else state.templates.unshift(payload);
  saveTemplatesLocal();
  renderTemplateSelectors();
  renderDashboard();
  $('templateSelect').value = payload.id;
  $('docTemplateSelect').value = payload.id;
  showToast('Modelo salvo com sucesso');
}

function deleteTemplate() {
  const id = $('templateSelect').value;
  if (!id) return showToast('Selecione um modelo');
  if (!confirm('Deseja excluir este modelo?')) return;
  state.templates = state.templates.filter(t => t.id !== id);
  saveTemplatesLocal();
  renderTemplateSelectors();
  renderDashboard();
  clearTemplateForm();
  showToast('Modelo excluído');
}

function buildTemplateData(employee) {
  return {
    full_name: employee.full_name || '',
    cpf: employee.cpf || '',
    rg: employee.rg || '',
    role: employee.role || '',
    sector: employee.sector || '',
    hire_date_br: dateBR(employee.hire_date),
    birth_date_br: dateBR(employee.birth_date),
    address: employee.address || '',
    phone: employee.phone || '',
    mobile: employee.mobile || '',
    email: employee.email || '',
    status: employee.status || '',
    contract_type: employee.contract_type || '',
    salary: moneyBR(employee.salary || 0),
    today: new Date().toLocaleDateString('pt-BR')
  };
}

function renderTemplateContent(templateContent, employee) {
  if (!templateContent || !employee) return '';
  const data = buildTemplateData(employee);
  return templateContent.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => data[key] ?? '');
}

function updateDocumentPreview() {
  const employee = state.employees.find(e => e.id === $('docEmployeeSelect').value);
  const template = state.templates.find(t => t.id === $('docTemplateSelect').value);
  if (!employee || !template) return showToast('Selecione funcionário e modelo');
  $('docGeneratedContent').value = renderTemplateContent(template.content, employee);
  $('docType').value = $('docType').value || template.title;
}

function printGeneratedDocument() {
  const content = $('docGeneratedContent').value.trim();
  if (!content) return showToast('Gere a pré-visualização antes de imprimir');
  const title = $('docType').value.trim() || 'Documento';
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>body{font-family:Arial,sans-serif;padding:32px;line-height:1.55;color:#111} h1{font-size:20px;margin-bottom:16px} pre{white-space:pre-wrap;font-family:Arial,sans-serif;font-size:15px}</style></head><body><h1>${title}</h1><pre>${content.replace(/</g,'&lt;')}</pre></body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

async function uploadEmployeeDocument() {
  const employeeId = $('uploadEmployeeSelect').value;
  const documentType = $('uploadDocumentType').value.trim();
  if (!state.client) return showToast('Configure o Supabase antes');
  if (!employeeId || !documentType || !state.documentFile) return showToast('Selecione funcionário, tipo e arquivo');
  try {
    const url = await uploadToStorage(state.config.docsBucket, state.documentFile, `employees/${employeeId}/documents`);
    const payload = {
      employee_id: employeeId,
      document_type: documentType,
      file_name: state.documentFile.name,
      file_url: url,
      file_size: state.documentFile.size
    };
    const { error } = await state.client.from('employee_documents').insert(payload);
    if (error) throw error;
    state.documentFile = null;
    $('documentFileInput').value = '';
    $('uploadDocumentType').value = '';
    showToast('Documento enviado com sucesso');
    await loadDocuments();
  } catch (error) {
    console.error(error);
    showToast(`Erro ao enviar documento: ${error.message || 'verifique o bucket'}`);
  }
}

function renderDocumentList() {
  const container = $('documentList');
  if (!state.documents.length) {
    container.innerHTML = '<div class="empty-state-inline">Nenhum documento salvo.</div>';
    return;
  }
  container.innerHTML = state.documents.map(doc => {
    const emp = state.employees.find(e => e.id === doc.employee_id);
    return `<article class="doc-card"><h4>${doc.document_type || 'Documento'}</h4><p class="doc-meta">${emp?.full_name || 'Funcionário não localizado'}</p><div class="doc-info"><div><strong>Arquivo:</strong> ${doc.file_name || '-'}</div><div><strong>Data:</strong> ${new Date(doc.created_at).toLocaleDateString('pt-BR')}</div></div><div class="doc-actions"><a class="btn btn-light" href="${doc.file_url || '#'}" target="_blank">Abrir</a></div></article>`;
  }).join('');
}

function openEmployeeDetail(id) {
  const employee = state.employees.find(e => e.id === id);
  if (!employee) return;
  state.selectedEmployeeId = id;
  renderEmployeeDetail(employee);
  switchView('detail');
}

function renderEmployeeDetail(employee) {
  $('detailEmpty').classList.add('hidden');
  $('detailContent').classList.remove('hidden');
  $('detailName').textContent = employee.full_name || '-';
  $('detailRoleSector').textContent = `${employee.role || 'Sem cargo'} · ${employee.sector || 'Sem setor'}`;
  $('detailStatus').textContent = employee.status || '-';
  $('detailStatus').className = `status-pill ${getStatusClass(employee.status)}`;
  $('detailContract').textContent = (employee.contract_type || '-').toUpperCase();
  $('detailPhoto').src = employee.photo_url || '';

  const documents = state.documents.filter(d => d.employee_id === employee.id);
  $('tab-personal').innerHTML = infoGrid([
    ['CPF', employee.cpf], ['RG', employee.rg], ['Nascimento', dateBR(employee.birth_date)], ['Telefone', employee.phone],
    ['Celular', employee.mobile], ['E-mail', employee.email], ['CEP', employee.cep], ['Endereço', employee.address]
  ]);
  $('tab-professional').innerHTML = infoGrid([
    ['Cargo', employee.role], ['Setor', employee.sector], ['Admissão', dateBR(employee.hire_date)], ['Status', employee.status],
    ['Contrato', employee.contract_type], ['Salário', moneyBR(employee.salary || 0)], ['Emergência', employee.emergency_name], ['Tel. emergência', employee.emergency_phone],
    ['Observações', employee.notes || '-']
  ]);
  $('tab-documents').innerHTML = documents.length ? `<div class="cards-grid">${documents.map(doc => `<article class="doc-card"><h4>${doc.document_type || 'Documento'}</h4><p class="doc-meta">${doc.file_name || '-'}</p><div class="doc-info"><div><strong>Data:</strong> ${new Date(doc.created_at).toLocaleDateString('pt-BR')}</div></div><div class="doc-actions"><a class="btn btn-light" href="${doc.file_url}" target="_blank">Abrir</a></div></article>`).join('')}</div>` : '<div class="empty-state-inline">Nenhum documento anexado para este funcionário.</div>';
  $('tab-print').innerHTML = `
    <div class="info-card"><span>Impressão rápida</span><div>Vá para a aba <strong>Documentos</strong>, escolha o funcionário <strong>${employee.full_name}</strong> e o modelo desejado. O sistema substitui automaticamente os campos do colaborador e abre a tela de impressão.</div></div>
    <div class="tag-list" style="margin-top:14px">${Object.entries(buildTemplateData(employee)).map(([k,v]) => `<span class="tag">{{${k}}}: ${v || '-'}</span>`).join('')}</div>`;
}

function infoGrid(items) {
  return `<div class="info-grid">${items.map(([label, value]) => `<div class="info-card"><span>${label}</span><div>${value || '-'}</div></div>`).join('')}</div>`;
}

async function testConnection() {
  const url = $('sbUrl').value.trim();
  const key = $('sbKey').value.trim();
  if (!url || !key) return showToast('Preencha URL e chave');
  try {
    const temp = window.supabase.createClient(url, key);
    const { error } = await temp.from('employees').select('id').limit(1);
    if (error && !String(error.message).toLowerCase().includes('relation')) throw error;
    showToast('Conexão testada com sucesso');
  } catch (error) {
    console.error(error);
    showToast(`Falha na conexão: ${error.message || 'dados inválidos'}`);
  }
}

function bindMasks() {
  $('cep').addEventListener('input', e => e.target.value = maskCEP(e.target.value));
  $('cpf').addEventListener('input', e => e.target.value = maskCPF(e.target.value));
  $('phone').addEventListener('input', e => e.target.value = maskPhone(e.target.value));
  $('mobile').addEventListener('input', e => e.target.value = maskPhone(e.target.value));
  $('emergency_phone').addEventListener('input', e => e.target.value = maskPhone(e.target.value));
  $('rg').addEventListener('input', e => e.target.value = maskRG(e.target.value));
}

function bindAddressListeners() {
  ['address_street','address_number','address_complement','address_neighborhood','address_city','address_state'].forEach(id => {
    $(id).addEventListener('input', mergeAddress);
  });
}

function bindPhotoInputs() {
  const handler = (file) => {
    if (!file) return;
    state.photoFile = file;
    state.photoRemoved = false;
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };
  $('photoInput').addEventListener('change', e => handler(e.target.files?.[0]));
  $('photoCameraInput').addEventListener('change', e => handler(e.target.files?.[0]));
  $('btnRemovePhoto').addEventListener('click', () => {
    state.photoFile = null;
    state.photoRemoved = true;
    $('photoInput').value = '';
    $('photoCameraInput').value = '';
    setPhotoPreview('');
  });
}

function bindEvents() {
  $$('.nav-btn').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
  $('btnOpenSettings').addEventListener('click', () => switchView('settings'));
  $('btnNewEmployeeTop').addEventListener('click', resetForm);
  $('btnResetFormTop').addEventListener('click', resetForm);
  $('btnResetForm').addEventListener('click', resetForm);
  $('employeeForm').addEventListener('submit', saveEmployee);
  $('btnRefresh').addEventListener('click', bootstrap);
  $('btnLookupCep').addEventListener('click', lookupCEP);
  $('cep').addEventListener('blur', lookupCEP);
  $('btnSaveConfig').addEventListener('click', async () => {
    state.config.url = $('sbUrl').value.trim();
    state.config.key = $('sbKey').value.trim();
    state.config.bucket = $('sbBucket').value.trim() || 'employee-photos';
    state.config.docsBucket = $('sbDocsBucket').value.trim() || 'employee-documents';
    saveConfig();
    createClient();
    await bootstrap();
    showToast('Configurações salvas');
  });
  $('btnTestConfig').addEventListener('click', testConnection);
  ['searchInput','filterStatus','filterSector','filterRole'].forEach(id => $(id).addEventListener('input', applyFilters));
  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'edit') {
      const employee = state.employees.find(e => e.id === id);
      if (employee) fillForm(employee);
    }
    if (btn.dataset.action === 'view') openEmployeeDetail(id);
  });
  $$('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
    $$('.tab-btn').forEach(b => b.classList.remove('active'));
    $$('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    $(`tab-${btn.dataset.tab}`).classList.add('active');
  }));
  $('btnBackToEmployees').addEventListener('click', () => switchView('employees'));
  $('btnEditFromDetail').addEventListener('click', () => {
    const emp = state.employees.find(e => e.id === state.selectedEmployeeId);
    if (emp) fillForm(emp);
  });
  $('btnSaveTemplate').addEventListener('click', saveTemplate);
  $('btnDeleteTemplate').addEventListener('click', deleteTemplate);
  $('btnNewTemplate').addEventListener('click', clearTemplateForm);
  $('templateSelect').addEventListener('change', () => fillTemplateForm(state.templates.find(t => t.id === $('templateSelect').value)));
  $('docTemplateSelect').addEventListener('change', updateDocumentPreview);
  $('docEmployeeSelect').addEventListener('change', updateDocumentPreview);
  $('btnPreviewDocument').addEventListener('click', updateDocumentPreview);
  $('btnPrintDocument').addEventListener('click', printGeneratedDocument);
  $('documentFileInput').addEventListener('change', e => state.documentFile = e.target.files?.[0] || null);
  $('btnUploadDocument').addEventListener('click', uploadEmployeeDocument);
  $('templateVars').addEventListener('click', (e) => {
    const tag = e.target.closest('[data-var]');
    if (!tag) return;
    $('templateContent').setRangeText(tag.dataset.var, $('templateContent').selectionStart, $('templateContent').selectionEnd, 'end');
    $('templateContent').focus();
  });
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.installPrompt = e;
    $('btnInstallApp').classList.remove('hidden');
  });
  $('btnInstallApp').addEventListener('click', async () => {
    if (!state.installPrompt) return;
    state.installPrompt.prompt();
    await state.installPrompt.userChoice;
    state.installPrompt = null;
    $('btnInstallApp').classList.add('hidden');
  });
}

async function bootstrap() {
  loadConfig();
  loadTemplatesLocal();
  $('sbUrl').value = state.config.url || '';
  $('sbKey').value = state.config.key || '';
  $('sbBucket').value = state.config.bucket || 'employee-photos';
  $('sbDocsBucket').value = state.config.docsBucket || 'employee-documents';
  renderTemplateSelectors();
  renderTemplateVars();
  createClient();
  if (state.client) {
    await loadEmployees();
    await loadDocuments();
  } else {
    renderDashboard();
    renderDocumentList();
  }
}

async function registerSW() {
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('./sw.js'); } catch (e) { console.warn(e); }
  }
}

bindMasks();
bindAddressListeners();
bindPhotoInputs();
bindEvents();
bootstrap();
registerSW();
