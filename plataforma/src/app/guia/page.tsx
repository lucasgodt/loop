import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * O manual da plataforma: o método (o loop) e onde cada passo acontece.
 * Conteúdo estático de propósito — o estado vivo mora no checklist da home.
 */

const PASSOS: {
  n: number;
  titulo: string;
  oQueFazer: string;
  onde: { href: string; rotulo: string };
  agente?: string;
}[] = [
  {
    n: 1,
    titulo: "Métrica de negócio (lagging)",
    oQueFazer:
      "Escolha a métrica que o negócio quer mover e dê meta a ela. É o começo e o fim do loop: tudo que você lançar vai apontar para cá. Lagging = demora a mexer; é por isso que cada lançamento tem a própria métrica leading.",
    onde: { href: "/metricas", rotulo: "Métricas" },
    agente: "Vigia — alerta na home quando uma métrica foge ±20% da média (sem IA, roda no npm run atualizar).",
  },
  {
    n: 2,
    titulo: "Jornada do cliente",
    oQueFazer:
      "Mapeie, por persona, os passos que o cliente percorre para extrair valor. A jornada é o esqueleto: cada oportunidade nasce pendurada no passo onde a dor acontece.",
    onde: { href: "/oportunidades", rotulo: "Oportunidades (a árvore pendura na jornada)" },
  },
  {
    n: 3,
    titulo: "Escuta contínua: entrevistas + sinais",
    oQueFazer:
      "Uma entrevista por semana (o streak da home cobra) e sinais capturados do CS, das escolas, de onde vier. Cole a transcrição na entrevista e sintetize; cole a daily do CS na caixa de triagem.",
    onde: { href: "/entrevistas", rotulo: "Entrevistas · Sinais" },
    agente:
      "Roteirista — roteiro story-based por persona/oportunidade. Triador — transforma texto bruto em sinais com citação literal verificada, e propõe onde cada um entra na árvore.",
  },
  {
    n: 4,
    titulo: "Árvore de oportunidades",
    oQueFazer:
      "Promova sinais e entrevistas a oportunidades — sempre com evidência ligada (sem evidência o sistema trata como palpite). Use a visão em árvore para pensar dependências: filhas penduradas em mães, soluções como folhas.",
    onde: { href: "/oportunidades", rotulo: "Oportunidades" },
    agente: "Triador (modo inbox) — sinais parados ganham proposta de destino no cron da manhã.",
  },
  {
    n: 5,
    titulo: "Priorização (4 critérios)",
    oQueFazer:
      "Avalie tamanho, companhia, mercado e cliente — nota + justificativa, comparando com as irmãs. Registre a decisão com as palavras 'escolhemos X em vez de Y'. Máximo de 2 oportunidades em discovery (WIP).",
    onde: { href: "/priorizacao", rotulo: "Priorização" },
    agente:
      "Redator de Avaliação (botão na oportunidade) — rascunha notas e justificativas citando as evidências; a decisão é só sua.",
  },
  {
    n: 6,
    titulo: "Ideação (3+ soluções)",
    oQueFazer:
      "A primeira ideia raramente é a melhor: o sistema só destrava suposições com 3+ soluções na oportunidade. Anote até as que você vai descartar — o contraste é o valor.",
    onde: { href: "/oportunidades", rotulo: "página da oportunidade" },
    agente:
      "Provocador de Ideias (botão) — até 3 candidatas por mecanismos diferentes dos seus; cada uma aprovada individualmente, e só conta pro 3/3 depois do aceite.",
  },
  {
    n: 7,
    titulo: "Suposições (5 lentes)",
    oQueFazer:
      "Story map da solução e, passo a passo: o que precisa ser verdade? Classifique nas lentes (desejável, viável, factível, usável, ética) com importância × evidência — a lista já vem ordenada por risco.",
    onde: { href: "/oportunidades", rotulo: "página da solução" },
    agente: "Agente de Risco (botão) — mapeia candidatas (você carimba a matriz) e desenha o teste da mais arriscada.",
  },
  {
    n: 8,
    titulo: "Testes de suposição",
    oQueFazer:
      "Teste a mais arriscada primeiro, do jeito mais barato. O critério de sucesso é numérico e vem ANTES do teste — o sistema não aceita teste sem critério. Nem todo risco pede teste: alguns se mitigam por decisão de DESENHO da solução — anote a mitigação na suposição (🛡) e ela vira requisito no brief.",
    onde: { href: "/oportunidades", rotulo: "página da solução" },
  },
  {
    n: 9,
    titulo: "Desenvolvimento",
    oQueFazer:
      "Só entra em desenvolvimento o que sobreviveu: o brief carrega o que foi validado E o que não foi. Marque a solução como 'lançada' apenas com ficha de lançamento criada — é a regra que impede lançar sem métrica.",
    onde: { href: "/lancamentos", rotulo: "Lançamentos" },
    agente:
      "Empacotador (botão na solução) — brief pronto para o Linear. Executor — 'Implementar via PR': código num worktree isolado + PR para você revisar.",
  },
  {
    n: 10,
    titulo: "Mensuração e veredito",
    oQueFazer:
      "Ficha antes de lançar: hipótese, métrica primária (leading → aponta para a lagging), baseline, meta, guardrails, como medir. Revisões em 30/60/90 dias. No fim, veredito + aprendizado — a única parte que sobrevive.",
    onde: { href: "/lancamentos", rotulo: "Lançamentos" },
    agente:
      "Fechador de Loop — rascunha a ficha (com SQL testado em dry-run e baseline medida) e, quando as revisões acabam, rascunha o veredito. Executor — 'Instrumentar via PR' instala os eventos do plano no código.",
  },
];

