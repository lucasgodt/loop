import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Provedor } from "./types";

const exec = promisify(execFile);

/**
 * O provedor mais desacoplado possível: roda qualquer comando no shell e lê o
 * número da última linha da saída. Qualquer coisa que imprime um número no
 * terminal vira fonte — bq, psql, curl+jq, um script Python, uma planilha
 * exportada por csvkit.
 */
export const comando: Provedor = {
  tipo: "comando",
  rotulo: "Comando de terminal",
  descricao:
    "Roda o comando da consulta num shell de login (zsh) e usa a última linha da saída como o valor. Serve para plugar qualquer coisa: BigQuery via bq, SQL via psql, APIs via curl | jq, scripts Python.",
  configExemplo: '{ "cwd": "/pasta/opcional/para/rodar" }',
  consultaExemplo:
    "bq query --use_legacy_sql=false --format=csv 'SELECT COUNT(DISTINCT aluno_id) FROM ...' | tail -1",
  async executar(config, consulta) {
    const cfg = config.trim() ? (JSON.parse(config) as { cwd?: string }) : {};
    const { stdout } = await exec("/bin/zsh", ["-lc", consulta], {
      cwd: cfg.cwd,
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    const linhas = stdout.trim().split("\n").filter((l) => l.trim() !== "");
    const ultima = (linhas[linhas.length - 1] ?? "").trim();
    const valor = Number(ultima.replace(",", "."));
    if (!Number.isFinite(valor)) {
      throw new Error(`o comando não terminou com um número (última linha: "${ultima.slice(0, 120)}")`);
    }
    return { valor, detalhe: `via comando · "${ultima}"` };
  },
};
