import { criarMetrica, registrarValorMetrica } from "@/app/actions";
import { getHistoricoMetrica, getMetricas, getProduto } from "@/lib/queries";

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
        Poucas e assumidas. Todo trabalho na plataforma aponta para uma delas — se não
        aponta, é sinal de desalinhamento.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {metricas.map((m) => {
          const historico = getHistoricoMetrica(m.id);
          return (
            <section key={m.id} className="card">
              <div className="lbl">{m.nome}</div>
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
