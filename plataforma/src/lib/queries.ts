import { db, hojeLocal, inicioDaSemana } from "./db";

export interface Produto {
  id: number;
  nome: string;
  descricao: string;
}

export interface Persona {
  id: number;
  nome: string;
}

export interface PassoJornada {
  id: number;
  persona_id: number | null;
  persona_nome: string | null;
  ordem: number;
  titulo: string;
  descricao: string;
}

export interface Metrica {
  id: number;
  nome: string;
  definicao: string;
  fonte: string;
  unidade: string;
  meta: string;
  valor_atual: number | null;
  atualizado_em: string | null;
}

export interface Entrevista {
  id: number;
  data: string;
  entrevistado: string;
  persona_nome: string | null;
  link_gravacao: string;
  historia: string;
  notas: string;
}

export interface Sinal {
  id: number;
  canal: string;
  conteudo: string;
  data: string;
  status: string;
}

export interface Oportunidade {
  id: number;
  titulo: string;
  persona_id: number | null;
  persona_nome: string | null;
  passo_jornada_id: number | null;
  passo_titulo: string | null;
  pai_id: number | null;
  estado: string;
  notas: string;
  evidencias: number;
  solucoes: number;
}

export interface Solucao {
  id: number;
  oportunidade_id: number | null;
  titulo: string;
  descricao: string;
  estado: string;
  link_externo: string;
}

export interface Lancamento {
  id: number;
  nome: string;
  data_lancamento: string | null;
  hipotese: string;
  metrica_primaria: string;
  metrica_negocio_id: number | null;
  baseline: string;
  meta: string;
  guardrails: string;
  fonte_dados: string;
  notas: string;
  veredito: string | null;
  aprendizado: string;
}

export interface Revisao {
  id: number;
  lancamento_id: number;
  lancamento_nome?: string;
  rotulo: string;
  data_prevista: string;
  data_realizada: string | null;
  valor_observado: string;
  notas: string;
}

/** Workspace único por enquanto — o primeiro produto cadastrado. */
export function getProduto(): Produto | null {
  return (db.prepare("SELECT * FROM produto ORDER BY id LIMIT 1").get() as Produto) ?? null;
}

export function getPersonas(produtoId: number): Persona[] {
  return db
    .prepare("SELECT id, nome FROM persona WHERE produto_id = ? ORDER BY id")
    .all(produtoId) as Persona[];
}

export function getPassosJornada(produtoId: number): PassoJornada[] {
  return db
    .prepare(
      `SELECT pj.id, pj.persona_id, p.nome AS persona_nome, pj.ordem, pj.titulo, pj.descricao
       FROM passo_jornada pj LEFT JOIN persona p ON p.id = pj.persona_id
       WHERE pj.produto_id = ? ORDER BY p.nome, pj.ordem, pj.id`
    )
    .all(produtoId) as PassoJornada[];
}

export function getMetricas(produtoId: number): Metrica[] {
  return db
    .prepare("SELECT * FROM metrica_negocio WHERE produto_id = ? ORDER BY id")
    .all(produtoId) as Metrica[];
}

export function getHistoricoMetrica(metricaId: number): { valor: number; data: string }[] {
  return db
    .prepare("SELECT valor, data FROM metrica_valor WHERE metrica_id = ? ORDER BY data")
    .all(metricaId) as { valor: number; data: string }[];
}

export function getEntrevistas(produtoId: number): Entrevista[] {
  return db
    .prepare(
      `SELECT e.id, e.data, e.entrevistado, p.nome AS persona_nome, e.link_gravacao, e.historia, e.notas
       FROM entrevista e LEFT JOIN persona p ON p.id = e.persona_id
       WHERE e.produto_id = ? ORDER BY e.data DESC, e.id DESC`
    )
    .all(produtoId) as Entrevista[];
}

export function entrevistasNaSemana(produtoId: number): number {
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM entrevista WHERE produto_id = ? AND data >= ?")
    .get(produtoId, inicioDaSemana()) as { n: number };
  return row.n;
}

export function getSinais(produtoId: number, status?: string): Sinal[] {
  if (status) {
    return db
      .prepare(
        "SELECT id, canal, conteudo, data, status FROM sinal WHERE produto_id = ? AND status = ? ORDER BY data DESC, id DESC"
      )
      .all(produtoId, status) as Sinal[];
  }
  return db
    .prepare(
      "SELECT id, canal, conteudo, data, status FROM sinal WHERE produto_id = ? ORDER BY CASE status WHEN 'novo' THEN 0 ELSE 1 END, data DESC, id DESC"
    )
    .all(produtoId) as Sinal[];
}

