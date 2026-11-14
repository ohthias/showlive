# ShowLive · RoboStage

Ranking ao vivo, mesa de arbitragem e telão para torneios FLL — agora como
aplicação **separada** em `showlive.robostage.com.br`, com banco próprio e a
mesma conta do RoboStage.

```
                  ┌──────────── Clerk (MESMA instância do RoboStage) ────────────┐
                  │                                                               │
 robostage.com.br │  conta / login                    showlive.robostage.com.br   │
 (app principal)  └──────────────► /hub  (organização: owner · admin · apurador) ─┘
                                    │
                                    ▼  Server Actions (Drizzle)
                           ┌──────────────────────┐
                           │  Neon · banco ShowLive│  ← separado do banco do RoboStage
                           │  events.revision ++   │  ← gatilhos em toda escrita ao vivo
                           └──────────┬───────────┘
                                      │ 1 SELECT revision/s por evento e por instância
                           ┌──────────▼───────────┐
                           │ live-hub (memória)    │  snapshot memoizado por revisão
                           └──────────┬───────────┘
                                      │ SSE  /api/live/:code/stream
              ┌───────────────────────┼────────────────────────┐
              ▼                       ▼                        ▼
        /e/CODIGO (telão)      /mesa/CODIGO (juízes)     /hub/:id (organização)
        código do evento       código da mesa (cookie)   conta RoboStage
```

## Ligas

| Liga | Como funciona |
|---|---|
| **FLL Challenge** | Missões oficiais da temporada (`data/missions.json`), maior nota com desempate pela 2ª e 3ª. |
| **Imagem da missão (FLL)** | Em Configurações → "Mesa: árbitro vê a imagem da missão" (FLL Challenge e Future Edition, ligada por padrão). Vale na hora para as mesas abertas. As imagens ficam em `public/images/missions/` (WebP, ~1,2 MB no total). |
| **FLL Future Edition** | Missões da BioGlow Future Edition (`data/future-edition.json`), penalidade por cartões (1: −10, 2: −30, 3: zera). Partida de 2:30. |
| **OBR Resgate** | O admin monta as **3 arenas** (`/hub/:id/arenas`): perigos que existem no trajeto, ladrilhos de cada seção entre checkpoints, ladrilho de saída e Desafio Surpresa (×1,5). Rodada 1 → 1ª arena, e assim por diante. Pontuação igual ao Pontuador OBR do RoboStage (`lib/obr.ts`); a mesa só marca o que existe na arena. Classificação pela **soma das 2 maiores notas**, desempate pela **menor soma dos tempos** (manual oficial 2025). Rodada de 5 min. |
| **Desafios extras (OBR)** | Opcionais. Criados no construtor de desafios; cada um vira uma rodada "extra" com **ranking próprio** no telão, fora da classificação geral. |
| **Personalizado** | Construtor de desafios (abaixo). |

## Desafios personalizados

Além das regras oficiais da FLL, o organizador pode criar o próprio desafio
(`/hub/:id/desafio`) ou um template reutilizável (`/hub/templates`):

1. **Tipo** — Missões (pontos por tarefas), Contra o tempo (menor tempo
   vence), Avaliação por juízes (rubrica com pesos) ou Medição (cm, kg…).
2. **Nome e objetivo.**
3. **Funcionamento** — maior/menor vence, unidade, casas decimais, tempo por
   tentativa, nunca negativo.
4. **Regras de funcionamento** — texto livre, vira o regulamento.
5. **Itens da súmula** — Sim/Não, Quantidade, Opções, Nota (rubrica), Medida,
   Tempo (digitado ou cronometrado na mesa), com itens obrigatórios.
6. **Penalidades** — por ocorrência, com máximo.

