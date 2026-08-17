/**
 * Contrato de executor de código: a ferramenta que edita os arquivos do repo
 * a partir de uma instrução em linguagem natural. Plugar um executor novo =
 * 1 arquivo + registro em index.ts — mesma filosofia de fontes e agentes.
 *
 * O executor NUNCA commita, NUNCA faz push, NUNCA abre PR — ele só edita
 * arquivos no diretório que recebeu. Todo o git (worktree isolado, branch,
 * commit, push, PR) é do fluxo em scripts/executar-pr.ts, para o guardrail
 * valer por construção independente da ferramenta plugada.
 */
export interface Executor {
  tipo: string;
  rotulo: string;
  descricao: string;
  /** O binário está instalado nesta máquina? */
  disponivel(): boolean;
  /** Edita os arquivos em `dir` conforme as instruções; retorna o log. */
  executar(instrucoes: string, dir: string): Promise<string>;
}

/** Tempo máximo de uma execução de código (ms). */
export const TEMPO_MAXIMO = 20 * 60 * 1000;
