# Plataforma de Produto

> Tradução do board "Loops de produto" (Miro) em uma plataforma que **guia** o
> trabalho de um gerente de produto — da métrica de negócio à mensuração de impacto,
> fechando o ciclo.
>
> **A plataforma é minha (Lucas), como gerente de produto — não é uma ferramenta
> interna da Mooney.** A Mooney é o primeiro produto gerenciado dentro dela: por
> enquanto só existem features da Mooney na plataforma, mas nada da Mooney é
> hardcoded. Tudo que é específico (BigQuery, personas, canais de sinal) é
> **conteúdo/configuração de um workspace**, não estrutura da plataforma.

## A ideia central

Tudo que este projeto queria fazer separado (fichas de lançamento, processo
documentado, painel de métricas) se resume em **uma plataforma que guia o
desenvolvimento de produto**:

- O loop do Miro é o "sistema operacional" da plataforma — cada passo do board vira
  uma feature.
- A entidade raiz é o **Produto** (workspace). A Mooney é o primeiro; os três
  lançamentos dela (OLITEF, rework do app, IA do professor) entram como registros
  retroativos dentro do workspace Mooney.
- O painel de métricas de sucesso é **uma feature** da plataforma, não um projeto à
  parte.
- Primeiro construímos a plataforma; depois definimos e capturamos as métricas de
  sucesso desses projetos dentro dela.

A palavra-chave é **guiar**. Um repositório de documentos morre em duas semanas. A
plataforma precisa dizer *o que fazer agora*: cobrar a entrevista da semana, mostrar
qual passo está bloqueando a oportunidade em discovery, avisar que a revisão de 30
dias de um lançamento está atrasada. Guardar artefato é consequência, não propósito.

## O loop (transcrição do board)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          ▼
Métrica de negócio → Jornada do usuário → Entrevistas (1+/semana)          │
                     (iterar até mapear    + Outras fontes de sinal        │
                      bem; sempre evolui)    do produto                    │
                                              │                            │
                                              ▼                            │
        Mapeamento de oportunidades (árvore em cima da jornada)            │
                                              │                            │
                                              ▼                            │
        Priorização (tamanho · companhia · mercado · cliente)              │
                                              │                            │
                                              ▼                            │
        Ideação (≥3 soluções por oportunidade + análise de concorrência)   │
                                              │                            │
                                              ▼                            │
        Mapeamento de suposições (story map · 5 lentes · maior risco)      │
                                              │                            │
                                              ▼                            │
        Teste de suposições → Desenvolvimento → Mensuração de impacto ─────┘
