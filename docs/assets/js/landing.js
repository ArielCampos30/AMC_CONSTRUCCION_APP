// Mantener vacío hasta definir el WhatsApp Business comercial.
// Formato futuro: código de país + característica + número, sin +, espacios ni guiones.
const WHATSAPP_NUMBER = "";

const params = new URLSearchParams(window.location.search);
const campaign = {
  source: params.get("utm_source") || "",
  medium: params.get("utm_medium") || "",
  campaign: params.get("utm_campaign") || "",
  content: params.get("utm_content") || ""
};

const campaignLabel = Object.entries(campaign)
  .filter(([, value]) => value)
  .map(([key, value]) => `${key}=${value}`)
  .join(" | ");

const baseMessage = [
  "Hola AMC, quisiera pedir un presupuesto.",
  "Mi localidad es: _____.",
  "El trabajo que necesito es: _____.",
  "Medidas aproximadas: _____."
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
    notice.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

document.getElementById("year").textContent = new Date().getFullYear();
