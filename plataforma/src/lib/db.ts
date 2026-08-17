import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "plataforma.db");

// Cada tabela nasce de um passo do board "Loops de produto" — ver ../plataforma.md.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS produto (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS persona (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  produto_id INTEGER NOT NULL REFERENCES produto(id),
  nome TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS passo_jornada (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  produto_id INTEGER NOT NULL REFERENCES produto(id),
  persona_id INTEGER REFERENCES persona(id),
  ordem INTEGER NOT NULL DEFAULT 0,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS metrica_negocio (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  produto_id INTEGER NOT NULL REFERENCES produto(id),
  nome TEXT NOT NULL,
  definicao TEXT NOT NULL DEFAULT '',
  fonte TEXT NOT NULL DEFAULT '',
  unidade TEXT NOT NULL DEFAULT '',
  meta TEXT NOT NULL DEFAULT '',
  valor_atual REAL,
  atualizado_em TEXT
);

CREATE TABLE IF NOT EXISTS metrica_valor (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metrica_id INTEGER NOT NULL REFERENCES metrica_negocio(id),
  valor REAL NOT NULL,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entrevista (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  produto_id INTEGER NOT NULL REFERENCES produto(id),
  data TEXT NOT NULL,
  entrevistado TEXT NOT NULL,
  persona_id INTEGER REFERENCES persona(id),
  link_gravacao TEXT NOT NULL DEFAULT '',
  historia TEXT NOT NULL DEFAULT '',
  notas TEXT NOT NULL DEFAULT '',
  criada_em TEXT NOT NULL
);

-- status: novo | promovido | arquivado
CREATE TABLE IF NOT EXISTS sinal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  produto_id INTEGER NOT NULL REFERENCES produto(id),
  canal TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  data TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'novo',
  criada_em TEXT NOT NULL
);

-- estado: identificada | priorizada | em_discovery | resolvida | arquivada
CREATE TABLE IF NOT EXISTS oportunidade (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  produto_id INTEGER NOT NULL REFERENCES produto(id),
  titulo TEXT NOT NULL,
  persona_id INTEGER REFERENCES persona(id),
  passo_jornada_id INTEGER REFERENCES passo_jornada(id),
  pai_id INTEGER REFERENCES oportunidade(id),
  estado TEXT NOT NULL DEFAULT 'identificada',
  notas TEXT NOT NULL DEFAULT '',
  criada_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evidencia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  oportunidade_id INTEGER NOT NULL REFERENCES oportunidade(id),
  entrevista_id INTEGER REFERENCES entrevista(id),
  sinal_id INTEGER REFERENCES sinal(id),
  criada_em TEXT NOT NULL
);

-- estado: ideia | em_teste | em_desenvolvimento | lancada | descartada
CREATE TABLE IF NOT EXISTS solucao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  produto_id INTEGER NOT NULL REFERENCES produto(id),
  oportunidade_id INTEGER REFERENCES oportunidade(id),
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL DEFAULT 'ideia',
  link_externo TEXT NOT NULL DEFAULT '',
  criada_em TEXT NOT NULL
);

-- veredito: NULL (aberto) | sucesso | fracasso | inconclusivo
CREATE TABLE IF NOT EXISTS lancamento (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  produto_id INTEGER NOT NULL REFERENCES produto(id),
  solucao_id INTEGER REFERENCES solucao(id),
  nome TEXT NOT NULL,
  data_lancamento TEXT,
  hipotese TEXT NOT NULL DEFAULT '',
  metrica_primaria TEXT NOT NULL DEFAULT '',
  metrica_negocio_id INTEGER REFERENCES metrica_negocio(id),
  baseline TEXT NOT NULL DEFAULT '',
  meta TEXT NOT NULL DEFAULT '',
  guardrails TEXT NOT NULL DEFAULT '',
  fonte_dados TEXT NOT NULL DEFAULT '',
  notas TEXT NOT NULL DEFAULT '',
  veredito TEXT,
  aprendizado TEXT NOT NULL DEFAULT '',
  criada_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS revisao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lancamento_id INTEGER NOT NULL REFERENCES lancamento(id),
  rotulo TEXT NOT NULL,
  data_prevista TEXT NOT NULL,
  data_realizada TEXT,
  valor_observado TEXT NOT NULL DEFAULT '',
  notas TEXT NOT NULL DEFAULT ''
);

