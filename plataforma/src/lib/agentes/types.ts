import type Database from "better-sqlite3";

/**
 * Contrato de um agente de IA (ver ../../../../agentes.md).
 *
 * Mesma filosofia das fontes: a plataforma não sabe o que é OpenAI ou Claude —
 * só conhece este contrato. O agente NUNCA escreve direto nas tabelas de
 * entidade: ele devolve Propostas, que viram registros na tabela `sugestao`
 * e só se materializam pelo aplicador (as mesmas mutações do fluxo manual).
 */

/** Referência a um insumo lido pelo agente (proveniência). */
export interface RefInsumo {
  tabela: string;
  registroId: number;
}

/** O que o agente propõe. */
export interface Proposta {
  tipo: string; // ex.: "rascunhar_ficha"
  alvoTabela: string; // ex.: "lancamento"
  alvoId: number | null; // null = criação de entidade nova
  payload: unknown; // os campos propostos (o rascunho editável)
  resumo: string; // uma frase para o inbox de sugestões
  insumos: RefInsumo[];
}

/**
 * Função de IA INJETADA — o agente nunca importa SDK nenhum.
 * Implementada em cliente-ia.ts (OpenAI, structured outputs).
 */
export type GerarEstruturado = (args: {
  sistema: string;
  usuario: string;
  nomeSchema: string;
  schema: Record<string, unknown>; // JSON Schema da saída (strict)
}) => Promise<{
  saida: unknown;
  modelo: string;
  tokensEntrada: number;
  tokensSaida: number;
}>;

export interface ContextoAgente {
  db: Database.Database;
  produtoId: number;
  /** Alvo específico quando o agente roda sobre uma entidade (ex.: lancamento). */
  alvoId?: number;
  gerar: GerarEstruturado;
}

export interface Agente {
  id: string; // vai para agente_config.agente_id e execucao_agente.agente_id
  nome: string;
  descricao: string;
  passoDoLoop: number; // 1..10
  executar(ctx: ContextoAgente): Promise<Proposta[]>;
}
