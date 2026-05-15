const CRIT = ["Cap. física","Segurança","Dados clínicos","Fat. psicológicos","Contexto/obj."];
const CRIT_IDS = ["C","B","A","D","E"];

// Nova matriz: Segurança > Dados clínicos > Cap.física > Fat.psicológicos > Contexto/obj.
// CR = 0.015 ✓
const DEFAULT_MATRIX = [
  [1.00, 0.33, 0.50, 2.00, 3.00],
  [3.00, 1.00, 2.00, 4.00, 5.00],
  [2.00, 0.50, 1.00, 3.00, 4.00],
  [0.50, 0.25, 0.33, 1.00, 2.00],
  [0.33, 0.20, 0.25, 0.50, 1.00],
];

let ahpMatrix = DEFAULT_MATRIX.map(r=>[...r]);
let weights = [];
let cr = 0;
let answers = {};
let prescAnswers = {};
let currentBlock = 0;
let cutRules = [];
let phase = 'assessment'; // 'assessment' | 'prescription' | 'result'

const BLOCKS = [
  {id:"C",title:"Capacidade física atual",questions:[
    {id:"transferencia",text:"Transferência cama-cadeira independente",
     opts:[{l:"Sim, sem dificuldade",v:4},{l:"Sim, com esforço",v:3},{l:"Com supervisão / apoio parcial",v:2},{l:"Não consegue",v:1}]},
    {id:"equilibrio",text:"Equilíbrio em ortostatismo monopodal (com auxiliar se necessário)",
     opts:[{l:"Mantém > 60 seg estável",v:4},{l:"Mantém 30–60 seg",v:3},{l:"Mantém < 30 seg / necessita supervisão",v:2},{l:"Incapaz de se manter de pé",v:1}]},
    {id:"forca_coto",text:"Força muscular e condição do coto",
     opts:[{l:"Boa força, coto bem cicatrizado",v:4},{l:"Força razoável, coto adequado",v:3},{l:"Força reduzida ou coto problemático",v:2},{l:"Muito fraco / coto com complicações",v:1}]},
    {id:"resistencia",text:"Resistência cardiovascular / tolerância ao esforço",
     opts:[{l:"Sem limitação relevante",v:4},{l:"Limitação leve",v:3},{l:"Limitação moderada",v:2},{l:"Limitação severa",v:1}]},
    {id:"quedas",text:"Histórico de quedas (últimos 6 meses)",
     opts:[{l:"Nenhuma queda",v:4},{l:"1 queda sem consequências",v:3},{l:"2 ou mais quedas / 1 queda com lesão",v:2},{l:"Queda com hospitalização ou medo incapacitante de cair",v:1}]}
  ]},
  {id:"B",title:"Segurança",questions:[
    {id:"uso_auxiliar",text:"Utilização de auxiliares de marcha (canadiana, andarilho)",
     opts:[{l:"Usa correctamente e de forma consistente",v:4},{l:"Usa mas com técnica irregular",v:3},{l:"Usa apenas quando obrigado / negligencia",v:2},{l:"Recusa ou incapaz de usar",v:1}]},
    {id:"vigilancia_coto",text:"Auto-vigilância do coto (inspecção, sinais de alerta)",
     opts:[{l:"Inspecciona diariamente, reconhece sinais de risco",v:4},{l:"Inspecciona ocasionalmente",v:3},{l:"Raramente inspecciona / pouco consciente",v:2},{l:"Não inspecciona / incapaz de avaliar",v:1}]},
    {id:"compliance_limitacoes",text:"Respeito pelos limites prescritos (carga, duração, terreno)",
     opts:[{l:"Cumpre sistematicamente as indicações",v:4},{l:"Cumpre na maioria das situações",v:3},{l:"Frequentemente excede os limites",v:2},{l:"Ignora as limitações / comportamento de risco",v:1}]}
  ]},
  {id:"A",title:"Dados clínicos base",questions:[
    {id:"nivel_amp",text:"Nível de amputação",
     opts:[{l:"Transtibial",v:4},{l:"Desarticulação do joelho",v:3},{l:"Transfemoral",v:2},{l:"Hemipelvectomia / desarticulação da anca",v:1}]},
    {id:"causa",text:"Causa da amputação",
     opts:[{l:"Traumática",v:4},{l:"Oncológica",v:3},{l:"Vascular sem diabetes",v:2},{l:"Vascular com diabetes / neuropatia",v:1}]},
    {id:"comorbilidades",text:"Comorbilidades major",
     opts:[{l:"Nenhuma relevante",v:4},{l:"Doença cardíaca controlada",v:3},{l:"AVC com sequelas leves",v:2},{l:"Múltiplas comorbilidades graves",v:1}]}
  ]},
  {id:"D",title:"Fatores psicológicos e cognitivos",questions:[
    {id:"motivacao",text:"Motivação e adesão à reabilitação",
     opts:[{l:"Alta — objetivo claro, comprometido",v:4},{l:"Moderada — cooperante",v:3},{l:"Baixa — hesitante / passivo",v:2},{l:"Muito baixa / recusa colaboração",v:1}]},
    {id:"saude_mental",text:"Saúde mental (depressão, ansiedade pós-amputação)",
     opts:[{l:"Sem sinais relevantes",v:4},{l:"Sintomas leves controlados",v:3},{l:"Sintomas moderados",v:2},{l:"Perturbação severa",v:1}]},
    {id:"cognicao",text:"Capacidade de aprendizagem / cognição",
     opts:[{l:"Sem comprometimento",v:4},{l:"Comprometimento leve",v:3},{l:"Comprometimento moderado",v:2},{l:"Comprometimento severo",v:1}]}
  ]},
  {id:"E",title:"Contexto ambiental e objetivos",questions:[
    {id:"habitacao",text:"Ambiente doméstico",
     opts:[{l:"Sem barreiras",v:4},{l:"Barreiras moderadas",v:3},{l:"Barreiras significativas",v:2},{l:"Inacessível sem remodelação",v:1}]},
    {id:"apoio",text:"Apoio familiar / rede de suporte",
     opts:[{l:"Apoio sólido disponível",v:4},{l:"Apoio parcial",v:3},{l:"Apoio mínimo",v:2},{l:"Vive só, sem suporte",v:1}]},
    {id:"objetivo",text:"Objetivo funcional declarado",
     opts:[{l:"Retomar desporto / trabalho físico intenso",v:4},{l:"Deambular na comunidade",v:3},{l:"Mobilidade doméstica independente",v:2},{l:"Transferências / uso muito limitado",v:1}]}
  ]}
];

