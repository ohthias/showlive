// Popula o PGlite local com um evento de demonstração.
// uso: npm run demo:seed   (com SHOWLIVE_DATABASE_URL=pglite://.pglite e o servidor PARADO)
import path from "node:path";
import { createRequire } from "node:module";
const root = path.resolve(process.argv[2] ?? ".");
const req = createRequire(path.join(root, "package.json"));
const { PGlite } = await import(req.resolve("@electric-sql/pglite"));
const { drizzle } = await import(req.resolve("drizzle-orm/pglite"));
const { migrate } = await import(req.resolve("drizzle-orm/pglite/migrator"));

const client = new PGlite(path.join(root, ".pglite"));
const db = drizzle(client);
await migrate(db, { migrationsFolder: path.join(root, "drizzle") });
const q = (s, p) => client.query(s, p);

await q("delete from events");
const theme = { preset: "robostage", colors: ["#1f1c18", "#e04444", "#f3ecdc"], background: null, blur: false };
const { rows: [ev] } = await q(
  "insert into events (code, name, owner_id, season, status, theme, timer_started_at, timer_remaining_ms) values ('DEMO26','Regional Nordeste FLL','user_demo','bioglow','live',$1, now() - interval '20 seconds', 150000) returning id",
  [JSON.stringify(theme)],
);
await q("insert into event_settings (event_id, show_timer) values ($1, true)", [ev.id]);
await q("insert into event_members (event_id, user_id, email, name, role) values ($1,'user_demo','demo@robostage.com.br','Demo','owner')", [ev.id]);
const { rows: [code] } = await q("insert into access_codes (event_id, code, label) values ($1,'MESA22','Mesa 1') returning id", [ev.id]);

const rounds = [];
for (let i = 1; i <= 3; i++) {
  const { rows: [r] } = await q("insert into rounds (event_id, name, position) values ($1,$2,$3) returning id", [ev.id, `Round ${i}`, i]);
  rounds.push(r.id);
}
const names = ["Robôs do Sertão","Mecatrônicos","LEGOlândia","Byte Bandeirante","Equipe Alfa","Cangaço Tech","Maré Alta","Jangada Bots","Mandacaru","Caatinga Code","Frevo Engenharia","Baobá Robotics"];
const teams = [];
for (const [i, n] of names.entries()) {
  const { rows: [t] } = await q("insert into teams (event_id, name, number, organization) values ($1,$2,$3,$4) returning id", [ev.id, n, String(10000 + i * 137), i % 3 === 0 ? "Escola Estadual" : null]);
  teams.push(t.id);
}
const pts = (i, r) => 120 + ((i * 53 + r * 37) % 23) * 10;
for (const [i, t] of teams.entries()) {
  for (const [r, rid] of rounds.entries()) {
    if (r === 2 && i > 4) continue; // Round 3 em andamento
    await q("insert into scores (event_id, team_id, round_id, points, submitted_by, submitted_by_label) values ($1,$2,$3,$4,'seed','Mesa 1 · Seed')", [ev.id, t, rid, pts(i, r)]);
  }
}
for (const [i, n] of names.slice(0, 5).entries())
  await q("insert into activity (event_id, kind, payload) values ($1,'score',$2)", [ev.id, JSON.stringify({ team: n, round: "Round 3", points: pts(i, 2), by: "Mesa 1 · Seed" })]);
await q("insert into activity (event_id, kind, payload) values ($1,'message',$2)", [ev.id, JSON.stringify({ message: "Intervalo para o almoço às 12h30" })]);

