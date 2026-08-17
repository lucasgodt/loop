import { execFileSync, spawnSync } from "node:child_process";
import { TEMPO_MAXIMO, type Executor } from "./types";

/**
 * Codex CLI (OpenAI) em modo não-interativo: `codex exec` com sandbox de
 * escrita restrita ao diretório de trabalho.
 */
export const codex: Executor = {
  tipo: "codex",
  rotulo: "Codex",
  descricao: "codex exec não-interativo com escrita restrita ao diretório do repo",
  disponivel(): boolean {
    try {
      execFileSync("which", ["codex"], { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  },
  async executar(instrucoes: string, dir: string): Promise<string> {
    const r = spawnSync(
      "codex",
      ["exec", "--sandbox", "workspace-write", "--skip-git-repo-check", instrucoes],
      {
        cwd: dir,
        encoding: "utf-8",
        timeout: TEMPO_MAXIMO,
        maxBuffer: 32 * 1024 * 1024,
      }
    );
    const saida = `${r.stdout ?? ""}${r.stderr ? `\n[stderr]\n${r.stderr}` : ""}`.trim();
    if (r.error) throw new Error(`codex falhou: ${r.error.message}\n${saida}`);
    if (r.status !== 0) throw new Error(`codex saiu com código ${r.status}:\n${saida}`);
    return saida;
  },
};
