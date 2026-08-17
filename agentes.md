# Agentes de IA no Loop

> Planejamento da camada de automação por agentes de IA da plataforma Loop: para cada
> fase do loop de produto, o que um agente pode fazer — sempre com o processo manual
> intacto e um dial de autonomia por agente. O objetivo declarado: *"o ideal é eu
> conseguir deixar tudo automático se eu quiser e também poder fazer o processo
> manualmente. Estou fazendo mil coisas ao mesmo tempo."*

## Princípios (inegociáveis)

1. **Duplo modo.** O fluxo manual continua existindo intacto — os agentes são uma
   camada por cima, nunca um substituto. Sem chave de API configurada, a plataforma
   opera 100% manual, igual hoje.
2. **Dial de autonomia por agente**, em dois eixos independentes:
   - **Disparo**: manual (botão) → agendado/proativo (cron ou evento).
   - **Aplicação**: rascunho (sugestão aguardando aprovação) → automático (aplica e registra).
   Certos tipos de ação **nunca** têm modo automático (ver guardrails abaixo).
3. **Tudo que agente produz é uma sugestão rastreável**: quem gerou, de que insumo,
   quando; estados sugerida → aceita/editada/rejeitada/aplicada_auto. Aprovar uma
   sugestão executa **as mesmas mutações do fluxo manual** — os portões do funil
   vivem nas actions, então **agente furar portão é estruturalmente impossível**,
   não uma promessa de prompt.
4. **Mesmo desacoplamento das fontes.** `src/lib/agentes/` espelha `src/lib/fontes/`:
   contrato `Agente`, registro em `index.ts`, plugar agente novo = 1 arquivo + 1
   prompt + 1 linha no registro. O provedor de IA é um segundo contrato plugável.
5. **Guardrail acima do dial** (padrão Intercom Fin): mesmo em automático, sempre
   exigem humano — criar oportunidade nova na árvore, avaliação de priorização,
   mover estado de oportunidade/solução, veredito de teste, veredito e aprendizado
   de lançamento. O dial gradua o rotineiro; o portão nunca gradua.
6. **Sem evidência, o agente não propõe.** Nenhum agente inventa oportunidade,
   persona ou análise a partir do conhecimento geral do modelo — só trabalha sobre
   sinais, entrevistas e dados que existem no banco, com **citação literal
   verificável** do trecho-fonte. Sugestão pendente não conta em portão nem em score.

> Validação externa: a própria Teresa Torres desenha hoje a IA da Vistaly com
> exatamente esses princípios — draft-first ("nothing applies on its own"), evidência
> verbatim obrigatória, e mudanças na árvore como **diff tipado** revisável item a
> item (criar / ligar evidência / mover / mesclar). É leitura obrigatória antes de
> implementar o Triador: producttalk.org/vistaly e /ai-opportunity-solution-trees.

## Provedor de IA: OpenAI (decisão)

O provedor inicial é a **API da OpenAI** — decisão do Lucas. A arquitetura não muda
por isso, porque o app nunca conhece o provedor:

- **Um único arquivo** (`src/lib/agentes/cliente-ia.ts`) implementa o contrato
  `GerarEstruturado` usando o SDK da OpenAI com **structured outputs** (JSON Schema
  — saída sempre validada, sem parse frágil). Trocar de provedor = reescrever esse
  arquivo; nenhum agente muda.
- **Modelo por classe de tarefa**, configurável por agente sem deploy: um **modelo
  mini** para triagem/classificação (barato, roda todo dia) e o **modelo topo de
  linha** para síntese, SQL e textos que o Lucas assina embaixo (avaliação, veredito,
  aprendizado). Conferir os nomes vigentes da OpenAI ao implementar e deixá-los em
  config, nunca hardcoded.
- A chave (`OPENAI_API_KEY`) vive em `.env.local`, lida só pelo cliente-ia e pelo
  runner. **Custo estimado do sistema inteiro: < US$5/mês** (triagem em modelo mini
  custa centavos; a coluna de custo por execução torna isso visível, não estimado).

## O elenco (depois do corte do crítico)

O material bruto propôs 12 agentes. Doze prompts para calibrar, doze diais para
vigiar e doze remetentes de sugestão é receita de fadiga de aprovação para um PM
solo. O corte final: **4 agentes de registro + 3 botões + 1 regra**.

