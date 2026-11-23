# Progresso de internacionalização — Yukina

Última atualização: 2026-11-23

## Escopo
Tradução manual das respostas e interações dos comandos para os 25 idiomas definidos em `systems/idioma/index.js`. Preservar lógica, permissões, aliases e comportamento. Não reintroduzir IA, banco/empréstimos ou Waifu.

## Concluídos ou parcialmente integrados
- [~] `commands/cofre.js` + `systems/plan-commands.js`: respostas do cofre, bloqueio por plano, cooldown, falha, embed e campos localizados via `locales/cofre.js` nos 25 idiomas. O suporte do motor compartilhado é opcional e mantém o texto original dos demais comandos que ainda não passaram tradução. Formatação numérica acompanha o idioma. Descrição/metadados do Slash ainda estão em português; sem teste no Discord ou deploy Render.
- [~] `commands/cargo.js`: respostas de sucesso, erros, permissões, hierarquia, cargo inválido, uso e servidor localizados via `locales/cargo.js` nos 25 idiomas. Lógica de atribuição/retirada e anúncio de promoção preservados. Descrição, opções e escolhas do Slash Command ainda estão em português; metadados permanecem estáticos. Não houve teste de runtime no Discord nem deploy Render.
- [~] `commands/bloquear.js`, `commands/desbloquear.js` e `systems/channel-lock.js`: respostas de canal inexistente, permissões do moderador e bot, canal já bloqueado, bloqueio herdado, ausência de bloqueio explícito, falhas e sucessos localizadas via `locales/moderation.js` nos 25 idiomas. Slash/prefixo preservados; descrições e opções dos Slash Commands ainda estão em português.
- [~] `commands/ajuda.js` + `components/selects/ajuda-categoria.js`: categorias, descrições de categoria, visão geral, título, rodapé, placeholder e erro do menu localizados via `locales/help.js` nos 25 idiomas; seleção preserva a preferência individual. As descrições/metadados dos Slash Commands e descrições individuais dos comandos exibidas dentro das categorias continuam vindo dos próprios comandos e precisam de auditoria/localização separada. Sem teste de runtime no Discord ou deploy Render.
- [~] `commands/advertencias.js` e `commands/advertir-membro.js`: histórico, permissões, erros, confirmação, botões e mensagens do fluxo localizados via `systems/idioma/locales/warnings.js` nos 25 idiomas. As descrições/metadados do Slash Command ainda permanecem em português; handlers externos dos botões precisam ser auditados separadamente.
- [x] `commands/addkz.js`: mensagens de servidor, permissão, uso, sucesso (incluindo saldos individuais) e erro localizadas via `systems/idioma/locales/addkz.js` nos 25 idiomas. Comando continua somente por prefixo; lógica de permissões, parsing de valores e atualização de carteiras preservada.
- [x] `commands/daily.js` + `daily-reminders.js`: catálogo manual em `systems/idioma/locales/daily.js` (25 idiomas).
- [x] `commands/saldo.js` / `economia-saldo.js`: catálogo manual em `systems/idioma/locales/saldo.js` (25 idiomas); aliases `atm` e `bal`.
- [~] Moderação: `clear.js`, `banir-membro.js`, `expulsar-membro.js`, `systems/channel-lock.js` usam `locales/moderation.js`; faltam mensagens secundárias, permissões específicas, erros e componentes de confirmação.
- [~] `commands/painel.js`: mensagens principais, permissão, servidor e erro localizados via `locales/painel.js` (25 idiomas). Conferir cobertura completa das respostas de prefixo/slash e descrição de comando.
- [~] `commands/afk.js`: mensagens principais, retorno, aviso de menção, motivo e uso fora de servidor localizados via `locales/afk.js` (25 idiomas). Metadados e descrições de opções do slash ainda estão em português.
- [~] `commands/calc.js`: respostas de resultado, expressão, sucesso, erros conhecidos e instruções localizados via `locales/calc.js` (25 idiomas). Descrição/metadata do slash ainda estão em português.

## Pendentes
Todos os demais comandos e fluxos ainda precisam ser auditados individualmente, incluindo mensagens de erro/sucesso, confirmações, embeds, botões, selects, modais, handlers e textos enviados por sistemas acionados pelos comandos. Inventário inicial em `commands/`:
- `cargo.js`
- `cofre.js`
- `desejo.js`
- `domino.js`
- `drop-controle.js`
- `drop.js`
- `enigma.js`
- `expedicao.js`
- `fim.js`
- `infoserver.js`
- `mensagens.js`
- `mines.js`
- `pay.js`
- `perfil.js`
- `plano-atribuir.js`
- `rank.js`
- `roleta.js`
- `say.js`
- `ship.js`
- `silenciar-membro.js`
- `slow.js`
- `ticket.js`
- `traduzir-mensagem.js`
- `transferencias.js`
- `usuario.js`
- `work.js`
- `idioma/`: revisar mensagens/descrições e garantir consistência dos 25 idiomas.

Também auditar `components/buttons/`, `components/selects/` e módulos em `systems/` usados pelos comandos. O inventário acima é inicial e não representa uma contagem final.

## Validação
Para cada lote: conferir os 25 códigos de idioma, placeholders, imports/caminhos, sintaxe JS e cobertura de respostas. Testes de runtime/Discord e deploy Render só podem ser marcados como concluídos quando realmente executados e confirmados.

