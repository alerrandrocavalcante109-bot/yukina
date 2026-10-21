/* Garante que o item de planos do menu principal abra a página VIP, sem rolar a página inicial. */
(function () {
  const VIP_URL = "./vip.html";
  const norm = value => (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  function isPlansLink(el) {
    if (!el || el.tagName !== "A") return false;
    const label = norm((el.innerText || el.textContent || "") + " " + (el.getAttribute("aria-label") || ""));
    return /\b(planos?|vip)\b/.test(label) && !/tema|perfil/.test(label);
  }

  function makeDirect(link) {
    link.setAttribute("href", VIP_URL);
    link.setAttribute("aria-label", "Abrir a página de Planos VIP da Yukina");
    link.removeAttribute("data-scroll");
    link.removeAttribute("data-target");
    if (link.dataset.yukinaVipNavigation === "1") return;
    link.dataset.yukinaVipNavigation = "1";
    link.addEventListener("click", function (event) {
      // Impede scripts genéricos de navegação por âncora de converter o clique em rolagem.
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      window.location.href = new URL(VIP_URL, document.baseURI).href;
    }, true);
  }

  function setup() {
    let found = false;

    // Corrige o menu lateral principal criado por tema.js.
    document.querySelectorAll("#yukina-drawer a, #siteMenu a, .site-menu a, .dropdown-menu a, .nav-menu a, nav a, [role='menu'] a")
      .forEach(link => {
        if (isPlansLink(link)) {
          makeDirect(link);
          found = true;
        }
      });

    // Se ainda não existe item de planos, acrescenta um ao menu de navegação existente.
    const alreadyVip = document.querySelector('#yukina-drawer a[href="./vip.html"], #siteMenu a[href="./vip.html"], .site-menu a[href="./vip.html"], a[data-yukina-vip-navigation="1"]');
    if (alreadyVip) return true;

    const candidates = Array.from(document.querySelectorAll("#yukina-drawer, #siteMenu, .site-menu, .dropdown-menu, .nav-menu, .menu, [role='menu'], nav, [class*='menu'], [id*='menu']"));
    const menu = candidates.find(el => {
      const text = norm(el.innerText || "");
      return /wiki/.test(text) && /(comandos|painel|perfil)/.test(text);
    });
    if (!menu) return found;

    const link = document.createElement("a");
    link.href = VIP_URL;
    link.textContent = "✦ Planos VIP";
    link.style.cssText = "display:flex;align-items:center;gap:8px;padding:10px 14px;color:inherit;text-decoration:none;cursor:pointer;";
    makeDirect(link);
    menu.appendChild(link);
    return true;
  }

  function start() {
    if (setup()) return;
    const observer = new MutationObserver(() => {
      if (setup()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 15000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();