const PORTOES = [
  ["Oportunidade nasce com evidência", "promover um sinal/entrevista liga a evidência junto; criar sem nada marca 'sem evidência — palpite'."],
  ["Discovery exige avaliação completa + vaga no WIP (máx. 2)", "priorizar é comparar; WIP alto é a morte da cadência."],
  ["Suposições exigem 3+ soluções", "quebra a fixação na primeira ideia antes de aprofundar."],
  ["Teste exige critério numérico definido antes", "depois do resultado, qualquer número parece o combinado."],
  ["Solução 'lançada' exige ficha de lançamento", "é a regra que resolve o problema original: lançar sem medir."],
  ["Agente nunca grava avaliação, veredito ou oportunidade sozinho", "acima de qualquer configuração — aceitar a sugestão é o ato humano."],
  ["PR nunca vai na branch principal", "worktree isolado + branch própria; mergear é decisão sua, no GitHub."],
];

export default function Guia() {
  return (
    <div>
      <div className="eyebrow">o método · continuous discovery</div>
      <h1 className="display mt-1 text-4xl font-medium">Como usar a plataforma</h1>
      <p className="mt-3 max-w-2xl text-sm">
        O Loop. implementa um loop de produto: <strong>medir → escutar → escolher →
        testar → lançar → medir de novo</strong>. A plataforma não é um cadastro — é o
        processo com portões. Se algo parece &quot;travado&quot;, é o método falando:
        o caminho certo está sempre indicado no próprio bloqueio.
      </p>

      <section className="mt-8">
        <h2 className="lbl">A rotina que funciona</h2>
        <div className="card space-y-2 text-sm">
          <p>
            <strong>Todo dia (5 min):</strong> abra a home. Ela diz o que fazer agora —
            sugestões dos agentes para aprovar, sinais para triar, revisões vencendo.
            Aprovar/rejeitar sugestões é a sua parte do trabalho automatizado.
          </p>
          <p>
            <strong>Quando chegar insumo</strong> (daily do CS, thread, reclamação):
            cole na caixa &quot;triar com IA&quot; em <Link className="text-accent underline" href="/sinais">Sinais</Link> e
            aprove o que o Triador propôs.
          </p>
          <p>
            <strong>Toda semana (1h):</strong> uma entrevista — o Roteirista prepara o
            roteiro, você conversa, cola a transcrição e sintetiza. O streak da home
            cobra.
          </p>
          <p>
            <strong>Antes de qualquer lançamento:</strong> ficha preenchida (o Fechador
            rascunha). <strong>Depois:</strong> as revisões de 30/60/90 se medem
            sozinhas se a fonte estiver plugada; no fim, aceite (ou corrija) o veredito.
          </p>
          <p className="text-muted">
            Agende o automático:{" "}
            <code className="font-mono text-xs">npm run atualizar</code> às 7h (mede
            métricas, Vigia) e <code className="font-mono text-xs">npm run agentes</code>{" "}
            às 8h (tria inbox, mede revisões vencidas, rascunha vereditos) — via cron.
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="lbl">O loop, passo a passo</h2>
        <ol className="mt-2 space-y-3">
          {PASSOS.map((p) => (
            <li key={p.n} className="card">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">
                  <span className="font-mono text-xs text-muted">{p.n}.</span> {p.titulo}
                </span>
                <Link href={p.onde.href} className="text-xs text-accent underline">
                  {p.onde.rotulo} →
                </Link>
              </div>
              <p className="mt-1 text-sm">{p.oQueFazer}</p>
              {p.agente && (
                <p className="mt-1 text-xs text-muted">🤖 {p.agente}</p>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8">
        <h2 className="lbl">Os portões — o que o sistema não deixa furar (e por quê)</h2>
        <ul className="card space-y-2">
          {PORTOES.map(([regra, porque]) => (
            <li key={regra} className="text-sm">
              <strong>{regra}.</strong> <span className="text-muted">{porque}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="lbl">Como os agentes trabalham</h2>
        <div className="card space-y-2 text-sm">
          <p>
            Todo agente <strong>propõe, nunca executa</strong>: a proposta vira um card
            (na home e na página do alvo) e aceitar aplica pelas mesmas mutações do
            fluxo manual — por isso agente não fura portão. Rejeitar pede um motivo:
            ele melhora os prompts.
          </p>
          <p>
            Tudo que um agente afirma vem de dado real: sinal citando o texto-fonte
            (verificado mecanicamente), SQL testado com dry-run antes de aparecer,
            avaliação citando evidências. Sem insumo, o agente diz &quot;sem insumo&quot;
            — nunca inventa.
          </p>
          <p className="text-muted">
            Custo: fração de centavo por rodada (~2k tokens); auditável por execução.
            Sem <code className="font-mono text-xs">OPENAI_API_KEY</code> tudo continua
            funcionando manualmente.
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="lbl">PRs em seu nome</h2>
        <div className="card space-y-2 text-sm">
          <p>
            Com um repositório plugado em{" "}
            <Link className="text-accent underline" href="/fontes">Fontes</Link>, dois
            botões aparecem: <strong>Instrumentar via PR</strong> (na ficha — instala os
            eventos do plano de instrumentação no código) e{" "}
            <strong>Implementar via PR</strong> (na solução — usa o brief do
            Empacotador). O agente trabalha num worktree isolado, abre branch própria e
            propõe um PR pelo <code className="font-mono text-xs">gh</code>.
          </p>
          <p className="text-muted">
            O PR é a sugestão em forma de código: revise o diff no GitHub e decida.
            Mergear nunca é automático.
          </p>
        </div>
      </section>

      <p className="mt-8 text-xs text-muted">
        O caminho de configuração inicial (9 passos auto-detectados) mora na{" "}
        <Link className="underline" href="/">home</Link> até você dispensá-lo. Specs
        completas: <code className="font-mono">plataforma.md</code> e{" "}
        <code className="font-mono">agentes.md</code> na raiz do repositório.
      </p>
    </div>
  );
}
