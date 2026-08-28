import { agenteDeRisco } from "./agente-de-risco";
import { arquiteto } from "./arquiteto";
import { comparador } from "./comparador";
import { empacotador } from "./empacotador";
import { fechadorDeLoop } from "./fechador-de-loop";
import { organizador } from "./organizador";
import { provocador } from "./provocador";
import { redatorAvaliacao } from "./redator-avaliacao";
import { roteirista } from "./roteirista";
import { triador } from "./triador";
import type { Agente } from "./types";

export type { Agente, ContextoAgente, Proposta, RefInsumo } from "./types";

/**
 * Registro de agentes. Plugar um agente novo = criar o arquivo (+ prompt em
 * prompts/) e adicioná-lo à lista. Nada mais no app muda — mesma filosofia
 * do registro de provedores em src/lib/fontes/.
 */
const LISTA: Agente[] = [
  fechadorDeLoop,
  triador,
  roteirista,
  redatorAvaliacao,
  provocador,
  comparador,
  organizador,
  agenteDeRisco,
  arquiteto,
  empacotador,
];

export const AGENTES: ReadonlyMap<string, Agente> = new Map(LISTA.map((a) => [a.id, a]));

export function getAgente(id: string): Agente {
  const a = AGENTES.get(id);
  if (!a) throw new Error(`agente desconhecido: "${id}"`);
  return a;
}
