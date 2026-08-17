import Link from "next/link";
import { dispensarOnboarding } from "@/app/actions";
import { estadoOnboarding } from "@/lib/onboarding";

/**
 * O checklist de onboarding da home: a ordem do loop como caminho de
 * configuração. Cada item se marca sozinho por auto-detecção (query no banco)
 * — nunca por clique — e linka para a tela onde o passo acontece.
 */
export function ChecklistOnboarding({ produtoId }: { produtoId: number }) {
  const estado = estadoOnboarding(produtoId);
  if (estado.dispensado) return null;

  return (
    <div className="card mt-6 border-accent">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="lbl">Comece por aqui — o loop em {estado.total} passos</div>
          <p className="mt-1 text-sm text-muted">
            A ordem do checklist é a ordem do método: cada item se marca sozinho
            quando o dado existe de verdade.{" "}
            <Link href="/guia" className="font-semibold text-accent underline">
              Como usar a plataforma →
            </Link>
          </p>
        </div>
        <span className="font-mono text-2xl tabular-nums text-accent">
          {estado.feitos}
          <span className="text-sm text-muted">/{estado.total}</span>
        </span>
      </div>

      <ol className="mt-3 space-y-2.5">
        {estado.itens.map((item, i) => (
          <li key={item.id} className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[11px] ${
                item.ok ? "bg-accent text-paper" : "border border-line text-muted"
              }`}
            >
              {item.ok ? "✓" : i + 1}
            </span>
            <div className={item.ok ? "opacity-55" : ""}>
              <Link
                href={item.link}
                className={`text-sm font-semibold hover:text-accent ${
                  item.ok ? "line-through decoration-1" : ""
                }`}
              >
                {item.titulo}
              </Link>
              {item.opcional && !item.ok && (
                <span className="badge ml-2 bg-line/60 text-muted">opcional</span>
              )}
              {!item.ok && <p className="mt-0.5 max-w-2xl text-xs text-muted">{item.porque}</p>}
            </div>
          </li>
        ))}
      </ol>

      {estado.completo && (
        <form
          action={dispensarOnboarding}
          className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3"
        >
          <input type="hidden" name="id" value={produtoId} />
          <span className="text-sm text-accent">
            O loop está rodando. Daqui em diante a home cobra o que importa: cadência,
            triagem e medição.
          </span>
          <button className="btn-ghost" type="submit">dispensar checklist</button>
        </form>
      )}
    </div>
  );
}
