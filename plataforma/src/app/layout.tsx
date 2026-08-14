import type { Metadata } from "next";
import { Archivo, Fraunces, Spline_Sans_Mono } from "next/font/google";
import { getProduto } from "@/lib/queries";
import { Nav } from "./nav";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo" });
const splineMono = Spline_Sans_Mono({
  subsets: ["latin"],
  variable: "--font-spline-mono",
});

export const metadata: Metadata = {
  title: "Loop",
  description: "Plataforma pessoal de gestão de produto — o loop, da métrica ao impacto",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const produto = getProduto();
  return (
    <html
      lang="pt-BR"
      className={`${fraunces.variable} ${archivo.variable} ${splineMono.variable}`}
    >
      <body className="antialiased">
        <div className="flex min-h-screen">
          <aside className="sticky top-0 flex h-screen w-52 shrink-0 flex-col border-r border-line px-4 py-6">
            <div className="mb-8 px-3">
              <div className="display text-3xl font-semibold italic">
                Loop<span className="text-accent">.</span>
              </div>
              <div className="eyebrow mt-1">produto em ciclo</div>
            </div>
            <Nav />
            <div className="mt-auto px-3">
              <div className="eyebrow mb-1">workspace</div>
              <div className="text-sm font-semibold">{produto?.nome ?? "—"}</div>
            </div>
          </aside>
          <main className="mx-auto w-full max-w-5xl flex-1 px-8 py-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
