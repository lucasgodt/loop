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

Os portões do funil são regra do sistema, não disciplina: discovery exige avaliação
completa e vaga no WIP; suposições exigem 3+ soluções na oportunidade; teste exige
critério de sucesso definido antes; solução só é "lançada" com ficha criada.

Fase 3 (a construir): automação (queries agendadas na fonte do produto, Linear,
transcrição de gravações, IA assistiva) e múltiplos produtos.
