"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { agora, db, hojeLocal } from "@/lib/db";

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
  db.prepare("UPDATE oportunidade SET estado = ? WHERE id = ?").run(
    texto(fd, "estado"),
    Number(fd.get("id"))
  );
  tudoMudou();
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
      `INSERT INTO lancamento (produto_id, nome, data_lancamento, criada_em) VALUES (?, ?, ?, ?)`
    )
    .run(
      Number(fd.get("produto_id")),
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
