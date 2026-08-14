import { criarEntrevista } from "@/app/actions";
import { entrevistasNaSemana, getEntrevistas, getPersonas, getProduto } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function Entrevistas() {
  const produto = getProduto();
  if (!produto) return null;
  const personas = getPersonas(produto.id);
  const entrevistas = getEntrevistas(produto.id);
  const naSemana = entrevistasNaSemana(produto.id);

  return (
    <div>
      <div className="eyebrow">passo 3 do loop · no mínimo uma por semana</div>
      <h1 className="display mt-1 text-4xl font-medium">Entrevistas</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Story-based: peça uma história específica que a pessoa viveu, não uma opinião.
        Esta semana: <strong className="font-mono text-ink">{naSemana}/1</strong>.
      </p>

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
