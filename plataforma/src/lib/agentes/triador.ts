import fs from "node:fs";
import path from "node:path";
import type { Agente, ContextoAgente, Proposta } from "./types";

interface SinalExtraido {
  conteudo: string;
  trecho_fonte: string;
  persona_id: number | null;
}

interface Decisao {
  indices: number[];
  acao: "ligar" | "criar" | "inbox" | "arquivar";
  oportunidade_id: number | null;
  pai_id: number | null;
  titulo: string;
  persona_id: number | null;
  passo_jornada_id: number | null;
  racional: string;
}

const SCHEMA_EXTRACAO: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["sinais"],
  properties: {
    sinais: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["conteudo", "trecho_fonte", "persona_id"],
        properties: {
          conteudo: { type: "string" },
          trecho_fonte: { type: "string" },
          persona_id: { type: ["integer", "null"] },
        },
      },
    },
  },
};

const SCHEMA_DECISOES: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["decisoes"],
  properties: {
    decisoes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["indices", "acao", "oportunidade_id", "pai_id", "titulo", "persona_id", "passo_jornada_id", "racional"],
        properties: {
          indices: { type: "array", items: { type: "integer" } },
          acao: { type: "string", enum: ["ligar", "criar", "inbox"] },
          oportunidade_id: { type: ["integer", "null"] },
          pai_id: { type: ["integer", "null"], description: "se a NOVA oportunidade é sub-dor de uma existente, o id da mãe" },
          titulo: { type: "string" },
          persona_id: { type: ["integer", "null"] },
          passo_jornada_id: { type: ["integer", "null"] },
          racional: { type: "string" },
        },
      },
    },
  },
};

function prompt(nome: string): string {
  return fs.readFileSync(path.join(process.cwd(), `src/lib/agentes/prompts/${nome}.md`), "utf-8");
}

/** Citação literal verificável: existe no insumo, ignorando caixa e espaçamento. */
function normalizar(t: string): string {
  return t.toLowerCase().replace(/\s+/g, " ").trim();
}

