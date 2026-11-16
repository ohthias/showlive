import { c, def, levels, SCALE_4, SCALE_5, SCALE_KIDS, SCALE_OBS, section, type RubricPreset, type RubricPresetGroup } from "./helpers";

/** Modelos originais do ShowLive, para torneios próprios, mostras e eventos escolares. */

/* ------------------------------------------------- mostras e feiras */

const presentation: RubricPreset = {
  id: "sl-presentation",
  name: "Apresentação",
  description: "Rubrica curta para qualquer apresentação de projeto.",
  definition: def(SCALE_5, [
    section("geral", "Critérios", [
      c("ap_content", "Domínio do conteúdo", "A equipe sabe do que está falando e responde às perguntas."),
      c("ap_clarity", "Clareza e organização", "Começo, meio e fim; fácil de acompanhar."),
      c("ap_creativity", "Criatividade", "Recursos visuais, demonstrações, formas originais de apresentar."),
      c("ap_team", "Participação da equipe", "Todos falam e contribuem."),
      c("ap_time", "Uso do tempo", "Dentro do tempo, sem correria."),
    ]),
  ]),
};

const scienceFair: RubricPreset = {
  id: "sl-science-fair",
  name: "Feira de ciências · Método científico",
  description: "Para trabalhos de investigação: pergunta, hipótese, experimento e conclusão.",
  definition: def(
    SCALE_4,
    [
      section("method", "Investigação", [
        c("sf_question", "Pergunta e hipótese", "Pergunta testável e hipótese coerente.", [
          "Sem pergunta clara.",
          "Pergunta ampla demais para testar.",
          "Pergunta testável e hipótese coerente.",
          "Pergunta original, hipótese bem fundamentada.",
        ]),
        c("sf_experiment", "Experimento", "Variáveis controladas, repetições, materiais adequados.", [
          "Sem experimento.",
          "Experimento sem controle de variáveis.",
          "Variáveis controladas e repetições.",
          "Desenho experimental cuidadoso, com grupo controle.",
        ]),
        c("sf_data", "Dados e análise", "Registro, tabelas e gráficos que sustentam a conclusão.", [
          "Sem dados.",
          "Dados soltos.",
          "Dados organizados e analisados.",
          "Análise cuidadosa, com limitações reconhecidas.",
        ]),
        c("sf_conclusion", "Conclusão", "Responde à pergunta com base nos dados.", [
          "Sem conclusão.",
          "Conclusão sem relação com os dados.",
          "Conclusão apoiada nos dados.",
          "Conclusão crítica, com próximos passos.",
        ]),
      ]),
      section("comm", "Comunicação", [
        c("sf_poster", "Painel / pôster", "Organizado, legível de longe, com o essencial."),
        c("sf_talk", "Explicação oral", "Explicam com as próprias palavras e respondem às perguntas."),
      ]),
    ],
    { requireFeedback: true },
  ),
};

const poster: RubricPreset = {
  id: "sl-poster",
  name: "Pôster / banner",
  description: "Avaliação só do material visual, sem apresentação.",
  definition: def(SCALE_4, [
    section("poster", "Pôster", [
      c("po_title", "Título e objetivo", "Dá para entender o projeto em 10 segundos."),
      c("po_layout", "Organização visual", "Hierarquia clara, leitura de cima para baixo."),
      c("po_images", "Imagens e gráficos", "Imagens com propósito, legendas e fontes."),
      c("po_text", "Texto", "Frases curtas, sem erros, tamanho legível."),
      c("po_credits", "Créditos e referências", "Equipe, instituição e fontes citadas."),
    ]),
  ]),
};

const SHOWS: RubricPresetGroup = {
  id: "sl-shows",
  label: "Mostras e feiras",
  description: "Apresentação de projetos, feira de ciências e pôsteres.",
  origin: "original",
  sessionMinutes: 10,
  presets: [presentation, scienceFair, poster],
};

/* ------------------------------------------ engenharia e programação */

