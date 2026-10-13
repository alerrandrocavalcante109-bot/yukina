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
  apply(saved);
  document.addEventListener('click', function(event){
    const button = event.target.closest('#themeToggle');
    if (!button) return;
    apply(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  });
})();