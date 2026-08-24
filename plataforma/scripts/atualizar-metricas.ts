/**
 * Atualiza todas as métricas com fonte plugada e imprime o digest de pendências.
 *
 * Desacoplado do app de propósito: qualquer agendador roda isto —
 *   npm run atualizar          (na mão)
 *   cron / launchd             (agendado)
 * O app continua funcionando 100% manual sem este script.
 */
import { carregarEnvLocal } from "../src/lib/env";
carregarEnvLocal();

import { agora, db, hojeLocal } from "../src/lib/db";
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

/**
 * O Vigia (regra, não agente): métrica que se mexeu vira sinal no inbox —
 * a seta de retorno do loop (passo 10 → 1 → 3). Regra estatística simples:
 * o valor novo varia ≥ 20% contra a média das 3 medições anteriores.
 * Proibido atribuir causa: o sinal descreve o movimento; quem hipotetiza é o PM.
 */
const LIMIAR_VIGIA = 0.2;

function vigiar(metricaId: number, nome: string): void {
  const serie = db
    .prepare("SELECT valor, data FROM metrica_valor WHERE metrica_id = ? ORDER BY data DESC, id DESC LIMIT 4")
    .all(metricaId) as { valor: number; data: string }[];
  if (serie.length < 3) return; // sem histórico suficiente
  const [atual, ...anteriores] = serie;
  const media = anteriores.reduce((s, v) => s + v.valor, 0) / anteriores.length;
  if (media === 0) return;
  const variacao = (atual.valor - media) / Math.abs(media);
  if (Math.abs(variacao) < LIMIAR_VIGIA) return;

  const metricaRow = db
    .prepare("SELECT produto_id FROM metrica_negocio WHERE id = ?")
    .get(metricaId) as { produto_id: number };
  // Dedupe: um alerta por métrica por semana.
  const recente = db
    .prepare(
      "SELECT id FROM sinal WHERE produto_id = ? AND canal = 'métricas' AND conteudo LIKE ? AND criada_em > datetime('now', '-7 days')"
    )
    .get(metricaRow.produto_id, `Métrica "${nome}"%`);
  if (recente) return;

  const direcao = variacao > 0 ? "subiu" : "caiu";
  const pct = Math.round(Math.abs(variacao) * 100);
  const conteudo = `Métrica "${nome}" ${direcao} ${pct}%: ${atual.valor} em ${atual.data} vs média ${Number(media.toFixed(2))} das ${anteriores.length} medições anteriores`;
  db.prepare(
    "INSERT INTO sinal (produto_id, canal, conteudo, data, status, criada_em) VALUES (?, 'métricas', ?, ?, 'novo', ?)"
  ).run(metricaRow.produto_id, conteudo, hojeLocal(), agora());
  console.log(`  👁 Vigia: ${conteudo} → sinal no inbox`);
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
      vigiar(m.id, m.nome);
    } catch (e) {
      falhas++;
      console.error(`✗ ${m.nome}: ${e instanceof Error ? e.message : e}`);
    }
  }

  // Série de acompanhamento dos lançamentos em medição: a métrica primária de
  // cada lançamento sem veredito, com fonte plugada, ganha o valor do dia.
  const emMedicao = db
    .prepare(
      `SELECT l.id, l.nome, l.consulta, l.fonte_dados_id FROM lancamento l
       WHERE l.veredito IS NULL AND l.fonte_dados_id IS NOT NULL AND l.consulta != ''`
    )
    .all() as { id: number; nome: string; consulta: string; fonte_dados_id: number }[];
  for (const l of emMedicao) {
    const fonte = db
      .prepare("SELECT tipo, config FROM fonte_dados WHERE id = ?")
      .get(l.fonte_dados_id) as { tipo: string; config: string } | undefined;
    if (!fonte) continue;
    try {
      const m = await medir(fonte, l.consulta);
      db.prepare(
        "INSERT INTO lancamento_valor (lancamento_id, valor, data) VALUES (?, ?, ?) ON CONFLICT(lancamento_id, data) DO UPDATE SET valor = excluded.valor"
      ).run(l.id, m.valor, hojeLocal());
      console.log(`✓ Lançamento "${l.nome}": ${m.valor} (série de acompanhamento)`);
    } catch (e) {
      falhas++;
      console.error(`✗ Lançamento "${l.nome}": ${e instanceof Error ? e.message : e}`);
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
