import { temChaveDeIA } from "./agentes/cliente-ia";
import { db } from "./db";

/**
 * Onboarding guiado: da plataforma vazia ao loop rodando.
 *
 * A regra que importa: cada item se marca SOZINHO por auto-detecção — a query
 * correspondente retorna dado — nunca por clique. Não existe estado de
 * onboarding que possa dessincronizar do banco; o único flag é
 * produto.onboarding_dispensado, que esconde o checklist depois de completo.
 *
 * A ordem dos itens é a ordem do loop: configurar já ensina o método.
 */

export interface ItemOnboarding {
  id: string;
  titulo: string;
  /** A educação embutida: por que essa ordem importa, em 1–2 frases. */
  porque: string;
  link: string;
  rotuloLink: string;
  opcional?: boolean;
  feito(produtoId: number): boolean;
}

const n = (sql: string, ...params: unknown[]): number =>
  (db.prepare(sql).get(...params) as { n: number }).n;

export const ITENS_ONBOARDING: ItemOnboarding[] = [
  {
    id: "workspace",
    titulo: "Descrever o produto e suas personas",
    porque:
      "Tudo na plataforma pendura num produto e em quem o usa. Sem personas não há jornada; sem jornada, a árvore de oportunidades não tem onde ancorar.",
    link: "/fontes",
    rotuloLink: "workspace",
    feito(produtoId) {
      const p = db
        .prepare("SELECT descricao FROM produto WHERE id = ?")
        .get(produtoId) as { descricao: string } | undefined;
      return !!p?.descricao?.trim() && n("SELECT COUNT(*) AS n FROM persona WHERE produto_id = ?", produtoId) > 0;
    },
  },
  {
    id: "metrica",
    titulo: "Escolher a métrica de negócio nº 1 — e dar uma meta a ela",
    porque:
      "O loop começa e termina aqui: a métrica lagging é o que o negócio quer mover. Definir a meta é o ato de escolher qual delas é a nº 1 — sem isso, todo lançamento mede contra o nada.",
    link: "/metricas",
    rotuloLink: "métricas",
    feito(produtoId) {
      return (
        n(
          "SELECT COUNT(*) AS n FROM metrica_negocio WHERE produto_id = ? AND (meta != '' OR valor_atual IS NOT NULL)",
          produtoId
        ) > 0
      );
    },
  },
  {
    id: "jornada",
    titulo: "Mapear a jornada mínima de uma persona (3+ passos)",
    porque:
      "A jornada é o esqueleto da árvore: cada oportunidade nasce pendurada no passo onde a dor acontece. Três passos bastam para começar — refina depois, com o que as entrevistas ensinarem.",
    link: "/oportunidades",
    rotuloLink: "oportunidades",
    feito(produtoId) {
      return (
        n(
          `SELECT COALESCE(MAX(c), 0) AS n FROM (
             SELECT COUNT(*) AS c FROM passo_jornada WHERE produto_id = ? GROUP BY persona_id
           )`,
          produtoId
        ) >= 3
      );
    },
  },
  {
    id: "fonte",
    titulo: "Plugar o PostHog e escrever o contexto de dados",
    porque:
      "O padrão da casa: métricas viram eventos no PostHog e os agentes escrevem as consultas — mas só se o contexto de dados disser o que existe. Sem contexto, o Fechador se recusa a inventar SQL.",
    link: "/fontes",
    rotuloLink: "fontes",
    feito(produtoId) {
      const p = db
        .prepare("SELECT contexto FROM produto WHERE id = ?")
        .get(produtoId) as { contexto: string } | undefined;
      return (
        n("SELECT COUNT(*) AS n FROM fonte_dados WHERE produto_id = ?", produtoId) > 0 &&
        !!p?.contexto?.trim()
      );
    },
  },
  {
    id: "chave_ia",
    titulo: "Configurar a chave de IA (opcional — liga os agentes)",
    porque:
      "Tudo funciona manualmente sem ela. Com ela, cada passo do loop ganha um assistente que propõe — e você aprova. OPENAI_API_KEY no .env.local da plataforma.",
    link: "/entrevistas",
    rotuloLink: "onde os agentes moram",
    opcional: true,
    feito() {
      return temChaveDeIA();
    },
  },
  {
    id: "sinal",
    titulo: "Capturar o primeiro sinal (ou triar o primeiro insumo)",
    porque:
      "Sinais são a escuta contínua: o que o CS ouve, o que as escolas reclamam. Cole uma daily inteira na caixa de triagem e deixe o Triador propor os sinais — ou registre um na mão.",
    link: "/sinais",
    rotuloLink: "sinais",
    feito(produtoId) {
      return (
        n("SELECT COUNT(*) AS n FROM sinal WHERE produto_id = ?", produtoId) > 0 ||
        n("SELECT COUNT(*) AS n FROM insumo WHERE produto_id = ?", produtoId) > 0
      );
    },
  },
  {
    id: "oportunidade",
    titulo: "Subir a primeira oportunidade na árvore — com evidência",
    porque:
      "Oportunidade sem evidência é palpite, e o sistema trata como tal. Promova um sinal ou uma entrevista: a oportunidade nasce ancorada no que alguém realmente disse.",
    link: "/oportunidades",
    rotuloLink: "árvore",
    feito(produtoId) {
      return (
        n(
          `SELECT COUNT(*) AS n FROM oportunidade o
           WHERE o.produto_id = ? AND EXISTS (SELECT 1 FROM evidencia ev WHERE ev.oportunidade_id = o.id)`,
          produtoId
        ) > 0
      );
    },
  },
  {
    id: "ficha",
    titulo: "Preencher a primeira ficha de lançamento",
    porque:
      "A dívida que motivou a plataforma: lançar sem métrica de sucesso. A ficha exige hipótese, métrica primária, baseline e meta ANTES — o Fechador de Loop rascunha tudo se a chave de IA estiver ligada.",
    link: "/lancamentos",
    rotuloLink: "lançamentos",
    feito(produtoId) {
      return (
        n(
          "SELECT COUNT(*) AS n FROM lancamento WHERE produto_id = ? AND metrica_primaria != '' AND meta != ''",
          produtoId
        ) > 0
      );
    },
  },
  {
    id: "entrevista",
    titulo: "Registrar a primeira entrevista",
    porque:
      "Uma história por semana é o motor do loop inteiro — sem escuta contínua, a árvore fossiliza. Registre a conversa, cole a transcrição e deixe a síntese virar sinais.",
    link: "/entrevistas",
    rotuloLink: "entrevistas",
    feito(produtoId) {
      return n("SELECT COUNT(*) AS n FROM entrevista WHERE produto_id = ?", produtoId) > 0;
    },
  },
];

export interface EstadoOnboarding {
  itens: (ItemOnboarding & { ok: boolean })[];
  feitos: number;
  total: number;
  completo: boolean;
  dispensado: boolean;
}

export function estadoOnboarding(produtoId: number): EstadoOnboarding {
  const itens = ITENS_ONBOARDING.map((i) => ({ ...i, ok: i.feito(produtoId) }));
  const obrigatorios = itens.filter((i) => !i.opcional);
  const p = db
    .prepare("SELECT onboarding_dispensado FROM produto WHERE id = ?")
    .get(produtoId) as { onboarding_dispensado: number } | undefined;
  return {
    itens,
    feitos: itens.filter((i) => i.ok).length,
    total: itens.length,
    completo: obrigatorios.every((i) => i.ok),
    dispensado: !!p?.onboarding_dispensado,
  };
}