const robotGeneric: RubricPreset = {
  id: "sl-robot",
  name: "Projeto do robô",
  description: "Para torneios de robótica em geral (sumô, seguidor de linha, resgate): mecânica, eletrônica e estratégia.",
  definition: def(
    SCALE_4,
    [
      section("hw", "Hardware", [
        c("rb_mech", "Mecânica", "Estrutura, tração e mecanismos adequados ao desafio.", [
          "Estrutura frágil.",
          "Funciona, com limitações.",
          "Robusta e adequada.",
          "Soluções mecânicas criativas e eficientes.",
        ]),
        c("rb_elec", "Eletrônica", "Ligações organizadas, alimentação segura, sensores bem posicionados.", [
          "Fios soltos; risco de falha.",
          "Funciona, pouco organizada.",
          "Organizada e segura.",
          "Exemplar: identificada, protegida e fácil de manter.",
        ]),
      ]),
      section("sw", "Software", [
        c("rb_logic", "Lógica de controle", "Algoritmo adequado (máquina de estados, PID, etc.).", [
          "Lógica improvisada.",
          "Funciona em casos simples.",
          "Lógica clara para o desafio.",
          "Controle refinado e bem explicado.",
        ]),
        c("rb_sensors", "Uso de sensores", "Leitura, calibração e tratamento de ruído.", [
          "Sensores mal usados.",
          "Uso básico.",
          "Calibrados e bem usados.",
          "Calibração automática e tratamento de falhas.",
        ]),
      ]),
      section("process", "Processo", [
        c("rb_tests", "Testes", "Testes registrados e melhorias a partir deles."),
        c("rb_explain", "Explicação", "A equipe explica as decisões de projeto."),
      ]),
    ],
    { commentFromLevel: 4, requireFeedback: true },
  ),
};

const codeInterview: RubricPreset = {
  id: "sl-code",
  name: "Entrevista técnica de programação",
  description: "A banca pede para a equipe abrir o código e explicar.",
  definition: def(SCALE_4, [
    section("code", "Código", [
      c("cd_structure", "Estrutura", "Funções, blocos ou módulos com responsabilidades claras.", [
        "Tudo em um bloco só.",
        "Alguma separação.",
        "Bem dividido.",
        "Modular e reaproveitável.",
      ]),
      c("cd_names", "Legibilidade", "Nomes que explicam, comentários onde precisa.", [
        "Ilegível.",
        "Legível com esforço.",
        "Legível.",
        "Qualquer pessoa entende.",
      ]),
      c("cd_debug", "Depuração", "Como encontram e corrigem erros.", [
        "Tentativa e erro.",
        "Algum método.",
        "Método claro (logs, testes).",
        "Método sistemático, com exemplos reais.",
      ]),
      c("cd_versions", "Versões", "Guardam versões e sabem voltar atrás."),
    ]),
    section("people", "Equipe", [
      c("cd_shared", "Conhecimento compartilhado", "Mais de uma pessoa sabe explicar o código."),
    ]),
  ]),
};

const notebook: RubricPreset = {
  id: "sl-notebook",
  name: "Diário de engenharia",
  description: "Avaliação do caderno / diário de bordo da equipe.",
  definition: def(SCALE_4, [
    section("nb", "Diário", [
      c("nb_regular", "Registro contínuo", "Entradas datadas ao longo da temporada, não só no fim."),
      c("nb_decisions", "Decisões", "Alternativas consideradas e o motivo da escolha."),
      c("nb_data", "Testes e dados", "Resultados de testes registrados e comparados."),
      c("nb_sketches", "Desenhos e esquemas", "Esboços, fluxogramas e fotos que ajudam a entender."),
      c("nb_reflection", "Reflexão", "O que deu errado, o que aprenderam, próximos passos."),
    ]),
  ]),
};

const ENGINEERING: RubricPresetGroup = {
  id: "sl-engineering",
  label: "Engenharia e programação",
  description: "Projeto do robô (qualquer modalidade), entrevista de código e diário de engenharia.",
  origin: "original",
  sessionMinutes: 15,
  presets: [robotGeneric, codeInterview, notebook],
};