### Agentes de registro (têm dial, prompt versionado e aparecem em /agentes)

| Agente | Passos | O que faz | Aplicação default |
|---|---|---|---|
| **Triador** | 3 → 4 | Recebe insumo bruto (daily do CS colada, transcrição de entrevista, thread) e produz: sinais atômicos com citação literal → **diff tipado da árvore** (ligar como evidência de oportunidade existente · criar oportunidade nova na voz do cliente, já nascendo com a evidência · arquivar como ruído). Deduplica contra a árvore inteira ("prefira ligar a existente"). Internamente em **dois passos** (padrão Vistaly): snapshot por insumo, depois diff contra a árvore — nunca um mega-prompt. | Rascunho. Ligações de evidência podem ir a automático depois que a taxa de aprovação provar; **criar oportunidade nunca é automático**. |
| **Redator de Avaliação** | 5 | Rascunha as notas 1–5 dos 4 critérios com justificativa citando evidência real ("7 evidências, 5 escolas distintas; a irmã mais próxima tem 2") e grau de confiança por critério ("mercado: sem insumo — valide"). Justificativa aparece **antes** da nota. Nunca escreve o campo decisão. | Sempre rascunho — preenche o formulário; salvar é sempre do Lucas. Auto-preencher a avaliação furaria o portão do discovery na prática. |
| **Agente de Risco** | 7 + 8 | Percorre o story map perguntando "o que precisa ser verdade? como pode dar errado?" e gera suposições nas 5 lentes com posição sugerida na matriz (regra dura: sem evidência ligada no banco, evidência ≤ 2; máx. 7 por rodada, 2 por lente). Para a mais arriscada, desenha o teste: método mais barato adequado à lente + **critério numérico falseável antes** ("X de Y em Z dias") + roteiro (script de entrevista dirigida ou SQL de dado histórico). Critério sem número é descartado antes de gravar. | Rascunho. Sub-caso automático permitido: teste por dados históricos com fonte plugada — roda a consulta e preenche o resultado; o **veredito é sempre humano**. |
| **Fechador de Loop** | 10 | O mais valioso. (a) Rascunha a ficha: hipótese no formato padrão, métrica primária (leading→lagging), meta, guardrails — e **escreve o SQL na fonte plugada** (BigQuery na Mooney), testa com dry-run e mede a baseline na janela pré-lançamento com número real. (b) No dia da revisão 30/60/90: mede pela infra de fontes existente e rascunha a nota comparativa. (c) No fechamento: rascunha veredito + aprendizado, obrigado a listar confounders conhecidos (sazonalidade escolar!). | Por sub-tarefa: medição no dia = automático (já é o padrão do `atualizar`); ficha = rascunho; **veredito/aprendizado = sempre rascunho, sem opção automático** — o momento de aprendizado do PM é o ponto do loop inteiro. |

### Botões (sob demanda, sem dial, sem cron)

- **Roteiro de entrevista** (passo 3): dado persona + oportunidade em discovery, gera
  o roteiro story-based ("me conta a última vez que...") para o Lucas conduzir a call.
  É a fase 1 do Entrevistador — ver seção própria abaixo.
- **Brief para o Linear** (passo 9): quando a solução passa o portão de entrada
  (riscos testados), compila a trilha de discovery num PRD — problema com citações
  reais, decisão de priorização, story map, validado/refutado, e a seção obrigatória
  **"o que NÃO validamos"** (gerada do `altoRisco()` da própria plataforma, não do
  julgamento do modelo). O botão nem aparece antes do portão.
- **Pesquisa de concorrência** (passo 6): busca na web como concorrentes abordam a
  oportunidade — COMO e POR QUÊ, com link de fonte em cada afirmação; sem fonte,
  rotulado "hipótese a verificar". Candidatas de solução só são ofertadas quando já
  existe ≥1 solução do próprio Lucas (o agente destrava a 3ª ideia, não substitui a
  ideação) e **não contam para o portão 3/3 até aprovadas**.

### Regra no `atualizar` (nem é agente)

- **Vigia** (passos 10 → 1 → 3): a cada `npm run atualizar`, uma regra **estatística**
  (variação acima de limiar) decide SE uma métrica se mexeu; o LLM só redige o texto.
  O achado entra como **sinal no inbox** — métrica que se mexeu entra no mesmo funil
  de discovery que uma conversa de CS. É a seta de retorno do board virando software.
  Proibido de atribuir causa: descreve o movimento, quem hipotetiza é o PM.

