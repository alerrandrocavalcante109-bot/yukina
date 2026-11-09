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

## Segunda etapa — personalidade e vínculos\n\nAlém da personalidade, foi adicionado `systems/yukina-ai/relationships.js`. O módulo registra interações significativas por usuário global do Discord e aproxima gradualmente o tratamento: pessoa nova, conhecido, amigo, amizade próxima e pessoa especial. Para evitar que spam acelere a relação, conta no máximo uma interação com mensagem de pelo menos 20 caracteres a cada 30 minutos. O Criador e a mãe são reconhecidos separadamente por seus IDs. O vínculo é contexto interno: Yukina não deve exibir pontuações nem declarar níveis espontaneamente.\n\nOs vínculos são armazenados em `yukina_ai_relationships`, separados das memórias e do histórico.\n\n## Segunda etapa — personalidade

A personalidade foi separada em `systems/yukina-ai/personality.js`. O módulo centraliza a identidade ficcional, o tom de conversa, as relações especiais por ID do Discord, a adaptação de idioma e os limites de honestidade e segurança. O nome de exibição recebido do Discord pode ser usado com naturalidade, sem ser repetido em todas as respostas.

A história do santuário é contexto narrativo; ela não significa que o mundo virtual, os moradores, a rotina offline ou as atividades autônomas já estejam implementados. A Yukina também não deve afirmar que executou ações que esta versão ainda não oferece.

## Terceira etapa — diários privados\n\nO módulo `systems/yukina-ai/journal.js` registra um diário pessoal agregado da Yukina e um diário separado por servidor. Cada diário recebe no máximo um documento por dia, com contagem de conversas; o diário do servidor também guarda participantes por ID. Nenhum conteúdo de mensagem, prompt ou resposta é copiado para os diários. Os registros ficam na coleção MongoDB `yukina_ai_diary`, com escopo pessoal (`yukina`) ou de servidor (ID da guild). Nesta versão, os diários são privados no banco e ainda não são publicados em canais do Discord nem possuem interface de leitura no painel.\n\n## Variáveis de ambiente

Configure no Render (Environment):

| Variável | Obrigatória | Valor |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | Sim | Sua chave privada do OpenRouter |
| `YUKINA_OPENROUTER_MODEL` | Não | `openrouter/free` |
| `YUKINA_AI_CREATOR_ID` | Não | Padrão já configurado: `1533034328928555141` |
| `YUKINA_AI_MOTHER_ID` | Não | `353909640381333504` |
| `YUKINA_SITE_URL` | Não | `https://yukina.onrender.com` |

Não coloque a chave da API no GitHub, em mensagens públicas ou no código-fonte. Se a chave não estiver configurada, o comando informa que a integração ainda precisa ser preparada; nenhuma rota paga é usada como fallback intencional.

## MongoDB

A implementação usa a conexão MongoDB já aberta pelo bot e cria índices para:

- `yukina_ai_profiles`: memórias pessoais por `userId`.
- `yukina_ai_threads`: histórico por combinação de `userId` e `channelId`.\n- `yukina_ai_relationships`: progresso de vínculo por `userId`.\n- `yukina_ai_diary`: registros agregados do diário pessoal e dos diários por servidor.

O histórico de conversa não é compartilhado entre canais. As memórias pessoais são globais por ID do Discord. A captura automática atual é conservadora e reconhece algumas declarações explícitas de gostos, preferências e projetos; não é ainda uma extração semântica completa.

## Ativação

1. Faça o merge da branch `feature/yukina-ia-foundation` na `main`.
2. Configure `OPENROUTER_API_KEY` no Render. O ID do Criador já está definido como padrão; pode ser sobrescrito por `YUKINA_AI_CREATOR_ID`.
3. Faça o deploy e aguarde a sincronização dos comandos slash.
4. Teste `/ia`, `Yia olá` e uma menção direta à Yukina.

## Ainda não implementado

