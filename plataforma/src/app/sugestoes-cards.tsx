import { aceitarSugestao, rejeitarSugestao, rodarAgente } from "@/app/actions";
import type { PayloadAvaliacao } from "@/lib/agentes/redator-avaliacao";
import type { PayloadBrief } from "@/lib/agentes/empacotador";
import type { Sugestao } from "@/lib/queries";

/**
 * Peças compartilhadas dos agentes sob demanda: o botão que dispara um agente
 * sobre um alvo e os cards de sugestão pendente por tipo. Usadas nas páginas
 * de oportunidade e de solução.
 */

export function BotaoAgente({
  agenteId,
  produtoId,
  alvoId,
  volta,
  rotulo,
  dica,
}: {
  agenteId: string;
  produtoId: number;
  alvoId: number;
  volta: string;
  rotulo: string;
  dica?: string;
}) {
  return (
    <form action={rodarAgente} className="inline">
      <input type="hidden" name="agente_id" value={agenteId} />
      <input type="hidden" name="produto_id" value={produtoId} />
      <input type="hidden" name="alvo_id" value={alvoId} />
      <input type="hidden" name="volta" value={volta} />
      <button className="btn-ghost" type="submit" title={dica}>
        {rotulo}
      </button>
    </form>
  );
}

function Rodape({
  sugestao,
  rotuloAceitar,
  nota,
  comTituloOverride,
  tituloAtual,
}: {
  sugestao: Sugestao;
  rotuloAceitar: string;
  nota?: string;
  comTituloOverride?: boolean;
  tituloAtual?: string;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
      <form action={aceitarSugestao} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={sugestao.id} />
        {comTituloOverride && (
          <input
            name="titulo_override"
            defaultValue={tituloAtual}
            className="field w-64 py-1 text-xs"
            title="edite o título antes de aprovar, se quiser"
          />
        )}
        <button className="btn" type="submit">{rotuloAceitar}</button>
      </form>
      <details>
        <summary className="cursor-pointer font-mono text-xs text-muted hover:text-danger">rejeitar</summary>
        <form action={rejeitarSugestao} className="mt-2 flex gap-2">
          <input type="hidden" name="id" value={sugestao.id} />
          <input name="motivo" className="field w-64 py-1 text-xs" placeholder="motivo (melhora o prompt)" />
          <button className="btn-ghost py-1 text-xs" type="submit">confirmar</button>
        </form>
      </details>
      {nota && <span className="ml-auto text-xs text-muted">{nota}</span>}
    </div>
  );
}

function Shell({ titulo, sugestao, children }: { titulo: string; sugestao: Sugestao; children: React.ReactNode }) {
  return (
    <div className="card mt-4 border-accent">
      <div className="flex items-center justify-between gap-2">
        <div className="lbl">{titulo}</div>
        <span className="font-mono text-[10px] text-muted">
          {sugestao.criada_em.slice(0, 16).replace("T", " ")}
        </span>
      </div>
      {children}
    </div>
  );
}

const CRITERIOS = [
  ["Tamanho", "tamanho"],
  ["Companhia", "companhia"],
  ["Mercado", "mercado"],
  ["Cliente", "cliente"],
] as const;