-- Passo 5 do loop: os 4 grupos de critérios do board (notas 1–5 + justificativa)
CREATE TABLE IF NOT EXISTS avaliacao_oportunidade (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  oportunidade_id INTEGER NOT NULL UNIQUE REFERENCES oportunidade(id),
  tamanho INTEGER,
  tamanho_justif TEXT NOT NULL DEFAULT '',
  companhia INTEGER,
  companhia_justif TEXT NOT NULL DEFAULT '',
  mercado INTEGER,
  mercado_justif TEXT NOT NULL DEFAULT '',
  cliente INTEGER,
  cliente_justif TEXT NOT NULL DEFAULT '',
  decisao TEXT NOT NULL DEFAULT '',
  atualizada_em TEXT
);

-- Passo 7 do loop: o que o cliente TEM que fazer para obter valor da solução
CREATE TABLE IF NOT EXISTS passo_story_map (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  solucao_id INTEGER NOT NULL REFERENCES solucao(id),
  ordem INTEGER NOT NULL DEFAULT 0,
  titulo TEXT NOT NULL
);

-- lente: desejavel | viavel | factivel | usavel | etica
-- estado: mapeada | em_teste | validada | refutada
CREATE TABLE IF NOT EXISTS suposicao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  solucao_id INTEGER NOT NULL REFERENCES solucao(id),
  texto TEXT NOT NULL,
  lente TEXT NOT NULL,
  passo_story_map_id INTEGER REFERENCES passo_story_map(id),
  importancia INTEGER NOT NULL DEFAULT 3,
  evidencia INTEGER NOT NULL DEFAULT 3,
  estado TEXT NOT NULL DEFAULT 'mapeada',
  criada_em TEXT NOT NULL
);

-- Passo 8 do loop. veredito: NULL (aberto) | validada | refutada | inconclusiva
CREATE TABLE IF NOT EXISTS teste_suposicao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  suposicao_id INTEGER NOT NULL REFERENCES suposicao(id),
  metodo TEXT NOT NULL DEFAULT '',
  criterio TEXT NOT NULL,
  resultado TEXT NOT NULL DEFAULT '',
  veredito TEXT,
  aprendizado TEXT NOT NULL DEFAULT '',
  criada_em TEXT NOT NULL,
  concluido_em TEXT
);

-- Fase 3: fontes de dados plugáveis. tipo referencia um Provedor em
-- src/lib/fontes/; config é o JSON de conexão daquele tipo.
CREATE TABLE IF NOT EXISTS fonte_dados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  produto_id INTEGER NOT NULL REFERENCES produto(id),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  criada_em TEXT NOT NULL
);

-- Agentes de IA (ver ../agentes.md). Cada rodada de agente fica auditada aqui.
CREATE TABLE IF NOT EXISTS execucao_agente (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  produto_id INTEGER NOT NULL REFERENCES produto(id),
  agente_id TEXT NOT NULL,
  gatilho TEXT NOT NULL,
  modelo TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ok',
  erro TEXT NOT NULL DEFAULT '',
  tokens_entrada INTEGER,
  tokens_saida INTEGER,
  iniciada_em TEXT NOT NULL,
  concluida_em TEXT
);

-- A sugestão genérica: ação serializada apontando para qualquer entidade.
-- estado: sugerida | aceita | editada | rejeitada | aplicada_auto | falhou
CREATE TABLE IF NOT EXISTS sugestao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  execucao_id INTEGER NOT NULL REFERENCES execucao_agente(id),
  produto_id INTEGER NOT NULL REFERENCES produto(id),
  tipo TEXT NOT NULL,
  alvo_tabela TEXT NOT NULL,
  alvo_id INTEGER,
  payload TEXT NOT NULL,
  resumo TEXT NOT NULL,
  insumos TEXT NOT NULL DEFAULT '[]',
  estado TEXT NOT NULL DEFAULT 'sugerida',
  motivo_rejeicao TEXT NOT NULL DEFAULT '',
  entidade_criada_id INTEGER,
  aplicada_em TEXT,
  criada_em TEXT NOT NULL
);

