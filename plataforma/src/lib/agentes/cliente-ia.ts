import type { GerarEstruturado } from "./types";

/**
 * Único ponto de contato da plataforma com o provedor de IA (OpenAI).
 * Trocar de provedor = reescrever este arquivo; nenhum agente muda.
 *
 * Import dinâmico + checagem de chave em runtime: sem OPENAI_API_KEY o app
 * inteiro funciona normalmente — os agentes apenas explicam o que falta.
 */

export function temChaveDeIA(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function modeloConfigurado(): string {
  return process.env.OPENAI_MODEL || "gpt-5.1";
}

/** Modelo barato para triagem/classificação; sem config, cai no padrão. */
export function modeloMini(): string {
  return process.env.OPENAI_MODEL_MINI || modeloConfigurado();
}

/**
 * Chat livre (conselheiros): histórico multi-turno, resposta em texto — e,
 * opcionalmente, ferramentas que o modelo pode chamar quando o PM pedir uma
 * ação (ex.: "preenche o formulário pra mim" → proposta estruturada).
 */
export async function conversar({
  sistema,
  mensagens,
  ferramentas = [],
  modelo: override,
}: {
  sistema: string;
  mensagens: { papel: "user" | "assistant"; conteudo: string }[];
  ferramentas?: { nome: string; descricao: string; schema: Record<string, unknown> }[];
  modelo?: string;
}): Promise<{
  texto: string;
  chamadas: { nome: string; argumentos: Record<string, unknown> }[];
  modelo: string;
  tokensEntrada: number;
  tokensSaida: number;
}> {
  if (!temChaveDeIA()) {
    throw new Error(
      "OPENAI_API_KEY não configurada — adicione ao .env.local da plataforma para usar agentes"
    );
  }
  const { default: OpenAI } = await import("openai");
  const cliente = new OpenAI();
  const modelo = override || modeloConfigurado();

  const resposta = await cliente.chat.completions.create({
    model: modelo,
    messages: [
      { role: "system" as const, content: sistema },
      ...mensagens.map((m) => ({ role: m.papel, content: m.conteudo })),
    ],
    ...(ferramentas.length > 0 && {
      tools: ferramentas.map((f) => ({
        type: "function" as const,
        function: { name: f.nome, description: f.descricao, parameters: f.schema, strict: true },
      })),
    }),
  });

  const msg = resposta.choices[0]?.message;
  const chamadas = (msg?.tool_calls ?? [])
    .filter((t) => t.type === "function")
    .map((t) => ({
      nome: t.function.name,
      argumentos: JSON.parse(t.function.arguments) as Record<string, unknown>,
    }));
  if (!msg?.content && chamadas.length === 0) {
    throw new Error("o modelo não devolveu conteúdo");
  }
  return {
    texto: msg?.content ?? "",
    chamadas,
    modelo,
    tokensEntrada: resposta.usage?.prompt_tokens ?? 0,
    tokensSaida: resposta.usage?.completion_tokens ?? 0,
  };
}

export const gerar: GerarEstruturado = async ({ sistema, usuario, nomeSchema, schema, modelo: override }) => {
  if (!temChaveDeIA()) {
    throw new Error(
      "OPENAI_API_KEY não configurada — adicione ao .env.local da plataforma para usar agentes"
    );
  }
  const { default: OpenAI } = await import("openai");
  const cliente = new OpenAI();
  const modelo = override || modeloConfigurado();

  const resposta = await cliente.chat.completions.create({
    model: modelo,
    messages: [
      { role: "system", content: sistema },
      { role: "user", content: usuario },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: nomeSchema, strict: true, schema },
    },
  });

  const texto = resposta.choices[0]?.message?.content;
  if (!texto) throw new Error("o modelo não devolveu conteúdo");

  return {
    saida: JSON.parse(texto),
    modelo,
    tokensEntrada: resposta.usage?.prompt_tokens ?? 0,
    tokensSaida: resposta.usage?.completion_tokens ?? 0,
  };
};
