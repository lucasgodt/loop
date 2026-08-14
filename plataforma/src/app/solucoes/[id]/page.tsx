import Link from "next/link";
import { notFound } from "next/navigation";
import {
  concluirTeste,
  criarPassoStoryMap,
  criarSuposicao,
  criarTeste,
  mudarEstadoSolucao,
} from "@/app/actions";
import {
  altoRisco,
  getPassosStoryMap,
  getSolucao,
  getSuposicoes,
  getTestes,
  lancamentoDaSolucao,
  riscoDaSuposicao,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

const ESTADOS_SOLUCAO = ["ideia", "em_teste", "em_desenvolvimento", "lancada", "descartada"];

const LENTES: Record<string, string> = {
  desejavel: "Desejável — alguém quer isso?",
  viavel: "Viável — devemos construir?",
  factivel: "Factível — conseguimos construir?",
  usavel: "Usável — conseguem usar?",
  etica: "Ética — pode causar dano?",
};

const METODOS = ["Entrevista direcionada", "Protótipo", "Fake door", "Dados históricos", "Outro"];

const TOM_SUPOSICAO: Record<string, string> = {
  mapeada: "bg-line/60 text-muted",
  em_teste: "bg-warn-soft text-warn",
  validada: "bg-accent-soft text-accent",
  refutada: "bg-danger-soft text-danger",
};

export default async function DetalheSolucao({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  const s = getSolucao(Number(id));
  if (!s) notFound();

  const bloqueada = s.oportunidade_id != null && s.solucoes_irmas < 3;
  const passos = getPassosStoryMap(s.id);
  const suposicoes = getSuposicoes(s.id);
  const ficha = lancamentoDaSolucao(s.id);
  const arriscadasSemTeste = suposicoes.filter((su) => altoRisco(su) && su.estado === "mapeada");

  return (
    <div>
      <div className="eyebrow">
        solução{" "}
        {s.oportunidade_id && (
          <>
            · para{" "}
            <Link href={`/oportunidades/${s.oportunidade_id}`} className="underline">
              {s.oportunidade_titulo}
            </Link>
          </>
        )}
      </div>
      <h1 className="display mt-1 text-4xl font-medium">{s.titulo}</h1>
      {s.descricao && <p className="mt-2 max-w-xl text-sm text-muted">{s.descricao}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form action={mudarEstadoSolucao} className="flex items-center gap-1.5">
          <input type="hidden" name="id" value={s.id} />
          <input type="hidden" name="origem" value={`/solucoes/${s.id}`} />
          <select name="estado" defaultValue={s.estado} className="field w-auto py-1.5 text-sm">
            {ESTADOS_SOLUCAO.map((e) => (
              <option key={e} value={e}>{e.replace(/_/g, " ")}</option>
            ))}
          </select>
          <button className="btn-ghost" type="submit">mover</button>
        </form>
        {ficha ? (
          <Link href={`/lancamentos/${ficha.id}`} className="badge bg-accent-soft text-accent">
            ficha de lançamento →
          </Link>
        ) : (
          <span className="badge bg-line/60 text-muted">sem ficha de lançamento</span>
        )}
      </div>

      {erro === "sem_ficha" && (
        <div className="card mt-4 border-danger bg-danger-soft/40 text-sm">
          Solução só é marcada como <strong>lançada</strong> com ficha de lançamento
          preenchida — é a regra que impede lançar sem métrica.{" "}
          <Link href="/lancamentos" className="font-semibold text-danger underline">
            Criar a ficha →
          </Link>
        </div>
      )}
      {s.estado === "em_desenvolvimento" && arriscadasSemTeste.length > 0 && (
        <div className="card mt-4 border-warn bg-warn-soft/40 text-sm">
          Em desenvolvimento com {arriscadasSemTeste.length} suposição
          {arriscadasSemTeste.length > 1 ? "ões" : ""} de alto risco sem teste — o mais
          barato de descobrir que estava errado já passou.
        </div>
      )}

      {bloqueada ? (
        <div className="card mt-6 border-warn bg-warn-soft/40">
          <div className="lbl">Mapeamento de suposições bloqueado</div>
          <p className="text-sm">
            A oportunidade tem <strong className="font-mono">{s.solucoes_irmas}/3</strong>{" "}
            soluções. A primeira ideia raramente é a melhor — gere mais{" "}
            {3 - s.solucoes_irmas} antes de aprofundar nesta.{" "}
            <Link
              href={`/oportunidades/${s.oportunidade_id}`}
              className="font-semibold text-warn underline"
            >
              Ideação →
            </Link>
          </p>
        </div>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="lbl">Story map — o que o cliente faz para extrair valor</h2>
            <div className="card">
              {passos.length > 0 ? (
                <ol className="mb-3 space-y-1">
                  {passos.map((p) => (
                    <li key={p.id} className="text-sm">
                      <span className="font-mono text-xs text-muted">{p.ordem}.</span> {p.titulo}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mb-3 text-sm text-muted">
                  Liste os passos, na ordem: qual parte do fluxo tem o maior risco de
                  impedir a entrega de valor? É de lá que saem as suposições.
                </p>
              )}
              <form action={criarPassoStoryMap} className="flex gap-2 border-t border-line pt-3">
                <input type="hidden" name="solucao_id" value={s.id} />
                <input
                  name="titulo"
                  required
                  className="field flex-1"
                  placeholder={`Passo ${passos.length + 1} — o que o cliente faz`}
                />
                <button className="btn-ghost" type="submit">+ passo</button>
              </form>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="lbl">
              Suposições ({suposicoes.length}) — ordenadas por risco, sem piedade
            </h2>
            <form action={criarSuposicao} className="card grid grid-cols-1 gap-3 md:grid-cols-2">
              <input type="hidden" name="solucao_id" value={s.id} />
              <div className="md:col-span-2">
                <label className="lbl" htmlFor="texto">Acreditamos que…</label>
                <input
                  id="texto"
                  name="texto"
                  required
                  className="field"
                  placeholder="o que precisa ser verdade para esta solução entregar valor"
                />
              </div>
              <div>
                <label className="lbl" htmlFor="lente">Lente</label>
                <select id="lente" name="lente" className="field">
                  {Object.entries(LENTES).map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>{rotulo}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="lbl" htmlFor="passo_story_map_id">Passo do story map</label>
                <select id="passo_story_map_id" name="passo_story_map_id" className="field">
                  <option value="">—</option>
                  {passos.map((p) => (
                    <option key={p.id} value={p.id}>{p.ordem}. {p.titulo}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="lbl" htmlFor="importancia">Importância (se for falsa, dói quanto?)</label>
                <select id="importancia" name="importancia" defaultValue="3" className="field">
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="lbl" htmlFor="evidencia">Evidência (quanto já sabemos?)</label>
                <select id="evidencia" name="evidencia" defaultValue="3" className="field">
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button className="btn" type="submit">Mapear suposição</button>
              </div>
            </form>

            <ul className="mt-4 space-y-3">
              {suposicoes.map((su) => {
                const testes = getTestes(su.id);
                return (
                  <li key={su.id} className={`card ${altoRisco(su) && su.estado === "mapeada" ? "border-danger" : ""}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold">Acreditamos que {su.texto}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {altoRisco(su) && su.estado === "mapeada" && (
                          <span className="badge bg-danger-soft text-danger">testar primeiro</span>
                        )}
                        <span className="badge bg-line/60 text-muted">{su.lente}</span>
                        <span className="badge bg-line/60 text-muted">
                          risco {riscoDaSuposicao(su)}
                        </span>
                        <span className={`badge ${TOM_SUPOSICAO[su.estado] ?? ""}`}>
                          {su.estado.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>
                    {su.passo_titulo && (
                      <p className="mt-1 text-xs text-muted">nasce do passo: {su.passo_titulo}</p>
                    )}

                    {testes.length > 0 && (
                      <ul className="mt-3 space-y-2 border-t border-line pt-3">
                        {testes.map((t) => (
                          <li key={t.id} className="text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span>
                                <span className="badge mr-2 bg-line/60 text-muted">{t.metodo || "teste"}</span>
                                critério: {t.criterio}
                              </span>
                              {t.veredito && (
                                <span className={`badge ${TOM_SUPOSICAO[t.veredito] ?? "bg-warn-soft text-warn"}`}>
                                  {t.veredito}
                                </span>
                              )}
                            </div>
                            {t.resultado && (
                              <p className="mt-1 text-xs text-muted">resultado: {t.resultado}</p>
                            )}
                            {t.aprendizado && (
                              <p className="mt-1 text-xs text-muted">aprendizado: {t.aprendizado}</p>
                            )}
                            {!t.veredito && (
                              <form action={concluirTeste} className="mt-2 flex flex-wrap items-end gap-2">
                                <input type="hidden" name="id" value={t.id} />
                                <div className="min-w-44 flex-1">
                                  <label className="lbl" htmlFor={`res${t.id}`}>Resultado</label>
                                  <input id={`res${t.id}`} name="resultado" className="field" />
                                </div>
                                <div>
                                  <label className="lbl" htmlFor={`ver${t.id}`}>Veredito</label>
                                  <select id={`ver${t.id}`} name="veredito" required className="field w-auto">
                                    <option value="">—</option>
                                    <option value="validada">validada</option>
                                    <option value="refutada">refutada</option>
                                    <option value="inconclusiva">inconclusiva</option>
                                  </select>
                                </div>
                                <div className="min-w-44 flex-1">
                                  <label className="lbl" htmlFor={`apr${t.id}`}>Aprendizado</label>
                                  <input id={`apr${t.id}`} name="aprendizado" className="field" />
                                </div>
                                <button className="btn-ghost" type="submit">Concluir</button>
                              </form>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {su.estado !== "validada" && su.estado !== "refutada" && testes.every((t) => t.veredito) && (
                      <details className="mt-3 border-t border-line pt-3">
                        <summary className="cursor-pointer text-xs font-semibold text-accent">
                          + criar teste (critério de sucesso vem antes)
                        </summary>
                        <form action={criarTeste} className="mt-2 flex flex-wrap items-end gap-2">
                          <input type="hidden" name="suposicao_id" value={su.id} />
                          <div>
                            <label className="lbl" htmlFor={`met${su.id}`}>Método</label>
                            <select id={`met${su.id}`} name="metodo" className="field w-auto">
                              {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </div>
                          <div className="min-w-56 flex-1">
                            <label className="lbl" htmlFor={`cri${su.id}`}>Critério de sucesso (antes!)</label>
                            <input
                              id={`cri${su.id}`}
                              name="criterio"
                              required
                              className="field"
                              placeholder={'ex.: "3 de 5 professores clicam no fake door"'}
                            />
                          </div>
                          <button className="btn-ghost" type="submit">Criar teste</button>
                        </form>
                      </details>
                    )}
                  </li>
                );
              })}
              {suposicoes.length === 0 && (
                <li className="card text-sm text-muted">
                  Nenhuma suposição mapeada. Percorra o story map perguntando: o que
                  precisa ser verdade para este passo funcionar? Olhe pelas 5 lentes.
                </li>
              )}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
