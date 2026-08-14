import type { Provedor } from "./types";

/**
 * GET numa URL que responde JSON; extrai o número por um caminho de pontos.
 * A consulta é "URL caminho.no.json" (caminho opcional se a resposta já for
 * o número).
 */
export const http: Provedor = {
  tipo: "http",
  rotulo: "HTTP (JSON)",
  descricao:
    "Faz GET na URL da consulta e extrai o valor pelo caminho de pontos após o espaço (ex.: data.wau). Headers de autenticação vão na config da fonte.",
  configExemplo: '{ "headers": { "Authorization": "Bearer SEU_TOKEN" } }',
  consultaExemplo: "https://api.exemplo.com/relatorio/wau data.valor",
  async executar(config, consulta) {
    const cfg = config.trim()
      ? (JSON.parse(config) as { headers?: Record<string, string> })
      : {};
    const texto = consulta.trim();
    const separador = texto.search(/\s/);
    const url = separador === -1 ? texto : texto.slice(0, separador);
    const caminho = separador === -1 ? "" : texto.slice(separador).trim();

    const resposta = await fetch(url, { headers: cfg.headers });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status} em ${url}`);
    const corpo: unknown = await resposta.json();

    let atual: unknown = corpo;
    if (caminho) {
      for (const parte of caminho.split(".")) {
        atual = (atual as Record<string, unknown> | null)?.[parte];
      }
    }
    const valor = Number(atual);
    if (!Number.isFinite(valor)) {
      throw new Error(`caminho "${caminho || "(raiz)"}" não resolveu para um número`);
    }
    return { valor, detalhe: `via http · ${url}${caminho ? ` · ${caminho}` : ""}` };
  },
};