export const triador: Agente = {
  id: "triador",
  nome: "Triador",
  descricao:
    "Transforma insumo bruto (daily do CS, transcrição, thread) em sinais atômicos com citação literal verificada, e propõe o destino de cada um contra a árvore. Sem alvo, roda no modo inbox: tria os sinais já registrados que estão parados.",
  passoDoLoop: 3,
  classeModelo: "mini",
  async executar(ctx: ContextoAgente): Promise<Proposta[]> {
    const { db, produtoId, alvoId, gerar } = ctx;
    if (!alvoId) return triarInbox(ctx);

    const insumo = db
      .prepare("SELECT * FROM insumo WHERE id = ? AND produto_id = ?")
      .get(alvoId, produtoId) as { canal: string; conteudo: string } | undefined;
    if (!insumo) throw new Error(`insumo ${alvoId} não encontrado`);

    const personas = db
      .prepare("SELECT id, nome FROM persona WHERE produto_id = ?")
      .all(produtoId) as { id: number; nome: string }[];
    const passos = db
      .prepare(
        `SELECT pj.id, p.nome AS persona, pj.ordem, pj.titulo FROM passo_jornada pj
         LEFT JOIN persona p ON p.id = pj.persona_id WHERE pj.produto_id = ?`
      )
      .all(produtoId) as Record<string, unknown>[];
    const arvore = db
      .prepare(
        `SELECT o.id, o.titulo, p.nome AS persona, pj.titulo AS passo, o.estado,
                (SELECT COUNT(*) FROM evidencia e WHERE e.oportunidade_id = o.id) AS evidencias
         FROM oportunidade o
         LEFT JOIN persona p ON p.id = o.persona_id
         LEFT JOIN passo_jornada pj ON pj.id = o.passo_jornada_id
         WHERE o.produto_id = ? AND o.estado != 'arquivada'`
      )
      .all(produtoId) as { id: number; titulo: string }[];
    const sinaisExistentes = db
      .prepare("SELECT conteudo FROM sinal WHERE produto_id = ? ORDER BY id DESC LIMIT 50")
      .all(produtoId) as { conteudo: string }[];

    // Passo 1 — extração de sinais atômicos com citação literal.
    const extracao = await gerar({
      sistema: prompt("triador-extracao"),
      usuario: JSON.stringify(
        {
          canal: insumo.canal,
          insumo: insumo.conteudo,
          personas,
          sinais_ja_registrados: sinaisExistentes.map((s) => s.conteudo),
        },
        null,
        2
      ),
      nomeSchema: "extracao_de_sinais",
      schema: SCHEMA_EXTRACAO,
    });
    const brutos = (extracao.saida as { sinais: SinalExtraido[] }).sinais;

    // Verificação mecânica da citação: sem trecho real no insumo, o sinal cai.
    const texto = normalizar(insumo.conteudo);
    const sinais = brutos.filter((s) => s.trecho_fonte.trim() && texto.includes(normalizar(s.trecho_fonte)));
    if (sinais.length === 0) return [];

    // Passo 2 — destino de cada sinal contra a árvore.
    const decisao = await gerar({
      sistema: prompt("triador-arvore"),
      usuario: JSON.stringify(
        {
          sinais: sinais.map((s, i) => ({ indice: i, conteudo: s.conteudo, persona_id: s.persona_id })),
          arvore_de_oportunidades: arvore,
          personas,
          passos_da_jornada: passos,
        },
        null,
        2
      ),
      nomeSchema: "destino_dos_sinais",
      schema: SCHEMA_DECISOES,
    });
    const decisoes = (decisao.saida as { decisoes: Decisao[] }).decisoes;

    const nomePersona = (id: number | null) => personas.find((p) => p.id === id)?.nome ?? null;
    const tituloPasso = (id: number | null) =>
      (passos.find((p) => p.id === id) as { titulo?: string } | undefined)?.titulo ?? null;

    const propostas: Proposta[] = [];
    const usados = new Set<number>();
    for (const d of decisoes) {
      const grupo = d.indices
        .filter((i) => sinais[i] && !usados.has(i))
        .map((i) => {
          usados.add(i);
          return { conteudo: sinais[i].conteudo, trecho_fonte: sinais[i].trecho_fonte };
        });
      if (grupo.length === 0) continue;

      if (d.acao === "ligar" && d.oportunidade_id) {
        const alvo = arvore.find((o) => o.id === d.oportunidade_id);
        if (!alvo) continue; // oportunidade alucinada — descarta a decisão
        propostas.push({
          tipo: "sinal_evidencia",
          alvoTabela: "sinal",
          alvoId: null,
          payload: {
            sinais: grupo,
            canal: insumo.canal,
            oportunidade_id: d.oportunidade_id,
            oportunidade_titulo: alvo.titulo,
            racional: d.racional,
          },
          resumo: `${grupo.length} sinal(is) → evidência de "${alvo.titulo}"`,
          insumos: [{ tabela: "insumo", registroId: alvoId }],
        });
      } else if (d.acao === "criar" && d.titulo.trim()) {
        const mae = d.pai_id ? arvore.find((o) => o.id === d.pai_id) : undefined;
        propostas.push({
          tipo: "sinal_nova_oportunidade",
          alvoTabela: "oportunidade",
          alvoId: null,
          payload: {
            sinais: grupo,
            canal: insumo.canal,
            titulo: d.titulo,
            pai_id: mae?.id ?? null,
            pai_titulo: mae?.titulo ?? null,
            persona_id: d.persona_id,
            persona_nome: nomePersona(d.persona_id),
            passo_jornada_id: d.passo_jornada_id,
            passo_titulo: tituloPasso(d.passo_jornada_id),
            racional: d.racional,
          },
          resumo: `Nova oportunidade: "${d.titulo}"${mae ? ` — filha de "${mae.titulo.slice(0, 40)}"` : ""} (${grupo.length} evidência(s))`,
          insumos: [{ tabela: "insumo", registroId: alvoId }],
        });
      } else {
        propostas.push({
          tipo: "sinal_inbox",
          alvoTabela: "sinal",
          alvoId: null,
          payload: { sinais: grupo, canal: insumo.canal, racional: d.racional },
          resumo: `${grupo.length} sinal(is) para o inbox (triagem manual)`,
          insumos: [{ tabela: "insumo", registroId: alvoId }],
        });
      }
    }

    // Sinais que o passo 2 esqueceu vão para o inbox — nada extraído se perde.
    const orfaos = sinais
      .map((s, i) => ({ s, i }))
      .filter(({ i }) => !usados.has(i))
      .map(({ s }) => ({ conteudo: s.conteudo, trecho_fonte: s.trecho_fonte }));
    if (orfaos.length > 0) {
      propostas.push({
        tipo: "sinal_inbox",
        alvoTabela: "sinal",
        alvoId: null,
        payload: { sinais: orfaos, canal: insumo.canal, racional: "sem decisão do passo 2" },
        resumo: `${orfaos.length} sinal(is) para o inbox (sem destino proposto)`,
        insumos: [{ tabela: "insumo", registroId: alvoId }],
      });
    }

    return propostas;
  },
};

