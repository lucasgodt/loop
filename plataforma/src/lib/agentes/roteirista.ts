import fs from "node:fs";
import path from "node:path";
import type { Agente, ContextoAgente, Proposta } from "./types";

interface SaidaRoteiro {
  titulo: string;
  roteiro: string;
  o_que_aprender: string;
}

const SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["titulo", "roteiro", "o_que_aprender"],
  properties: {
    titulo: { type: "string" },
    roteiro: { type: "string" },
    o_que_aprender: { type: "string" },
  },
};

export const roteirista: Agente = {
  id: "roteirista",
  nome: "Roteirista",
  descricao:
    "Prepara o roteiro story-based de uma entrevista ao vivo: pergunta âncora derivada da oportunidade investigada (ou da jornada da persona), follow-ups de cena e linha do tempo, e o que queremos aprender.",
  passoDoLoop: 3,
  async executar(ctx: ContextoAgente): Promise<Proposta[]> {
    const { db, produtoId, params, gerar } = ctx;
    const personaId = Number(params?.persona_id) || null;
    const oportunidadeId = Number(params?.oportunidade_id) || null;

    const produto = db
      .prepare("SELECT nome, descricao FROM produto WHERE id = ?")
      .get(produtoId) as { nome: string; descricao: string };
    const persona = personaId
      ? (db.prepare("SELECT id, nome FROM persona WHERE id = ?").get(personaId) as
          | { id: number; nome: string }
          | undefined)
      : undefined;
    const jornada = db
      .prepare(
        "SELECT ordem, titulo, descricao FROM passo_jornada WHERE produto_id = ? AND persona_id IS ? ORDER BY ordem"
      )
      .all(produtoId, personaId) as Record<string, unknown>[];

    let oportunidade: Record<string, unknown> | null = null;
    let evidencias: Record<string, unknown>[] = [];
    if (oportunidadeId) {
      oportunidade =
        (db
          .prepare(
            `SELECT o.titulo, o.notas, pj.titulo AS passo FROM oportunidade o
             LEFT JOIN passo_jornada pj ON pj.id = o.passo_jornada_id WHERE o.id = ?`
          )
          .get(oportunidadeId) as Record<string, unknown>) ?? null;
      evidencias = db
        .prepare(
          `SELECT COALESCE(s.conteudo, e.historia) AS texto FROM evidencia ev
           LEFT JOIN sinal s ON s.id = ev.sinal_id
           LEFT JOIN entrevista e ON e.id = ev.entrevista_id
           WHERE ev.oportunidade_id = ? LIMIT 10`
        )
        .all(oportunidadeId) as Record<string, unknown>[];
    }

    const prompt = fs.readFileSync(
      path.join(process.cwd(), "src/lib/agentes/prompts/roteirista.md"),
      "utf-8"
    );
    const { saida } = await gerar({
      sistema: prompt,
      usuario: JSON.stringify(
        {
          produto,
          persona: persona ?? "não especificada — roteiro generativo",
          jornada_da_persona: jornada,
          oportunidade_investigada: oportunidade,
          evidencias_ja_ouvidas: evidencias.map((e) => e.texto),
        },
        null,
        2
      ),
      nomeSchema: "roteiro_de_entrevista",
      schema: SCHEMA,
    });
    const r = saida as SaidaRoteiro;

    return [
      {
        tipo: "roteiro_entrevista",
        alvoTabela: "entrevista",
        alvoId: null,
        payload: {
          titulo: r.titulo,
          roteiro: r.roteiro,
          o_que_aprender: r.o_que_aprender,
          persona_nome: persona?.nome ?? null,
          oportunidade_titulo: (oportunidade?.titulo as string) ?? null,
        },
        resumo: `Roteiro: ${r.titulo}`,
        insumos: oportunidadeId ? [{ tabela: "oportunidade", registroId: oportunidadeId }] : [],
      },
    ];
  },
};