```

As 5 lentes das suposições (Teresa Torres): **Desejável** (alguém quer isso?),
**Viável** (devemos construir?), **Factível** (conseguimos construir?), **Usável**
(qualquer um consegue usar?), **Ética** (pode causar algum dano?).

---

## A entidade raiz: Produto (workspace)

Antes dos passos do loop, a estrutura que os contém.

**`Produto`**: nome, descrição, personas, fontes de dados de métricas, canais de
sinal. Todo o resto da plataforma (jornadas, métricas, oportunidades, soluções,
lançamentos) pertence a um produto.

O workspace **Mooney** configura:

- **Personas**: aluno, professor, escola/gestor.
- **Fonte de métricas**: BigQuery (`mooney-db39f`).
- **Canais de sinal**: interações do CS, gravações de conversas, gravação da daily
  do CS.

Amanhã, um segundo produto entra com personas, fontes e canais próprios — sem mudar
uma linha da plataforma. Esse é o teste de que nada ficou hardcoded.

---

## Tradução passo a passo

### 1. Métrica de negócio

**O que é no board.** O ponto de partida e de chegada do loop. Todo o trabalho de
produto existe para mover uma métrica de negócio.

**Na plataforma.** Entidade `MétricaDeNegócio` (por produto): nome, definição em uma
frase, **fonte** (query SQL num warehouse, número inserido manualmente, API — a fonte
é configurável por produto; na Mooney, queries no BigQuery), valor atual, meta,
histórico. Uma lista curada e curta (3–5 por produto) — se tudo é métrica de negócio,
nada é.

**Como guia.** Toda oportunidade e todo lançamento **precisam apontar para uma métrica
de negócio**. Se não dá para dizer qual métrica um trabalho move, a plataforma está
mostrando que o trabalho está desalinhado — esse é o teste. A home mostra as métricas
com tendência (sparkline).

**MVP → evolução.** MVP: métricas com fonte manual ou query rodada por script.
Evolução: atualização agendada automática, decomposição em métricas de input.

### 2. Construção da jornada do usuário básica

**O que é no board.** "Qual o fluxo do cliente para extrair valor da nossa solução?" —
da consciência do problema à avaliação da experiência. Nota do board: *a jornada deve
ser iterada até ser bem mapeada* e *o mapeamento vai sempre evoluir*.

**Na plataforma.** Entidades `Jornada` (uma por persona do produto) e `PassoDaJornada`
(ordenados, com descrição). A jornada é o **esqueleto estrutural** do workspace: é
nela que a árvore de oportunidades se pendura. Na Mooney: uma jornada do aluno, uma
do professor, uma da escola.

**Como guia.** Cada oportunidade nasce ancorada num passo da jornada — isso força o
mapeamento a evoluir (se uma dor não cabe em nenhum passo, a jornada está incompleta e
a plataforma sugere editá-la). Revisão periódica leve: a cada trimestre, um prompt
"essa jornada ainda descreve a realidade?".

**MVP → evolução.** MVP: editor simples de lista ordenada de passos por persona.
Evolução: versões da jornada com histórico de mudanças.

### 3. Entrevistas com usuários + outras fontes

**O que é no board.** No mínimo **uma entrevista por semana**, no formato
*story-based* (pedir histórias específicas vividas, não opiniões). Em paralelo,
fontes contínuas de sinal — no caso da Mooney: interações de clientes com o CS,
gravações, gravação da daily do CS.

**Na plataforma.** Duas entidades:

- `Entrevista`: data, entrevistado, persona, link da gravação, notas guiadas pelo
  template story-based, e as oportunidades extraídas.
- `Sinal`: um item de inbox vindo dos canais configurados no produto (canal, conteúdo,
  data). Barato de registrar — uma frase basta.

**Como guia.** Três mecânicas:

1. **Streak semanal**: a home mostra "Entrevistas esta semana: 0/1" — a cadência é a
   feature, não um lembrete.
2. **Template story-based embutido**: o registro da entrevista já vem com a estrutura
   ("conte sobre a última vez que...") — o método vem junto com o formulário.
3. **Síntese obrigatória**: ao salvar uma entrevista, a plataforma pergunta "que
   necessidades, dores ou desejos apareceram?" e pede para ligar (ou criar) as
   oportunidades na árvore. A entrevista não fica "registrada e esquecida" — ela
   alimenta o passo seguinte por design.

O inbox de sinais tem um fluxo de triagem: cada sinal é **promovido** a evidência de
uma oportunidade ou **arquivado**. Sinais não triados aparecem na home.

**MVP → evolução.** MVP: registro de entrevista + streak + inbox de sinais. Evolução:
transcrição automática de gravações e sugestão de oportunidades por IA (a IA sugere,
o humano decide).

### 4. Mapeamento de oportunidades (árvore)

**O que é no board.** Necessidades, dores e desejos organizados numa **árvore de
oportunidades construída em cima da jornada** (Opportunity Solution Tree).

**Na plataforma.** Entidade `Oportunidade`: título formulado na voz do cliente
("preciso de...", "me frustra que..."), persona, **passo da jornada âncora**,
oportunidade-pai (estrutura de árvore), **evidências** (links para entrevistas e
sinais), estado (`identificada → priorizada → em discovery → resolvida / arquivada`).

**Como guia.** Regra de ouro: **não existe oportunidade sem evidência**. Criar uma
oportunidade exige ligar pelo menos uma entrevista ou sinal — isso mata a
"oportunidade inventada na sala de reunião". A contagem de evidências vira um proxy
natural de frequência ("quantas vezes ouvimos isso?"), que alimenta a priorização.

**MVP → evolução.** MVP: árvore como lista indentada agrupada por passo da jornada
(não precisa de canvas visual). Evolução: visualização gráfica da árvore.

### 5. Priorização de oportunidades

**O que é no board.** Definir qual oportunidade abordar, com 4 grupos de critérios:
**tamanho** (quantos clientes afetados, com que frequência), **fatores da companhia**
(suporta a visão e os objetivos estratégicos?), **fatores mercadológicos** (table
stake ou diferencial estratégico? como nos posiciona contra competidores?) e
**fatores do cliente** (o quanto é relevante para ele?).

**Na plataforma.** Avaliação estruturada na própria oportunidade: os 4 grupos como
campos (nota 1–5 + justificativa curta cada), preenchidos ao promover a oportunidade.

**Como guia.** Duas mecânicas:

1. **Comparação lado a lado**: a tela de priorização mostra as oportunidades irmãs
   com suas avaliações — a decisão é comparativa, não absoluta. A decisão fica
   registrada: "escolhemos X em vez de Y e Z porque...".
2. **Limite de WIP**: no máximo **1–2 oportunidades "em discovery"** por produto. Para
   um PM solo, o limite de trabalho em andamento é o que impede a plataforma de virar
   uma lista infinita de coisas pela metade.

**MVP → evolução.** MVP: formulário dos 4 critérios + comparação + limite de WIP.
Evolução: histórico de decisões de priorização como trilha de aprendizado.

### 6. Ideação de soluções + análise de concorrência

**O que é no board.** **Pelo menos três soluções por oportunidade** — a primeira ideia
raramente é a melhor. E análise de concorrência: como o concorrente aborda essa
oportunidade? *Por que* ele faz dessa forma?

**Na plataforma.** Entidade `Solução`: título, descrição, oportunidade-mãe, estado
(`ideia → em teste → em desenvolvimento → lançada / descartada`). Campo de análise de
concorrência na oportunidade.

**Como guia.** **Bloqueio explícito**: a oportunidade não avança para o mapeamento de
suposições com menos de 3 soluções cadastradas — a plataforma mostra "2/3 soluções" e
segura o passo seguinte. É a tradução literal da regra do board em software.

**MVP → evolução.** MVP: cadastro de soluções com contador e bloqueio + campo de
concorrência. Evolução: ideação assistida por IA para destravar a terceira ideia.

### 7. Mapeamento de suposições

**O que é no board.** O passo mais denso. Para cada solução: (a) **story map** — o que
o cliente *tem que fazer* para obter valor; (b) subir a árvore e perguntar "como essa
solução impacta a oportunidade?"; (c) jornada simples do usuário dentro da solução;
(d) a pergunta que **gera** as suposições: *qual parte do fluxo apresenta o maior
risco de impedir a entrega de valor? como essa solução pode dar errado?* — tudo
classificado nas 5 lentes (desejável, viável, factível, usável, ética) e priorizado
sem piedade (*ruthlessly prioritize*).

**Na plataforma.** Entidade `Suposição`: texto no formato "acreditamos que...",
lente (D/V/F/U/E), solução, passo do story map de origem, **risco** (importância ×
evidência que temos), estado (`mapeada → em teste → validada / refutada`).

**Como guia.** Um **wizard por solução**, em três passos:

1. "Liste os passos que o usuário precisa dar para extrair valor desta solução"
   (story map simples, lista ordenada).
2. Para cada passo: "o que precisa ser verdade para isso funcionar?" — com as 5
   lentes como sugestão de ângulos.
3. Matriz 2×2 (importância × evidência): as suposições **importantes e sem
   evidência** sobem para o topo — são elas que vão para teste primeiro.

**MVP → evolução.** MVP: cadastro de suposições com lente + ordenação por risco.
Evolução: geração assistida de suposições a partir do story map.

### 8. Teste de suposições

**O que é no board.** As suposições mais arriscadas viram testes antes de desenvolver.

**Na plataforma.** Entidade `TesteDeSuposição`: suposição alvo, método (protótipo,
entrevista direcionada, fake door, dado histórico na fonte do produto...), **critério
de sucesso definido antes**, resultado, veredito (`validada / refutada /
inconclusiva`), aprendizado.

**Como guia.** A mesma disciplina da ficha de lançamento, uma escala antes: **não dá
para criar um teste sem critério de sucesso pré-definido**. Ao concluir o teste, o
veredito atualiza a suposição e a plataforma pergunta: "a solução continua de pé?" —
refutar uma suposição crítica deve poder matar (ou transformar) a solução barato,
antes do desenvolvimento.

**MVP → evolução.** MVP: registro de teste com critério obrigatório + veredito.
Evolução: biblioteca de métodos de teste com templates.

### 9. Desenvolvimento da solução

**O que é no board.** Construir. O desenvolvimento em si acontece **fora** da
plataforma (código, Linear) — a plataforma só precisa do estado.

**Na plataforma.** Estado `em desenvolvimento` na solução + link para o épico/issue
externo.

**Como guia.** Um **checklist de entrada e de saída**:

- *Entrada* (para mover para "em desenvolvimento"): as suposições de maior risco
  foram testadas? A decisão está registrada?
- *Saída* (para marcar "lançada"): a **ficha de lançamento existe e está preenchida**
  — hipótese, métrica primária, baseline, meta, guardrails, datas de revisão. É aqui
  que a plataforma garante estruturalmente que *nada mais é lançado sem métrica de
  sucesso definida*. O problema original deixa de depender de disciplina e vira regra
  do sistema.

**MVP → evolução.** MVP: estado + link + checklists. Evolução: sincronização de
status com o Linear.

### 10. Mensuração de impacto (fecha o loop)

**O que é no board.** Medir o que o lançamento causou — e a seta volta para a métrica
de negócio, reiniciando o ciclo.

**Na plataforma.** Entidade `Lançamento` — a evolução direta das fichas que já criamos
em `lancamentos/`: solução, data de lançamento, hipótese, **métrica primária** (ligada
a uma métrica de negócio ou derivada dela), baseline, meta, prazo, guardrails, query
na fonte do produto, revisões 30/60/90, resultado, veredito, aprendizado.

**Como guia.**

1. **Agenda de revisões**: a home mostra as revisões vencidas ("OLITEF: revisão de 30
   dias atrasada há 12 dias"). No dia, a plataforma roda a query (ou pede o número) e
   registra o valor contra a meta.
2. **Veredito obrigatório**: um lançamento sem veredito é um lançamento que não
   terminou — ele continua aparecendo como pendência.
3. **O aprendizado realimenta o loop**: ao fechar um lançamento, a plataforma
   pergunta "o que esse resultado nos diz?" — a resposta pode gerar novas
   oportunidades na árvore ou revisar a métrica de negócio. É a seta de retorno do
   board virando software.

**MVP → evolução.** MVP: as 3 fichas atuais viram registros + agenda de revisões com
cobrança. Evolução: painel automático alimentado pela fonte de dados do produto.

---

## Modelo de objetos (visão geral)

```
Produto (workspace — Mooney é o primeiro)
 ├─ personas · fontes de métricas · canais de sinal   (configuração)
 │
 ├─ MétricaDeNegócio ◄────────────────────────────────┐
 │       ▲                                            │ (aprendizado realimenta)
 │       │ move                                       │
 ├─ Jornada (por persona)                             │
 │    └─ PassoDaJornada                               │
 │          └─ Oportunidade (árvore, exige evidência) │
 │               ├─ evidências: Entrevista / Sinal    │
 │               ├─ avaliação de priorização (4 critérios)
 │               └─ Solução (mínimo 3 por oportunidade)
 │                    ├─ Suposição (5 lentes, risco)
 │                    │    └─ TesteDeSuposição (critério antes, veredito depois)
 │                    └─ Lançamento (métrica, baseline, meta, revisões, veredito) ─┘