// Perguntas de prescrição (Fase 2)
const PRESC_QUESTIONS = [
  {id:"maturidade_coto",text:"Maturidade e estabilidade volumétrica do coto",
   opts:[
     {l:"Coto maduro e estável (> 12 meses, volume estável)",v:3},
     {l:"Coto em consolidação (6–12 meses, volume quase estável)",v:2},
     {l:"Coto recente / primeira prótese (< 6 meses, ainda em retracção)",v:1}
   ]},
  {id:"tecido_coto",text:"Qualidade do tecido e tolerância à pressão",
   opts:[
     {l:"Pele saudável, boa tolerância à pressão",v:3},
     {l:"Cicatriz aderente ou queloide localizado",v:2},
     {l:"Pele frágil / atrófica / úlceras prévias",v:1}
   ]}
];

const K_INFO = [
  {k:0,label:"K0",desc:"Sem potencial de deambulação protética. Foco em transferências e cadeira de rodas.",cls:"k0"},
  {k:1,label:"K1",desc:"Deambulação limitada em superfície plana, velocidade fixa. Uso doméstico básico.",cls:"k1"},
  {k:2,label:"K2",desc:"Supera pequenos obstáculos, rampas, passeios. Comunidade limitada.",cls:"k2"},
  {k:3,label:"K3",desc:"Varia velocidade, sobe escadas, terreno irregular. Comunidade plena / retorno profissional.",cls:"k3"},
  {k:4,label:"K4",desc:"Alta performance. Atletas, utilizadores muito ativos, crianças em crescimento.",cls:"k4"}
];

const DEFAULT_CUTS = [
  {id:"no_stand",label:"Incapaz de se manter em ortostatismo (equilíbrio = 1)",qid:"equilibrio",op:"eq",val:1,maxK:1},
  {id:"no_transfer",label:"Incapaz de fazer transferência (transferência = 1)",qid:"transferencia",op:"eq",val:1,maxK:0},
  {id:"severe_comorbid",label:"Múltiplas comorbilidades graves",qid:"comorbilidades",op:"eq",val:1,maxK:1},
  {id:"severe_mental",label:"Perturbação psicológica severa",qid:"saude_mental",op:"eq",val:1,maxK:1},
  {id:"no_rehab",label:"Recusa colaboração em reabilitação",qid:"motivacao",op:"eq",val:1,maxK:0},
  {id:"fall_hosp",label:"Queda com hospitalização ou medo incapacitante de cair",qid:"quedas",op:"eq",val:1,maxK:1}
];
cutRules = DEFAULT_CUTS.map(c=>({...c}));

