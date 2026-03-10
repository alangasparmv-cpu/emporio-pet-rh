const SUPABASE_URL = "https://xqikfrufphwaqmfuexvx.supabase.co";
const SUPABASE_KEY = "sb_publishable__-5ZX8k6kNTwQH5dvZxvMA_xVCX7-Up";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

window.login = async function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const msg = document.getElementById("msg");

  msg.innerText = "Entrando...";

  const { error } = await sb.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    msg.innerText = error.message;
    return;
  }

  msg.innerText = "Login realizado com sucesso.";
  document.getElementById("panel").classList.remove("hidden");
};

window.logout = async function () {
  await sb.auth.signOut();
  document.getElementById("panel").classList.add("hidden");
  document.getElementById("msg").innerText = "Sessão encerrada.";
};

window.loadEmployees = async function () {
  const result = document.getElementById("result");
  result.innerText = "Carregando...";

  const { data, error } = await sb
    .from("funcionarios")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    result.innerText = error.message;
    return;
  }

  result.innerText = JSON.stringify(data, null, 2);
};
