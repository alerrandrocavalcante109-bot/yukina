/* Yukina — tema global persistente */
(function(){
  const KEY = 'yukina-theme';
  let saved = 'dark';
  try { saved = localStorage.getItem(KEY) || 'dark'; } catch (_) {}
  function apply(mode){
    const light = mode === 'light';
    document.documentElement.classList.toggle('light-theme', light);
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    try { localStorage.setItem(KEY, light ? 'light' : 'dark'); } catch (_) {}
    const button = document.getElementById('themeToggle');
    if (button) button.textContent = light ? 'Tema: claro' : 'Tema: escuro';
  }
  const style = document.createElement('style');
  style.id = 'yukina-global-theme';
  style.textContent = `
    html[data-theme="light"] { color-scheme: light; --bg:#f6efff; --panel:#fff; --panel2:#eee3fb; --text:#251633; --muted:#665675; --line:#5a3b7826; --glow:#bd82ff24; }
    html[data-theme="light"] body { background-color:#f6efff !important; color:#251633 !important; }
    html[data-theme="light"] .card, html[data-theme="light"] .daily, html[data-theme="light"] .about, html[data-theme="light"] .cta, html[data-theme="light"] .panel, html[data-theme="light"] .login-card { background-color:#fff !important; color:#251633 !important; }
    html[data-theme="light"] input, html[data-theme="light"] textarea, html[data-theme="light"] select { background:#fff !important; color:#251633 !important; border-color:#d8c5eb !important; }
    html[data-theme="light"] .site-menu { background:#fff8ff !important; }
    html[data-theme="light"] .site-menu a, html[data-theme="light"] .site-menu button { color:#665675 !important; }
    html[data-theme="light"] .muted, html[data-theme="light"] .description { color:#665675 !important; }
  `;
  (document.head || document.documentElement).appendChild(style);
  style.textContent += `
    /* Contraste reforçado para texto e controles sobre o fundo ilustrado */
    body { color:#fff !important; }
    h1,h2,h3,h4,h5,h6,p,label,small,span,li,a:not(.gradient),.description,.muted,.subtitle,.eyebrow,.lead {
      text-shadow: 0 1px 4px rgba(0,0,0,.85);
    }
    .site-menu, .menu, .dropdown-menu, .nav-menu {
      background: rgba(12,7,22,.97) !important;
      border: 1px solid rgba(220,190,255,.42) !important;
      backdrop-filter: blur(18px);
    }
    .site-menu a, .site-menu button, .menu a, .dropdown-menu a, .nav-menu a {
      color: #fff !important;
      background-color: rgba(25,14,42,.96);
      opacity: 1 !important;
      text-shadow: none;
    }
    button, .button, .btn, a.button, a.btn, .cta a, .cta button {
      opacity: 1 !important;
      color: #fff !important;
      text-shadow: none;
      border-color: rgba(220,190,255,.65);
    }
    .card, .daily, .about, .cta, .panel, .login-card, .glass, .feature {
      background-color: rgba(14,8,26,.88) !important;
      border-color: rgba(220,190,255,.32);
    }
    input, textarea, select {
      background: rgba(14,8,26,.94) !important;
      color: #fff !important;
      border-color: rgba(220,190,255,.55) !important;
    }
    input::placeholder, textarea::placeholder { color: #d0c4df !important; opacity: 1 !important; }
  `;

  /* Tela inicial: menos transparência e leitura mais nítida */
  style.textContent += `
    body:has(.character) {
      background-color: #090611 !important;
    }
    body:has(.character) .hero,
    body:has(.character) .hero-content,
    body:has(.character) .hero-card,
    body:has(.character) .hero-panel,
    body:has(.character) .hero-copy,
    body:has(.character) .hero-info,
    body:has(.character) .intro,
    body:has(.character) .welcome,
    body:has(.character) main > section {
      background-color: rgba(12, 7, 24, .96) !important;
      border-color: rgba(210, 166, 255, .48) !important;
      backdrop-filter: blur(16px);
      box-shadow: 0 12px 36px rgba(0,0,0,.38);
    }
    body:has(.character) h1,
    body:has(.character) h2,
    body:has(.character) p,
    body:has(.character) .subtitle,
    body:has(.character) .description {
      color: #fff !important;
      text-shadow: 0 2px 7px rgba(0,0,0,.98) !important;
    }
    body:has(.character) button,
    body:has(.character) .btn,
    body:has(.character) .button,
    body:has(.character) a.button {
      opacity: 1 !important;
      filter: saturate(1.15);
    }
  `;

  style.textContent += `
    /* Contraste forte na página inicial */
    .card, .daily, .about, .cta, .panel, .login-card, .glass, .feature,
    .feature-card, .stat-card, article {
      background: #100a20 !important;
      background-color: #100a20 !important;
      opacity: 1 !important;
      border-color: rgba(171,111,255,.8) !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }
    .hero, .hero-content, .hero-copy, .hero-info, .intro, .welcome {
      background-color: rgba(9,5,19,.94) !important;
      opacity: 1 !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }
    p, li, label, small, .description, .muted, .subtitle, .lead {
      opacity: 1 !important;
      color: #fff !important;
      text-shadow: 0 2px 5px #000 !important;
    }
    body { background-color: #080511 !important; }
  `;

  /* Botões coloridos no estilo rosa e violeta da Yukina */
  style.textContent += `
    .btn, button, .button, a.button, a.btn, .cta a, .cta button,
    .hero-actions a {
      background: linear-gradient(115deg, #ff8dcc 0%, #d18cff 52%, #a98bff 100%) !important;
      color: #21112c !important;
      border: 1px solid rgba(255, 196, 239, .82) !important;
      border-radius: 13px !important;
      font-weight: 800 !important;
      opacity: 1 !important;
      box-shadow: 0 5px 18px rgba(190, 105, 255, .22) !important;
      text-shadow: none !important;
      transition: transform .2s ease, filter .2s ease, box-shadow .2s ease !important;
    }
    .btn:hover, button:hover, .button:hover, a.button:hover, a.btn:hover,
    .cta a:hover, .cta button:hover, .hero-actions a:hover {
      filter: brightness(1.12) saturate(1.12) !important;
      box-shadow: 0 8px 24px rgba(255, 141, 204, .3) !important;
      transform: translateY(-2px);
    }
    .btn.primary, .primary {
      background: linear-gradient(110deg, #ff8dcc, #b79aff) !important;
      color: #21112c !important;
    }
    .site-menu button, .menu button, #themeToggle, #languageToggle {
      background: linear-gradient(115deg, #28143d, #3a2055) !important;
      color: #fff !important;
      border: 1px solid rgba(215, 171, 255, .72) !important;
    }
  `;

  apply(saved);
  document.addEventListener('click', function(event){
    const button = event.target.closest('#themeToggle');
    if (!button) return;
    apply(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  });
})();

/* Perfil Discord: adiciona o cartão sem substituir nem limpar os itens do menu. */
(function () {
  const PROFILE_ID = "yukina-discord-profile";
  function getUser() {
    try {
      const raw = sessionStorage.getItem("yukina_discord_user");
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }
  function findMenu() {
    const selectors = [".site-menu", ".dropdown-menu", ".nav-menu", "[role='menu']", ".menu"];
    for (const selector of selectors) {
      const elements = Array.from(document.querySelectorAll(selector));
      const menu = elements.find(el => {
        const style = getComputedStyle(el);
        const text = (el.innerText || "").toLowerCase();
        return style.display !== "none" &&
          (text.includes("comandos") || text.includes("wiki") || text.includes("painel") || el.querySelector("a,button"));
      });
      if (menu) return menu;
    }
    return null;
  }
  function addProfile() {
    const user = getUser();
    if (!user || !user.id) return;
    const menu = findMenu();
    if (!menu || menu.querySelector("#" + PROFILE_ID)) return;
    const card = document.createElement("div");
    card.id = PROFILE_ID;
    card.style.cssText = "display:flex;align-items:center;gap:12px;padding:12px 14px;margin:4px 8px 10px;border-bottom:1px solid rgba(220,190,255,.35);color:#fff;background:rgba(28,15,45,.98);border-radius:12px;min-width:0;";
    const avatar = document.createElement("img");
    avatar.alt = "";
    avatar.width = 42;
    avatar.height = 42;
    avatar.style.cssText = "width:42px;height:42px;flex:0 0 42px;border-radius:50%;object-fit:cover;border:2px solid #d18cff;";
    avatar.src = user.avatar || ("https://cdn.discordapp.com/embed/avatars/" + (Number(user.id) % 6) + ".png");
    const info = document.createElement("div");
    info.style.cssText = "display:flex;flex-direction:column;min-width:0;gap:3px;";
    const name = document.createElement("strong");
    name.textContent = user.global_name || user.username || "Usuário Discord";
    name.style.cssText = "color:#fff;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px;";
    const status = document.createElement("small");
    status.textContent = "Conectado pelo Discord";
    status.style.cssText = "color:#d8b4fe;font-size:11px;";
    info.append(name, status);
    card.append(avatar, info);
    menu.insertBefore(card, menu.firstChild);
  }
  function start() {
    addProfile();
    const observer = new MutationObserver(addProfile);
    observer.observe(document.documentElement, {childList:true, subtree:true});
    document.addEventListener("click", () => setTimeout(addProfile, 80));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, {once:true});
  else start();
})();


/* Link da página Configurações do Sistema no menu principal. */
(function () {
  const URL = "./configuracoes.html";
  function addSystemSettingsLink() {
    if (document.querySelector('a[href="./configuracoes.html"],a[href="configuracoes.html"]')) return true;
    const selectors = [".site-menu", ".dropdown-menu", ".nav-menu", "[role='menu']", ".menu"];
    for (const selector of selectors) {
      const menus = Array.from(document.querySelectorAll(selector));
      const menu = menus.find(el => {
        const text = (el.innerText || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        return text.includes("comandos") || text.includes("wiki") || text.includes("painel") || el.querySelector("a,button");
      });
      if (!menu) continue;
      const link = document.createElement("a");
      link.href = URL;
      link.textContent = "Configurações do Sistema";
      link.setAttribute("aria-label", "Abrir Configurações do Sistema da Yukina");
      link.style.cssText = "display:flex;align-items:center;gap:8px;padding:10px 14px;color:inherit;text-decoration:none;cursor:pointer;";
      menu.appendChild(link);
      return true;
    }
    return false;
  }
  function start() {
    if (addSystemSettingsLink()) return;
    const observer = new MutationObserver(() => { if (addSystemSettingsLink()) observer.disconnect(); });
    observer.observe(document.documentElement, {childList:true,subtree:true});
    setTimeout(() => observer.disconnect(), 20000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, {once:true});
  else start();
})();
