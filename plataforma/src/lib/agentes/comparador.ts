import fs from "node:fs";
import path from "node:path";
import type { Agente, ContextoAgente, Proposta } from "./types";

/**
 * O Comparador de Soluções (passos 6→7): compara as 3+ ideias de uma
 * oportunidade pelo método do próprio funil — jornada de valor de cada uma,
 * risco por passo nas 5 lentes — e recomenda a de maior chance com menor
 * risco. A escolha é do PM: o card permite aplicar na recomendada OU em
 * outra, e o aceite leva jornada + riscos para o story map e as suposições
 * da solução escolhida (nada da análise vira decisão sozinho).
 */

const LENTES = ["desejavel", "viavel", "factivel", "usavel", "etica"] as const;

export interface PassoAnalise {
  passo: string;
  risco: string;
  lente: string;
  gravidade: number;
}

export interface AnaliseSolucao {
  solucao_id: number;
  titulo?: string; // preenchido mecanicamente do banco
  jornada: PassoAnalise[];
  risco_geral: number;
  resumo: string;
}

export interface PayloadComparacao {
  analises: AnaliseSolucao[];
  escolhida_id: number;
  justificativa: string;
}

const SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["analises", "escolhida_id", "justificativa"],
  properties: {
    analises: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["solucao_id", "jornada", "risco_geral", "resumo"],
        properties: {
          solucao_id: { type: "integer" },
          jornada: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["passo", "risco", "lente", "gravidade"],
              properties: {
                passo: { type: "string", description: "verbo do usuário" },
                risco: { type: "string", description: "o que pode não ser verdade neste passo" },
                lente: { type: "string", enum: [...LENTES] },
                gravidade: { type: "integer", description: "1–5: se der errado, quanto mata a solução" },
              },
            },
          },
          risco_geral: { type: "integer", description: "1–5, puxado pelo pior gargalo" },
          resumo: { type: "string", description: "a aposta central e o calcanhar, 1–2 frases" },
        },
      },
    },
    escolhida_id: { type: "integer" },
    justificativa: {
      type: "string",
      description: "comparativa e explícita: por que esta e não as outras",
    },
  },
};

function prompt(): string {
  return fs.readFileSync(
    path.join(process.cwd(), "src/lib/agentes/prompts/comparador.md"),
    "utf-8"
  );
}

export const comparador: Agente = {
  id: "comparador",
  nome: "Comparador de Soluções",
  descricao:
    "Compara as 3+ soluções de uma oportunidade — jornada de valor de cada uma, risco por passo nas 5 lentes — e recomenda a de maior chance com menor risco; aceitar leva jornada e riscos para o story map da escolhida.",
  passoDoLoop: 6,
  async executar(ctx: ContextoAgente): Promise<Proposta[]> {
    const { db, produtoId, alvoId, gerar } = ctx;
    if (!alvoId) throw new Error("comparador precisa de uma oportunidade alvo");

    const oportunidade = db
      .prepare(
        `SELECT o.titulo, o.notas, pe.nome AS persona, pj.titulo AS passo_da_jornada
         FROM oportunidade o
         LEFT JOIN persona pe ON pe.id = o.persona_id
         LEFT JOIN passo_jornada pj ON pj.id = o.passo_jornada_id
         WHERE o.id = ? AND o.produto_id = ?`
      )
      .get(alvoId, produtoId) as Record<string, unknown> | undefined;
    if (!oportunidade) throw new Error(`oportunidade ${alvoId} não encontrada`);

    const solucoes = db
      .prepare(
        "SELECT id, titulo, descricao FROM solucao WHERE oportunidade_id = ? AND estado != 'descartada'"
      )
      .all(alvoId) as { id: number; titulo: string; descricao: string }[];
    if (solucoes.length < 3) {
      throw new Error(
        `a comparação precisa de 3+ soluções na mesa (há ${solucoes.length}) — é o contraste que revela a escolha`
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
    const produto = db
      .prepare("SELECT nome, descricao FROM produto WHERE id = ?")
      .get(produtoId) as { nome: string; descricao: string };

    const { saida } = await gerar({
      sistema: prompt(),
      usuario: JSON.stringify(
        {
          produto,
          oportunidade,
          evidencias,
          solucoes_a_comparar: solucoes,
        },
        null,
        2
      ),
      nomeSchema: "comparacao_de_solucoes",
      schema: SCHEMA,
    });
    const bruto = saida as PayloadComparacao;

    // Validação mecânica: ids reais, títulos do banco, clamps e tetos.
    const porId = new Map(solucoes.map((s) => [s.id, s]));
    const analises = bruto.analises
      .filter((a) => porId.has(a.solucao_id))
      .map((a) => ({
        ...a,
        titulo: porId.get(a.solucao_id)!.titulo,
        risco_geral: Math.min(5, Math.max(1, Math.round(a.risco_geral))),
        jornada: a.jornada.slice(0, 8).map((p) => ({
          ...p,
          lente: LENTES.includes(p.lente as (typeof LENTES)[number]) ? p.lente : "desejavel",
          gravidade: Math.min(5, Math.max(1, Math.round(p.gravidade))),
        })),
      }));
    if (analises.length < solucoes.length) {
      throw new Error("o modelo não analisou todas as soluções — rode de novo");
    }
    const escolhida = porId.has(bruto.escolhida_id)
      ? bruto.escolhida_id
      : analises.slice().sort((a, b) => a.risco_geral - b.risco_geral)[0].solucao_id;

    const payload: PayloadComparacao = {
      analises,
      escolhida_id: escolhida,
      justificativa: bruto.justificativa,
    };

    return [
      {
        tipo: "comparar_solucoes",
        alvoTabela: "oportunidade",
        alvoId,
        payload: payload as unknown as Record<string, unknown>,
        resumo: `Comparação de ${analises.length} soluções de "${oportunidade.titulo}": recomenda "${porId.get(escolhida)!.titulo}"`,
        insumos: [{ tabela: "oportunidade", registroId: alvoId }],
      },
    ];
  },
};