### Cortados (com critério de volta)

- **Cartógrafo** (revisão da jornada): roda 4x por ano — é uma conversa de 20 minutos
  com o chat quando chegar o trimestre, não um agente para manter.
- **Entrevistador público**: adiado com gatilho observável (ver seção abaixo).
- Coach de entrevistas, promoção de dial por métrica, outbox de eventos: depois,
  quando houver histórico que os justifique.

## O Entrevistador (o pedido explícito — em duas fases)

### Fase 1 — sem infraestrutura nova (~80% do valor)

1. **"Preparar entrevista"**: botão que gera o roteiro story-based personalizado
   (persona + oportunidade investigada + método fixo da Teresa Torres: abrir ancorado
   em história, montar a cena, linha do tempo, redirecionar generalização para o
   concreto). Lucas conduz a call ao vivo (Meet/Zoom com transcrição automática).
2. **"Colar transcrição"**: nova coluna `transcricao` na entrevista; colar dispara o
   Triador, que sintetiza com citações e sugere evidências/candidatas. Reduzir o
   atrito de cada entrevista que o Lucas JÁ faz é o que sustenta o streak — não um
   robô entrevistando.

### Fase 2 — link público (só com gatilho observável)

Construir **apenas se** a fila de professores sem agenda para call se materializar
por 3+ semanas seguidas. É o componente mais caro do sistema (deploy, banco na nuvem,
custo por token, LGPD, risco relacional com escolas clientes). O desenho, quando
chegar a hora:

- App próprio (repo separado, deploy Vercel), rota pública `/e/[token]` — chat
  mobile-first, sem login, token de uso único com expiração e teto de ~20 turnos.
- **Tela de consentimento antes de tudo**: quem conduz (uma IA em nome do Lucas /
  Mooney), o que é gravado, para quê, botão "prefiro não continuar" que descarta.
  Sem disclosure a qualidade do dado cai (participantes retêm informação) — é
  requisito, não polimento.
- Banco próprio mínimo na nuvem (convite + mensagens); a plataforma local **puxa**
  transcrições concluídas no `npm run atualizar` e apaga da nuvem (minimização).
  O app público nunca alcança a máquina do Lucas.
- **Pressure-test obrigatório**: "testar como participante" antes de gerar o link.
- **Regras fixas**: persona de menores de idade não é elegível para link de IA (o
  agente se recusa a gerar); entrevista por agente conta em contador próprio e **não
  fecha o streak 1/1 humano** — a cadência da Teresa Torres existe para o PM ouvir
  gente; o agente é escala e follow-up, não substituto.
- O que a pesquisa diz esperar: conclusão de 30–45% (vs 5–15% de survey), saltando
  quando o convite chega por canal já existente — na Mooney, **WhatsApp do CS com a
  escola**, nunca e-mail frio. Riqueza comparável à humana em cenários estruturados;
  fraca em subtexto emocional e exploração profunda — que continuam sendo do Lucas.

## Arquitetura técnica

### Contrato (espelho de `src/lib/fontes/`)

```
src/lib/agentes/
├── types.ts        → Agente { id, nome, descricao, passoDoLoop, gatilhos,
│                     modeloPadrao, executar(ctx) → Proposta[] }
│                     Proposta { tipo, alvoTabela, alvoId|null, payload, resumo,
│                     insumos: RefInsumo[] }
├── cliente-ia.ts   → único arquivo que importa o SDK da OpenAI; implementa
│                     GerarEstruturado (structured outputs + contagem de tokens),
│                     injetado nos agentes — testáveis com mock
├── prompts/*.md    → prompt de cada agente, versionado no git; ajustar
│                     comportamento = editar markdown, sem deploy
└── index.ts        → registro (LISTA), como fontes/index.ts
```

### Dados (tabelas novas, zero mudança nas existentes)

- `sugestao` — a ação serializada: execucao_id, tipo, alvo_tabela, alvo_id, payload
  JSON, resumo, insumos JSON, estado (sugerida | aceita | editada | rejeitada |
  aplicada_auto | falhou), motivo_rejeicao, entidade_criada_id, timestamps. Os
  motivos de rejeição acumulados são o ciclo de melhoria dos prompts.