export function sinaisNovos(produtoId: number): number {
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM sinal WHERE produto_id = ? AND status = 'novo'")
    .get(produtoId) as { n: number };
  return row.n;
}

const OPORTUNIDADE_SELECT = `
  SELECT o.id, o.titulo, o.persona_id, p.nome AS persona_nome,
         o.passo_jornada_id, pj.titulo AS passo_titulo, o.pai_id, o.estado, o.notas,
         (SELECT COUNT(*) FROM evidencia ev WHERE ev.oportunidade_id = o.id) AS evidencias,
         (SELECT COUNT(*) FROM solucao s WHERE s.oportunidade_id = o.id) AS solucoes
  FROM oportunidade o
  LEFT JOIN persona p ON p.id = o.persona_id
  LEFT JOIN passo_jornada pj ON pj.id = o.passo_jornada_id
`;

export function getOportunidades(produtoId: number): Oportunidade[] {
  return db
    .prepare(`${OPORTUNIDADE_SELECT} WHERE o.produto_id = ? ORDER BY o.id`)
    .all(produtoId) as Oportunidade[];
}

export function oportunidadesEmDiscovery(produtoId: number): Oportunidade[] {
  return db
    .prepare(`${OPORTUNIDADE_SELECT} WHERE o.produto_id = ? AND o.estado = 'em_discovery' ORDER BY o.id`)
    .all(produtoId) as Oportunidade[];
}

export function getSolucoes(oportunidadeId: number): Solucao[] {
  return db
    .prepare(
      "SELECT id, oportunidade_id, titulo, descricao, estado, link_externo FROM solucao WHERE oportunidade_id = ? ORDER BY id"
    )
    .all(oportunidadeId) as Solucao[];
}

export function getLancamentos(produtoId: number): Lancamento[] {
  return db
    .prepare("SELECT * FROM lancamento WHERE produto_id = ? ORDER BY data_lancamento IS NULL DESC, data_lancamento DESC")
    .all(produtoId) as Lancamento[];
}

export function getLancamento(id: number): Lancamento | null {
  return (db.prepare("SELECT * FROM lancamento WHERE id = ?").get(id) as Lancamento) ?? null;
}

export function getRevisoes(lancamentoId: number): Revisao[] {
  return db
    .prepare("SELECT * FROM revisao WHERE lancamento_id = ? ORDER BY data_prevista")
    .all(lancamentoId) as Revisao[];
}

export function revisoesAtrasadas(produtoId: number): Revisao[] {
  return db
    .prepare(
      `SELECT r.*, l.nome AS lancamento_nome
       FROM revisao r JOIN lancamento l ON l.id = r.lancamento_id
       WHERE l.produto_id = ? AND r.data_realizada IS NULL AND r.data_prevista < ?
       ORDER BY r.data_prevista`
    )
    .all(produtoId, hojeLocal()) as Revisao[];
}

export function proximasRevisoes(produtoId: number, dias = 7): Revisao[] {
  const limite = new Date();
  limite.setDate(limite.getDate() + dias);
  return db
    .prepare(
      `SELECT r.*, l.nome AS lancamento_nome
       FROM revisao r JOIN lancamento l ON l.id = r.lancamento_id
       WHERE l.produto_id = ? AND r.data_realizada IS NULL AND r.data_prevista >= ? AND r.data_prevista <= ?
       ORDER BY r.data_prevista`
    )
    .all(produtoId, hojeLocal(), hojeLocal(limite)) as Revisao[];
}

export interface DividaMedicao {
  lancamento: Lancamento;
  pendencias: string[];
}

/** Lançamentos com medição incompleta — a dívida que a home cobra. */
export function dividasDeMedicao(produtoId: number): DividaMedicao[] {
  const resultado: DividaMedicao[] = [];
  for (const l of getLancamentos(produtoId)) {
    if (l.veredito) continue;
    const pendencias: string[] = [];
    if (!l.metrica_primaria) pendencias.push("sem métrica primária");
    if (!l.data_lancamento) pendencias.push("sem data de lançamento");
    if (l.metrica_primaria && !l.baseline) pendencias.push("sem baseline");
    if (l.metrica_primaria && !l.meta) pendencias.push("sem meta");
    if (pendencias.length > 0) resultado.push({ lancamento: l, pendencias });
  }
  return resultado;
}

export function diasDeAtraso(dataPrevista: string): number {
  const prevista = new Date(`${dataPrevista}T00:00:00`);
  const hoje = new Date(`${hojeLocal()}T00:00:00`);
  return Math.round((hoje.getTime() - prevista.getTime()) / 86_400_000);
}
