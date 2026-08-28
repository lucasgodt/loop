import Link from "next/link";
import {
  apagarPassoJornada,
  criarPassoJornada,
  criarSolucao,
  mudarEstadoOportunidade,
} from "@/app/actions";
import { Conversa } from "@/app/conversa";
import { CardSugestao } from "@/app/sugestoes-cards";
import { Apagar } from "@/app/ui";
import { ArvoreVisual } from "./arvore";
import {
  getOportunidades,
  getPassosJornada,
  getPersonas,
  getProduto,
  sugestoesPendentesDoTipo,
  type Oportunidade,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

const ESTADOS = ["identificada", "priorizada", "em_discovery", "resolvida", "arquivada"];

const TOM_ESTADO: Record<string, string> = {
  identificada: "bg-line/60 text-muted",
  priorizada: "bg-warn-soft text-warn",
  em_discovery: "bg-accent-soft text-accent",
  resolvida: "bg-accent-soft text-accent",
  arquivada: "bg-line/60 text-muted",
};

function No({ o, filhos, produtoId }: { o: Oportunidade; filhos: Map<number, Oportunidade[]>; produtoId: number }) {
  const criancas = filhos.get(o.id) ?? [];
  return (
    <li className="mt-2">
      <div className="card py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href={`/oportunidades/${o.id}`} className="text-sm font-semibold hover:text-accent">
            {o.titulo}
          </Link>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`badge ${TOM_ESTADO[o.estado] ?? "bg-line/60 text-muted"}`}>
              {o.estado.replace("_", " ")}
            </span>
            <span
              className={`badge ${
                o.evidencias > 0 ? "bg-accent-soft text-accent" : "bg-danger-soft text-danger"
              }`}
            >
              {o.evidencias > 0 ? `${o.evidencias} evid.` : "sem evidência"}
            </span>
            {o.estado === "em_discovery" && (
              <span className={`badge ${o.solucoes >= 3 ? "bg-accent-soft text-accent" : "bg-warn-soft text-warn"}`}>
                soluções {o.solucoes}/3
              </span>
            )}
            <form action={mudarEstadoOportunidade} className="flex items-center gap-1">
              <input type="hidden" name="id" value={o.id} />
              <input type="hidden" name="origem" value="/oportunidades" />
              <select name="estado" defaultValue={o.estado} className="field w-auto py-1 text-xs">
                {ESTADOS.map((e) => (
                  <option key={e} value={e}>{e.replace("_", " ")}</option>
                ))}
              </select>
              <button className="btn-ghost py-1 text-xs" type="submit">mover</button>
            </form>
          </div>
        </div>
        {o.notas && <p className="mt-1 text-xs text-muted">{o.notas}</p>}
        {o.estado === "em_discovery" && (
          <form action={criarSolucao} className="mt-2 flex gap-2">
            <input type="hidden" name="produto_id" value={produtoId} />
            <input type="hidden" name="oportunidade_id" value={o.id} />
            <input
              name="titulo"
              required
              className="field flex-1 py-1.5 text-xs"
              placeholder={
                o.solucoes < 3
                  ? `Ideia de solução ${o.solucoes + 1}/3 — a primeira raramente é a melhor`
                  : "Mais uma ideia de solução"
              }
            />
            <button className="btn-ghost py-1 text-xs" type="submit">+ solução</button>
          </form>
        )}
      </div>
      {criancas.length > 0 && (
        <ul className="ml-6 border-l border-line pl-4">
          {criancas.map((c) => (
            <No key={c.id} o={c} filhos={filhos} produtoId={produtoId} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default async function Oportunidades({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; op?: string; visao?: string }>;
}) {
  const { erro, op, visao } = await searchParams;
  const emLista = visao === "lista";
  const produto = getProduto();
  if (!produto) return null;
  const oportunidades = getOportunidades(produto.id);
  const personas = getPersonas(produto.id);
  const passos = getPassosJornada(produto.id);

  const filhos = new Map<number, Oportunidade[]>();
  for (const o of oportunidades) {
    if (o.pai_id) {
      filhos.set(o.pai_id, [...(filhos.get(o.pai_id) ?? []), o]);
    }
  }
  const raizes = oportunidades.filter((o) => !o.pai_id);

  const grupos = new Map<string, Oportunidade[]>();
  for (const o of raizes) {
    const chave = o.passo_titulo
      ? `${o.persona_nome ?? "Geral"} · ${o.passo_titulo}`
      : "Sem passo da jornada";
    grupos.set(chave, [...(grupos.get(chave) ?? []), o]);
  }

  return (
    <div>
      <div className="eyebrow">passo 4 do loop · árvore construída em cima da jornada</div>
      <h1 className="display mt-1 text-4xl font-medium">Oportunidades</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Necessidades, dores e desejos — na voz de quem vive. Regra de ouro: oportunidade
        sem evidência é palpite.
      </p>

      {erro === "wip" && (
        <div className="card mt-4 border-danger bg-danger-soft/40 text-sm">
          Limite de WIP atingido — resolva ou arquive uma oportunidade em discovery antes
          de puxar a próxima. <Link href="/priorizacao" className="font-semibold text-danger underline">Ver priorização →</Link>
        </div>
      )}
      {erro === "avaliacao" && (
        <div className="card mt-4 border-danger bg-danger-soft/40 text-sm">
          Antes de entrar em discovery, a oportunidade precisa da avaliação nos 4
          critérios.{" "}
          {op && (
            <Link href={`/oportunidades/${op}`} className="font-semibold text-danger underline">
              Avaliar agora →
            </Link>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <Link href="/oportunidades/nova" className="btn">Nova oportunidade</Link>
        <div className="flex rounded-lg border border-line bg-card p-0.5 font-mono text-xs">
          <Link
            href="/oportunidades"
            className={`rounded-md px-3 py-1.5 transition ${
              !emLista ? "bg-accent-soft font-semibold text-accent" : "text-muted hover:text-ink"
            }`}
          >
            árvore
          </Link>
          <Link
            href="/oportunidades?visao=lista"
            className={`rounded-md px-3 py-1.5 transition ${
              emLista ? "bg-accent-soft font-semibold text-accent" : "text-muted hover:text-ink"
            }`}
          >
            lista
          </Link>
        </div>
      </div>

      {!emLista ? (
        <div className="mt-6">
          <ArvoreVisual
            oportunidades={oportunidades}
            passos={passos}
            personas={personas}
            produtoId={produto.id}
          />
          <p className="mt-2 text-xs text-muted">
            Clique num nó para abrir a oportunidade (avaliar, mover, ideação). Oportunidades
            arquivadas e ações inline estão na visão em lista.
          </p>
        </div>
      ) : (
        <>
          {[...grupos.entries()].map(([grupo, os]) => (
            <section key={grupo} className="mt-6">
              <h2 className="lbl">{grupo}</h2>
              <ul>
                {os.map((o) => (
                  <No key={o.id} o={o} filhos={filhos} produtoId={produto.id} />
                ))}
              </ul>
            </section>
          ))}
          {raizes.length === 0 && (
            <div className="card mt-6 text-sm text-muted">
              Árvore vazia. As primeiras oportunidades costumam chegar promovidas do inbox de
              sinais ou extraídas de uma entrevista.
            </div>
          )}
        </>
      )}

      <section className="mt-10">
        <h2 className="lbl">Jornada (o esqueleto da árvore)</h2>
        <div className="card">
          {passos.length > 0 ? (
            <ul className="mb-3 space-y-1">
              {passos.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    <span className="font-mono text-xs text-muted">
                      {p.persona_nome ?? "Geral"} {p.ordem}.
                    </span>{" "}
                    {p.titulo}
                    {p.descricao && <span className="text-muted"> — {p.descricao}</span>}
                  </span>
                  <Apagar action={apagarPassoJornada} id={p.id} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-sm text-muted">
              Nenhum passo mapeado. Qual é o fluxo que o cliente percorre para extrair
              valor? Comece simples — a jornada deve ser iterada até ser bem mapeada.
            </p>
          )}
          <form action={criarPassoJornada} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="produto_id" value={produto.id} />
            <div>
              <label className="lbl" htmlFor="jp">Persona</label>
              <select id="jp" name="persona_id" className="field w-auto">
                <option value="">Geral</option>
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
            <div className="min-w-52 flex-1">
              <label className="lbl" htmlFor="jt">Passo</label>
              <input id="jt" name="titulo" required className="field" placeholder="ex.: Descobre o app em sala" />
            </div>
            <button className="btn-ghost" type="submit">+ passo</button>
          </form>
        </div>

        <Conversa produtoId={produto.id} topico="jornada" volta="/oportunidades" />

        {sugestoesPendentesDoTipo(produto.id, "criar_jornada").map((s) => (
          <CardSugestao key={s.id} sugestao={s} />
        ))}
        {sugestoesPendentesDoTipo(produto.id, "organizar_arvore").map((s) => (
          <CardSugestao key={s.id} sugestao={s} />
        ))}
      </section>
    </div>
  );
}
