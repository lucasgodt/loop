import { agora, db, hojeLocal } from "@/lib/db";

/**
 * O aplicador: materializa uma sugestão aprovada usando as MESMAS mutações do
 * fluxo manual. Os portões do funil valem aqui por construção — oportunidade
 * nasce com evidência, agente nunca promove estado, veredito nunca é gravado
 * por agente. Agente não tem outro caminho de escrita.
 */

interface SinalProposto {
  conteudo: string;
  trecho_fonte: string;
}

export function aplicarSugestao(
  id: number,
  extras: { tituloOverride?: string } = {}
): void {
  const sugestao = db.prepare("SELECT * FROM sugestao WHERE id = ?").get(id) as
    | {
        id: number;
        produto_id: number;
        tipo: string;
        alvo_id: number | null;
        payload: string;
        estado: string;
      }
    | undefined;
  if (!sugestao || sugestao.estado !== "sugerida") return;

  const p = JSON.parse(sugestao.payload) as Record<string, unknown>;
  let entidadeCriadaId: number | null = null;

  const criarSinais = (sinais: SinalProposto[], canal: string, status: string): number[] =>
    sinais.map((s) =>
      Number(
        db
          .prepare(
            "INSERT INTO sinal (produto_id, canal, conteudo, data, status, criada_em) VALUES (?, ?, ?, ?, ?, ?)"
          )
          .run(sugestao.produto_id, canal, s.conteudo, hojeLocal(), status, agora())
          .lastInsertRowid
      )
    );
  const ligarEvidencia = (oportunidadeId: number, sinalId: number) =>
    db
      .prepare("INSERT INTO evidencia (oportunidade_id, sinal_id, criada_em) VALUES (?, ?, ?)")
      .run(oportunidadeId, sinalId, agora());

  db.transaction(() => {
    switch (sugestao.tipo) {
      // Fechador de Loop: preenche a ficha do lançamento (campos seguem editáveis).
      case "rascunhar_ficha": {
        if (!sugestao.alvo_id) throw new Error("sugestão sem lançamento alvo");
        const atual = db
          .prepare("SELECT * FROM lancamento WHERE id = ?")
          .get(sugestao.alvo_id) as Record<string, unknown>;
        const valor = (campo: string) =>
          typeof p[campo] === "string" && (p[campo] as string).trim() !== ""
            ? p[campo]
            : atual[campo];
        db.prepare(
          `UPDATE lancamento SET hipotese = ?, metrica_primaria = ?, metrica_negocio_id = ?,
             baseline = ?, meta = ?, guardrails = ?, fonte_dados_id = ?, consulta = ?, instrumentacao = ?
           WHERE id = ?`
        ).run(
          valor("hipotese"),
          valor("metrica_primaria"),
          p.metrica_negocio_id ?? atual.metrica_negocio_id,
          valor("baseline"),
          valor("meta"),
          valor("guardrails"),
          p.fonte_dados_id ?? atual.fonte_dados_id,
          valor("consulta"),
          valor("instrumentacao"),
          sugestao.alvo_id
        );
        break;
      }

      // Triador: sinais viram evidência de uma oportunidade que já existe.
      case "sinal_evidencia": {
        const oportunidadeId = Number(p.oportunidade_id);
        const existe = db
          .prepare("SELECT id FROM oportunidade WHERE id = ?")
          .get(oportunidadeId);
        if (!existe) throw new Error("a oportunidade alvo não existe mais");
        const ids = criarSinais(p.sinais as SinalProposto[], String(p.canal), "promovido");
        for (const sid of ids) ligarEvidencia(oportunidadeId, sid);
        break;
      }

      // Triador: sinais fundam uma oportunidade nova — que nasce com evidência.
      case "sinal_nova_oportunidade": {
        const titulo = extras.tituloOverride?.trim() || String(p.titulo);
        const ids = criarSinais(p.sinais as SinalProposto[], String(p.canal), "promovido");
        const op = db
          .prepare(
            `INSERT INTO oportunidade (produto_id, titulo, persona_id, passo_jornada_id, estado, notas, criada_em)
             VALUES (?, ?, ?, ?, 'identificada', '', ?)`
          )
          .run(
            sugestao.produto_id,
            titulo,
            (p.persona_id as number | null) ?? null,
            (p.passo_jornada_id as number | null) ?? null,
            agora()
          );
        entidadeCriadaId = Number(op.lastInsertRowid);
        for (const sid of ids) ligarEvidencia(entidadeCriadaId, sid);
        break;
      }

      // Triador: incerto — sinais vão para o inbox para triagem manual.
      case "sinal_inbox": {
        criarSinais(p.sinais as SinalProposto[], String(p.canal), "novo");
        break;
      }

      // Roteirista: o roteiro é material de preparo — aceitar só o arquiva.
      case "roteiro_entrevista":
        break;

      // Triador modo inbox: destino para sinais que JÁ existem.
      case "triar_sinal": {
        const ids = (p.sinal_ids as number[]) ?? [];
        if (ids.length === 0) break;
        const marcar = (status: string) =>
          ids.forEach((sid) =>
            db.prepare("UPDATE sinal SET status = ? WHERE id = ?").run(status, sid)
          );
        if (p.acao === "ligar") {
          const oportunidadeId = Number(p.oportunidade_id);
          const existe = db.prepare("SELECT id FROM oportunidade WHERE id = ?").get(oportunidadeId);
          if (!existe) throw new Error("a oportunidade alvo não existe mais");
          for (const sid of ids) ligarEvidencia(oportunidadeId, sid);
          marcar("promovido");
        } else if (p.acao === "criar") {
          const titulo = extras.tituloOverride?.trim() || String(p.titulo);
          const op = db
            .prepare(
              `INSERT INTO oportunidade (produto_id, titulo, persona_id, passo_jornada_id, estado, notas, criada_em)
               VALUES (?, ?, ?, ?, 'identificada', '', ?)`
            )
            .run(
              sugestao.produto_id,
              titulo,
              (p.persona_id as number | null) ?? null,
              (p.passo_jornada_id as number | null) ?? null,
              agora()
            );
          entidadeCriadaId = Number(op.lastInsertRowid);
          for (const sid of ids) ligarEvidencia(entidadeCriadaId, sid);
          marcar("promovido");
        } else if (p.acao === "arquivar") {
          marcar("arquivado");
        }
        break;
      }

      default:
        throw new Error(`tipo de sugestão desconhecido: ${sugestao.tipo}`);
    }

    db.prepare(
      "UPDATE sugestao SET estado = 'aceita', aplicada_em = ?, entidade_criada_id = ? WHERE id = ?"
    ).run(agora(), entidadeCriadaId, id);
  })();
}