/* ---------------------------------------- inovação e empreendedorismo */

const hackathon: RubricPreset = {
  id: "sl-hackathon",
  name: "Hackathon",
  description: "Projetos feitos em poucas horas: problema, solução, execução e pitch.",
  definition: def(SCALE_5, [
    section("hk", "Projeto", [
      c("hk_problem", "Problema", "Problema real e bem explicado.", [], 1),
      c("hk_solution", "Solução", "Resolve o problema de forma convincente.", [], 2),
      c("hk_execution", "Execução técnica", "O que foi construído funciona na demonstração.", [], 2),
      c("hk_innovation", "Inovação", "Abordagem nova ou combinação original.", [], 1.5),
      c("hk_pitch", "Pitch", "Demonstração e apresentação dentro do tempo.", [], 1),
    ]),
  ]),
};

const pitch: RubricPreset = {
  id: "sl-pitch",
  name: "Pitch de empreendedorismo",
  description: "A equipe apresenta a solução como se fosse um negócio ou projeto social.",
  definition: def(
    SCALE_5,
    [
      section("biz", "Negócio", [
        c("pt_pain", "Dor e público", "Quem sofre com o problema e quanto isso importa."),
        c("pt_value", "Proposta de valor", "Por que a solução é melhor que as alternativas."),
        c("pt_model", "Sustentabilidade", "Como o projeto se mantém (custos, parceiros, receita)."),
        c("pt_proto", "Protótipo / validação", "Evidências de que funciona ou de que as pessoas querem."),
      ]),
      section("talk", "Pitch", [
        c("pt_story", "Narrativa", "História envolvente, com começo forte e fechamento claro."),
        c("pt_qa", "Respostas", "Respostas seguras às perguntas da banca."),
      ]),
    ],
    { requireFeedback: true },
  ),
};

const impact: RubricPreset = {
  id: "sl-impact",
  name: "Impacto social e sustentabilidade",
  description: "Para prêmios de impacto: o projeto mudou algo de verdade?",
  definition: def(SCALE_4, [
    section("im", "Impacto", [
      c("im_people", "Pessoas alcançadas", "Quem foi beneficiado e quantos.", ["Ninguém ainda.", "Poucas pessoas próximas.", "Um grupo definido.", "Uma comunidade, com evidências."]),
      c("im_evidence", "Evidências", "Fotos, depoimentos, números antes e depois.", ["Nenhuma.", "Relatos soltos.", "Evidências organizadas.", "Evidências medidas e comparadas."]),
      c("im_env", "Ambiente", "Cuidado com materiais, energia e descarte.", ["Não considerado.", "Citado.", "Aplicado no projeto.", "Princípio central do projeto."]),
      c("im_future", "Continuidade", "O projeto segue depois do torneio?", ["Termina no evento.", "Ideias para continuar.", "Plano de continuidade.", "Parcerias já firmadas."]),
    ]),
  ]),
};

const INNOVATION: RubricPresetGroup = {
  id: "sl-innovation",
  label: "Inovação e empreendedorismo",
  description: "Hackathon (com pesos por critério), pitch de negócio e impacto social.",
  origin: "original",
  sessionMinutes: 10,
  presets: [hackathon, pitch, impact],
};

/* ------------------------------------------------ equipe e comunidade */

const sportsmanship: RubricPreset = {
  id: "sl-sportsmanship",
  name: "Espírito esportivo",
  description: "Ficha de observação para voluntários circulando no evento (não precisa de sessão marcada).",
  definition: def(SCALE_OBS, [
    section("obs", "Observado no evento", [
      c("sp_help", "Ajuda outras equipes", "Emprestou peça, ferramenta ou conhecimento."),
      c("sp_respect", "Respeito", "Com árbitros, voluntários e adversários."),
      c("sp_loss", "Lida bem com derrotas", "Mantém a calma e cumprimenta os adversários."),
      c("sp_cheer", "Torcida positiva", "Anima a própria equipe e as outras."),
      c("sp_clean", "Cuidado com o espaço", "Box organizado, lixo no lugar."),
    ]),
  ]),
};