// ── Lógica de prescrição de componentes ──
// Fonte: Össur Catálogo 2025/2026 + Ottobock Foot Family Portfolio 12/2025 + Seleção de Joelhos
function getPrescription(finalK, nivel_amp, maturidade, tecido, cognicao, objetivo) {
  const isTT  = nivel_amp === 4;
  const isDK  = nivel_amp === 3;
  const isTF  = nivel_amp === 2;
  const isHP  = nivel_amp === 1;
  const cotoRecente  = maturidade === 1;
  const cotoMaduro   = maturidade === 3;
  const telidoFragil = tecido === 1;
  const cicatriz     = tecido === 2;
  const cogOk        = cognicao >= 3;
  const altaAtiv     = objetivo >= 3;
  const segCompr     = answers["quedas"] <= 2 || answers["equilibrio"] <= 2;

  const out = { pe: null, joelho: null, suspensao: null, notas: [] };

  // ── K0 — prótese não indicada ──
  if (finalK === 0) {
    out.notas.push("K0 — Prótese não indicada neste momento. O perfil funcional actual não suporta deambulação protésica. Foco recomendado em mobilidade em cadeira de rodas, transferências e reabilitação física preparatória. Reavaliar após programa de fortalecimento e estabilização do coto.");
    return out;
  }

  // ── HEMIPELVECTOMIA ──
  if (isHP) {
    out.notas.push("Hemipelvectomia / desarticulação da anca: prescrição altamente individualizada. Este instrumento fornece orientação geral — avaliação por equipa especializada obrigatória.");
    out.pe = { cat: "Pé dinâmico leve / baixo perfil", ossur: "Vari-Flex (baixo perfil)", ottobock: "Taleo LP (1C53)" };
    out.joelho = { cat: "Joelho policêntrico com controlo de fase", ossur: "Total Knee 2000", ottobock: "3R60 EBS policêntrico" };
    out.suspensao = { cat: "Sistema de arnês total", ossur: "—", ottobock: "Arnês pélvico integrado (customizado)" };
    return out;
  }

  // ════════════════════════════════════════
  // PÉ PROTÉSICO
  // Fonte: Össur 2025/2026 + Ottobock Foot Family Portfolio 12/2025
  // ════════════════════════════════════════

  if (finalK === 1) {
    // K1: baixa actividade, marcha doméstica, velocidade única
    out.pe = {
      cat: "Pé de baixa actividade — marcha doméstica, velocidade única",
      ossur: "Vari-Flex (cat. baixo impacto)",
      ottobock: "SACH+™ (1S101/102/103) / Dynamic Foot™ with Toes (1D10/1D11) / Terion™ K2 (1C11)"
    };
  }
  else if (finalK === 2) {
    // K2: actividade baixa-moderada, marcha comunitária limitada
    if (segCompr) {
      // Segurança comprometida → Proprio Foot (MPK adaptativo, reduz quedas)
      out.pe = {
        cat: "Pé microprocessado adaptativo — K1–K3, reduz risco de queda em terreno irregular",
        ossur: "Proprio Foot® (tobillo microprocessado, adaptação automática ao terreno)",
        ottobock: "Meridium® (1B1-2) — microprocessado moderado, K2–K3, baixo perfil 160mm"
      };
      out.notas.push("Perfil de segurança comprometido: Proprio Foot (Össur) e Meridium (Ottobock) são pés microprocessados que adaptam automaticamente o ângulo do tornozelo ao terreno, reduzindo risco de queda. Indicados para K1–K3 com equilíbrio ou historial de quedas desfavorável.");
    } else {
      out.pe = {
        cat: "Pé de baixa actividade — marcha comunitária limitada, obstáculos simples",
        ossur: "Vari-Flex® / Pro-Flex® Pivot (baixo a moderado impacto, movimento tobillo 27°)",
        ottobock: "Kintrol (VS4) / Restore (VS5) / Terion™ K2 (1C11)"
      };
    }
  }
  else if (finalK === 3) {
    if (segCompr) {
      out.pe = {
        cat: "Pé microprocessado adaptativo — K2–K3, segurança prioritária",
        ossur: "Proprio Foot® (microprocessado, adaptação automática)",
        ottobock: "Meridium® (1B1-2) — microprocessado K2–K3, 275 lbs"
      };
      out.notas.push("Perfil de segurança comprometido: pé microprocessado recomendado mesmo em K3 — Proprio Foot / Meridium adaptam o ângulo do tornozelo em tempo real, reduzindo tropeços.");
    } else if (altaAtiv) {
      // K3 alta actividade
      out.pe = {
        cat: "Pé ESAR de alto desempenho — marcha a várias velocidades, terreno irregular",
        ossur: "Pro-Flex® XC (baixo a alto impacto, 166kg, IP68) / Pro-Flex® Terra (multilâmina, versatilidade)",
        ottobock: "Taleo Adapt (1C59) hidráulico ESAR 287 lbs / Taleo (1C50) 330 lbs / Taleo Harmony (1C52) + absorção vertical"
      };
    } else {
      // K3 actividade moderada
      out.pe = {
        cat: "Pé ESAR optimizado — marcha eficiente, progresión plantar suave",
        ossur: "Pro-Flex® ST (baixo a alto impacto, 166kg) / Pro-Flex® LP (perfil baixo, muñones largos) / Pro-Flex® Modular",
        ottobock: "Taleo Harmony (1C52) 330 lbs / Taleo Vertical Shock (1C51) 330 lbs / Taleo Side Flex (1C58)"
      };
    }
    // Nota Proprio Foot sempre disponível como alternativa de segurança em K3
  }
  else if (finalK === 4) {
    if (altaAtiv) {
      // K4 desportivo
      out.pe = {
        cat: "Lâmina de carbono desportiva — corrida / alto impacto / desporto específico",
        ossur: "Cheetah® Xpanse / Cheetah® Xcel / Cheetah® Xplore (família corrida K4)",
        ottobock: "Springlite Sprinter (1E90) / Runner (1E91) — corrida K3–K4"
      };
      out.notas.push("K4 desportivo: lâmina de corrida para uso desportivo específico. Para uso quotidiano intenso combinar com pé ESAR de alto desempenho: Pro-Flex XC Torsion (Össur) / Taleo Adapt 1C59 ou família Triton K3–K4 (Ottobock).");
    } else {
      // K4 uso diário alta performance
      out.pe = {
        cat: "Pé ESAR de alta performance com torsão — uso diário K4, impacto elevado",
        ossur: "Pro-Flex® XC Torsion (ESAR + rotação, 147kg) / Pro-Flex® XC (166kg, IP68)",
        ottobock: "Triton® HD (1C64) 330 lbs / Triton® Harmony (1C62) + absorção / Maverick Xtreme AT (F21) 365 lbs"
      };
    }
  }

  // ════════════════════════════════════════
  // JOELHO (só Transfemoral e Desarticulação do joelho)
  // Fonte: Össur 2025/2026 + Ottobock Seleção de Joelhos
  // ════════════════════════════════════════

  if (isTF || isDK) {
    if (isDK) {
      // Desarticulação do joelho — espaço distal muito limitado
      out.joelho = {
        cat: "Joelho policêntrico de 4 eixos — suspensão condiliana, espaço distal limitado",
        ossur: "Balance Knee OFM1 (policêntrico, com adaptador DK) / Total Knee 1900 (adaptador 4 patas)",
        ottobock: "3R62 KD / 3R60 KD — policêntrico EBS versão desarticulação"
      };
      out.notas.push("Desarticulação do joelho: côndilo femoral preservado permite suspensão condiliana por expansão do liner. O espaço distal limita a selecção de joelho — policêntrico de 4 eixos é frequentemente a única opção viável. Balance Knee OFM1 (Össur) suporta TF e DK com vários adaptadores.");
    } else {
      // Transfemoral — por K-Level
      if (finalK === 1) {
        out.joelho = {
          cat: "Joelho com bloqueio manual — máxima segurança, reabilitação inicial, velocidade única",
          ossur: "Locking Knee LKN (mono-eixo, bloqueio manual, 125kg) / Balance Knee OFM2 (bloqueio + fase de apoio ajustável)",
          ottobock: "3R41 mono-eixo com bloqueio / Provado (MPK básico com bloqueio assistido)"
        };
      } else if (finalK === 2) {
        if (segCompr) {
          // K2 com segurança comprometida → MPK específicos para baixa mobilidade
          out.joelho = {
            cat: "Joelho microprocessado para baixa mobilidade — estabilidade aumentada, stumble recovery",
            ossur: "Navii® (MPK IP68, K2–K3, bloqueo mecânico variável, 136kg) / Rheo Knee® (MPK, K2–K3, 136kg)",
            ottobock: "Kenevo (MPK, Modo A/B/B+/C, stumble recovery, modo cadeira de rodas, K2–K3)"
          };
          out.notas.push("K2 com segurança comprometida: Navii (Össur) e Kenevo (Ottobock) são MPKs concebidos especificamente para utilizadores com mobilidade limitada — incluem stumble recovery, bloqueo em bipedestação e configuração progressiva por modos de actividade.");
        } else {
          out.joelho = {
            cat: "Joelho policêntrico básico — marcha doméstica / comunitária limitada",
            ossur: "Total Knee® 1900 (policêntrico, bloqueio geométrico, 100kg) / Balance Knee OFM1",
            ottobock: "3R106-PRO policêntrico / 3R20/3R26 policêntrico 4 eixos extremidade livre"
          };
        }
      } else if (finalK === 3) {
        if (altaAtiv) {
          out.joelho = {
            cat: "Joelho hidráulico de eixo único — cadência variável, escadas step-over-step, terreno irregular",
            ossur: "Mauch® Knee SNS (hidráulico eixo único, 136kg) / Mauch® Knee Plus (166kg) / Total Knee® 2100 (policêntrico hidráulico, 125kg, moderado a extremo)",
            ottobock: "3R80 (hidráulico rotativo, waterproof, 150kg, K3–K4) / 3R85 (hidráulico rotativo reforçado)"
          };
        } else {
          out.joelho = {
            cat: "Joelho policêntrico hidráulico — marcha a várias velocidades, terreno exterior",
            ossur: "Total Knee® 2000 (policêntrico hidráulico 3 fases, 100kg) / OHP3 Knee™ (policêntrico pneumático, 125kg)",
            ottobock: "3R60 EBS (policêntrico hidráulico K2–K3, EBS stance control) / 3R62 EBS / 3R78"
          };
        }
      } else {
        // K4
        out.joelho = {
          cat: "Joelho microprocessado de alta performance — controlo total, actividades de impacto",
          ossur: "Rheo Knee® XC (MPK, K3–K4, ciclismo e corrida, 136kg) / Navii® (MPK IP68, alta actividade)",
          ottobock: "C-Leg® (MPK, K2–K4, >100.000 fittings, referência mundial) / Genium / Genium X3/X4 (K4, corrida, IP68)"
        };
        out.notas.push("K4 transfemoral: C-Leg (Ottobock) é o MPK de referência com mais de 100.000 fittings. Genium X3/X4 para utilizadores de muito alta actividade com modo corrida. Rheo Knee XC (Össur) oferece funcionalidade equivalente com design mais compacto.");
      }
    }
  }

  // ════════════════════════════════════════
  // SUSPENSÃO / INTERFACE
  // ════════════════════════════════════════

  if (isTT) {
    if (cotoRecente) {
      out.suspensao = {
        cat: "Socket provisório — coto em retracção, suspensão definitiva contra-indicada",
        ossur: "Iceross® liner básico + PTB provisório",
        ottobock: "Socket preparatório + correa supracondiliana"
      };
      out.notas.push("Coto recente (< 6 meses): vácuo elevado e Seal-In contra-indicados — volume instável impede vedação adequada. Socket provisório com volume ajustável é a indicação correcta. Reavaliar suspensão definitiva após estabilização volumétrica (tipicamente 3–6 meses).");
    } else if (telidoFragil) {
      out.suspensao = {
        cat: "Pin lock — evitar vácuo elevado (risco de úlcera por gradiente de pressão)",
        ossur: "Iceross® Dermo Locking / Iceross® Comfort Locking + Icelock pin",
        ottobock: "Liner silicone + sistema de pin lock"
      };
      out.notas.push("Pele frágil / atrófica: vácuo elevado e sucção directa contra-indicados. Pin lock distribui pressão de forma mais uniforme e é tecnicamente mais simples de gerir. Inspecção diária do coto obrigatória.");
    } else if (cicatriz) {
      if (cogOk) {
        out.suspensao = {
          cat: "Seal-In com vácuo passivo — monitorizar zonas de cicatriz",
          ossur: "Iceross Seal-In® X / V (sucção por membranas, bom controlo rotacional) + Unity passivo",
          ottobock: "Liner silicone + Harmony P2 (vácuo passivo)"
        };
        out.notas.push("Cicatriz aderente: inspecção diária das zonas de pressão. Suspender uso se rubor persistente > 20 min após remoção. Iceross Seal-In X Locking (híbrido) como alternativa se controlo rotacional for prioritário.");
      } else {
        out.suspensao = {
          cat: "Pin lock — mais simples de gerir, cognição limitada",
          ossur: "Iceross® Dermo Locking / Iceross® Synergy Locking + Icelock pin",
          ottobock: "Liner silicone + pin lock"
        };
      }
    } else {
      // Pele sã, coto estável
      if (cogOk && altaAtiv && cotoMaduro) {
        out.suspensao = {
          cat: "Elevated Vacuum (Unity) — máximo controlo, mínimo pistoning, alta actividade",
          ossur: "Iceross Seal-In® X5 / Seal-In® X + Unity® System (vácuo elevado sem rodillera)",
          ottobock: "Harmony P4 HD / E-Pulse (vácuo activo electrónico)"
        };
        out.notas.push("Unity System (Össur): compatível com Pro-Flex XC, Pro-Flex Terra, Proprio Foot e Vari-Flex. Se pé prescrito for Ottobock, usar Harmony P4 HD como alternativa de vácuo elevado.");
      } else if (cogOk && cotoMaduro) {
        out.suspensao = {
          cat: "Seal-In — sucção por membranas, bom controlo rotacional",
          ossur: "Iceross Seal-In® X5 / Iceross Seal-In® V (com Wave) / Iceross Dermo Seal-In®",
          ottobock: "Liner silicone + Harmony P2 (vácuo passivo)"
        };
      } else {
        out.suspensao = {
          cat: "Pin lock — segurança, facilidade de uso, indicado para baixa destreza",
          ossur: "Iceross® Dermo Locking / Iceross® Synergy™ Locking / Iceross® Comfort® Locking + Icelock",
          ottobock: "Liner silicone + sistema de pin lock"
        };
      }
    }
  } else if (isTF) {
    if (cotoRecente) {
      out.suspensao = {
        cat: "Cinto Silesian — tolerante à variação volumétrica, coto transfemoral recente",
        ossur: "Iceross® TF liner básico + cinto Silesian",
        ottobock: "Socket preparatório + cinto Silesian"
      };
      out.notas.push("Coto transfemoral recente: sucção directa e vácuo contra-indicados — volume instável impede vedação. Cinto Silesian é a opção mais tolerante. Reavaliar em 3–6 meses.");
    } else if (telidoFragil) {
      out.suspensao = {
        cat: "Liner TF com cinto auxiliar — evitar sucção directa",
        ossur: "Iceross® TF liner + cinto auxiliar Silesian",
        ottobock: "Liner TF silicone + cinto auxiliar"
      };
      out.notas.push("Pele frágil em coto transfemoral: sucção directa contra-indicada. Liner com cinto reduz gradientes de pressão na interface.");
    } else {
      if (cogOk && cotoMaduro && altaAtiv) {
        out.suspensao = {
          cat: "Elevated Vacuum TF — gold standard para alta actividade",
          ossur: "Iceross Seal-In® X TF + Unity® TF (vácuo elevado, máximo controlo)",
          ottobock: "Harmony P4 HD TF / E-Pulse TF (vácuo activo electrónico)"
        };
        out.notas.push("Sleeve suction TF é problemático — limita flexão do joelho e raramente indicado actualmente. Elevated Vacuum é o gold standard para TF activo com coto estável e cognição preservada.");
      } else if (cogOk && cotoMaduro) {
        out.suspensao = {
          cat: "Seal-In TF — sucção por membranas, muito usado, boa alternativa",
          ossur: "Iceross Seal-In® X TF / Connect® TF",
          ottobock: "Liner TF sucção directa + cinto auxiliar se necessário"
        };
      } else {
        out.suspensao = {
          cat: "Cinto Silesian / sucção parcial com cinto — opção mais simples",
          ossur: "Iceross® TF liner básico + cinto Silesian",
          ottobock: "Liner TF + cinto Silesian"
        };
      }
    }
  } else if (isDK) {
    out.suspensao = {
      cat: "Suspensão condiliana — expansão do liner sobre côndilos femorais",
      ossur: "Iceross® Seal-In DK / Iceross® Dermo (versão desarticulação)",
      ottobock: "Liner condiliano 3R62 KD compatível"
    };
  }

  return out;
}