O construtor gera o **regulamento** (aba para imprimir ou mandar às equipes) e
tem uma aba **Testar súmula**, que mostra exatamente o que a mesa verá. Há 4
modelos prontos (Seguidor de Linha, Resgate na Arena, Apresentação do
Projeto, Lançamento de Precisão). O cálculo fica em `lib/challenge.ts` e é
refeito no servidor; o ranking entende "menor vence" (tempo), inclusive no
desempate e nos playoffs.

## Códigos de acesso

- Evento criado em **Preparação** não tem código nenhum.
- Ao ficar **Ao vivo**, o código do telão e um código por mesa são gerados na hora.
- Ao voltar para Preparação ou Encerrar, todos deixam de funcionar: `/e/CODIGO`
  dá 404, a entrada recusa o código, a mesa não envia notas e o telão aberto
  recebe o estado final e desconecta.
- Ao reativar, todos os códigos são **novos** (o cookie da mesa guarda o
  código, então sessões antigas também caem).
- Fora do ar, a organização acompanha pelo hub e vê o telão em
  `/hub/:id/previa`.

## Preferências do usuário

`/hub/preferencias`: formato, temporada, tema, rodadas, cronômetro, critério
do ranking, nº de mesas, exibição do telão (padrões de evento novo), além de
"confirmar antes de enviar" e "manter tela ligada" para quando a própria pessoa
arbitra.

## Configurações do evento

Em **Configurações → Voluntários e administração** (e **Telão** para exibição):

**Administradores**
- **Aprovar notas antes do telão** — notas das mesas entram como pendentes, vão
  para a fila em Visão geral (aprovar uma/todas, recusar). O público não vê
  pendentes; o telão comemora só quando aprova. Desligar aprova as pendentes.
- **Pausar envios** — mesas por código ficam bloqueadas (aviso no letreiro e na mesa).
- **Aviso para as mesas** — faixa fixa no topo da mesa (até 200 caracteres, nunca vai ao telão).
- **Apuradores podem corrigir e aprovar** — libera Pontuações para o papel Apurador.
- Telão: **mostrar número/organização da equipe** e **QR code de acesso**.

**Voluntários (regras definidas pelo admin)**
- **Janela de correção** (0–60 min) — a mesa corrige ou apaga a própria nota;
  trava quando o prazo acaba ou a nota é aprovada.
- **Equipe confirma a súmula** — o envio exige marcar "a equipe conferiu".
- **Voluntários controlam o cronômetro** — se desligado, a mesa só vê o tempo.
- **Mesa vê a classificação**.
- **Rodadas por mesa** (em Acessos) — cada código avalia só as rodadas marcadas.

**Ajustes do aparelho** (ícone na mesa, salvos no próprio celular): tema escuro,
botões grandes, vibrar ao enviar, manter tela ligada.

## Estilo do telão

Em **Telão → Estilo do telão**, com prévia ao vivo do rascunho (a prévia muda
a cada clique; o telão só muda em **Aplicar**). Tudo fica em `events.theme`
(jsonb), então não há migração: temas antigos recebem os padrões de
`resolveTvStyle` (`lib/themes.ts`).

- **Temas prontos:** RoboStage, RoboStage Azul, Arena Neon, Placar Esportivo,
  Claro, Unearthed, Submerged, Masterpiece, OBR Resgate, Cidade (vídeo).
- **Cores:** fundo, destaque, texto e secundária, com aviso de contraste.
- **Fundo:** liso, degradê, holofote, aurora (animada) ou malha, ou então
  imagem/vídeo próprios.
- **Padrão:** pontos, grade, diagonais, colmeia, circuito ou relevo, com
  ajuste de intensidade.
- **Tabela:**
  - tabela clássica;
  - cartões;
  - compacta (1,5× equipes por página);
  - duas colunas (2× equipes por página).
  - As páginas são distribuídas por igual.