-- Matéria-prima bruta dos agentes (daily do CS colada, transcrição, thread).
-- Persistida para a citação literal dos sinais ser verificável mecanicamente.
CREATE TABLE IF NOT EXISTS insumo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  produto_id INTEGER NOT NULL REFERENCES produto(id),
  canal TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  criada_em TEXT NOT NULL,
  processado_em TEXT
);

-- O dial de autonomia por agente. modo: desligado | sugere | automatico
CREATE TABLE IF NOT EXISTS agente_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  produto_id INTEGER NOT NULL REFERENCES produto(id),
  agente_id TEXT NOT NULL,
  modo TEXT NOT NULL DEFAULT 'sugere',
  modelo TEXT NOT NULL DEFAULT '',
  config TEXT NOT NULL DEFAULT '{}',
  UNIQUE (produto_id, agente_id)
);

-- Conversas com os conselheiros: chat multi-turno por tópico do loop (uma
-- conversa por tópico por produto). Diferente de sugestão: aqui a IA pensa
-- junto — a decisão continua sendo registrada nas telas do método.
-- alvo_id: 0 = conversa geral do tópico; senão, o id da entidade discutida
-- (ex.: ideação é uma conversa POR oportunidade).
CREATE TABLE IF NOT EXISTS conversa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  produto_id INTEGER NOT NULL REFERENCES produto(id),
  topico TEXT NOT NULL,
  alvo_id INTEGER NOT NULL DEFAULT 0,
  criada_em TEXT NOT NULL,
  UNIQUE (produto_id, topico, alvo_id)
);

-- papel: user | assistant (mapeia direto para a API do provedor)
CREATE TABLE IF NOT EXISTS mensagem_conversa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversa_id INTEGER NOT NULL REFERENCES conversa(id),
  papel TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  criada_em TEXT NOT NULL
);

-- Onde vive o código do produto. O agente executor trabalha SEMPRE num
-- worktree isolado a partir da branch_base — nunca no checkout do dono,
-- nunca com push na branch principal. instrucoes = convenções fixas do repo.
CREATE TABLE IF NOT EXISTS repositorio (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  produto_id INTEGER NOT NULL REFERENCES produto(id),
  nome TEXT NOT NULL,
  caminho_local TEXT NOT NULL,
  branch_base TEXT NOT NULL DEFAULT 'main',
  executor TEXT NOT NULL DEFAULT 'claude-code',
  instrucoes TEXT NOT NULL DEFAULT '',
  criada_em TEXT NOT NULL
);

