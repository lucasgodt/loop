import fs from "node:fs";
import path from "node:path";

/**
 * Carrega .env.local para scripts standalone (tsx). O Next faz isso sozinho
 * para o app; os runners (npm run agentes / atualizar) precisam disto.
 * Variáveis já definidas no ambiente têm precedência.
 */
export function carregarEnvLocal(): void {
  const arquivo = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(arquivo)) return;
  for (const linha of fs.readFileSync(arquivo, "utf-8").split("\n")) {
    const m = linha.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || linha.trim().startsWith("#")) continue;
    const [, chave, valor] = m;
    if (!(chave in process.env) && valor !== "") process.env[chave] = valor;
  }
}