function renderPrescription(finalK) {
  const nivel_amp = answers["nivel_amp"] || 4;
  const maturidade = prescAnswers["maturidade_coto"] || 2;
  const tecido = prescAnswers["tecido_coto"] || 3;
  const cognicao = answers["cognicao"] || 3;
  const objetivo = answers["objetivo"] || 2;
  const presc = getPrescription(finalK, nivel_amp, maturidade, tecido, cognicao, objetivo);

  const nivelLabels = {4:"Transtibial", 3:"Desarticulação do joelho", 2:"Transfemoral", 1:"Hemipelvectomia"};
  const maturLabels = {3:"Maduro (> 12 meses)", 2:"Em consolidação (6–12 meses)", 1:"Recente (< 6 meses)"};
  const tecidoLabels = {3:"Pele saudável", 2:"Cicatriz aderente", 1:"Pele frágil / atrófica"};

  // K0 — sem prótese
  if (finalK === 0) {
    const html = `
      <div class="card" style="margin-top:16px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
          <div style="width:42px;height:42px;border-radius:10px;background:var(--red-dim);display:flex;align-items:center;justify-content:center;font-size:20px;">🚫</div>
          <div>
            <div style="font-size:17px;font-weight:700;color:var(--text-1);letter-spacing:-.02em;">Prótese não indicada</div>
            <div style="font-size:12px;color:var(--text-3);margin-top:2px;">K0 — ${nivelLabels[nivel_amp]}</div>
          </div>
        </div>
        <div class="flag fe" style="margin:0;">${presc.notas[0]}</div>
      </div>
      <div class="nav">
        <button class="bn" onclick="reset()">← Nova avaliação</button>
      </div>`;
    animateContent(html);
    return;
  }

  function compCard(title, data, icon) {
    if (!data) return '';
    return `<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px;margin-bottom:10px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);margin-bottom:10px;">${icon} ${title}</div>
      <div style="font-size:13.5px;font-weight:600;color:var(--text-1);margin-bottom:8px;">${data.cat}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:100px;background:rgba(0,100,200,.08);border:1px solid rgba(0,100,200,.15);font-size:11.5px;font-weight:500;color:#1a56db;">
          <span style="font-weight:700;">Össur</span> ${data.ossur}
        </span>
        <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:100px;background:rgba(220,80,0,.07);border:1px solid rgba(220,80,0,.15);font-size:11.5px;font-weight:500;color:#c2410c;">
          <span style="font-weight:700;">Ottobock</span> ${data.ottobock}
        </span>
      </div>
    </div>`;
  }

  const notesHtml = presc.notas.length > 0
    ? presc.notas.map(n => `<div class="flag fw" style="font-size:12.5px;">${n}</div>`).join('')
    : '';

  const html = `
    <div class="card" style="margin-top:16px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
        <div style="width:42px;height:42px;border-radius:10px;background:var(--accent-dim);display:flex;align-items:center;justify-content:center;font-size:20px;">🦾</div>
        <div>
          <div style="font-size:17px;font-weight:700;color:var(--text-1);letter-spacing:-.02em;">Recomendação de componentes</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:2px;">${nivelLabels[nivel_amp]} · Coto: ${maturLabels[maturidade]} · Tecido: ${tecidoLabels[tecido]}</div>
        </div>
      </div>
      ${compCard("Pé protésico", presc.pe, "🦶")}
      ${presc.joelho ? compCard("Joelho protésico", presc.joelho, "🦵") : ''}
      ${compCard("Suspensão / interface", presc.suspensao, "🔗")}
    </div>
    ${notesHtml}
    <div class="nav">
      <button class="bn" onclick="reset()">← Nova avaliação</button>
      <button class="bn pri" onclick="guardarEVerRelatorio()" id="btn-guardar">💾 Guardar e ver relatório →</button>
    </div>`;

  // Save prescription data to sessionStorage
  const existing = JSON.parse(sessionStorage.getItem("ahpResultado")||"{}");
  existing.prescricao = {
    nivel_amp, maturidade, tecido,
    nivelLabel: nivelLabels[nivel_amp],
    maturLabel: maturLabels[maturidade],
    tecidoLabel: tecidoLabels[tecido],
    pe: presc.pe,
    joelho: presc.joelho,
    suspensao: presc.suspensao,
    notas: presc.notas
  };
  sessionStorage.setItem("ahpResultado", JSON.stringify(existing));
  animateContent(html);
}

