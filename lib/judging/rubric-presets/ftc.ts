import { c, def, SCALE_4, section, type RubricPreset, type RubricPresetGroup } from "./helpers";

/** FTC: portfólio de engenharia + entrevista por áreas de prêmio (adaptação). */

const FTC = (sections: Parameters<typeof def>[1]) => def(SCALE_4, sections, { commentFromLevel: 4, requireFeedback: true });

const portfolio: RubricPreset = {
  id: "ftc-portfolio",
  name: "Portfólio de Engenharia",
  description: "Leitura do portfólio antes da entrevista.",
  definition: FTC([
    section("portfolio", "Portfólio", [
      c("pf_process", "Processo de engenharia", "Mostra o ciclo de projeto: problema, alternativas, testes e decisões.", [
        "Processo ausente.",
        "Processo citado, sem evidências.",
        "Processo com exemplos e decisões explicadas.",
        "Processo completo, com dados e iterações claras.",
      ]),
      c("pf_team", "Equipe e plano", "Organização da equipe, metas, cronograma e sustentabilidade.", [
        "Sem plano.",
        "Plano superficial.",
        "Plano claro com metas.",
        "Plano detalhado, com metas medidas e sustentabilidade.",
      ]),
      c("pf_outreach", "Divulgação e comunidade", "Ações com a comunidade e o impacto delas.", [
        "Sem ações.",
        "Ações pontuais.",
        "Ações regulares com impacto descrito.",
        "Ações amplas, com impacto medido.",
      ]),
      c("pf_clarity", "Clareza", "Fácil de ler, objetivo e dentro do limite de páginas.", [
        "Difícil de ler.",
        "Legível, pouco organizado.",
        "Organizado e objetivo.",
        "Exemplar: visual, conciso e completo.",
      ]),
    ]),
  ]),
};

const interview: RubricPreset = {
  id: "ftc-interview",
  name: "Entrevista",
  description: "Conversa da banca com a equipe, por área de prêmio.",
  definition: FTC([
    section("think-design", "Engenharia", [
      c("iv_think", "Think — processo de engenharia", "Explicam como chegaram às soluções, com dados e iterações."),
      c("iv_design", "Design — projeto do robô", "Projeto funcional e estético, com decisões justificadas."),
      c("iv_innovate", "Innovate — inovação", "Soluções criativas e confiáveis para problemas do jogo."),
      c("iv_control", "Control — controle e software", "Sensores, algoritmos e controle no autônomo e no teleoperado."),
    ]),
    section("connect-motivate", "Equipe e comunidade", [
      c("iv_connect", "Connect — conexões", "Relação com mentores, empresas e a comunidade de engenharia."),
      c("iv_motivate", "Motivate — inspiração", "Espalham o programa e incentivam outras pessoas."),
      c("iv_gp", "Gracious Professionalism", "Respeito, colaboração e espírito esportivo."),
      c("iv_communication", "Comunicação", "Todos participam e respondem com clareza."),
    ]),
  ]),
};

const pitScout: RubricPreset = {
  id: "ftc-pit",
  name: "Visita ao box",
  description: "Conversa curta no box, sem hora marcada, para complementar a entrevista.",
  weight: 0.5,
  definition: FTC([
    section("pit", "No box", [
      c("pit_robot", "Conhecem o robô", "Qualquer integrante explica partes do robô."),
      c("pit_org", "Organização do box", "Ferramentas, peças e segurança em ordem."),
      c("pit_attitude", "Atitude", "Receptivos, ajudam outras equipes."),
    ]),
  ]),
};

export const FTC_GROUP: RubricPresetGroup = {
  id: "ftc",
  label: "FTC",
  description: "Portfólio de Engenharia, Entrevista por áreas de prêmio e uma ficha de visita ao box (adaptação).",
  origin: "adapted",
  sessionMinutes: 15,
  presets: [portfolio, interview, pitScout],
};
