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
  apply(saved);
  document.addEventListener('click', function(event){
    const button = event.target.closest('#themeToggle');
    if (!button) return;
    apply(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  });
})();