function renderPrescQuestions(finalK) {
  phase = 'prescription';
  let html = `
    <div class="bh">
      <div class="bt">Dados para prescrição</div>
      <div class="bsub">Informação adicional sobre o coto necessária para recomendar componentes e sistema de suspensão.</div>
    </div>
    ${PRESC_QUESTIONS.map(q => `
      <div class="q">
        <label class="q-label">${q.text}</label>
        <div class="opts">
          ${q.opts.map(o => `<button class="ob${prescAnswers[q.id]===o.v?" sel":""}" onclick="selectPrescAns('${q.id}',${o.v},this)">${o.l}</button>`).join("")}
        </div>
      </div>`).join("")}
    <div class="nav">
      <button class="bn" onclick="backToResult(${finalK})">← Resultado K</button>
      <button class="bn pri" id="btn-presc" onclick="renderPrescription(${finalK})" ${isPrescComplete()?"":"disabled"}>
        Ver recomendação →
      </button>
    </div>`;
  animateContent(html);
}

function isPrescComplete() {
  return PRESC_QUESTIONS.every(q => prescAnswers[q.id] !== undefined);
}

function selectPrescAns(qid, val, btn) {
  prescAnswers[qid] = val;
  btn.closest(".opts").querySelectorAll(".ob").forEach(b => b.classList.remove("sel"));
  btn.classList.add("sel");
  document.getElementById("btn-presc").disabled = !isPrescComplete();
}

function backToResult(finalK) {
  phase = 'assessment';
  renderResult();
}

function switchTab(t, btn){
  document.querySelectorAll(".tab").forEach(el=>el.classList.remove("active"));
  document.querySelectorAll(".tb").forEach(el=>el.classList.remove("on"));
  document.getElementById("tab-"+t).classList.add("active");
  btn.classList.add("on");
  if(t==="config") renderMatrix();
  if(t==="cuts") renderCuts();
}