- `execucao_agente` — auditoria e custo por rodada: agente, gatilho, modelo, tokens,
  custo_estimado, status/erro.
- `agente_config` — o dial por agente e produto: modo + override de modelo + config.
- `insumo` — o texto bruto persistido (daily colada, transcrição), para a citação
  literal ser **verificável mecanicamente** antes de salvar (sinal sem trecho-fonte
  não grava — regra de sistema contra invenção).
- Colunas novas via o padrão `COLUNAS_NOVAS` já existente: `entrevista.transcricao`,
  `entrevista.conduzida_por`, `oportunidade.analise_concorrencia`,
  `produto.contexto` (JSON com o contexto de schema do warehouse — o conteúdo da
  skill de dados da Mooney vira **configuração do workspace**, nunca hardcode),
  flag de menor de idade na persona.

### O aplicador (a garantia estrutural)

`src/lib/sugestoes/aplicar.ts` tem uma função por tipo de sugestão que chama **o
mesmo núcleo das server actions dos formulários manuais**. Nota de implementação: as
actions atuais recebem `FormData` — extrair o núcleo programático delas (núcleo +
wrapper) é pré-requisito, senão a promessa "aprovar chama as mesmas mutações" não se
cumpre. Automático = o mesmo código, pulando a espera; se um portão bloquear (WIP
cheio, sem evidência), *downgrade gracioso* para sugerida com nota do bloqueio.
**Agente nunca dá INSERT direto em tabela de entidade, nem em automático** — é isso
que mantém a proveniência (badge "criada por agente" via join) sem tocar no schema
das entidades.

### Execução (desacoplada, como as fontes)

1. **Botão "rodar agora"** — server action, síncrona (agentes são 1 chamada de API).
2. **`npm run agentes`** — gêmeo do `atualizar-metricas.ts`: varredura **por estado**
   (sinais novos, entrevistas sem síntese, revisões vencidas — sem tabela de outbox
   no MVP; o estado já é a fila), digest no terminal, agendado por cron.
3. O app **nunca chama IA inline no request do usuário**; falha de API = registro de
   erro + retry na próxima rodada.

### UI

- **`/agentes`** (irmã de /fontes): agentes do registro com descrição, passo do loop,
  o dial, última execução e custo acumulado do mês.
- **Inbox de sugestões na home**: "🤖 Sugestões aguardando: N". Cada uma com resumo,
  o **"por quê" expandível** com insumos citados como chips clicáveis (padrão Linear
  — é o que permite aprovar em 5 segundos ou corrigir com precisão), e três ações:
  **Aceitar** · **Editar** (abre o formulário manual existente pré-preenchido —
  literalmente o mesmo formulário) · **Rejeitar** (motivo opcional).
- Entidades nascidas de sugestão exibem selo discreto "criada por agente em <data>"
  linkando a sugestão; quando o Lucas edita/aprova, isso fica registrado — o estado
  de maior confiança é "IA + humano" (padrão Dovetail).
- A home continua cobrando o **Lucas** pelas pendências — o agente age em nome dele,
  nunca é "dono" de nada (padrão Linear).

## O risco nº 1 do sistema

Não é um agente errar uma sugestão — é **SQL plausível-porém-errado do Fechador de
Loop virando baseline ou resultado oficial**, e um veredito em cima dele. Mitigação
em camadas, como regra de sistema desde a fase 1:

1. Toda consulta só é aprovável depois de exibida **com o valor do dry-run** e o
   detalhe da medição.
2. Baseline sempre acompanhada da janela usada.
3. Variação anômala vs revisão anterior marcada para olho humano antes de qualquer
   rascunho de veredito.
4. O rascunho de veredito é obrigado a listar confounders do workspace (na Mooney:
   férias escolares em julho/dezembro mudam tudo).
5. Veredito é sempre humano. Sempre.

## Agente executor — PRs em nome do PM

O passo além de sugerir: o agente escreve código e abre um Pull Request — para
instrumentar as métricas do PostHog no lugar certo do produto, ou para
implementar uma solução que saiu do funil. **O PR é a sugestão; mergear é o ato
humano, no GitHub.** Não existe dial de aplicação aqui: não há "aplicar
automático" possível por construção.

Guardrails (valem independente da ferramenta plugada):

