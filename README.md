# Loop.

**Uma plataforma pessoal de gestão de produto que transforma método em regra de
software.** O Loop. implementa o ciclo de continuous discovery (na linha de
Teresa Torres) de ponta a ponta — da métrica de negócio à mensuração de impacto
— com os portões do método aplicados pelo sistema, agentes de IA que propõem
(mas nunca decidem) e medição plugada por padrão.

É uma ferramenta de PM para PMs: cada produto gerenciado é um workspace, e nada
do domínio de um produto específico vive no código.

## O loop

```
1 Métrica de negócio (lagging) → 2 Jornada → 3 Entrevistas + sinais
→ 4 Árvore de oportunidades → 5 Priorização → 6 Ideação (3+)
→ 7 Suposições (5 lentes) → 8 Testes → 9 Desenvolvimento
→ 10 Mensuração de impacto → volta ao 1
```

O que diferencia a plataforma de um cadastro é que **os portões do método são
regra de sistema, não disciplina**:

- Oportunidade nasce com evidência — sem evidência, o sistema trata como palpite.
- Discovery exige avaliação completa nos 4 critérios e vaga no WIP (máx. 2).
- Suposições só abrem com 3+ soluções na mesa — a primeira ideia raramente é a melhor.
- Teste só existe com critério numérico falseável definido **antes**.
- Risco importante exige resposta — teste validado ou mitigação de desenho —
  antes do desenho consolidado e do desenvolvimento.
- Nenhuma solução é "lançada" sem ficha de lançamento: hipótese, métrica primária
  (leading → aponta para a lagging), baseline, meta e guardrails, **antes** de lançar.
- Todo lançamento tem revisões de 30/60/90 dias e termina em veredito + aprendizado.

## As três naturezas de IA

Tudo passa pelo mesmo guardrail: **a IA propõe; aceitar é sempre um ato humano**
— e o aceite aplica pelas mesmas mutações do fluxo manual, então agente não fura
portão por construção.

1. **Agentes** (sugestões estruturadas): Triador (texto bruto → sinais com
   citação literal verificada → destino na árvore), Redator de Avaliação,
   Provocador de Ideias, Comparador de Soluções (jornada de valor + risco por
   passo de cada ideia), Agente de Risco (suposições nas 5 lentes + desenho do
   teste da mais arriscada), Arquiteto (consolida o desenho a partir das
   respostas aos riscos — recusa-se enquanto houver risco importante sem
   resposta), Empacotador (brief de desenvolvimento que carrega o que **não**
   foi validado), Fechador de Loop (ficha de medição com consulta testada em
   dry-run e baseline medida; rascunho de veredito com confounders) e Roteirista
   de entrevistas.
2. **Conselheiros** (chat que pensa junto): conversas persistentes por passo do
   loop — métricas, jornada, ideação — com o contexto do workspace injetado.
   Quando a conversa converge, uma ferramenta preenche o formulário como
   sugestão.
3. **Executor** (código): com um repositório plugado, botões "via PR" fazem o
   trabalho num worktree isolado, em branch própria, e abrem um Pull Request —
   mergear é decisão humana, no GitHub.

Sem chave de IA configurada, tudo funciona manualmente — os agentes apenas
explicam o que falta.

## Medição plugada

Fontes de dados são provedores plugáveis (contrato de 1 arquivo): PostHog
(HogQL) como padrão, comando de shell e HTTP/JSON como válvulas de escape.
Métricas e revisões guardam *qual fonte* e *qual consulta* — e se medem sozinhas
via runner agendável (`npm run atualizar`), com uma regra de vigia para desvios.

## Stack

Next.js (App Router, server actions) · SQLite (better-sqlite3) · OpenAI
(structured outputs, adapter único) · zero JS de cliente além do essencial.

## Rodar

```bash
cd plataforma
npm install
npm run seed        # cria o workspace inicial
npm run dev
```

Agendáveis: `npm run atualizar` (mede métricas + vigia) e `npm run agentes`
(triagem do inbox, revisões vencidas, rascunhos de veredito).

## Estrutura

```
├── plataforma.md    ← especificação: cada passo do loop traduzido em feature
├── agentes.md       ← o plano da camada de IA (princípios, elenco, guardrails)
├── plataforma/      ← a plataforma ("Loop.")
└── lancamentos/     ← fichas de lançamento em markdown (semente do módulo de mensuração)
```
