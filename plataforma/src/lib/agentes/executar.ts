import { agora, db } from "@/lib/db";
import { gerar as gerarIA, modeloConfigurado, modeloMini } from "./cliente-ia";
import { getAgente } from "./index";
import type { GerarEstruturado } from "./types";

/**
 * Roda um agente, audita a execução e persiste as propostas como sugestões.
 * Todas as formas de disparo (botão, cron futuro) convergem aqui.
 */
export async function executarAgente(
  agenteId: string,
  produtoId: number,
  gatilho: string,
  alvoId?: number,
  params?: Record<string, unknown>
): Promise<{ execucaoId: number; sugestoes: number }> {
  const agente = getAgente(agenteId);

  const config = db
    .prepare("SELECT modo, modelo FROM agente_config WHERE produto_id = ? AND agente_id = ?")
    .get(produtoId, agenteId) as { modo: string; modelo: string } | undefined;
  if (config?.modo === "desligado") {
    throw new Error(`o agente ${agente.nome} está desligado`);
  }

  // Modelo por agente: override em config > classe do agente > padrão global.
  const modeloResolvido =
    config?.modelo || (agente.classeModelo === "mini" ? modeloMini() : modeloConfigurado());

  const execucao = db
    .prepare(
      `INSERT INTO execucao_agente (produto_id, agente_id, gatilho, iniciada_em)
       VALUES (?, ?, ?, ?)`
    )
    .run(produtoId, agenteId, gatilho, agora());
  const execucaoId = Number(execucao.lastInsertRowid);

  // Acumula tokens/modelo de todas as chamadas de IA da rodada.
  let tokensEntrada = 0;
  let tokensSaida = 0;
  let modeloUsado = "";
  const gerar: GerarEstruturado = async (args) => {
    const r = await gerarIA({ ...args, modelo: args.modelo ?? modeloResolvido });
    tokensEntrada += r.tokensEntrada;
    tokensSaida += r.tokensSaida;
    modeloUsado = r.modelo;
    return r;
  };

  try {
    const propostas = await agente.executar({ db, produtoId, alvoId, params, gerar });

    const inserir = db.prepare(
      `INSERT INTO sugestao (execucao_id, produto_id, tipo, alvo_tabela, alvo_id, payload, resumo, insumos, criada_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const p of propostas) {
      inserir.run(
        execucaoId,
        produtoId,
        p.tipo,
        p.alvoTabela,
        p.alvoId,
        JSON.stringify(p.payload),
        p.resumo,
        JSON.stringify(p.insumos),
        agora()
      );
    }

    db.prepare(
      `UPDATE execucao_agente SET status = 'ok', modelo = ?, tokens_entrada = ?, tokens_saida = ?, concluida_em = ? WHERE id = ?`
    ).run(modeloUsado, tokensEntrada, tokensSaida, agora(), execucaoId);

    return { execucaoId, sugestoes: propostas.length };
  } catch (e) {
    db.prepare(
      `UPDATE execucao_agente SET status = 'erro', erro = ?, modelo = ?, tokens_entrada = ?, tokens_saida = ?, concluida_em = ? WHERE id = ?`
    ).run(
      e instanceof Error ? e.message : String(e),
      modeloUsado,
      tokensEntrada,
      tokensSaida,
      agora(),
      execucaoId
    );
    throw e;
  }
}
