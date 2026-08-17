import fs from "node:fs";
import path from "node:path";
import { medir } from "@/lib/fontes";
import type { Agente, ContextoAgente, Proposta } from "./types";

interface SaidaFicha {
  hipotese: string;
  metrica_primaria: string;
  metrica_negocio_id: number | null;
  meta: string;
  guardrails: string;
  fonte_dados_id: number | null;
  consulta: string;
  consulta_baseline: string;
  baseline_descricao: string;
  instrumentacao: string;
  justificativa: string;
}

/** Payload da sugestão: a saída do modelo + os resultados reais dos dry-runs. */
export interface PayloadFicha extends SaidaFicha {
  baseline: string;
  dry_run?: { valor: number; detalhe: string };
  dry_run_erro?: string;
  baseline_medida?: { valor: number; detalhe: string };
  baseline_erro?: string;
}

const SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: [
    "hipotese",
    "metrica_primaria",
    "metrica_negocio_id",
    "meta",
    "guardrails",
    "fonte_dados_id",
    "consulta",
    "consulta_baseline",
    "baseline_descricao",
    "instrumentacao",
    "justificativa",
  ],
  properties: {
    hipotese: { type: "string" },
    metrica_primaria: { type: "string" },
    metrica_negocio_id: { type: ["integer", "null"] },
    meta: { type: "string" },
    guardrails: { type: "string" },
    fonte_dados_id: { type: ["integer", "null"] },
    consulta: { type: "string" },
    consulta_baseline: { type: "string" },
    baseline_descricao: { type: "string" },
    instrumentacao: { type: "string" },
    justificativa: { type: "string" },
  },
};

/** Rascunho de veredito — a outra ponta do mesmo agente, quando as revisões acabaram. */
export interface PayloadVeredito {
  veredito: "sucesso" | "fracasso" | "inconclusivo";
  aprendizado: string;
  justificativa: string;
}

const SCHEMA_VEREDITO: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["justificativa", "veredito", "aprendizado"],
  properties: {
    justificativa: {
      type: "string",
      description: "resultado vs meta vs baseline, tendência 30/60/90 e confounders — com os números",
    },
    veredito: { type: "string", enum: ["sucesso", "fracasso", "inconclusivo"] },
    aprendizado: { type: "string", description: "o que muda a próxima decisão — não o resultado" },
  },
};

function prompt(arquivo = "fechador-de-loop.md"): string {
  return fs.readFileSync(
    path.join(process.cwd(), "src/lib/agentes/prompts", arquivo),
    "utf-8"
  );
}

interface RevisaoLida {
  rotulo: string;
  data_prevista: string;
  data_realizada: string | null;
  valor_observado: string;
  notas: string;
}

async function rascunharVeredito(
  ctx: ContextoAgente,
  lancamento: Record<string, unknown>,
  revisoes: RevisaoLida[]
): Promise<Proposta[]> {
  const { db, produtoId, gerar } = ctx;
  const produto = db
    .prepare("SELECT nome, descricao, contexto FROM produto WHERE id = ?")
    .get(produtoId) as { nome: string; descricao: string; contexto: string };
  const metrica = lancamento.metrica_negocio_id
    ? (db
        .prepare("SELECT nome, definicao, meta, valor_atual FROM metrica_negocio WHERE id = ?")
        .get(lancamento.metrica_negocio_id) as Record<string, unknown> | undefined)
    : undefined;

  const { saida } = await gerar({
    sistema: prompt("fechador-veredito.md"),
    usuario: JSON.stringify(
      {
        produto: { nome: produto.nome, descricao: produto.descricao },
        lancamento: {
          nome: lancamento.nome,
          data_lancamento: lancamento.data_lancamento,
          hipotese: lancamento.hipotese,
          metrica_primaria: lancamento.metrica_primaria,
          baseline: lancamento.baseline,
          meta: lancamento.meta,
          guardrails: lancamento.guardrails,
          notas: lancamento.notas,
        },
        metrica_de_negocio_apontada: metrica ?? null,
        revisoes,
      },
      null,
      2
    ),
    nomeSchema: "rascunho_veredito",
    schema: SCHEMA_VEREDITO,
  });
  const payload = saida as unknown as PayloadVeredito;

  return [
    {
      tipo: "rascunhar_veredito",
      alvoTabela: "lancamento",
      alvoId: Number(lancamento.id),
      payload: payload as unknown as Record<string, unknown>,
      resumo: `Veredito de "${lancamento.nome}": ${payload.veredito} (rascunho)`,
      insumos: [{ tabela: "lancamento", registroId: Number(lancamento.id) }],
    },
  ];
}

