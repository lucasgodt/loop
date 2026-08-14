import type { ReactNode } from "react";

/**
 * Exclusão em dois cliques, sem JavaScript: o resumo abre e só então o botão
 * de confirmação existe. Nada é apagado por clique acidental.
 */
export function Apagar({
  action,
  id,
  rotulo = "apagar",
}: {
  action: (fd: FormData) => Promise<void>;
  id: number;
  rotulo?: string;
}) {
  return (
    <details className="inline-block align-middle">
      <summary className="cursor-pointer list-none font-mono text-[11px] text-muted transition hover:text-danger">
        {rotulo}
      </summary>
      <form action={action} className="mt-1">
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          className="badge cursor-pointer border border-danger bg-danger-soft text-danger"
        >
          confirmar exclusão
        </button>
      </form>
    </details>
  );
}

/** Formulário de edição recolhido atrás de um "editar". */
export function Editar({
  children,
  rotulo = "editar",
}: {
  children: ReactNode;
  rotulo?: string;
}) {
  return (
    <details>
      <summary className="cursor-pointer list-none font-mono text-[11px] text-muted transition hover:text-accent">
        {rotulo}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
