import Link from "next/link";
import { apagarSinal, arquivarSinal, atualizarSinal, criarSinal } from "@/app/actions";
import { Apagar, Editar } from "@/app/ui";
import { getProduto, getSinais } from "@/lib/queries";

export const dynamic = "force-dynamic";

const CANAIS = ["CS", "Daily do CS", "Gravação", "Conversa", "Outro"];

export default function Sinais() {
  const produto = getProduto();
  if (!produto) return null;
  const sinais = getSinais(produto.id);
  const novos = sinais.filter((s) => s.status === "novo");
  const tratados = sinais.filter((s) => s.status !== "novo");

  return (
    <div>
      <div className="eyebrow">passo 3 do loop · outras fontes: CS, gravações, conversas</div>
      <h1 className="display mt-1 text-4xl font-medium">Sinais</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Uma frase basta. Cada sinal vira evidência de uma oportunidade — ou é arquivado.
        Sinal parado no inbox é aprendizado apodrecendo.
      </p>

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
