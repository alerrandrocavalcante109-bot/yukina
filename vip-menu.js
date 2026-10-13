/* Adds the VIP plans link to the existing homepage menu. */
(function () {
  const URL = "./vip.html";
  const LABELS = ["wiki", "painel", "perfil", "planos vip", "comandos", "tema", "idioma", "daily", "loja"];
  const norm = value => (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  function addVipLink() {
    if (document.querySelector('a[href="./vip.html"],a[href="vip.html"]')) return true;
    const candidates = Array.from(document.querySelectorAll(".site-menu,.dropdown-menu,.nav-menu,.menu,[role='menu'],nav,[class*='menu'],[id*='menu']"));
    const menu = candidates.find(el => LABELS.filter(label => norm(el.innerText).includes(label)).length >= 2);
    if (!menu) return false;
    const link = document.createElement("a");
    link.href = URL;
    link.textContent = "Planos VIP";
    link.setAttribute("aria-label", "Conhecer os planos VIP da Yukina");
    link.style.cssText = "display:flex;align-items:center;gap:8px;padding:10px 14px;color:inherit;text-decoration:none;cursor:pointer;";
    menu.appendChild(link);
    return true;
  }
  function start() {
    if (addVipLink()) return;
    const observer = new MutationObserver(() => { if (addVipLink()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 15000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();