import type { Provedor } from "./types";

/**
 * O padrão preferido de métricas da plataforma: PostHog via HogQL.
 * Padronizar a captação no PostHog simplifica tudo — uma fonte, uma linguagem
 * de consulta, e o plano de instrumentação (quais eventos capturar) vira parte
 * da ficha de lançamento. As outras fontes continuam como válvula de escape
 * para o que o PostHog não cobre (receita, histórico antigo no warehouse).
 */
export const posthog: Provedor = {
  tipo: "posthog",
  rotulo: "PostHog (HogQL)",
  descricao:
    "Executa uma consulta HogQL no PostHog e usa a primeira célula do resultado como o valor. A config guarda host, project_id e uma personal API key. É o padrão preferido: métricas de produto viram eventos capturados no PostHog, e a consulta mede em cima deles.",
  configExemplo:
    '{ "host": "https://us.posthog.com", "project_id": "12345", "api_key": "phx_..." }',
  consultaExemplo:
    "SELECT count(DISTINCT person_id) FROM events WHERE event = 'professor_ia_prompt_enviado' AND timestamp > now() - INTERVAL 7 DAY",
  async executar(config, consulta) {
    const cfg = JSON.parse(config) as {
      host?: string;
      project_id: string | number;
      api_key: string;
    };
    if (!cfg.project_id || !cfg.api_key) {
      throw new Error("config do PostHog precisa de project_id e api_key");
    }
    const host = (cfg.host || "https://us.posthog.com").replace(/\/+$/, "");

    const resposta = await fetch(`${host}/api/projects/${cfg.project_id}/query/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.api_key}`,
      },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query: consulta } }),
    });
    if (!resposta.ok) {
      const corpo = await resposta.text();
      throw new Error(`PostHog respondeu ${resposta.status}: ${corpo.slice(0, 200)}`);
    }

    const dados = (await resposta.json()) as { results?: unknown[][] };
    const primeiraCelula = dados.results?.[0]?.[0];
    const valor = Number(primeiraCelula);
    if (!Number.isFinite(valor)) {
      throw new Error(
        `a consulta não devolveu um número na primeira célula (veio: ${JSON.stringify(primeiraCelula)?.slice(0, 80) ?? "nada"})`
      );
    }
    const resumoConsulta = consulta.replace(/\s+/g, " ").slice(0, 90);
    return { valor, detalhe: `via posthog · ${resumoConsulta}` };
  },
};
