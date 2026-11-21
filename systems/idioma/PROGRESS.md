# Progresso de internacionalização — Yukina

Última atualização: 2026-11-20

## Escopo
Tradução manual das respostas e interações dos comandos para os 25 idiomas definidos em `systems/idioma/index.js`. Preservar lógica, permissões, aliases e comportamento. Não reintroduzir IA, banco/empréstimos ou Waifu.

## Concluídos ou parcialmente integrados
- [x] `commands/daily.js` + `daily-reminders.js`: catálogo manual em `systems/idioma/locales/daily.js` (25 idiomas).
- [x] `commands/saldo.js` / `economia-saldo.js`: catálogo manual em `systems/idioma/locales/saldo.js` (25 idiomas); aliases `atm` e `bal`.
- [~] Moderação: `clear.js`, `banir-membro.js`, `expulsar-membro.js`, `systems/channel-lock.js` usam `locales/moderation.js`; faltam mensagens secundárias, permissões específicas, erros e componentes de confirmação.
- [~] `commands/painel.js`: mensagens principais, permissão, servidor e erro localizados via `locales/painel.js` (25 idiomas). Conferir cobertura completa das respostas de prefixo/slash e descrição de comando.

## Pendentes
Todos os demais comandos e fluxos ainda precisam ser auditados individualmente, incluindo mensagens de erro/sucesso, confirmações, embeds, botões, selects, modais, handlers e textos enviados por sistemas acionados pelos comandos. Inventário inicial em `commands/`:
- `addkz.js`
- `advertencias.js`
- `advertir-membro.js`
- `afk.js`
- `ajuda.js`
- `bloquear.js` / `desbloquear.js` (wrappers; revisar fluxo compartilhado)
- `calc.js`
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

## Histórico desta etapa
- Adicionado `systems/idioma/locales/painel.js` com 25 idiomas.
- Integrado `commands/painel.js` para obter o idioma individual do autor tanto em slash quanto em prefixo.
- Commits: `b586b66`, `b571509`, `cbac314`.
