"use client";

import { useFormStatus } from "react-dom";
import { conversarSobre } from "@/app/actions";

/**
 * O form de envio da conversa — client component só pelo useFormStatus:
 * enquanto o conselheiro pensa (~segundos), o campo e o botão desabilitam e
 * dizem isso, em vez de parecer que nada aconteceu (e provocar reenvio).
 */

function Campos({ placeholder }: { placeholder: string }) {
  const { pending } = useFormStatus();
  return (
    <>
      <input
        name="mensagem"
        required
        autoComplete="off"
        disabled={pending}
        className="field flex-1 disabled:opacity-50"
        placeholder={pending ? "o conselheiro está pensando…" : placeholder}
      />
      <button className="btn disabled:opacity-50" type="submit" disabled={pending}>
        {pending ? "pensando…" : "Enviar"}
      </button>
    </>
  );
}

export function FormConversa({
  produtoId,
  topico,
  volta,
  placeholder,
  alvoId = 0,
}: {
  produtoId: number;
  topico: string;
  volta: string;
  placeholder: string;
  alvoId?: number;
}) {
  return (
    <form action={conversarSobre} className="mt-3 flex gap-2 border-t border-line pt-3">
      <input type="hidden" name="produto_id" value={produtoId} />
      <input type="hidden" name="topico" value={topico} />
      <input type="hidden" name="alvo_id" value={alvoId} />
      <input type="hidden" name="volta" value={volta} />
      <Campos placeholder={placeholder} />
    </form>
  );
}
