import Link from "next/link";
import { criarMetrica, registrarValorMetrica } from "@/app/actions";
import {
  getHistoricoMetrica,
  getMetricas,
  getProduto,
  lancamentosDaMetrica,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function Metricas() {
  const produto = getProduto();
  if (!produto) return null;
  const metricas = getMetricas(produto.id);

  return (
    <div>
      <div className="eyebrow">passo 1 do loop · onde tudo começa e termina</div>
      <h1 className="display mt-1 text-4xl font-medium">Métricas de negócio</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Poucas e assumidas. Estas são as <strong>lagging indicators</strong> — demoram a
        se mover e não se movem direto. O que as move são as métricas primárias dos
        lançamentos (<strong>leading</strong>), que apontam para cá. Todo trabalho na
        plataforma termina numa métrica desta página.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {metricas.map((m) => {
          const historico = getHistoricoMetrica(m.id);
          const leading = lancamentosDaMetrica(m.id);
          return (
            <section key={m.id} className="card">
              <div className="flex items-baseline justify-between gap-2">
                <div className="lbl">{m.nome}</div>
                <span className="badge bg-line/60 text-muted">lagging</span>
              </div>
              <div className="font-mono text-5xl tabular-nums">
                {m.valor_atual ?? "—"}
                {m.unidade && m.valor_atual != null && (
                  <span className="ml-1 text-base text-muted">{m.unidade}</span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted">
                {m.valor_atual == null
                  ? "sem valor registrado"
                  : `atualizado em ${m.atualizado_em}`}
                {m.meta && ` · meta: ${m.meta}`}
              </p>
              {m.definicao && <p className="mt-2 text-sm">{m.definicao}</p>}
              {m.fonte && (
                <p className="mt-1 font-mono text-xs text-muted">{m.fonte}</p>
              )}
              {historico.length > 1 && (
                <p className="mt-2 font-mono text-xs text-muted">
                  histórico: {historico.map((h) => h.valor).join(" → ")}
                </p>
              )}
              <div className="mt-3 border-t border-line pt-2">
                <div className="lbl">Leading apontando para cá</div>
                {leading.length === 0 ? (
                  <p className="text-xs text-muted">
                    Nenhum lançamento aponta para esta métrica ainda.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {leading.map((l) => (
                      <li key={l.id} className="text-xs">
                        <Link href={`/lancamentos/${l.id}`} className="font-semibold hover:text-accent">
                          {l.nome}
                        </Link>
                        {l.metrica_primaria && (
                          <span className="text-muted"> — {l.metrica_primaria}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <form action={registrarValorMetrica} className="mt-3 flex items-end gap-2">
                <input type="hidden" name="metrica_id" value={m.id} />
                <div>
                  <label className="lbl" htmlFor={`valor${m.id}`}>Registrar valor</label>
                  <input
                    id={`valor${m.id}`}
                    name="valor"
                    type="number"
                    step="any"
                    required
                    className="field w-32"
                  />
                </div>
                <div>
                  <label className="lbl" htmlFor={`data${m.id}`}>Data</label>
                  <input id={`data${m.id}`} name="data" type="date" className="field" />
                </div>
                <button className="btn-ghost" type="submit">OK</button>
              </form>
            </section>
          );
        })}
      </div>

      <form action={criarMetrica} className="card mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <input type="hidden" name="produto_id" value={produto.id} />
        <div className="md:col-span-2">
          <h2 className="lbl">Nova métrica de negócio</h2>
        </div>
        <div>
          <label className="lbl" htmlFor="nome">Nome</label>
          <input id="nome" name="nome" required className="field" />
        </div>
        <div>
          <label className="lbl" htmlFor="unidade">Unidade</label>
          <input id="unidade" name="unidade" className="field" placeholder="alunos, %, R$…" />
        </div>
        <div className="md:col-span-2">
          <label className="lbl" htmlFor="definicao">Definição (uma frase)</label>
          <input id="definicao" name="definicao" className="field" />
        </div>
        <div>
          <label className="lbl" htmlFor="fonte">Fonte (query, planilha, API)</label>
          <input id="fonte" name="fonte" className="field" />
        </div>
        <div>
          <label className="lbl" htmlFor="meta">Meta</label>
          <input id="meta" name="meta" className="field" />
        </div>
        <div className="md:col-span-2 flex justify-end">
          <button className="btn" type="submit">Criar métrica</button>
        </div>
      </form>
    </div>
  );
}
