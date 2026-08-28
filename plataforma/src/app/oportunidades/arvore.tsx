import Link from "next/link";
import { rodarAgente } from "@/app/actions";
import { BotaoPendente } from "@/app/botao-pendente";
import { temChaveDeIA } from "@/lib/agentes/cliente-ia";
import {
  getSolucoes,
  sugestoesPendentesParaAlvo,
  type Oportunidade,
  type PassoJornada,
  type Persona,
} from "@/lib/queries";

const BORDA_ESTADO: Record<string, string> = {
  identificada: "border-line",
  priorizada: "border-warn",
  em_discovery: "border-accent",
  resolvida: "border-accent/50",
};

function NoOportunidade({
  o,
  filhos,
}: {
  o: Oportunidade;
  filhos: Map<number, Oportunidade[]>;
}) {
  const criancas = filhos.get(o.id) ?? [];
  const solucoes = getSolucoes(o.id).filter((s) => s.estado !== "descartada");
  return (
    <li>
      <Link
        href={`/oportunidades/${o.id}`}
        className={`block w-44 rounded-xl border-2 ${BORDA_ESTADO[o.estado] ?? "border-line"} bg-card px-3 py-2 text-left shadow-sm transition hover:shadow-md`}
      >
        <span className="block text-xs font-semibold leading-snug">{o.titulo}</span>
        <span className="mt-1 block font-mono text-[10px] text-muted">
          {o.estado.replace(/_/g, " ")} · {o.evidencias} evid.
          {o.solucoes > 0 ? ` · ${o.solucoes} sol.` : ""}
        </span>
      </Link>
      {(criancas.length > 0 || solucoes.length > 0) && (
        <ul>
          {criancas.map((c) => (
            <NoOportunidade key={c.id} o={c} filhos={filhos} />
          ))}
          {solucoes.map((s) => (
            <li key={`s${s.id}`}>
              <Link
                href={`/solucoes/${s.id}`}
                className="block w-36 rounded-lg border border-dashed border-line bg-paper px-2.5 py-1.5 text-left transition hover:border-accent"
              >
                <span className="eyebrow block text-[9px]">solução</span>
                <span className="block text-[11px] leading-snug">{s.titulo}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function Coluna({
  ordem,
  titulo,
  roots,
  filhos,
  botaoOrganizar,
}: {
  ordem: string;
  titulo: string;
  roots: Oportunidade[];
  filhos: Map<number, Oportunidade[]>;
  botaoOrganizar?: { produtoId: number; passoId: number };
}) {
  const podeOrganizar =
    botaoOrganizar &&
    roots.length >= 1 &&
    temChaveDeIA() &&
    sugestoesPendentesParaAlvo("passo_jornada", botaoOrganizar.passoId).length === 0;
  return (
    <div className="arvore shrink-0">
      <ul>
        <li>
          <div className="relative w-40 rounded-full border border-line bg-line/40 px-3 py-1.5 text-center">
            <span className="eyebrow block text-[9px]">{ordem}</span>
            <span className="block text-xs font-semibold leading-snug">{titulo}</span>
            {podeOrganizar && (
              <form
                action={rodarAgente}
                className="absolute -top-1.5 -right-1.5"
                title="repensar a organização das oportunidades deste passo (mães, aninhamentos, órfãs)"
              >
                <input type="hidden" name="agente_id" value="organizador" />
                <input type="hidden" name="produto_id" value={botaoOrganizar.produtoId} />
                <input type="hidden" name="alvo_id" value={botaoOrganizar.passoId} />
                <input type="hidden" name="volta" value="/oportunidades" />
                <BotaoPendente
                  rotulo="✨"
                  rotuloPendente="…"
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-line bg-card text-xs shadow-sm hover:border-accent"
                />
              </form>
            )}
          </div>
          {roots.length > 0 && (
            <ul>
              {roots.map((o) => (
                <NoOportunidade key={o.id} o={o} filhos={filhos} />
              ))}
            </ul>
          )}
        </li>
      </ul>
    </div>
  );
}

/**
 * A árvore de oportunidades como árvore mesmo: pendurada nos passos da jornada
 * (a âncora do método), com filhas conectadas por linhas e as soluções como
 * folhas. Arquivadas ficam de fora (só na visão em lista).
 */
export function ArvoreVisual({
  oportunidades,
  passos,
  personas,
  produtoId,
}: {
  oportunidades: Oportunidade[];
  passos: PassoJornada[];
  personas: Persona[];
  produtoId: number;
}) {
  const vivas = oportunidades.filter((o) => o.estado !== "arquivada");
  const ids = new Set(vivas.map((o) => o.id));

  const filhos = new Map<number, Oportunidade[]>();
  const roots: Oportunidade[] = [];
  for (const o of vivas) {
    if (o.pai_id && ids.has(o.pai_id)) {
      filhos.set(o.pai_id, [...(filhos.get(o.pai_id) ?? []), o]);
    } else {
      roots.push(o);
    }
  }

  const bandas: { nome: string; personaId: number | null }[] = [
    ...personas.map((p) => ({ nome: p.nome, personaId: p.id as number | null })),
    { nome: "Geral", personaId: null },
  ];

  const todosPassos = new Set(passos.map((p) => p.id));
  const secoes = bandas
    .map((banda) => {
      const passosDaBanda = passos.filter((p) => p.persona_id === banda.personaId);
      const rootsDaBanda = roots.filter((o) => (o.persona_id ?? null) === banda.personaId);
      // Sem âncora = sem passo nenhum (ancorada em passo de outra persona conta
      // como ancorada — aparece na coluna daquele passo, não aqui).
      const semAncora = rootsDaBanda.filter(
        (o) => !o.passo_jornada_id || !todosPassos.has(o.passo_jornada_id)
      );
      return { banda, passosDaBanda, semAncora };
    })
    .filter((s) => s.passosDaBanda.length > 0 || s.semAncora.length > 0);

  if (secoes.length === 0) {
    return (
      <div className="card text-sm text-muted">
        Árvore vazia. As primeiras oportunidades costumam chegar promovidas do inbox
        de sinais ou extraídas de uma entrevista — e a jornada (abaixo) é o esqueleto
        onde elas se penduram.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {secoes.map(({ banda, passosDaBanda, semAncora }) => (
        <section key={banda.nome}>
          <h2 className="lbl">{banda.nome}</h2>
          <div className="overflow-x-auto pt-2 pb-2">
            <div className="flex items-start gap-6">
              {passosDaBanda.map((p) => (
                <Coluna
                  key={p.id}
                  ordem={`passo ${p.ordem}`}
                  titulo={p.titulo}
                  roots={roots.filter((o) => o.passo_jornada_id === p.id)}
                  filhos={filhos}
                  botaoOrganizar={{ produtoId, passoId: p.id }}
                />
              ))}
              {semAncora.length > 0 && (
                <Coluna
                  ordem="⚠ jornada incompleta?"
                  titulo="Sem âncora"
                  roots={semAncora}
                  filhos={filhos}
                />
              )}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