1. O trabalho acontece num **git worktree isolado** criado a partir de
   `origin/<branch base>` fresca — nunca no checkout do dono, nunca herdando o
   que estava pendente lá.
2. Branch própria `loop/pr-<id>`; **nunca** commit ou push na branch base.
3. O **executor só edita arquivos**. Todo o git (worktree, branch, commit, push,
   PR via `gh`) é do fluxo em `scripts/executar-pr.ts` — o executor plugado não
   tem como furar a regra.
4. Sem diff, sem PR. Falhou, vira card com log na página de origem.

Peças:

- **Executores plugáveis** (`src/lib/executores/`): mesmo padrão de fontes e
  agentes — contrato `Executor { disponivel, executar(instrucoes, dir) }`.
  Provedores: `claude-code` (headless, acceptEdits — edita arquivos, não roda
  comandos) e `codex` (exec com sandbox workspace-write). Configurável por
  repositório.
- **Repositórios por produto** (tabela `repositorio`, UI em /fontes): caminho
  local do clone, branch base, executor e convenções fixas que vão em todo PR.
  Autenticação GitHub = o `gh` já logado na máquina; nenhum token na plataforma.
- **Tarefas** (tabela `tarefa_pr`): fila → rodando → pr_aberto | falhou, com log
  completo. A action dá spawn destacado do worker; a página mostra o estado.
- **Botões**: "Instrumentar via PR" na ficha do lançamento (usa o plano de
  instrumentação do Fechador — fecha o ciclo do padrão PostHog) e "Implementar
  via PR" na solução (usa o brief do Empacotador como instrução; sem brief, o
  story map).

## Ordem de construção (alívio de carga ÷ esforço)

| Fase | O quê | Por quê primeiro |
|---|---|---|
| 0 (~1 dia) | Infra mínima: contrato + `cliente-ia.ts` (OpenAI) + tabelas `sugestao`/`agente_config` + prompts | Base de tudo; sem UI nova além do inbox |
| 1 (~2-3 dias) | **Fechador de Loop — "Rascunhar ficha"** | Ataca a dívida declarada no primeiro uso: hipótese + métrica + SQL BigQuery com dry-run + baseline para OLITEF, rework e IA do professor. Nenhum outro agente remove tanto trabalho parado |
| 2 (~3-4 dias) | **Triador** (colar a daily do CS → sinais → diff da árvore), modo rascunho | Maior alívio recorrente (diário); resolve a decisão em aberto "CS registra ou Lucas tria?" por um terceiro caminho: o CS só entrega o bruto |
| 3 (~2-3 dias) | Cadência de entrevistas pela via barata: roteiro + `transcricao` + síntese | Baixa o custo de cada entrevista que o Lucas já faz |
| 4 (~1-2 dias) | `npm run agentes` + cron + regra do Vigia no atualizar | Só aqui considerar girar dials para automático, começando pelas ações aditivas/reversíveis |
| 5 ✓ | Botões sob demanda: Redator de Avaliação, Provocador de Ideias, Agente de Risco, brief do Empacotador + veredito rascunhado pelo Fechador | Com WIP de 2, priorização/ideação acontecem poucas vezes ao mês. (Pesquisa de concorrência com web ficou para depois — exige outra infra de busca) |
| 6 ✓ | Agente executor: repositórios plugados + executores de código plugáveis + PRs via gh | Pedido do PM antes do onboarding; PR é o formato natural de sugestão para código |
| 7 | Entrevistador público | **Só com o gatilho observável.** Nunca antes |

## Decisões em aberto

1. **Nomes de modelo da OpenAI** por classe de tarefa (mini para triagem, topo de
   linha para síntese) — conferir a lineup vigente ao implementar; fica em config.
2. **Consentimento na fase 1 das entrevistas**: o pedido verbal gravado no início da
   call cobre a transcrição ir para a plataforma? (Provavelmente sim para uma
   ferramenta pessoal de pesquisa, mas vale padronizar a frase.)
3. **Quando promover um dial a automático**: o critério proposto é taxa de aprovação
   sem edição (ex.: 19/20) — medir manualmente no começo, automatizar a régua depois.
4. **Contexto de schema do warehouse** (`produto.contexto`): semear do conteúdo da
   skill de dados da Mooney — decidir o formato (tabelas, joins, regras de higiene,
   confounders sazonais).
