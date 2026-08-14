"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { agora, db, hojeLocal } from "@/lib/db";
import { avaliacaoCompleta, getAvaliacao, LIMITE_WIP } from "@/lib/queries";

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
    `INSERT INTO entrevista (produto_id, data, entrevistado, persona_id, link_gravacao, historia, notas, criada_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    Number(fd.get("produto_id")),
    texto(fd, "data") || hojeLocal(),
    texto(fd, "entrevistado"),
    inteiroOuNulo(fd, "persona_id"),
    texto(fd, "link_gravacao"),
    texto(fd, "historia"),
    texto(fd, "notas"),
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
       veredito = ?, aprendizado = ?
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
