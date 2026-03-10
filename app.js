const SUPABASE_URL = "https://xqikfrufphwaqmfuexvx.supabase.co";
const SUPABASE_KEY = "sb_publishable__-5ZX8k6kNTwQH5dvZxvMA_xVCX7-Up";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const ROLE_STORAGE_KEY = "emporio_pet_rh_roles";

function onlyDigits(value) {
  return (value || "").replace(/\D/g, "");
}

function maskCPF(value) {
  value = onlyDigits(value).slice(0, 11);
  value = value.replace(/^(\d{3})(\d)/, "$1.$2");
  value = value.replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3");
  value = value.replace(/\.(\d{3})(\d)/, ".$1-$2");
  return value;
}

function validateCPF(cpf) {
  cpf = onlyDigits(cpf);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i)) * (10 - i);
  let firstCheck = 11 - (sum % 11);
  if (firstCheck >= 10) firstCheck = 0;
  if (firstCheck !== parseInt(cpf.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i)) * (11 - i);
  let secondCheck = 11 - (sum % 11);
  if (secondCheck >= 10) secondCheck = 0;
  if (secondCheck !== parseInt(cpf.charAt(10))) return false;

  return true;
}

function maskPhone(value) {
  value = onlyDigits(value).slice(0, 10);
  if (value.length <= 2) return value.replace(/^(\d{0,2})/, "($1");
  if (value.length <= 6) return value.replace(/^(\d{2})(\d{0,4})/, "($1) $2");
  return value.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
}

function maskMobile(value) {
  value = onlyDigits(value).slice(0, 11);
  if (value.length <= 2) return value.replace(/^(\d{0,2})/, "($1");
  if (value.length <= 7) return value.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
  return value.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
}

function maskCEP(value) {
  value = onlyDigits(value).slice(0, 8);
  return value.replace(/^(\d{5})(\d{0,3})$/, "$1-$2");
}

function maskRG(value) {
  return (value || "").toUpperCase().replace(/[^0-9X.\-]/g, "").slice(0, 15);
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.innerText = text;
}

function setEmployeeMessage(text, isError = false) {
  const employeeMsg = document.getElementById("employeeMsg");
  if (!employeeMsg) return;
  employeeMsg.innerText = text;
  employeeMsg.style.color = isError ? "crimson" : "green";
}

function loadRoles() {
  const roles = JSON.parse(localStorage.getItem(ROLE_STORAGE_KEY) || "[]");
  const datalist = document.getElementById("roles_list");
  if (!datalist) return;
  datalist.innerHTML = "";
  roles.forEach(role => {
    const option = document.createElement("option");
    option.value = role;
    datalist.appendChild(option);
  });
}

function saveRole(role) {
  if (!role) return;
  const roles = JSON.parse(localStorage.getItem(ROLE_STORAGE_KEY) || "[]");
  if (!roles.includes(role)) {
    roles.push(role);
    roles.sort((a, b) => a.localeCompare(b, "pt-BR"));
    localStorage.setItem(ROLE_STORAGE_KEY, JSON.stringify(roles));
  }
  loadRoles();
}

async function fetchAddressByCEP() {
  const cepInput = document.getElementById("cep");
  if (!cepInput) return;

  const cep = onlyDigits(cepInput.value);
  if (cep.length !== 8) return;

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await response.json();

    if (data.erro) {
      setEmployeeMessage("CEP não encontrado.", true);
      return;
    }

    const fields = {
      address: data.logradouro || "",
      neighborhood: data.bairro || "",
      city: data.localidade || "",
      state: data.uf || ""
    };

    Object.entries(fields).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    });

    setEmployeeMessage("Endereço preenchido pelo CEP.");
  } catch {
    setEmployeeMessage("Erro ao buscar CEP.", true);
  }
}

function showDashboard() {
  const loginCard = document.getElementById("loginCard");
  const panel = document.getElementById("panel");

  if (loginCard) loginCard.classList.add("hidden");
  if (panel) panel.classList.remove("hidden");
}

function showLogin() {
  const loginCard = document.getElementById("loginCard");
  const panel = document.getElementById("panel");

  if (loginCard) loginCard.classList.remove("hidden");
  if (panel) panel.classList.add("hidden");
}

