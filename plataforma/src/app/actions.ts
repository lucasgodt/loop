"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { agora, db, hojeLocal } from "@/lib/db";
import { medir, PROVEDORES } from "@/lib/fontes";
import { avaliacaoCompleta, getAvaliacao, getFonte, LIMITE_WIP } from "@/lib/queries";

function texto(fd: FormData, campo: string): string {
  return String(fd.get(campo) ?? "").trim();
}

function inteiroOuNulo(fd: FormData, campo: string): number | null {
  const v = texto(fd, campo);
  return v ? Number(v) : null;
}

function tudoMudou() {
  for (const p of ["/", "/entrevistas", "/sinais", "/oportunidades", "/lancamentos", "/metricas"]) {
    revalidatePath(p);
  }
}

// ── Passo 3 do loop: entrevistas e sinais ────────────────────────────────────

export async function criarEntrevista(fd: FormData) {
  db.prepare(
    `INSERT INTO entrevista (produto_id, data, entrevistado, persona_id, link_gravacao, historia, notas, transcricao, criada_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    Number(fd.get("produto_id")),
    texto(fd, "data") || hojeLocal(),
    texto(fd, "entrevistado"),
    inteiroOuNulo(fd, "persona_id"),
    texto(fd, "link_gravacao"),
    texto(fd, "historia"),
    texto(fd, "notas"),
    texto(fd, "transcricao"),
    agora()
  );
  tudoMudou();
}

export async function criarSinal(fd: FormData) {
  db.prepare(
    `INSERT INTO sinal (produto_id, canal, conteudo, data, status, criada_em)
     VALUES (?, ?, ?, ?, 'novo', ?)`
  ).run(
    Number(fd.get("produto_id")),
    texto(fd, "canal") || "outro",
    texto(fd, "conteudo"),
    texto(fd, "data") || hojeLocal(),
    agora()
  );
  tudoMudou();
}

export async function arquivarSinal(fd: FormData) {
  db.prepare("UPDATE sinal SET status = 'arquivado' WHERE id = ?").run(Number(fd.get("id")));
  tudoMudou();
}

// ── Passo 2 do loop: jornada ─────────────────────────────────────────────────

export async function criarPassoJornada(fd: FormData) {
  const produtoId = Number(fd.get("produto_id"));
  const personaId = inteiroOuNulo(fd, "persona_id");
  const max = db
    .prepare(
      "SELECT COALESCE(MAX(ordem), 0) AS m FROM passo_jornada WHERE produto_id = ? AND persona_id IS ?"
    )
    .get(produtoId, personaId) as { m: number };
  db.prepare(
    "INSERT INTO passo_jornada (produto_id, persona_id, ordem, titulo, descricao) VALUES (?, ?, ?, ?, ?)"
  ).run(produtoId, personaId, max.m + 1, texto(fd, "titulo"), texto(fd, "descricao"));
  tudoMudou();
}

// ── Passo 4 do loop: árvore de oportunidades ─────────────────────────────────

export async function criarOportunidade(fd: FormData) {
  const info = db
    .prepare(
      `INSERT INTO oportunidade (produto_id, titulo, persona_id, passo_jornada_id, pai_id, estado, notas, criada_em)
       VALUES (?, ?, ?, ?, ?, 'identificada', ?, ?)`
    )
    .run(
      Number(fd.get("produto_id")),
      texto(fd, "titulo"),
      inteiroOuNulo(fd, "persona_id"),
      inteiroOuNulo(fd, "passo_jornada_id"),
      inteiroOuNulo(fd, "pai_id"),
      texto(fd, "notas"),
      agora()
    );
  const oportunidadeId = Number(info.lastInsertRowid);

  const sinalId = inteiroOuNulo(fd, "sinal_id");
  const entrevistaId = inteiroOuNulo(fd, "entrevista_id");
  if (sinalId) {
    db.prepare(
      "INSERT INTO evidencia (oportunidade_id, sinal_id, criada_em) VALUES (?, ?, ?)"
    ).run(oportunidadeId, sinalId, agora());
    db.prepare("UPDATE sinal SET status = 'promovido' WHERE id = ?").run(sinalId);
  }
  if (entrevistaId) {
    db.prepare(
      "INSERT INTO evidencia (oportunidade_id, entrevista_id, criada_em) VALUES (?, ?, ?)"
    ).run(oportunidadeId, entrevistaId, agora());
  }
  tudoMudou();
  redirect("/oportunidades");
}

export async function mudarEstadoOportunidade(fd: FormData) {
  const id = Number(fd.get("id"));
  const estado = texto(fd, "estado");
  const origem = texto(fd, "origem") || "/oportunidades";
  const atual = db
    .prepare("SELECT produto_id, estado FROM oportunidade WHERE id = ?")
    .get(id) as { produto_id: number; estado: string } | undefined;
  if (!atual) return;

  // Portões do passo 5: só entra em discovery avaliada e com vaga no WIP.
  if (estado === "em_discovery" && atual.estado !== "em_discovery") {
    if (!avaliacaoCompleta(getAvaliacao(id))) {
      redirect(`${origem}?erro=avaliacao&op=${id}`);
    }
    const wip = db
      .prepare(
        "SELECT COUNT(*) AS n FROM oportunidade WHERE produto_id = ? AND estado = 'em_discovery'"
      )
      .get(atual.produto_id) as { n: number };
    if (wip.n >= LIMITE_WIP) {
      redirect(`${origem}?erro=wip`);
    }
  }

  db.prepare("UPDATE oportunidade SET estado = ? WHERE id = ?").run(estado, id);
  tudoMudou();
}

// ── Passo 5 do loop: avaliação de priorização (4 grupos de critérios) ────────

export async function salvarAvaliacao(fd: FormData) {
  const oportunidadeId = Number(fd.get("oportunidade_id"));
  db.prepare(
    `INSERT INTO avaliacao_oportunidade
       (oportunidade_id, tamanho, tamanho_justif, companhia, companhia_justif,
        mercado, mercado_justif, cliente, cliente_justif, decisao, atualizada_em)
     VALUES (@oportunidade_id, @tamanho, @tamanho_justif, @companhia, @companhia_justif,
             @mercado, @mercado_justif, @cliente, @cliente_justif, @decisao, @atualizada_em)
     ON CONFLICT(oportunidade_id) DO UPDATE SET
       tamanho = @tamanho, tamanho_justif = @tamanho_justif,
       companhia = @companhia, companhia_justif = @companhia_justif,
       mercado = @mercado, mercado_justif = @mercado_justif,
       cliente = @cliente, cliente_justif = @cliente_justif,
       decisao = @decisao, atualizada_em = @atualizada_em`
  ).run({
    oportunidade_id: oportunidadeId,
    tamanho: inteiroOuNulo(fd, "tamanho"),
    tamanho_justif: texto(fd, "tamanho_justif"),
    companhia: inteiroOuNulo(fd, "companhia"),
    companhia_justif: texto(fd, "companhia_justif"),
    mercado: inteiroOuNulo(fd, "mercado"),
    mercado_justif: texto(fd, "mercado_justif"),
    cliente: inteiroOuNulo(fd, "cliente"),
    cliente_justif: texto(fd, "cliente_justif"),
    decisao: texto(fd, "decisao"),
    atualizada_em: agora(),
  });
  tudoMudou();
  revalidatePath(`/oportunidades/${oportunidadeId}`);
  revalidatePath("/priorizacao");
}

// ── Passo 7 do loop: story map e suposições ──────────────────────────────────

export async function criarPassoStoryMap(fd: FormData) {
  const solucaoId = Number(fd.get("solucao_id"));
  const max = db
    .prepare("SELECT COALESCE(MAX(ordem), 0) AS m FROM passo_story_map WHERE solucao_id = ?")
    .get(solucaoId) as { m: number };
  db.prepare("INSERT INTO passo_story_map (solucao_id, ordem, titulo) VALUES (?, ?, ?)").run(
    solucaoId,
    max.m + 1,
    texto(fd, "titulo")
  );
  revalidatePath(`/solucoes/${solucaoId}`);
}

export async function criarSuposicao(fd: FormData) {
  const solucaoId = Number(fd.get("solucao_id"));
  db.prepare(
    `INSERT INTO suposicao (solucao_id, texto, lente, passo_story_map_id, importancia, evidencia, estado, criada_em)
     VALUES (?, ?, ?, ?, ?, ?, 'mapeada', ?)`
  ).run(
    solucaoId,
    texto(fd, "texto"),
    texto(fd, "lente") || "desejavel",
    inteiroOuNulo(fd, "passo_story_map_id"),
    Number(fd.get("importancia") ?? 3),
    Number(fd.get("evidencia") ?? 3),
    agora()
  );
  tudoMudou();
  revalidatePath(`/solucoes/${solucaoId}`);
}

// ── Passo 8 do loop: testes de suposição ─────────────────────────────────────

export async function criarTeste(fd: FormData) {
  const suposicaoId = Number(fd.get("suposicao_id"));
  const criterio = texto(fd, "criterio");
  if (!criterio) return; // sem critério definido antes, não existe teste
  const solucaoId = (
    db.prepare("SELECT solucao_id FROM suposicao WHERE id = ?").get(suposicaoId) as {
      solucao_id: number;
    }
  ).solucao_id;
  db.prepare(
    "INSERT INTO teste_suposicao (suposicao_id, metodo, criterio, criada_em) VALUES (?, ?, ?, ?)"
  ).run(suposicaoId, texto(fd, "metodo"), criterio, agora());
  db.prepare("UPDATE suposicao SET estado = 'em_teste' WHERE id = ?").run(suposicaoId);
  tudoMudou();
  revalidatePath(`/solucoes/${solucaoId}`);
}

export async function concluirTeste(fd: FormData) {
  const id = Number(fd.get("id"));
  const veredito = texto(fd, "veredito");
  if (!veredito) return;
  const teste = db
    .prepare("SELECT suposicao_id FROM teste_suposicao WHERE id = ?")
    .get(id) as { suposicao_id: number } | undefined;
  if (!teste) return;
  db.prepare(
    "UPDATE teste_suposicao SET resultado = ?, veredito = ?, aprendizado = ?, concluido_em = ? WHERE id = ?"
  ).run(texto(fd, "resultado"), veredito, texto(fd, "aprendizado"), agora(), id);
  // O veredito do teste atualiza a suposição; inconclusiva volta para o mapa.
  const estadoSuposicao = veredito === "inconclusiva" ? "mapeada" : veredito;
  db.prepare("UPDATE suposicao SET estado = ? WHERE id = ?").run(estadoSuposicao, teste.suposicao_id);
  const solucaoId = (
    db.prepare("SELECT solucao_id FROM suposicao WHERE id = ?").get(teste.suposicao_id) as {
      solucao_id: number;
    }
  ).solucao_id;
  tudoMudou();
  revalidatePath(`/solucoes/${solucaoId}`);
}

// ── Edição e exclusão ────────────────────────────────────────────────────────
// Sem ON DELETE CASCADE no schema: cada exclusão resolve as referências na
// ordem certa, dentro de uma transação.

export async function atualizarEntrevista(fd: FormData) {
  db.prepare(
    `UPDATE entrevista SET data = ?, entrevistado = ?, persona_id = ?, link_gravacao = ?, historia = ?, notas = ?, transcricao = ? WHERE id = ?`
  ).run(
    texto(fd, "data") || hojeLocal(),
    texto(fd, "entrevistado"),
    inteiroOuNulo(fd, "persona_id"),
    texto(fd, "link_gravacao"),
    texto(fd, "historia"),
    texto(fd, "notas"),
    texto(fd, "transcricao"),
    Number(fd.get("id"))
  );
  tudoMudou();
}

export async function apagarEntrevista(fd: FormData) {
  const id = Number(fd.get("id"));
  db.transaction(() => {
    db.prepare("DELETE FROM evidencia WHERE entrevista_id = ?").run(id);
    db.prepare("DELETE FROM entrevista WHERE id = ?").run(id);
  })();
  tudoMudou();
}

export async function atualizarSinal(fd: FormData) {
  db.prepare("UPDATE sinal SET canal = ?, conteudo = ?, data = ? WHERE id = ?").run(
    texto(fd, "canal"),
    texto(fd, "conteudo"),
    texto(fd, "data") || hojeLocal(),
    Number(fd.get("id"))
  );
  tudoMudou();
}

export async function apagarSinal(fd: FormData) {
  const id = Number(fd.get("id"));
  db.transaction(() => {
    db.prepare("DELETE FROM evidencia WHERE sinal_id = ?").run(id);
    db.prepare("DELETE FROM sinal WHERE id = ?").run(id);
  })();
  tudoMudou();
}

export async function atualizarOportunidade(fd: FormData) {
  const id = Number(fd.get("id"));
  const paiId = inteiroOuNulo(fd, "pai_id");
  db.prepare(
    `UPDATE oportunidade SET titulo = ?, persona_id = ?, passo_jornada_id = ?, pai_id = ?, notas = ? WHERE id = ?`
  ).run(
    texto(fd, "titulo"),
    inteiroOuNulo(fd, "persona_id"),
    inteiroOuNulo(fd, "passo_jornada_id"),
    paiId === id ? null : paiId,
    texto(fd, "notas"),
    id
  );
  tudoMudou();
  revalidatePath(`/oportunidades/${id}`);
}

export async function apagarOportunidade(fd: FormData) {
  const id = Number(fd.get("id"));
  const filhos = db
    .prepare("SELECT COUNT(*) AS n FROM oportunidade WHERE pai_id = ?")
    .get(id) as { n: number };
  const solucoes = db
    .prepare("SELECT COUNT(*) AS n FROM solucao WHERE oportunidade_id = ?")
    .get(id) as { n: number };
  if (filhos.n > 0 || solucoes.n > 0) {
    redirect(`/oportunidades/${id}?erro=dependencias`);
  }
  db.transaction(() => {
    db.prepare("DELETE FROM evidencia WHERE oportunidade_id = ?").run(id);
    db.prepare("DELETE FROM avaliacao_oportunidade WHERE oportunidade_id = ?").run(id);
    db.prepare("DELETE FROM oportunidade WHERE id = ?").run(id);
  })();
  tudoMudou();
  redirect("/oportunidades");
}

export async function removerEvidencia(fd: FormData) {
  db.prepare("DELETE FROM evidencia WHERE id = ?").run(Number(fd.get("id")));
  tudoMudou();
}

export async function atualizarSolucao(fd: FormData) {
  const id = Number(fd.get("id"));
  db.prepare("UPDATE solucao SET titulo = ?, descricao = ?, link_externo = ? WHERE id = ?").run(
    texto(fd, "titulo"),
    texto(fd, "descricao"),
    texto(fd, "link_externo"),
    id
  );
  tudoMudou();
  revalidatePath(`/solucoes/${id}`);
}

export async function apagarSolucao(fd: FormData) {
  const id = Number(fd.get("id"));
  const solucao = db
    .prepare("SELECT oportunidade_id FROM solucao WHERE id = ?")
    .get(id) as { oportunidade_id: number | null } | undefined;
  db.transaction(() => {
    // A ficha de lançamento sobrevive à solução — só perde o vínculo.
    db.prepare("UPDATE lancamento SET solucao_id = NULL WHERE solucao_id = ?").run(id);
    db.prepare(
      "DELETE FROM teste_suposicao WHERE suposicao_id IN (SELECT id FROM suposicao WHERE solucao_id = ?)"
    ).run(id);
    db.prepare("DELETE FROM suposicao WHERE solucao_id = ?").run(id);
    db.prepare("DELETE FROM passo_story_map WHERE solucao_id = ?").run(id);
    db.prepare("DELETE FROM solucao WHERE id = ?").run(id);
  })();
  tudoMudou();
  redirect(solucao?.oportunidade_id ? `/oportunidades/${solucao.oportunidade_id}` : "/oportunidades");
}

export async function apagarPassoStoryMap(fd: FormData) {
  const id = Number(fd.get("id"));
  const passo = db
    .prepare("SELECT solucao_id FROM passo_story_map WHERE id = ?")
    .get(id) as { solucao_id: number } | undefined;
  db.transaction(() => {
    db.prepare("UPDATE suposicao SET passo_story_map_id = NULL WHERE passo_story_map_id = ?").run(id);
    db.prepare("DELETE FROM passo_story_map WHERE id = ?").run(id);
  })();
  if (passo) revalidatePath(`/solucoes/${passo.solucao_id}`);
}

export async function atualizarSuposicao(fd: FormData) {
  const id = Number(fd.get("id"));
  const solucaoId = (
    db.prepare("SELECT solucao_id FROM suposicao WHERE id = ?").get(id) as { solucao_id: number }
  ).solucao_id;
  db.prepare(
    "UPDATE suposicao SET texto = ?, lente = ?, passo_story_map_id = ?, importancia = ?, evidencia = ? WHERE id = ?"
  ).run(
    texto(fd, "texto"),
    texto(fd, "lente"),
    inteiroOuNulo(fd, "passo_story_map_id"),
    Number(fd.get("importancia") ?? 3),
    Number(fd.get("evidencia") ?? 3),
    id
  );
  tudoMudou();
  revalidatePath(`/solucoes/${solucaoId}`);
}

export async function apagarSuposicao(fd: FormData) {
  const id = Number(fd.get("id"));
  const solucaoId = (
    db.prepare("SELECT solucao_id FROM suposicao WHERE id = ?").get(id) as { solucao_id: number }
  ).solucao_id;
  db.transaction(() => {
    db.prepare("DELETE FROM teste_suposicao WHERE suposicao_id = ?").run(id);
    db.prepare("DELETE FROM suposicao WHERE id = ?").run(id);
  })();
  tudoMudou();
  revalidatePath(`/solucoes/${solucaoId}`);
}

export async function apagarTeste(fd: FormData) {
  const id = Number(fd.get("id"));
  const teste = db
    .prepare("SELECT suposicao_id FROM teste_suposicao WHERE id = ?")
    .get(id) as { suposicao_id: number } | undefined;
  if (!teste) return;
  db.prepare("DELETE FROM teste_suposicao WHERE id = ?").run(id);
  // Recalcula o estado da suposição a partir dos testes restantes.
  const restantes = db
    .prepare("SELECT veredito FROM teste_suposicao WHERE suposicao_id = ? ORDER BY id")
    .all(teste.suposicao_id) as { veredito: string | null }[];
  let estado = "mapeada";
  if (restantes.some((t) => t.veredito === null)) estado = "em_teste";
  else if (restantes.length > 0) {
    const ultimo = restantes[restantes.length - 1].veredito;
    estado = ultimo === "inconclusiva" ? "mapeada" : ultimo ?? "mapeada";
  }
  db.prepare("UPDATE suposicao SET estado = ? WHERE id = ?").run(estado, teste.suposicao_id);
  const solucaoId = (
    db.prepare("SELECT solucao_id FROM suposicao WHERE id = ?").get(teste.suposicao_id) as {
      solucao_id: number;
    }
  ).solucao_id;
  tudoMudou();
  revalidatePath(`/solucoes/${solucaoId}`);
}

export async function atualizarMetrica(fd: FormData) {
  db.prepare(
    "UPDATE metrica_negocio SET nome = ?, definicao = ?, fonte = ?, unidade = ?, meta = ?, fonte_dados_id = ?, consulta = ? WHERE id = ?"
  ).run(
    texto(fd, "nome"),
    texto(fd, "definicao"),
    texto(fd, "fonte"),
    texto(fd, "unidade"),
    texto(fd, "meta"),
    inteiroOuNulo(fd, "fonte_dados_id"),
    texto(fd, "consulta"),
    Number(fd.get("id"))
  );
  tudoMudou();
}

export async function apagarMetrica(fd: FormData) {
  const id = Number(fd.get("id"));
  db.transaction(() => {
    db.prepare("UPDATE lancamento SET metrica_negocio_id = NULL WHERE metrica_negocio_id = ?").run(id);
    db.prepare("DELETE FROM metrica_valor WHERE metrica_id = ?").run(id);
    db.prepare("DELETE FROM metrica_negocio WHERE id = ?").run(id);
  })();
  tudoMudou();
}

export async function apagarValorMetrica(fd: FormData) {
  const id = Number(fd.get("id"));
  const valor = db
    .prepare("SELECT metrica_id FROM metrica_valor WHERE id = ?")
    .get(id) as { metrica_id: number } | undefined;
  if (!valor) return;
  db.prepare("DELETE FROM metrica_valor WHERE id = ?").run(id);
  const ultimo = db
    .prepare("SELECT valor, data FROM metrica_valor WHERE metrica_id = ? ORDER BY data DESC, id DESC LIMIT 1")
    .get(valor.metrica_id) as { valor: number; data: string } | undefined;
  db.prepare("UPDATE metrica_negocio SET valor_atual = ?, atualizado_em = ? WHERE id = ?").run(
    ultimo?.valor ?? null,
    ultimo?.data ?? null,
    valor.metrica_id
  );
  tudoMudou();
}

export async function apagarLancamento(fd: FormData) {
  const id = Number(fd.get("id"));
  db.transaction(() => {
    db.prepare("DELETE FROM revisao WHERE lancamento_id = ?").run(id);
    db.prepare("DELETE FROM lancamento WHERE id = ?").run(id);
  })();
  tudoMudou();
  redirect("/lancamentos");
}

export async function apagarRevisao(fd: FormData) {
  const id = Number(fd.get("id"));
  const revisao = db
    .prepare("SELECT lancamento_id FROM revisao WHERE id = ?")
    .get(id) as { lancamento_id: number } | undefined;
  db.prepare("DELETE FROM revisao WHERE id = ?").run(id);
  tudoMudou();
  if (revisao) revalidatePath(`/lancamentos/${revisao.lancamento_id}`);
}

export async function apagarPassoJornada(fd: FormData) {
  const id = Number(fd.get("id"));
  db.transaction(() => {
    db.prepare("UPDATE oportunidade SET passo_jornada_id = NULL WHERE passo_jornada_id = ?").run(id);
    db.prepare("DELETE FROM passo_jornada WHERE id = ?").run(id);
  })();
  tudoMudou();
}

// ── Passo 9 do loop: estado da solução com portões de saída ──────────────────

export async function mudarEstadoSolucao(fd: FormData) {
  const id = Number(fd.get("id"));
  const estado = texto(fd, "estado");
  const origem = texto(fd, "origem") || `/solucoes/${id}`;

  // Portão de saída: solução só é "lançada" com ficha de lançamento criada.
  if (estado === "lancada") {
    const ficha = db.prepare("SELECT id FROM lancamento WHERE solucao_id = ?").get(id);
    if (!ficha) redirect(`${origem}?erro=sem_ficha`);
  }

  db.prepare("UPDATE solucao SET estado = ? WHERE id = ?").run(estado, id);
  tudoMudou();
  revalidatePath(origem);
}

export async function ligarEvidencia(fd: FormData) {
  const sinalId = inteiroOuNulo(fd, "sinal_id");
  const entrevistaId = inteiroOuNulo(fd, "entrevista_id");
  if (!sinalId && !entrevistaId) return;
  db.prepare(
    "INSERT INTO evidencia (oportunidade_id, entrevista_id, sinal_id, criada_em) VALUES (?, ?, ?, ?)"
  ).run(Number(fd.get("oportunidade_id")), entrevistaId, sinalId, agora());
  if (sinalId) db.prepare("UPDATE sinal SET status = 'promovido' WHERE id = ?").run(sinalId);
  tudoMudou();
}

// ── Passo 6 do loop: soluções ────────────────────────────────────────────────

export async function criarSolucao(fd: FormData) {
  db.prepare(
    `INSERT INTO solucao (produto_id, oportunidade_id, titulo, descricao, estado, criada_em)
     VALUES (?, ?, ?, ?, 'ideia', ?)`
  ).run(
    Number(fd.get("produto_id")),
    inteiroOuNulo(fd, "oportunidade_id"),
    texto(fd, "titulo"),
    texto(fd, "descricao"),
    agora()
  );
  tudoMudou();
}

// ── Passo 1 do loop: métricas de negócio ─────────────────────────────────────

export async function criarMetrica(fd: FormData) {
  db.prepare(
    `INSERT INTO metrica_negocio (produto_id, nome, definicao, fonte, unidade, meta)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    Number(fd.get("produto_id")),
    texto(fd, "nome"),
    texto(fd, "definicao"),
    texto(fd, "fonte"),
    texto(fd, "unidade"),
    texto(fd, "meta")
  );
  tudoMudou();
}

