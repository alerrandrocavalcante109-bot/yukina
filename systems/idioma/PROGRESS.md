# Progresso de internacionalização — Yukina

Última atualização: 2026-11-27

## Escopo
Tradução manual das respostas e interações dos comandos para os 25 idiomas definidos em `systems/idioma/index.js`. Preservar lógica, permissões, aliases e comportamento. Não reintroduzir IA, banco/empréstimos ou Waifu.

## Concluídos ou parcialmente integrados
- [~] `commands/desejo.js` + `systems/plan-commands.js`: respostas do desejo, validação do limite, título/descrição do embed, recompensa, erros de servidor/plano/cooldown/falha e campos localizados via `locales/desejo.js` nos 25 idiomas. Mensagens de item especial não exibem mais texto fixo em português; o item permanece registrado no inventário. Preservados plano mínimo Infinity, cooldown de 7 dias, pesos, faixas de recompensa, limite de 100k–10m e transação. Descrição/opções do Slash Command ainda estão em português; sem teste no Discord ou deploy Render.
- [~] `commands/cofre.js` + `systems/plan-commands.js`: respostas do cofre, bloqueio por plano, cooldown, falha, embed e campos localizados via `locales/cofre.js` nos 25 idiomas. O suporte do motor compartilhado é opcional e mantém o texto original dos demais comandos que ainda não passaram tradução. Formatação numérica acompanha o idioma. Descrição/metadados do Slash ainda estão em português; sem teste runtime/Discord ou deploy Render.
- [~] `commands/cargo.js`: respostas de sucesso, erros, permissões, hierarquia, cargo inválido, uso e servidor localizados via `locales/cargo.js` nos 25 idiomas. Lógica de atribuição/retirada e anúncio de promoção preservados. Descrição, opções e escolhas do Slash Command ainda estão em português; metadados permanecem estáticos. Não houve teste de runtime no Discord nem deploy Render.
- [~] `commands/bloquear.js`, `commands/desbloquear.js` e `systems/channel-lock.js`: respostas de canal inexistente, permissões do moderador e bot, canal já bloqueado, bloqueio herdado, ausência de bloqueio explícito, falhas e sucessos localizadas via `locales/moderation.js` nos 25 idiomas. Slash/prefixo preservados; descrições e opções dos Slash Commands ainda estão em português.
- [~] `commands/ajuda.js` + `components/selects/ajuda-categoria.js`: categorias, descrições de categoria, visão geral, título, rodapé, placeholder e erro do menu localizados via `locales/help.js` nos 25 idiomas; seleção preserva a preferência individual. As descrições/metadados dos Slash Commands e descrições individuais dos comandos exibidas dentro das categorias continuam vindo dos próprios comandos e precisam de auditoria/localização separada. Sem teste de runtime no Discord ou deploy Render.
- [~] `commands/advertencias.js` e `commands/advertir-membro.js`: histórico, permissões, erros, confirmação, botões e mensagens do fluxo localizados via `systems/idioma/locales/warnings.js` nos 25 idiomas. As descrições/metadados do Slash Command ainda permanecem em português; handlers externos dos botões precisam ser auditados separadamente.
- [x] `commands/addkz.js`: mensagens de servidor, permissão, uso, sucesso e erro localizadas via `systems/idioma/locales/addkz.js` nos 25 idiomas.
- [x] `commands/daily.js` + `daily-reminders.js`: catálogo manual em `systems/idioma/locales/daily.js` (25 idiomas).
- [x] `commands/saldo.js` / `economia-saldo.js`: catálogo manual em `systems/idioma/locales/saldo.js` (25 idiomas); aliases `atm` e `bal`.
- [~] Moderação: `clear.js`, `banir-membro.js`, `expulsar-membro.js`, `systems/channel-lock.js` usam `locales/moderation.js`; faltam mensagens secundárias, permissões específicas, erros e componentes de confirmação.
- [~] `commands/painel.js`: mensagens principais, permissão, servidor e erro localizados via `locales/painel.js` (25 idiomas). Conferir cobertura completa das respostas de prefixo/slash e descrição de comando.
- [~] `commands/afk.js`: mensagens principais, retorno, aviso de menção, motivo e uso fora de servidor localizados via `locales/afk.js` (25 idiomas). Metadados e descrições de opções do slash ainda estão em português.
- [~] `commands/calc.js`: respostas de resultado, expressão, sucesso, erros conhecidos e instruções localizados via `locales/calc.js` (25 idiomas). Descrição/metadata do slash ainda estão em português.
- [~] `commands/infoserver.js`: embed, campos, rodapé, erro e uso fora de servidor localizados via `locales/infoserver.js` (25 idiomas). Descrição/metadata do slash ainda em português.
- [~] `commands/usuario.js`: informações do usuário, embed, status, cargos, erros, uso fora de servidor e prompt localizados via `locales/usuario.js` (25 idiomas). Metadados/descrições do slash ainda em português.
- [~] `commands/drop.js`: mensagens de DM, permissões, duração, ganhadores, prêmio, canal, sucesso, erro e prefixo localizados via `locales/drop.js` (25 idiomas). Descrição/metadados ainda pendentes.
- [~] `commands/drop-controle.js`: permissões, configuração, pausa/retomada, estatísticas, histórico, falhas de pagamento, recompensas pendentes e embeds localizados via `locales/drop-controle.js` (25 idiomas). Descrição/opções do Slash ainda em português.
- [~] `commands/enigma.js`: respostas de rodada ativa, início, dica, tempo, encerramento, vencedor, falha e uso fora de servidor localizadas via `locales/enigma.js` nos 25 idiomas. A dica interna dos enigmas permanece em português por ser conteúdo fixo do banco de enigmas e precisa de uma etapa própria caso também seja traduzida. Descrição/metadados do Slash ainda em português; sem teste no Discord ou deploy Render.

