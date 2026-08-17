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

      // Redator de Avaliação: preenche os 4 critérios — a decisão ("escolhemos
      // X em vez de Y") é campo exclusivamente humano e nunca é tocada aqui.
      case "rascunho_avaliacao": {
        if (!sugestao.alvo_id) throw new Error("sugestão sem oportunidade alvo");
        const existe = db
          .prepare("SELECT id FROM oportunidade WHERE id = ?")
          .get(sugestao.alvo_id);
        if (!existe) throw new Error("a oportunidade não existe mais");
        db.prepare(
          `INSERT INTO avaliacao_oportunidade
             (oportunidade_id, tamanho, tamanho_justif, companhia, companhia_justif,
              mercado, mercado_justif, cliente, cliente_justif, decisao, atualizada_em)
           VALUES (@oportunidade_id, @tamanho, @tamanho_justif, @companhia, @companhia_justif,
                   @mercado, @mercado_justif, @cliente, @cliente_justif, '', @atualizada_em)
           ON CONFLICT(oportunidade_id) DO UPDATE SET
             tamanho = @tamanho, tamanho_justif = @tamanho_justif,
             companhia = @companhia, companhia_justif = @companhia_justif,
             mercado = @mercado, mercado_justif = @mercado_justif,
             cliente = @cliente, cliente_justif = @cliente_justif,
             atualizada_em = @atualizada_em`
        ).run({
          oportunidade_id: sugestao.alvo_id,
          tamanho: (p.tamanho as number | null) ?? null,
          tamanho_justif: String(p.tamanho_justif ?? ""),
          companhia: (p.companhia as number | null) ?? null,
          companhia_justif: String(p.companhia_justif ?? ""),
          mercado: (p.mercado as number | null) ?? null,
          mercado_justif: String(p.mercado_justif ?? ""),
          cliente: (p.cliente as number | null) ?? null,
          cliente_justif: String(p.cliente_justif ?? ""),
          atualizada_em: agora(),
        });
        break;
      }

      // Provocador: uma candidata aprovada vira solução — e só então conta
      // para o portão das 3+ soluções.
      case "criar_solucao": {
        if (!sugestao.alvo_id) throw new Error("sugestão sem oportunidade alvo");
        const existe = db
          .prepare("SELECT id FROM oportunidade WHERE id = ?")
          .get(sugestao.alvo_id);
        if (!existe) throw new Error("a oportunidade não existe mais");
        const info = db
          .prepare(
            `INSERT INTO solucao (produto_id, oportunidade_id, titulo, descricao, estado, criada_em)
             VALUES (?, ?, ?, ?, 'ideia', ?)`
          )
          .run(
            sugestao.produto_id,
            sugestao.alvo_id,
            extras.tituloOverride?.trim() || String(p.titulo),
            String(p.descricao ?? ""),
            agora()
          );
        entidadeCriadaId = Number(info.lastInsertRowid);
        break;
      }

      // Agente de Risco: as suposições aprovadas entram mapeadas — o PM edita
      // ou apaga uma a uma depois, como qualquer suposição manual.
      case "criar_suposicoes": {
        if (!sugestao.alvo_id) throw new Error("sugestão sem solução alvo");
        const existe = db.prepare("SELECT id FROM solucao WHERE id = ?").get(sugestao.alvo_id);
        if (!existe) throw new Error("a solução não existe mais");
        const inserir = db.prepare(
          `INSERT INTO suposicao (solucao_id, texto, lente, passo_story_map_id, importancia, evidencia, estado, criada_em)
           VALUES (?, ?, ?, ?, ?, ?, 'mapeada', ?)`
        );
        for (const s of p.suposicoes as {
          texto: string;
          lente: string;
          passo_story_map_id: number | null;
          importancia: number;
          evidencia: number;
        }[]) {
          inserir.run(
            sugestao.alvo_id,
            s.texto,
            s.lente,
            s.passo_story_map_id ?? null,
            s.importancia,
            s.evidencia,
            agora()
          );
        }
        break;
      }

      // Agente de Risco: teste da mais arriscada — sem critério numérico
      // (definido ANTES), não existe teste. Mesma regra do fluxo manual.
      case "rascunhar_teste": {
        const suposicaoId = Number(p.suposicao_id);
        const suposicao = db
          .prepare("SELECT id FROM suposicao WHERE id = ?")
          .get(suposicaoId);
        if (!suposicao) throw new Error("a suposição alvo não existe mais");
        const criterio = String(p.criterio ?? "").trim();
        if (!criterio || !/\d/.test(criterio))
          throw new Error("teste sem critério numérico falseável não é teste");
        db.prepare(
          "INSERT INTO teste_suposicao (suposicao_id, metodo, criterio, roteiro, criada_em) VALUES (?, ?, ?, ?, ?)"
        ).run(suposicaoId, String(p.metodo ?? ""), criterio, String(p.roteiro ?? ""), agora());
        db.prepare("UPDATE suposicao SET estado = 'em_teste' WHERE id = ?").run(suposicaoId);
        break;
      }

      // Fechador de Loop: aceitar o rascunho É o ato humano que fecha o loop —
      // o agente sozinho nunca grava veredito.
      case "rascunhar_veredito": {
        if (!sugestao.alvo_id) throw new Error("sugestão sem lançamento alvo");
        db.prepare("UPDATE lancamento SET veredito = ?, aprendizado = ? WHERE id = ?").run(
          String(p.veredito),
          String(p.aprendizado ?? ""),
          sugestao.alvo_id
        );
        break;
      }

      // Empacotador: o brief é material de leitura — aceitar só o arquiva.
      case "brief_solucao":
        break;

      default:
        throw new Error(`tipo de sugestão desconhecido: ${sugestao.tipo}`);
    }

    db.prepare(
      "UPDATE sugestao SET estado = 'aceita', aplicada_em = ?, entidade_criada_id = ? WHERE id = ?"
    ).run(agora(), entidadeCriadaId, id);
  })();
}
