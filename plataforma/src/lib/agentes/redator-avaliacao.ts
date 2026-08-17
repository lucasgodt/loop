import fs from "node:fs";
import path from "node:path";
import type { Agente, ContextoAgente, Proposta } from "./types";

/**
 * O Redator de Avaliação (passo 5): rascunha as notas e justificativas dos 4
 * critérios de priorização citando as evidências reais da oportunidade,
 * calibrado contra as irmãs já avaliadas. A decisão ("escolhemos X em vez de
 * Y") é campo exclusivamente humano — o agente nunca a escreve, e o rascunho
 * só vira avaliação quando o PM aceita.
 */

// A justificativa vem ANTES da nota no schema de propósito: o modelo escreve o
// porquê primeiro e só então crava o número, em vez de racionalizar uma nota.
export interface PayloadAvaliacao {
  tamanho_justif: string;
  tamanho: number | null;
  companhia_justif: string;
  companhia: number | null;
  mercado_justif: string;
  mercado: number | null;
  cliente_justif: string;
  cliente: number | null;
}

const SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: [
    "tamanho_justif",
    "tamanho",
    "companhia_justif",
    "companhia",
    "mercado_justif",
    "mercado",
    "cliente_justif",
    "cliente",
  ],
  properties: {
    tamanho_justif: { type: "string" },
    tamanho: { type: ["integer", "null"] },
    companhia_justif: { type: "string" },
    companhia: { type: ["integer", "null"] },
    mercado_justif: { type: "string" },
    mercado: { type: ["integer", "null"] },
    cliente_justif: { type: "string" },
    cliente: { type: ["integer", "null"] },
  },
};

function prompt(): string {
  return fs.readFileSync(
    path.join(process.cwd(), "src/lib/agentes/prompts/redator-avaliacao.md"),
    "utf-8"
  );
}

const nota = (n: number | null) =>
  n == null ? null : Math.min(5, Math.max(1, Math.round(n)));

export const redatorAvaliacao: Agente = {
  id: "redator_avaliacao",
  nome: "Redator de Avaliação",
  descricao:
    "Rascunha a avaliação de priorização (4 critérios) com justificativa citando evidência real e calibrada contra as irmãs — a nota final e a decisão continuam do PM.",
  passoDoLoop: 5,
  async executar(ctx: ContextoAgente): Promise<Proposta[]> {
    const { db, produtoId, alvoId, gerar } = ctx;
    if (!alvoId) throw new Error("redator_avaliacao precisa de uma oportunidade alvo");

    const oportunidade = db
      .prepare(
        `SELECT o.*, p.nome AS persona_nome, pj.titulo AS passo_titulo
         FROM oportunidade o
         LEFT JOIN persona p ON p.id = o.persona_id
         LEFT JOIN passo_jornada pj ON pj.id = o.passo_jornada_id
         WHERE o.id = ? AND o.produto_id = ?`
      )
      .get(alvoId, produtoId) as Record<string, unknown> | undefined;
    if (!oportunidade) throw new Error(`oportunidade ${alvoId} não encontrada`);

    const evidencias = db
      .prepare(
        `SELECT CASE WHEN ev.entrevista_id IS NOT NULL THEN 'entrevista' ELSE 'sinal' END AS tipo,
                COALESCE(e.entrevistado, s.canal) AS origem,
                COALESCE(e.historia || ' ' || e.notas, s.conteudo) AS conteudo,
                COALESCE(e.data, s.data) AS data
         FROM evidencia ev
         LEFT JOIN entrevista e ON e.id = ev.entrevista_id
         LEFT JOIN sinal s ON s.id = ev.sinal_id
         WHERE ev.oportunidade_id = ? ORDER BY ev.id`
      )
      .all(alvoId) as Record<string, unknown>[];
    if (evidencias.length === 0) {
      throw new Error(
        "esta oportunidade não tem evidência ligada — sem insumo, avaliação seria chute; ligue evidências primeiro"
      );
    }

    const irmas = db
      .prepare(
        `SELECT o.titulo, a.tamanho, a.tamanho_justif, a.companhia, a.companhia_justif,
                a.mercado, a.mercado_justif, a.cliente, a.cliente_justif,
                (SELECT COUNT(*) FROM evidencia ev WHERE ev.oportunidade_id = o.id) AS evidencias
         FROM avaliacao_oportunidade a JOIN oportunidade o ON o.id = a.oportunidade_id
         WHERE o.produto_id = ? AND o.id != ?`
      )
      .all(produtoId, alvoId) as Record<string, unknown>[];
    const metricas = db
      .prepare("SELECT nome, definicao, meta FROM metrica_negocio WHERE produto_id = ?")
      .all(produtoId) as Record<string, unknown>[];
    const produto = db
      .prepare("SELECT nome, descricao FROM produto WHERE id = ?")
      .get(produtoId) as { nome: string; descricao: string };

    const { saida } = await gerar({
      sistema: prompt(),
      usuario: JSON.stringify(
        {
          produto,
          oportunidade: {
            titulo: oportunidade.titulo,
            persona: oportunidade.persona_nome,
            passo_da_jornada: oportunidade.passo_titulo,
            notas: oportunidade.notas,
          },
          evidencias,
          irmas_ja_avaliadas: irmas,
          metricas_de_negocio: metricas,
        },
        null,
        2
      ),
      nomeSchema: "rascunho_avaliacao",
      schema: SCHEMA,
    });
    const bruto = saida as PayloadAvaliacao;
    const payload: PayloadAvaliacao = {
      ...bruto,
      tamanho: nota(bruto.tamanho),
      companhia: nota(bruto.companhia),
      mercado: nota(bruto.mercado),
      cliente: nota(bruto.cliente),
    };

    const notas = [payload.tamanho, payload.companhia, payload.mercado, payload.cliente];
    const soma = notas.reduce<number>((t, n) => t + (n ?? 0), 0);
    const semNota = notas.filter((n) => n == null).length;
    return [
      {
        tipo: "rascunho_avaliacao",
        alvoTabela: "oportunidade",
        alvoId,
        payload: payload as unknown as Record<string, unknown>,
        resumo: `Avaliação de "${oportunidade.titulo}": ${soma}/20${semNota ? ` (${semNota} critério(s) sem insumo)` : ""}`,
        insumos: [{ tabela: "oportunidade", registroId: alvoId }],
      },
    ];
  },
};
