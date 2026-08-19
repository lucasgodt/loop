import { limparConversa } from "@/app/actions";
import { FormConversa } from "@/app/conversa-form";
import { temChaveDeIA } from "@/lib/agentes/cliente-ia";
import { conversaDoTopico, getConselheiro, mensagensDaConversa } from "@/lib/conselheiros";
import { db } from "@/lib/db";

/**
 * O card de conversa com um conselheiro: chat multi-turno persistido, com o
 * contexto do workspace injetado — o PM não precisa se apresentar. Quando o
 * conselheiro usa uma ferramenta, a proposta vira card de sugestão na página.
 */
export function Conversa({
  produtoId,
  topico,
  volta,
  alvoId = 0,
}: {
  produtoId: number;
  topico: string;
  volta: string;
  /** > 0 quando a conversa é por entidade (ex.: ideação por oportunidade). */
  alvoId?: number;
}) {
  const conselheiro = getConselheiro(topico);
  if (!temChaveDeIA()) {
    return (
      <p className="mt-4 text-xs text-muted">
        💬 O {conselheiro.rotulo} pensa junto sobre este passo — configure{" "}
        <code className="font-mono">OPENAI_API_KEY</code> no .env.local para conversar.
      </p>
    );
  }

  // Só cria a linha da conversa quando a primeira mensagem chegar.
  const existente = db
    .prepare("SELECT id FROM conversa WHERE produto_id = ? AND topico = ? AND alvo_id = ?")
    .get(produtoId, topico, alvoId) as { id: number } | undefined;
  const mensagens = existente
    ? mensagensDaConversa(conversaDoTopico(produtoId, topico, alvoId))
    : [];

  return (
    <section className="card mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="lbl">💬 {conselheiro.rotulo}</div>
        {mensagens.length > 0 && (
          <form action={limparConversa}>
            <input type="hidden" name="produto_id" value={produtoId} />
            <input type="hidden" name="topico" value={topico} />
            <input type="hidden" name="alvo_id" value={alvoId} />
            <input type="hidden" name="volta" value={volta} />
            <button className="font-mono text-xs text-muted hover:text-danger" type="submit">
              recomeçar conversa
            </button>
          </form>
        )}
      </div>

      {mensagens.length === 0 ? (
        <p className="mt-2 max-w-2xl text-sm text-muted">{conselheiro.convite}</p>
      ) : (
        // flex-col-reverse com um único filho: o scroll nasce ancorado no FIM
        // da conversa (a mensagem mais nova), sem precisar de JS.
        <div className="mt-3 flex max-h-[28rem] flex-col-reverse overflow-y-auto pr-1">
          <div className="space-y-3">
            {mensagens.map((m) => (
              <div key={m.id} className={m.papel === "user" ? "flex justify-end" : "flex"}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.papel === "user" ? "bg-accent-soft" : "bg-line/40"
                  }`}
                >
                  {m.conteudo}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <FormConversa
        produtoId={produtoId}
        topico={topico}
        alvoId={alvoId}
        volta={volta}
        placeholder={
          mensagens.length === 0
            ? "ex.: na sua opinião, usuários ativos semanais serve como lagging nº 1?"
            : "responder…"
        }
      />
      <p className="mt-2 text-xs text-muted">
        A conversa fica salva. Peça &quot;preenche pra mim&quot; quando convergir — a
        proposta vira um card para você aceitar; a decisão continua sua.
      </p>
    </section>
  );
}
