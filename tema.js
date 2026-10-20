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


/* Correção persistente do menu principal da página inicial. */
(function () {
  const styleId = "yukina-home-menu-fix";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      body .nav-right { position:relative; display:flex; align-items:center; gap:10px; }
      body #menuToggle { display:inline-flex; align-items:center; justify-content:center; width:44px; height:44px; flex:0 0 44px; cursor:pointer; font-size:1.35rem; color:#fff; background:#211331; border:1px solid rgba(255,141,204,.6); border-radius:13px; }
      body #siteMenu.site-menu { position:absolute; z-index:9999; top:calc(100% + 10px); right:0; display:none; flex-direction:column; align-items:stretch; gap:5px; width:min(290px, calc(100vw - 28px)); max-height:min(72vh, 560px); overflow-y:auto; padding:10px; border:1px solid rgba(255,141,204,.5); border-radius:17px; background:rgba(14,8,26,.98); box-shadow:0 18px 55px rgba(0,0,0,.55); }
      body #siteMenu.site-menu.is-open { display:flex !important; }
      body #siteMenu.site-menu a, body #siteMenu.site-menu button { display:flex; align-items:center; justify-content:flex-start; width:100%; min-height:42px; padding:10px 12px; margin:0; box-sizing:border-box; border:1px solid rgba(255,255,255,.08); border-radius:10px; background:rgba(35,20,51,.98); color:#fff; text-align:left; text-decoration:none; white-space:normal; font:inherit; font-size:.94rem; line-height:1.35; }
      body #siteMenu.site-menu .menu-heading { padding:7px 10px 9px; color:#ffb7df; font-size:.74rem; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
      body #siteMenu.site-menu a:hover, body #siteMenu.site-menu button:hover { background:rgba(167,216,240,.18); border-color:rgba(167,216,240,.5); }
      @media(max-width:760px) { body .nav-right { width:100%; justify-content:space-between; } body #siteMenu.site-menu { right:0; } body header.nav { position:relative; z-index:1000; } }
    `;
    document.head.appendChild(style);
  }
  function bindMenu() {
    const button = document.getElementById("menuToggle");
    const menu = document.getElementById("siteMenu");
    if (!button || !menu || button.dataset.yukinaMenuBound === "1") return;
    button.dataset.yukinaMenuBound = "1";
    const close = () => {
      menu.classList.remove("is-open");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", "Abrir menu");
    };
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      const open = !menu.classList.contains("is-open");
      menu.classList.toggle("is-open", open);
      button.setAttribute("aria-expanded", String(open));
      button.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    });
    document.addEventListener("click", event => {
      if (!menu.contains(event.target) && !button.contains(event.target)) close();
    });
    document.addEventListener("keydown", event => { if (event.key === "Escape") close(); });
    menu.querySelectorAll("a").forEach(link => link.addEventListener("click", close));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindMenu, {once:true});
  else bindMenu();
})();

/* Menu funcional da página inicial: cria os controles caso o HTML não os tenha. */
(function () {
  const ITEMS = [
    ["⌂", "Início", "./index.html"],
    ["❄", "Comandos", "./comandos.html"],
    ["⚙", "Configurações do Sistema", "./configuracoes.html"],
    ["✦", "VIP e Planos", "./vip.html"],
    ["📖", "Wiki", "./wiki.html"],
    ["◉", "Perfil Discord", "./login.html"],
    ["☾", "Tema: claro/escuro", "#tema"]
  ];
  const style = document.createElement("style");
  style.id = "yukina-functional-drawer-style";
  style.textContent = `
    header.nav, header, .nav { position: relative; }
    #yukina-drawer-toggle{
      position:relative !important;
      inset:auto !important;
      margin:0 12px 0 0 !important;
      order:-999 !important;
      align-self:flex-start !important;
      transform:none !important;
    }
    header.nav, header { display:flex; align-items:center; }
        #yukina-drawer-toggle{display:inline-flex;align-items:center;justify-content:center;width:46px;height:46px;flex:0 0 46px;border-radius:14px;border:1px solid #f4b8e8;background:linear-gradient(135deg,#ff8dcc,#b79aff);color:#251633;font-size:25px;font-weight:900;cursor:pointer;box-shadow:0 5px 18px #c56bff35;z-index:10002}
    #yukina-drawer-shade{position:fixed;inset:0;background:rgba(7,5,16,.58);backdrop-filter:blur(3px);z-index:10000;opacity:0;visibility:hidden;transition:opacity .22s,visibility .22s}
    #yukina-drawer{position:fixed;z-index:10001;left:0;top:0;bottom:0;width:min(320px,86vw);padding:22px 14px calc(22px + env(safe-area-inset-bottom));overflow-y:auto;background:linear-gradient(180deg,#171029,#0d0a1b);border-right:1px solid #d7a8ff66;box-shadow:18px 0 55px #0006;transform:translateX(-105%);visibility:hidden;transition:transform .25s ease,visibility .25s;display:flex;flex-direction:column;gap:8px}
    body.yukina-drawer-open #yukina-drawer{transform:translateX(0);visibility:visible}
    body.yukina-drawer-open #yukina-drawer-shade{opacity:1;visibility:visible}
    #yukina-drawer .yd-head{display:flex;align-items:center;justify-content:space-between;padding:8px 8px 18px;margin-bottom:8px;border-bottom:1px solid #ffffff20;color:#fff;font-weight:900;letter-spacing:.12em}
    #yukina-drawer .yd-close{border:0;background:transparent;color:#fff;font-size:28px;padding:4px 10px;cursor:pointer}
    #yukina-drawer a,#yukina-drawer button.yd-item{display:flex;align-items:center;gap:12px;width:100%;min-height:48px;padding:12px 14px;border:1px solid #ffffff12;border-radius:12px;background:#ffffff09;color:#fff;text-decoration:none;text-align:left;font:inherit;font-size:15px;box-sizing:border-box;cursor:pointer}
    #yukina-drawer a:active,#yukina-drawer a:hover,#yukina-drawer button.yd-item:hover{background:#a7d8f025;border-color:#a7d8f077}
    #yukina-drawer .yd-icon{width:24px;text-align:center;color:#ffb8e4;font-size:18px}
    #yukina-drawer .yd-foot{margin-top:auto;padding:18px 8px 0;color:#c8b8dc;font-size:12px}
    @media(min-width:761px){#yukina-drawer-toggle{margin-right:8px}}
  `;
  (document.head || document.documentElement).appendChild(style);
  function setup(){
    if(document.getElementById("yukina-drawer")) return;
    const header=document.querySelector("header.nav, header, .nav");
    if(!header) return;
    const brand=header.querySelector(".brand, a[href='./index.html']");
    /* Reutiliza o botão de menu que já fica no canto; não cria um segundo hamburger. */
    const existingToggle=Array.from(header.querySelectorAll("button,[role='button'],a")).find(el => {
      const label=((el.getAttribute("aria-label")||"")+" "+(el.innerText||el.textContent||"")).trim();
      return el.id!=="yukina-drawer-toggle" && (/menu/i.test(label)||label==="☰"||label==="≡") && !el.closest("#yukina-drawer");
    });
    const toggle=existingToggle ? existingToggle.cloneNode(true) : document.createElement("button");
    if(existingToggle) existingToggle.replaceWith(toggle);
    toggle.id="yukina-drawer-toggle";toggle.type="button";toggle.textContent="☰";
    toggle.setAttribute("aria-label","Abrir menu");toggle.setAttribute("aria-expanded","false");toggle.setAttribute("aria-controls","yukina-drawer");
    const shade=document.createElement("div");shade.id="yukina-drawer-shade";
    const drawer=document.createElement("nav");drawer.id="yukina-drawer";drawer.setAttribute("aria-label","Menu principal da Yukina");
    const head=document.createElement("div");head.className="yd-head";
    const title=document.createElement("span");title.textContent="✦ YUKINA";
    const closeButton=document.createElement("button");closeButton.className="yd-close";closeButton.type="button";closeButton.textContent="×";closeButton.setAttribute("aria-label","Fechar menu");
    head.append(title,closeButton);drawer.appendChild(head);
    for(const [symbol,label,href] of ITEMS){
      if(href==="#tema"){
        const b=document.createElement("button");b.type="button";b.className="yd-item";
        const ico=document.createElement("span");ico.className="yd-icon";ico.textContent=symbol;
        const txt=document.createElement("span");txt.textContent=label;b.append(ico,txt);
        b.addEventListener("click",()=>{const themeButton=document.getElementById("themeToggle");if(themeButton)themeButton.click();else document.documentElement.dataset.theme=document.documentElement.dataset.theme==="light"?"dark":"light";});
        drawer.appendChild(b);
      } else {
        const a=document.createElement("a");a.href=href;
        const ico=document.createElement("span");ico.className="yd-icon";ico.textContent=symbol;
        const txt=document.createElement("span");txt.textContent=label;a.append(ico,txt);drawer.appendChild(a);
      }
    }
    const foot=document.createElement("div");foot.className="yd-foot";foot.textContent="Yukina · Cuidando deste cantinho";drawer.appendChild(foot);
    const open=()=>{document.body.classList.add("yukina-drawer-open");toggle.setAttribute("aria-expanded","true");toggle.setAttribute("aria-label","Fechar menu");};
    const close=()=>{document.body.classList.remove("yukina-drawer-open");toggle.setAttribute("aria-expanded","false");toggle.setAttribute("aria-label","Abrir menu");};
    toggle.addEventListener("click",e=>{e.preventDefault();document.body.classList.contains("yukina-drawer-open")?close():open();});
    closeButton.addEventListener("click",close);shade.addEventListener("click",close);
    drawer.querySelectorAll("a").forEach(a=>a.addEventListener("click",close));
    document.addEventListener("keydown",e=>{if(e.key==="Escape")close();});
    let startX=null;
    document.addEventListener("touchstart",e=>{if(e.touches.length===1)startX=e.touches[0].clientX;},{passive:true});
    document.addEventListener("touchend",e=>{if(startX===null)return;const dx=e.changedTouches[0].clientX-startX;if(!document.body.classList.contains("yukina-drawer-open")&&startX<28&&dx>75)open();else if(document.body.classList.contains("yukina-drawer-open")&&dx< -75)close();startX=null;},{passive:true});
    if(!existingToggle) header.insertBefore(toggle,brand||header.firstChild);
    document.body.append(shade,drawer);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup,{once:true});else setup();
  const observer=new MutationObserver(()=>{if(!document.getElementById("yukina-drawer"))setup();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(()=>observer.disconnect(),15000);
})();