function _calcWeights(){
  const n=5;
  const colSums=Array(n).fill(0);
  for(let j=0;j<n;j++) for(let i=0;i<n;i++) colSums[j]+=ahpMatrix[i][j];
  const norm=ahpMatrix.map(row=>row.map((v,j)=>v/colSums[j]));
  weights=norm.map(row=>row.reduce((a,b)=>a+b,0)/n);
  const wSum=weights.reduce((a,b)=>a+b,0);
  weights=weights.map(w=>w/wSum);
  const Aw=ahpMatrix.map(row=>row.reduce((s,v,j)=>s+v*weights[j],0));
  const lambdaMax=Aw.reduce((s,v,i)=>s+v/weights[i],0)/n;
  const CI=(lambdaMax-n)/(n-1);
  cr=CI/1.12;
}
function computeAHPSilent(){ _calcWeights(); }

function computeAHP(){
  const n=5;
  const vals=[];
  for(let i=0;i<n;i++){
    vals.push([]);
    for(let j=0;j<n;j++){
      const el=document.getElementById(`m${i}_${j}`);
      vals[i].push(el?parseFloat(el.value)||ahpMatrix[i][j]:ahpMatrix[i][j]);
    }
  }
  ahpMatrix=vals;
  _calcWeights();
  const crEl=document.getElementById("cr-display");
  crEl.className="crbadge "+(cr<0.1?"crok":"crwarn");
  crEl.textContent=`CR = ${cr.toFixed(3)} ${cr<0.1?"✓":"⚠"}`;
  renderWeightsDisplay("weights-display");
}

function renderWeightsDisplay(containerId){
  const el=document.getElementById(containerId);
  if(!el||weights.length===0) return;
  el.innerHTML=`<div class="weights-card">
    <div class="weights-title">Pesos derivados</div>
    ${weights.map((w,i)=>`
      <div class="srow">
        <div class="slbl">${CRIT[i]}</div>
        <div class="strk"><div class="sfil" style="width:${(w*100).toFixed(1)}%"></div></div>
        <div class="sval">${(w*100).toFixed(0)}%</div>
      </div>`).join("")}
  </div>`;
}

function renderMatrix(){
  if(weights.length===0) computeAHPSilent();
  const n=5;
  let html=`<tr><th></th>${CRIT.map(c=>`<th>${c}</th>`).join("")}</tr>`;
  for(let i=0;i<n;i++){
    html+=`<tr><th>${CRIT[i]}</th>`;
    for(let j=0;j<n;j++){
      if(i===j) html+=`<td class="diag">1</td>`;
      else if(j<i) html+=`<td style="color:var(--text-3);font-size:11px;">${(1/ahpMatrix[j][i]).toFixed(2)}</td>`;
      else html+=`<td><input id="m${i}_${j}" type="number" min="0.11" max="9" step="0.01" value="${ahpMatrix[i][j]}" onchange="syncReciprocal(${i},${j})"></td>`;
    }
    html+=`</tr>`;
  }
  document.getElementById("ahp-matrix").innerHTML=html;
  const crEl=document.getElementById("cr-display");
  crEl.className="crbadge "+(cr<0.1?"crok":"crwarn");
  crEl.textContent=cr>0?`CR = ${cr.toFixed(3)} ${cr<0.1?"✓":"⚠"}`:"";
  renderWeightsDisplay("weights-display");
}

function syncReciprocal(i,j){
  const el=document.getElementById(`m${i}_${j}`);
  if(!el) return;
  ahpMatrix[i][j]=parseFloat(el.value)||1;
  ahpMatrix[j][i]=1/ahpMatrix[i][j];
  const rec=document.getElementById(`m${j}_${i}`);
  if(rec) rec.value=(ahpMatrix[j][i]).toFixed(2);
}

function renderCuts(){
  let html=`<div class="info-sm">Cada regra define um K máximo quando a condição é verificada. Altere o K máximo para cada situação clínica.</div>`;
  cutRules.forEach((r,idx)=>{
    html+=`<div class="cut-row">
      <span class="cut-label">${r.label}</span>
      <span style="font-size:11.5px;color:var(--text-3);white-space:nowrap;">K máx.</span>
      <select onchange="cutRules[${idx}].maxK=parseInt(this.value)">
        ${[0,1,2,3,4].map(k=>`<option value="${k}"${r.maxK===k?" selected":""}>K${k}</option>`).join("")}
      </select>
    </div>`;
  });
  document.getElementById("cuts-ui").innerHTML=html;
}

function saveCuts(){
  const el=document.getElementById("cuts-saved");
  el.style.display="inline";
  setTimeout(()=>el.style.display="none",2200);
}

function blockScore(blockIdx){
  const b=BLOCKS[blockIdx];
  let total=0,count=0;
  b.questions.forEach(q=>{if(answers[q.id]!==undefined){total+=answers[q.id];count++;}});
  return count>0?total/count:0;
}
function kScoreForCriterion(critIdx){ return (blockScore(critIdx)-1)/3; }

function applyHardCuts(rawK){
  let maxAllowed=4;
  cutRules.forEach(r=>{
    if(answers[r.qid]!==undefined){
      if(r.op==="eq"&&answers[r.qid]===r.val) maxAllowed=Math.min(maxAllowed,r.maxK);
      if(r.op==="lte"&&answers[r.qid]<=r.val) maxAllowed=Math.min(maxAllowed,r.maxK);
    }
  });
  return Math.min(rawK,maxAllowed);
}

function computeResult(){
  if(weights.length===0) computeAHPSilent();
  let ahpScore=0;
  BLOCKS.forEach((b,i)=>{
    const cidx=CRIT_IDS.indexOf(b.id);
    ahpScore+=kScoreForCriterion(i)*(weights[cidx]||0.2);
  });
  const rawK=Math.min(4,Math.round(ahpScore*4));
  const finalK=applyHardCuts(rawK);
  const activeCuts=[];
  cutRules.forEach(r=>{
    if(answers[r.qid]!==undefined&&r.op==="eq"&&answers[r.qid]===r.val&&r.maxK<rawK)
      activeCuts.push(r);
  });
  return{ahpScore,rawK,finalK,activeCuts};
}

function isBlockComplete(idx){
  return BLOCKS[idx].questions.every(q=>answers[q.id]!==undefined);
}

function renderProgress(){
  const total=BLOCKS.length;
  const isResult=currentBlock>=total;
  document.getElementById("prog").innerHTML=
    BLOCKS.map((_,i)=>`<div class="ps${(i<currentBlock||isResult)?" done":i===currentBlock?" active":""}"></div>`).join("")+
    `<div class="ps${isResult?" done":""}"></div>`;
  const totalQ=BLOCKS.reduce((a,b)=>a+b.questions.length,0);
  const doneQ=BLOCKS.slice(0,currentBlock).reduce((a,b)=>a+b.questions.length,0);
  document.getElementById("prog-block-label").textContent=isResult?"Avaliação concluída":`Bloco ${currentBlock+1} de ${total} — ${BLOCKS[currentBlock]?.title||""}`;
  document.getElementById("prog-item-label").textContent=isResult?"":`${doneQ} / ${totalQ} itens`;
}