export function CardSugestao({ sugestao }: { sugestao: Sugestao }) {
  const p = JSON.parse(sugestao.payload) as Record<string, unknown>;

  switch (sugestao.tipo) {
    case "rascunho_avaliacao": {
      const a = p as unknown as PayloadAvaliacao;
      return (
        <Shell titulo="🤖 Rascunho do Redator de Avaliação" sugestao={sugestao}>
          <dl className="mt-2 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
            {CRITERIOS.map(([rotulo, campo]) => (
              <div key={campo}>
                <dt className="lbl">
                  {rotulo} —{" "}
                  <span className="font-mono normal-case">
                    {a[campo] ?? "sem insumo"}
                  </span>
                </dt>
                <dd className="text-muted">{a[`${campo}_justif` as keyof PayloadAvaliacao]}</dd>
              </div>
            ))}
          </dl>
          <Rodape
            sugestao={sugestao}
            rotuloAceitar="Aceitar — preencher a avaliação"
            nota="as notas continuam editáveis; a Decisão é sua e fica em branco"
          />
        </Shell>
      );
    }

    case "criar_solucao":
      return (
        <Shell titulo="🤖 Ideia do Provocador" sugestao={sugestao}>
          <p className="mt-2 text-sm font-semibold">{String(p.titulo)}</p>
          <p className="mt-1 text-sm">{String(p.descricao)}</p>
          {!!p.racional && (
            <p className="mt-1 text-xs text-muted">por quê: {String(p.racional)}</p>
          )}
          <Rodape
            sugestao={sugestao}
            rotuloAceitar="Aprovar ideia"
            comTituloOverride
            tituloAtual={String(p.titulo)}
            nota="candidata não conta para o 3/3 até você aprovar"
          />
        </Shell>
      );

    case "criar_suposicoes": {
      const suposicoes = p.suposicoes as {
        texto: string;
        lente: string;
        importancia: number;
        evidencia: number;
        justificativa?: string;
      }[];
      return (
        <Shell titulo="🤖 Suposições do Agente de Risco" sugestao={sugestao}>
          <ul className="mt-2 space-y-2">
            {suposicoes.map((s, i) => (
              <li key={i} className="text-sm">
                <span className="font-semibold">Acreditamos que {s.texto}</span>
                <span className="ml-2 inline-flex flex-wrap gap-1.5 align-middle">
                  <span className="badge bg-line/60 text-muted">{s.lente}</span>
                  <span className="badge bg-line/60 text-muted">imp {s.importancia} · evid {s.evidencia}</span>
                </span>
                {s.justificativa && <p className="text-xs text-muted">{s.justificativa}</p>}
              </li>
            ))}
          </ul>
          <Rodape
            sugestao={sugestao}
            rotuloAceitar={`Mapear ${suposicoes.length > 1 ? `as ${suposicoes.length}` : "a suposição"}`}
            nota="depois edite ou apague uma a uma, como qualquer suposição"
          />
        </Shell>
      );
    }

    case "rascunhar_teste":
      return (
        <Shell titulo="🤖 Teste da mais arriscada (Agente de Risco)" sugestao={sugestao}>
          <p className="mt-2 text-sm">
            Para: <span className="font-semibold">Acreditamos que {String(p.suposicao_texto)}</span>
          </p>
          <dl className="mt-2 space-y-2 text-sm">
            <div><dt className="lbl">Método</dt><dd>{String(p.metodo)}</dd></div>
            <div><dt className="lbl">Critério (definido antes)</dt><dd>{String(p.criterio)}</dd></div>
            {!!p.roteiro && (
              <div>
                <dt className="lbl">Roteiro</dt>
                <dd className="overflow-x-auto rounded-lg bg-line/30 p-2 font-mono text-xs whitespace-pre-wrap">
                  {String(p.roteiro)}
                </dd>
              </div>
            )}
          </dl>
          <Rodape sugestao={sugestao} rotuloAceitar="Criar o teste" nota="a suposição passa a 'em teste'" />
        </Shell>
      );

    case "brief_solucao": {
      const b = p as unknown as PayloadBrief;
      return (
        <Shell titulo="🤖 Brief do Empacotador — copiar e colar no Linear" sugestao={sugestao}>
          <pre className="mt-2 max-h-[32rem] overflow-auto rounded-lg bg-line/30 p-3 font-mono text-xs whitespace-pre-wrap select-all">
            {b.brief_md}
          </pre>
          {b.nao_validado.length > 0 && (
            <div className="mt-2 rounded-lg bg-warn-soft/40 p-2 text-xs">
              <span className="font-semibold">⚠ O sistema registra como NÃO validado:</span>
              <ul className="mt-1 list-inside list-disc">
                {b.nao_validado.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}
          <Rodape sugestao={sugestao} rotuloAceitar="Arquivar brief" nota="copie o texto acima antes de arquivar" />
        </Shell>
      );
    }

    case "criar_metrica":
      return (
        <Shell titulo="💬 Métrica proposta na conversa" sugestao={sugestao}>
          <p className="mt-2 text-sm font-semibold">{String(p.nome)}</p>
          <dl className="mt-1 space-y-1 text-sm">
            <div><dt className="lbl">Definição</dt><dd>{String(p.definicao)}</dd></div>
            <div className="flex gap-6">
              <span><span className="lbl">Unidade</span> {String(p.unidade)}</span>
              <span><span className="lbl">Meta</span> {String(p.meta)}</span>
            </div>
            {!!p.justificativa && (
              <div><dt className="lbl">Por quê</dt><dd className="text-muted">{String(p.justificativa)}</dd></div>
            )}
          </dl>
          <Rodape
            sugestao={sugestao}
            rotuloAceitar="Aceitar — criar a métrica"
            comTituloOverride
            tituloAtual={String(p.nome)}
            nota="mesmo nome de uma existente atualiza em vez de duplicar"
          />
        </Shell>
      );

    default:
      return (
        <Shell titulo="🤖 Sugestão do agente" sugestao={sugestao}>
          <p className="mt-2 text-sm">{sugestao.resumo}</p>
          <Rodape sugestao={sugestao} rotuloAceitar="Aceitar" />
        </Shell>
      );
  }
}
