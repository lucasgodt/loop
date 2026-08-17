import fs from "node:fs";
import path from "node:path";
import type { Agente, ContextoAgente, Proposta } from "./types";

/**
 * O Provocador de Ideias (passo 6): destrava a regra das 3+ soluções quando o
 * PM travou na primeira ideia. Só roda com pelo menos 1 solução já cadastrada
 * (o agente destrava a ideação, não a substitui) e cada candidata vira uma
 * sugestão separada — aprovar uma a uma é a decisão do PM, e candidata não
 * conta para o portão 3/3 enquanto não for aprovada.
 */

interface Candidata {
  titulo: string;
  descricao: string;
  racional: string;
}

const SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["candidatas"],
  properties: {
    candidatas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["titulo", "descricao", "racional"],
        properties: {
          titulo: { type: "string" },
          descricao: { type: "string", description: "2–3 frases, mecanismo concreto" },
          racional: { type: "string", description: "por que atacaria a dor — cita evidência real" },
        },
      },
    },
  },
};

function prompt(): string {
  return fs.readFileSync(
    path.join(process.cwd(), "src/lib/agentes/prompts/provocador.md"),
    "utf-8"
  );
}

export const provocador: Agente = {
  id: "provocador",
  nome: "Provocador de Ideias",
  descricao:
    "Gera até 3 soluções candidatas genuinamente diferentes das suas, ancoradas nas evidências — cada uma aprovada (ou não) individualmente.",
  passoDoLoop: 6,
  async executar(ctx: ContextoAgente): Promise<Proposta[]> {
    const { db, produtoId, alvoId, gerar } = ctx;
    if (!alvoId) throw new Error("provocador precisa de uma oportunidade alvo");

    const oportunidade = db
      .prepare("SELECT * FROM oportunidade WHERE id = ? AND produto_id = ?")
      .get(alvoId, produtoId) as Record<string, unknown> | undefined;
    if (!oportunidade) throw new Error(`oportunidade ${alvoId} não encontrada`);

    const existentes = db
      .prepare("SELECT titulo, descricao, estado FROM solucao WHERE oportunidade_id = ?")
      .all(alvoId) as Record<string, unknown>[];
    if (existentes.length === 0) {
      throw new Error(
        "cadastre sua primeira ideia antes — o Provocador destrava a 3ª solução, não substitui a sua ideação"
      );
    }

    const evidencias = db
      .prepare(
        `SELECT CASE WHEN ev.entrevista_id IS NOT NULL THEN 'entrevista' ELSE 'sinal' END AS tipo,
                COALESCE(e.historia || ' ' || e.notas, s.conteudo) AS conteudo
         FROM evidencia ev
         LEFT JOIN entrevista e ON e.id = ev.entrevista_id
         LEFT JOIN sinal s ON s.id = ev.sinal_id
         WHERE ev.oportunidade_id = ?`
      )
      .all(alvoId) as Record<string, unknown>[];
    if (evidencias.length === 0) {
      throw new Error("sem evidência ligada não há de onde tirar ideia — ligue evidências primeiro");
    }
    const produto = db
      .prepare("SELECT nome, descricao FROM produto WHERE id = ?")
      .get(produtoId) as { nome: string; descricao: string };

    const { saida } = await gerar({
      sistema: prompt(),
      usuario: JSON.stringify(
        {
          produto,
          oportunidade: { titulo: oportunidade.titulo, notas: oportunidade.notas },
          solucoes_existentes: existentes,
          evidencias,
        },
        null,
        2
      ),
      nomeSchema: "candidatas_de_solucao",
      schema: SCHEMA,
    });

    return (saida as { candidatas: Candidata[] }).candidatas
      .filter((c) => c.titulo.trim() && c.descricao.trim())
      .slice(0, 3)
      .map((c) => ({
        tipo: "criar_solucao",
        alvoTabela: "oportunidade",
        alvoId,
        payload: c as unknown as Record<string, unknown>,
        resumo: `Ideia para "${oportunidade.titulo}": ${c.titulo}`,
        insumos: [{ tabela: "oportunidade", registroId: alvoId }],
      }));
  },
};
