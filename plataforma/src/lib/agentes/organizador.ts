import fs from "node:fs";
import path from "node:path";
import type { Agente, ContextoAgente, Proposta } from "./types";

/**
 * O Organizador da Árvore (passo 4 do loop): botão em cada passo da jornada —
 * repensa a organização das oportunidades penduradas ali. Propõe mães novas
 * (agrupando sub-dores), aninhamentos sob existentes e ancoragem de órfãs da
 * persona. Tudo vira UMA sugestão com as operações listadas; aceitar aplica
 * em transação e o PM ajusta o que discordar na própria árvore.
 */

interface OpLida {
  id: number;
  titulo: string;
  estado: string;
  pai_id: number | null;
  evidencias: number;
}

export interface PayloadOrganizacao {
  passo_id: number;
  passo_titulo: string;
  persona_id: number | null;
  maes_novas: { titulo: string; filhas_ids: number[]; racional: string }[];
  aninhamentos: { filha_id: number; mae_id: number; racional: string }[];
  ancoragens: { oportunidade_id: number; titulo?: string; racional: string }[];
  resumo: string;
}

const SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["maes_novas", "aninhamentos", "ancoragens", "resumo"],
  properties: {
    maes_novas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["titulo", "filhas_ids", "racional"],
        properties: {
          titulo: { type: "string", description: "a dor-raiz, na voz do cliente" },
          filhas_ids: { type: "array", items: { type: "integer" } },
          racional: { type: "string" },
        },
      },
    },
    aninhamentos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["filha_id", "mae_id", "racional"],
        properties: {
          filha_id: { type: "integer" },
          mae_id: { type: "integer" },
          racional: { type: "string" },
        },
      },
    },
    ancoragens: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["oportunidade_id", "racional"],
        properties: {
          oportunidade_id: { type: "integer", description: "órfã da persona que pertence a este passo" },
          racional: { type: "string" },
        },
      },
    },
    resumo: { type: "string" },
  },
};

function prompt(): string {
  return fs.readFileSync(
    path.join(process.cwd(), "src/lib/agentes/prompts/organizador.md"),
    "utf-8"
  );
}

export const organizador: Agente = {
  id: "organizador",
  nome: "Organizador da Árvore",
  descricao:
    "Repensa a organização das oportunidades de um passo da jornada: mães agrupando sub-dores, aninhamentos e ancoragem de órfãs — como sugestão única que o PM aprova.",
  passoDoLoop: 4,
  async executar(ctx: ContextoAgente): Promise<Proposta[]> {
    const { db, produtoId, alvoId, gerar } = ctx;
    if (!alvoId) throw new Error("organizador precisa de um passo da jornada alvo");

    const passo = db
      .prepare(
        `SELECT pj.id, pj.titulo, pj.ordem, pj.persona_id, p.nome AS persona
         FROM passo_jornada pj LEFT JOIN persona p ON p.id = pj.persona_id
         WHERE pj.id = ? AND pj.produto_id = ?`
      )
      .get(alvoId, produtoId) as
      | { id: number; titulo: string; ordem: number; persona_id: number | null; persona: string | null }
      | undefined;
    if (!passo) throw new Error(`passo da jornada ${alvoId} não encontrado`);

    const doPasso = db
      .prepare(
        `SELECT o.id, o.titulo, o.estado, o.pai_id,
                (SELECT COUNT(*) FROM evidencia e WHERE e.oportunidade_id = o.id) AS evidencias
         FROM oportunidade o WHERE o.produto_id = ? AND o.passo_jornada_id = ? AND o.estado != 'arquivada'`
      )
      .all(produtoId, alvoId) as OpLida[];
    if (doPasso.length < 2) {
      throw new Error(
        `este passo tem ${doPasso.length} oportunidade(s) — organização só faz sentido com 2+`
      );
    }
    const orfas = db
      .prepare(
        `SELECT o.id, o.titulo, o.estado, o.pai_id,
                (SELECT COUNT(*) FROM evidencia e WHERE e.oportunidade_id = o.id) AS evidencias
         FROM oportunidade o
         WHERE o.produto_id = ? AND o.persona_id IS ? AND o.passo_jornada_id IS NULL
           AND o.estado != 'arquivada'`
      )
      .all(produtoId, passo.persona_id) as OpLida[];

    const { saida } = await gerar({
      sistema: prompt(),
      usuario: JSON.stringify(
        {
          passo: { titulo: passo.titulo, ordem: passo.ordem, persona: passo.persona },
          oportunidades_deste_passo: doPasso,
          orfas_da_persona_sem_passo: orfas,
        },
        null,
        2
      ),
      nomeSchema: "organizacao_da_arvore",
      schema: SCHEMA,
    });
    const bruto = saida as PayloadOrganizacao;

    // Validação mecânica: ids do escopo, sem ciclo, mãe com 2+ filhas.
    const idsPasso = new Set(doPasso.map((o) => o.id));
    const idsOrfas = new Set(orfas.map((o) => o.id));
    const paiDe = new Map(doPasso.map((o) => [o.id, o.pai_id]));
    const descende = (candidata: number, de: number): boolean => {
      let atual: number | null | undefined = candidata;
      for (let i = 0; i < 20 && atual; i++) {
        if (atual === de) return true;
        atual = paiDe.get(atual);
      }
      return false;
    };

    const filhasUsadas = new Set<number>();
    const maes = bruto.maes_novas
      .map((m) => ({
        ...m,
        filhas_ids: m.filhas_ids.filter((f) => idsPasso.has(f) && !filhasUsadas.has(f)),
      }))
      .filter((m) => {
        if (!m.titulo.trim() || m.filhas_ids.length < 2) return false;
        m.filhas_ids.forEach((f) => filhasUsadas.add(f));
        return true;
      });
    const aninhamentos = bruto.aninhamentos.filter(
      (a) =>
        idsPasso.has(a.filha_id) &&
        idsPasso.has(a.mae_id) &&
        a.filha_id !== a.mae_id &&
        !descende(a.mae_id, a.filha_id)
    );
    const ancoragens = bruto.ancoragens
      .filter((a) => idsOrfas.has(a.oportunidade_id))
      .map((a) => ({ ...a, titulo: orfas.find((o) => o.id === a.oportunidade_id)?.titulo }));

    const total = maes.length + aninhamentos.length + ancoragens.length;
    if (total === 0) return [];

    const payload: PayloadOrganizacao = {
      passo_id: passo.id,
      passo_titulo: passo.titulo,
      persona_id: passo.persona_id,
      maes_novas: maes,
      aninhamentos,
      ancoragens,
      resumo: bruto.resumo,
    };

    return [
      {
        tipo: "organizar_arvore",
        alvoTabela: "passo_jornada",
        alvoId,
        payload: payload as unknown as Record<string, unknown>,
        resumo: `Reorganização de "${passo.titulo}": ${maes.length} mãe(s) nova(s), ${aninhamentos.length} aninhamento(s), ${ancoragens.length} ancoragem(ns)`,
        insumos: [{ tabela: "passo_jornada", registroId: alvoId }],
      },
    ];
  },
};