## Pendentes
Todos os demais comandos e fluxos ainda precisam ser auditados individualmente, incluindo mensagens de erro/sucesso, confirmações, embeds, botões, selects, modais, handlers e textos enviados por sistemas acionados pelos comandos. Próximo conjunto sugerido: `expedicao.js`, seguido de `fim.js`, `mensagens.js`, `mines.js`, `pay.js`, `perfil.js`, `plano-atribuir.js`, `rank.js`, `roleta.js`, `say.js`, `ship.js`, `silenciar-membro.js`, `slow.js`, `ticket.js`, `traduzir-mensagem.js`, `transferencias.js`, `usuario.js`, `work.js` e a auditoria dos componentes/handlers.

## Validação
Para cada lote: conferir os 25 códigos de idioma, placeholders, imports/caminhos, sintaxe JS e cobertura de respostas. Testes de runtime/Discord e deploy Render só podem ser marcados como concluídos quando realmente executados e confirmados.

## Histórico desta etapa — expedição
- Criado `systems/idioma/locales/expedicao.js` com traduções manuais para os 25 idiomas e chaves de plano, rotas, recompensa, erro, cooldown e uso do prefixo.
- Integrado `commands/expedicao.js` para localizar respostas Slash e prefixo, título, descrição, rotas, recompensa bônus/normal e mensagens compartilhadas de `runPlanCommand`.
- Preservados plano mínimo Ultra, cooldown de 48 horas, faixas de recompensa, chances de bônus, aliases e lógica de carteira/ledger.
- Descrição, opções e escolhas do Slash Command ainda permanecem em português e seguem registradas como pendência de auditoria.
- Validação estática de sintaxe dos dois arquivos concluída; não houve teste de runtime no Discord nem confirmação de deploy Render.
- Commits: `d81fbc0` e `96a7047`.

## Histórico desta etapa — enigma
- Criado `systems/idioma/locales/enigma.js` com traduções manuais para os 25 idiomas e chaves de estado do fluxo.
- Integrado `commands/enigma.js` para usar a preferência individual do usuário em Slash, prefixo, início, timeout, erro e anúncio do vencedor.
- Preservados respostas ephemeral, aliases, duração de 30 segundos, normalização das respostas, mapa de partidas e comportamento de encerramento.
- A dica fixa de cada enigma continua em português; a tradução desse conteúdo interno fica registrada como pendência específica.
- Commits: `a0a33d3` e `b44dc3`.
- Validação realizada por revisão estática dos imports, placeholders e cobertura dos 25 códigos; não houve teste de runtime no Discord nem confirmação de deploy Render.
