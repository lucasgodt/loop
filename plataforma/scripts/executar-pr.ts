/**
 * Executa uma tarefa de PR em background (disparada pela action abrirPr):
 *
 *   npx tsx scripts/executar-pr.ts <tarefa_pr.id>
 *
 * Guardrails por construção — valem independente do executor plugado:
 *   1. Trabalha num git worktree NOVO a partir de origin/<branch_base> —
 *      nunca no checkout do dono, nunca com o que estava pendente lá.
 *   2. Branch própria loop/pr-<id>; NUNCA commita nem faz push na base.
 *   3. O executor só edita arquivos; git e PR são deste script.
 *   4. O resultado é um PR — mergear é o ato humano, no GitHub.
 */
import { carregarEnvLocal } from "../src/lib/env";
carregarEnvLocal();

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { agora, db } from "../src/lib/db";
import { getExecutor } from "../src/lib/executores";

interface Tarefa {
  id: number;
  produto_id: number;
  repositorio_id: number;
  titulo: string;
  instrucoes: string;
  status: string;
}
interface Repositorio {
  id: number;
  nome: string;
  caminho_local: string;
  branch_base: string;
  executor: string;
  instrucoes: string;
}

const linhas: string[] = [];
function log(msg: string): void {
  linhas.push(`[${agora()}] ${msg}`);
  console.log(msg);
}

function git(dir: string, ...args: string[]): string {
  return execFileSync("git", ["-C", dir, ...args], {
    encoding: "utf-8",
    maxBuffer: 8 * 1024 * 1024,
  }).trim();
}

async function main(): Promise<number> {
  const id = Number(process.argv[2]);
  const tarefa = db.prepare("SELECT * FROM tarefa_pr WHERE id = ?").get(id) as Tarefa | undefined;
  if (!tarefa) {
    console.error(`tarefa ${id} não existe`);
    return 1;
  }
  if (tarefa.status !== "fila") {
    console.error(`tarefa ${id} está '${tarefa.status}', não 'fila' — nada a fazer`);
    return 1;
  }
  const repo = db
    .prepare("SELECT * FROM repositorio WHERE id = ?")
    .get(tarefa.repositorio_id) as Repositorio | undefined;
  if (!repo) {
    db.prepare("UPDATE tarefa_pr SET status = 'falhou', log = ?, concluida_em = ? WHERE id = ?").run(
      "o repositório configurado não existe mais",
      agora(),
      id
    );
    return 1;
  }

  db.prepare("UPDATE tarefa_pr SET status = 'rodando' WHERE id = ?").run(id);
  const branch = `loop/pr-${id}`;
  const worktree = fs.mkdtempSync(path.join(os.tmpdir(), `loop-pr-${id}-`));
  let falha: string | null = null;
  let prUrl = "";

  try {
    // 1. Base fresca do remoto — sem depender do estado do checkout do dono.
    if (!fs.existsSync(path.join(repo.caminho_local, ".git"))) {
      throw new Error(`${repo.caminho_local} não é um repositório git`);
    }
    log(`atualizando origin/${repo.branch_base} em ${repo.caminho_local}`);
    git(repo.caminho_local, "fetch", "origin", repo.branch_base);

    // 2. Worktree isolado na branch da tarefa.
    fs.rmdirSync(worktree); // git worktree add exige que o destino não exista
    git(repo.caminho_local, "worktree", "add", "-b", branch, worktree, `origin/${repo.branch_base}`);
    log(`worktree em ${worktree}, branch ${branch}`);

    // 3. O executor edita os arquivos — e só isso.
    const executor = getExecutor(repo.executor);
    if (!executor.disponivel()) {
      throw new Error(`executor "${executor.tipo}" não está instalado nesta máquina`);
    }
    const instrucoes = [
      `Tarefa: ${tarefa.titulo}`,
      "",
      tarefa.instrucoes,
      "",
      repo.instrucoes ? `Convenções deste repositório:\n${repo.instrucoes}\n` : "",
      "Regras: edite apenas os arquivos necessários. NÃO rode git (commit/push/branch) — isso é feito depois, fora daqui. NÃO crie arquivos de documentação sobre o que fez.",
    ].join("\n");
    log(`executando ${executor.rotulo}…`);
    const saidaExecutor = await executor.executar(instrucoes, worktree);
    log(`--- saída do executor ---\n${saidaExecutor}\n--- fim da saída ---`);

    // 4. Sem diff, sem PR.
    git(worktree, "add", "-A");
    const diff = git(worktree, "status", "--porcelain");
    if (!diff) throw new Error("o executor não alterou nenhum arquivo — nada para propor");
    log(`arquivos alterados:\n${diff}`);

    // 5. Commit + push da branch da tarefa (nunca da base).
    git(
      worktree,
      "-c", "user.name=Loop.",
      "-c", "user.email=loop@local",
      "commit",
      "-m",
      `${tarefa.titulo}\n\nAberto pelo Loop. — tarefa #${id}. Revise antes de mergear.`
    );
    git(worktree, "push", "-u", "origin", branch);
    log(`push de ${branch} feito`);

    // 6. PR via gh — o corpo carrega o rastro da tarefa.
    const corpo = [
      `## O que é`,
      tarefa.instrucoes,
      "",
      `---`,
      `🤖 PR aberto pelo **Loop.** (tarefa #${id}, executor ${repo.executor}).`,
      `O agente propõe; **mergear é decisão humana** — revise o diff.`,
    ].join("\n");
    prUrl = execFileSync(
      "gh",
      [
        "pr", "create",
        "--title", tarefa.titulo,
        "--body", corpo,
        "--base", repo.branch_base,
        "--head", branch,
      ],
      { cwd: worktree, encoding: "utf-8" }
    ).trim();
    log(`PR aberto: ${prUrl}`);
  } catch (e) {
    falha = e instanceof Error ? e.message : String(e);
    log(`FALHOU: ${falha}`);
  } finally {
    // O worktree é descartável; a branch local também (o push já foi, se houve).
    try {
      git(repo.caminho_local, "worktree", "remove", "--force", worktree);
    } catch {
      fs.rmSync(worktree, { recursive: true, force: true });
    }
    try {
      git(repo.caminho_local, "branch", "-D", branch);
    } catch {
      /* branch pode nem ter sido criada */
    }
  }

  db.prepare(
    "UPDATE tarefa_pr SET status = ?, branch = ?, pr_url = ?, log = ?, concluida_em = ? WHERE id = ?"
  ).run(falha ? "falhou" : "pr_aberto", branch, prUrl, linhas.join("\n"), agora(), id);
  return falha ? 1 : 0;
}

main().then((codigo) => process.exit(codigo));
