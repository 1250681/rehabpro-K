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

// ── Database helpers ──
// Reads component database from localStorage (managed by admin.html)
const DB_KEY = 'rehabpro_components';

function getDB() {
  try {
    const saved = localStorage.getItem(DB_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch(e) { return null; }
}

// Get best matching components from DB for a given context
// Returns {ossur: string, ottobock: string, cat: string, notas: []}
function dbGetComponent(tipo, klevel, nivel_amp_str, preferSecure) {
  const db = getDB();
  if (!db) return null;

  const nivelMap = {4:'TT', 3:'DK', 2:'TF', 1:'HP'};
  const nivelStr = nivelMap[nivel_amp_str] || 'TT';

  // K-Level priority order (try exact match first, then adjacent)
  const kPriority = {
    'K0':['K0'],
    'K1':['K1','K1-K2'],
    'K2':['K2','K1-K2','K2-K3'],
    'K3':preferSecure?['K2-K3','K3']:['K3','K2-K3','K3-K4'],
    'K4':['K4','K3-K4']
  };
  const kLevels = kPriority['K'+klevel] || ['K'+klevel];

  // Filter active components of the right type and nivel
  const pool = db.filter(c =>
    c.activo &&
    c.tipo === tipo &&
    (c.nivel === 'todos' || c.nivel === nivelStr || c.nivel === 'TT' && nivelStr === 'TT')
  );

  if (pool.length === 0) return null;

  // Find best K-level match
  let match = null;
  for (const kl of kLevels) {
    match = pool.find(c => c.klevel === kl);
    if (match) break;
  }
  if (!match) match = pool[0];

  // If secure profile, prefer microprocessor options
  let secureMatch = null;
  if (preferSecure) {
    secureMatch = pool.find(c =>
      (c.nome.toLowerCase().includes('proprio') ||
       c.nome.toLowerCase().includes('meridium') ||
       c.nome.toLowerCase().includes('navii') ||
       c.nome.toLowerCase().includes('kenevo')) &&
      kLevels.some(kl => c.klevel === kl || c.klevel.includes(kl.replace('K','')))
    );
  }
  const chosen = secureMatch || match;

  // Get partner brand
  const brand = chosen.marca;
  const other = brand === 'Össur' ? 'Ottobock' : 'Össur';
  const partner = pool.find(c =>
    c.marca === other &&
    kLevels.some(kl => c.klevel === kl || c.klevel === chosen.klevel)
  );

  const ossur    = brand === 'Össur' ? chosen.nome + (chosen.ref !== '—' ? ' ('+chosen.ref+')' : '') : (partner ? partner.nome + (partner.ref !== '—' ? ' ('+partner.ref+')' : '') : '—');
  const ottobock = brand === 'Ottobock' ? chosen.nome + (chosen.ref !== '—' ? ' ('+chosen.ref+')' : '') : (partner ? partner.nome + (partner.ref !== '—' ? ' ('+partner.ref+')' : '') : '—');

  return {
    cat: chosen.cat,
    ossur,
    ottobock,
    notas: chosen.notas ? [chosen.notas] : []
  };
}

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
// Usa base de dados localStorage (admin.html) se disponível; fallback para valores hardcoded
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

  // ── K0 ──
  if (finalK === 0) {
    out.notas.push("K0 — Prótese não indicada neste momento. O perfil funcional actual não suporta deambulação protésica. Foco recomendado em mobilidade em cadeira de rodas, transferências e reabilitação física preparatória. Reavaliar após programa de fortalecimento e estabilização do coto.");
    return out;
  }

  // ── HEMIPELVECTOMIA ──
  if (isHP) {
    out.notas.push("Hemipelvectomia / desarticulação da anca: prescrição altamente individualizada. Este instrumento fornece orientação geral — avaliação por equipa especializada obrigatória.");
    out.pe = dbGetComponent('pe', finalK, nivel_amp, false) || { cat:"Pé dinâmico leve / baixo perfil", ossur:"Vari-Flex (baixo perfil)", ottobock:"Taleo LP (1C53)" };
    out.joelho = dbGetComponent('joelho', finalK, nivel_amp, false) || { cat:"Joelho policêntrico com controlo de fase", ossur:"Total Knee 2000", ottobock:"3R60 EBS policêntrico" };
    out.suspensao = { cat:"Sistema de arnês total", ossur:"—", ottobock:"Arnês pélvico integrado (customizado)" };
    return out;
  }

  // ── PÉ ──
  const dbPe = dbGetComponent('pe', finalK, nivel_amp, segCompr);
  if (dbPe) {
    out.pe = dbPe;
    if (segCompr && finalK >= 2) {
      out.notas.push("Perfil de segurança comprometido: pé microprocessado adaptativo recomendado — adapta o ângulo do tornozelo ao terreno em tempo real, reduzindo risco de queda.");
    }
    if (finalK === 4 && altaAtiv) {
      out.notas.push("K4 desportivo: lâmina de corrida para uso desportivo específico. Para uso quotidiano intenso combinar com pé ESAR de alto desempenho.");
    }
  } else {
    // Fallback hardcoded
    if (finalK === 1) out.pe = {cat:"Pé básico multi-axial passivo",ossur:"Vari-Flex (baixo impacto)",ottobock:"Terion™ K2 (1C11) / SACH+™ (1S101)"};
    else if (finalK === 2) out.pe = {cat:"Pé ESAR baixo impacto",ossur:"Vari-Flex® / Pro-Flex® Pivot",ottobock:"Kintrol (VS4) / Restore (VS5)"};
    else if (finalK === 3) out.pe = altaAtiv ? {cat:"Pé ESAR alto desempenho",ossur:"Pro-Flex® XC / Pro-Flex® Terra",ottobock:"Taleo Adapt (1C59)"} : {cat:"Pé ESAR optimizado",ossur:"Pro-Flex® ST / LP",ottobock:"Taleo Harmony (1C52)"};
    else out.pe = altaAtiv ? {cat:"Lâmina de carbono desportiva",ossur:"Cheetah® Xpanse",ottobock:"Springlite Sprinter (1E90)"} : {cat:"Pé ESAR alta performance com torsão",ossur:"Pro-Flex® XC Torsion",ottobock:"Triton® HD (1C64)"};
  }

  // ── JOELHO ──
  if (isTF || isDK) {
    const dbJo = dbGetComponent('joelho', finalK, nivel_amp, segCompr);
    if (dbJo) {
      out.joelho = dbJo;
      if (isDK) out.notas.push("Desarticulação do joelho: côndilo femoral preservado permite suspensão condiliana. Espaço distal limita selecção — policêntrico de 4 eixos frequentemente a única opção viável.");
      if (finalK === 2 && segCompr) out.notas.push("K2 com segurança comprometida: MPK com stumble recovery e configuração progressiva por modos de actividade recomendado.");
      if (finalK === 4) out.notas.push("K4 transfemoral: C-Leg (Ottobock) é o MPK de referência com >100.000 fittings. Genium X3/X4 para utilizadores de muito alta actividade com modo corrida.");
    } else {
      // Fallback
      if (finalK <= 1) out.joelho={cat:"Joelho com bloqueio manual",ossur:"Locking Knee LKN",ottobock:"3R41"};
      else if (finalK === 2) out.joelho=segCompr?{cat:"MPK para baixa mobilidade",ossur:"Navii®",ottobock:"Kenevo"}:{cat:"Joelho policêntrico básico",ossur:"Total Knee® 1900",ottobock:"3R106-PRO"};
      else if (finalK === 3) out.joelho=altaAtiv?{cat:"Joelho hidráulico rotativo",ossur:"Mauch® Knee Plus",ottobock:"3R80"}:{cat:"Joelho policêntrico hidráulico",ossur:"Total Knee® 2000",ottobock:"3R60 EBS"};
      else out.joelho={cat:"MPK alta performance",ossur:"Rheo Knee® XC",ottobock:"C-Leg® / Genium X4"};
    }
  }

  // ── SUSPENSÃO ──
  let suspKey = '';
  if (isTT) {
    if (cotoRecente) suspKey = 'provisorio_tt';
    else if (telidoFragil) suspKey = 'pin_tt';
    else if (cicatriz) suspKey = cogOk ? 'sealin_tt' : 'pin_tt';
    else if (cogOk && altaAtiv && cotoMaduro) suspKey = 'vacuum_tt';
    else if (cogOk && cotoMaduro) suspKey = 'sealin_tt';
    else suspKey = 'pin_tt';
  } else if (isTF) {
    if (cotoRecente || telidoFragil) suspKey = 'cinto_tf';
    else if (cogOk && cotoMaduro && altaAtiv) suspKey = 'vacuum_tf';
    else if (cogOk && cotoMaduro) suspKey = 'sealin_tf';
    else suspKey = 'cinto_tf';
  } else if (isDK) {
    suspKey = 'dk';
  }

  const dbSusp = dbGetComponent('suspensao', finalK, nivel_amp, false);

  // Suspensão usa DB mas com lógica clínica de selecção
  const suspMap = {
    'provisorio_tt': {cat:"Socket provisório — vácuo contra-indicado em coto recente",ossur:"Iceross® liner básico + PTB provisório",ottobock:"Socket preparatório + correa supracondiliana"},
    'pin_tt':        {cat:"Pin lock — distribuição uniforme de pressão, facilidade de uso",ossur:"Iceross® Dermo Locking / Iceross® Synergy Locking + Icelock",ottobock:"Liner silicone + sistema de pin lock"},
    'sealin_tt':     {cat:"Seal-In — sucção por membranas, bom controlo rotacional",ossur:"Iceross Seal-In® X5 / Iceross Dermo Seal-In®",ottobock:"Liner silicone + Harmony P2 (vácuo passivo)"},
    'vacuum_tt':     {cat:"Elevated Vacuum — máximo controlo, mínimo pistoning",ossur:"Iceross Seal-In® X + Unity® System",ottobock:"Harmony P4 HD / E-Pulse (vácuo activo)"},
    'cinto_tf':      {cat:"Cinto Silesian — tolerante à variação volumétrica",ossur:"Iceross® TF liner + cinto Silesian",ottobock:"Socket preparatório + cinto Silesian"},
    'sealin_tf':     {cat:"Seal-In TF — sucção por membranas transfemoral",ossur:"Iceross Seal-In® X TF / Connect® TF",ottobock:"Liner TF sucção directa + cinto auxiliar"},
    'vacuum_tf':     {cat:"Elevated Vacuum TF — gold standard alta actividade",ossur:"Iceross Seal-In® X TF + Unity® TF",ottobock:"Harmony P4 HD TF / E-Pulse TF"},
    'dk':            {cat:"Suspensão condiliana — expansão do liner sobre côndilos femorais",ossur:"Iceross® Seal-In DK",ottobock:"Liner condiliano 3R62 KD compatível"}
  };

  out.suspensao = suspMap[suspKey] || dbSusp || suspMap['pin_tt'];

  // Notas de suspensão
  if (cotoRecente) out.notas.push("Coto recente: vácuo e Seal-In contra-indicados — volume instável impede vedação. Reavaliar em 3–6 meses.");
  if (telidoFragil) out.notas.push("Pele frágil / atrófica: vácuo elevado contra-indicado — gradiente de pressão aumenta risco de úlcera. Pin lock recomendado.");
  if (cicatriz) out.notas.push("Cicatriz aderente: inspecção diária das zonas de pressão. Suspender se rubor persistente > 20 min após remoção.");
  if (suspKey === 'vacuum_tt') out.notas.push("Unity System (Össur): compatível com Pro-Flex XC, Pro-Flex Terra, Proprio Foot e Vari-Flex. Se pé prescrito for Ottobock, usar Harmony P4 HD.");
  if (isTF && cogOk && cotoMaduro && altaAtiv) out.notas.push("Sleeve suction TF é problemático — limita flexão do joelho. Elevated Vacuum é o gold standard para TF activo.");

  return out;
}
  const isTT  = nivel_amp === 4;
  const isDK  = nivel_amp === 3;
  const isTF  = nivel_amp === 2;
  const isHP  = nivel_amp === 1;
  const cotoRecente  = maturidade === 1;
  const cotoMaduro   = maturidade === 3;
  const telidoFragil = tecido === 1;
  const cicatriz     = tecido === 2;


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
      <button class="bn pri" onclick="window.location.href='resultado.html'">Ver relatório PDF →</button>
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
  animateContent(html);
}

function goToResult(finalK, ahpScore) {
  renderPrescQuestions(finalK);
}

function reset(){currentBlock=0;answers={};prescAnswers={};phase='assessment';renderBlock('forward');}

computeAHPSilent();
const content=document.getElementById('content');
content.classList.add('block-enter');
renderBlock();
