const SUPABASE_URL = "https://xqikfrufphwaqmfuexvx.supabase.co";
const SUPABASE_KEY = "sb_publishable__-5ZX8k6kNTwQH5dvZxvMA_xVCX7-Up";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

window.login = async function () {

const email = document.getElementById("email").value;
const password = document.getElementById("password").value;

document.getElementById("msg").innerText = "Entrando...";

const { data, error } = await supabase.auth.signInWithPassword({
email: email,
password: password
});

if (error) {

document.getElementById("msg").innerText =
"Erro: " + error.message;

return;

}

document.getElementById("msg").innerText =
"Login realizado com sucesso";

document.getElementById("panel").classList.remove("hidden");

};

window.logout = async function () {

await supabase.auth.signOut();

document.getElementById("panel").classList.add("hidden");

};

window.loadEmployees = async function () {

const { data, error } = await supabase
.from("employees")
.select("*");

if (error) {

document.getElementById("result").innerText =
error.message;

return;

}

document.getElementById("result").innerText =
JSON.stringify(data,null,2);

};