// --- desafio personalizado contra o tempo, ao vivo
const challenge = {
  version: 1, type: "time", name: "Seguidor de Linha",
  objective: "Percorrer a pista seguindo a linha preta no menor tempo possível.",
  rules: ["Até 3 tentativas por rodada; vale a melhor.", "Robô totalmente autônomo após a largada."],
  items: [
    { id: "tempo", label: "Tempo até a chegada", kind: "time", required: true },
    { id: "atalho", label: "Passou pelas interseções sem errar", kind: "check", points: 5 },
  ],
  penalties: [{ id: "saida", label: "Saída de pista", points: 5, max: 3 }],
  scoring: { direction: "lower", unit: "s", decimals: 2, timeLimitSec: 120, floorAtZero: true },
};
const t2 = { preset: "robostage-azul", colors: ["#13203f", "#fabd32", "#f3ecdc"], background: null, blur: false };
const { rows: [ev2] } = await q(
  "insert into events (code, name, owner_id, format, season, challenge, status, theme) values ('CORR26','Copa de Seguidores','user_demo','custom','custom',$1,'live',$2) returning id",
  [JSON.stringify(challenge), JSON.stringify(t2)],
);
await q("insert into event_settings (event_id) values ($1)", [ev2.id]);
await q("insert into event_members (event_id, user_id, email, name, role) values ($1,'user_demo','demo@robostage.com.br','Demo','owner')", [ev2.id]);
await q("insert into access_codes (event_id, code, label) values ($1,'TEMP22','Mesa 1')", [ev2.id]);
const r2 = [];
for (let i = 1; i <= 2; i++) r2.push((await q("insert into rounds (event_id, name, position) values ($1,$2,$3) returning id", [ev2.id, `Round ${i}`, i])).rows[0].id);
const names2 = ["Flecha Negra", "Trilho Veloz", "Linha Viva", "Curva Zero", "Sensor Ninja", "Pista Livre"];
for (const [i, n] of names2.entries()) {
  const { rows: [t] } = await q("insert into teams (event_id, name) values ($1,$2) returning id", [ev2.id, n]);
  await q("insert into scores (event_id, team_id, round_id, points, submitted_by, submitted_by_label) values ($1,$2,$3,$4,'seed','Mesa 1')", [ev2.id, t.id, r2[0], 30 + ((i * 7.31) % 25)]);
  if (i < 3) await q("insert into scores (event_id, team_id, round_id, points, submitted_by, submitted_by_label) values ($1,$2,$3,$4,'seed','Mesa 1')", [ev2.id, t.id, r2[1], 28 + ((i * 5.17) % 20)]);
}
// --- evento em preparação (sem códigos)
const { rows: [ev3] } = await q(
  "insert into events (code, name, owner_id, season, status, theme) values (NULL,'Treino de Sábado','user_demo','bioglow','draft',$1) returning id",
  [JSON.stringify(theme)],
);
await q("insert into event_settings (event_id) values ($1)", [ev3.id]);
await q("insert into event_members (event_id, user_id, email, name, role) values ($1,'user_demo','demo@robostage.com.br','Demo','owner')", [ev3.id]);
await q("insert into access_codes (event_id, code, label) values ($1,NULL,'Mesa 1')", [ev3.id]);
await q("insert into rounds (event_id, name, position) values ($1,'Round 1',1)", [ev3.id]);
await q("insert into teams (event_id, name) values ($1,'Equipe Teste')", [ev3.id]);

