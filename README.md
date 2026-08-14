# Plataforma de Produto (conteúdo atual: Mooney)

## O problema de origem

Na Mooney lançamos coisas mas não medimos o sucesso delas:

- Lançamos a **OLITEF** e não estamos medindo se funcionou.
- Fizemos o **rework completo do app** e não sabemos a diferença de engajamento de
  antes para hoje.
- Lançamos a **IA do professor** e não sabemos nem se está sendo usada.

Sem métrica de sucesso definida **antes** do lançamento, não existe aprendizado de
longo prazo — só sensação. E sem um processo padrão de produto, cada feature nasce de
um jeito diferente e a medição nunca entra por design.

## A solução: uma plataforma que guia o loop de produto

Tudo se resume em **uma plataforma que guia o trabalho de gestão de produto** — do
Lucas, como PM, não uma ferramenta interna da Mooney (a Mooney é o primeiro produto
gerenciado nela). A plataforma implementa o loop de produto mapeado no Miro
("Loops de produto", baseado em Continuous Discovery / Teresa Torres):

**Métrica de negócio → Jornada → Entrevistas + sinais → Árvore de oportunidades →
Priorização → Ideação (3+) → Suposições → Testes → Desenvolvimento → Mensuração de
impacto → (volta à métrica)**

- Os 3 lançamentos da Mooney entram como registros retroativos dentro da plataforma.
- O painel de métricas de sucesso é uma feature dela.
- Nenhuma feature sai sem métrica definida: vira regra do sistema, não disciplina.

**➡️ O documento principal é [`plataforma.md`](plataforma.md)** — a tradução de cada
passo do loop em feature, o modelo de objetos, o posicionamento dos 3 projetos e a
ordem de construção.

## Estrutura

```
gestao_produto/
├── README.md                 ← este arquivo
├── plataforma.md             ← ★ a especificação: loop → plataforma
├── plataforma/               ← ★ a plataforma em si ("Loop.") — Next.js + SQLite
├── lancamentos/              ← fichas de lançamento (semente do módulo de mensuração)
│   ├── TEMPLATE.md
│   ├── olitef.md             ← retroativo (rascunho)
│   ├── rework-app.md         ← retroativo (rascunho)
│   └── ia-professor.md       ← retroativo (rascunho)
└── processo/
    └── README.md             ← aponta para plataforma.md
```

Para rodar a plataforma: `cd plataforma && npm install && npm run seed && npm run dev`.

Referência do loop: `~/Downloads/Loops de produto.png` (export do board do Miro).