- **Painéis:** vidro, sólido ou contorno.
- **Cantos:** RoboStage (chanfrado), arredondado ou reto.
- **Fontes** (servidas pelo próprio app via `@fontsource`):
  - títulos: Roboto, Space Grotesk, Sora, Oswald, Bebas Neue, Orbitron e Chakra Petch;
  - números: Roboto Mono, JetBrains Mono, Orbitron ou a mesma dos títulos.
- **Animações:** desligadas, suaves ou completas. As completas incluem:
  - fundo e padrão em movimento;
  - reordenação deslizante (FLIP);
  - contagem do placar;
  - brilho na líder;
  - raios e confete na comemoração;
  - barra de tempo do slide.
- **Medalhas** de ouro, prata e bronze no top 3, e **setas** ▲/▼ para quem
  mudou de posição (ficam 25 s na tela).
- `prefers-reduced-motion` é respeitado.

## Quem entra onde

| Tela | Rota | Acesso | O que faz |
|---|---|---|---|
| Landing | `/` | público | apresentação + campo de código |
| Entrada | `/entrar` | público | um campo para os dois tipos de código |
| **Hub** | `/hub`, `/hub/:id/*` | conta RoboStage + vínculo no evento | criar/configurar eventos, equipes, notas, telão, acessos |
| **Mesa** | `/mesa/:codigoEvento` | código da mesa (cookie assinado) **ou** membro do evento | súmula com as missões oficiais, cronômetro |
| **Telão** | `/e/:codigoEvento` | código do evento | ranking, comemoração, letreiro, playoffs, cronômetro |

Papéis no hub: **Dono** (tudo, inclusive apagar), **Admin** (configura tudo e
convida pessoas), **Apurador** (abre a mesa e acompanha). Convites são feitos
pelo e-mail da conta RoboStage; se a pessoa ainda não tem conta, o convite fica
pendente e vira acesso no primeiro login dela no ShowLive.

## O que veio da versão antiga e o que mudou

| | Antes (dentro do RoboStage) | Agora |
|---|---|---|
| Papéis | public / visitor / volunteer | telão (código do evento) / mesa (código da mesa) / hub com 3 papéis |
| Dados | `team.points` em JSON, `-1` = não avaliado | tabelas `teams`, `rounds`, `scores` com `unique(team, round)` |
| Atualização | polling a cada 10 s | SSE (~1 s), fallback para polling se a rede bloquear streaming |
| Nota | calculada no navegador | recalculada no servidor com o motor de `utils/scores.ts` do RoboStage (inclui `requires` e portões da BioGlow) |
| Duas mesas na mesma equipe | gravavam as duas | o banco recusa a segunda |
| `event_active` | liga/desliga | status `Preparação → Ao vivo → Encerrado` |
| Ocultar notas até o fim da rodada | no cliente | **no servidor** (a nota nem chega ao telão) |
| Novos | — | vários admins, códigos de mesa revogáveis, correção de nota com histórico, cronômetro compartilhado, avisos no letreiro, pódio final, CSV |

Regras mantidas: maior nota com desempate pela 2ª e 3ª (modo "soma" opcional);
playoffs semifinal (top 4 → top 2) ou final direta (top 2); "só rodada atual"
na mesa; GP fora do total e PT dentro.

## Rodando localmente (sem Neon)

```bash
npm install --legacy-peer-deps
cp .env.example .env.local
# Para testar sem Neon, use o Postgres embutido:
#   SHOWLIVE_DATABASE_URL=pglite://.pglite
npm run demo:seed     # DEMO26 (FLL, mesa MESA22), CORR26 (contra o tempo, mesa TEMP22), RESG26 (OBR, mesa ARENA2) e um evento em preparação
npm run dev           # http://localhost:3001
```

- Telão: <http://localhost:3001/e/DEMO26>
- Mesa: <http://localhost:3001/entrar> → `MESA22`
- Hub: precisa das chaves do Clerk (use as de desenvolvimento do RoboStage) e
  `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` para logar localmente.