// --- OBR Resgate: 3 arenas + 1 desafio extra, ao vivo
const hz = (o) => ({ intersecoes: 0, gangorras: 0, obstaculos: 0, gaps: 0, rampas: 0, lombadas: 0, passagens: 0, ...o });
const league = {
  version: 1,
  arenas: [
    { id: "arena1", name: "Arena A", hazards: hz({ intersecoes: 4, gangorras: 1, obstaculos: 1, gaps: 2, rampas: 2, lombadas: 1 }), sections: [6, 6, 5], startTile: true, surpriseEnabled: false },
    { id: "arena2", name: "Arena B", hazards: hz({ intersecoes: 5, gangorras: 1, obstaculos: 2, gaps: 3, rampas: 2, lombadas: 2 }), sections: [7, 6, 6], startTile: true, surpriseEnabled: true, surpriseText: "Piscar o LED 3 vezes ao entrar na sala de resgate." },
    { id: "arena3", name: "Arena C", hazards: hz({ intersecoes: 6, gangorras: 2, obstaculos: 2, gaps: 3, rampas: 3, lombadas: 2, passagens: 1 }), sections: [7, 7, 6], startTile: true, surpriseEnabled: true },
  ],
  extras: [
    {
      id: "xvel", version: 1, type: "time", name: "Corrida de Velocidade",
      objective: "Percorrer a reta de 3 m no menor tempo, sem sair da faixa.",
      rules: ["Duas tentativas; vale a melhor."],
      items: [{ id: "tempo", label: "Tempo", kind: "time", required: true }],
      penalties: [{ id: "faixa", label: "Saiu da faixa", points: 2, max: 3 }],
      scoring: { direction: "lower", unit: "s", decimals: 2, timeLimitSec: 30, floorAtZero: true },
    },
  ],
};
const t4 = { preset: "obr", colors: ["#0b1d33", "#ffcc00", "#ffffff"], background: null, blur: false };
const { rows: [ev4] } = await q(
  "insert into events (code, name, owner_id, format, season, league, status, theme, timer_duration_sec) values ('RESG26','Regional OBR Resgate','user_demo','obr','obr-resgate',$1,'live',$2,300) returning id",
  [JSON.stringify(league), JSON.stringify(t4)],
);
await q("insert into event_settings (event_id, ranking_mode) values ($1,'best2')", [ev4.id]);
await q("insert into event_members (event_id, user_id, email, name, role) values ($1,'user_demo','demo@robostage.com.br','Demo','owner')", [ev4.id]);
await q("insert into access_codes (event_id, code, label) values ($1,'ARENA2','Mesa 1')", [ev4.id]);
const r4 = [];
for (let i = 0; i < 3; i++)
  r4.push((await q("insert into rounds (event_id, name, position, meta) values ($1,$2,$3,$4) returning id", [ev4.id, `Rodada ${i + 1}`, i + 1, JSON.stringify({ arenaId: `arena${i + 1}` })])).rows[0].id);
const rx = (await q("insert into rounds (event_id, name, position, kind, meta) values ($1,'Extra · Corrida de Velocidade',2000,'extra',$2) returning id", [ev4.id, JSON.stringify({ extraId: "xvel" })])).rows[0].id;
const names4 = ["Resgatadores", "Bit Salva-Vidas", "Socorro Bot", "Caatinga Rescue", "Farol Robótico"];
for (const [i, n] of names4.entries()) {
  const { rows: [t] } = await q("insert into teams (event_id, name) values ($1,$2) returning id", [ev4.id, n]);
  const rounds4 = i < 2 ? 3 : 2;
  for (let k = 0; k < rounds4; k++) {
    const pts = 120 + ((i * 61 + k * 47) % 180);
    const tempo = 150 + ((i * 37 + k * 29) % 150);
    await q("insert into scores (event_id, team_id, round_id, points, tiebreak, submitted_by, submitted_by_label) values ($1,$2,$3,$4,$5,'seed','Mesa 1')", [ev4.id, t.id, r4[k], pts, tempo]);
  }
  if (i < 3) await q("insert into scores (event_id, team_id, round_id, points, submitted_by, submitted_by_label) values ($1,$2,$3,$4,'seed','Mesa 1')", [ev4.id, t.id, rx, 8 + i * 1.37]);
}

