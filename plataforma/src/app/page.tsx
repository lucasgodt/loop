import Link from "next/link";
import { LoopStrip } from "./loop-strip";
import {
  altoRiscoSemTeste,
  diasDeAtraso,
  dividasDeMedicao,
  entrevistasNaSemana,
  getMetricas,
  getProduto,
  LIMITE_WIP,
  oportunidadesEmDiscovery,
  proximasRevisoes,
  revisoesAtrasadas,
  sinaisNovos,
  sugestoesPendentes,
  testesAbertos,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

const fmtData = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export default function Home() {
  const produto = getProduto();
  if (!produto) {
    return (
      <div className="card mt-20 text-center">
        <h1 className="display text-2xl">Nenhum workspace ainda.</h1>
        <p className="mt-2 text-sm text-muted">
          Rode <code className="font-mono">npm run seed</code> para criar o workspace Mooney.
        </p>
      </div>
    );
  }

  const entrevistas = entrevistasNaSemana(produto.id);
  const sinais = sinaisNovos(produto.id);
  const discovery = oportunidadesEmDiscovery(produto.id);
  const dividas = dividasDeMedicao(produto.id);
  const atrasadas = revisoesAtrasadas(produto.id);
  const proximas = proximasRevisoes(produto.id);
  const metricas = getMetricas(produto.id);
  const sugestoes = sugestoesPendentes(produto.id);
  const metaSemanal = 1;

  return (
    <div>
      <div className="eyebrow">
        {produto.nome} · {fmtData.format(new Date())}
      </div>
      <h1 className="display mt-1 text-5xl font-medium">O que fazer agora.</h1>
      <LoopStrip />

      {sugestoes.length > 0 && (
        <div className="card mt-6 border-accent">
          <div className="lbl">🤖 Sugestões do agente aguardando: {sugestoes.length}</div>
          <ul className="mt-1 space-y-1">
            {sugestoes.map((s) => (
              <li key={s.id} className="text-sm">
                <Link
                  href={
                    s.alvo_tabela === "lancamento" && s.alvo_id
                      ? `/lancamentos/${s.alvo_id}`
                      : s.tipo.startsWith("sinal_")
                        ? "/sinais"
                        : "/"
                  }
                  className="hover:text-accent"
                >
                  {s.resumo}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Passo 3 do loop: cadência de entrevistas */}
        <section className="card flex flex-col">
          <div className="lbl">Entrevistas da semana</div>
          <div
            className={`font-mono text-6xl tabular-nums ${
              entrevistas >= metaSemanal ? "text-accent" : "text-ink"
            }`}
          >
            {entrevistas}
            <span className="text-2xl text-muted">/{metaSemanal}</span>
          </div>
          <p className="mt-2 flex-1 text-sm text-muted">
            {entrevistas >= metaSemanal
              ? "Cadência mantida. A próxima história pode esperar a semana que vem."
              : "Nenhuma história ouvida ainda esta semana."}
          </p>
          <Link href="/entrevistas" className="btn mt-4 self-start">
            Registrar entrevista
          </Link>
        </section>

        {/* Passo 3 do loop: inbox de sinais */}
        <section className="card flex flex-col">
          <div className="lbl">Sinais no inbox</div>
          <div
            className={`font-mono text-6xl tabular-nums ${
              sinais > 0 ? "text-warn" : "text-accent"
            }`}
          >
            {sinais}
          </div>
          <p className="mt-2 flex-1 text-sm text-muted">
            {sinais > 0
              ? "Sinais esperando triagem: promova a oportunidade ou arquive."
              : "Inbox limpo. Capture o que ouvir do CS e das escolas."}
          </p>
          <Link href="/sinais" className="btn-ghost mt-4 self-start">
            {sinais > 0 ? "Triar sinais" : "Capturar sinal"}
          </Link>
        </section>

        {/* Passo 1 do loop: métricas de negócio */}
        <section className="card">
          <div className="lbl">Métricas de negócio</div>
          <ul className="mt-1 divide-y divide-line">
            {metricas.map((m) => (
              <li key={m.id} className="flex items-baseline justify-between gap-2 py-2">
                <span className="text-sm">{m.nome}</span>
                <span className="font-mono text-sm tabular-nums text-muted">
                  {m.valor_atual ?? "—"}
                </span>
              </li>
            ))}
            {metricas.length === 0 && (
              <li className="py-2 text-sm text-muted">Nenhuma métrica definida.</li>
            )}
          </ul>
          <Link href="/metricas" className="btn-ghost mt-3">
            Ver métricas
          </Link>
        </section>

        {/* Passos 4–8 do loop: discovery em andamento */}
        <section className="card md:col-span-3 lg:col-span-1">
          <div className="lbl">
            Em discovery · {discovery.length}/{LIMITE_WIP}
          </div>
          {discovery.length === 0 ? (
            <p className="mt-1 text-sm text-muted">
              Nenhuma oportunidade em discovery. Suba um sinal ou uma entrevista para a
              árvore e priorize a próxima.
            </p>
          ) : (
            <ul className="mt-1 space-y-3">
              {discovery.map((o) => {
                const arriscadas = altoRiscoSemTeste(o.id);
                const abertos = testesAbertos(o.id);
                return (
                  <li key={o.id}>
                    <Link
                      href={`/oportunidades/${o.id}`}
                      className="text-sm font-semibold hover:text-accent"
                    >
                      {o.titulo}
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span
                        className={`badge ${
                          o.solucoes >= 3
                            ? "bg-accent-soft text-accent"
                            : "bg-warn-soft text-warn"
                        }`}
                      >
                        soluções {o.solucoes}/3
                      </span>
                      {o.evidencias === 0 && (
                        <span className="badge bg-danger-soft text-danger">sem evidência</span>
                      )}
                      {arriscadas > 0 && (
                        <span className="badge bg-danger-soft text-danger">
                          {arriscadas} risco{arriscadas > 1 ? "s" : ""} sem teste
                        </span>
                      )}
                      {abertos > 0 && (
                        <span className="badge bg-warn-soft text-warn">
                          {abertos} teste{abertos > 1 ? "s" : ""} em aberto
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Link href="/priorizacao" className="btn-ghost mt-3">
            Priorização
          </Link>
        </section>

        {/* Passo 10 do loop: dívida de medição e revisões */}
        <section className="card md:col-span-3 lg:col-span-2">
          <div className="lbl">Medição de lançamentos</div>
          {dividas.length === 0 && atrasadas.length === 0 && proximas.length === 0 ? (
            <p className="mt-1 text-sm text-muted">
              Nenhuma pendência. Todo lançamento com métrica, revisões em dia.
            </p>
          ) : (
            <ul className="mt-1 divide-y divide-line">
              {atrasadas.map((r) => (
                <li key={`r${r.id}`} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <div className="text-sm font-semibold">{r.lancamento_nome}</div>
                    <div className="text-xs text-muted">revisão de {r.rotulo}</div>
                  </div>
                  <span className="badge bg-warn-soft text-warn">
                    atrasada há {diasDeAtraso(r.data_prevista)}d
                  </span>
                </li>
              ))}
              {dividas.map(({ lancamento, pendencias }) => (
                <li key={`l${lancamento.id}`} className="flex items-center justify-between gap-3 py-2.5">
                  <Link
                    href={`/lancamentos/${lancamento.id}`}
                    className="text-sm font-semibold hover:text-accent"
                  >
                    {lancamento.nome}
                  </Link>
                  <span className="badge bg-danger-soft text-danger">
                    {pendencias[0]}
                    {pendencias.length > 1 ? ` +${pendencias.length - 1}` : ""}
                  </span>
                </li>
              ))}
              {proximas.map((r) => (
                <li key={`p${r.id}`} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <div className="text-sm font-semibold">{r.lancamento_nome}</div>
                    <div className="text-xs text-muted">revisão de {r.rotulo}</div>
                  </div>
                  <span className="badge bg-accent-soft text-accent">em {r.data_prevista}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/lancamentos" className="btn-ghost mt-3">
            Ver lançamentos
          </Link>
        </section>
      </div>
    </div>
  );
}