export async function registrarValorMetrica(fd: FormData) {
  const metricaId = Number(fd.get("metrica_id"));
  const valor = Number(fd.get("valor"));
  if (!Number.isFinite(valor)) return;
  const data = texto(fd, "data") || hojeLocal();
  db.prepare("INSERT INTO metrica_valor (metrica_id, valor, data) VALUES (?, ?, ?)").run(
    metricaId,
    valor,
    data
  );
  db.prepare("UPDATE metrica_negocio SET valor_atual = ?, atualizado_em = ? WHERE id = ?").run(
    valor,
    data,
    metricaId
  );
  tudoMudou();
}

// ── Passo 10 do loop: lançamentos e revisões ─────────────────────────────────

export async function criarLancamento(fd: FormData) {
  const info = db
    .prepare(
      `INSERT INTO lancamento (produto_id, solucao_id, nome, data_lancamento, criada_em) VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      Number(fd.get("produto_id")),
      inteiroOuNulo(fd, "solucao_id"),
      texto(fd, "nome"),
      texto(fd, "data_lancamento") || null,
      agora()
    );
  tudoMudou();
  redirect(`/lancamentos/${info.lastInsertRowid}`);
}

export async function atualizarLancamento(fd: FormData) {
  const id = Number(fd.get("id"));
  db.prepare(
    `UPDATE lancamento SET
       nome = ?, data_lancamento = ?, hipotese = ?, metrica_primaria = ?, metrica_negocio_id = ?,
       baseline = ?, meta = ?, guardrails = ?, fonte_dados = ?, notas = ?,
       veredito = ?, aprendizado = ?, fonte_dados_id = ?, consulta = ?, instrumentacao = ?
     WHERE id = ?`
  ).run(
    texto(fd, "nome"),
    texto(fd, "data_lancamento") || null,
    texto(fd, "hipotese"),
    texto(fd, "metrica_primaria"),
    inteiroOuNulo(fd, "metrica_negocio_id"),
    texto(fd, "baseline"),
    texto(fd, "meta"),
    texto(fd, "guardrails"),
    texto(fd, "fonte_dados"),
    texto(fd, "notas"),
    texto(fd, "veredito") || null,
    texto(fd, "aprendizado"),
    inteiroOuNulo(fd, "fonte_dados_id"),
    texto(fd, "consulta"),
    texto(fd, "instrumentacao"),
    id
  );
  tudoMudou();
  revalidatePath(`/lancamentos/${id}`);
}

/** Cria as revisões de 30/60/90 dias a partir da data de lançamento. */
export async function gerarRevisoes(fd: FormData) {
  const id = Number(fd.get("id"));
  const lancamento = db.prepare("SELECT * FROM lancamento WHERE id = ?").get(id) as
    | { data_lancamento: string | null }
    | undefined;
  if (!lancamento?.data_lancamento) return;

  const existentes = db
    .prepare("SELECT COUNT(*) AS n FROM revisao WHERE lancamento_id = ?")
    .get(id) as { n: number };
  if (existentes.n > 0) return;

  const base = new Date(`${lancamento.data_lancamento}T00:00:00`);
  for (const dias of [30, 60, 90]) {
    const prevista = new Date(base);
    prevista.setDate(base.getDate() + dias);
    db.prepare(
      "INSERT INTO revisao (lancamento_id, rotulo, data_prevista) VALUES (?, ?, ?)"
    ).run(id, `${dias} dias`, hojeLocal(prevista));
  }
  tudoMudou();
  revalidatePath(`/lancamentos/${id}`);
}

// ── Agentes de IA ────────────────────────────────────────────────────────────

export async function atualizarProduto(fd: FormData) {
  db.prepare("UPDATE produto SET nome = ?, descricao = ? WHERE id = ?").run(
    texto(fd, "nome"),
    texto(fd, "descricao"),
    Number(fd.get("id"))
  );
  tudoMudou();
  revalidatePath("/fontes");
}

export async function criarPersona(fd: FormData) {
  const nome = texto(fd, "nome");
  if (!nome) return;
  db.prepare("INSERT INTO persona (produto_id, nome) VALUES (?, ?)").run(
    Number(fd.get("produto_id")),
    nome
  );
  tudoMudou();
  revalidatePath("/fontes");
}

export async function apagarPersona(fd: FormData) {
  const id = Number(fd.get("id"));
  db.transaction(() => {
    db.prepare("UPDATE passo_jornada SET persona_id = NULL WHERE persona_id = ?").run(id);
    db.prepare("UPDATE oportunidade SET persona_id = NULL WHERE persona_id = ?").run(id);
    db.prepare("UPDATE entrevista SET persona_id = NULL WHERE persona_id = ?").run(id);
    db.prepare("DELETE FROM persona WHERE id = ?").run(id);
  })();
  tudoMudou();
  revalidatePath("/fontes");
}

/** Esconde o checklist de onboarding — só oferecido quando ele está completo. */
export async function dispensarOnboarding(fd: FormData) {
  db.prepare("UPDATE produto SET onboarding_dispensado = 1 WHERE id = ?").run(
    Number(fd.get("id"))
  );
  revalidatePath("/");
}

export async function atualizarContextoProduto(fd: FormData) {
  db.prepare("UPDATE produto SET contexto = ? WHERE id = ?").run(
    texto(fd, "contexto"),
    Number(fd.get("id"))
  );
  revalidatePath("/fontes");
}

/** Botão "Rascunhar ficha com IA" na página do lançamento. */
export async function rascunharFicha(fd: FormData) {
  const lancamentoId = Number(fd.get("id"));
  const produtoId = Number(fd.get("produto_id"));
  const { executarAgente } = await import("@/lib/agentes/executar");
  try {
    await executarAgente("fechador_de_loop", produtoId, "manual", lancamentoId);
  } catch (e) {
    redirect(
      `/lancamentos/${lancamentoId}?erro=` +
        encodeURIComponent(e instanceof Error ? e.message : String(e))
    );
  }
  tudoMudou();
  revalidatePath(`/lancamentos/${lancamentoId}`);
}

/** Botões sob demanda dos agentes: roda e volta para a página com a sugestão. */
export async function rodarAgente(fd: FormData) {
  const agenteId = texto(fd, "agente_id");
  const produtoId = Number(fd.get("produto_id"));
  const alvoId = inteiroOuNulo(fd, "alvo_id") ?? undefined;
  const volta = texto(fd, "volta") || "/";
  const { executarAgente } = await import("@/lib/agentes/executar");
  let resultado: { sugestoes: number };
  try {
    resultado = await executarAgente(agenteId, produtoId, "manual", alvoId);
  } catch (e) {
    redirect(`${volta}?erro=` + encodeURIComponent(e instanceof Error ? e.message : String(e)));
  }
  tudoMudou();
  revalidatePath(volta);
  if (resultado.sugestoes === 0) {
    redirect(`${volta}?erro=` + encodeURIComponent("o agente não teve nada de novo a propor"));
  }
}

/** Aceitar aplica o payload pelas mesmas mutações do fluxo manual (aplicador). */
export async function aceitarSugestao(fd: FormData) {
  const id = Number(fd.get("id"));
  const sugestao = db.prepare("SELECT alvo_tabela, alvo_id FROM sugestao WHERE id = ?").get(id) as
    | { alvo_tabela: string; alvo_id: number | null }
    | undefined;
  if (!sugestao) return;

  const { aplicarSugestao } = await import("@/lib/sugestoes/aplicar");
  try {
    aplicarSugestao(id, {
      tituloOverride: texto(fd, "titulo_override") || undefined,
      solucaoOverride: inteiroOuNulo(fd, "solucao_override") ?? undefined,
    });
  } catch (e) {
    // Downgrade gracioso: a sugestão fica marcada como falha, com o motivo.
    db.prepare(
      "UPDATE sugestao SET estado = 'falhou', motivo_rejeicao = ? WHERE id = ? AND estado = 'sugerida'"
    ).run(e instanceof Error ? e.message : String(e), id);
  }
  tudoMudou();
  if (sugestao.alvo_id) {
    const rota = { lancamento: "/lancamentos", oportunidade: "/oportunidades", solucao: "/solucoes" }[
      sugestao.alvo_tabela
    ];
    if (rota) revalidatePath(`${rota}/${sugestao.alvo_id}`);
  }
}

/** Botão "preparar entrevista": gera o roteiro story-based como sugestão. */
export async function gerarRoteiro(fd: FormData) {
  const produtoId = Number(fd.get("produto_id"));
  const { executarAgente } = await import("@/lib/agentes/executar");
  try {
    await executarAgente("roteirista", produtoId, "manual", undefined, {
      persona_id: inteiroOuNulo(fd, "persona_id"),
      oportunidade_id: inteiroOuNulo(fd, "oportunidade_id"),
    });
  } catch (e) {
    redirect(
      "/entrevistas?erro=" + encodeURIComponent(e instanceof Error ? e.message : String(e))
    );
  }
  tudoMudou();
}

/** Botão "sintetizar": a transcrição vira insumo e passa pelo Triador. */
export async function sintetizarEntrevista(fd: FormData) {
  const entrevistaId = Number(fd.get("id"));
  const entrevista = db
    .prepare("SELECT produto_id, transcricao, entrevistado FROM entrevista WHERE id = ?")
    .get(entrevistaId) as
    | { produto_id: number; transcricao: string; entrevistado: string }
    | undefined;
  if (!entrevista?.transcricao?.trim()) {
    redirect("/entrevistas?erro=" + encodeURIComponent("esta entrevista não tem transcrição colada"));
  }
  const insumo = db
    .prepare(
      "INSERT INTO insumo (produto_id, canal, conteudo, entrevista_id, criada_em) VALUES (?, ?, ?, ?, ?)"
    )
    .run(
      entrevista.produto_id,
      `Entrevista: ${entrevista.entrevistado}`,
      entrevista.transcricao,
      entrevistaId,
      agora()
    );
  const insumoId = Number(insumo.lastInsertRowid);

  const { executarAgente } = await import("@/lib/agentes/executar");
  let resultado: { sugestoes: number };
  try {
    resultado = await executarAgente("triador", entrevista.produto_id, "manual", insumoId);
  } catch (e) {
    redirect(
      "/entrevistas?erro=" + encodeURIComponent(e instanceof Error ? e.message : String(e))
    );
  }
  db.prepare("UPDATE insumo SET processado_em = ? WHERE id = ?").run(agora(), insumoId);
  tudoMudou();
  if (resultado.sugestoes === 0) {
    redirect("/entrevistas?erro=" + encodeURIComponent("o Triador não extraiu nada da transcrição"));
  }
  redirect("/sinais");
}

/** Caixa "triar insumo com IA": persiste o bruto e roda o Triador. */
export async function processarInsumo(fd: FormData) {
  const produtoId = Number(fd.get("produto_id"));
  const conteudo = texto(fd, "conteudo");
  if (!conteudo) return;
  const insumo = db
    .prepare("INSERT INTO insumo (produto_id, canal, conteudo, criada_em) VALUES (?, ?, ?, ?)")
    .run(produtoId, texto(fd, "canal") || "outro", conteudo, agora());
  const insumoId = Number(insumo.lastInsertRowid);

  const { executarAgente } = await import("@/lib/agentes/executar");
  let resultado: { sugestoes: number };
  try {
    resultado = await executarAgente("triador", produtoId, "manual", insumoId);
  } catch (e) {
    redirect(
      "/sinais?erro=" + encodeURIComponent(e instanceof Error ? e.message : String(e))
    );
  }
  db.prepare("UPDATE insumo SET processado_em = ? WHERE id = ?").run(agora(), insumoId);
  tudoMudou();
  if (resultado.sugestoes === 0) {
    redirect("/sinais?erro=" + encodeURIComponent("o Triador não extraiu nenhum sinal deste insumo"));
  }
}

// ── Conselheiros: chat por passo do loop ─────────────────────────────────────

/** Envia uma mensagem ao conselheiro do tópico e grava a resposta (e ações). */
export async function conversarSobre(fd: FormData) {
  const produtoId = Number(fd.get("produto_id"));
  const topico = texto(fd, "topico");
  const alvoId = inteiroOuNulo(fd, "alvo_id") ?? 0;
  const mensagem = texto(fd, "mensagem");
  const volta = texto(fd, "volta") || "/";
  if (!mensagem) return;

  const { conversaDoTopico, getConselheiro, JANELA_CONVERSA, mensagensDaConversa, montarSistema } =
    await import("@/lib/conselheiros");
  const { conversar } = await import("@/lib/agentes/cliente-ia");

  const conselheiro = getConselheiro(topico);
  const conversaId = conversaDoTopico(produtoId, topico, alvoId);

  // Reenvio acidental (duplo clique/Enter na espera): mesma mensagem em <90s
  // não vira segunda rodada — o LLM já respondeu ou vai responder a primeira.
  const ultimaDoUsuario = db
    .prepare(
      "SELECT conteudo, criada_em FROM mensagem_conversa WHERE conversa_id = ? AND papel = 'user' ORDER BY id DESC LIMIT 1"
    )
    .get(conversaId) as { conteudo: string; criada_em: string } | undefined;
  if (
    ultimaDoUsuario &&
    ultimaDoUsuario.conteudo === mensagem &&
    Date.now() - Date.parse(ultimaDoUsuario.criada_em) < 90_000
  ) {
    return;
  }

  db.prepare(
    "INSERT INTO mensagem_conversa (conversa_id, papel, conteudo, criada_em) VALUES (?, 'user', ?, ?)"
  ).run(conversaId, mensagem, agora());

  const historico = mensagensDaConversa(conversaId)
    .slice(-JANELA_CONVERSA)
    .map((m) => ({ papel: m.papel, conteudo: m.conteudo }));

  let resposta: Awaited<ReturnType<typeof conversar>>;
  const inicio = agora();
  try {
    resposta = await conversar({
      sistema: montarSistema(conselheiro, produtoId, alvoId),
      mensagens: historico,
      ferramentas: conselheiro.ferramentas?.map((f) => ({
        nome: f.nome,
        descricao: f.descricao,
        schema: f.schema,
      })),
    });
  } catch (e) {
    redirect(`${volta}?erro=` + encodeURIComponent(e instanceof Error ? e.message : String(e)));
  }

  // Auditoria de tokens no mesmo lugar de sempre; ferramentas penduram nela.
  const exec = db
    .prepare(
      `INSERT INTO execucao_agente (produto_id, agente_id, gatilho, modelo, status, tokens_entrada, tokens_saida, iniciada_em, concluida_em)
       VALUES (?, ?, 'conversa', ?, 'ok', ?, ?, ?, ?)`
    )
    .run(
      produtoId,
      `conselheiro_${topico}`,
      resposta.modelo,
      resposta.tokensEntrada,
      resposta.tokensSaida,
      inicio,
      agora()
    );

  const gravarResposta = (conteudo: string) =>
    db
      .prepare(
        "INSERT INTO mensagem_conversa (conversa_id, papel, conteudo, criada_em) VALUES (?, 'assistant', ?, ?)"
      )
      .run(conversaId, conteudo, agora());

  if (resposta.texto.trim()) gravarResposta(resposta.texto.trim());
  for (const chamada of resposta.chamadas) {
    const ferramenta = conselheiro.ferramentas?.find((f) => f.nome === chamada.nome);
    if (!ferramenta) continue;
    gravarResposta(
      ferramenta.aoChamar(produtoId, Number(exec.lastInsertRowid), chamada.argumentos, alvoId)
    );
  }

  // Rodada com ferramenta: o modelo tende a registrar a ação e deixar a fala
  // pela metade (ou no ar). Uma chamada de seguimento — sem ferramentas —
  // completa a resposta na conversa; se falhar, a confirmação acima já basta.
  if (resposta.chamadas.length > 0) {
    try {
      const seguimento = await conversar({
        sistema:
          montarSistema(conselheiro, produtoId, alvoId) +
          "\n\n## Agora\n\nA(s) ferramenta(s) da sua última resposta foram executadas e confirmadas na conversa. Complete o que você prometeu ou ficou devendo ao PM (ex.: as alternativas que ia listar), SEM repetir a confirmação da ferramenta e SEM chamar ferramentas. Se não ficou nada pendente, responda em 1 frase curta o próximo passo sugerido.",
        mensagens: mensagensDaConversa(conversaId)
          .slice(-JANELA_CONVERSA)
          .map((m) => ({ papel: m.papel, conteudo: m.conteudo })),
      });
      if (seguimento.texto.trim()) gravarResposta(seguimento.texto.trim());
      db.prepare(
        "UPDATE execucao_agente SET tokens_entrada = tokens_entrada + ?, tokens_saida = tokens_saida + ? WHERE id = ?"
      ).run(seguimento.tokensEntrada, seguimento.tokensSaida, Number(exec.lastInsertRowid));
    } catch {
      /* segue com a confirmação da ferramenta apenas */
    }
  }

  tudoMudou();
  revalidatePath(volta);
}

export async function limparConversa(fd: FormData) {
  const conversa = db
    .prepare("SELECT id FROM conversa WHERE produto_id = ? AND topico = ? AND alvo_id = ?")
    .get(
      Number(fd.get("produto_id")),
      texto(fd, "topico"),
      inteiroOuNulo(fd, "alvo_id") ?? 0
    ) as { id: number } | undefined;
  if (conversa) {
    db.transaction(() => {
      db.prepare("DELETE FROM mensagem_conversa WHERE conversa_id = ?").run(conversa.id);
      db.prepare("DELETE FROM conversa WHERE id = ?").run(conversa.id);
    })();
  }
  revalidatePath(texto(fd, "volta") || "/");
}

// ── Agente executor: repositórios e PRs ──────────────────────────────────────

export async function criarRepositorio(fd: FormData) {
  const caminho = texto(fd, "caminho_local");
  const { existsSync } = await import("node:fs");
  if (!existsSync(`${caminho}/.git`)) {
    redirect("/fontes?erro=" + encodeURIComponent(`${caminho} não é um repositório git`));
  }
  db.prepare(
    "INSERT INTO repositorio (produto_id, nome, caminho_local, branch_base, executor, instrucoes, criada_em) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(
    Number(fd.get("produto_id")),
    texto(fd, "nome"),
    caminho,
    texto(fd, "branch_base") || "main",
    texto(fd, "executor") || "claude-code",
    texto(fd, "instrucoes"),
    agora()
  );
  revalidatePath("/fontes");
}

export async function atualizarRepositorio(fd: FormData) {
  db.prepare(
    "UPDATE repositorio SET nome = ?, caminho_local = ?, branch_base = ?, executor = ?, instrucoes = ? WHERE id = ?"
  ).run(
    texto(fd, "nome"),
    texto(fd, "caminho_local"),
    texto(fd, "branch_base") || "main",
    texto(fd, "executor") || "claude-code",
    texto(fd, "instrucoes"),
    Number(fd.get("id"))
  );
  revalidatePath("/fontes");
}

export async function apagarRepositorio(fd: FormData) {
  const id = Number(fd.get("id"));
  db.transaction(() => {
    db.prepare("DELETE FROM tarefa_pr WHERE repositorio_id = ?").run(id);
    db.prepare("DELETE FROM repositorio WHERE id = ?").run(id);
  })();
  revalidatePath("/fontes");
}

/**
 * Botões "via PR": enfileira a tarefa e dispara o worker em background.
 * O PR resultante é a sugestão — mergear é o ato humano, no GitHub.
 */
export async function abrirPr(fd: FormData) {
  const produtoId = Number(fd.get("produto_id"));
  const repositorioId = Number(fd.get("repositorio_id"));
  const origemTabela = texto(fd, "origem_tabela");
  const origemId = Number(fd.get("origem_id"));
  const volta = texto(fd, "volta") || "/";

  let titulo = "";
  let instrucoes = "";
  if (origemTabela === "lancamento") {
    const l = db
      .prepare("SELECT nome, hipotese, metrica_primaria, instrumentacao FROM lancamento WHERE id = ?")
      .get(origemId) as
      | { nome: string; hipotese: string; metrica_primaria: string; instrumentacao: string }
      | undefined;
    if (!l?.instrumentacao?.trim()) {
      redirect(`${volta}?erro=` + encodeURIComponent("preencha o plano de instrumentação antes — é ele que vira o PR"));
    }
    titulo = `Instrumentar métricas: ${l.nome}`;
    instrucoes = [
      `Implemente o plano de instrumentação de métricas (PostHog) abaixo, disparando cada evento no lugar certo do produto.`,
      "",
      `Plano de instrumentação:\n${l.instrumentacao}`,
      "",
      l.hipotese ? `Contexto — hipótese do lançamento: ${l.hipotese}` : "",
      l.metrica_primaria ? `Métrica primária que esses eventos alimentam: ${l.metrica_primaria}` : "",
    ].join("\n");
  } else if (origemTabela === "solucao") {
    const s = db
      .prepare("SELECT titulo, descricao FROM solucao WHERE id = ?")
      .get(origemId) as { titulo: string; descricao: string } | undefined;
    if (!s) redirect(`${volta}?erro=` + encodeURIComponent("solução não encontrada"));
    // O brief do Empacotador é a melhor instrução; sem ele, título + descrição + story map.
    const brief = db
      .prepare(
        `SELECT payload FROM sugestao WHERE tipo = 'brief_solucao' AND alvo_tabela = 'solucao'
           AND alvo_id = ? AND estado IN ('aceita', 'sugerida') ORDER BY id DESC LIMIT 1`
      )
      .get(origemId) as { payload: string } | undefined;
    titulo = `Implementar: ${s.titulo}`;
    if (brief) {
      instrucoes = `Implemente a solução descrita no brief abaixo.\n\n${(JSON.parse(brief.payload) as { brief_md: string }).brief_md}`;
    } else {
      const passos = db
        .prepare("SELECT ordem, titulo FROM passo_story_map WHERE solucao_id = ? ORDER BY ordem")
        .all(origemId) as { ordem: number; titulo: string }[];
      instrucoes = [
        `Implemente a solução "${s.titulo}".`,
        s.descricao ? `\nDescrição: ${s.descricao}` : "",
        passos.length
          ? `\nStory map (o que o cliente faz):\n${passos.map((p) => `${p.ordem}. ${p.titulo}`).join("\n")}`
          : "",
      ].join("\n");
    }
  } else {
    redirect(`${volta}?erro=` + encodeURIComponent("origem de PR desconhecida"));
  }

  const info = db
    .prepare(
      "INSERT INTO tarefa_pr (produto_id, repositorio_id, origem_tabela, origem_id, titulo, instrucoes, criada_em) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(produtoId, repositorioId, origemTabela, origemId, titulo, instrucoes, agora());

  const { spawn } = await import("node:child_process");
  spawn("npx", ["tsx", "scripts/executar-pr.ts", String(info.lastInsertRowid)], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
  }).unref();

  tudoMudou();
  revalidatePath(volta);
}

export async function rejeitarSugestao(fd: FormData) {
  db.prepare(
    "UPDATE sugestao SET estado = 'rejeitada', motivo_rejeicao = ? WHERE id = ? AND estado = 'sugerida'"
  ).run(texto(fd, "motivo"), Number(fd.get("id")));
  tudoMudou();
}

// ── Fase 3: fontes de dados plugáveis e medição automática ───────────────────

export async function criarFonte(fd: FormData) {
  const config = texto(fd, "config") || "{}";
  const tipo = texto(fd, "tipo");
  try {
    JSON.parse(config);
  } catch {
    redirect("/fontes?erro=" + encodeURIComponent("config não é JSON válido"));
  }
  if (!PROVEDORES.has(tipo)) {
    redirect("/fontes?erro=" + encodeURIComponent(`tipo desconhecido: ${tipo}`));
  }
  db.prepare(
    "INSERT INTO fonte_dados (produto_id, nome, tipo, config, criada_em) VALUES (?, ?, ?, ?, ?)"
  ).run(Number(fd.get("produto_id")), texto(fd, "nome"), tipo, config, agora());
  revalidatePath("/fontes");
  tudoMudou();
}

export async function atualizarFonte(fd: FormData) {
  const config = texto(fd, "config") || "{}";
  try {
    JSON.parse(config);
  } catch {
    redirect("/fontes?erro=" + encodeURIComponent("config não é JSON válido"));
  }
  db.prepare("UPDATE fonte_dados SET nome = ?, tipo = ?, config = ? WHERE id = ?").run(
    texto(fd, "nome"),
    texto(fd, "tipo"),
    config,
    Number(fd.get("id"))
  );
  revalidatePath("/fontes");
  tudoMudou();
}

export async function apagarFonte(fd: FormData) {
  const id = Number(fd.get("id"));
  db.transaction(() => {
    db.prepare("UPDATE metrica_negocio SET fonte_dados_id = NULL WHERE fonte_dados_id = ?").run(id);
    db.prepare("UPDATE lancamento SET fonte_dados_id = NULL WHERE fonte_dados_id = ?").run(id);
    db.prepare("DELETE FROM fonte_dados WHERE id = ?").run(id);
  })();
  revalidatePath("/fontes");
  tudoMudou();
}

/** Executa a fonte plugada da métrica e registra o valor de hoje. */
export async function medirMetrica(fd: FormData) {
  const id = Number(fd.get("id"));
  const metrica = db
    .prepare("SELECT fonte_dados_id, consulta FROM metrica_negocio WHERE id = ?")
    .get(id) as { fonte_dados_id: number | null; consulta: string } | undefined;
  const fonte = metrica?.fonte_dados_id ? getFonte(metrica.fonte_dados_id) : null;
  if (!metrica || !fonte) return;

  let valor: number;
  try {
    valor = (await medir(fonte, metrica.consulta)).valor;
  } catch (e) {
    redirect("/metricas?erro=" + encodeURIComponent(e instanceof Error ? e.message : String(e)));
  }
  const data = hojeLocal();
  db.prepare("INSERT INTO metrica_valor (metrica_id, valor, data) VALUES (?, ?, ?)").run(id, valor, data);
  db.prepare("UPDATE metrica_negocio SET valor_atual = ?, atualizado_em = ? WHERE id = ?").run(valor, data, id);
  tudoMudou();
}

/** Executa a fonte plugada do lançamento e registra a revisão com o valor medido. */
export async function medirRevisao(fd: FormData) {
  const id = Number(fd.get("id"));
  const revisao = db
    .prepare("SELECT lancamento_id FROM revisao WHERE id = ?")
    .get(id) as { lancamento_id: number } | undefined;
  if (!revisao) return;
  const lancamento = db
    .prepare("SELECT fonte_dados_id, consulta FROM lancamento WHERE id = ?")
    .get(revisao.lancamento_id) as { fonte_dados_id: number | null; consulta: string };
  const fonte = lancamento.fonte_dados_id ? getFonte(lancamento.fonte_dados_id) : null;
  if (!fonte) return;

  let valor: number;
  let detalhe: string;
  try {
    const resultado = await medir(fonte, lancamento.consulta);
    valor = resultado.valor;
    detalhe = resultado.detalhe;
  } catch (e) {
    redirect(
      `/lancamentos/${revisao.lancamento_id}?erro=` +
        encodeURIComponent(e instanceof Error ? e.message : String(e))
    );
  }
  db.prepare(
    "UPDATE revisao SET valor_observado = ?, data_realizada = ?, notas = ? WHERE id = ?"
  ).run(String(valor), hojeLocal(), detalhe, id);
  tudoMudou();
  revalidatePath(`/lancamentos/${revisao.lancamento_id}`);
}

export async function registrarRevisao(fd: FormData) {
  const id = Number(fd.get("id"));
  const revisao = db.prepare("SELECT lancamento_id FROM revisao WHERE id = ?").get(id) as
    | { lancamento_id: number }
    | undefined;
  db.prepare(
    "UPDATE revisao SET data_realizada = ?, valor_observado = ?, notas = ? WHERE id = ?"
  ).run(texto(fd, "data_realizada") || hojeLocal(), texto(fd, "valor_observado"), texto(fd, "notas"), id);
  tudoMudou();
  if (revisao) revalidatePath(`/lancamentos/${revisao.lancamento_id}`);
}