const rookie: RubricPreset = {
  id: "sl-rookie",
  name: "Equipe estreante",
  description: "Para o prêmio de equipe revelação: quanto a equipe evoluiu no primeiro ano.",
  definition: def(SCALE_4, [
    section("rk", "Primeira temporada", [
      c("rk_growth", "Evolução", "Diferença entre como começaram e onde chegaram."),
      c("rk_learning", "Aprendizado", "O que aprenderam e conseguem explicar."),
      c("rk_obstacles", "Superação", "Obstáculos enfrentados e como resolveram."),
      c("rk_plans", "Planos", "O que querem fazer na próxima temporada."),
    ]),
  ]),
};

const outreach: RubricPreset = {
  id: "sl-outreach",
  name: "Divulgação e mentoria",
  description: "Ações da equipe para levar a robótica a outras pessoas.",
  definition: def(SCALE_4, [
    section("out", "Ações", [
      c("ou_reach", "Alcance", "Oficinas, palestras, redes sociais, eventos."),
      c("ou_mentor", "Mentoria", "Ajudaram a criar ou treinar outras equipes."),
      c("ou_diversity", "Diversidade", "Ações para públicos que costumam ficar de fora."),
      c("ou_record", "Registro", "Documentaram as ações e os resultados."),
    ]),
  ]),
};

const COMMUNITY: RubricPresetGroup = {
  id: "sl-community",
  label: "Equipe e comunidade",
  description: "Espírito esportivo (observação 0–2), equipe estreante e divulgação.",
  origin: "original",
  sessionMinutes: 10,
  presets: [sportsmanship, rookie, outreach],
};

/* -------------------------------------------------------- iniciantes */

const kidsShow: RubricPreset = {
  id: "sl-kids",
  name: "Robótica no Fundamental I",
  description: "Para crianças de 6 a 10 anos: valoriza o esforço e a explicação, sem nota baixa assustadora.",
  definition: def(
    SCALE_KIDS,
    [
      section("kids", "Na conversa", [
        c("kd_build", "Mostrou o que construiu", "Apresentou o robô ou a maquete.", ["Com ajuda do adulto.", "Sozinho, em partes.", "Com segurança e orgulho."]),
        c("kd_how", "Explicou como funciona", "Contou o que o robô faz e como.", ["Ainda não explica.", "Explica uma parte.", "Explica do começo ao fim."]),
        c("kd_idea", "Teve uma ideia própria", "Algo que a equipe inventou ou mudou.", ["Seguiu o modelo.", "Mudou um detalhe.", "Criou algo novo."]),
        c("kd_team", "Trabalhou em equipe", "Todos ajudaram e falaram.", ["Um ou dois falaram.", "Quase todos.", "Todos, com alegria."]),
      ]),
    ],
    { requireFeedback: true },
  ),
};

const firstTournament: RubricPreset = {
  id: "sl-first",
  name: "Primeiro torneio (escala simples)",
  description: "Três níveis e poucos critérios, para bancas formadas por professores ou pais voluntários.",
  definition: def(levels("Precisa melhorar", "Bom", "Muito bom"), [
    section("simple", "Critérios", [
      c("ft_robot", "Robô", "O robô funciona e a equipe sabe explicar."),
      c("ft_project", "Projeto", "A equipe apresentou um problema e uma solução."),
      c("ft_team", "Equipe", "Todos participaram com respeito."),
    ]),
  ]),
};

const BEGINNERS: RubricPresetGroup = {
  id: "sl-beginners",
  label: "Iniciantes",
  description: "Fundamental I (Começando · Crescendo · Brilhando) e uma rubrica de 3 critérios para o primeiro torneio.",
  origin: "original",
  sessionMinutes: 10,
  presets: [kidsShow, firstTournament],
};

export const SHOWLIVE_GROUPS: RubricPresetGroup[] = [SHOWS, ENGINEERING, INNOVATION, COMMUNITY, BEGINNERS];