// Avaliação por rubricas no DEMO26: 2 rubricas, 2 salas (códigos SALA22 e SALA33) e o cronograma.
const levels = [
  { value: 1, label: "Iniciante" },
  { value: 2, label: "Em desenvolvimento" },
  { value: 3, label: "Realizado" },
  { value: 4, label: "Excepcional" },
];
const crit = (id, label, description) => ({ id, label, description });
const rubricDefs = [
  {
    name: "Projeto de Inovação",
    description: "Como a equipe pesquisou um problema real, criou uma solução e a compartilhou.",
    sections: [
      { id: "identify", title: "Identificar", criteria: [crit("ip_problem", "Problema definido com clareza", "Explica o problema e por que importa."), crit("ip_research", "Pesquisa", "Fontes variadas e especialistas.")] },
      { id: "create", title: "Criar", criteria: [crit("ip_solution", "Solução e protótipo", "Solução original e bem representada.")] },
      { id: "communicate", title: "Comunicar", criteria: [crit("ip_presentation", "Apresentação", "Clara, criativa e com impacto.")] },
    ],
  },
  {
    name: "Design do Robô",
    description: "Estratégia, construção e programação do robô.",
    sections: [
      { id: "design", title: "Projetar", criteria: [crit("rd_strategy", "Estratégia de missões", "Objetivos claros e justificados."), crit("rd_build", "Construção", "Robusto e funcional.")] },
      { id: "create", title: "Criar", criteria: [crit("rd_code", "Programação", "Código organizado, com sensores.")] },
    ],
  },
];
const rubricIds = [];
for (const [i, r] of rubricDefs.entries()) {
  const definition = { levels, sections: r.sections, commentFromLevel: 4, requireFeedback: true };
  const { rows: [row] } = await q("insert into rubrics (event_id, name, description, definition, position) values ($1,$2,$3,$4,$5) returning id", [ev.id, r.name, r.description, JSON.stringify(definition), i + 1]);
  rubricIds.push(row.id);
}
const roomIds = [];
for (const [i, c] of ["SALA22", "SALA33"].entries()) {
  const { rows: [row] } = await q("insert into judging_rooms (event_id, name, code) values ($1,$2,$3) returning id", [ev.id, `Sala ${i + 1}`, c]);
  roomIds.push(row.id);
}
const day = new Date();
day.setHours(9, 0, 0, 0);
for (const [i, t] of teams.entries()) {
  const startsAt = new Date(day.getTime() + Math.floor(i / 2) * 40 * 60000);
  const { rows: [s] } = await q("insert into judging_sessions (event_id, team_id, room_id, starts_at, duration_min, status) values ($1,$2,$3,$4,30,$5) returning id", [ev.id, t, roomIds[i % 2], startsAt, i < 4 ? "done" : "scheduled"]);
  if (i >= 4) continue;
  // As 4 primeiras equipes já foram avaliadas.
  for (const [k, rid] of rubricIds.entries()) {
    const ids = rubricDefs[k].sections.flatMap((x) => x.criteria.map((c) => c.id));
    const scores = Object.fromEntries(ids.map((id, j) => [id, 1 + ((i + j + k) % 3)]));
    const total = Object.values(scores).reduce((a, b) => a + b, 0);
    await q(
      "insert into rubric_evaluations (event_id, session_id, team_id, rubric_id, scores, feedback, total, max_total, status, submitted_by, submitted_by_label) values ($1,$2,$3,$4,$5,$6,$7,$8,'submitted','seed','Sala · Demo')",
      [ev.id, s.id, t, rid, JSON.stringify(scores), JSON.stringify({ strengths: "Equipe muito engajada.", improvements: "Documentar melhor os testes." }), total, ids.length * 4],
    );
  }
}

