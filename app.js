const SUPABASE_URL = "https://xqikfrufphwaqmfuexvx.supabase.co";
const SUPABASE_KEY = "sb_publishable__-5ZX8k6kNTwQH5dvZxvMA_xVCX7-Up";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function login(){

const email = document.getElementById("email").value;
const password = document.getElementById("password").value;

const { error } = await supabase.auth.signInWithPassword({
email,
password
});

if(error){

document.getElementById("msg").innerText = error.message;

}else{

document.getElementById("msg").innerText = "Login realizado";

document.getElementById("panel").classList.remove("hidden");

}

}

async function logout(){

await supabase.auth.signOut();

document.getElementById("panel").classList.add("hidden");

}

async function loadEmployees(){

const { data, error } = await supabase
.from("employees")
.select("*")
.limit(10);

if(error){

document.getElementById("result").innerText = error.message;

}else{

document.getElementById("result").innerText =
JSON.stringify(data,null,2);

}

}
