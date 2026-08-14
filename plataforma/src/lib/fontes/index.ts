import { comando } from "./comando";
import { http } from "./http";
import type { Provedor, ResultadoMedicao } from "./types";

export type { Provedor, ResultadoMedicao } from "./types";

/**
 * Registro de provedores. Para plugar um tipo novo de fonte (BigQuery nativo,
 * Mixpanel, Google Sheets…): crie um arquivo neste diretório implementando
 * `Provedor` e adicione-o à lista abaixo. É a única mudança necessária.
 */
const LISTA: Provedor[] = [comando, http];

export const PROVEDORES: ReadonlyMap<string, Provedor> = new Map(
  LISTA.map((p) => [p.tipo, p])
);

export function getProvedor(tipo: string): Provedor {
  const p = PROVEDORES.get(tipo);
  if (!p) throw new Error(`tipo de fonte desconhecido: "${tipo}"`);
  return p;
}

export async function medir(
  fonte: { tipo: string; config: string },
  consulta: string
): Promise<ResultadoMedicao> {
  if (!consulta.trim()) throw new Error("consulta vazia");
  return getProvedor(fonte.tipo).executar(fonte.config, consulta);
}
