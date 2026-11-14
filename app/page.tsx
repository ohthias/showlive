import Link from "next/link";
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  EyeOff,
  KeyRound,
  ListChecks,
  LayoutDashboard,
  Palette,
  Radio,
  ShieldCheck,
  Swords,
  Timer,
  Trophy,
  Tv,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";
import { DemoBoard } from "@/components/site/DemoBoard";
import { EnterCodeForm } from "@/components/site/EnterCodeForm";
import { AnimatedBackground, cornerBtn, SectionTitle, Tag, toneClasses, type Tone } from "@/components/ui/brand";

const steps: { n: string; title: string; text: string; icon: LucideIcon }[] = [
  {
    n: "01",
    title: "Entre com sua conta RoboStage",
    text: "Não tem cadastro novo: é a mesma conta do RoboStage. Abra o hub e crie o evento escolhendo a temporada da FLL.",
    icon: UserPlus,
  },
  {
    n: "02",
    title: "Monte o evento no hub",
    text: "Cole a lista de equipes, ajuste as rodadas, escolha o tema do telão e convide quem vai ajudar na organização.",
    icon: LayoutDashboard,
  },
  {
    n: "03",
    title: "Compartilhe dois códigos",
    text: "O código do evento abre o telão para o público. O código da mesa abre a arbitragem para os voluntários — sem conta.",
    icon: KeyRound,
  },
];

const screens: { icon: LucideIcon; who: string; title: string; text: string; bullets: string[]; tone: Tone }[] = [
  {
    icon: LayoutDashboard,
    who: "ORGANIZAÇÃO · CONTA ROBOSTAGE",
    title: "Hub",
    text: "Onde o evento é configurado e acompanhado.",
    bullets: ["Equipes, rodadas e regras", "Códigos de mesa revogáveis", "Correção de notas com histórico", "Vários admins por evento"],
    tone: "primary",
  },
  {
    icon: ClipboardCheck,
    who: "JUÍZES · CÓDIGO DA MESA",
    title: "Mesa",
    text: "A súmula da partida, no celular ou tablet.",
    bullets: ["Missões oficiais da temporada", "Nota calculada pelo mesmo motor do Pontuador", "Só mostra rodadas liberadas", "Duas mesas nunca duplicam uma nota"],
    tone: "secondary",
  },
  {
    icon: Tv,
    who: "PÚBLICO · CÓDIGO DO EVENTO",
    title: "Telão",
    text: "O ranking que atualiza sozinho no projetor e no celular.",
    bullets: ["Comemoração a cada nota", "Cronômetro sincronizado", "Chave de semifinal e final", "Tema da temporada"],
    tone: "accent",
  },
];

const features: { icon: LucideIcon; title: string; text: string; tone: Tone }[] = [
  {
    icon: Radio,
    title: "Tempo real de verdade",
    text: "A nota sai da mesa e aparece no telão em cerca de um segundo, sem recarregar. A versão anterior consultava a cada 10 s.",
    tone: "primary",
  },
  {
    icon: Trophy,
    title: "Desempate oficial",
    text: "Vale a maior nota; empate é decidido pela segunda e depois pela terceira, como na FLL. Também há modo soma.",
    tone: "accent",
  },
  {
    icon: ShieldCheck,
    title: "Nota à prova de erro",
    text: "O servidor recalcula a pontuação a partir das missões marcadas e o banco impede duas notas para a mesma rodada.",
    tone: "secondary",
  },
  {
    icon: Swords,
    title: "Playoffs",
    text: "Semifinal com as 4 melhores e final com as 2 melhores, ou final direta. A chave aparece sozinha no telão.",
    tone: "primary",
  },
  {
    icon: Timer,
    title: "Cronômetro compartilhado",
    text: "Mesa ou organização dão o start e todas as telas mostram o mesmo tempo, corrigido pelo relógio do servidor.",
    tone: "secondary",
  },
  {
    icon: EyeOff,
    title: "Suspense opcional",
    text: "Oculte as notas até a rodada terminar. A regra é aplicada no servidor: a nota nem chega ao navegador do público.",
    tone: "accent",
  },
  {
    icon: Swords,
    title: "Ligas prontas",
    text: "FLL Challenge e Future Edition com as missões oficiais; OBR Resgate com 3 arenas montadas por você, soma das 2 melhores e desempate por tempo.",
    tone: "secondary",
  },
  {
    icon: ListChecks,
    title: "Desafios do seu jeito",
    text: "Monte tipo, objetivo, regras e pontuação. O ShowLive gera o regulamento e a súmula da mesa, e você salva como template.",
    tone: "accent",
  },
  {
    icon: Palette,
    title: "Telão com a cara do evento",
    text: "Temas das temporadas, cores próprias, imagem ou vídeo de fundo e logo do evento.",
    tone: "primary",
  },
  {
    icon: Users,
    title: "Equipe de organização",
    text: "Convide admins e apuradores pelo e-mail da conta RoboStage. Quem ainda não tem conta recebe o acesso no primeiro login.",
    tone: "secondary",
  },
];

