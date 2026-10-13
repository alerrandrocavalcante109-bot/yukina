/* Conecta a Wiki ao menu da página inicial sem alterar o HTML principal. */
(function () {
  const WIKI_URL = "./wiki.html";
  const LABELS = ["wiki", "painel", "perfil", "planos vip", "comandos", "tema", "idioma", "daily", "loja"];
  function norm(value) {
    return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  }
  function addWikiLink() {
    if (document.querySelector('a[href="./wiki.html"], a[href="wiki.html"]')) return true;
    const candidates = Array.from(document.querySelectorAll(
      ".site-menu, .dropdown-menu, .nav-menu, .menu, [role='menu'], nav, [class*='menu'], [id*='menu']"
    ));
    const menu = candidates.find(el => {
      const text = norm(el.innerText);
      return LABELS.filter(label => text.includes(label)).length >= 2;
    });
    if (!menu) return false;
    const link = document.createElement("a");
    link.href = WIKI_URL;
    link.textContent = "Wiki";
    link.setAttribute("aria-label", "Abrir Wiki da Yukina");
    link.style.cssText = "display:flex;align-items:center;gap:8px;padding:10px 14px;color:inherit;text-decoration:none;cursor:pointer;";
    menu.appendChild(link);
    return true;
  }
  function start() {
    if (addWikiLink()) return;
    const observer = new MutationObserver(() => {
      if (addWikiLink()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 15000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();