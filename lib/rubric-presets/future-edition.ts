import { c, def, SCALE_FLL, SCALE_KIDS, section, type RubricPreset, type RubricPresetGroup } from "./helpers";

/**
 * FLL Future Edition (BIOGLOW, kits LEGO Education Computer Science & AI).
 *
 * Na divisão de 3º a 9º ano, a sessão é uma só: apresentação do projeto,
 * perguntas, apresentação do design de engenharia e da estratégia de jogo,
 * perguntas, retorno dos juízes e perguntas de Valores Fundamentais; os
 * juízes preenchem UMA rubrica ao final. Daí os dois formatos abaixo:
 * a rubrica integrada (fiel ao fluxo da sessão) ou três rubricas separadas
 * (para quem quer classificações por área). Textos escritos para o
 * ShowLive — confira a rubrica oficial da temporada.
 */

const FE = (sections: Parameters<typeof def>[1]) => def(SCALE_FLL, sections, { commentFromLevel: 4, requireFeedback: true });

const projectCriteria = [
  c("fe_p_question", "Pergunta e pesquisa", "A equipe escolheu uma questão ligada ao tema (biodiversidade) e pesquisou para entendê-la.", [
    "Questão vaga; quase sem pesquisa.",
    "Questão definida; pesquisa em poucas fontes.",
    "Questão clara; pesquisa variada.",
    "Questão clara e relevante; pesquisa com especialistas ou dados próprios.",
  ]),
  c("fe_p_solution", "Ideia e solução", "A equipe propôs uma solução e explicou como ela funciona.", [
    "Ideia pouco desenvolvida.",
    "Ideia descrita, sem detalhes.",
    "Solução clara e possível.",
    "Solução criativa, detalhada e com protótipo ou demonstração.",
  ]),
  c("fe_p_ai", "Computação e IA na solução", "Uso consciente de computação, dados ou IA quando faz sentido para o problema.", [
    "Não relaciona a solução à computação.",
    "Cita tecnologia sem explicar o papel dela.",
    "Explica como computação ou IA ajuda na solução.",
    "Explica o papel da tecnologia, seus limites e cuidados (dados, ética).",
  ]),
  c("fe_p_share", "Compartilhar e melhorar", "A equipe mostrou o projeto a outras pessoas e usou o retorno.", [
    "Não compartilhou.",
    "Compartilhou, sem mudanças.",
    "Compartilhou e melhorou.",
    "Compartilhou com vários públicos e melhorou várias vezes.",
  ]),
  c("fe_p_present", "Apresentação do projeto", "Apresentação clara dentro do tempo (cerca de 5 minutos).", [
    "Confusa ou muito fora do tempo.",
    "Clara em partes.",
    "Clara e organizada.",
    "Envolvente, criativa e com todos participando.",
  ]),
];

const engineeringCriteria = [
  c("fe_e_strategy", "Estratégia de jogo", "Como a equipe escolheu as missões e planejou as partidas.", [
    "Sem estratégia.",
    "Estratégia parcial.",
    "Estratégia clara e justificada.",
    "Estratégia revisada com dados das partidas.",
  ]),
  c("fe_e_build", "Construção", "Robô e acessórios montados com o kit: funcionais e confiáveis.", [
    "Construção frágil.",
    "Funciona com limitações.",
    "Funcional e confiável.",
    "Soluções mecânicas criativas e robustas.",
  ]),
  c("fe_e_code", "Programação", "Organização do código, uso de sensores e de recursos de computação.", [
    "Código confuso.",
    "Funciona, pouco organizado.",
    "Organizado e explicado.",
    "Modular, eficiente e bem explicado, com sensores bem usados.",
  ]),
  c("fe_e_iterate", "Testes e melhorias", "Testes repetidos e mudanças a partir dos resultados.", [
    "Sem testes.",
    "Testes ocasionais.",
    "Testes sistemáticos com melhorias.",
    "Testes com registros e melhorias contínuas.",
  ]),
  c("fe_e_present", "Apresentação do design", "Explicação do design e da estratégia (cerca de 5 minutos).", [
    "Explicação confusa.",
    "Explica em partes.",
    "Explicação clara.",
    "Explicação clara, segura e com todos falando.",
  ]),
];

