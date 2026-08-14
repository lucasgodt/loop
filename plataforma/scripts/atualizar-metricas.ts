/**
 * Atualiza todas as métricas com fonte plugada e imprime o digest de pendências.
 *
 * Desacoplado do app de propósito: qualquer agendador roda isto —
 *   npm run atualizar          (na mão)
 *   cron / launchd             (agendado)
 * O app continua funcionando 100% manual sem este script.
 */
import { db, hojeLocal } from "../src/lib/db";
import { medir } from "../src/lib/fontes";

interface MetricaLinha {
  id: number;
  nome: string;
  consulta: string;
  fonte_id: number;
  fonte_nome: string;
  fonte_tipo: string;
  fonte_config: string;
}

async function main(): Promise<number> {
  const metricas = db
    .prepare(
      `SELECT m.id, m.nome, m.consulta,
              f.id AS fonte_id, f.nome AS fonte_nome, f.tipo AS fonte_tipo, f.config AS fonte_config
       FROM metrica_negocio m JOIN fonte_dados f ON f.id = m.fonte_dados_id
       WHERE m.consulta != ''`
    )
    .all() as MetricaLinha[];

  if (metricas.length === 0) {
    console.log("Nenhuma métrica com fonte plugada — nada a atualizar.");
  }

  let falhas = 0;
  for (const m of metricas) {
    try {
      const { valor, detalhe } = await medir(
        { tipo: m.fonte_tipo, config: m.fonte_config },
        m.consulta
      );
      const data = hojeLocal();
      db.prepare("INSERT INTO metrica_valor (metrica_id, valor, data) VALUES (?, ?, ?)").run(
        m.id,
        valor,
        data
      );
      db.prepare(
        "UPDATE metrica_negocio SET valor_atual = ?, atualizado_em = ? WHERE id = ?"
      ).run(valor, data, m.id);
      console.log(`✓ ${m.nome}: ${valor}  (${detalhe})`);
    } catch (e) {
      falhas++;
      console.error(`✗ ${m.nome}: ${e instanceof Error ? e.message : e}`);
    }
  }

  // Digest de pendências — o "o que fazer agora" na versão terminal.
  const atrasadas = db
    .prepare(
      `SELECT l.nome, r.rotulo, r.data_prevista FROM revisao r
       JOIN lancamento l ON l.id = r.lancamento_id
       WHERE r.data_realizada IS NULL AND r.data_prevista < ?
       ORDER BY r.data_prevista`
    )
    .all(hojeLocal()) as { nome: string; rotulo: string; data_prevista: string }[];

  if (atrasadas.length > 0) {
    console.log("\nRevisões de lançamento atrasadas:");
    for (const r of atrasadas) {
      console.log(`  ! ${r.nome} — ${r.rotulo} (prevista ${r.data_prevista})`);
    }
  }

  return falhas > 0 ? 1 : 0;
}

main().then((codigo) => process.exit(codigo));