// Alianças (estilo FTC): FTC26, mesa FTCM22. Usa o modelo pronto (o Node remove os tipos do .ts).
const { ALLIANCE_PRESETS } = await import(path.join(root, "lib/alliance-presets.ts"));
const ftcPreset = ALLIANCE_PRESETS.find((p) => p.id === "ftc");
const t5 = { preset: "ftc", colors: ["#111827", "#f97316", "#f9fafb"], background: null, blur: false };
const { rows: [ev5] } = await q(
  "insert into events (code, name, owner_id, format, season, challenge, status, theme, timer_duration_sec) values ('FTC226','Qualificatória FTC Nordeste','user_demo','alliance','alliance',$1,'live',$2,$3) returning id",
  [JSON.stringify(ftcPreset.challenge), JSON.stringify(t5), ftcPreset.timerSec],
);
await q("insert into event_settings (event_id, show_timer) values ($1, true)", [ev5.id]);
await q("insert into event_members (event_id, user_id, email, name, role) values ($1,'user_demo','demo@robostage.com.br','Demo','owner')", [ev5.id]);
await q("insert into access_codes (event_id, code, label) values ($1,'FTCM22','Mesa 1')", [ev5.id]);
const ftcNames = ["Engrenagem Azul", "Byte Force", "Titanium", "RoboJangada", "Mandacaru Mecha", "Circuito Norte", "Atlântica", "Farol Tech"];
const ftcTeams = [];
for (const [i, n] of ftcNames.entries()) {
  const { rows: [t] } = await q("insert into teams (event_id, name, number) values ($1,$2,$3) returning id", [ev5.id, n, String(20000 + i * 311)]);
  ftcTeams.push(t.id);
}
// 8 equipes, 4 partidas cada (8 partidas): pares que giram.
const pairs = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 2, 4, 6], [1, 3, 5, 7], [0, 5, 3, 6], [1, 4, 2, 7], [0, 7, 1, 6], [2, 5, 3, 4]];
const ftcPts = { a_leave: 3, a_high: 7, a_low: 3, t_high: 5, t_low: 2, e_park: 5, e_lift: 20 };
const groupOf = { a_leave: "Autônomo", a_high: "Autônomo", a_low: "Autônomo", t_high: "Teleoperado", t_low: "Teleoperado", e_park: "Fim de jogo", e_lift: "Fim de jogo" };
const sideResult = (resp, oppResp) => {
  const byGroup = { Autônomo: 0, Teleoperado: 0, "Fim de jogo": 0 };
  let base = 0;
  for (const [k, v] of Object.entries(resp)) {
    if (!(k in ftcPts)) continue;
    base += v * ftcPts[k];
    byGroup[groupOf[k]] += v * ftcPts[k];
  }
  const pen = (r) => (r["pen:minor"] ?? 0) * 5 + (r["pen:major"] ?? 0) * 15;
  const bonus = [];
  if (byGroup["Autônomo"] >= 30) bonus.push("RP de autônomo");
  if (byGroup["Fim de jogo"] >= 30) bonus.push("RP de fim de jogo");
  return { responses: resp, base, penalty: pen(resp), byGroup, bonus, bonusRp: bonus.length, score: base + pen(oppResp) };
};
for (const [i, p] of pairs.entries()) {
  const red = [{ teamId: ftcTeams[p[0]] }, { teamId: ftcTeams[p[1]] }];
  const blue = [{ teamId: ftcTeams[p[2]] }, { teamId: ftcTeams[p[3]] }];
  const at = new Date(Date.now() + (i - 5) * 7 * 60000);
  if (i < 5) {
    const r = { a_leave: 2, a_high: (i * 3) % 5, t_high: 6 + ((i * 7) % 9), t_low: (i * 5) % 7, e_park: 1, e_lift: i % 2, "pen:minor": i % 2 };
    const b = { a_leave: 1 + (i % 2), a_high: (i * 2) % 4, t_high: 5 + ((i * 5) % 11), t_low: (i * 3) % 6, e_park: 2, e_lift: (i + 1) % 2 };
    const result = { red: sideResult(r, b), blue: sideResult(b, r), flags: {} };
    await q(
      "insert into matches (event_id, number, scheduled_at, red, blue, status, red_score, blue_score, result, submitted_by, submitted_by_label) values ($1,$2,$3,$4,$5,'final',$6,$7,$8,'seed','Mesa 1')",
      [ev5.id, i + 1, at, JSON.stringify(red), JSON.stringify(blue), result.red.score, result.blue.score, JSON.stringify(result)],
    );
  } else {
    await q("insert into matches (event_id, number, scheduled_at, red, blue) values ($1,$2,$3,$4,$5)", [ev5.id, i + 1, at, JSON.stringify(red), JSON.stringify(blue)]);
  }
}

console.log(JSON.stringify({ eventId: ev.id, codeId: code.id, customId: ev2.id, draftId: ev3.id, obrId: ev4.id, ftcId: ev5.id }));
await client.close();
