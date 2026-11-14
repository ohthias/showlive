import { c, def, SCALE_FLL, section, type RubricPreset, type RubricPresetGroup } from "./helpers";

/**
 * FLL Challenge (Founders Edition): três rubricas, escala de 1 a 4,
 * comentário obrigatório em "Excepcional". Estrutura Identificar → Projetar
 * → Criar → Iterar → Comunicar nas rubricas de Projeto e de Design do Robô.
 */

const FLL = (sections: Parameters<typeof def>[1]) => def(SCALE_FLL, sections, { commentFromLevel: 4, requireFeedback: true });

const innovation: RubricPreset = {
  id: "fll-innovation",
  name: "Projeto de Inovação",
  description: "Como a equipe pesquisou um problema real, criou uma solução e a compartilhou.",
  definition: FLL([
    section("identify", "Identificar", [
      c("ip_problem", "Problema definido com clareza", "A equipe explica o problema que escolheu e por que ele importa.", [
        "Problema vago ou pouco explicado.",
        "Problema descrito, mas com lacunas.",
        "Problema claro e bem delimitado.",
        "Problema claro, delimitado e com motivação convincente.",
      ]),
      c("ip_research", "Pesquisa", "Uso de fontes variadas (entrevistas, especialistas, dados) para entender o problema.", [
        "Pouca ou nenhuma pesquisa.",
        "Pesquisa limitada a poucas fontes.",
        "Pesquisa com fontes variadas e relevantes.",
        "Pesquisa ampla, com especialistas e fontes bem usadas.",
      ]),
    ]),
    section("design", "Projetar", [
      c("ip_plan", "Planejamento e participação", "Plano de trabalho e contribuição de todos os integrantes.", [
        "Sem plano; poucos participam.",
        "Plano parcial; participação desigual.",
        "Plano claro; todos contribuem.",
        "Plano detalhado, seguido e com todos engajados.",
      ]),
      c("ip_ideas", "Geração de ideias", "Várias ideias consideradas antes de escolher a solução.", [
        "Uma ideia só, sem comparação.",
        "Algumas ideias, pouca análise.",
        "Ideias comparadas com critérios.",
        "Processo criativo rico, com escolha bem justificada.",
      ]),
    ]),
    section("create", "Criar", [
      c("ip_solution", "Solução original", "A solução é nova ou melhora algo que já existe.", [
        "Solução pouco desenvolvida.",
        "Ideia interessante, pouco detalhada.",
        "Solução desenvolvida e original.",
        "Solução original, detalhada e viável.",
      ]),
      c("ip_model", "Modelo ou protótipo", "A solução foi representada em modelo, protótipo, desenho ou simulação.", [
        "Sem representação.",
        "Representação simples.",
        "Representação clara da solução.",
        "Protótipo convincente, que ajuda a entender e testar a ideia.",
      ]),
    ]),
    section("iterate", "Iterar", [
      c("ip_share", "Compartilhamento", "A equipe mostrou a solução a pessoas afetadas pelo problema ou a especialistas.", [
        "Não compartilhou.",
        "Compartilhou com poucas pessoas.",
        "Compartilhou com o público certo.",
        "Compartilhou com vários públicos e recolheu opiniões úteis.",
      ]),
      c("ip_improve", "Melhorias", "O retorno recebido virou mudanças na solução.", [
        "Nenhuma mudança.",
        "Mudanças pequenas.",
        "Melhorias claras a partir do retorno.",
        "Várias rodadas de melhoria, bem documentadas.",
      ]),
    ]),
    section("communicate", "Comunicar", [
      c("ip_presentation", "Apresentação", "Apresentação criativa, clara e envolvente.", [
        "Apresentação confusa.",
        "Clara em partes.",
        "Clara e envolvente.",
        "Marcante, criativa e com todos participando.",
      ]),
      c("ip_impact", "Impacto", "A equipe mostra como a solução ajuda as pessoas e o mundo.", [
        "Impacto não explicado.",
        "Impacto citado, pouco explorado.",
        "Impacto bem explicado.",
        "Impacto evidente, com evidências e próximos passos.",
      ]),
    ]),
  ]),
};