/** Modo inbox: propõe destino para sinais já registrados e parados na triagem. */
async function triarInbox(ctx: ContextoAgente): Promise<Proposta[]> {
  const { db, produtoId, gerar } = ctx;

  const pendentes = db
    .prepare(
      "SELECT id, canal, conteudo FROM sinal WHERE produto_id = ? AND status = 'novo' ORDER BY id"
    )
    .all(produtoId) as { id: number; canal: string; conteudo: string }[];
  if (pendentes.length === 0) return [];

  // Não re-triar sinais que já têm sugestão pendente aguardando o PM.
  const comSugestao = new Set<number>();
  const abertas = db
    .prepare("SELECT payload FROM sugestao WHERE produto_id = ? AND estado = 'sugerida' AND tipo = 'triar_sinal'")
    .all(produtoId) as { payload: string }[];
  for (const s of abertas) {
    const ids = (JSON.parse(s.payload) as { sinal_ids?: number[] }).sinal_ids ?? [];
    for (const id of ids) comSugestao.add(id);
  }
  const sinais = pendentes.filter((s) => !comSugestao.has(s.id));
  if (sinais.length === 0) return [];

  const personas = db
    .prepare("SELECT id, nome FROM persona WHERE produto_id = ?")
    .all(produtoId) as { id: number; nome: string }[];
  const passos = db
    .prepare(
      `SELECT pj.id, p.nome AS persona, pj.ordem, pj.titulo FROM passo_jornada pj
       LEFT JOIN persona p ON p.id = pj.persona_id WHERE pj.produto_id = ?`
    )
    .all(produtoId) as Record<string, unknown>[];
  const arvore = db
    .prepare(
      `SELECT o.id, o.titulo, p.nome AS persona, pj.titulo AS passo, o.estado,
              (SELECT COUNT(*) FROM evidencia e WHERE e.oportunidade_id = o.id) AS evidencias
       FROM oportunidade o
       LEFT JOIN persona p ON p.id = o.persona_id
       LEFT JOIN passo_jornada pj ON pj.id = o.passo_jornada_id
       WHERE o.produto_id = ? AND o.estado != 'arquivada'`
    )
    .all(produtoId) as { id: number; titulo: string }[];

  const SCHEMA: Record<string, unknown> = {
    type: "object",
    additionalProperties: false,
    required: ["decisoes"],
    properties: {
      decisoes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["indices", "acao", "oportunidade_id", "pai_id", "titulo", "persona_id", "passo_jornada_id", "racional"],
          properties: {
            indices: { type: "array", items: { type: "integer" } },
            acao: { type: "string", enum: ["ligar", "criar", "arquivar"] },
            oportunidade_id: { type: ["integer", "null"] },
            pai_id: { type: ["integer", "null"], description: "se a NOVA oportunidade é sub-dor de uma existente, o id da mãe" },
            titulo: { type: "string" },
            persona_id: { type: ["integer", "null"] },
            passo_jornada_id: { type: ["integer", "null"] },
            racional: { type: "string" },
          },
        },
      },
    },
  };

  const { saida } = await gerar({
    sistema: fs.readFileSync(
      path.join(process.cwd(), "src/lib/agentes/prompts/triador-inbox.md"),
      "utf-8"
    ),
    usuario: JSON.stringify(
      {
        sinais: sinais.map((s, i) => ({ indice: i, canal: s.canal, conteudo: s.conteudo })),
        arvore_de_oportunidades: arvore,
        personas,
        passos_da_jornada: passos,
      },
      null,
      2
    ),
    nomeSchema: "triagem_do_inbox",
    schema: SCHEMA,
  });
  const decisoes = (saida as { decisoes: Decisao[] }).decisoes;

  const nomePersona = (id: number | null) => personas.find((p) => p.id === id)?.nome ?? null;
  const tituloPasso = (id: number | null) =>
    (passos.find((p) => p.id === id) as { titulo?: string } | undefined)?.titulo ?? null;

  const propostas: Proposta[] = [];
  const usados = new Set<number>();
  for (const d of decisoes) {
    const grupo = d.indices.filter((i) => sinais[i] && !usados.has(i));
    if (grupo.length === 0) continue;
    grupo.forEach((i) => usados.add(i));
    const itens = grupo.map((i) => ({ id: sinais[i].id, conteudo: sinais[i].conteudo }));
    const ids = itens.map((s) => s.id);
    const insumos = ids.map((id) => ({ tabela: "sinal", registroId: id }));

    if (d.acao === "ligar" && d.oportunidade_id) {
      const alvo = arvore.find((o) => o.id === d.oportunidade_id);
      if (!alvo) continue;
      propostas.push({
        tipo: "triar_sinal",
        alvoTabela: "sinal",
        alvoId: null,
        payload: {
          acao: "ligar",
          sinal_ids: ids,
          sinais: itens,
          oportunidade_id: d.oportunidade_id,
          oportunidade_titulo: alvo.titulo,
          racional: d.racional,
        },
        resumo: `${ids.length} sinal(is) do inbox → evidência de "${alvo.titulo}"`,
        insumos,
      });
    } else if (d.acao === "criar" && d.titulo.trim()) {
      const mae = d.pai_id ? arvore.find((o) => o.id === d.pai_id) : undefined;
      propostas.push({
        tipo: "triar_sinal",
        alvoTabela: "oportunidade",
        alvoId: null,
        payload: {
          acao: "criar",
          sinal_ids: ids,
          sinais: itens,
          titulo: d.titulo,
          pai_id: mae?.id ?? null,
          pai_titulo: mae?.titulo ?? null,
          persona_id: d.persona_id,
          persona_nome: nomePersona(d.persona_id),
          passo_jornada_id: d.passo_jornada_id,
          passo_titulo: tituloPasso(d.passo_jornada_id),
          racional: d.racional,
        },
        resumo: `Nova oportunidade do inbox: "${d.titulo}"${mae ? ` — filha de "${mae.titulo.slice(0, 40)}"` : ""} (${ids.length} evidência(s))`,
        insumos,
      });
    } else if (d.acao === "arquivar") {
      propostas.push({
        tipo: "triar_sinal",
        alvoTabela: "sinal",
        alvoId: null,
        payload: { acao: "arquivar", sinal_ids: ids, sinais: itens, racional: d.racional },
        resumo: `Arquivar ${ids.length} sinal(is) do inbox`,
        insumos,
      });
    }
  }
  return propostas;
}
