const SUPABASE_URL = "https://xqikfrufphwaqmfuexvx.supabase.co";
const SUPABASE_KEY = "sb_publishable__-5ZX8k6kNTwQH5dvZxvMA_xVCX7-Up";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

window.login = async function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const msg = document.getElementById("msg");

  if (msg) msg.innerText = "Entrando...";

  const { error } = await sb.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    if (msg) msg.innerText = error.message;
    return;
  }

  if (msg) msg.innerText = "Login realizado com sucesso.";

  const panel = document.getElementById("panel");
  if (panel) panel.style.display = "block";
};

window.logout = async function () {
  await sb.auth.signOut();

  const panel = document.getElementById("panel");
  if (panel) panel.style.display = "none";

  const msg = document.getElementById("msg");
  if (msg) msg.innerText = "Sessão encerrada.";
};

window.loadEmployees = async function () {
  const result = document.getElementById("result");
  if (result) result.innerText = "Carregando...";

  const { data, error } = await sb
    .from("funcionarios")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    if (result) result.innerText = error.message;
    return;
  }

  if (!data || data.length === 0) {
    if (result) result.innerText = "[]";
    return;
  }

  if (result) result.innerText = JSON.stringify(data, null, 2);
};