export const fechadorDeLoop: Agente = {
  id: "fechador_de_loop",
  nome: "Fechador de Loop",
  descricao:
    "Rascunha a ficha de medição de um lançamento (hipótese, métrica, meta, consulta com dry-run, baseline) — e, quando todas as revisões estão medidas, rascunha o veredito + aprendizado para fechar o loop.",
  passoDoLoop: 10,
  async executar(ctx: ContextoAgente): Promise<Proposta[]> {
    const { db, produtoId, alvoId, gerar } = ctx;
    if (!alvoId) throw new Error("fechador_de_loop precisa de um lançamento alvo");

    const lancamento = db
      .prepare("SELECT * FROM lancamento WHERE id = ? AND produto_id = ?")
      .get(alvoId, produtoId) as Record<string, unknown> | undefined;
    if (!lancamento) throw new Error(`lançamento ${alvoId} não encontrado`);

    // Se todas as revisões foram medidas e não há veredito, a tarefa desta
    // rodada é fechar o loop — rascunhar veredito + aprendizado, não a ficha.
    const revisoes = db
      .prepare(
        "SELECT rotulo, data_prevista, data_realizada, valor_observado, notas FROM revisao WHERE lancamento_id = ? ORDER BY data_prevista"
      )
      .all(alvoId) as RevisaoLida[];
    if (!lancamento.veredito && revisoes.length > 0 && revisoes.every((r) => r.data_realizada)) {
      return rascunharVeredito(ctx, lancamento, revisoes);
    }

    const produto = db
      .prepare("SELECT nome, descricao, contexto FROM produto WHERE id = ?")
      .get(produtoId) as { nome: string; descricao: string; contexto: string };
    const metricas = db
      .prepare("SELECT id, nome, definicao, unidade, meta FROM metrica_negocio WHERE produto_id = ?")
      .all(produtoId) as Record<string, unknown>[];
    const fontes = db
      .prepare("SELECT id, nome, tipo, config FROM fonte_dados WHERE produto_id = ?")
      .all(produtoId) as { id: number; nome: string; tipo: string; config: string }[];
    const solucao = lancamento.solucao_id
      ? (db
          .prepare(
            `SELECT s.titulo, s.descricao, o.titulo AS oportunidade
             FROM solucao s LEFT JOIN oportunidade o ON o.id = s.oportunidade_id
             WHERE s.id = ?`
          )
          .get(lancamento.solucao_id) as Record<string, unknown> | undefined)
      : undefined;

    const usuario = JSON.stringify(
      {
        produto: { nome: produto.nome, descricao: produto.descricao },
        contexto_de_dados: produto.contexto || "(vazio — sem schema de warehouse configurado)",
        lancamento: {
          nome: lancamento.nome,
          data_lancamento: lancamento.data_lancamento,
          notas: lancamento.notas,
          como_medir_descricao: lancamento.fonte_dados,
          campos_atuais: {
            hipotese: lancamento.hipotese,
            metrica_primaria: lancamento.metrica_primaria,
            baseline: lancamento.baseline,
            meta: lancamento.meta,
            guardrails: lancamento.guardrails,
          },
        },
        solucao_de_origem: solucao ?? null,
        metricas_de_negocio: metricas,
        fontes_disponiveis: fontes.map((f) => ({ id: f.id, nome: f.nome, tipo: f.tipo })),
        formato_de_consulta_por_tipo: {
          posthog:
            "uma query HogQL cuja primeira célula do resultado é o número (tabela events: event, timestamp, person_id, properties)",
          comando:
            "um comando de shell cuja última linha de saída é o número (ex.: bq query --use_legacy_sql=false --format=csv '...' | tail -1)",
          http: "URL seguida de espaço e caminho de pontos no JSON (ex.: https://api/x data.valor)",
        },
      },
      null,
      2
    );

    let { saida } = await gerar({
      sistema: prompt(),
      usuario,
      nomeSchema: "rascunho_ficha_lancamento",
      schema: SCHEMA,
    });
    let ficha = saida as SaidaFicha;

    const payload: PayloadFicha = { ...ficha, baseline: "" };

    // Dry-run da consulta principal — com uma rodada de correção se falhar.
    const fonte = fontes.find((f) => f.id === ficha.fonte_dados_id);
    if (fonte && ficha.consulta.trim()) {
      try {
        const r = await medir(fonte, ficha.consulta);
        payload.dry_run = { valor: r.valor, detalhe: r.detalhe };
      } catch (e) {
        const erro = e instanceof Error ? e.message : String(e);
        try {
          const retry = await gerar({
            sistema: prompt(),
            usuario: `${usuario}\n\nSUA CONSULTA ANTERIOR FALHOU. Consulta: ${ficha.consulta}\nErro: ${erro}\nCorrija a consulta (ou esvazie-a se não for possível) e devolva a ficha completa novamente.`,
            nomeSchema: "rascunho_ficha_lancamento",
            schema: SCHEMA,
          });
          ficha = retry.saida as SaidaFicha;
          Object.assign(payload, ficha);
          if (ficha.consulta.trim()) {
            const r2 = await medir(fonte, ficha.consulta);
            payload.dry_run = { valor: r2.valor, detalhe: r2.detalhe };
            delete payload.dry_run_erro;
          }
        } catch (e2) {
          payload.dry_run_erro = e2 instanceof Error ? e2.message : String(e2);
        }
      }
    }

    // Baseline medida na janela pré-lançamento (se há data e consulta de baseline).
    if (fonte && ficha.consulta_baseline.trim() && lancamento.data_lancamento) {
      try {
        const rb = await medir(fonte, ficha.consulta_baseline);
        payload.baseline_medida = { valor: rb.valor, detalhe: rb.detalhe };
        payload.baseline = `${rb.valor} (${ficha.baseline_descricao})`;
      } catch (e) {
        payload.baseline_erro = e instanceof Error ? e.message : String(e);
        payload.baseline = ficha.baseline_descricao ? `a medir — ${ficha.baseline_descricao}` : "";
      }
    } else if (ficha.baseline_descricao) {
      payload.baseline = `a medir — ${ficha.baseline_descricao}`;
    }

    return [
      {
        tipo: "rascunhar_ficha",
        alvoTabela: "lancamento",
        alvoId,
        payload,
        resumo: `Ficha de "${lancamento.nome}": ${ficha.metrica_primaria || "sem métrica proposta"}`,
        insumos: [{ tabela: "lancamento", registroId: alvoId }],
      },
    ];
  },
};
