import fs from "node:fs";
import path from "node:path";
import type { Agente, ContextoAgente, Proposta } from "./types";

/**
 * O Agente de Risco (passos 7 e 8): mapeia suposições candidatas nas 5 lentes
 * (máx. 7 por rodada, máx. 2 por lente, evidência ≤ 2 quando não há dado no
 * banco) e desenha o teste da suposição mais arriscada JÁ MAPEADA — critério
 * numérico falseável obrigatório; sem número, o teste é descartado aqui.
 * Respeita o portão do funil: só roda com 3+ soluções na oportunidade.
 */

const LENTES = ["desejavel", "viavel", "factivel", "usavel", "etica"] as const;

interface SuposicaoProposta {
  texto: string;
  lente: string;
  passo_story_map_id: number | null;
  importancia: number;
  evidencia: number;
  justificativa: string;
}

interface SaidaRisco {
  suposicoes: SuposicaoProposta[];
  teste: {
    suposicao_id: number;
    metodo: string;
    criterio: string;
    roteiro: string;
  } | null;
}

const SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["suposicoes", "teste"],
  properties: {
    suposicoes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["texto", "lente", "passo_story_map_id", "importancia", "evidencia", "justificativa"],
        properties: {
          texto: { type: "string", description: "completa a frase 'Acreditamos que…'" },
          lente: { type: "string", enum: [...LENTES] },
          passo_story_map_id: { type: ["integer", "null"] },
          importancia: { type: "integer" },
          evidencia: { type: "integer" },
          justificativa: { type: "string" },
        },
      },
    },
    teste: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["suposicao_id", "metodo", "criterio", "roteiro"],
          properties: {
            suposicao_id: { type: "integer", description: "id de uma suposição JÁ MAPEADA da lista" },
            metodo: { type: "string" },
            criterio: { type: "string", description: "numérico e falseável, definido antes" },
            roteiro: { type: "string" },
          },
        },
      ],
    },
  },
};

function prompt(): string {
  return fs.readFileSync(
    path.join(process.cwd(), "src/lib/agentes/prompts/agente-de-risco.md"),
    "utf-8"
  );
}

const normalizar = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

export const agenteDeRisco: Agente = {
  id: "agente_de_risco",
  nome: "Agente de Risco",
  descricao:
    "Mapeia suposições da solução nas 5 lentes (candidatas — você carimba a matriz) e desenha o teste da mais arriscada já mapeada, com critério numérico obrigatório.",
  passoDoLoop: 7,
  async executar(ctx: ContextoAgente): Promise<Proposta[]> {
    const { db, produtoId, alvoId, gerar } = ctx;
    if (!alvoId) throw new Error("agente_de_risco precisa de uma solução alvo");

    const solucao = db
      .prepare(
        `SELECT s.*, o.titulo AS oportunidade_titulo, o.id AS oportunidade_id2,
                (SELECT COUNT(*) FROM solucao s2 WHERE s2.oportunidade_id = s.oportunidade_id) AS irmas
         FROM solucao s LEFT JOIN oportunidade o ON o.id = s.oportunidade_id
         WHERE s.id = ? AND s.produto_id = ?`
      )
      .get(alvoId, produtoId) as Record<string, unknown> | undefined;
    if (!solucao) throw new Error(`solução ${alvoId} não encontrada`);

    // O mesmo portão do fluxo manual: suposições só com 3+ soluções na mesa.
    if (solucao.oportunidade_id && Number(solucao.irmas) < 3) {
      throw new Error(
        `a oportunidade tem ${solucao.irmas}/3 soluções — gere mais ideias antes de aprofundar nesta (regra do funil)`
      );
    }

    const passos = db
      .prepare("SELECT id, ordem, titulo FROM passo_story_map WHERE solucao_id = ? ORDER BY ordem, id")
      .all(alvoId) as { id: number; ordem: number; titulo: string }[];
    const existentes = db
      .prepare(
        `SELECT su.id, su.texto, su.lente, su.importancia, su.evidencia, su.estado,
                (SELECT COUNT(*) FROM teste_suposicao t WHERE t.suposicao_id = su.id) AS testes
         FROM suposicao su WHERE su.solucao_id = ?`
      )
      .all(alvoId) as {
      id: number;
      texto: string;
      lente: string;
      importancia: number;
      evidencia: number;
      estado: string;
      testes: number;
    }[];
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
    const produto = db
      .prepare("SELECT nome, descricao FROM produto WHERE id = ?")
      .get(produtoId) as { nome: string; descricao: string };

    const { saida } = await gerar({
      sistema: prompt(),
      usuario: JSON.stringify(
        {
          produto,
          solucao: { titulo: solucao.titulo, descricao: solucao.descricao },
          oportunidade: solucao.oportunidade_titulo,
          story_map: passos,
          suposicoes_ja_mapeadas: existentes,
          evidencias_da_oportunidade: evidencias,
        },
        null,
        2
      ),
      nomeSchema: "mapa_de_risco",
      schema: SCHEMA,
    });
    const bruto = saida as SaidaRisco;

    // Validação mecânica: tetos, lentes, dedupe e referências reais.
    const passosValidos = new Set(passos.map((p) => p.id));
    const textosExistentes = existentes.map((s) => normalizar(s.texto));
    const porLente: Record<string, number> = {};
    const suposicoes: SuposicaoProposta[] = [];
    for (const s of bruto.suposicoes) {
      if (suposicoes.length >= 7) break;
      if (!LENTES.includes(s.lente as (typeof LENTES)[number])) continue;
      if ((porLente[s.lente] ?? 0) >= 2) continue;
      const norm = normalizar(s.texto);
      if (!norm || textosExistentes.some((t) => t === norm || t.includes(norm) || norm.includes(t)))
        continue;
      porLente[s.lente] = (porLente[s.lente] ?? 0) + 1;
      textosExistentes.push(norm);
      suposicoes.push({
        ...s,
        passo_story_map_id:
          s.passo_story_map_id && passosValidos.has(s.passo_story_map_id)
            ? s.passo_story_map_id
            : null,
        importancia: Math.min(5, Math.max(1, Math.round(s.importancia))),
        evidencia: Math.min(5, Math.max(1, Math.round(s.evidencia))),
      });
    }

    const propostas: Proposta[] = [];
    if (suposicoes.length > 0) {
      propostas.push({
        tipo: "criar_suposicoes",
        alvoTabela: "solucao",
        alvoId,
        payload: { suposicoes },
        resumo: `${suposicoes.length} suposição(ões) para "${solucao.titulo}"`,
        insumos: [{ tabela: "solucao", registroId: alvoId }],
      });
    }

    // Teste só para suposição existente, mapeada, sem teste e de alto risco —
    // e só com critério que carrega um número (falseável).
    if (bruto.teste) {
      const alvo = existentes.find((s) => s.id === bruto.teste!.suposicao_id);
      const elegivel =
        alvo && alvo.estado === "mapeada" && alvo.testes === 0 && alvo.importancia >= 4 && alvo.evidencia <= 2;
      if (elegivel && /\d/.test(bruto.teste.criterio)) {
        propostas.push({
          tipo: "rascunhar_teste",
          alvoTabela: "solucao",
          alvoId,
          payload: { ...bruto.teste, suposicao_texto: alvo.texto },
          resumo: `Teste da mais arriscada: "${alvo.texto.slice(0, 60)}" — ${bruto.teste.metodo}`,
          insumos: [{ tabela: "suposicao", registroId: alvo.id }],
        });
      }
    }

    return propostas;
  },
};