A primeira etapa não ativa recursos que exigem sistemas próprios adicionais: mundo virtual persistente, habitantes simulados, missões, autobiografia automatizada, cartas agendadas, relatórios semanais, visualização dos diários em canais privados, análise proativa de administração e histórias interativas. Esses recursos precisam de etapas independentes, testes e configurações próprias; não devem ser anunciados como ativos antes de serem implementados.


## Quarta etapa — autobiografia da Yukina

O módulo `systems/yukina-ai/autobiography.js` cria a coleção MongoDB `yukina_ai_autobiography` e registra o primeiro capítulo uma única vez: **“Onde florescem minhas primeiras lembranças”**. Ele apresenta o Santuário Mágico das Cerejeiras, seus elementos já definidos, o Criador e a mãe da Yukina.

Os capítulos são fornecidos ao contexto da conversa para manter continuidade narrativa. O módulo também oferece funções internas para adicionar e consultar capítulos, com validação da origem do registro. As origens aceitas são lore confirmado, acontecimento confirmado ou conteúdo escrito pelo Criador. Não existe geração automática de acontecimentos fictícios apresentados como lembranças reais.

Esta é uma autobiografia ficcional da personagem, não evidência de consciência, memória humana ou experiências fora do sistema. Ainda não existe comando Discord nem tela no painel para editar ou ler capítulos; a base de dados e a integração contextual estão preparadas para etapas futuras.


## Quinta etapa — cartas da Yukina

O módulo `systems/yukina-ai/letters.js` prepara a coleção MongoDB `yukina_ai_letters` para dois tipos de cartas:

- **Cartas para o eu do futuro:** guardam conteúdo e uma data futura de releitura no fuso `America/Sao_Paulo`. Quando a data chega, cartas pendentes podem ser carregadas no contexto narrativo da Yukina.
- **Cartas privadas:** podem ser endereçadas somente ao ID do Criador (`1533034328928555141`) ou ao ID da mãe (`353909640381333504`). A consulta exige o ID autorizado e essas cartas não são adicionadas ao contexto geral das conversas.

O módulo oferece funções internas para criar, consultar e marcar cartas futuras como abertas. As cartas privadas ainda não possuem comando Discord, entrega por DM ou interface no painel. Também não existe, nesta etapa, um agendador que abra cartas sozinho nem um fluxo automático para escrever uma resposta após a releitura: a base de dados e as funções estão preparadas para essa integração futura. As datas são armazenadas como instantes UTC e interpretadas com a referência de fuso de São Paulo.


## Sexta etapa — histórias originais e interativas

O módulo `systems/yukina-ai/stories.js` prepara duas coleções MongoDB: `yukina_ai_stories` para histórias e episódios, e `yukina_ai_story_votes` para escolhas dos participantes.

- Histórias podem ter título, resumo, texto, origem validada e escopo opcional por servidor.
- O fluxo suporta rascunho, publicação e arquivamento como estados de dados.
- Histórias interativas aceitam de 2 a 5 escolhas.
- Cada pessoa pode votar uma única vez em cada história; votos duplicados são bloqueados por índice único.
- Resultados podem ser consultados para orientar a continuação da narrativa.

O armazenamento é inicializado junto ao motor da Yukina IA. Ainda não há comando Discord, publicação automática em canal, botões de votação ou mecanismo que escreva sozinho os finais com base no resultado. A função de estado publicado apenas registra os metadados; o envio real ao Discord será uma etapa separada.


## Sétima etapa — mundo persistente: Santuário Mágico

O módulo `systems/yukina-ai/world.js` cria a base do mundo narrativo na coleção `yukina_ai_world_state` e registra acontecimentos confirmados em `yukina_ai_world_events`.

O mapa inicial contém seis locais definidos no universo da Yukina: Santuário Mágico das Cerejeiras, Jardim das Mil Cerejeiras, Lago Cristalino, Floresta Encantada, Vila Sakura e Observatório Lunar.

