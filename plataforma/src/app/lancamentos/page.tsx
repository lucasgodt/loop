import Link from "next/link";
import { apagarLancamento, criarLancamento } from "@/app/actions";
import { Apagar } from "@/app/ui";
import { dividasDeMedicao, getLancamentos, getProduto, getRevisoes } from "@/lib/queries";

export const dynamic = "force-dynamic";

const TOM_VEREDITO: Record<string, string> = {
  sucesso: "bg-accent-soft text-accent",
  fracasso: "bg-danger-soft text-danger",
  inconclusivo: "bg-warn-soft text-warn",
};

export default function Lancamentos() {
  const produto = getProduto();
  if (!produto) return null;
  const lancamentos = getLancamentos(produto.id);
  const dividas = new Map(
    dividasDeMedicao(produto.id).map((d) => [d.lancamento.id, d.pendencias])
  );

  return (
    <div>
      <div className="eyebrow">passo 10 do loop · mensuração de impacto</div>
      <h1 className="display mt-1 text-4xl font-medium">Lançamentos</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Um lançamento sem veredito é um lançamento que ainda não terminou. Aqui mora a
        regra: nada sai sem métrica de sucesso definida.
      </p>

      <form action={criarLancamento} className="card mt-6 flex flex-wrap items-end gap-3">
        <input type="hidden" name="produto_id" value={produto.id} />
        <div className="min-w-64 flex-1">
          <label className="lbl" htmlFor="nome">Novo lançamento</label>
          <input id="nome" name="nome" required className="field" placeholder="Nome da feature lançada (ou por lançar)" />
        </div>
        <div>
          <label className="lbl" htmlFor="data_lancamento">Data</label>
          <input id="data_lancamento" name="data_lancamento" type="date" className="field" />
        </div>
        <button className="btn" type="submit">Criar ficha</button>
      </form>

      <ul className="mt-6 space-y-3">
        {lancamentos.map((l) => {
          const pendencias = dividas.get(l.id) ?? [];
          const revisoes = getRevisoes(l.id);
          const feitas = revisoes.filter((r) => r.data_realizada).length;
          return (
            <li key={l.id} className="card transition hover:border-accent">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/lancamentos/${l.id}`} className="font-semibold hover:text-accent">
                  {l.nome}
                </Link>
                <div className="flex flex-wrap items-center gap-1.5">
                  {l.veredito ? (
                    <span className={`badge ${TOM_VEREDITO[l.veredito]}`}>{l.veredito}</span>
                  ) : pendencias.length > 0 ? (
                    pendencias.map((p) => (
                      <span key={p} className="badge bg-danger-soft text-danger">{p}</span>
                    ))
                  ) : (
                    <span className="badge bg-accent-soft text-accent">
                      em medição · revisões {feitas}/{revisoes.length || "—"}
                    </span>
                  )}
                  <Apagar action={apagarLancamento} id={l.id} />
                </div>
              </div>
              <Link href={`/lancamentos/${l.id}`} className="mt-1 block font-mono text-xs text-muted hover:text-accent">
                {l.data_lancamento ? `lançado em ${l.data_lancamento}` : "sem data de lançamento"}
                {l.metrica_primaria ? ` · ${l.metrica_primaria}` : ""}
                {" · abrir ficha →"}
              </Link>
            </li>
          );
        })}
        {lancamentos.length === 0 && (
          <li className="card text-sm text-muted">Nenhum lançamento registrado.</li>
        )}
      </ul>
    </div>
  );
}
