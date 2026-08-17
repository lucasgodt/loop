import fs from "node:fs";
import path from "node:path";
import type { Agente, ContextoAgente, Proposta } from "./types";

/**
 * O Empacotador (passo 9): escreve o brief de desenvolvimento da solução para
 * o Linear — todo o rastro do discovery num documento que a engenharia lê sem
 * perguntar nada. Só roda com o portão de entrada satisfeito (nenhuma
 * suposição de alto risco sem teste), e a seção "o que NÃO validamos" é
 * calculada pelo sistema, não pelo modelo — vai no payload junto com o brief.
 */

export interface PayloadBrief {
  brief_md: string;
  nao_validado: string[];
}

const SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["brief_md"],
  properties: {
    brief_md: { type: "string", description: "o brief completo, em markdown" },
  },
};

function prompt(): string {
  return fs.readFileSync(
    path.join(process.cwd(), "src/lib/agentes/prompts/empacotador.md"),
    "utf-8"
  );
}

export const empacotador: Agente = {
  id: "empacotador",
  nome: "Empacotador",
  descricao:
    "Escreve o brief de desenvolvimento (contexto, evidências, story map, validado × NÃO validado, como mediremos) pronto para colar no Linear.",
  passoDoLoop: 9,
  async executar(ctx: ContextoAgente): Promise<Proposta[]> {
    const { db, produtoId, alvoId, gerar } = ctx;
    if (!alvoId) throw new Error("empacotador precisa de uma solução alvo");

    const solucao = db
      .prepare(
        `SELECT s.*, o.titulo AS oportunidade_titulo
         FROM solucao s LEFT JOIN oportunidade o ON o.id = s.oportunidade_id
         WHERE s.id = ? AND s.produto_id = ?`
      )
      .get(alvoId, produtoId) as Record<string, unknown> | undefined;
    if (!solucao) throw new Error(`solução ${alvoId} não encontrada`);

    const suposicoes = db
      .prepare(
        `SELECT su.id, su.texto, su.lente, su.importancia, su.evidencia, su.estado
         FROM suposicao su WHERE su.solucao_id = ?`
      )
      .all(alvoId) as {
      id: number;
      texto: string;
      lente: string;
      importancia: number;
      evidencia: number;
      estado: string;
    }[];

    // Portão de entrada do desenvolvimento — o mesmo aviso da página da solução.
    const arriscadasSemTeste = suposicoes.filter(
      (s) => s.estado === "mapeada" && s.importancia >= 4 && s.evidencia <= 2
    );
    if (arriscadasSemTeste.length > 0) {
      throw new Error(
        `${arriscadasSemTeste.length} suposição(ões) de alto risco sem teste — teste (ou rebaixe conscientemente) antes de empacotar para desenvolvimento`
      );
    }

    const testes = db
      .prepare(
        `SELECT t.suposicao_id, t.metodo, t.criterio, t.resultado, t.veredito
         FROM teste_suposicao t JOIN suposicao su ON su.id = t.suposicao_id
         WHERE su.solucao_id = ?`
      )
      .all(alvoId) as Record<string, unknown>[];
    const passos = db
      .prepare("SELECT ordem, titulo FROM passo_story_map WHERE solucao_id = ? ORDER BY ordem, id")
      .all(alvoId) as Record<string, unknown>[];
    const irmas = solucao.oportunidade_id
      ? (db
          .prepare(
            "SELECT titulo, descricao, estado FROM solucao WHERE oportunidade_id = ? AND id != ?"
          )
          .all(solucao.oportunidade_id, alvoId) as Record<string, unknown>[])
      : [];
    const avaliacao = solucao.oportunidade_id
      ? (db
          .prepare("SELECT * FROM avaliacao_oportunidade WHERE oportunidade_id = ?")
          .get(solucao.oportunidade_id) as Record<string, unknown> | undefined)
      : undefined;
    const evidencias = solucao.oportunidade_id
      ? (db
          .prepare(
            `SELECT CASE WHEN ev.entrevista_id IS NOT NULL THEN 'entrevista' ELSE 'sinal' END AS tipo,
                    COALESCE(e.historia || ' ' || e.notas, s.conteudo) AS conteudo
             FROM evidencia ev
             LEFT JOIN entrevista e ON e.id = ev.entrevista_id
             LEFT JOIN sinal s ON s.id = ev.sinal_id
             WHERE ev.oportunidade_id = ?`
          )
          .all(solucao.oportunidade_id) as Record<string, unknown>[])
      : [];
    const ficha = db
      .prepare(
        "SELECT hipotese, metrica_primaria, baseline, meta, guardrails, instrumentacao FROM lancamento WHERE solucao_id = ?"
      )
      .get(alvoId) as Record<string, unknown> | undefined;
    const produto = db
      .prepare("SELECT nome, descricao FROM produto WHERE id = ?")
      .get(produtoId) as { nome: string; descricao: string };

    // A lista do "o que NÃO validamos" é do sistema, não do modelo.
    const naoValidado = suposicoes
      .filter((s) => s.estado === "mapeada" || s.estado === "em_teste")
      .map((s) => `Acreditamos que ${s.texto} (${s.lente}, ${s.estado.replace("_", " ")})`);

    const { saida } = await gerar({
      sistema: prompt(),
      usuario: JSON.stringify(
        {
          produto,
          solucao: { titulo: solucao.titulo, descricao: solucao.descricao },
          oportunidade: solucao.oportunidade_titulo,
          decisao_de_priorizacao: avaliacao?.decisao ?? null,
          evidencias,
          story_map: passos,
          solucoes_irmas_descartadas: irmas,
          suposicoes,
          testes,
          nao_validado: naoValidado,
          ficha_de_lancamento: ficha ?? null,
        },
        null,
        2
      ),
      nomeSchema: "brief_desenvolvimento",
      schema: SCHEMA,
    });
    const payload: PayloadBrief = {
      brief_md: (saida as { brief_md: string }).brief_md,
      nao_validado: naoValidado,
    };

    return [
      {
        tipo: "brief_solucao",
        alvoTabela: "solucao",
        alvoId,
        payload: payload as unknown as Record<string, unknown>,
        resumo: `Brief de "${solucao.titulo}" pronto para o Linear`,
        insumos: [{ tabela: "solucao", registroId: alvoId }],
      },
    ];
  },
};
