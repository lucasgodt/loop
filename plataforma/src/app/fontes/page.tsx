import {
  apagarFonte,
  apagarPersona,
  apagarRepositorio,
  atualizarContextoProduto,
  atualizarFonte,
  atualizarProduto,
  atualizarRepositorio,
  criarFonte,
  criarPersona,
  criarRepositorio,
} from "@/app/actions";
import { Apagar, Editar } from "@/app/ui";
import { EXECUTORES } from "@/lib/executores";
import { PROVEDORES } from "@/lib/fontes";
import { getFontes, getPersonas, getProduto, getRepositorios, usosDaFonte } from "@/lib/queries";

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

      <section className="mt-6">
        <h2 className="lbl">Workspace — o produto e quem o usa</h2>
        <div className="card grid grid-cols-1 gap-4 md:grid-cols-2">
          <form action={atualizarProduto} className="space-y-2">
            <input type="hidden" name="id" value={produto.id} />
            <div>
              <label className="lbl" htmlFor="p-nome">Produto</label>
              <input id="p-nome" name="nome" defaultValue={produto.nome} required className="field" />
            </div>
            <div>
              <label className="lbl" htmlFor="p-desc">Descrição — o que ele faz, para quem</label>
              <textarea id="p-desc" name="descricao" rows={3} defaultValue={produto.descricao} className="field" />
            </div>
            <div className="flex justify-end">
              <button className="btn-ghost" type="submit">Salvar</button>
            </div>
          </form>
          <div>
            <div className="lbl">Personas</div>
            <ul className="mt-1 space-y-1">
              {getPersonas(produto.id).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  {p.nome}
                  <Apagar action={apagarPersona} id={p.id} />
                </li>
              ))}
            </ul>
            <form action={criarPersona} className="mt-2 flex gap-2">
              <input type="hidden" name="produto_id" value={produto.id} />
              <input name="nome" required className="field flex-1" placeholder="ex.: Coordenadora pedagógica" />
              <button className="btn-ghost" type="submit">+ persona</button>
            </form>
          </div>
        </div>
      </section>

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
          <input id="nome" name="nome" required className="field" placeholder="ex.: BigQuery produção" />
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
          <strong>O padrão é o PostHog</strong>: métricas de produto viram eventos
          capturados lá, e o plano de instrumentação faz parte da ficha de cada
          lançamento. As outras fontes são válvula de escape — um warehouse SQL
          pluga pelo tipo <strong>comando</strong> (via{" "}
          <code className="font-mono">bq query</code>) e serve principalmente para
          baselines históricas de antes da instrumentação.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="lbl">Repositórios — onde vive o código (para os PRs do agente)</h2>
        <p className="mb-3 max-w-xl text-sm text-muted">
          Com um repositório plugado, os botões <strong>via PR</strong> aparecem na ficha
          do lançamento (instrumentação) e na solução (implementação). O agente trabalha
          num worktree isolado, abre branch própria e propõe um PR pelo{" "}
          <code className="font-mono text-xs">gh</code> —{" "}
          <strong>mergear é sempre decisão sua, no GitHub</strong>.
        </p>
        <ul className="space-y-3">
          {getRepositorios(produto.id).map((r) => (
            <li key={r.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{r.nome}</span>
                <div className="flex items-center gap-2">
                  <span className="badge bg-accent-soft text-accent">{r.executor}</span>
                  <span className="badge bg-line/60 text-muted">base: {r.branch_base}</span>
                  <Apagar action={apagarRepositorio} id={r.id} />
                </div>
              </div>
              <p className="mt-1 break-all font-mono text-xs text-muted">{r.caminho_local}</p>
              <div className="mt-2">
                <Editar>
                  <form action={atualizarRepositorio} className="grid grid-cols-1 gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <div className="flex flex-wrap gap-2">
                      <input name="nome" defaultValue={r.nome} required className="field flex-1" />
                      <input name="branch_base" defaultValue={r.branch_base} className="field w-32" />
                      <select name="executor" defaultValue={r.executor} className="field w-auto">
                        {[...EXECUTORES.values()].map((e) => (
                          <option key={e.tipo} value={e.tipo}>{e.rotulo}</option>
                        ))}
                      </select>
                    </div>
                    <input name="caminho_local" defaultValue={r.caminho_local} className="field font-mono text-xs" />
                    <textarea
                      name="instrucoes"
                      rows={3}
                      defaultValue={r.instrucoes}
                      className="field font-mono text-xs"
                      placeholder="convenções do repo que todo PR deve seguir"
                    />
                    <div className="flex justify-end">
                      <button className="btn-ghost" type="submit">Salvar</button>
                    </div>
                  </form>
                </Editar>
              </div>
            </li>
          ))}
        </ul>
        <form action={criarRepositorio} className="card mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <input type="hidden" name="produto_id" value={produto.id} />
          <div className="md:col-span-3">
            <h3 className="lbl">Plugar repositório</h3>
          </div>
          <div>
            <label className="lbl" htmlFor="r-nome">Nome</label>
            <input id="r-nome" name="nome" required className="field" placeholder="ex.: app principal" />
          </div>
          <div>
            <label className="lbl" htmlFor="r-branch">Branch base</label>
            <input id="r-branch" name="branch_base" className="field" placeholder="main" />
          </div>
          <div>
            <label className="lbl" htmlFor="r-executor">Executor de código</label>
            <select id="r-executor" name="executor" className="field">
              {[...EXECUTORES.values()].map((e) => (
                <option key={e.tipo} value={e.tipo}>
                  {e.rotulo}{e.disponivel() ? "" : " (não instalado)"}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="lbl" htmlFor="r-caminho">Caminho local do clone (com remote no GitHub)</label>
            <input
              id="r-caminho"
              name="caminho_local"
              required
              className="field font-mono text-xs"
              placeholder="/Users/você/projetos/meu-app"
            />
          </div>
          <div className="md:col-span-3">
            <label className="lbl" htmlFor="r-instrucoes">Convenções do repo (vão em todo PR)</label>
            <textarea
              id="r-instrucoes"
              name="instrucoes"
              rows={3}
              className="field font-mono text-xs"
              placeholder={"ex.: eventos PostHog nomeados entidade_acao; capture via lib/analytics.ts, nunca posthog direto; UI em pt-BR"}
            />
          </div>
          <div className="md:col-span-3 flex justify-end">
            <button className="btn" type="submit">Plugar repositório</button>
          </div>
        </form>
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
              "ex.:\nDataset: meu-projeto.analytics\n- tabela alunos (aluno_id, escola_id, criado_em)\n- tabela sessoes (aluno_id, iniciada_em, ...)\nJoins: sessoes.aluno_id = alunos.aluno_id\nRegras: excluir escolas de teste (escola_id IN (...))\nConfounders: férias escolares em julho e dezembro/janeiro"
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
