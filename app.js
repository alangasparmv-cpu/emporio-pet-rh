window.addEventListener("load", function () {
  const SUPABASE_URL = "https://xqikfrufphwaqmfuexvx.supabase.co";
  const SUPABASE_KEY = "sb_publishable__-5ZX8k6kNTwQH5dvZxvMA_xVCX7-Up";

  if (!window.supabase) {
    const msg = document.getElementById("msg");
    if (msg) {
      msg.innerText = "Erro: biblioteca do Supabase não carregou.";
      msg.style.color = "crimson";
    }
    return;
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  window.login = async function () {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const msg = document.getElementById("msg");
    const panel = document.getElementById("panel");

    msg.innerText = "Entrando...";
    msg.style.color = "black";

    try {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        msg.innerText = "Erro: " + error.message;
        msg.style.color = "crimson";
        return;
      }

      if (data && data.session) {
        msg.innerText = "Login realizado com sucesso.";
        msg.style.color = "green";
        panel.classList.remove("hidden");
      } else {
        msg.innerText = "Login sem sessão retornada.";
        msg.style.color = "crimson";
      }
    } catch (e) {
      msg.innerText = "Erro inesperado no login.";
      msg.style.color = "crimson";
      console.error(e);
    }
  };

  window.logout = async function () {
    const msg = document.getElementById("msg");
    const panel = document.getElementById("panel");
    const result = document.getElementById("result");

    await client.auth.signOut();
    panel.classList.add("hidden");
    result.innerText = "";
    msg.innerText = "Sessão encerrada.";
    msg.style.color = "black";
  };

  window.loadEmployees = async function () {
    const result = document.getElementById("result");
    result.innerText = "Carregando...";

    try {
      const { data, error } = await client
        .from("employees")
        .select("*")
        .limit(10);

      if (error) {
        result.innerText = "Erro ao buscar funcionários: " + error.message;
        return;
      }

      result.innerText = JSON.stringify(data, null, 2);
    } catch (e) {
      result.innerText = "Erro inesperado ao buscar funcionários.";
      console.error(e);
    }
  };

  client.auth.getSession().then(({ data }) => {
    if (data && data.session) {
      const panel = document.getElementById("panel");
      const msg = document.getElementById("msg");
      panel.classList.remove("hidden");
      msg.innerText = "Sessão já iniciada.";
      msg.style.color = "green";
    }
  });
});
