const formEl = document.getElementById("dynamicForm");
const statusEl = document.getElementById("status");
const submitBtn = document.getElementById("submitBtn");

const brandSelect = document.getElementById("brandSelect");
const brandLogo = document.getElementById("brandLogo");
const brandName = document.getElementById("brandName");
const brandTag  = document.getElementById("brandTag");

const API_URL = window.API_URL;
const RECAPTCHA_SITE_KEY = window.RECAPTCHA_SITE_KEY;

let QUESTIONS = [];
let THEMES = {};

init();

async function init(){
  THEMES = await loadJSON("./themes.json");
  QUESTIONS = getLocalQuestions() || await loadJSON("./questions.json");

  // marca por query (?brand=nexus) o localStorage
  const url = new URL(location.href);
  const brand = url.searchParams.get("brand") || localStorage.getItem("brand") || "oasis";

  brandSelect.value = THEMES[brand] ? brand : "oasis";
  applyTheme(brandSelect.value);

  brandSelect.addEventListener("change", () => {
    localStorage.setItem("brand", brandSelect.value);
    applyTheme(brandSelect.value);
  });

  renderForm(QUESTIONS);

  submitBtn.addEventListener("click", onSubmit);
}

function applyTheme(key){
  const t = THEMES[key];
  if(!t) return;

  brandLogo.src = t.logo;
  brandName.textContent = t.name;
  brandTag.textContent = t.tag;

  document.documentElement.style.setProperty("--accent", t.accent);
  document.documentElement.style.setProperty("--accent2", t.accent2);
}

function renderForm(questions){
  formEl.innerHTML = "";

  for(const q of questions){
    const field = document.createElement("div");
    field.className = `field ${q.span === 2 ? "span-2" : ""}`;

    const label = document.createElement("label");
    label.className = "label";
    label.textContent = (q.label || q.key) + (q.required ? " *" : "");
    field.appendChild(label);

    let input;
    if(q.type === "textarea"){
      input = document.createElement("textarea");
      input.className = "textarea";
    } else if(q.type === "select"){
      input = document.createElement("select");
      input.className = "select2";
      const opt0 = document.createElement("option");
      opt0.value = "";
      opt0.textContent = "— Seleccione —";
      input.appendChild(opt0);

      (q.options || []).forEach(v => {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        input.appendChild(opt);
      });
    } else {
      input = document.createElement("input");
      input.className = "input";
      input.type = q.type || "text";
    }

    input.name = q.key;
    input.required = !!q.required;
    input.placeholder = q.placeholder || "";
    field.appendChild(input);

    formEl.appendChild(field);
  }
}

async function onSubmit(){
  statusEl.textContent = "";
  submitBtn.disabled = true;
  submitBtn.textContent = "Enviando...";

  try{
    // Validación rápida
    const data = Object.fromEntries(new FormData(formEl).entries());
    for(const q of QUESTIONS){
      if(q.required && !String(data[q.key] || "").trim()){
        throw new Error(`Falta: ${q.label}`);
      }
    }

    // reCAPTCHA v3
    const token = await grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: "submit" });

    const payload = {
      brand: brandSelect.value,
      data,
      recaptchaToken: token,
      userAgent: navigator.userAgent
    };

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });

    if(!res.ok){
      const msg = await safeText(res);
      throw new Error(msg || `Error ${res.status}`);
    }

    statusEl.textContent = "✅ Enviado. Te llegó al email en segundos.";
    formEl.reset();

  }catch(err){
    statusEl.textContent = `❌ ${err.message || "Error al enviar. Intente nuevamente."}`;
  }finally{
    submitBtn.disabled = false;
    submitBtn.textContent = "Enviar";
  }
}

async function loadJSON(path){
  const r = await fetch(path, { cache: "no-store" });
  if(!r.ok) throw new Error(`No pude cargar ${path}`);
  return r.json();
}

function getLocalQuestions(){
  try{
    const raw = localStorage.getItem("questions_override");
    return raw ? JSON.parse(raw) : null;
  }catch{ return null; }
}

async function safeText(res){
  try{ return await res.text(); } catch { return ""; }
}
