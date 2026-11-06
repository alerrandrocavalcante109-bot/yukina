// Configuração simples da API da Yukina.
// A API principal é usada diretamente; a reserva fica disponível para fallback explícito.
(() => {
  const primary = "https://yukina-s1lz.onrender.com";
  const backup = "https://yukina-jspa.onrender.com";
  window.YUKINA_API_URL = primary;
  window.YUKINA_API_BACKUP_URL = backup;
  window.YUKINA_API_URLS = [primary, backup];
})();
