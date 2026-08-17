"use client";

import { useFormStatus } from "react-dom";

/**
 * Botão de submit com estado de espera — para toda ação que chama um agente
 * (segundos de LLM) ou mede uma fonte externa. Enquanto a action roda, o
 * botão desabilita e diz o que está acontecendo, em vez de parecer morto.
 * Precisa ser filho do <form> (useFormStatus lê o form ancestral).
 */
export function BotaoPendente({
  rotulo,
  rotuloPendente = "trabalhando…",
  className = "btn",
  title,
}: {
  rotulo: string;
  rotuloPendente?: string;
  className?: string;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className={`${className} disabled:cursor-wait disabled:opacity-50`}
      type="submit"
      disabled={pending}
      title={title}
    >
      {pending ? rotuloPendente : rotulo}
    </button>
  );
}
