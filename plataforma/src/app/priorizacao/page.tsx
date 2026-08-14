import Link from "next/link";
import { mudarEstadoOportunidade } from "@/app/actions";
import {
  avaliacaoCompleta,
  countEmDiscovery,
  getProduto,
  LIMITE_WIP,
  oportunidadesEmDiscovery,
  paraPriorizar,
  scoreTotal,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

const ERROS: Record<string, string> = {
  wip: `Limite de WIP atingido (${LIMITE_WIP} em discovery). Resolva ou arquive uma antes de puxar a próxima — trabalho pela metade não aprende nada.`,
  avaliacao:
    "Essa oportunidade ainda não foi avaliada nos 4 critérios. Preencha a avaliação antes de promover — a decisão precisa ser comparável.",
};

export default async function Priorizacao({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; op?: string }>;
}) {
  const { erro, op } = await searchParams;
  const produto = getProduto();
  if (!produto) return null;

  const candidatas = paraPriorizar(produto.id);
  const emDiscovery = oportunidadesEmDiscovery(produto.id);
  const wip = countEmDiscovery(produto.id);

  return (
    <div>
      <div className="eyebrow">passo 5 do loop · tamanho · companhia · mercado · cliente</div>
      <h1 className="display mt-1 text-4xl font-medium">Priorização</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        A decisão é comparativa, não absoluta: as oportunidades lado a lado, avaliadas
        nos mesmos 4 critérios. E o funil tem gargalo de propósito — no máximo{" "}
        <strong className="font-mono text-ink">{LIMITE_WIP}</strong> em discovery.
      </p>

      {erro && ERROS[erro] && (
        <div className="card mt-4 border-danger bg-danger-soft/40 text-sm">
          {ERROS[erro]}{" "}
          {erro === "avaliacao" && op && (
            <Link href={`/oportunidades/${op}`} className="font-semibold text-danger underline">
              Avaliar agora →
            </Link>
          )}
        </div>
      )}

      <section className="mt-6">
        <h2 className="lbl">
          Em discovery · {wip}/{LIMITE_WIP} vagas ocupadas
        </h2>
        {emDiscovery.length === 0 ? (
          <div className="card text-sm text-muted">Nenhuma. Promova a melhor candidata abaixo.</div>
        ) : (
          <ul className="space-y-2">
            {emDiscovery.map((o) => (
              <li key={o.id} className="card flex items-center justify-between gap-3 py-3">
                <Link href={`/oportunidades/${o.id}`} className="text-sm font-semibold hover:text-accent">
                  {o.titulo}
                </Link>
                <span className="badge bg-accent-soft text-accent">em discovery</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="lbl">Candidatas ({candidatas.length})</h2>
        {candidatas.length === 0 ? (
          <div className="card text-sm text-muted">
            Nenhuma oportunidade aguardando priorização. A árvore alimenta esta fila.
          </div>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-4 py-3 font-semibold">Oportunidade</th>
                  <th className="px-2 py-3 text-center font-mono text-xs font-normal text-muted">evid.</th>
                  <th className="px-2 py-3 text-center font-mono text-xs font-normal text-muted">tam</th>
                  <th className="px-2 py-3 text-center font-mono text-xs font-normal text-muted">comp</th>
                  <th className="px-2 py-3 text-center font-mono text-xs font-normal text-muted">merc</th>
                  <th className="px-2 py-3 text-center font-mono text-xs font-normal text-muted">cli</th>
                  <th className="px-2 py-3 text-center font-mono text-xs font-normal text-muted">total</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {candidatas.map((o) => {
                  const total = scoreTotal(o.aval);
                  const completa = avaliacaoCompleta(o.aval);
                  return (
                    <tr key={o.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">
                        <Link href={`/oportunidades/${o.id}`} className="font-semibold hover:text-accent">
                          {o.titulo}
                        </Link>
                        <div className="text-xs text-muted">
                          {o.persona_nome ?? "—"}
                          {o.passo_titulo ? ` · ${o.passo_titulo}` : ""}
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center font-mono tabular-nums">{o.evidencias}</td>
                      <td className="px-2 py-3 text-center font-mono tabular-nums">{o.aval?.tamanho ?? "·"}</td>
                      <td className="px-2 py-3 text-center font-mono tabular-nums">{o.aval?.companhia ?? "·"}</td>
                      <td className="px-2 py-3 text-center font-mono tabular-nums">{o.aval?.mercado ?? "·"}</td>
                      <td className="px-2 py-3 text-center font-mono tabular-nums">{o.aval?.cliente ?? "·"}</td>
                      <td className="px-2 py-3 text-center font-mono font-semibold tabular-nums">
                        {total ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {completa ? (
                          <form action={mudarEstadoOportunidade}>
                            <input type="hidden" name="id" value={o.id} />
                            <input type="hidden" name="estado" value="em_discovery" />
                            <input type="hidden" name="origem" value="/priorizacao" />
                            <button className="btn-ghost whitespace-nowrap py-1 text-xs" type="submit">
                              → discovery
                            </button>
                          </form>
                        ) : (
                          <Link
                            href={`/oportunidades/${o.id}`}
                            className="btn-ghost whitespace-nowrap py-1 text-xs"
                          >
                            avaliar
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-muted">
          tam = tamanho (quantos clientes, com que frequência) · comp = companhia (visão e
          estratégia) · merc = mercado (table stake ou diferencial) · cli = cliente (relevância)
        </p>
      </section>
    </div>
  );
}
