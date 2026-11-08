# Yukina IA — implementação inicial

Esta pasta contém a primeira etapa funcional da Yukina IA no bot Discord.

## Recursos incluídos nesta etapa

- Provedor OpenRouter com roteamento gratuito por padrão (`openrouter/free`).
- Comando slash `/ia mensagem:<texto>`.
- Comando por prefixo configurado no servidor, normalmente `Yia <texto>`.
- Resposta a menções à Yukina e respostas diretas às mensagens dela.
- Cooldown de 5 segundos por usuário.
- Histórico de conversa separado por usuário e canal, evitando misturar conversas de canais diferentes.
- Memórias pessoais seletivas vinculadas ao ID global do Discord e reutilizáveis entre servidores.
- Pedido em linguagem natural para esquecer memórias.
- Identificação especial do Criador e da mãe por ID do Discord.
- Proteções de prompt, menções e armazenamento básico de informações sensíveis.

## Variáveis de ambiente

Configure no Render (Environment):

| Variável | Obrigatória | Valor |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | Sim | Sua chave privada do OpenRouter |
| `YUKINA_OPENROUTER_MODEL` | Não | `openrouter/free` |
| `YUKINA_AI_CREATOR_ID` | Sim para reconhecer o Criador | ID numérico da conta Discord do Criador |
| `YUKINA_AI_MOTHER_ID` | Não | `353909640381333504` |
| `YUKINA_SITE_URL` | Não | `https://yukina.onrender.com` |

Não coloque a chave da API no GitHub, em mensagens públicas ou no código-fonte. Se a chave não estiver configurada, o comando informa que a integração ainda precisa ser preparada; nenhuma rota paga é usada como fallback intencional.

## MongoDB

A implementação usa a conexão MongoDB já aberta pelo bot e cria índices para:

- `yukina_ai_profiles`: memórias pessoais por `userId`.
- `yukina_ai_threads`: histórico por combinação de `userId` e `channelId`.

O histórico de conversa não é compartilhado entre canais. As memórias pessoais são globais por ID do Discord. A captura automática atual é conservadora e reconhece algumas declarações explícitas de gostos, preferências e projetos; não é ainda uma extração semântica completa.

## Ativação

1. Faça o merge da branch `feature/yukina-ia-foundation` na `main`.
2. Configure `OPENROUTER_API_KEY` e `YUKINA_AI_CREATOR_ID` no Render.
3. Faça o deploy e aguarde a sincronização dos comandos slash.
4. Teste `/ia`, `Yia olá` e uma menção direta à Yukina.

## Ainda não implementado

A primeira etapa não ativa recursos que exigem sistemas próprios adicionais: conversação por voz em tempo real, síntese de voz, mundo virtual persistente, habitantes simulados, missões, autobiografia automatizada, cartas agendadas, relatórios semanais, diário privado de cada servidor, análise proativa de administração e histórias interativas. Esses recursos precisam de etapas independentes, testes e configurações próprias; não devem ser anunciados como ativos antes de serem implementados.
