/**
 * Runner desacoplado dos agentes — gêmeo do atualizar-metricas.ts.
 *
 *   npm run agentes          (na mão)
 *   cron / launchd           (agendado — ex.: 0 8 * * * → triagem pronta de manhã)
 *
 * Varredura por estado, sem outbox: o próprio banco é a fila.
 *   1. Sinais parados no inbox → Triador (modo inbox) propõe destinos.
 *   2. Revisões vencidas de lançamentos com fonte plugada → medição automática.
 *   3. Digest: sugestões aguardando aprovação, erros, pendências.
 */
import { carregarEnvLocal } from "../src/lib/env";
carregarEnvLocal();

import { agora, db, hojeLocal } from "../src/lib/db";
import { executarAgente } from "../src/lib/agentes/executar";
import { temChaveDeIA } from "../src/lib/agentes/cliente-ia";
import { medir } from "../src/lib/fontes";

async function main(): Promise<number> {
  const produto = db.prepare("SELECT id, nome FROM produto ORDER BY id LIMIT 1").get() as
    | { id: number; nome: string }
    | undefined;
  if (!produto) {
    console.log("Nenhum workspace — rode npm run seed.");
    return 1;
  }
  let falhas = 0;

  // 1. Triagem do inbox (precisa de chave de IA).
  const pendentes = (
    db
      .prepare("SELECT COUNT(*) AS n FROM sinal WHERE produto_id = ? AND status = 'novo'")
      .get(produto.id) as { n: number }
  ).n;
  if (pendentes === 0) {
    console.log("Inbox de sinais limpo — nada a triar.");
  } else if (!temChaveDeIA()) {
    console.log(`${pendentes} sinal(is) no inbox, mas OPENAI_API_KEY não está configurada — triagem pulada.`);
  } else {
    try {
      const r = await executarAgente("triador", produto.id, "cron");
      console.log(`✓ Triador (inbox): ${r.sugestoes} sugestão(ões) para ${pendentes} sinal(is) pendente(s).`);
    } catch (e) {
      falhas++;
      console.error(`✗ Triador: ${e instanceof Error ? e.message : e}`);
    }
  }

  // 2. Medição automática de revisões vencidas (mecânico — sem IA).
  const vencidas = db
    .prepare(
      `SELECT r.id, r.rotulo, l.nome, l.consulta, l.fonte_dados_id
       FROM revisao r JOIN lancamento l ON l.id = r.lancamento_id
       WHERE l.produto_id = ? AND r.data_realizada IS NULL AND r.data_prevista < ?
         AND l.fonte_dados_id IS NOT NULL AND l.consulta != ''`
    )
    .all(produto.id, hojeLocal()) as {
    id: number;
    rotulo: string;
    nome: string;
    consulta: string;
    fonte_dados_id: number;
  }[];
  for (const r of vencidas) {
    const fonte = db
      .prepare("SELECT tipo, config FROM fonte_dados WHERE id = ?")
      .get(r.fonte_dados_id) as { tipo: string; config: string } | undefined;
    if (!fonte) continue;
    try {
      const m = await medir(fonte, r.consulta);
      db.prepare(
        "UPDATE revisao SET valor_observado = ?, data_realizada = ?, notas = ? WHERE id = ?"
      ).run(String(m.valor), hojeLocal(), m.detalhe, r.id);
      console.log(`✓ Revisão ${r.rotulo} de "${r.nome}" medida: ${m.valor}`);
    } catch (e) {
      falhas++;
      console.error(`✗ Revisão ${r.rotulo} de "${r.nome}": ${e instanceof Error ? e.message : e}`);
    }
  }
  if (vencidas.length === 0) console.log("Nenhuma revisão vencida com fonte plugada.");

  // 3. Lançamentos com todas as revisões medidas e sem veredito → o Fechador
  //    rascunha o veredito (SEMPRE como sugestão — gravá-lo é ato humano).
  const semVeredito = db
    .prepare(
      `SELECT l.id, l.nome FROM lancamento l WHERE l.produto_id = ? AND l.veredito IS NULL
         AND EXISTS (SELECT 1 FROM revisao r WHERE r.lancamento_id = l.id)
         AND NOT EXISTS (SELECT 1 FROM revisao r WHERE r.lancamento_id = l.id AND r.data_realizada IS NULL)`
    )
    .all(produto.id) as { id: number; nome: string }[];
  for (const l of semVeredito) {
    if (!temChaveDeIA()) {
      console.log(`! "${l.nome}" pronto para veredito, mas sem OPENAI_API_KEY — rascunho pulado.`);
      continue;
    }
    const jaPendente = db
      .prepare(
        `SELECT 1 FROM sugestao WHERE alvo_tabela = 'lancamento' AND alvo_id = ?
           AND tipo = 'rascunhar_veredito' AND estado = 'sugerida'`
      )
      .get(l.id);
    if (jaPendente) continue;
    try {
      await executarAgente("fechador_de_loop", produto.id, "cron", l.id);
      console.log(`✓ Veredito de "${l.nome}" rascunhado — aguardando sua aprovação na ficha.`);
    } catch (e) {
      falhas++;
      console.error(`✗ Veredito de "${l.nome}": ${e instanceof Error ? e.message : e}`);
    }
  }

  // 4. Digest.
  const sugestoes = db
    .prepare("SELECT resumo FROM sugestao WHERE produto_id = ? AND estado = 'sugerida' ORDER BY criada_em DESC")
    .all(produto.id) as { resumo: string }[];
  if (sugestoes.length > 0) {
    console.log(`\n🤖 ${sugestoes.length} sugestão(ões) aguardando aprovação:`);
    for (const s of sugestoes) console.log(`  · ${s.resumo}`);
  }

  console.log(`\nConcluído em ${agora()}.`);
  return falhas > 0 ? 1 : 0;
}

main().then((codigo) => process.exit(codigo));
