import { notFound } from "next/navigation";
import { atualizarLancamento, gerarRevisoes, registrarRevisao } from "@/app/actions";
import { diasDeAtraso, getLancamento, getMetricas, getProduto, getRevisoes } from "@/lib/queries";
import { hojeLocal } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function FichaLancamento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lancamento = getLancamento(Number(id));
  const produto = getProduto();
  if (!lancamento || !produto) notFound();
  const metricas = getMetricas(produto.id);
  const revisoes = getRevisoes(lancamento.id);

  return (
    <div>
      <div className="eyebrow">ficha de lançamento</div>
      <h1 className="display mt-1 text-4xl font-medium">{lancamento.nome}</h1>

      <form action={atualizarLancamento} className="card mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <input type="hidden" name="id" value={lancamento.id} />
        <div>
          <label className="lbl" htmlFor="nome">Nome</label>
          <input id="nome" name="nome" defaultValue={lancamento.nome} required className="field" />
        </div>
        <div>
          <label className="lbl" htmlFor="data_lancamento">Data de lançamento</label>
          <input
            id="data_lancamento"
            name="data_lancamento"
            type="date"
            defaultValue={lancamento.data_lancamento ?? ""}
            className="field"
          />
        </div>
        <div className="md:col-span-2">
          <label className="lbl" htmlFor="hipotese">Hipótese</label>
          <textarea
            id="hipotese"
            name="hipotese"
            rows={2}
            defaultValue={lancamento.hipotese}
            className="field"
            placeholder="Acreditamos que [mudança] vai causar [efeito] em [público], porque [razão]"
          />
        </div>
        <div>
          <label className="lbl" htmlFor="metrica_primaria">Métrica primária (uma só)</label>
          <input
            id="metrica_primaria"
            name="metrica_primaria"
            defaultValue={lancamento.metrica_primaria}
            className="field"
            placeholder="Se tem duas, ainda não decidiu o que é sucesso"
          />
        </div>
        <div>
          <label className="lbl" htmlFor="metrica_negocio_id">Métrica de negócio que move</label>
          <select
            id="metrica_negocio_id"
            name="metrica_negocio_id"
            defaultValue={lancamento.metrica_negocio_id ?? ""}
            className="field"
          >
            <option value="">—</option>
            {metricas.map((m) => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="lbl" htmlFor="baseline">Baseline (antes)</label>
          <input id="baseline" name="baseline" defaultValue={lancamento.baseline} className="field" />
        </div>
        <div>
          <label className="lbl" htmlFor="meta">Meta (valor + prazo)</label>
          <input id="meta" name="meta" defaultValue={lancamento.meta} className="field" />
        </div>
        <div className="md:col-span-2">
          <label className="lbl" htmlFor="guardrails">Guardrails (o que não pode piorar)</label>
          <input id="guardrails" name="guardrails" defaultValue={lancamento.guardrails} className="field" />
        </div>
        <div className="md:col-span-2">
          <label className="lbl" htmlFor="fonte_dados">Fonte de dados / query</label>
          <textarea
            id="fonte_dados"
            name="fonte_dados"
            rows={3}
            defaultValue={lancamento.fonte_dados}
            className="field font-mono text-xs"
            placeholder="Se não dá para escrever como medir, a métrica ainda não é mensurável"
          />
        </div>
        <div className="md:col-span-2">
          <label className="lbl" htmlFor="notas">Notas</label>
          <textarea id="notas" name="notas" rows={2} defaultValue={lancamento.notas} className="field" />
        </div>
        <div>
          <label className="lbl" htmlFor="veredito">Veredito</label>
          <select id="veredito" name="veredito" defaultValue={lancamento.veredito ?? ""} className="field">
            <option value="">— em aberto —</option>
            <option value="sucesso">sucesso</option>
            <option value="fracasso">fracasso</option>
            <option value="inconclusivo">inconclusivo</option>
          </select>
        </div>
        <div>
          <label className="lbl" htmlFor="aprendizado">Aprendizado</label>
          <input
            id="aprendizado"
            name="aprendizado"
            defaultValue={lancamento.aprendizado}
            className="field"
            placeholder="A única seção que sobrevive — escreva para daqui a um ano"
          />
        </div>
        <div className="md:col-span-2 flex justify-end">
          <button className="btn" type="submit">Salvar ficha</button>
        </div>
      </form>

      <section className="mt-8">
        <h2 className="lbl">Revisões</h2>
        {revisoes.length === 0 ? (
          <div className="card flex items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {lancamento.data_lancamento
                ? "Sem revisões agendadas ainda."
                : "Defina a data de lançamento acima para agendar as revisões de 30/60/90 dias."}
            </p>
            {lancamento.data_lancamento && (
              <form action={gerarRevisoes}>
                <input type="hidden" name="id" value={lancamento.id} />
                <button className="btn" type="submit">Agendar 30/60/90</button>
              </form>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {revisoes.map((r) => (
              <li key={r.id} className="card py-3">
                {r.data_realizada ? (
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold">{r.rotulo}</span>
                    <span className="font-mono text-sm">
                      {r.valor_observado || "—"}
                      <span className="ml-2 text-xs text-muted">em {r.data_realizada}</span>
                    </span>
                    {r.notas && <p className="w-full text-xs text-muted">{r.notas}</p>}
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{r.rotulo}</span>
                      <span
                        className={`badge ${
                          r.data_prevista < hojeLocal()
                            ? "bg-warn-soft text-warn"
                            : "bg-line/60 text-muted"
                        }`}
                      >
                        {r.data_prevista < hojeLocal()
                          ? `atrasada há ${diasDeAtraso(r.data_prevista)}d`
                          : `prevista ${r.data_prevista}`}
                      </span>
                    </div>
                    <form action={registrarRevisao} className="mt-2 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={r.id} />
                      <div>
                        <label className="lbl" htmlFor={`v${r.id}`}>Valor observado</label>
                        <input id={`v${r.id}`} name="valor_observado" className="field w-36" />
                      </div>
                      <div>
                        <label className="lbl" htmlFor={`d${r.id}`}>Data</label>
                        <input id={`d${r.id}`} name="data_realizada" type="date" className="field" />
                      </div>
                      <div className="min-w-40 flex-1">
                        <label className="lbl" htmlFor={`n${r.id}`}>Notas</label>
                        <input id={`n${r.id}`} name="notas" className="field" />
                      </div>
                      <button className="btn-ghost" type="submit">Registrar</button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
