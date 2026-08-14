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

export const gerar: GerarEstruturado = async ({ sistema, usuario, nomeSchema, schema }) => {
  if (!temChaveDeIA()) {
    throw new Error(
      "OPENAI_API_KEY não configurada — adicione ao .env.local da plataforma para usar agentes"
    );
  }
  const { default: OpenAI } = await import("openai");
  const cliente = new OpenAI();
  const modelo = modeloConfigurado();

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
