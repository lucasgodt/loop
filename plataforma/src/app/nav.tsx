"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Na ordem do loop: métrica → escuta → árvore → priorização → mensuração.
const ITENS = [
  { href: "/", rotulo: "Agora" },
  { href: "/metricas", rotulo: "Métricas" },
  { href: "/entrevistas", rotulo: "Entrevistas" },
  { href: "/sinais", rotulo: "Sinais" },
  { href: "/oportunidades", rotulo: "Oportunidades" },
  { href: "/priorizacao", rotulo: "Priorização" },
  { href: "/lancamentos", rotulo: "Lançamentos" },
  { href: "/fontes", rotulo: "Fontes" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {ITENS.map((item) => {
        const ativo =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-2 text-sm transition ${
              ativo
                ? "bg-accent-soft font-semibold text-accent"
                : "text-ink hover:bg-line/40"
            }`}
          >
            {item.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
