import Link from "next/link";

const PASSOS = [
  { n: 1, rotulo: "Métrica de negócio", href: "/metricas" },
  { n: 2, rotulo: "Jornada", href: "/oportunidades" },
  { n: 3, rotulo: "Entrevistas + sinais", href: "/entrevistas" },
  { n: 4, rotulo: "Árvore", href: "/oportunidades" },
  { n: 5, rotulo: "Priorização", href: "/priorizacao" },
  { n: 6, rotulo: "Ideação (3+)", href: "/priorizacao" },
  { n: 7, rotulo: "Suposições", href: "/priorizacao" },
  { n: 8, rotulo: "Testes", href: "/priorizacao" },
  { n: 9, rotulo: "Desenvolvimento", href: "/lancamentos" },
  { n: 10, rotulo: "Mensuração", href: "/lancamentos" },
];

/** A ordem do board, sempre visível: começa na métrica, termina na mensuração
 *  que aponta de volta para a métrica. */
export function LoopStrip() {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-y-2 font-mono text-[11px]">
      {PASSOS.map((p, i) => (
        <span key={p.n} className="flex items-center">
          <Link
            href={p.href}
            className="group flex items-center gap-1.5 rounded-full border border-line bg-card px-2.5 py-1 transition hover:border-accent"
          >
            <span className="text-muted group-hover:text-accent">{p.n}</span>
            <span className="tracking-tight group-hover:text-accent">{p.rotulo}</span>
          </Link>
          {i < PASSOS.length - 1 && <span className="px-1 text-muted">→</span>}
        </span>
      ))}
      <span className="px-1 text-muted">⟲</span>
      <span className="text-muted">volta ao 1</span>
    </div>
  );
}
