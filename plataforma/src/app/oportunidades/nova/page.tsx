import { criarOportunidade } from "@/app/actions";
import {
  getEntrevistas,
  getOportunidades,
  getPassosJornada,
  getPersonas,
  getProduto,
  getSinais,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function NovaOportunidade({
  searchParams,
}: {
  searchParams: Promise<{ sinal?: string }>;
}) {
  const { sinal: sinalParam } = await searchParams;
  const produto = getProduto();
  if (!produto) return null;

  const personas = getPersonas(produto.id);
  const passos = getPassosJornada(produto.id);
  const oportunidades = getOportunidades(produto.id);
  const entrevistas = getEntrevistas(produto.id);
  const sinaisNovos = getSinais(produto.id, "novo");
  const sinalOrigem = sinalParam
    ? sinaisNovos.find((s) => s.id === Number(sinalParam))
    : undefined;

  return (
    <div>
      <div className="eyebrow">passo 4 do loop · nova oportunidade</div>
      <h1 className="display mt-1 text-4xl font-medium">Nova oportunidade</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Escreva na voz do cliente: uma necessidade, dor ou desejo — não uma solução
        disfarçada.
      </p>

      {sinalOrigem && (
        <div className="card mt-4 border-accent bg-accent-soft/40">
          <div className="lbl">Sinal de origem (vira evidência)</div>
          <p className="text-sm">
            <span className="badge mr-2 bg-line/60 text-muted">{sinalOrigem.canal}</span>
            {sinalOrigem.conteudo}
          </p>
        </div>
      )}

      <form action={criarOportunidade} className="card mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <input type="hidden" name="produto_id" value={produto.id} />
        {sinalOrigem && <input type="hidden" name="sinal_id" value={sinalOrigem.id} />}
        <div className="md:col-span-2">
          <label className="lbl" htmlFor="titulo">Oportunidade</label>
          <input
            id="titulo"
            name="titulo"
            required
            className="field"
            placeholder={'ex.: "Como professora, não consigo ver se a turma está evoluindo"'}
          />
        </div>
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
          <label className="lbl" htmlFor="passo_jornada_id">Passo da jornada</label>
          <select id="passo_jornada_id" name="passo_jornada_id" className="field">
            <option value="">—</option>
            {passos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.persona_nome ?? "Geral"} · {p.titulo}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="lbl" htmlFor="pai_id">Oportunidade-mãe (opcional)</label>
          <select id="pai_id" name="pai_id" className="field">
            <option value="">— raiz da árvore —</option>
            {oportunidades.map((o) => (
              <option key={o.id} value={o.id}>{o.titulo}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="lbl" htmlFor="notas">Notas</label>
          <input id="notas" name="notas" className="field" />
        </div>
        {!sinalOrigem && (
          <div className="md:col-span-2 grid grid-cols-1 gap-4 rounded-xl border border-dashed border-line p-4 md:grid-cols-2">
            <p className="md:col-span-2 text-xs text-muted">
              <strong className="text-danger">Regra de ouro:</strong> oportunidade sem
              evidência é palpite. Ligue de onde ela veio:
            </p>
            <div>
              <label className="lbl" htmlFor="entrevista_id">Entrevista</label>
              <select id="entrevista_id" name="entrevista_id" className="field">
                <option value="">—</option>
                {entrevistas.map((e) => (
                  <option key={e.id} value={e.id}>{e.data} · {e.entrevistado}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="lbl" htmlFor="sinal_id">Sinal</label>
              <select id="sinal_id" name="sinal_id" className="field">
                <option value="">—</option>
                {sinaisNovos.map((s) => (
                  <option key={s.id} value={s.id}>{s.canal} · {s.conteudo.slice(0, 60)}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        <div className="md:col-span-2 flex justify-end">
          <button className="btn" type="submit">Adicionar à árvore</button>
        </div>
      </form>
    </div>
  );
}
