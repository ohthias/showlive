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
import { toneClasses, type Tone } from "@/components/ui/brand";
import {
  AnimatedBackground,
  ButtonLink,
  Card,
  Gear,
  Highlight,
  Kicker,
  Marquee,
  Mascot,
  Section,
  SectionTitle,
  Sparkle,
  Starburst,
  StatusBadge,
} from "@/components/stage";

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

const ligas = ["FLL Challenge", "FLL Future Edition", "OBR Resgate", "FTC · Alianças", "Desafios próprios", "Avaliação por rubricas"];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="overflow-x-clip">
        {/* HERO */}
        <section className="relative isolate overflow-hidden px-6 pb-20 pt-14 sm:pt-20">
          <AnimatedBackground />
          <Starburst size={64} tone="accent" motion="spin" className="absolute right-[6%] top-10 hidden lg:block" />
          <Gear size={44} tone="secondary" motion="spin" className="absolute bottom-16 left-[3%] hidden xl:block" />
          <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_1fr] [&>*]:min-w-0">
            <div>
              <StatusBadge status="live">Nova versão</StatusBadge>
              <h1 className="stage-display mt-5 text-6xl sm:text-8xl">
                Show<span className="text-primary">Live</span>
                <span className="text-primary">.</span>
              </h1>
              <p className="stage-display mt-4 text-2xl sm:text-4xl">
                Seu evento,{" "}
                <Highlight variant="block" tone="accent">
                  ao vivo.
                </Highlight>
              </p>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-base-content/65 sm:text-lg">
                Ranking em tempo real, mesa dos juízes e telão para FLL Challenge, FLL Future Edition, OBR Resgate ou um
                desafio criado por você. Crie o evento com a sua conta RoboStage e compartilhe os códigos — o resto
                acontece sozinho.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <ButtonLink href="/hub" size="lg" iconRight={<ArrowRight size={20} />}>
                  Criar meu evento
                </ButtonLink>
                <ButtonLink href="#como-funciona" tone="ghost" size="lg" shape="rounded">
                  Como funciona
                </ButtonLink>
              </div>

              <Card corner className="mt-10 max-w-md bg-base-100/85 p-4 backdrop-blur">
                <Kicker className="mb-2 text-[11px]">Já tem um código?</Kicker>
                <EnterCodeForm compact />
              </Card>
            </div>
            <DemoBoard />
          </div>
        </section>

        <Marquee items={ligas} tone="ink" speed={40} tilt={-1} className="relative z-10 -mx-4" />

        {/* COMO FUNCIONA */}
        <Section id="como-funciona" tone="muted" innerClassName="relative">
          <div className="mx-auto max-w-6xl">
            <SectionTitle
              kicker="/ COMO FUNCIONA"
              title="Três passos,"
              highlight="nenhum cadastro novo."
              highlightTone="secondary"
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
                    <Card corner featured={i === 2} className="flex h-full flex-col">
                      <div className="flex items-center justify-between">
                        <span
                          className={`stage-noise relative z-10 grid size-11 place-items-center rounded-tl-xl rounded-br-xl ${
                            i === 2 ? "bg-primary text-primary-content" : "bg-base-200"
                          }`}
                        >
                          <Icon size={20} strokeWidth={1.8} />
                        </span>
                        <span className="font-mono text-4xl font-bold text-base-content/15">{n}</span>
                      </div>
                      <h3 className="mt-6 text-xl font-black tracking-tight">{title}</h3>
                      <p className="mt-2 text-sm leading-6 text-base-content/65">{text}</p>
                    </Card>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Section>

        {/* TRÊS TELAS */}
        <Section className="relative">
          <Mascot size={92} motion="wiggle" rotate={-8} className="absolute right-[8%] top-10 hidden lg:block" />
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
                  <Card key={title} corner interactive className={`flex flex-col p-7 ${c.hover}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className={`flex size-14 items-center justify-center rounded-tl-xl rounded-br-xl transition-colors ${c.icon}`}>
                        <Icon size={24} strokeWidth={1.8} />
                      </div>
                      <span className={`stage-label text-right ${c.tag}`}>{who}</span>
                    </div>
                    <h3 className="stage-display mt-7 text-4xl">{title}</h3>
                    <p className="mt-2 text-base-content/60">{text}</p>
                    <ul className="mt-6 space-y-2.5 border-t border-dashed border-base-300 pt-5">
                      {bullets.map((b) => (
                        <li key={b} className="flex items-start gap-3 text-sm">
                          <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${c.dot}`} />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </Card>
                );
              })}
            </div>
          </div>
        </Section>

        {/* RECURSOS */}
        <Section id="recursos" tone="muted" edgeTop="torn">
          <div className="mx-auto max-w-6xl">
            <SectionTitle kicker="/ RECURSOS" title="Feito para o" highlight="dia do torneio." highlightTone="accent" />
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {features.map(({ icon: Icon, title, text, tone }) => {
                const c = toneClasses[tone];
                return (
                  <Card key={title} interactive className={`flex h-full flex-col ${c.hover}`}>
                    <div className={`flex size-12 items-center justify-center rounded-tl-xl rounded-br-xl transition-colors ${c.icon}`}>
                      <Icon size={22} strokeWidth={1.8} />
                    </div>
                    <h3 className="mt-6 text-lg font-black tracking-tight">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-base-content/60">{text}</p>
                  </Card>
                );
              })}
            </div>
          </div>
        </Section>

        {/* ANTES x AGORA */}
        <Section>
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_1.3fr] [&>*]:min-w-0">
            <SectionTitle
              kicker="/ VERSÃO ANTERIOR → NOVA"
              title="A mesma ideia,"
              highlight="reconstruída."
              highlightTone="secondary"
              description="Os códigos de acesso, a mesa do robô e o ranking ao vivo da primeira versão continuam. O que mudou foi a base."
            />
            <Card featured padded={false} className="overflow-hidden [--stage-shadow:var(--color-primary)]">
              {/* Colunas fixas e quebra de palavra: no celular nada fica cortado na borda do cartão. */}
              <table className="table table-sm w-full table-fixed text-[13px] hyphens-auto max-sm:[&_td]:px-2.5 max-sm:[&_th]:px-2.5 sm:table-md sm:text-sm">
                <thead>
                  <tr className="stage-label">
                    <th className="w-[35%]" />
                    <th className="w-[31%]">Antes</th>
                    <th className="w-[34%] text-primary">Agora</th>
                  </tr>
                </thead>
                <tbody>
                  {compare.map(({ item, before, now }) => (
                    <tr key={item}>
                      <td className="font-medium break-words">{item}</td>
                      <td className="text-base-content/55">
                        <Cell value={before} negative={item.startsWith("Nota duplicada")} />
                      </td>
                      <td className="font-semibold [overflow-wrap:anywhere]">
                        <Cell value={now} negative={item.startsWith("Nota duplicada")} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </Section>

        {/* CTA */}
        <Section tone="night" edgeTop="checker" className="overflow-hidden" innerClassName="relative overflow-hidden">
          <Starburst size={180} tone="primary" rotate={12} className="absolute -right-12 -top-12 opacity-90" />
          <Sparkle size={40} tone="accent" motion="spin" className="absolute bottom-12 right-[22%] hidden md:block" />
          <div className="relative mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <p className="stage-kicker text-white/50">/ PRONTO PARA O PRÓXIMO TORNEIO?</p>
              <h2 className="stage-display mt-3 text-4xl sm:text-6xl">
                Crie o evento agora e{" "}
                <Highlight variant="block" tone="accent">
                  teste com a equipe.
                </Highlight>
              </h2>
              <p className="mt-5 text-white/65">
                Comece em modo preparação, faça uma rodada de ensaio e zere as notas antes do evento. É grátis com a sua
                conta RoboStage.
              </p>
              <div className="mt-8 flex flex-wrap gap-3 [--stage-shadow:oklch(8%_0.008_70)]">
                <ButtonLink href="/hub" size="lg" iconRight={<ArrowRight size={20} />}>
                  Abrir o hub
                </ButtonLink>
                <ButtonLink href="/entrar" tone="ghost" size="lg" shape="rounded" iconLeft={<KeyRound size={18} />} className="text-white hover:bg-white/10">
                  Entrar com código
                </ButtonLink>
              </div>
            </div>
          </div>
        </Section>
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
