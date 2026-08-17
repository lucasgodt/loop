import {
  aceitarSugestao,
  apagarEntrevista,
  atualizarEntrevista,
  criarEntrevista,
  gerarRoteiro,
  rejeitarSugestao,
  sintetizarEntrevista,
} from "@/app/actions";
import { Apagar, Editar } from "@/app/ui";
import { temChaveDeIA } from "@/lib/agentes/cliente-ia";
import {
  entrevistasNaSemana,
  getEntrevistas,
  getOportunidades,
  getPersonas,
  getProduto,
  sugestoesPendentes,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

interface PayloadRoteiro {
  titulo: string;
  roteiro: string;
  o_que_aprender: string;
  persona_nome: string | null;
  oportunidade_titulo: string | null;
}

export default async function Entrevistas({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const produto = getProduto();
  if (!produto) return null;
  const personas = getPersonas(produto.id);
  const entrevistas = getEntrevistas(produto.id);
  const naSemana = entrevistasNaSemana(produto.id);
  const oportunidades = getOportunidades(produto.id).filter((o) => o.estado !== "arquivada");
  const roteiros = sugestoesPendentes(produto.id).filter((s) => s.tipo === "roteiro_entrevista");

  return (
    <div>
      <div className="eyebrow">passo 3 do loop · no mínimo uma por semana</div>
      <h1 className="display mt-1 text-4xl font-medium">Entrevistas</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Story-based: peça uma história específica que a pessoa viveu, não uma opinião.
        Esta semana: <strong className="font-mono text-ink">{naSemana}/1</strong>.
      </p>

      {erro && (
        <div className="card mt-4 border-danger bg-danger-soft/40 text-sm">{erro}</div>
      )}

      {temChaveDeIA() && (
        <form action={gerarRoteiro} className="card mt-6 border-accent">
          <div className="lbl">🤖 Preparar entrevista</div>
          <p className="mb-2 text-sm text-muted">
            O Roteirista monta o roteiro story-based — pergunta âncora, follow-ups de
            cena e linha do tempo — personalizado pra persona e, se escolher, pra
            oportunidade que você está investigando.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="produto_id" value={produto.id} />
            <div>
              <label className="lbl" htmlFor="r-persona">Persona</label>
              <select id="r-persona" name="persona_id" className="field w-auto">
                <option value="">—</option>
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
            <div className="min-w-64 flex-1">
              <label className="lbl" htmlFor="r-oportunidade">Oportunidade investigada (opcional)</label>
              <select id="r-oportunidade" name="oportunidade_id" className="field">
                <option value="">— roteiro generativo da persona —</option>
                {oportunidades.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.titulo} ({o.estado.replace(/_/g, " ")})
                  </option>
                ))}
              </select>
            </div>
            <button className="btn" type="submit">Gerar roteiro</button>
          </div>
        </form>
      )}

      {roteiros.length > 0 && (
        <section className="mt-6">
          <h2 className="lbl">🤖 Roteiros preparados ({roteiros.length})</h2>
          <ul className="space-y-3">
            {roteiros.map((sg) => {
              const p = JSON.parse(sg.payload) as PayloadRoteiro;
              return (
                <li key={sg.id} className="card border-accent">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{p.titulo}</span>
                    <span className="font-mono text-[10px] text-muted">
                      {p.persona_nome ?? "sem persona"}
                      {p.oportunidade_titulo ? ` · ${p.oportunidade_titulo}` : ""}
                    </span>
                  </div>
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-line/30 p-3 font-sans text-sm whitespace-pre-wrap">{p.roteiro}</pre>
                  {p.o_que_aprender && (
                    <p className="mt-2 text-xs text-muted">
                      <strong>O que queremos aprender:</strong> {p.o_que_aprender}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-3 border-t border-line pt-3">
                    <form action={aceitarSugestao}>
                      <input type="hidden" name="id" value={sg.id} />
                      <button className="btn-ghost" type="submit">Arquivar (já usei)</button>
                    </form>
                    <details>
                      <summary className="cursor-pointer font-mono text-xs text-muted hover:text-danger">descartar</summary>
                      <form action={rejeitarSugestao} className="mt-2 flex gap-2">
                        <input type="hidden" name="id" value={sg.id} />
                        <input name="motivo" className="field w-64 py-1 text-xs" placeholder="motivo (melhora o prompt)" />
                        <button className="btn-ghost py-1 text-xs" type="submit">confirmar</button>
                      </form>
                    </details>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <form action={criarEntrevista} className="card mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <input type="hidden" name="produto_id" value={produto.id} />
        <div>
          <label className="lbl" htmlFor="entrevistado">Entrevistado</label>
          <input id="entrevistado" name="entrevistado" required className="field" placeholder="Nome (e escola, se houver)" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="lbl" htmlFor="persona_id">Persona</label>
            <select id="persona_id" name="persona_id" className="field">
              <option value="">—</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="lbl" htmlFor="data">Data</label>
            <input id="data" name="data" type="date" className="field" />
          </div>
        </div>
        <div className="md:col-span-2">
          <label className="lbl" htmlFor="historia">A história</label>
          <textarea
            id="historia"
            name="historia"
            rows={4}
            className="field"
            placeholder={'"Me conta a última vez que você..." — o que aconteceu, na ordem em que aconteceu'}
          />
        </div>
        <div>
          <label className="lbl" htmlFor="notas">Notas / dores ouvidas</label>
          <input id="notas" name="notas" className="field" placeholder="Necessidades, dores e desejos que apareceram" />
        </div>
        <div>
          <label className="lbl" htmlFor="link_gravacao">Link da gravação</label>
          <input id="link_gravacao" name="link_gravacao" className="field" placeholder="https://…" />
        </div>
        <div className="md:col-span-2">
          <label className="lbl" htmlFor="transcricao">Transcrição (colar — habilita a síntese por IA)</label>
          <textarea
            id="transcricao"
            name="transcricao"
            rows={3}
            className="field font-mono text-xs"
            placeholder="Cole a transcrição do Meet/Zoom aqui e depois clique em sintetizar"
          />
        </div>
        <div className="md:col-span-2 flex items-center justify-between">
          <p className="text-xs text-muted">
            Depois de salvar, leve as dores para a árvore de oportunidades — entrevista sem síntese não conta.
          </p>
          <button className="btn" type="submit">Salvar entrevista</button>
        </div>
      </form>

      <ul className="mt-8 space-y-3">
        {entrevistas.map((e) => (
          <li key={e.id} className="card">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">{e.entrevistado}</span>
              <span className="font-mono text-xs text-muted">
                {e.data}
                {e.persona_nome ? ` · ${e.persona_nome}` : ""}
              </span>
            </div>
            {e.historia && <p className="mt-2 text-sm whitespace-pre-wrap">{e.historia}</p>}
            {e.notas && <p className="mt-2 text-sm text-muted">{e.notas}</p>}
            {e.link_gravacao && (
              <a href={e.link_gravacao} className="mt-2 inline-block text-sm text-accent underline">
                gravação
              </a>
            )}
            {e.transcricao && (
              <form action={sintetizarEntrevista} className="mt-2 flex items-center gap-2">
                <input type="hidden" name="id" value={e.id} />
                <span className="badge bg-line/60 text-muted">transcrição ✓</span>
                <button className="btn-ghost py-1 text-xs" type="submit">
                  🤖 Sintetizar (extrai dores e propõe destinos na árvore)
                </button>
              </form>
            )}
            <div className="mt-3 flex gap-4 border-t border-line pt-2">
              <Editar>
                <form action={atualizarEntrevista} className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input type="hidden" name="id" value={e.id} />
                  <input name="entrevistado" defaultValue={e.entrevistado} required className="field" />
                  <div className="grid grid-cols-2 gap-3">
                    <select name="persona_id" defaultValue={e.persona_id ?? ""} className="field">
                      <option value="">persona…</option>
                      {personas.map((p) => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                    <input name="data" type="date" defaultValue={e.data} className="field" />
                  </div>
                  <textarea name="historia" rows={3} defaultValue={e.historia} className="field md:col-span-2" />
                  <input name="notas" defaultValue={e.notas} className="field" />
                  <input name="link_gravacao" defaultValue={e.link_gravacao} className="field" />
                  <textarea
                    name="transcricao"
                    rows={3}
                    defaultValue={e.transcricao}
                    className="field font-mono text-xs md:col-span-2"
                    placeholder="transcrição (colar)"
                  />
                  <div className="md:col-span-2 flex justify-end">
                    <button className="btn-ghost" type="submit">Salvar</button>
                  </div>
                </form>
              </Editar>
              <Apagar action={apagarEntrevista} id={e.id} />
            </div>
          </li>
        ))}
        {entrevistas.length === 0 && (
          <li className="card text-sm text-muted">
            Nenhuma entrevista registrada. A primeira história desta semana começa aqui.
          </li>
        )}
      </ul>
    </div>
  );
}