function animateContent(html, dir='forward') {
  const content = document.getElementById('content');
  // exit
  content.classList.remove('block-enter');
  content.classList.add('block-exit');
  setTimeout(() => {
    content.classList.remove('block-exit');
    content.innerHTML = html;
    content.classList.add('block-enter');
  }, 180);
}

function renderBlock(){
  renderProgress();
  const b=BLOCKS[currentBlock];
  const widx=CRIT_IDS.indexOf(b.id);
  const w=weights.length>0?(weights[widx]*100).toFixed(0):"—";

  const html=`
    <div class="bh">
      <div class="bt">${b.title} <span class="w-pill">peso ${w}%</span></div>
    </div>
    ${b.questions.map(q=>`
      <div class="q">
        <label class="q-label">${q.text}</label>
        <div class="opts">
          ${q.opts.map(o=>`<button class="ob${answers[q.id]===o.v?" sel":""}" onclick="selectAns('${q.id}',${o.v},this)">${o.l}</button>`).join("")}
        </div>
      </div>`).join("")}
    <div class="nav">
      <button class="bn" onclick="prev()" ${currentBlock===0?"disabled":""}>← Anterior</button>
      <button class="bn pri" id="btn-next" onclick="next()" ${!isBlockComplete(currentBlock)?"disabled":""}>
        ${currentBlock===BLOCKS.length-1?"Ver resultado →":"Próximo →"}
      </button>
    </div>`;
  animateContent(html);
}

function selectAns(qid,val,btn){
  answers[qid]=val;
  btn.closest(".opts").querySelectorAll(".ob").forEach(b=>b.classList.remove("sel"));
  btn.classList.add("sel");
  document.getElementById("btn-next").disabled=!isBlockComplete(currentBlock);
  renderProgress();
}

function next(){
  if(!isBlockComplete(currentBlock)) return;
  if(currentBlock<BLOCKS.length-1){currentBlock++;renderBlock('forward');}
  else renderResult();
}

function prev(){if(currentBlock>0){currentBlock--;renderBlock('back');}}