const valuesCriteria = [
  c("fe_v_discovery", "Descoberta", "Curiosidade e vontade de aprender coisas novas.", ["Pouca curiosidade.", "Alguma exploração.", "Exploram com entusiasmo.", "Inspiram outros a explorar."]),
  c("fe_v_innovation", "Inovação", "Criatividade e persistência diante dos problemas.", ["Desistem fácil.", "Persistência pontual.", "Criativos e persistentes.", "Persistência e criatividade marcantes."]),
  c("fe_v_impact", "Impacto", "O que aprenderam muda algo na equipe ou na comunidade.", ["Impacto não percebido.", "Impacto em parte da equipe.", "Impacto em toda a equipe.", "Impacto que alcança a comunidade."]),
  c("fe_v_inclusion", "Inclusão", "Todos são ouvidos; as diferenças são valorizadas.", ["Poucos participam.", "Participação desigual.", "Todos participam.", "Inclusão exemplar."]),
  c("fe_v_teamwork", "Trabalho em equipe", "Divisão de tarefas e apoio mútuo.", ["Trabalho individual.", "Colaboração ocasional.", "Colaboração constante.", "Colaboração exemplar."]),
  c("fe_v_fun", "Diversão", "Alegria e orgulho no que fizeram.", ["Pouco envolvimento.", "Algum entusiasmo.", "Entusiasmo evidente.", "Alegria contagiante."]),
];

const integrated: RubricPreset = {
  id: "fe-integrated",
  name: "Future Edition · Rubrica integrada",
  description: "Uma rubrica para a sessão inteira: projeto, design de engenharia e estratégia, e Valores Fundamentais.",
  definition: FE([
    section("project", "Projeto", projectCriteria),
    section("engineering", "Design de engenharia e estratégia", engineeringCriteria),
    section("values", "Valores Fundamentais", valuesCriteria),
  ]),
};

const project: RubricPreset = {
  id: "fe-project",
  name: "Future Edition · Projeto",
  description: "Apresentação do projeto e perguntas (separado, para classificar por área).",
  definition: FE([section("project", "Projeto", projectCriteria)]),
};
const engineering: RubricPreset = {
  id: "fe-engineering",
  name: "Future Edition · Design de Engenharia",
  description: "Design do robô, programação e estratégia de jogo.",
  definition: FE([section("engineering", "Design de engenharia e estratégia", engineeringCriteria)]),
};
const values: RubricPreset = {
  id: "fe-values",
  name: "Future Edition · Valores Fundamentais",
  description: "Valores observados na sessão e no evento.",
  definition: FE([section("values", "Valores Fundamentais", valuesCriteria)]),
};

/** Divisão de 1º e 2º ano (5–7 anos): celebração, não competição. */
const kids: RubricPreset = {
  id: "fe-k2",
  name: "Future Edition K–2 · Mostra",
  description: "Para os pequenos (5 a 7 anos): conversa leve sobre o que construíram, programaram e aprenderam.",
  definition: def(
    SCALE_KIDS,
    [
      section("show", "O que a equipe mostrou", [
        c("k2_model", "Construção", "Mostraram o modelo e contaram como ele funciona.", ["Mostraram o modelo com ajuda.", "Explicaram partes do modelo.", "Explicaram o modelo com segurança e alegria."]),
        c("k2_code", "Programação", "Fizeram o robô se mover e contaram o que o programa faz.", ["O robô se move com ajuda.", "Explicaram parte do programa.", "Explicaram o programa e o que mudariam."]),
        c("k2_theme", "Tema da temporada", "Relacionaram o trabalho com a natureza e os seres vivos.", ["Citaram o tema.", "Contaram algo que aprenderam.", "Contaram várias descobertas com entusiasmo."]),
      ]),
      section("team", "Como a equipe trabalhou", [
        c("k2_together", "Todos juntos", "Cada criança teve sua vez de falar e mostrar.", ["Poucos participaram.", "A maioria participou.", "Todos participaram com alegria."]),
        c("k2_fun", "Diversão", "A equipe se divertiu e se orgulha do que fez.", ["Tímidos.", "Animados.", "Radiantes!"]),
      ]),
    ],
    { requireFeedback: true },
  ),
};

export const FLL_FUTURE_EDITION: RubricPresetGroup = {
  id: "fll-fe",
  label: "FLL Future Edition",
  description:
    "3º–9º ano: rubrica integrada (como a sessão oficial, ~30 min) ou três rubricas por área. K–2: ficha de mostra com escala Começando · Crescendo · Brilhando.",
  origin: "adapted",
  sessionMinutes: 30,
  // As opções são alternativas: o botão principal fica só com a integrada.
  recommended: ["fe-integrated"],
  presets: [integrated, project, engineering, values, kids],
};
