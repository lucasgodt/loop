import fs from "node:fs";
import path from "node:path";
import type { Agente, ContextoAgente, Proposta } from "./types";

/**
 * O Arquiteto (passo 9): consolida o desenho da solução a partir das RESPOSTAS
 * aos riscos — e só roda quando todo risco importante tem resposta. O portão é
 * mecânico e vale por construção: risco importante sem teste validado nem
 * mitigação de desenho → o agente se recusa, listando o que falta. Aceitar
 * grava o desenho na solução e cria a ficha de lançamento ligada a ela.
 */

interface SuposicaoLida {
  id: number;
  texto: string;
  lente: string;
  importancia: number;
  evidencia: number;
  estado: string;
  mitigacao: string;
}

/** Risco importante ainda sem resposta (nem validado, nem mitigado). */
export function semResposta(su: SuposicaoLida): boolean {
  if (su.importancia < 4) return false;
  if (su.estado === "refutada") return true; // provada falsa: exige redesenho
  return su.evidencia <= 2 && (su.estado === "mapeada" || su.estado === "em_teste");
}

export interface PayloadDesenho {
  desenho_md: string;
  nome_lancamento: string;
  /** Cobertura calculada pelo sistema: cada risco importante e sua resposta. */
  respostas: string[];
}

const SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["desenho_md", "nome_lancamento"],
  properties: {
    desenho_md: { type: "string", description: "o desenho completo, em markdown" },
    nome_lancamento: { type: "string", description: "nome curto para a ficha de lançamento" },
  },
};

function prompt(): string {
  return fs.readFileSync(
    path.join(process.cwd(), "src/lib/agentes/prompts/arquiteto.md"),
    "utf-8"
  );
}

export const arquiteto: Agente = {
  id: "arquiteto",
  nome: "Arquiteto",
  descricao:
    "Consolida o desenho da solução a partir das respostas aos riscos (testes validados e mitigações) — recusa-se enquanto houver risco importante sem resposta; aceitar grava o desenho e abre a ficha de lançamento.",
  passoDoLoop: 9,
  async executar(ctx: ContextoAgente): Promise<Proposta[]> {
    const { db, produtoId, alvoId, gerar } = ctx;
    if (!alvoId) throw new Error("arquiteto precisa de uma solução alvo");

    const solucao = db
      .prepare(
        `SELECT s.*, o.titulo AS oportunidade_titulo, o.id AS op_id
         FROM solucao s LEFT JOIN oportunidade o ON o.id = s.oportunidade_id
         WHERE s.id = ? AND s.produto_id = ?`
      )
      .get(alvoId, produtoId) as Record<string, unknown> | undefined;
    if (!solucao) throw new Error(`solução ${alvoId} não encontrada`);

    const suposicoes = db
      .prepare(
        "SELECT id, texto, lente, importancia, evidencia, estado, mitigacao FROM suposicao WHERE solucao_id = ?"
      )
      .all(alvoId) as SuposicaoLida[];
    if (suposicoes.length === 0) {
      throw new Error("sem suposições mapeadas não há risco respondido — o desenho seria chute; rode o mapa de riscos primeiro");
    }

    // O portão duro: todo risco importante precisa de resposta.
    const pendentes = suposicoes.filter(semResposta);
    if (pendentes.length > 0) {
      throw new Error(
        `${pendentes.length} risco(s) importante(s) sem resposta — teste ou mitigue antes de desenhar: ${pendentes
          .map((s) => `"${s.texto.slice(0, 60)}" (${s.estado.replace("_", " ")})`)
          .join("; ")}`
      );
    }

    const testes = db
      .prepare(
        `SELECT t.suposicao_id, su.texto AS suposicao, t.metodo, t.criterio, t.resultado, t.veredito, t.aprendizado
         FROM teste_suposicao t JOIN suposicao su ON su.id = t.suposicao_id
         WHERE su.solucao_id = ?`
      )
      .all(alvoId) as Record<string, unknown>[];
    const passos = db
      .prepare("SELECT ordem, titulo FROM passo_story_map WHERE solucao_id = ? ORDER BY ordem, id")
      .all(alvoId) as Record<string, unknown>[];
    const evidencias = solucao.op_id
      ? (db
          .prepare(
            `SELECT COALESCE(e.historia || ' ' || e.notas, s.conteudo) AS conteudo
             FROM evidencia ev
             LEFT JOIN entrevista e ON e.id = ev.entrevista_id
             LEFT JOIN sinal s ON s.id = ev.sinal_id
             WHERE ev.oportunidade_id = ?`
          )
          .all(solucao.op_id) as Record<string, unknown>[])
      : [];
    const produto = db
      .prepare("SELECT nome, descricao FROM produto WHERE id = ?")
      .get(produtoId) as { nome: string; descricao: string };

    const mitigacoes = suposicoes.filter((s) => s.estado === "mitigada" && s.mitigacao.trim());
    const validadas = suposicoes.filter((s) => s.estado === "validada");

    const { saida } = await gerar({
      sistema: prompt(),
      usuario: JSON.stringify(
        {
          produto,
          oportunidade: solucao.oportunidade_titulo,
          solucao: { titulo: solucao.titulo, descricao: solucao.descricao },
          evidencias,
          story_map: passos,
          mitigacoes: mitigacoes.map((s) => ({ decisao: s.mitigacao, mitiga_o_risco: s.texto })),
          testes_e_vereditos: testes,
          suposicoes_menores_ainda_abertas: suposicoes
            .filter((s) => s.estado === "mapeada" || s.estado === "em_teste")
            .map((s) => ({ texto: s.texto, importancia: s.importancia, evidencia: s.evidencia })),
        },
        null,
        2
      ),
      nomeSchema: "desenho_da_solucao",
      schema: SCHEMA,
    });
    const bruto = saida as { desenho_md: string; nome_lancamento: string };

    // Cobertura calculada pelo sistema — a prova de que tudo importante tem resposta.
    const respostas = suposicoes
      .filter((s) => s.importancia >= 4)
      .map((s) =>
        s.estado === "mitigada"
          ? `🛡 mitigado pelo desenho: "${s.texto}" → ${s.mitigacao}`
          : s.estado === "validada"
            ? `✓ validado por teste: "${s.texto}"`
            : `· ${s.estado}: "${s.texto}"`
      );

    const payload: PayloadDesenho = {
      desenho_md: bruto.desenho_md,
      nome_lancamento: bruto.nome_lancamento.trim() || String(solucao.titulo),
      respostas,
    };

    return [
      {
        tipo: "desenhar_solucao",
        alvoTabela: "solucao",
        alvoId,
        payload: payload as unknown as Record<string, unknown>,
        resumo: `Desenho de "${solucao.titulo}" consolidado (${respostas.length} risco(s) importante(s) respondido(s))`,
        insumos: [{ tabela: "solucao", registroId: alvoId }],
      },
    ];
  },
};
