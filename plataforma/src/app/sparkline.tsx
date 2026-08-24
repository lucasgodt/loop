/** Sparkline SVG server-side — sem JS de cliente, tema via currentColor. */
export function Sparkline({
  valores,
  largura = 280,
  altura = 48,
}: {
  valores: number[];
  largura?: number;
  altura?: number;
}) {
  if (valores.length < 2) return null;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const faixa = max - min || 1;
  const passo = largura / (valores.length - 1);
  const pontos = valores
    .map((v, i) => `${(i * passo).toFixed(1)},${(altura - 4 - ((v - min) / faixa) * (altura - 8)).toFixed(1)}`)
    .join(" ");
  const ultimo = pontos.split(" ").at(-1)!.split(",");

  return (
    <svg
      viewBox={`0 0 ${largura} ${altura}`}
      width={largura}
      height={altura}
      className="text-accent"
      role="img"
      aria-label={`série de ${valores.length} medições, de ${min} a ${max}`}
    >
      <polyline
        points={pontos}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={ultimo[0]} cy={ultimo[1]} r="3" fill="currentColor" />
    </svg>
  );
}
