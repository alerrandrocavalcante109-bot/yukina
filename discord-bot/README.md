# Yukina VIP Discord bot — fase 1 (tickets e revisão manual)

Este serviço adiciona o primeiro fluxo de tickets VIP ao repositório. Ele **não cobra**, não fornece chave Pix, não ativa cargos VIP automaticamente e não considera imagens como prova definitiva de pagamento.

## O que está implementado

- Comando `/vip` com os cinco planos e periodicidade mensal/anual.
- Canal privado por pedido, visível apenas ao comprador, ao bot e ao cargo configurado em `VIP_STAFF_ROLE_ID`.
- Registro persistente de pedidos e trilha de auditoria em SQLite.
- Um pedido pendente por comprador/servidor, para evitar duplicações acidentais.
- Validação de tipo e tamanho dos anexos (JPG, PNG, WEBP ou PDF, até 5 MiB). O bot não baixa nem armazena os anexos; eles permanecem no Discord.
- Comando `/vip-referencia`: guarda apenas o hash SHA-256 da referência para ajudar a detectar reutilização. A referência não é prova de pagamento e uma colisão/reutilização não é tratada como aprovação.
- Aprovação/recusa restrita ao cargo de equipe configurado, com atualização condicional do estado e auditoria para impedir dupla decisão.
- Aprovar não concede automaticamente cargos ou benefícios: a integração com o sistema de benefícios ainda precisa ser desenhada e testada.

## Pré-requisitos

- Node.js 20 ou superior.
- Aplicação/bot criado no Discord Developer Portal.
- Um servidor de teste próprio.
- Cargo de equipe dedicado para revisar compras.
- Hospedagem que mantenha o processo Node.js ativo e ofereça **disco persistente**. Se o host apagar o disco ao reiniciar, o banco SQLite pode ser perdido. Faça backup protegido e teste a restauração.

## Configuração

1. Copie `.env.example` para `.env` localmente. Nunca publique `.env` nem tokens.
2. Preencha `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID` e `VIP_STAFF_ROLE_ID`. Opcionalmente, informe `VIP_TICKET_CATEGORY_ID`.
3. No Discord Developer Portal, habilite o intent **Message Content** para o bot, pois o serviço processa anexos enviados como mensagens. Conceda apenas permissões necessárias: View Channels, Send Messages, Read Message History, Manage Channels e Attach Files. Não conceda Administrator.
4. Em `discord-bot/`, execute `npm install`, depois `npm run check`, depois `npm run register-commands` e `npm start`.
5. Em hospedagem, configure as variáveis como secrets do provedor, use o diretório de banco em volume persistente e não envie `.env` ou `data/` ao Git.
6. Teste com um servidor/cargo de equipe separado antes de permitir compras reais.

## Fluxo de compra

1. O comprador executa `/vip` no servidor configurado e escolhe plano e duração.
2. O bot abre um canal privado e publica o preço oficial do código. A equipe deve informar o meio de pagamento **somente depois de confirmar o método de recebimento autorizado**.
3. O comprador anexa o comprovante no ticket e pode executar `/vip-referencia` para registrar o identificador da transação.
4. Um membro da equipe confere o recebimento diretamente na conta/provedor oficial, o valor, a moeda e se a transação já foi usada.
5. A equipe clica em **Aprovar após conferir o pagamento** ou **Recusar pedido**. A decisão e o responsável ficam registrados no banco.
6. A aprovação registra o estado do pedido; ativação real dos benefícios não está ligada nesta fase.

## Limitações e decisões de segurança

- **O site ainda não está conectado a este bot.** O botão de compra atual do site continua apontando para a página de comprovante em preparação. Nesta fase, o fluxo começa pelo comando `/vip` no Discord. Integrar o site com segurança exige autenticação Discord (OAuth2), criação de pedido no backend e proteção contra falsificação de IDs/valores; não aceite o plano/valor apenas do navegador.
- O serviço usa SQLite local; hospede somente onde o disco seja persistente. Para múltiplas instâncias, use um banco compartilhado com transações atômicas.
- O bot não valida um Pix diretamente em banco/provedor. A aprovação é uma decisão humana registrada; não use OCR nem metadados de imagem como validação de pagamento.
- A referência da transação é armazenada como hash, mas o hash não prova que houve crédito. A equipe deve conferir no provedor oficial.
- Não inclua CPF completo, chaves privadas, senha bancária, tokens, códigos de autenticação ou dados de cartão em tickets/logs.
- Defina política de retenção dos tickets/anexos e aviso de privacidade antes de vender. Restrinja a equipe e remova acessos que não forem mais necessários.
- Use um meio de recebimento autorizado para venda de assinaturas e verifique os requisitos do provedor com um responsável adulto, quando aplicável.
- Não ative pagamentos reais até configurar instruções oficiais de pagamento, suporte, política de reembolso/termos e fluxo de benefícios.

## Planos em centavos

| Plano | Mensal | Anual |
|---|---:|---:|
| Starter | R$ 7,90 | R$ 79,90 |
| Plus | R$ 9,90 | R$ 99,90 |
| Premium | R$ 14,90 | R$ 149,90 |
| Ultra | R$ 19,90 | R$ 199,90 |
| Infinity | R$ 29,90 | R$ 299,90 |

## Próximas etapas antes de produção

1. Definir IDs do servidor, cargo de equipe e categoria de tickets.
2. Definir provedor e instruções de pagamento autorizadas.
3. Integrar o site por OAuth2 e backend autenticado, sem expor segredos no frontend.
4. Conectar a aprovação ao sistema real de benefícios e à validade mensal/anual.
5. Adicionar testes automatizados, backups/restauração, limite de criação de tickets e monitoramento.
6. Para automação futura, confirmar pagamentos por API/webhook assinado do provedor, com idempotência e proteção contra reutilização de transações.