- [~] `commands/infoserver.js`: embed de informações do servidor, campos, rodapé, erro e uso fora de servidor localizados via `locales/infoserver.js` (25 idiomas). A descrição/metadata do slash ainda está em português. Não houve teste no Discord nem confirmação de deploy Render.\n\n- [~] `commands/usuario.js`: informações do usuário, embed, status, cargos, mensagens de erro, uso fora de servidor e prompt localizados via `locales/usuario.js` (25 idiomas). Metadados/descrições do slash ainda estão em português. Não houve teste no Discord nem confirmação de deploy Render.

## Histórico desta etapa\n- Criado `systems/idioma/locales/infoserver.js` com textos manuais para os 25 idiomas e integrado `commands/infoserver.js` para slash e prefixo. Formatação de números acompanha o locale do usuário.
- Criado catálogo de calculadora para 25 idiomas; integradas respostas do slash e prefixo, formatação numérica por idioma e mensagens de erro mapeadas.
- Verificação de sintaxe e cobertura do catálogo concluídas; não houve teste no Discord nem confirmação de deploy Render.
- Criado catálogo AFK para 25 idiomas e integrado às respostas do slash, prefixo e listener de retorno/menções.
- Validação prevista: sintaxe JS, 25 idiomas e cobertura das chaves. Não houve teste real no Discord nem confirmação de deploy Render.

- Adicionado `systems/idioma/locales/painel.js` com 25 idiomas.
- Integrado `commands/painel.js` para obter o idioma individual do autor tanto em slash quanto em prefixo.
- Commits: `b586b66`, `b571509`, `cbac314`, `970a285`.
- Verificação: catálogo do painel contém exatamente 25 idiomas e os dois arquivos JavaScript passaram na verificação de sintaxe. Não houve teste no Discord nem confirmação de deploy Render.


## Histórico da execução — addkz
- Criado catálogo manual `systems/idioma/locales/addkz.js` com os 25 idiomas cadastrados.
- Integrado o comando de prefixo `addkz`/ `adicionarkz` à preferência individual de idioma; valores numéricos formatados conforme o idioma.
- Validação estática: verificar sintaxe JavaScript, quantidade de idiomas e placeholders antes de considerar o lote validado. Não houve teste no Discord nem confirmação de deploy Render.


## Histórico da execução — advertências
- Criado `systems/idioma/locales/warnings.js` com traduções manuais para os 25 idiomas.
- Integrados `advertencias.js` e `advertir-membro.js`, incluindo mensagens de uso, permissões, hierarquia, confirmação e rótulos dos botões.
- Lógica de consulta, registro pendente, expiração de 5 minutos, permissões e hierarquia preservada.
- Não houve teste de runtime no Discord nem confirmação de deploy Render.


## Histórico da execução — ajuda
- Criado `systems/idioma/locales/help.js` com catálogo manual para os 25 idiomas e 25 chaves da biblioteca de comandos.
- Integrados `/ajuda`, prefixo `Yajuda` e o select `yukina-help-category` para respeitar o idioma individual do usuário.
- Preservadas categorias, aliases, filtro de comandos, IDs de componentes e comportamento do menu.
- Descrições originais dos comandos e metadados Slash não foram reescritos; permanecem pendentes para não alterar definições globais sem auditoria específica.
- Não houve teste de runtime no Discord nem confirmação de deploy Render.


## Histórico da execução — bloqueio de canais
- Ampliado `systems/idioma/locales/moderation.js` com oito mensagens específicas do bloqueio/desbloqueio para os 25 idiomas.
- Integrado o idioma individual em `systems/channel-lock.js` e nas respostas de uso em DM dos comandos `bloquear` e `desbloquear`.
- Preservados aliases, IDs, permissões exigidas, checagem de herança, overwrites e comportamento de prefixo/Slash.
- Validação estática: catálogo contém 25 idiomas e as oito chaves do fluxo. Imports foram conferidos por leitura dos arquivos. Não foi executado `node --check`, teste de runtime no Discord nem deploy Render.


## Histórico da execução — cargo
- Criado `systems/idioma/locales/cargo.js` com 15 mensagens manuais para os 25 idiomas.
- Integrado `commands/cargo.js` para usar a preferência individual tanto no Slash quanto no prefixo; placeholders de membro e cargo são interpolados.
- Preservados aliases, permissões, hierarquia, atribuição/remoção, motivo de auditoria e anúncio de promoção.
- Validação estática: sintaxe dos dois arquivos, 25 idiomas, 15 chaves por idioma e interpolação de placeholders aprovadas. Não houve teste de runtime no Discord nem confirmação de deploy Render.


## Histórico da execução — cofre
- Criado catálogo manual `systems/idioma/locales/cofre.js` com 13 mensagens para os 25 idiomas.
- `commands/cofre.js` consulta a preferência individual do usuário e a envia ao motor compartilhado de benefícios.
- `systems/plan-commands.js` aceita localização opcional para as respostas do benefício, sem alterar a saída dos demais comandos que ainda não fornecem catálogo; saldo e recompensa são formatados conforme o idioma.
- Preservados plano mínimo Plus, cooldown diário, probabilidades e valores das recompensas, ledger, carteira e transação.
- Validação estática: sintaxe dos três arquivos, cobertura dos 25 idiomas, 13 chaves e placeholders aprovados. Não houve teste runtime no Discord nem confirmação de deploy Render.
