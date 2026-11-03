// Configuração simples da API da Yukina.
// Sem interceptação de fetch: todas as páginas usam diretamente a API ativa.
(() => {
  const primary = "https://yukina-s1lz.onrender.com";
  window.YUKINA_API_URL = primary;
  window.YUKINA_API_BACKUP_URL = "";
  window.YUKINA_API_URLS = [primary];
})();
