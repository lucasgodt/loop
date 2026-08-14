/**
 * Seed do workspace Mooney: personas, métricas candidatas e os 3 lançamentos
 * retroativos (a dívida de medição que a plataforma nasce cobrando).
 *
 * Rodar: npm run seed  (idempotente — não duplica se o produto já existe)
 */
import { agora, db } from "../src/lib/db";

const existente = db.prepare("SELECT id FROM produto WHERE nome = 'Mooney'").get() as
  | { id: number }
  | undefined;

if (existente) {
  console.log("Workspace Mooney já existe (id %d) — nada a fazer.", existente.id);
  process.exit(0);
}

const seed = db.transaction(() => {
  const produto = db
    .prepare("INSERT INTO produto (nome, descricao) VALUES (?, ?)")
    .run("Mooney", "Educação financeira para escolas — app do aluno, material do professor, CS para escolas");
  const produtoId = Number(produto.lastInsertRowid);

  for (const nome of ["Aluno", "Professor", "Escola"]) {
    db.prepare("INSERT INTO persona (produto_id, nome) VALUES (?, ?)").run(produtoId, nome);
  }

  const metricas = [
    {
      nome: "Alunos ativos semanais (WAU)",
      definicao: "Alunos matriculados que abriram o app na semana",
      fonte: "BigQuery mooney-db39f — query a definir",
      unidade: "alunos",
    },
    {
      nome: "Professores ativos no mês",
      definicao: "Professores que usaram a plataforma (aula ou IA) no mês",
      fonte: "BigQuery mooney-db39f — query a definir",
      unidade: "professores",
    },
  ];
  for (const m of metricas) {
    db.prepare(
      "INSERT INTO metrica_negocio (produto_id, nome, definicao, fonte, unidade) VALUES (?, ?, ?, ?, ?)"
    ).run(produtoId, m.nome, m.definicao, m.fonte, m.unidade);
  }

  const lancamentos = [
    {
      nome: "OLITEF — Olimpíada de Educação Financeira",
      fonte_dados:
        "Base já existe: scripts de adesão/mobilização de escolas (PythonScripts, commit 74aa96f8) e espelho de prática (backfill_olitef_practice_mirror.py). Formalizar query no BigQuery.",
      notas:
        "Métricas candidatas: % de escolas ativas que aderiram; % dos alunos das escolas aderentes com 1+ simulado; efeito no engajamento geral durante a olimpíada.",
    },
    {
      nome: "Rework completo do app",
      fonte_dados:
        "BigQuery mooney-db39f — comparação antes/depois. Cuidado com sazonalidade escolar: comparar semanas letivas equivalentes, não calendário cru.",
      notas:
        "Falta a data exata do lançamento (define o corte antes/depois). Candidatas: WAU, retenção semana N→N+1, lições completadas por aluno ativo.",
    },
    {
      nome: "IA do professor",
      fonte_dados:
        "PENDENTE: verificar se o uso é logado (evento BigQuery? backend? Firestore?). Sem log não existe medição — instrumentar é o passo 1.",
      notas:
        "Candidatas: % de professores ativos que usaram a IA 1+ vez no mês; uso recorrente (2+ semanas distintas); interações por professor ativo.",
    },
  ];
  for (const l of lancamentos) {
    db.prepare(
      `INSERT INTO lancamento (produto_id, nome, fonte_dados, notas, criada_em) VALUES (?, ?, ?, ?, ?)`
    ).run(produtoId, l.nome, l.fonte_dados, l.notas, agora());
  }

  return produtoId;
});

const id = seed();
console.log("Workspace Mooney criado (id %d): 3 personas, 2 métricas candidatas, 3 lançamentos retroativos.", id);
