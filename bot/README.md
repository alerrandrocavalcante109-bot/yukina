# Bot Discord da Yukina

Esta pasta é o local reservado para o serviço do bot Discord separado do site estático e do Cloudflare Worker.

**Não existe ainda uma integração de produção entre esta pasta, o site e os pedidos VIP.** Antes de adicionar código executável, defina o ambiente de hospedagem persistente, o armazenamento de pedidos e as variáveis secretas. Mantenha pagamentos e concessão de cargos desativados até concluir testes.

Quando o bot for integrado, mantenha dependências, comandos, eventos, testes e instruções de deploy dentro desta pasta. Nunca versione `.env`, tokens ou bancos de dados locais.