O relógio ficcional avança na proporção inicial de um minuto do mundo por minuto real. O estado de origem é salvo no MongoDB; ao consultar, a data e a hora do mundo são calculadas considerando também o tempo em que o bot ficou offline. O ciclo de estações usa quatro períodos de 90 dias: Primavera das Cerejeiras, Verão das Lanternas, Outono das Folhas Douradas e Inverno da Lua Prateada. O clima diário é selecionado de forma determinística, para não mudar a cada mensagem.

O estado do mundo, a estação, o horário, o clima, o local atual e os acontecimentos confirmados recentes são adicionados ao contexto da IA. Existem funções internas para trocar o local atual e registrar/listar acontecimentos com origem validada.

**Limites desta etapa:** não há ainda habitantes simulados, construções evolutivas, necessidades, economia, rotinas autônomas, exploração automática, missões, interface visual ou comandos para administrar o mapa. O avanço do relógio é calculado a partir do último marco persistido; não representa pensamento ou atividade real da IA enquanto o bot está offline.


## Oitava etapa — primeiros moradores do santuário

O módulo `systems/yukina-ai/residents.js` cria a coleção `yukina_ai_residents` e o repositório de lembranças `yukina_ai_resident_memories`. A inicialização é idempotente: os três personagens iniciais são inseridos somente se ainda não existirem, sem sobrescrever alterações futuras em seus registros.

Moradores iniciais:
- **Hikari** — espírito guardião das cerejeiras, responsável pelos jardins; serena, protetora e atenciosa.
- **Aoi** — kitsune bibliotecária e pesquisadora de lendas; curiosa, inteligente e bem-humorada.
- **Ren** — artesão humano da Vila Sakura, especializado em lanternas; criativo, paciente e prestativo.

Cada ficha possui espécie, função, lar, personalidade, interesses, rotina planejada, relações com outros moradores e descrição. As fichas são incluídas no contexto da Yukina, junto de até três lembranças recentes por morador.

O módulo oferece funções internas para listar e consultar moradores, registrar lembranças com origem permitida e recuperar as lembranças de cada personagem. As memórias são vinculadas ao personagem, não misturadas com as memórias pessoais dos membros do Discord.

**Limites desta etapa:** as rotinas ainda são descrições narrativas, não tarefas executadas por agentes autônomos. Os moradores ainda não conversam entre si, não se deslocam, não envelhecem, não possuem necessidades, inventário, profissão dinâmica ou economia. Não há comandos Discord, canal ou painel para administrar os moradores. Novas lembranças devem ser registradas por eventos confirmados ou interações implementadas, não inventadas como fatos ocorridos.


## Nona etapa — rotinas e encontros simulados

O módulo de moradores agora possui uma agenda narrativa por período do dia. Quando alguém conversa com a Yukina, o motor consulta o horário atual do mundo e registra as atividades previstas para aquele período, uma única vez por morador, dia e período. Os registros são persistidos em `yukina_ai_resident_events` com índice único para evitar duplicação em chamadas simultâneas.

Foram definidos momentos de descanso, cuidados com o jardim, abertura e organização da biblioteca, pesquisa de lendas, trabalho na oficina e acendimento das lanternas. Também existem encontros compartilhados programados: Hikari acompanha Ren no acendimento das lanternas ao entardecer; Aoi compartilha histórias com Hikari à noite. Os encontros são registrados como acontecimentos com os dois participantes.

Os últimos acontecimentos registrados são incluídos no contexto da IA, permitindo que Yukina fale sobre atividades que realmente constam no histórico da simulação.

**Limites desta etapa:** a simulação é acionada quando há uma conversa com a Yukina; não há processo em segundo plano nem execução contínua enquanto o bot está offline. Se nenhum membro conversar em determinado período, aquela faixa não é reproduzida retroativamente. As atividades são narrativas e determinísticas, não agentes independentes com consciência ou decisões próprias.