window.login = async function () {
  const email = document.getElementById("email")?.value.trim() || "";
  const password = document.getElementById("password")?.value || "";
  const msg = document.getElementById("msg");

  if (msg) msg.innerText = "Entrando...";

  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    if (msg) msg.innerText = "Erro: " + error.message;
    return;
  }

  if (data?.session) {
    if (msg) msg.innerText = "Login realizado com sucesso.";
    showDashboard();
    loadEmployees();
  } else {
    if (msg) msg.innerText = "Login sem sessão retornada.";
  }
};

window.logout = async function () {
  await sb.auth.signOut();
  showLogin();
  setText("msg", "Sessão encerrada.");
};

window.saveEmployee = async function () {
  const employee = {
    full_name: document.getElementById("full_name")?.value.trim() || "",
    birth_date: document.getElementById("birth_date")?.value || null,
    cpf: document.getElementById("cpf")?.value.trim() || "",
    rg: document.getElementById("rg")?.value.trim() || "",
    zip_code: document.getElementById("cep")?.value.trim() || "",
    address: document.getElementById("address")?.value.trim() || "",
    address_number: document.getElementById("address_number")?.value.trim() || "",
    address_complement: document.getElementById("address_complement")?.value.trim() || "",
    neighborhood: document.getElementById("neighborhood")?.value.trim() || "",
    city: document.getElementById("city")?.value.trim() || "",
    state: (document.getElementById("state")?.value.trim() || "").toUpperCase(),
    phone: document.getElementById("phone")?.value.trim() || "",
    mobile: document.getElementById("mobile")?.value.trim() || "",
    role: document.getElementById("role")?.value.trim() || "",
    admission_date: document.getElementById("admission_date")?.value || null,
    ctps_number: document.getElementById("ctps_number")?.value.trim() || "",
    ctps_series: document.getElementById("ctps_series")?.value.trim() || ""
  };

  if (!employee.full_name || !employee.rg || !employee.cpf || !employee.role || !employee.ctps_number || !employee.ctps_series || !employee.city || !employee.state) {
    setEmployeeMessage("Preencha todos os campos obrigatórios.", true);
    return;
  }

  if (!validateCPF(employee.cpf)) {
    setEmployeeMessage("CPF inválido. Digite um CPF válido.", true);
    return;
  }

  setEmployeeMessage("Salvando...");

  const { error } = await sb.from("employees").insert([employee]);

  if (error) {
    setEmployeeMessage("Erro ao salvar: " + error.message, true);
    return;
  }

  saveRole(employee.role);
  setEmployeeMessage("Funcionário salvo com sucesso.");

  [
    "full_name", "birth_date", "cpf", "rg", "cep", "address", "address_number",
    "address_complement", "neighborhood", "city", "state", "phone", "mobile",
    "role", "admission_date", "ctps_number", "ctps_series"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  loadEmployees();
};

window.loadEmployees = async function () {
  const result = document.getElementById("result");
  if (result) result.innerText = "Carregando...";

  const { data, error } = await sb
    .from("employees")
    .select("id, full_name, cpf, rg, role, ctps_number, ctps_series, city, state, admission_date, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    if (result) result.innerText = "Erro: " + error.message;
    return;
  }

  if (result) result.innerText = JSON.stringify(data || [], null, 2);

  const total = (data || []).length;
  setText("statTotal", total.toString());
  setText("statActive", total.toString());
  setText("statAway", "0");
  setText("statOff", "0");
  setText("statTrial", "0");
  setText("statBirthdays", "0");
};

async function checkSession() {
  const { data } = await sb.auth.getSession();
  if (data?.session) {
    showDashboard();
    setText("msg", "Sessão já iniciada.");
    loadEmployees();
  } else {
    showLogin();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadRoles();

  const cpf = document.getElementById("cpf");
  const phone = document.getElementById("phone");
  const mobile = document.getElementById("mobile");
  const cep = document.getElementById("cep");
  const rg = document.getElementById("rg");

  if (cpf) cpf.addEventListener("input", e => e.target.value = maskCPF(e.target.value));
  if (phone) phone.addEventListener("input", e => e.target.value = maskPhone(e.target.value));
  if (mobile) mobile.addEventListener("input", e => e.target.value = maskMobile(e.target.value));
  if (cep) {
    cep.addEventListener("input", e => e.target.value = maskCEP(e.target.value));
    cep.addEventListener("blur", fetchAddressByCEP);
  }
  if (rg) rg.addEventListener("input", e => e.target.value = maskRG(e.target.value));

  checkSession();
});