Testes: `npm test` (ranking/desempate/playoffs, motor de pontuação e as
migrações + gatilhos de revisão num Postgres embutido).

## Deploy (Vercel + Neon)

1. **Neon** — crie um projeto novo (ex.: `showlive`, região `sa-east-1`).
   Copie a connection string **pooled** (`-pooler`) para `SHOWLIVE_DATABASE_URL`
   e rode as migrações:
   ```bash
   SHOWLIVE_DATABASE_URL=... npx drizzle-kit migrate
   ```
   A `0001_realtime_triggers.sql` cria os gatilhos que incrementam
   `events.revision` (sem ela o telão não atualiza). A `0002` adiciona
   desafios, templates e preferências, e apaga os códigos de eventos fora do ar.
   A `0003` adiciona as ligas Future Edition e OBR (arenas, extras, desempate por tempo).
   A `0004` adiciona a opção de mostrar a imagem da missão ao árbitro.
   A `0005` adiciona as configurações de voluntários/administradores
   (aprovação de notas, pausa, janela de correção, rodadas por mesa, QR no telão).

2. **Vercel** — projeto novo apontando para este diretório, domínio
   `showlive.robostage.com.br`, região de função `gru1`. Fluid Compute ligado
   (padrão), porque o stream SSE fica aberto até 50 s por conexão
   (`maxDuration = 60`). Variáveis: todas do `.env.example`.
   `SHOWLIVE_SECRET`: `openssl rand -base64 32`.

3. **Clerk** — use as **mesmas** chaves de produção do RoboStage. Em
   produção o Clerk compartilha a sessão entre subdomínios do mesmo domínio,
   então quem já está logado no RoboStage entra direto no hub. O login
   acontece em `robostage.com.br/sign-in` e volta para cá.

## Ajustes no RoboStage principal (não incluídos aqui)

- `app/layout.tsx`: no `<ClerkProvider>`, adicionar
  `allowedRedirectOrigins={["https://showlive.robostage.com.br"]}` para o
  login poder voltar ao ShowLive.
- `app/(public)/showlive/page.tsx`: trocar o aviso de "fora do ar" pelos
  links `https://showlive.robostage.com.br` (hub) e `/entrar` (código).
- `next.config.ts`: redirecionar `/universe` → `https://showlive.robostage.com.br/entrar`
  e `/universe/:a/:b` → `https://showlive.robostage.com.br/e/:a`.
- `proxy.ts`: as rotas `/showlive(.*)` e `/universe(.*)` podem sair da lista
  pública quando os redirecionamentos estiverem ativos.
- Os dados antigos (Supabase) não são migrados automaticamente: os eventos
  antigos eram de temporadas passadas e o formato mudou.

## Estrutura

```
app/
  page.tsx, entrar/            landing e entrada por código
  e/[code]/                    telão
  mesa/[code]/                 mesa de arbitragem
  hub/                         hub de administração (layout + 6 seções)
  api/live/[code]/stream       SSE
  api/live/[code]/snapshot     JSON (fallback, OBS/overlays)
  actions/                     Server Actions (eventos, equipes, notas, acessos, telão)
db/schema.ts                   schema Drizzle (banco do ShowLive)
drizzle/                       migrações (+ gatilhos de realtime)
lib/
  scoring.ts                   motor de pontuação (portado do RoboStage)
  ranking.ts                   classificação, rodada atual, playoffs (puro)
  snapshot.ts                  estado do evento por público (public/staff)
  live-hub.ts                  poller coalescido + cache de snapshot
  access.ts, referee.ts        papéis, convites, cookie assinado da mesa
data/missions.json             cópia de public/data/missions.json do RoboStage
```

Ao atualizar as missões no RoboStage, copie `public/data/missions.json` (e
`public/data/fll/future-edition.json`) para `data/` aqui, e as imagens de
`public/images/missions/` para `public/images/missions/` — os JSON daqui
apontam para as versões `.webp`.