const compare: { item: string; before: string | boolean; now: string | boolean }[] = [
  { item: "Atualização do ranking", before: "a cada 10 segundos", now: "≈ 1 segundo (SSE)" },
  { item: "Onde roda", before: "dentro do RoboStage", now: "showlive.robostage.com.br" },
  { item: "Banco de dados", before: "compartilhado", now: "Neon dedicado ao ShowLive" },
  { item: "Cálculo da nota", before: "no navegador", now: "no servidor" },
  { item: "Nota duplicada entre mesas", before: true, now: false },
  { item: "Mais de um admin por evento", before: false, now: true },
  { item: "Revogar o código de uma mesa", before: false, now: true },
  { item: "Correção de nota com histórico", before: false, now: true },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="overflow-x-clip">
        {/* HERO */}
        <section className="relative isolate overflow-hidden px-6 pb-20 pt-14 sm:pt-20">
          <AnimatedBackground />
          <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_1fr] [&>*]:min-w-0">
            <div>
              <Tag className="border-primary bg-primary/10 text-primary">
                <span className="live-dot" /> NOVA VERSÃO
              </Tag>
              <h1 className="mt-5 text-5xl font-bold tracking-tight sm:text-7xl">
                Show<span className="text-primary">Live</span>
                <span className="text-primary">.</span>
              </h1>
              <p className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                Seu evento,{" "}
                <span className="inline-block -rotate-1 bg-accent px-2 text-accent-content">ao vivo.</span>
              </p>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-base-content/65 sm:text-lg">
                Ranking em tempo real, mesa dos juízes e telão para FLL Challenge, FLL Future Edition, OBR Resgate ou um
                desafio criado por você. Crie o evento com a sua conta RoboStage e compartilhe os códigos — o resto
                acontece sozinho.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href="/hub"
                  className={`btn btn-primary btn-lg ${cornerBtn} shadow-[4px_4px_0_0_var(--color-base-content)] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_var(--color-base-content)]`}
                >
                  Criar meu evento
                  <ArrowRight size={20} />
                </Link>
                <a href="#como-funciona" className="btn btn-ghost btn-lg">
                  Como funciona
                </a>
              </div>

              <div className="mt-10 max-w-md rounded-tl-2xl rounded-br-2xl border border-base-300 bg-base-100/80 p-4 backdrop-blur">
                <p className="kicker mb-2">/ JÁ TEM UM CÓDIGO?</p>
                <EnterCodeForm compact />
              </div>
            </div>
            <DemoBoard />
          </div>
        </section>

        {/* COMO FUNCIONA */}
        <section id="como-funciona" className="scroll-mt-20 border-y border-base-300 bg-base-200/40 px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <SectionTitle
              kicker="/ COMO FUNCIONA"
              title="Três passos,"
              highlight="nenhum cadastro novo."
              highlightClass="bg-secondary text-secondary-content"
              description="O ShowLive é uma aplicação separada, mas a conta é a do RoboStage. Quem organiza entra com ela; quem julga e quem assiste só precisa de um código."
            />
            <div className="relative mt-14">
              <div
                aria-hidden
                className="absolute left-[16.66%] right-[16.66%] top-[2.6rem] hidden border-t-2 border-dashed border-base-300 md:block"
              />
              <ol className="relative grid gap-5 md:grid-cols-3">
                {steps.map(({ n, title, text, icon: Icon }, i) => (
                  <li key={n}>
                    <article className="relative flex h-full flex-col rounded-tl-2xl rounded-br-2xl border-2 border-base-300 bg-base-100 p-6">
                      <div className="flex items-center justify-between">
                        <span
                          className={`relative z-10 grid size-11 place-items-center rounded-tl-xl rounded-br-xl ${
                            i === 2 ? "bg-primary text-primary-content" : "bg-base-200"
                          }`}
                        >
                          <Icon size={20} strokeWidth={1.8} />
                        </span>
                        <span className="font-mono text-2xl font-bold text-base-content/15">{n}</span>
                      </div>
                      <h3 className="mt-6 text-xl font-bold tracking-tight">{title}</h3>
                      <p className="mt-2 text-sm leading-6 text-base-content/65">{text}</p>
                    </article>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* TRÊS TELAS */}
        <section className="px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <SectionTitle
              kicker="/ TRÊS TELAS, UM EVENTO"
              title="Cada pessoa vê"
              highlight="só o que precisa."
              description="As permissões da versão anterior continuam — organização, voluntários e público — agora com um hub de administração de verdade."
            />
            <div className="mt-14 grid gap-5 lg:grid-cols-3">
              {screens.map(({ icon: Icon, who, title, text, bullets, tone }) => {
                const c = toneClasses[tone];
                return (
                  <article
                    key={title}
                    className={`group flex flex-col rounded-tl-3xl rounded-br-3xl border border-base-300 bg-base-100 p-7 transition-all duration-300 hover:-translate-y-1 ${c.hover}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`flex size-14 items-center justify-center rounded-tl-xl rounded-br-xl transition-colors ${c.icon}`}>
                        <Icon size={24} strokeWidth={1.8} />
                      </div>
                      <span className={`font-mono text-[10px] font-bold tracking-[0.14em] ${c.tag}`}>{who}</span>
                    </div>
                    <h3 className="mt-7 text-3xl font-bold tracking-tight">{title}</h3>
                    <p className="mt-2 text-base-content/60">{text}</p>
                    <ul className="mt-6 space-y-2.5 border-t border-dashed border-base-300 pt-5">
                      {bullets.map((b) => (
                        <li key={b} className="flex items-start gap-3 text-sm">
                          <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${c.dot}`} />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* RECURSOS */}
        <section id="recursos" className="scroll-mt-20 border-y border-base-300 bg-base-200/40 px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <SectionTitle
              kicker="/ RECURSOS"
              title="Feito para o"
              highlight="dia do torneio."
              highlightClass="bg-accent text-accent-content"
            />
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {features.map(({ icon: Icon, title, text, tone }) => {
                const c = toneClasses[tone];
                return (
                  <article
                    key={title}
                    className={`group flex h-full flex-col rounded-tl-2xl rounded-br-2xl border border-base-300 bg-base-100 p-6 transition-all duration-300 hover:-translate-y-1 ${c.hover}`}
                  >
                    <div className={`flex size-12 items-center justify-center rounded-tl-xl rounded-br-xl transition-colors ${c.icon}`}>
                      <Icon size={22} strokeWidth={1.8} />
                    </div>
                    <h3 className="mt-6 text-lg font-bold tracking-tight">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-base-content/60">{text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ANTES x AGORA */}
        <section className="px-6 py-24">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_1.3fr] [&>*]:min-w-0">
            <SectionTitle
              kicker="/ VERSÃO ANTERIOR → NOVA"
              title="A mesma ideia,"
              highlight="reconstruída."
              highlightClass="bg-secondary text-secondary-content"
              description="Os códigos de acesso, a mesa do robô e o ranking ao vivo da primeira versão continuam. O que mudou foi a base."
            />
            <div className="overflow-hidden rounded-tl-3xl rounded-br-3xl border border-base-300 bg-base-100 shadow-[8px_8px_0_0_var(--color-primary)]">
              <table className="table">
                <thead>
                  <tr className="font-mono text-[10px] tracking-[0.14em]">
                    <th />
                    <th>ANTES</th>
                    <th className="text-primary">AGORA</th>
                  </tr>
                </thead>
                <tbody>
                  {compare.map(({ item, before, now }) => (
                    <tr key={item}>
                      <td className="font-medium">{item}</td>
                      <td className="text-base-content/55">
                        <Cell value={before} negative={item.startsWith("Nota duplicada")} />
                      </td>
                      <td className="font-semibold">
                        <Cell value={now} negative={item.startsWith("Nota duplicada")} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 pb-24">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-tl-[2.5rem] rounded-br-[2.5rem] bg-[#1f1c18] p-10 text-[#f3ecdc] sm:p-14">
            <div aria-hidden className="absolute -right-10 -top-10 size-48 rotate-12 rounded-tl-3xl rounded-br-3xl bg-[#e04444]/90" />
            <div className="relative max-w-2xl">
              <p className="font-mono text-xs tracking-[0.2em] text-white/50">/ PRONTO PARA O PRÓXIMO TORNEIO?</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
                Crie o evento agora e{" "}
                <span className="inline-block -rotate-1 bg-[#fabd32] px-2 italic text-[#2f2108]">teste com a equipe.</span>
              </h2>
              <p className="mt-5 text-white/65">
                Comece em modo preparação, faça uma rodada de ensaio e zere as notas antes do evento. É grátis com a sua
                conta RoboStage.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/hub" className={`btn btn-lg border-0 bg-[#e04444] text-white hover:bg-[#cf2a2a] ${cornerBtn}`}>
                  Abrir o hub <ArrowRight size={20} />
                </Link>
                <Link href="/entrar" className="btn btn-lg btn-ghost text-white hover:bg-white/10">
                  <KeyRound size={18} /> Entrar com código
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function Cell({ value, negative }: { value: string | boolean; negative?: boolean }) {
  if (typeof value === "string") return <>{value}</>;
  const good = negative ? !value : value;
  return value ? (
    <span className={`inline-flex items-center gap-1 ${good ? "text-success" : "text-error"}`}>
      {good ? <Check size={16} /> : <X size={16} />} {negative ? "possível" : "sim"}
    </span>
  ) : (
    <span className={`inline-flex items-center gap-1 ${good ? "text-success" : "text-base-content/40"}`}>
      {good ? <Check size={16} /> : <X size={16} />} {negative ? "impossível" : "não"}
    </span>
  );
}
