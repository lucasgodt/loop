import Link from "next/link";
import { notFound } from "next/navigation";
import {
  criarSolucao,
  ligarEvidencia,
  mudarEstadoOportunidade,
  salvarAvaliacao,
} from "@/app/actions";
import {
  getAvaliacao,
  getEntrevistas,
  getEvidencias,
  getOportunidade,
  getProduto,
  getSinais,
  getSolucoes,
  LIMITE_WIP,
  scoreTotal,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

const ESTADOS = ["identificada", "priorizada", "em_discovery", "resolvida", "arquivada"];

const CRITERIOS = [
  { campo: "tamanho", justif: "tamanho_justif", rotulo: "Tamanho", dica: "Quantos clientes são afetados? Com que frequência?" },
  { campo: "companhia", justif: "companhia_justif", rotulo: "Companhia", dica: "Suporta a visão e os objetivos estratégicos?" },
  { campo: "mercado", justif: "mercado_justif", rotulo: "Mercado", dica: "Table stake ou diferencial? Como nos posiciona?" },
  { campo: "cliente", justif: "cliente_justif", rotulo: "Cliente", dica: "O quanto é relevante para quem vive a dor?" },
] as const;

const TOM_SOLUCAO: Record<string, string> = {
  ideia: "bg-line/60 text-muted",
  em_teste: "bg-warn-soft text-warn",
  em_desenvolvimento: "bg-warn-soft text-warn",
  lancada: "bg-accent-soft text-accent",
  descartada: "bg-line/60 text-muted",
};

export default async function DetalheOportunidade({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  const o = getOportunidade(Number(id));
  const produto = getProduto();
  if (!o || !produto) notFound();

  const aval = getAvaliacao(o.id);
  const total = scoreTotal(aval);
  const evidencias = getEvidencias(o.id);
  const solucoes = getSolucoes(o.id);
  const entrevistas = getEntrevistas(produto.id);
  const sinaisNovos = getSinais(produto.id, "novo");

  return (
    <div>
      <div className="eyebrow">
        oportunidade · {o.persona_nome ?? "sem persona"}
        {o.passo_titulo ? ` · ${o.passo_titulo}` : ""}
      </div>
      <h1 className="display mt-1 text-4xl font-medium">{o.titulo}</h1>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form action={mudarEstadoOportunidade} className="flex items-center gap-1.5">
          <input type="hidden" name="id" value={o.id} />
          <input type="hidden" name="origem" value={`/oportunidades/${o.id}`} />
          <select name="estado" defaultValue={o.estado} className="field w-auto py-1.5 text-sm">
            {ESTADOS.map((e) => (
              <option key={e} value={e}>{e.replace("_", " ")}</option>
            ))}
          </select>
          <button className="btn-ghost" type="submit">mover</button>
        </form>
        {total != null && (
          <span className="badge bg-accent-soft text-accent">score {total}/20</span>
        )}
      </div>

      {erro === "wip" && (
        <div className="card mt-4 border-danger bg-danger-soft/40 text-sm">
          Limite de WIP atingido ({LIMITE_WIP} em discovery). Resolva ou arquive uma antes
          de puxar esta.
        </div>
      )}
      {erro === "avaliacao" && (
        <div className="card mt-4 border-danger bg-danger-soft/40 text-sm">
          Preencha a avaliação abaixo (as 4 notas) antes de mover para discovery.
        </div>
      )}

      <section className="mt-8">
        <h2 className="lbl">Avaliação de priorização</h2>
        <form action={salvarAvaliacao} className="card grid grid-cols-1 gap-4 md:grid-cols-2">
          <input type="hidden" name="oportunidade_id" value={o.id} />
          {CRITERIOS.map((c) => (
            <div key={c.campo}>
              <label className="lbl" htmlFor={c.campo}>
                {c.rotulo} <span className="normal-case tracking-normal">— {c.dica}</span>
              </label>
              <div className="flex gap-2">
                <select
                  id={c.campo}
                  name={c.campo}
                  defaultValue={aval?.[c.campo] ?? ""}
                  className="field w-20"
                >
                  <option value="">·</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <input
                  name={c.justif}
                  defaultValue={aval?.[c.justif] ?? ""}
                  className="field flex-1"
                  placeholder="por quê?"
                />
              </div>
            </div>
          ))}
          <div className="md:col-span-2">
            <label className="lbl" htmlFor="decisao">Decisão registrada</label>
            <textarea
              id="decisao"
              name="decisao"
              rows={2}
              defaultValue={aval?.decisao ?? ""}
              className="field"
              placeholder={'"Escolhemos esta em vez de X e Y porque…"'}
            />
          </div>
          <div className="md:col-span-2 flex items-center justify-between">
            <Link href="/priorizacao" className="text-xs text-muted underline">
              comparar com as irmãs na priorização →
            </Link>
            <button className="btn" type="submit">Salvar avaliação</button>
          </div>
        </form>
      </section>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <section>
          <h2 className="lbl">Evidências ({evidencias.length})</h2>
          <div className="card">
            {evidencias.length === 0 ? (
              <p className="mb-3 text-sm text-danger">
                Sem evidência — por enquanto isto é um palpite.
              </p>
            ) : (
              <ul className="mb-3 space-y-2">
                {evidencias.map((ev) => (
                  <li key={ev.id} className="text-sm">
                    <span className="badge mr-2 bg-line/60 text-muted">{ev.tipo}</span>
                    {ev.descricao}
                    <span className="ml-1 font-mono text-xs text-muted">{ev.data}</span>
                  </li>
                ))}
              </ul>
            )}
            <form action={ligarEvidencia} className="space-y-2 border-t border-line pt-3">
              <input type="hidden" name="oportunidade_id" value={o.id} />
              <div className="lbl">Ligar evidência</div>
              <select name="entrevista_id" className="field">
                <option value="">entrevista…</option>
                {entrevistas.map((e) => (
                  <option key={e.id} value={e.id}>{e.data} · {e.entrevistado}</option>
                ))}
              </select>
              <select name="sinal_id" className="field">
                <option value="">sinal…</option>
                {sinaisNovos.map((s) => (
                  <option key={s.id} value={s.id}>{s.canal} · {s.conteudo.slice(0, 50)}</option>
                ))}
              </select>
              <button className="btn-ghost" type="submit">Ligar</button>
            </form>
          </div>
        </section>

        <section>
          <h2 className="lbl">Soluções ({solucoes.length}/3 mínimas)</h2>
          <div className="card">
            {solucoes.length > 0 && (
              <ul className="mb-3 space-y-2">
                {solucoes.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <Link
                      href={`/solucoes/${s.id}`}
                      className="text-sm font-semibold hover:text-accent"
                    >
                      {s.titulo}
                    </Link>
                    <span className={`badge ${TOM_SOLUCAO[s.estado] ?? "bg-line/60 text-muted"}`}>
                      {s.estado.replace(/_/g, " ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {solucoes.length < 3 && (
              <p className="mb-3 text-sm text-muted">
                {solucoes.length === 0
                  ? "Nenhuma ideia ainda. A primeira raramente é a melhor — por isso o mínimo é 3."
                  : `Faltam ${3 - solucoes.length} para destravar o mapeamento de suposições.`}
              </p>
            )}
            <form action={criarSolucao} className="flex gap-2 border-t border-line pt-3">
              <input type="hidden" name="produto_id" value={produto.id} />
              <input type="hidden" name="oportunidade_id" value={o.id} />
              <input
                name="titulo"
                required
                className="field flex-1"
                placeholder={`Ideia de solução ${solucoes.length + 1}`}
              />
              <button className="btn-ghost" type="submit">+ solução</button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
