import fs from "node:fs";
import path from "node:path";
import { agora, db } from "./db";

/**
 * Conselheiros: chat multi-turno por passo do loop — a IA que pensa JUNTO,
 * não a que propõe ação. Nenhuma conversa grava nada no método: a decisão
 * continua acontecendo nas telas (definir a meta, escrever a decisão da
 * priorização). Plugar um conselheiro novo = 1 entrada aqui + 1 prompt em
 * agentes/prompts/ + o card <Conversa> na página do passo.
 *
 * O contexto do produto vai inteiro no prompt de sistema — o PM não precisa
 * se apresentar; conversa por cima do que a plataforma já sabe.
 */

/**
 * Uma ferramenta que o conselheiro pode usar quando o PM pedir na conversa
 * (ex.: "preenche o formulário pra mim"). aoChamar grava uma SUGESTÃO — o
 * conselheiro propõe, nunca cria; aceitar o card continua sendo o ato humano.
 * Retorna a frase de confirmação que entra na conversa.
 */
export interface FerramentaConselheiro {
  nome: string;
  descricao: string;
  schema: Record<string, unknown>;
  aoChamar(produtoId: number, execucaoId: number, args: Record<string, unknown>): string;
}

export interface Conselheiro {
  topico: string;
  rotulo: string;
  /** O convite mostrado quando a conversa ainda está vazia. */
  convite: string;
  arquivoPrompt: string;
  /** O contexto dinâmico injetado no sistema a cada mensagem (sempre fresco). */
  contexto(produtoId: number): unknown;
  ferramentas?: FerramentaConselheiro[];
}

function contextoBase(produtoId: number) {
  const produto = db
    .prepare("SELECT nome, descricao, contexto FROM produto WHERE id = ?")
    .get(produtoId) as { nome: string; descricao: string; contexto: string };
  return {
    produto: { nome: produto.nome, descricao: produto.descricao },
    contexto_de_dados: produto.contexto || "(não preenchido)",
    personas: db
      .prepare("SELECT nome FROM persona WHERE produto_id = ?")
      .all(produtoId)
      .map((p) => (p as { nome: string }).nome),
  };
}

