/**
 * Seed mínimo: cria um workspace vazio e deixa o resto com o onboarding —
 * o checklist da home guia da plataforma vazia ao loop rodando (workspace,
 * personas, métrica nº 1, jornada, fontes…), cada item auto-detectado.
 *
 * Idempotente: se já existe um produto, não faz nada.
 */
import { db } from "../src/lib/db";

const existente = db.prepare("SELECT id, nome FROM produto ORDER BY id LIMIT 1").get() as
  | { id: number; nome: string }
  | undefined;

if (existente) {
  console.log("Workspace '%s' já existe (id %d) — nada a fazer.", existente.nome, existente.id);
  process.exit(0);
}

const info = db
  .prepare("INSERT INTO produto (nome, descricao) VALUES (?, ?)")
  .run("Meu produto", "");

console.log(
  "Workspace criado (id %d). Abra a home: o checklist de onboarding guia o resto.",
  Number(info.lastInsertRowid)
);
