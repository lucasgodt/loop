# Loop.

Plataforma pessoal de gestão de produto — implementa o loop de produto (Continuous
Discovery) da métrica de negócio à mensuração de impacto. A especificação completa
está em [`../plataforma.md`](../plataforma.md).

O workspace atual é a **Mooney**; nada dela é hardcoded — personas, fontes de métricas
e canais de sinal são configuração do produto.

## Rodar

```bash
npm install
npm run seed   # cria o workspace Mooney (idempotente)
npm run dev    # http://localhost:3000 (ou próxima porta livre)
```

## Stack

- Next.js (App Router) + React + Tailwind 4
- SQLite via better-sqlite3 — banco local em `data/plataforma.db` (fora do git)
- Sem autenticação: ferramenta pessoal, roda local

## Mapa (fases 1 e 2)

| Rota | Passo do loop |
|---|---|
| `/` | A home "o que fazer agora" — régua do loop, streak, inbox, bloqueios, revisões |
| `/metricas` | 1 · Métricas de negócio (lagging) + leading apontando para elas |
| `/oportunidades` | 2 e 4 · Jornada + árvore de oportunidades |
| `/oportunidades/[id]` | 5 e 6 · Avaliação (4 critérios), evidências, ideação |
| `/entrevistas` | 3 · Entrevistas semanais (story-based) |
| `/sinais` | 3 · Inbox de sinais (CS, gravações, conversas) |
| `/priorizacao` | 5 · Comparação lado a lado + limite de WIP (2 em discovery) |
| `/solucoes/[id]` | 7 e 8 · Story map, suposições (5 lentes) e testes |
| `/lancamentos` | 9 e 10 · Fichas de lançamento, revisões 30/60/90, veredito |

| `/fontes` | infra · Fontes de dados plugáveis (medição automática) |

Os portões do funil são regra do sistema, não disciplina: discovery exige avaliação
completa e vaga no WIP; suposições exigem 3+ soluções na oportunidade; teste exige
critério de sucesso definido antes; solução só é "lançada" com ficha criada.

## Fontes de dados plugáveis (fase 3)

A medição automática é desacoplada por contrato: cada tipo de fonte é um `Provedor`
em `src/lib/fontes/` com `executar(config, consulta) → valor`. Plugar um tipo novo
(BigQuery nativo, Mixpanel, Sheets…) = criar um arquivo e adicioná-lo ao registro em
`src/lib/fontes/index.ts`. Nada mais muda.

- **comando** — roda qualquer comando no shell e lê o número da última linha. É como
  o BigQuery pluga hoje: `bq query --format=csv '…' | tail -1`.
- **http** — GET numa URL JSON, extração por caminho de pontos.

Métricas e lançamentos guardam só *qual fonte* + *qual consulta*, e ganham o botão
"Medir agora". Agendamento também desacoplado:

```bash
npm run atualizar   # mede todas as métricas com fonte e imprime pendências
# agendar: crontab -e →  0 7 * * 1  cd <pasta> && npm run atualizar
```

A construir: Linear, transcrição de gravações, IA assistiva, múltiplos produtos.
