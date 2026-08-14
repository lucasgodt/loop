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

## Mapa (fase 1)

| Rota | Passo do loop |
|---|---|
| `/` | A home "o que fazer agora" — streak de entrevistas, inbox, bloqueios, revisões |
| `/metricas` | 1 · Métricas de negócio |
| `/oportunidades` | 2 e 4 · Jornada + árvore de oportunidades |
| `/entrevistas` | 3 · Entrevistas semanais (story-based) |
| `/sinais` | 3 · Inbox de sinais (CS, gravações, conversas) |
| `/lancamentos` | 10 · Fichas de lançamento, revisões 30/60/90, veredito |

Fase 2 (a construir): priorização com 4 critérios e limite de WIP · bloqueio de 3+
soluções · suposições (5 lentes) · testes de suposição. Fase 3: automação (queries
agendadas, Linear, IA assistiva).