## Décima etapa — necessidades e bem-estar dos moradores

O módulo de moradores agora mantém indicadores narrativos persistentes de energia, fome, bem-estar e saúde (escala de 0 a 100). A energia diminui durante períodos ativos e se recupera na madrugada; a fome aumenta gradualmente com o tempo simulado. Há refeições registradas no amanhecer, à tarde e à noite, que reduzem a fome e recuperam um pouco de energia. Os registros de refeição usam identificadores únicos por morador, dia e período para evitar duplicação.

As necessidades são atualizadas usando o relógio persistente do mundo e incluídas nas fichas que a Yukina recebe como contexto. O cálculo limita cada atualização a 24 horas simuladas, mantém os valores dentro de 0–100 e só roda quando ocorre uma conversa com a Yukina.

**Limites desta etapa:** bem-estar e saúde permanecem estáveis por padrão; não há doença, ferimentos, higiene, inventário de comida, produção agrícola ou sistema de cuidados. As refeições são eventos narrativos programados, não consumo físico de itens. A simulação não roda em segundo plano e não representa consciência ou atividade autônoma real.


## Mundo vivo integrado — comunidade, progresso e acontecimentos

O modulo `systems/yukina-ai/life.js` adiciona uma camada persistente de vida comunitaria ao Santuario:

- **Construcoes:** biblioteca, oficina de lanternas, casas dos tres moradores e observatorio lunar, com catalogo e funcao interna para registrar novas estruturas.
- **Economia:** contas em KZ para moradores, tesouraria comunitaria, transferencias com verificacao de saldo e livro-razão com identificadores unicos.
- **Inventarios e habilidades:** itens por proprietario, controle de quantidade e experiencia/nível de habilidades.
- **Profissoes:** guardiao, bibliotecario, artesao, agricultor, curandeiro e explorador.
- **Familias:** registro explicito de lacos confirmados, sem inventar parentescos.
- **Envelhecimento:** suporte a idade e estagios de vida usando o calendario ficcional (360 dias por ano); so moradores com idade inicial registrada envelhecem.
- **Magia:** catalogo de tipos magicos e registro de desbloqueios. A Essencia da Origem de Yukina e protegida contra concessao, copia ou transferencia.
- **Missoes e festivais:** primeira missao da Vila Sakura e Festival das Mil Cerejeiras registrados, com funcoes internas para progresso e mudanca de estado.
- **Acontecimentos:** registros persistentes usados como contexto narrativo.

O motor inicializa os registros e injeta o estado comunitario nas conversas. As operacoes de alteracao ficam disponiveis como funcoes internas para futuras interacoes controladas; ainda nao existe uma interface publica de comandos/botoes para construir, transferir KZ, editar familias ou conceder magia. Nenhum membro pode realizar essas operacoes apenas por escrever uma frase: o modelo recebe o estado como contexto, mas nao possui acesso direto ao banco nem ferramentas de escrita.

A economia e inteiramente ficcional. O envelhecimento so e ativado quando uma idade inicial e registrada para o morador. A missao e o festival iniciais sao registros planejados, nao eventos ja realizados. O relogio e as rotinas continuam sendo simulacoes persistidas, nao pensamento independente enquanto o bot esta offline.


## Moderação de canais e cargos

A camada de comandos de moderação oferece operações explícitas por Slash e por prefixo, com verificação de permissões do executor, permissões da Yukina e hierarquia de cargos:

- `/cargo`: escolher **Conceder** ou **Retirar** um cargo de um membro. Por prefixo: `Ycargo @membro @cargo conceder` ou `Ycargo @membro @cargo retirar`.
- `/bloquear` e `/desbloquear`: bloquear ou liberar o canal atual (ou um canal selecionado). Prefixos: `Ylock` / `Yunlock`, também disponíveis como `Ybloquear` / `Ydesbloquear`.
- `/slow modo-lento`: definir o intervalo em segundos, incluindo `0` para desativar. Por prefixo: `Yslow 30s`, `Yslow 5m` ou `Yslow #canal off`.
- `/clear quantidade`: apagar de 2 a 100 mensagens recentes. Por prefixo: `Yclear 25`.
- `/clear chat` ou `Yclear chat`: limpar até 1.000 mensagens recentes do canal por execução.

A limpeza preserva mensagens fixadas e respeita a limitação do Discord: mensagens com mais de 14 dias não podem ser apagadas em massa. Para todas as ações, a Yukina precisa receber as permissões correspondentes no servidor; o executor também precisa ter a permissão de moderação exigida. A hierarquia do Discord continua sendo respeitada para cargos. A Yukina IA também reconhece pedidos administrativos diretos em linguagem natural, como 'bloqueie este canal', 'ative o modo lento por 30 segundos', 'limpe 20 mensagens', 'limpe o chat', 'conceda @Cargo para @Membro' e 'retire @Cargo de @Membro'. Para evitar interpretações ambíguas, cargos e membros precisam ser mencionados; os demais comandos atuam no canal atual ou no canal mencionado. A execução é determinística e sempre verifica as permissões de quem pediu, as permissões do bot e a hierarquia de cargos. O modelo de linguagem não recebe acesso direto ao banco nem autoridade para ignorar essas verificações.


### Cargos pelo nome

Para conceder ou retirar um cargo pela Yukina IA ou pelo comando de prefixo, basta mencionar o membro e escrever o nome exato do cargo. Não é necessário marcar o cargo. Exemplos: `Yia conceda Moderador para @Membro`, `Yia retire VIP de @Membro`, `Ycargo @Membro Moderador conceder`. Se houver mais de um cargo possível com o mesmo nome ou correspondência, a Yukina pede esclarecimento em vez de escolher aleatoriamente. A menção ao cargo continua sendo aceita como alternativa.


## Suporte a áudio e voz — Groq + ElevenLabs

A integração de áudio foi adicionada em uma etapa separada:

- **Áudios anexados:** quando um membro envia mensagem de voz ou arquivo de áudio no servidor, Yukina transcreve em português com Groq Whisper, envia a transcrição ao mesmo motor de conversa e responde marcando o autor.
- **Conversa em canal de voz:** use /voz entrar ou Yvoz entrar enquanto estiver conectado a um canal de voz. A Yukina aguarda a conexão ficar pronta antes de confirmar, recebe os trechos de fala, transcreve com Groq, conversa usando o contexto e responde por texto no canal de texto em que o comando foi usado e por áudio no canal de voz.
- **Status:** use /voz status ou Yvoz status para ver o canal, o estado da conexão, se está processando uma fala e há quanto tempo está conectada.
- **Sair:** use /voz sair ou Yvoz sair. Apenas quem iniciou a sessão ou alguém com Gerenciar Servidor pode encerrá-la.
- **Estabilidade:** a captura mantém uma fila para até cinco falas aguardando processamento, atende uma fala por vez para evitar sobreposição de respostas, descarta áudio interrompido pelo limite de 15 segundos, aguarda a conexão ficar pronta e tenta recuperar desconexões breves. Se a conexão não se recuperar, a sessão é encerrada e o canal de texto recebe um aviso.
- **Privacidade:** ao entrar, Yukina anuncia que está ouvindo. O áudio é processado em memória e enviado ao serviço Groq para transcrição; não é salvo como gravação no MongoDB. A recepção de áudio do Discord é uma API não documentada oficialmente e pode ter limitações.
- **Limites:** cada fala recebida é limitada a aproximadamente 15 segundos; anexos de áudio são limitados a 24 MB. A franquia gratuita dos provedores pode ter limites, mudar ou acabar; o sistema não garante uso ilimitado gratuito.

