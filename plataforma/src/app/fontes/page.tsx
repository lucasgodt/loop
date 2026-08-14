import { apagarFonte, atualizarContextoProduto, atualizarFonte, criarFonte } from "@/app/actions";
import { Apagar, Editar } from "@/app/ui";
import { PROVEDORES } from "@/lib/fontes";
import { getFontes, getProduto, usosDaFonte } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Fontes({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const produto = getProduto();
  if (!produto) return null;
  const fontes = getFontes(produto.id);
  const provedores = [...PROVEDORES.values()];

  return (
    <div>
      <div className="eyebrow">infraestrutura do loop · medição plugável</div>
      <h1 className="display mt-1 text-4xl font-medium">Fontes de dados</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        A plataforma não conhece BigQuery, Mixpanel ou planilha — só conhece o contrato
        de um provedor. Uma fonte é uma conexão (tipo + config); métricas e lançamentos
        guardam apenas <em>qual fonte</em> e <em>qual consulta</em>. Plugar um tipo novo
        é criar um arquivo em <code className="font-mono text-xs">src/lib/fontes/</code>.
      </p>

      {erro && (
        <div className="card mt-4 border-danger bg-danger-soft/40 text-sm">
          Erro: {erro}
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {fontes.map((f) => {
          const usos = usosDaFonte(f.id);
          return (
            <li key={f.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{f.nome}</span>
                <div className="flex items-center gap-2">
                  <span className="badge bg-accent-soft text-accent">{f.tipo}</span>
                  <span className="badge bg-line/60 text-muted">
                    {usos} uso{usos === 1 ? "" : "s"}
                  </span>
                  <Apagar action={apagarFonte} id={f.id} />
                </div>
              </div>
              <p className="mt-1 break-all font-mono text-xs text-muted">{f.config}</p>
              <div className="mt-2">
                <Editar>
                  <form action={atualizarFonte} className="grid grid-cols-1 gap-2">
                    <input type="hidden" name="id" value={f.id} />
                    <div className="flex gap-2">
                      <input name="nome" defaultValue={f.nome} required className="field flex-1" />
                      <select name="tipo" defaultValue={f.tipo} className="field w-auto">
                        {provedores.map((p) => (
                          <option key={p.tipo} value={p.tipo}>{p.rotulo}</option>
                        ))}
                      </select>
                    </div>
                    <textarea name="config" rows={2} defaultValue={f.config} className="field font-mono text-xs" />
                    <div className="flex justify-end">
                      <button className="btn-ghost" type="submit">Salvar</button>
                    </div>
                  </form>
                </Editar>
              </div>
            </li>
          );
        })}
        {fontes.length === 0 && (
          <li className="card text-sm text-muted">
            Nenhuma fonte plugada. Sem fonte, métricas e revisões continuam registráveis
            manualmente — a fonte só automatiza o número.
          </li>
        )}
      </ul>

      <form action={criarFonte} className="card mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
        <input type="hidden" name="produto_id" value={produto.id} />
        <div className="md:col-span-2">
          <h2 className="lbl">Nova fonte</h2>
        </div>
        <div>
          <label className="lbl" htmlFor="nome">Nome</label>
          <input id="nome" name="nome" required className="field" placeholder="ex.: BigQuery Mooney" />
        </div>
        <div>
          <label className="lbl" htmlFor="tipo">Tipo</label>
          <select id="tipo" name="tipo" className="field">
            {provedores.map((p) => (
              <option key={p.tipo} value={p.tipo}>{p.rotulo}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="lbl" htmlFor="config">Config (JSON — conexão/autenticação)</label>
          <textarea id="config" name="config" rows={2} className="field font-mono text-xs" placeholder="{}" />
        </div>
        <div className="md:col-span-2 flex justify-end">
          <button className="btn" type="submit">Plugar fonte</button>
        </div>
      </form>

      <section className="mt-8">
        <h2 className="lbl">Tipos disponíveis</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {provedores.map((p) => (
            <div key={p.tipo} className="card">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{p.rotulo}</span>
                <span className="badge bg-line/60 text-muted">{p.tipo}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{p.descricao}</p>
              <div className="mt-2 overflow-x-auto">
                <p className="font-mono text-xs text-muted">config: {p.configExemplo}</p>
                <p className="mt-1 font-mono text-xs text-muted">consulta: {p.consultaExemplo}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          O BigQuery da Mooney pluga hoje pelo tipo <strong>comando</strong> (via{" "}
          <code className="font-mono">bq query</code>). Se um dia valer a pena, um
          provedor nativo <code className="font-mono">bigquery.ts</code> entra no
          registro sem tocar em mais nada.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="lbl">Contexto de dados do produto (para os agentes)</h2>
        <form action={atualizarContextoProduto} className="card">
          <input type="hidden" name="id" value={produto.id} />
          <p className="mb-2 text-sm text-muted">
            O que um agente precisa saber para escrever consultas nesta fonte:
            tabelas e campos relevantes, joins, regras de higiene dos dados e
            confounders (ex.: sazonalidade escolar). Sem isso, o Fechador de Loop se
            recusa a inventar SQL — configuração do workspace, nunca hardcode.
          </p>
          <textarea
            name="contexto"
            rows={10}
            defaultValue={produto.contexto}
            className="field font-mono text-xs"
            placeholder={
              "ex.:\nDataset: mooney-db39f.analytics\n- tabela alunos (aluno_id, escola_id, criado_em)\n- tabela sessoes (aluno_id, iniciada_em, ...)\nJoins: sessoes.aluno_id = alunos.aluno_id\nRegras: excluir escolas de teste (escola_id IN (...))\nConfounders: férias escolares em julho e dezembro/janeiro"
            }
          />
          <div className="mt-2 flex justify-end">
            <button className="btn-ghost" type="submit">Salvar contexto</button>
          </div>
        </form>
      </section>
    </div>
  );
}