-- Uma tarefa de PR: o trabalho de código que um agente executa em nome do PM.
-- O PR é a sugestão — mergear é o ato humano, no GitHub. status: fila |
-- rodando | pr_aberto | falhou
CREATE TABLE IF NOT EXISTS tarefa_pr (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  produto_id INTEGER NOT NULL REFERENCES produto(id),
  repositorio_id INTEGER NOT NULL REFERENCES repositorio(id),
  origem_tabela TEXT NOT NULL DEFAULT '',
  origem_id INTEGER,
  titulo TEXT NOT NULL,
  instrucoes TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'fila',
  branch TEXT NOT NULL DEFAULT '',
  pr_url TEXT NOT NULL DEFAULT '',
  log TEXT NOT NULL DEFAULT '',
  criada_em TEXT NOT NULL,
  concluida_em TEXT
);
`;

// Migrações aditivas: colunas novas em tabelas que já existem em bancos criados
// antes delas. CREATE TABLE IF NOT EXISTS não altera tabela existente.
const COLUNAS_NOVAS: [tabela: string, ddl: string][] = [
  ["metrica_negocio", "fonte_dados_id INTEGER REFERENCES fonte_dados(id)"],
  ["metrica_negocio", "consulta TEXT NOT NULL DEFAULT ''"],
  ["lancamento", "fonte_dados_id INTEGER REFERENCES fonte_dados(id)"],
  ["lancamento", "consulta TEXT NOT NULL DEFAULT ''"],
  // contexto de dados do produto (schema do warehouse, joins, confounders) —
  // insumo dos agentes para escrever consultas; configuração, nunca hardcode
  ["produto", "contexto TEXT NOT NULL DEFAULT ''"],
  // plano de instrumentação do lançamento: quais eventos capturar (PostHog)
  // e onde no produto dispará-los — a ponte entre medir e instrumentar
  ["lancamento", "instrumentacao TEXT NOT NULL DEFAULT ''"],
  // transcrição integral da entrevista (colada) — insumo da síntese por agente
  ["entrevista", "transcricao TEXT NOT NULL DEFAULT ''"],
  // quando o insumo nasce de uma entrevista, o vínculo preserva a proveniência
  ["insumo", "entrevista_id INTEGER REFERENCES entrevista(id)"],
  // roteiro do teste: o script da entrevista dirigida ou a consulta do dado histórico
  ["teste_suposicao", "roteiro TEXT NOT NULL DEFAULT ''"],
  // o checklist de onboarding se auto-detecta por query; este flag só o esconde
  // depois de completo (nunca há estado de onboarding que possa dessincronizar)
  ["produto", "onboarding_dispensado INTEGER NOT NULL DEFAULT 0"],
  // mitigação por desenho: a decisão de desenho da solução que elimina o risco
  // sem teste (estado 'mitigada') — vira requisito no brief do Empacotador
  ["suposicao", "mitigacao TEXT NOT NULL DEFAULT ''"],
];

declare global {
  var __plataformaDb: Database.Database | undefined;
}

function open(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const conn = new Database(DB_PATH);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  conn.exec(SCHEMA);
  for (const [tabela, ddl] of COLUNAS_NOVAS) {
    const coluna = ddl.split(" ")[0];
    const existentes = conn.pragma(`table_info(${tabela})`) as { name: string }[];
    if (!existentes.some((c) => c.name === coluna)) {
      conn.exec(`ALTER TABLE ${tabela} ADD COLUMN ${ddl}`);
    }
  }

  // Migração única: conversa ganhou alvo_id no UNIQUE (conversa por entidade).
  // Recriar preservando ids — FKs desligadas para o DROP+RENAME não quebrar a
  // referência de mensagem_conversa.
  const colunasConversa = conn.pragma("table_info(conversa)") as { name: string }[];
  if (colunasConversa.length > 0 && !colunasConversa.some((c) => c.name === "alvo_id")) {
    conn.pragma("foreign_keys = OFF");
    conn.exec(`
      CREATE TABLE conversa_nova (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        produto_id INTEGER NOT NULL REFERENCES produto(id),
        topico TEXT NOT NULL,
        alvo_id INTEGER NOT NULL DEFAULT 0,
        criada_em TEXT NOT NULL,
        UNIQUE (produto_id, topico, alvo_id)
      );
      INSERT INTO conversa_nova (id, produto_id, topico, alvo_id, criada_em)
        SELECT id, produto_id, topico, 0, criada_em FROM conversa;
      DROP TABLE conversa;
      ALTER TABLE conversa_nova RENAME TO conversa;
    `);
    conn.pragma("foreign_keys = ON");
  }
  return conn;
}

export const db: Database.Database =
  globalThis.__plataformaDb ?? (globalThis.__plataformaDb = open());

export function agora(): string {
  return new Date().toISOString();
}

/** Data local no formato YYYY-MM-DD. */
export function hojeLocal(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}

/** Segunda-feira da semana atual, YYYY-MM-DD local. */
export function inicioDaSemana(): string {
  const now = new Date();
  const diasDesdeSegunda = (now.getDay() + 6) % 7;
  const segunda = new Date(now);
  segunda.setDate(now.getDate() - diasDesdeSegunda);
  return hojeLocal(segunda);
}
