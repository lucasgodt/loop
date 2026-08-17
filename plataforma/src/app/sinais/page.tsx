import Link from "next/link";
import {
  aceitarSugestao,
  apagarSinal,
  arquivarSinal,
  atualizarSinal,
  criarSinal,
  processarInsumo,
  rejeitarSugestao,
} from "@/app/actions";
import { Apagar, Editar } from "@/app/ui";
import { temChaveDeIA } from "@/lib/agentes/cliente-ia";
import { getProduto, getSinais, sugestoesPendentes } from "@/lib/queries";

export const dynamic = "force-dynamic";

const CANAIS = ["CS", "Daily do CS", "Gravação", "Conversa", "Outro"];

interface SinalDoPayload {
  conteudo: string;
  trecho_fonte: string;
}
interface PayloadTriador {
  sinais: SinalDoPayload[];
  canal: string;
  oportunidade_id?: number;
  oportunidade_titulo?: string;
  titulo?: string;
  persona_nome?: string | null;
  passo_titulo?: string | null;
  racional?: string;
}

export default async function Sinais({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const produto = getProduto();
  if (!produto) return null;
  const sinais = getSinais(produto.id);
  const novos = sinais.filter((s) => s.status === "novo");
  const tratados = sinais.filter((s) => s.status !== "novo");
  const sugestoes = sugestoesPendentes(produto.id).filter((s) => s.tipo.startsWith("sinal_"));

  return (
    <div>
      <div className="eyebrow">passo 3 do loop · outras fontes: CS, gravações, conversas</div>
      <h1 className="display mt-1 text-4xl font-medium">Sinais</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Uma frase basta. Cada sinal vira evidência de uma oportunidade — ou é arquivado.
        Sinal parado no inbox é aprendizado apodrecendo.
      </p>

      {erro && (
        <div className="card mt-4 border-danger bg-danger-soft/40 text-sm">{erro}</div>
      )}

      {temChaveDeIA() ? (
        <form action={processarInsumo} className="card mt-6 border-accent">
          <div className="lbl">🤖 Triar insumo com IA</div>
          <p className="mb-2 text-sm text-muted">
            Cole o bruto — a daily do CS, uma transcrição, uma thread. O Triador extrai
            os sinais com citação literal e propõe o destino de cada um contra a árvore.
          </p>
          <div className="flex flex-wrap items-start gap-3">
            <select name="canal" className="field w-auto">
              {CANAIS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <textarea
              name="conteudo"
              rows={4}
              required
              className="field min-w-64 flex-1"
              placeholder="Cole aqui o texto bruto…"
            />
            <input type="hidden" name="produto_id" value={produto.id} />
            <button className="btn" type="submit">Triar</button>
          </div>
        </form>
      ) : (
        <p className="mt-4 text-xs text-muted">
          🤖 O Triador pode transformar a daily do CS em sinais triados — configure{" "}
          <code className="font-mono">OPENAI_API_KEY</code> no .env.local para habilitar.
        </p>
      )}

      {sugestoes.length > 0 && (
        <section className="mt-6">
          <h2 className="lbl">🤖 Sugestões do Triador ({sugestoes.length})</h2>
          <ul className="space-y-3">
            {sugestoes.map((sg) => {
              const p = JSON.parse(sg.payload) as PayloadTriador;
              const ehNova = sg.tipo === "sinal_nova_oportunidade";
              return (
                <li key={sg.id} className="card border-accent">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`badge ${
                        sg.tipo === "sinal_evidencia"
                          ? "bg-accent-soft text-accent"
                          : ehNova
                            ? "bg-warn-soft text-warn"
                            : "bg-line/60 text-muted"
                      }`}
                    >
                      {sg.tipo === "sinal_evidencia"
                        ? "ligar como evidência"
                        : ehNova
                          ? "nova oportunidade"
                          : "para o inbox"}
                    </span>
                    <span className="font-mono text-[10px] text-muted">{sg.criada_em.slice(0, 16).replace("T", " ")}</span>
                  </div>

                  <ul className="mt-2 space-y-1.5">
                    {p.sinais.map((s, i) => (
                      <li key={i} className="text-sm">
                        {s.conteudo}
                        <span className="block border-l-2 border-line pl-2 text-xs italic text-muted">
                          "{s.trecho_fonte}"
                        </span>
                      </li>
                    ))}
                  </ul>

                  {sg.tipo === "sinal_evidencia" && p.oportunidade_id && (
                    <p className="mt-2 text-sm">
                      →{" "}
                      <Link href={`/oportunidades/${p.oportunidade_id}`} className="font-semibold text-accent hover:underline">
                        {p.oportunidade_titulo}
                      </Link>
                    </p>
                  )}
                  {p.racional && <p className="mt-1 text-xs text-muted">por quê: {p.racional}</p>}

                  <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
                    <form action={aceitarSugestao} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={sg.id} />
                      {ehNova && (
                        <input
                          name="titulo_override"
                          defaultValue={p.titulo}
                          className="field min-w-72 py-1.5 text-sm"
                          title="título da oportunidade (editável)"
                        />
                      )}
                      <button className="btn" type="submit">Aceitar</button>
                      {ehNova && (
                        <span className="text-xs text-muted">
                          {p.persona_nome ?? "sem persona"} · {p.passo_titulo ?? "sem âncora"}
                        </span>
                      )}
                    </form>
                    <details>
                      <summary className="cursor-pointer font-mono text-xs text-muted hover:text-danger">rejeitar</summary>
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

      <form action={criarSinal} className="card mt-6 flex flex-wrap items-end gap-3">
        <input type="hidden" name="produto_id" value={produto.id} />
        <div className="min-w-40">
          <label className="lbl" htmlFor="canal">Canal</label>
          <select id="canal" name="canal" className="field">
            {CANAIS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="min-w-64 flex-1">
          <label className="lbl" htmlFor="conteudo">O que foi ouvido</label>
          <input
            id="conteudo"
            name="conteudo"
            required
            className="field"
            placeholder={'ex.: "professora do Liceu disse que não acha o relatório da turma"'}
          />
        </div>
        <div>
          <label className="lbl" htmlFor="data">Data</label>
          <input id="data" name="data" type="date" className="field" />
        </div>
        <button className="btn" type="submit">Capturar</button>
      </form>

      <h2 className="lbl mt-8">Inbox ({novos.length})</h2>
      <ul className="space-y-2">
        {novos.map((s) => (
          <li key={s.id} className="card flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0 flex-1">
              <span className="badge mr-2 bg-line/60 text-muted">{s.canal}</span>
              <span className="text-sm">{s.conteudo}</span>
              <span className="ml-2 font-mono text-xs text-muted">{s.data}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link href={`/oportunidades/nova?sinal=${s.id}`} className="btn-ghost">
                Promover ↗
              </Link>
              <form action={arquivarSinal}>
                <input type="hidden" name="id" value={s.id} />
                <button className="btn-ghost text-muted" type="submit">Arquivar</button>
              </form>
              <Apagar action={apagarSinal} id={s.id} />
            </div>
            <div className="w-full">
              <Editar>
                <form action={atualizarSinal} className="flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={s.id} />
                  <select name="canal" defaultValue={s.canal} className="field w-auto">
                    {[...new Set([...CANAIS, s.canal])].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <input name="conteudo" defaultValue={s.conteudo} required className="field min-w-56 flex-1" />
                  <input name="data" type="date" defaultValue={s.data} className="field" />
                  <button className="btn-ghost" type="submit">Salvar</button>
                </form>
              </Editar>
            </div>
          </li>
        ))}
        {novos.length === 0 && (
          <li className="card text-sm text-muted">Inbox limpo.</li>
        )}
      </ul>

      {tratados.length > 0 && (
        <>
          <h2 className="lbl mt-8">Tratados</h2>
          <ul className="space-y-2">
            {tratados.map((s) => (
              <li key={s.id} className="card flex items-center justify-between gap-3 py-3 opacity-70">
                <div className="min-w-0 flex-1">
                  <span className="badge mr-2 bg-line/60 text-muted">{s.canal}</span>
                  <span className="text-sm">{s.conteudo}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`badge ${
                      s.status === "promovido" ? "bg-accent-soft text-accent" : "bg-line/60 text-muted"
                    }`}
                  >
                    {s.status}
                  </span>
                  <Apagar action={apagarSinal} id={s.id} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