### Variáveis adicionais no Render

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `GROQ_API_KEY` | Sim para transcrição | Chave do Groq |
| `ELEVENLABS_API_KEY` | Sim para resposta falada | Chave do ElevenLabs |
| `ELEVENLABS_VOICE_ID` | Sim para resposta falada | ID da voz escolhida no ElevenLabs |
| `GROQ_STT_MODEL` | Não | Padrão: `whisper-large-v3-turbo` |
| `ELEVENLABS_MODEL_ID` | Não | Padrão: `eleven_multilingual_v2` |

Não publique as chaves no GitHub ou no Discord. Configure-as em Render → Environment. Para áudio anexado, basta a chave Groq; para conversa em canal de voz, são necessárias as três variáveis Groq/ElevenLabs.

O bot precisa da permissão **Conectar** e **Falar** no canal e do intent de gateway **GuildVoiceStates**, incluído no cliente. O comando /voz entrar exige que o membro que chamou esteja conectado ao canal de voz.


## Etapa de integração — recursos narrativos acessíveis no Discord

A integração complementar está disponível pelo comando `/yukina` e pelo prefixo `Yyukina`:

- `/yukina status` — estado do santuário, dia, horário, estação, clima, local, moradores, construções, missões, festivais e registros mágicos.
- `/yukina mundo` — mesma visão do mundo persistente.
- `/yukina autobiografia` — capítulos confirmados da personagem.
- `/yukina carta-futuro` — cria uma carta para releitura futura, usando a data local de Brasília. Restrito ao Criador e à mãe.
- `/yukina carta-privada` e `/yukina cartas-inbox` — cartas privadas entre os dois IDs autorizados. A consulta verifica o ID do destinatário e responde de forma efêmera.
- `/yukina historia-criar` — cria rascunho interativo com 2 a 5 escolhas. Restrito ao Criador e à mãe.
- `/yukina historias` — lista histórias publicadas.
- `/yukina historia-publicar` — publica a história no canal atual com botões de votação. Cada usuário pode votar uma única vez por história.
- `/yukina historia-resultados` — mostra a contagem de votos.
- `/yukina diario` — consulta os registros agregados, restrito ao Criador e à mãe.
- `/yukina relatorio` — relatório agregado dos últimos sete dias, para a família da Yukina ou membros com Gerenciar Servidor.

## Ciclo automático do mundo

Depois que o núcleo da IA é carregado, um ciclo é executado imediatamente e depois a cada 15 minutos enquanto o processo do bot estiver ativo. Ele avança o relógio persistente, atualiza necessidades simuladas, registra rotinas e encontros programados, atualiza idades e registra cartas futuras que chegaram à data de releitura. O ciclo não executa ações reais fora do Discord e não representa consciência ou atividade enquanto o processo está desligado; o relógio recupera o tempo decorrido quando o bot retorna.

Cartas futuras só são marcadas como abertas depois que uma resposta da Yukina efetivamente usa o conteúdo. As cartas privadas não entram no contexto geral da IA.

## Segurança e limites

- Cartas privadas e diários pessoais são consultados apenas pelos IDs autorizados.
- Histórias oficiais só podem ser criadas pelo Criador ou pela mãe; a publicação também permite membros com Gerenciar Servidor.
- Botões de votação validam se a história está publicada e se a escolha pertence à história. Índice único no MongoDB impede votos duplicados.
- Relatórios usam somente contagens agregadas, sem copiar mensagens, prompts ou respostas.
- As rotinas, moradores, economia, missões, festivais e magia são sistemas narrativos persistidos no MongoDB. Não são agentes conscientes nem atividade real fora do processo do bot.

## Configuração e ativação

Não foram adicionadas novas chaves de API para estas etapas. Elas usam a conexão MongoDB já existente e o núcleo OpenRouter já configurado. O comando slash `/yukina` será sincronizado pelo registro automático de comandos na inicialização.
