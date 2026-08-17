import { claudeCode } from "./claude-code";
import { codex } from "./codex";
import type { Executor } from "./types";

export type { Executor } from "./types";

const LISTA: Executor[] = [claudeCode, codex];

export const EXECUTORES: ReadonlyMap<string, Executor> = new Map(LISTA.map((e) => [e.tipo, e]));

export function getExecutor(tipo: string): Executor {
  const e = EXECUTORES.get(tipo);
  if (!e) throw new Error(`executor desconhecido: "${tipo}" (existem: ${[...EXECUTORES.keys()].join(", ")})`);
  return e;
}