const robotDesign: RubricPreset = {
  id: "fll-robot-design",
  name: "Design do Robô",
  description: "Estratégia, construção e programação do robô, e como a equipe as explica.",
  definition: FLL([
    section("identify", "Identificar", [
      c("rd_strategy", "Estratégia de missões", "Objetivos claros para a partida e escolha das missões.", [
        "Sem estratégia definida.",
        "Estratégia parcial.",
        "Estratégia clara e justificada.",
        "Estratégia clara, justificada e revisada com dados.",
      ]),
      c("rd_skills", "Habilidades e recursos", "A equipe aprendeu e usou recursos (peças, sensores, ferramentas).", [
        "Pouco aprendizado demonstrado.",
        "Algum aprendizado.",
        "Bom uso de habilidades e recursos.",
        "Domínio evidente das ferramentas e conceitos.",
      ]),
    ]),
    section("design", "Projetar", [
      c("rd_plan", "Planejamento e participação", "Processo de projeto organizado, com todos envolvidos.", [
        "Sem processo; poucos participam.",
        "Processo parcial.",
        "Processo claro; todos participam.",
        "Processo exemplar e totalmente colaborativo.",
      ]),
      c("rd_documentation", "Documentação", "Registros do projeto (caderno, desenhos, fluxogramas).", [
        "Sem registros.",
        "Registros incompletos.",
        "Registros claros e úteis.",
        "Registros completos que contam a evolução do robô.",
      ]),
    ]),
    section("create", "Criar", [
      c("rd_build", "Construção", "Robô e acessórios funcionais, robustos e fáceis de trocar.", [
        "Construção frágil ou pouco funcional.",
        "Funciona com limitações.",
        "Funcional e confiável.",
        "Eficiente, robusto e inovador.",
      ]),
      c("rd_code", "Programação", "Código organizado, com uso adequado de sensores e reutilização.", [
        "Código desorganizado.",
        "Código funcional, pouco organizado.",
        "Código organizado e explicado.",
        "Código modular, eficiente e com sensores bem usados.",
      ]),
    ]),
    section("iterate", "Iterar", [
      c("rd_tests", "Testes", "Testes repetidos do robô e do código.", [
        "Sem testes.",
        "Testes pouco sistemáticos.",
        "Testes sistemáticos.",
        "Testes com dados registrados e comparados.",
      ]),
      c("rd_improve", "Melhorias", "Mudanças no robô e no código a partir dos testes.", [
        "Nenhuma mudança.",
        "Mudanças pontuais.",
        "Melhorias claras a partir dos testes.",
        "Melhorias contínuas e bem justificadas.",
      ]),
    ]),
    section("communicate", "Comunicar", [
      c("rd_explanation", "Explicação", "A equipe explica com clareza as escolhas e o funcionamento do robô.", [
        "Explicação confusa.",
        "Explica em partes.",
        "Explicação clara e completa.",
        "Explicação clara, entusiasmada e com todos falando.",
      ]),
      c("rd_pride", "Orgulho e aprendizado", "A equipe mostra o que aprendeu e do que mais se orgulha.", [
        "Pouco entusiasmo.",
        "Algum entusiasmo.",
        "Entusiasmo e aprendizado claros.",
        "Entusiasmo contagiante e aprendizado profundo.",
      ]),
    ]),
  ]),
};

const coreValues: RubricPreset = {
  id: "fll-core-values",
  name: "Valores Fundamentais",
  description: "Os valores observados durante as sessões e ao longo do evento.",
  definition: FLL([
    section("values", "Valores", [
      c("cv_discovery", "Descoberta", "Exploram novas habilidades e ideias.", ["Pouca curiosidade.", "Alguma exploração.", "Exploram com entusiasmo.", "Exploram e inspiram outros a explorar."]),
      c("cv_innovation", "Inovação", "Usam criatividade e persistência para resolver problemas.", ["Pouca criatividade.", "Criatividade pontual.", "Criativos e persistentes.", "Criatividade e persistência excepcionais."]),
      c("cv_impact", "Impacto", "Aplicam o que aprendem para melhorar o mundo ao redor.", ["Pouca relação com a comunidade.", "Alguma ação.", "Ações com impacto real.", "Impacto amplo e duradouro."]),
      c("cv_inclusion", "Inclusão", "Respeitam uns aos outros e acolhem as diferenças.", ["Pouca inclusão.", "Inclusão parcial.", "Todos são ouvidos e respeitados.", "Inclusão exemplar, dentro e fora da equipe."]),
      c("cv_teamwork", "Trabalho em equipe", "São mais fortes trabalhando juntos.", ["Trabalho individual.", "Colaboração ocasional.", "Colaboração constante.", "Colaboração exemplar e equilibrada."]),
      c("cv_fun", "Diversão", "Aproveitam e celebram o que fazem.", ["Pouco envolvimento.", "Algum entusiasmo.", "Entusiasmo evidente.", "Alegria contagiante."]),
    ]),
  ]),
};

const gp: RubricPreset = {
  id: "fll-gp-pits",
  name: "Gracious Professionalism (box e mesas)",
  description: "Observação rápida feita por voluntários nos boxes e nas mesas, fora da sala.",
  weight: 0,
  definition: def(
    [
      { value: 0, label: "Não observado" },
      { value: 1, label: "Observado" },
      { value: 2, label: "Destaque" },
    ],
    [
      section("obs", "Comportamento observado", [
        c("gp_help", "Ajudou outra equipe", "Emprestou peça, ajudou a consertar, deu dica."),
        c("gp_respect", "Respeito com árbitros e voluntários", "Aceitou decisões com educação."),
        c("gp_cheer", "Torceu pelos outros", "Celebrou o sucesso de outras equipes."),
        c("gp_together", "Equipe unida sob pressão", "Manteve a calma e a cooperação em momentos difíceis."),
      ]),
    ],
  ),
};

export const FLL_CHALLENGE: RubricPresetGroup = {
  id: "fll",
  label: "FLL Challenge",
  description: "Projeto de Inovação, Design do Robô e Valores Fundamentais (1 a 4), mais uma ficha de observação de GP para os boxes.",
  origin: "adapted",
  sessionMinutes: 30,
  recommended: ["fll-innovation", "fll-robot-design", "fll-core-values"],
  presets: [innovation, robotDesign, coreValues, gp],
};