const LISTA: Conselheiro[] = [
  {
    topico: "metricas",
    rotulo: "Conselheiro de métricas",
    convite:
      "Pense comigo: qual dessas métricas merece ser a lagging nº 1? O contexto da Mooney já está na conversa — pergunte, discorde, peça o contra-argumento.",
    arquivoPrompt: "conselheiro-metricas.md",
    contexto(produtoId) {
      return {
        ...contextoBase(produtoId),
        metricas_atuais: db
          .prepare(
            "SELECT nome, definicao, unidade, meta, valor_atual, atualizado_em FROM metrica_negocio WHERE produto_id = ?"
          )
          .all(produtoId),
        lancamentos_e_suas_metricas_leading: db
          .prepare(
            "SELECT nome, metrica_primaria, veredito FROM lancamento WHERE produto_id = ?"
          )
          .all(produtoId),
      };
    },
    ferramentas: [
      {
        nome: "propor_metrica",
        descricao:
          "Propõe o preenchimento do formulário de métrica de negócio (nova ou ajuste de uma existente pelo mesmo nome). A proposta vira um card que o PM aceita ou rejeita — nunca cria direto.",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["nome", "definicao", "unidade", "meta", "justificativa"],
          properties: {
            nome: { type: "string" },
            definicao: {
              type: "string",
              description: "como se calcula, sem ambiguidade — quem conta, o quê, em que janela",
            },
            unidade: { type: "string", description: "ex.: escolas, professores/semana, %" },
            meta: { type: "string", description: "valor + prazo (ex.: '40 escolas até dez/2026')" },
            justificativa: {
              type: "string",
              description: "1–2 frases: por que esta é a lagging nº 1, amarrando o que a conversa concluiu",
            },
          },
        },
        aoChamar(produtoId, execucaoId, args) {
          db.prepare(
            `INSERT INTO sugestao (execucao_id, produto_id, tipo, alvo_tabela, alvo_id, payload, resumo, criada_em)
             VALUES (?, ?, 'criar_metrica', 'metrica_negocio', NULL, ?, ?, ?)`
          ).run(
            execucaoId,
            produtoId,
            JSON.stringify(args),
            `Métrica proposta na conversa: ${args.nome}`,
            agora()
          );
          return `📋 Preenchi a proposta da métrica "${args.nome}" — o card está logo abaixo da conversa, na página de métricas. Aceite para criar (os campos seguem editáveis) ou rejeite com o motivo.`;
        },
      },
    ],
  },
  {
    topico: "jornada",
    rotulo: "Conselheiro de jornada",
    convite:
      "Pense comigo a jornada de uma persona por vez: o que ela faz, na ordem, para extrair valor da Mooney? As entrevistas e sinais já estão na conversa — o que não veio da escuta é hipótese, e tudo bem, desde que a gente saiba.",
    arquivoPrompt: "conselheiro-jornada.md",
    contexto(produtoId) {
      return {
        ...contextoBase(produtoId),
        jornadas_atuais: db
          .prepare(
            `SELECT COALESCE(pe.nome, 'Geral') AS persona, pj.ordem, pj.titulo, pj.descricao
             FROM passo_jornada pj LEFT JOIN persona pe ON pe.id = pj.persona_id
             WHERE pj.produto_id = ? ORDER BY pe.nome, pj.ordem`
          )
          .all(produtoId),
        oportunidades_penduradas_na_jornada: db
          .prepare(
            `SELECT o.titulo, pj.titulo AS passo, COALESCE(pe.nome, 'Geral') AS persona
             FROM oportunidade o
             JOIN passo_jornada pj ON pj.id = o.passo_jornada_id
             LEFT JOIN persona pe ON pe.id = o.persona_id
             WHERE o.produto_id = ?`
          )
          .all(produtoId),
        entrevistas_ouvidas: db
          .prepare(
            `SELECT e.data, e.entrevistado, pe.nome AS persona, e.historia, e.notas
             FROM entrevista e LEFT JOIN persona pe ON pe.id = e.persona_id
             WHERE e.produto_id = ? ORDER BY e.data DESC LIMIT 10`
          )
          .all(produtoId),
        sinais_recentes: db
          .prepare(
            "SELECT canal, conteudo, status FROM sinal WHERE produto_id = ? ORDER BY id DESC LIMIT 20"
          )
          .all(produtoId),
      };
    },
    ferramentas: [
      {
        nome: "propor_jornada",
        descricao:
          "Propõe passos de jornada para UMA persona (adiciona aos existentes, nunca substitui). A proposta vira um card que o PM aceita ou rejeita — nunca cria direto.",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["persona", "passos", "justificativa"],
          properties: {
            persona: {
              type: "string",
              description:
                "nome exato de uma persona do contexto, ou 'Geral' para a jornada sem persona",
            },
            passos: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["titulo", "descricao"],
                properties: {
                  titulo: { type: "string", description: "verbo da persona, ex.: 'Descobre o app na formação'" },
                  descricao: { type: "string", description: "1 frase — o que acontece e onde dói" },
                },
              },
            },
            justificativa: {
              type: "string",
              description: "1–2 frases: de onde cada trecho veio (entrevista/sinal) e o que é hipótese",
            },
          },
        },
        aoChamar(produtoId, execucaoId, args) {
          const passos = (args.passos as { titulo: string }[]) ?? [];
          db.prepare(
            `INSERT INTO sugestao (execucao_id, produto_id, tipo, alvo_tabela, alvo_id, payload, resumo, criada_em)
             VALUES (?, ?, 'criar_jornada', 'passo_jornada', NULL, ?, ?, ?)`
          ).run(
            execucaoId,
            produtoId,
            JSON.stringify(args),
            `Jornada proposta na conversa: ${args.persona} (${passos.length} passos)`,
            agora()
          );
          return `📋 Preenchi a proposta da jornada de ${args.persona} com ${passos.length} passo(s) — o card está logo abaixo da conversa, na página de oportunidades. Aceite para criar (passos são adicionados, nunca substituem os existentes) ou rejeite com o motivo.`;
        },
      },
    ],
  },
];

export const CONSELHEIROS: ReadonlyMap<string, Conselheiro> = new Map(
  LISTA.map((c) => [c.topico, c])
);

export function getConselheiro(topico: string): Conselheiro {
  const c = CONSELHEIROS.get(topico);
  if (!c) throw new Error(`conselheiro desconhecido: "${topico}"`);
  return c;
}

export function montarSistema(c: Conselheiro, produtoId: number): string {
  const prompt = fs.readFileSync(
    path.join(process.cwd(), "src/lib/agentes/prompts", c.arquivoPrompt),
    "utf-8"
  );
  return `${prompt}\n\n## Contexto do workspace (a plataforma injeta — sempre atual)\n\n${JSON.stringify(
    c.contexto(produtoId),
    null,
    2
  )}`;
}

// ── Persistência da conversa ─────────────────────────────────────────────────

export interface MensagemConversa {
  id: number;
  papel: "user" | "assistant";
  conteudo: string;
  criada_em: string;
}

/** Quantas mensagens recentes vão para o modelo (o resto fica só no histórico). */
export const JANELA_CONVERSA = 30;

export function conversaDoTopico(produtoId: number, topico: string): number {
  const existente = db
    .prepare("SELECT id FROM conversa WHERE produto_id = ? AND topico = ?")
    .get(produtoId, topico) as { id: number } | undefined;
  if (existente) return existente.id;
  return Number(
    db
      .prepare("INSERT INTO conversa (produto_id, topico, criada_em) VALUES (?, ?, ?)")
      .run(produtoId, topico, agora()).lastInsertRowid
  );
}

export function mensagensDaConversa(conversaId: number): MensagemConversa[] {
  return db
    .prepare(
      "SELECT id, papel, conteudo, criada_em FROM mensagem_conversa WHERE conversa_id = ? ORDER BY id"
    )
    .all(conversaId) as MensagemConversa[];
}
