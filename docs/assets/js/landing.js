// Mantener vacío hasta definir el WhatsApp Business comercial.
// Formato futuro: código de país + característica + número, sin +, espacios ni guiones.
const WHATSAPP_NUMBER = "";
const PROSPECT_API = "https://amc-o0xb.onrender.com/api/public/prospects";
const CAMPAIGN_STORAGE_KEY = "amc_landing_campaign_v1";

const params = new URLSearchParams(window.location.search);
const currentCampaign = {
  source: params.get("utm_source") || "",
  medium: params.get("utm_medium") || "",
  campaign: params.get("utm_campaign") || "",
  content: params.get("utm_content") || ""
};

const hasCampaign = value => Object.values(value).some(Boolean);
const loadStoredCampaign = () => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(CAMPAIGN_STORAGE_KEY) || "null");
    if (!saved || typeof saved !== "object") return null;
    return {
      source: String(saved.source || ""),
      medium: String(saved.medium || ""),
      campaign: String(saved.campaign || ""),
      content: String(saved.content || "")
    };
  } catch {
    return null;
  }
};

if (hasCampaign(currentCampaign)) {
  try { sessionStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(currentCampaign)); } catch {}
}

const campaign = hasCampaign(currentCampaign) ? currentCampaign : (loadStoredCampaign() || currentCampaign);
const campaignLabel = Object.entries(campaign)
  .filter(([, value]) => value)
  .map(([key, value]) => `${key}=${value}`)
  .join(" | ");

const measurementContext = {
  utm_source: campaign.source,
  utm_medium: campaign.medium,
  utm_campaign: campaign.campaign,
  utm_content: campaign.content,
  landing_path: window.location.pathname
};

const measure = (name, details = {}) => {
  const event = { event: `amc_${name}`, ...measurementContext, ...details };
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(event);
  window.dispatchEvent(new CustomEvent("amc:measurement", { detail: event }));
};

measure("landing_view");

for (const element of document.querySelectorAll("[data-measure]")) {
  element.addEventListener("click", () => measure(element.dataset.measure || "interaction"));
}

const baseMessage = [
  "Hola AMC, quisiera pedir un presupuesto.",
  "Mi localidad es: _____.",
  "El trabajo que necesito es: _____."
];

if (campaignLabel) {
  baseMessage.push(`Origen de la consulta: ${campaignLabel}`);
}

const message = encodeURIComponent(baseMessage.join("\n"));
const notice = document.getElementById("waNotice");

for (const link of document.querySelectorAll(".js-wa")) {
  if (WHATSAPP_NUMBER) {
    link.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    continue;
  }

  link.href = "#contacto";
  link.addEventListener("click", event => {
    event.preventDefault();
    notice.style.display = "block";
    document.getElementById("contacto")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

const form = document.getElementById("prospectForm");
const status = document.getElementById("prospectStatus");
const makeSubmissionId = () => {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `landing_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
};
let submissionId = makeSubmissionId();
let formStarted = false;

form?.addEventListener("focusin", event => {
  if (formStarted || event.target?.closest?.(".form-honeypot")) return;
  formStarted = true;
  measure("form_start");
});

form?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const button = form.querySelector("button[type='submit']");
  const data = new FormData(form);
  const payload = {
    submissionId,
    name: String(data.get("name") || "").trim(),
    phone: String(data.get("phone") || "").trim(),
    town: String(data.get("town") || "").trim(),
    service: String(data.get("service") || "").trim(),
    description: String(data.get("description") || "").trim(),
    website: String(data.get("website") || "").trim(),
    utmSource: campaign.source,
    utmMedium: campaign.medium,
    utmCampaign: campaign.campaign,
    utmContent: campaign.content,
    referrer: document.referrer || "",
    page: window.location.href
  };

  button.disabled = true;
  status.className = "form-status is-loading";
  status.textContent = "Enviando tu consulta…";
  measure("form_submit_attempt");

  let responseStatus = 0;
  try {
    const response = await fetch(PROSPECT_API, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    responseStatus = response.status;
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "No pudimos enviar la consulta.");

    form.reset();
    submissionId = makeSubmissionId();
    formStarted = false;
    status.className = "form-status is-success";
    status.textContent = "Consulta enviada. Ya ingresó a AMC y la vamos a revisar para continuar el contacto.";
    measure("form_submit_success", { status: responseStatus });
  } catch (error) {
    status.className = "form-status is-error";
    status.textContent = error?.message || "No pudimos enviar la consulta. Intentá nuevamente en unos minutos.";
    measure("form_submit_error", { status: responseStatus || "network" });
  } finally {
    button.disabled = false;
  }
});

const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const revealItems = [...document.querySelectorAll(".card, .step, .proof-box, .contact-form")];

if (!reducedMotion && revealItems.length && "IntersectionObserver" in window) {
  document.documentElement.classList.add("reveal-enabled");
  for (const item of revealItems) item.classList.add("reveal-item");

  const revealObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("reveal-visible");
      revealObserver.unobserve(entry.target);
    }
  }, { threshold: 0.12, rootMargin: "0px 0px -24px" });

  for (const item of revealItems) revealObserver.observe(item);
}

document.getElementById("year").textContent = new Date().getFullYear();
