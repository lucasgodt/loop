# Loop.

**Minha plataforma pessoal de gestão de produto — o método de continuous
discovery transformado em software que eu uso todos os dias.**

Construí o Loop. a partir de uma convicção sobre como produto deve ser feito:
**nenhum lançamento sai sem métrica de sucesso definida antes, e nenhuma
aposta grande é feita sem evidência**. A indústria inteira conhece o padrão
contrário — a feature sai, a medição "fica pra depois", o aprendizado nunca
acontece. A minha resposta foi codificar o processo: aqui, as boas práticas
não dependem de disciplina; são regra do sistema.

A plataforma implementa o ciclo de continuous discovery (na linha de Teresa
Torres) de ponta a ponta. Cada produto que gerencio é um workspace — nada do
domínio de um produto específico vive no código.

## O loop, com portões que o sistema não deixa furar

```
1 Métrica de negócio (lagging) → 2 Jornada → 3 Entrevistas + sinais
→ 4 Árvore de oportunidades → 5 Priorização → 6 Ideação (3+)
→ 7 Suposições (5 lentes) → 8 Testes → 9 Desenvolvimento
→ 10 Mensuração de impacto → volta ao 1
```

- **Oportunidade nasce com evidência** — sem evidência, o sistema a trata como palpite.
- **Discovery exige avaliação comparativa** nos 4 critérios e vaga no WIP (máx. 2).
- **Suposições só abrem com 3+ soluções na mesa** — a primeira ideia raramente é a melhor.
- **Teste só existe com critério numérico falseável definido antes** — depois do
  resultado, qualquer número parece o combinado.
- **Risco importante exige resposta** (teste validado ou mitigação de desenho)
  antes do desenho consolidado e do desenvolvimento.
- **Nenhuma solução é "lançada" sem ficha de medição**: hipótese, métrica primária
  (leading → aponta para a lagging), baseline, meta e guardrails — antes de lançar.
- **Todo lançamento termina em veredito + aprendizado**, com revisões de 30/60/90 dias.

## IA com guardrails — a decisão é sempre humana

O Loop. usa IA em três naturezas, todas sob o mesmo princípio: **a IA propõe;
aceitar é um ato humano** — e o aceite aplica pelas mesmas regras do fluxo
manual, então nenhum agente fura um portão do método.

1. **Agentes** — propostas estruturadas e rastreáveis em cada passo: triagem de
   feedback bruto em sinais (com citação literal verificada mecanicamente),
   rascunho de avaliação de priorização, comparação de soluções por jornada de
   valor × risco por passo, mapa de suposições + desenho de teste, consolidação
   do desenho da solução (que se recusa a rodar enquanto houver risco importante
   sem resposta), brief de desenvolvimento que carrega explicitamente **o que
   não foi validado**, e ficha de medição com consulta testada em dry-run.
2. **Conselheiros** — chats por passo do loop que pensam junto (métrica, jornada,
   ideação), com o contexto do workspace injetado; quando a conversa converge,
   preenchem o formulário como proposta.
3. **Executor** — com um repositório plugado, botões "via PR" implementam
   instrumentação ou features num worktree isolado e abrem um Pull Request;
   mergear é decisão humana.

Sem chave de IA, tudo funciona manualmente — a plataforma degrada com elegância.

## Decisões de design de que me orgulho

- **Portões como código, não como checklist**: o funil bloqueia atalhos por
  construção — é o processo defendendo a si mesmo.
- **Sugestão rastreável**: toda proposta de IA vira um registro auditável
  (aceita/rejeitada/motivo), com custo por execução medido.
- **Anti-alucinação estrutural**: sinal sem trecho-fonte literal não grava;
  SQL proposto roda em dry-run visível antes de qualquer aceite; avaliação sem
  insumo diz "sem insumo" em vez de inventar nota.
- **Medição plugável**: fontes de dados são provedores de 1 arquivo (PostHog
  como padrão); métricas e revisões se medem sozinhas por runner agendado.

## Rodar

```bash
cd plataforma
npm install
npm run seed        # cria o workspace inicial
npm run dev
```

Stack: Next.js (App Router) · SQLite · OpenAI (structured outputs, adapter único).

## Estrutura

```
├── plataforma.md    ← especificação: cada passo do loop traduzido em feature
├── agentes.md       ← o plano da camada de IA (princípios, elenco, guardrails)
└── plataforma/      ← a plataforma ("Loop.")
```
