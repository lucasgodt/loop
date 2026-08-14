/**
 * Contrato de um provedor de fonte de dados.
 *
 * A plataforma não sabe o que é BigQuery, Mixpanel ou planilha — ela só conhece
 * este contrato. Cada tipo de fonte é um arquivo neste diretório que o
 * implementa; plugar um tipo novo é criar o arquivo e registrá-lo em
 * `index.ts`. Nada mais no app muda.
 */
export interface ResultadoMedicao {
  valor: number;
  /** Contexto legível do que foi executado (vira nota da medição). */
  detalhe: string;
}

export interface Provedor {
  /** Identificador armazenado em fonte_dados.tipo (ex.: "comando"). */
  tipo: string;
  rotulo: string;
  /** Como o provedor funciona, mostrado na página de fontes. */
  descricao: string;
  /** Exemplo do JSON de config da fonte (conexão/autenticação). */
  configExemplo: string;
  /** Exemplo da consulta por métrica/lançamento. */
  consultaExemplo: string;
  /**
   * Executa a consulta contra a fonte e devolve um número.
   * `config` é o JSON cru salvo na fonte; `consulta` é o texto salvo na
   * métrica ou no lançamento.
   */
  executar(config: string, consulta: string): Promise<ResultadoMedicao>;
}
