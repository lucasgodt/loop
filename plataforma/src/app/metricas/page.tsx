import Link from "next/link";
import {
  apagarMetrica,
  apagarValorMetrica,
  atualizarMetrica,
  criarMetrica,
  medirMetrica,
  registrarValorMetrica,
} from "@/app/actions";
import { Apagar, Editar } from "@/app/ui";
import {
  getFontes,
  getHistoricoMetrica,
  getMetricas,
  getProduto,
  lancamentosDaMetrica,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Metricas({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const produto = getProduto();
  if (!produto) return null;
  const metricas = getMetricas(produto.id);
  const fontes = getFontes(produto.id);

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

      {erro && (
        <div className="card mt-4 border-danger bg-danger-soft/40 text-sm">
          Falha na medição: {erro}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {metricas.map((m) => {
          const historico = getHistoricoMetrica(m.id);
          const leading = lancamentosDaMetrica(m.id);
          const fontePlugada = fontes.find((f) => f.id === m.fonte_dados_id);
          return (
            <section key={m.id} className="card">
              <div className="flex items-baseline justify-between gap-2">
                <div className="lbl">{m.nome}</div>
                <span className="flex gap-1.5">
                  {fontePlugada && (
                    <span className="badge bg-accent-soft text-accent">{fontePlugada.nome}</span>
                  )}
                  <span className="badge bg-line/60 text-muted">lagging</span>
                </span>
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
              {historico.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {historico.map((h) => (
                    <li key={h.id} className="flex items-center justify-between font-mono text-xs text-muted">
                      <span>{h.data} · {h.valor}</span>
                      <Apagar action={apagarValorMetrica} id={h.id} rotulo="×" />
                    </li>
                  ))}
                </ul>
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
              {fontePlugada && m.consulta && (
                <form action={medirMetrica} className="mt-2">
                  <input type="hidden" name="id" value={m.id} />
                  <button className="btn" type="submit">Medir agora via {fontePlugada.nome}</button>
                </form>
              )}
              <div className="mt-3 flex gap-4 border-t border-line pt-2">
                <Editar>
                  <form action={atualizarMetrica} className="grid grid-cols-1 gap-2">
                    <input type="hidden" name="id" value={m.id} />
                    <input name="nome" defaultValue={m.nome} required className="field" />
                    <input name="definicao" defaultValue={m.definicao} className="field" placeholder="definição" />
                    <input name="fonte" defaultValue={m.fonte} className="field" placeholder="fonte (descrição)" />
                    <div className="flex gap-2">
                      <input name="unidade" defaultValue={m.unidade} className="field w-28" placeholder="unidade" />
                      <input name="meta" defaultValue={m.meta} className="field flex-1" placeholder="meta" />
                    </div>
                    <div className="flex gap-2">
                      <select name="fonte_dados_id" defaultValue={m.fonte_dados_id ?? ""} className="field w-auto">
                        <option value="">manual (sem fonte)</option>
                        {fontes.map((f) => (
                          <option key={f.id} value={f.id}>{f.nome}</option>
                        ))}
                      </select>
                      <input
                        name="consulta"
                        defaultValue={m.consulta}
                        className="field flex-1 font-mono text-xs"
                        placeholder="consulta na fonte (ver exemplos em Fontes)"
                      />
                      <button className="btn-ghost" type="submit">Salvar</button>
                    </div>
                  </form>
                </Editar>
                <Apagar action={apagarMetrica} id={m.id} />
              </div>
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
