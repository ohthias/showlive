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

console.log(JSON.stringify({ eventId: ev.id, codeId: code.id, customId: ev2.id, draftId: ev3.id, obrId: ev4.id }));
await client.close();