```

Cada entidade nasce de um passo do board — não há entidade que não corresponda a um
passo do loop, e nenhuma carrega nada específico da Mooney.

## A home: "o que fazer agora"

O coração da plataforma como **guia** é uma única tela de estado por produto:

- 📞 **Entrevistas esta semana: 0/1** (streak)
- 📥 **Sinais não triados: 4**
- 🌳 **Oportunidade em discovery:** "Professor não sabe usar a IA em aula" — próximo
  passo bloqueante: *faltam 2 soluções (1/3)*
- 🚀 **Revisões de lançamento atrasadas:** OLITEF (30d, +12 dias) · Rework (60d, +3 dias)
- 📊 **Métricas de negócio** com tendência

Se eu abrir a plataforma e em 10 segundos souber o que fazer, ela cumpriu o papel.
Com mais de um produto no futuro, a home agrega as pendências de todos.

## Posicionamento dos 3 projetos da Mooney

Os três entram no workspace Mooney como **`Solução` no estado "lançada" com
`Lançamento` retroativo** (as fichas de `lancamentos/` são a semente), cada um com uma
oportunidade-mãe a reconstruir:

| Projeto | Oportunidade-mãe (a reconstruir) | Estado do lançamento |
|---|---|---|
| OLITEF | Ex.: "escolas precisam de um evento que mobilize os alunos" | Sem métrica definida — ficha rascunhada |
| Rework do app | Ex.: "alunos abandonam o app por experiência confusa" | Sem baseline — precisa da data de corte |
| IA do professor | Ex.: "professor não se sente seguro para dar aula de ed. financeira" | Sem instrumentação — uso não é logado |

A plataforma **nasce mostrando essa dívida** no painel — e o primeiro uso real dela é
pagá-la: definir a métrica de cada um, capturar baseline e agendar as revisões. É o
melhor teste possível de que a plataforma funciona.

## O painel de métricas de sucesso (feature)

Uma feature do módulo de mensuração, não um projeto à parte:

- Lista de lançamentos com **métrica primária vs. meta** e curva no tempo.
- Status das revisões (em dia / atrasada / concluída) e vereditos.
- Métricas de negócio no topo, ligando lançamentos ao que importa.
- Fonte: a fonte de dados configurada no produto — na Mooney, queries BigQuery
  (`mooney-db39f`), na fase 1 rodadas por script Python; depois, automáticas.

## Ordem de construção

**Fase 1 — o mínimo que já guia** (resolve a dor declarada):
workspace Mooney configurado · métricas de negócio · registro de entrevistas com
streak · inbox de sinais · árvore de oportunidades simples (lista indentada) ·
lançamentos com agenda de revisão e cobrança · a home "o que fazer agora". *Ao fim da
fase 1: definir e capturar as métricas de OLITEF, rework e IA do professor dentro da
plataforma.*

**Fase 2 — o funil completo:** priorização com os 4 critérios e limite de WIP ·
soluções com bloqueio de 3+ · suposições com as 5 lentes · testes de suposição.

**Fase 3 — automação e integração:** queries agendadas na fonte do produto ·
sincronização com Linear · transcrição de gravações · visualização gráfica da árvore ·
assistência de IA (sugestão de oportunidades e suposições) · suporte real a múltiplos
produtos.

## Decisões em aberto

1. **Forma da plataforma**: app web (Next.js + banco próprio) ou, numa fase 0, dados
   estruturados + scripts que geram a home e o painel? Como é uma plataforma pessoal
   (não da Mooney), o repositório dela provavelmente merece vida própria fora deste
   repo de scripts da Mooney. Recomendação: validar o processo com o mais barato que
   cobra cadência de verdade; web app quando o processo provar que gruda.
2. **Colaboradores por workspace**: o CS da Mooney registra sinais direto na
   plataforma, ou eu trio a daily e registro? (Muda o desenho do inbox e a
   necessidade de login/permissões.)
3. **Qual é a métrica de negócio nº 1 da Mooney hoje?** O workspace começa por ela.
4. **Instrumentação da IA do professor**: o uso é logado em algum lugar? Se não,
   é pré-requisito de qualquer medição.
