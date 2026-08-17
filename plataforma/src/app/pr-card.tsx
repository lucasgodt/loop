import Link from "next/link";
import { abrirPr } from "@/app/actions";
import { getRepositorios, tarefaPrPara, type TarefaPr } from "@/lib/queries";

/**
 * O bloco "via PR" de um alvo (ficha de lançamento ou solução): botão que
 * enfileira a tarefa + card com o estado da mais recente. O PR é a sugestão —
 * mergear é o ato humano, no GitHub.
 */
export function BlocoPr({
  produtoId,
  origemTabela,
  origemId,
  volta,
  rotulo,
  dica,
  habilitado = true,
}: {
  produtoId: number;
  origemTabela: "lancamento" | "solucao";
  origemId: number;
  volta: string;
  rotulo: string;
  dica: string;
  habilitado?: boolean;
}) {
  const repos = getRepositorios(produtoId);
  const tarefa = tarefaPrPara(origemTabela, origemId);
  const viva = tarefa && (tarefa.status === "fila" || tarefa.status === "rodando");

  return (
    <>
      {tarefa && <CardTarefaPr tarefa={tarefa} />}
      {habilitado && repos.length > 0 && !viva && (
        <form action={abrirPr} className="mt-3 flex flex-wrap items-center gap-2">
          <input type="hidden" name="produto_id" value={produtoId} />
          <input type="hidden" name="origem_tabela" value={origemTabela} />
          <input type="hidden" name="origem_id" value={origemId} />
          <input type="hidden" name="volta" value={volta} />
          {repos.length > 1 ? (
            <select name="repositorio_id" className="field w-auto py-1.5 text-sm">
              {repos.map((r) => (
                <option key={r.id} value={r.id}>{r.nome}</option>
              ))}
            </select>
          ) : (
            <input type="hidden" name="repositorio_id" value={repos[0].id} />
          )}
          <button className="btn-ghost" type="submit" title={dica}>{rotulo}</button>
          <span className="text-xs text-muted">
            branch própria + PR — mergear continua sendo decisão sua
          </span>
        </form>
      )}
    </>
  );
}

const TOM_TAREFA: Record<string, string> = {
  fila: "bg-line/60 text-muted",
  rodando: "bg-warn-soft text-warn",
  pr_aberto: "bg-accent-soft text-accent",
  falhou: "bg-danger-soft text-danger",
};

export function CardTarefaPr({ tarefa }: { tarefa: TarefaPr }) {
  return (
    <div className={`card mt-3 ${tarefa.status === "falhou" ? "border-danger" : "border-accent"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">🔧 {tarefa.titulo}</span>
        <span className={`badge ${TOM_TAREFA[tarefa.status] ?? ""}`}>
          {tarefa.status.replace("_", " ")}
        </span>
      </div>
      {tarefa.status === "rodando" && (
        <p className="mt-1 text-xs text-muted">
          o agente está editando o código num worktree isolado — recarregue a página em alguns minutos
        </p>
      )}
      {tarefa.status === "pr_aberto" && tarefa.pr_url && (
        <p className="mt-1 text-sm">
          <a
            href={tarefa.pr_url}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-accent underline"
          >
            revisar o PR no GitHub →
          </a>
          <span className="ml-2 font-mono text-xs text-muted">{tarefa.branch}</span>
        </p>
      )}
      {tarefa.status === "falhou" && tarefa.log && (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs text-danger">ver o log da falha</summary>
          <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-line/30 p-2 font-mono text-[11px] whitespace-pre-wrap">
            {tarefa.log}
          </pre>
        </details>
      )}
    </div>
  );
}

export function ListaTarefasPr({ tarefas }: { tarefas: TarefaPr[] }) {
  if (tarefas.length === 0) return null;
  return (
    <div className="card mt-6 border-accent">
      <div className="lbl">🔧 PRs do agente</div>
      <ul className="mt-1 space-y-1">
        {tarefas.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            {t.pr_url ? (
              <a href={t.pr_url} target="_blank" rel="noreferrer" className="hover:text-accent">
                {t.titulo}
              </a>
            ) : (
              <Link
                href={
                  t.origem_tabela === "lancamento"
                    ? `/lancamentos/${t.origem_id}`
                    : `/solucoes/${t.origem_id}`
                }
                className="hover:text-accent"
              >
                {t.titulo}
              </Link>
            )}
            <span className={`badge ${TOM_TAREFA[t.status] ?? ""}`}>
              {t.status.replace("_", " ")} · {t.repositorio_nome}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
