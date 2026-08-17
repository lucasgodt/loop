import { execFileSync, spawnSync } from "node:child_process";
import { TEMPO_MAXIMO, type Executor } from "./types";

/**
 * Claude Code em modo headless: `claude -p` com acceptEdits — pode ler e
 * editar arquivos do diretório, mas não executa comandos arbitrários sem
 * aprovação (que em headless significa: não executa).
 */
export const claudeCode: Executor = {
  tipo: "claude-code",
  rotulo: "Claude Code",
  descricao: "claude -p headless com permissão de edição de arquivos (acceptEdits)",
  disponivel(): boolean {
    try {
      execFileSync("which", ["claude"], { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  },
  async executar(instrucoes: string, dir: string): Promise<string> {
    const r = spawnSync("claude", ["-p", instrucoes, "--permission-mode", "acceptEdits"], {
      cwd: dir,
      encoding: "utf-8",
      timeout: TEMPO_MAXIMO,
      maxBuffer: 32 * 1024 * 1024,
    });
    const saida = `${r.stdout ?? ""}${r.stderr ? `\n[stderr]\n${r.stderr}` : ""}`.trim();
    if (r.error) throw new Error(`claude falhou: ${r.error.message}\n${saida}`);
    if (r.status !== 0) throw new Error(`claude saiu com código ${r.status}:\n${saida}`);
    return saida;
  },
};