function buildRadarSVG(scores, labels) {
  const cx = 130, cy = 130, R = 100, n = scores.length;
  const angle = i => (Math.PI * 2 * i / n) - Math.PI / 2;
  const pt = (r, i) => [
    cx + r * Math.cos(angle(i)),
    cy + r * Math.sin(angle(i))
  ];

  // grid rings
  let rings = '';
  [0.25, 0.5, 0.75, 1].forEach(frac => {
    const pts = Array.from({length:n}, (_,i) => pt(R*frac, i).join(',')).join(' ');
    rings += `<polygon points="${pts}" fill="none" stroke="rgba(79,102,200,.15)" stroke-width="1"/>`;
  });

  // axes
  let axes = '';
  for(let i=0;i<n;i++){
    const [x,y]=pt(R,i);
    axes += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(79,102,200,.18)" stroke-width="1"/>`;
  }

  // data polygon
  const dataPts = scores.map((s,i) => pt(R * Math.max(0.04, s), i).join(',')).join(' ');

  // labels
  let lbls = '';
  labels.forEach((lbl, i) => {
    const [x,y] = pt(R + 18, i);
    const anchor = x < cx - 5 ? 'end' : x > cx + 5 ? 'start' : 'middle';
    lbls += `<text x="${x.toFixed(1)}" y="${(y+4).toFixed(1)}" text-anchor="${anchor}" font-size="10" font-family="Inter,sans-serif" fill="#4A5280" font-weight="500">${lbl}</text>`;
  });

  // dots
  const dots = scores.map((s,i)=>{
    const [x,y]=pt(R*Math.max(0.04,s),i);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="#3B6EF6" stroke="#fff" stroke-width="1.5"/>`;
  }).join('');

  return `<svg width="260" height="260" viewBox="0 0 260 260">
    ${rings}${axes}
    <polygon points="${dataPts}" fill="rgba(59,110,246,.13)" stroke="#3B6EF6" stroke-width="2" stroke-linejoin="round"/>
    ${dots}${lbls}
  </svg>`;
}

function renderResult(){
  currentBlock=BLOCKS.length;
  renderProgress();
  const{ahpScore,rawK,finalK,activeCuts}=computeResult();
  const ki=K_INFO[finalK];
  const flags=[];
  if(rawK!==finalK) flags.push({cls:"fe",msg:`Score AHP indicava <strong>K${rawK}</strong>. Reduzido para <strong>K${finalK}</strong> por regra de corte: ${activeCuts.map(r=>r.label).join("; ")}.`});
  if(Math.abs(blockScore(0)-blockScore(3))>1.5) flags.push({cls:"fw",msg:"Discrepância entre capacidade física e estado psicológico — revisar antes de prescrever."});
  if(answers["motivacao"]===4&&finalK<=1) flags.push({cls:"fi",msg:"Motivação elevada com K baixo — potencial de progressão. Reavaliar após reabilitação inicial."});
  if(cr>=0.1) flags.push({cls:"fw",msg:`CR da matriz AHP = ${cr.toFixed(3)} > 0.10 — pesos inconsistentes. Recalibrar antes de uso real.`});

  // ── Alertas de segurança ──
  const safetyFlags = [];
  if(answers["quedas"]<=2) safetyFlags.push("Histórico de quedas relevante — avaliar programa de treino de equilíbrio pré-protésico.");
  if(answers["equilibrio"]<=2 && answers["motivacao"]>=3) safetyFlags.push("Equilíbrio comprometido com motivação elevada — risco de sobreestimar capacidade. Supervisão reforçada na fase inicial.");
  if(answers["cognicao"]<=2 && answers["apoio"]<=2) safetyFlags.push("Comprometimento cognitivo sem rede de suporte adequada — risco de uso inseguro da prótese sem supervisão.");
  if(answers["compliance_limitacoes"]<=2) safetyFlags.push("Padrão de incumprimento dos limites prescritos — incluir gestão de risco explícita no plano de reabilitação.");
  if(answers["vigilancia_coto"]<=2) safetyFlags.push("Auto-vigilância do coto insuficiente — formação específica em cuidados do coto obrigatória antes da prescrição.");
  if(answers["habitacao"]<=2 && answers["quedas"]<=2) safetyFlags.push("Ambiente doméstico com barreiras e histórico de quedas — avaliação domiciliária recomendada antes da alta.");
  if(answers["objetivo"]>=3 && answers["equilibrio"]<=2) safetyFlags.push("Objectivo funcional ambicioso face ao equilíbrio actual — ajustar expectativas e definir metas faseadas.");
  safetyFlags.forEach(msg => flags.push({cls:"fs",msg:"⚠ <strong>Segurança:</strong> "+msg}));

  const radarScores = BLOCKS.map((_,i) => kScoreForCriterion(i));
  const radarLabels = ["Cap. física","Segurança","Dados clin.","Psicológico","Contexto"];
  const radarSVG = buildRadarSVG(radarScores, radarLabels);

  const html = `
    <div class="card">
      <div class="k-hero">
        <div class="k-circle ${ki.cls}c">${ki.label}</div>
        <div class="k-hero-text">
          <div class="k-badge ${ki.cls}b">Classificação AHP híbrido</div>
          <div class="k-num" style="color:var(--${ki.cls})">${ki.label}</div>
          <div class="k-desc">${ki.desc}</div>
        </div>
      </div>
      <div class="div"></div>
      <div class="radar-wrap">${radarSVG}</div>
      <div class="div"></div>
      <div class="score-section-title">Score por critério</div>
      ${BLOCKS.map((b,i)=>{
        const cidx=CRIT_IDS.indexOf(b.id);
        const w=weights[cidx]||0.2;
        const s=kScoreForCriterion(i);
        return`<div class="srow">
          <div class="slbl">${b.title.split(" ").slice(0,2).join(" ")} <span class="w-pill">${(w*100).toFixed(0)}%</span></div>
          <div class="strk"><div class="sfil" style="width:${(s*100).toFixed(1)}%"></div></div>
          <div class="sval">${(s*100).toFixed(0)}%</div>
        </div>`;}).join("")}
      <div class="div"></div>
      <div class="cr-row">
        <span>Score AHP ponderado: <strong style="color:var(--text-1)">${(ahpScore*100).toFixed(1)}%</strong></span>
        <span class="crbadge ${cr<0.1?"crok":"crwarn"}">CR = ${cr.toFixed(3)} ${cr<0.1?"✓":"⚠"}</span>
      </div>
    </div>
    ${flags.map(f=>`<div class="flag ${f.cls}">${f.msg}</div>`).join("")}
    <div class="nav">
      <button class="bn" onclick="reset()">← Nova avaliação</button>
      <button class="bn pri" onclick="goToResult(${finalK},${ahpScore})">Ver relatório →</button>
    </div>`;
  // Save to sessionStorage for resultado.html
  const safetyFlagsData = [];
  if(answers["quedas"]<=2) safetyFlagsData.push("Histórico de quedas relevante.");
  if(answers["equilibrio"]<=2 && answers["motivacao"]>=3) safetyFlagsData.push("Equilíbrio comprometido com motivação elevada.");
  if(answers["cognicao"]<=2 && answers["apoio"]<=2) safetyFlagsData.push("Comprometimento cognitivo sem suporte adequado.");
  if(answers["compliance_limitacoes"]<=2) safetyFlagsData.push("Incumprimento dos limites prescritos.");
  if(answers["vigilancia_coto"]<=2) safetyFlagsData.push("Auto-vigilância do coto insuficiente.");
  if(answers["habitacao"]<=2 && answers["quedas"]<=2) safetyFlagsData.push("Ambiente com barreiras + quedas.");
  if(answers["objetivo"]>=3 && answers["equilibrio"]<=2) safetyFlagsData.push("Objectivo ambicioso face ao equilíbrio actual.");

  const nivelLabels={4:"Transtibial",3:"Desarticulação do joelho",2:"Transfemoral",1:"Hemipelvectomia"};
  sessionStorage.setItem("ahpResultado", JSON.stringify({
    finalK, rawK, ahpScore,
    cr: cr.toFixed(3),
    crOk: cr < 0.1,
    kDesc: ki.desc,
    kLabel: ki.label,
    nivel_amp: answers["nivel_amp"]||4,
    nivelLabel: nivelLabels[answers["nivel_amp"]||4],
    scores: BLOCKS.map((_,i)=>({
      title: BLOCKS[i].title,
      score: kScoreForCriterion(i),
      weight: weights[CRIT_IDS.indexOf(BLOCKS[i].id)]||0.2
    })),
    answers: {...answers},
    flags: flags.map(f=>f.msg),
    safetyFlags: safetyFlagsData,
    activeCuts: activeCuts.map(r=>r.label),
    data: new Date().toLocaleDateString("pt-PT",{day:"2-digit",month:"long",year:"numeric"})
  }));

  // ── Guardar no Firestore se houver paciente seleccionado ──
  const dadosFirestore = {
    finalK, rawK, ahpScore,
    cr: cr.toFixed(3), crOk: cr < 0.1,
    kDesc: ki.desc, kLabel: ki.label,
    nivel_amp: answers["nivel_amp"]||4,
    nivelLabel: nivelLabels[answers["nivel_amp"]||4],
    scores: BLOCKS.map((_,i)=>({
      title: BLOCKS[i].title,
      score: kScoreForCriterion(i),
      weight: weights[CRIT_IDS.indexOf(BLOCKS[i].id)]||0.2
    })),
    answers: {...answers},
    safetyFlags: safetyFlagsData,
    activeCuts: activeCuts.map(r=>r.label)
  };
  if (typeof window._firebaseSaveAvaliacao === 'function') {
    window._firebaseSaveAvaliacao(dadosFirestore);
  }

  animateContent(html);
}

function goToResult(finalK, ahpScore) {
  renderPrescQuestions(finalK);
}

// ── Guardar prescrição no Firestore e ir para resultado ──
function guardarEVerRelatorio() {
  const btn = document.getElementById("btn-guardar");
  if (btn) { btn.disabled = true; btn.textContent = "A guardar..."; }

  const existing = JSON.parse(sessionStorage.getItem("ahpResultado") || "{}");

  if (typeof window._firebaseSaveAvaliacao === 'function') {
    window._firebaseSaveAvaliacao(existing).then(() => {
      window.location.href = "resultado.html";
    }).catch(() => {
      // Even if Firestore fails, go to resultado (sessionStorage still works)
      window.location.href = "resultado.html";
    });
  } else {
    window.location.href = "resultado.html";
  }
}

function savePrescAndGoReport() { guardarEVerRelatorio(); }

function reset(){currentBlock=0;answers={};prescAnswers={};phase='assessment';renderBlock('forward');}

computeAHPSilent();
const content=document.getElementById('content');
content.classList.add('block-enter');
renderBlock();
