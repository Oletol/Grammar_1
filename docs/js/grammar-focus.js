// Grammar of the week in translations.
// The student's translation is compared with the model translation(s) from the answer key:
//  1) tense forms: which tenses the verbs are in (Present Perfect, Past Indefinite, …);
//  2) nouns with a fixed number: news, advice, money … (singular only), police, cattle, glasses … (plural only).
// It runs in the teacher's browser together with the LanguageTool check; the model answers never reach students,
// students only see the names of the tenses and their own words.

// ------------------------------------------------------------------ word lists
// base V2 V3 (one form when V2 = V3)
const IRR = `arise arose arisen|awake awoke awoken|be was,were been|bear bore born,borne|beat beat beaten|become became become|
begin began begun|bend bent|bet bet|bind bound|bite bit bitten|bleed bled|blow blew blown|break broke broken|breed bred|
bring brought|broadcast broadcast|build built|burn burnt,burned|burst burst|buy bought|catch caught|choose chose chosen|
cling clung|come came come|cost cost|creep crept|cut cut|deal dealt|dig dug|do did done|draw drew drawn|dream dreamt,dreamed|
drink drank drunk|drive drove driven|eat ate eaten|fall fell fallen|feed fed|feel felt|fight fought|find found|flee fled|
fly flew flown|forbid forbade forbidden|forget forgot forgotten|forgive forgave forgiven|freeze froze frozen|get got got,gotten|
give gave given|go went gone|grind ground|grow grew grown|hang hung,hanged|have had|hear heard|hide hid hidden|hit hit|
hold held|hurt hurt|keep kept|kneel knelt|know knew known|lay laid|lead led|lean leant,leaned|leap leapt,leaped|
learn learnt,learned|leave left|lend lent|let let|lie lay lain|light lit|lose lost|make made|mean meant|meet met|
mistake mistook mistaken|overcome overcame overcome|pay paid|prove proved proven,proved|put put|quit quit|read read|
ride rode ridden|ring rang rung|rise rose risen|run ran run|say said|see saw seen|seek sought|sell sold|send sent|set set|
sew sewed sewn|shake shook shaken|shine shone|shoot shot|show showed shown|shrink shrank shrunk|shut shut|sing sang sung|
sink sank sunk|sit sat|sleep slept|slide slid|smell smelt,smelled|speak spoke spoken|speed sped|spell spelt,spelled|
spend spent|spill spilt,spilled|spin spun|spit spat|split split|spoil spoilt,spoiled|spread spread|spring sprang sprung|
stand stood|steal stole stolen|stick stuck|sting stung|stink stank stunk|strike struck|strive strove striven|swear swore sworn|
sweep swept|swell swelled swollen|swim swam swum|swing swung|take took taken|teach taught|tear tore torn|tell told|
think thought|throw threw thrown|understand understood|undertake undertook undertaken|upset upset|wake woke woken|
wear wore worn|weep wept|win won|wind wound|withdraw withdrew withdrawn|write wrote written|rebuild rebuilt|
rewrite rewrote rewritten|misunderstand misunderstood|overhear overheard|oversleep overslept|foresee foresaw foreseen`;
const V2 = new Set(), V3 = new Set(), BASE = new Set();
for (const g of IRR.replace(/\n/g, "").split("|")) {
  const [b, p2, p3] = g.trim().split(" ");
  BASE.add(b);
  p2.split(",").forEach((x) => V2.add(x));
  (p3 || p2).split(",").forEach((x) => V3.add(x));
}
const NOT_ED = new Set("need bed red shed speed seed feed bleed breed hundred sacred naked wicked kindred indeed wed fed led bred fled sled reed weed greed creed deed heed steed wood good bored tired interested married excited pleased worried surprised scared retired talented ".trim().split(/\s+/));
// words in -ed that are mostly adjectives: after be they are not passives
const ADJ_ED = new Set("bored tired interested married excited pleased worried surprised scared retired talented ashamed amazed annoyed crowded delighted depressed disappointed embarrassed exhausted frightened satisfied shocked used covered".split(" "));
const NOT_ING = new Set("thing something nothing anything everything morning evening king ring string spring sing bring during ceiling sibling darling pudding lightning stocking clothing awning".split(" "));
const ADJ_ING = new Set("interesting boring amazing exciting charming surprising willing outstanding annoying confusing disappointing embarrassing frightening shocking tiring worrying".split(" "));
// words that may stand between an auxiliary and the main verb
const ADV = new Set("not never ever just already always only all also still recently lately really often seldom rarely hardly finally both even probably certainly first last usually sometimes now long once simply actually definitely nearly almost completely suddenly constantly".split(" "));
const STOP = new Set(", . ? ! ; : – — \" to and but or that because since when if as while so then".split(" "));
const PRON = new Set("i you he she it we they there this that these those who what which somebody someone nobody everybody everyone anyone anybody one".split(" "));
const MODAL = new Set("can could may might must should ought".split(" "));

export const TENSE_NAMES = {
  PrI: "Present Indefinite", PrC: "Present Continuous", PrP: "Present Perfect", PrPC: "Present Perfect Continuous",
  PaI: "Past Indefinite", PaC: "Past Continuous", PaP: "Past Perfect", PaPC: "Past Perfect Continuous",
  FuI: "Future Indefinite", FuC: "Future Continuous", FuP: "Future Perfect", FuPC: "Future Perfect Continuous",
  UT: "used to + infinitive", WD: "would + infinitive",
};
// tenses the check compares (Present Indefinite of lexical verbs cannot be recognised reliably, so it is compared only through be / do)
const COMPARED = ["PrC", "PrP", "PrPC", "PaI", "PaC", "PaP", "PaPC", "FuI", "FuC", "FuP", "FuPC", "UT", "WD"];

const isV3 = (w) => V3.has(w) || (/^[a-z]{3,}ed$/.test(w) && !NOT_ED.has(w)) || ADJ_ED.has(w);
const isV2 = (w) => V2.has(w) || (/^[a-z]{3,}ed$/.test(w) && !NOT_ED.has(w) && !ADJ_ED.has(w));
const isIng = (w) => /^[a-z]{2,}ing$/.test(w) && !NOT_ING.has(w);

// ------------------------------------------------------------------ tokens
export function tokenize(text) {
  let t = ` ${String(text || "")} `.replace(/[’‘`´]/g, "'").replace(/[“”«»]/g, '"').toLowerCase();
  t = t.replace(/\bwon't\b/g, "will not").replace(/\bshan't\b/g, "shall not").replace(/\bcan't\b/g, "can not")
    .replace(/\bain't\b/g, "is not").replace(/n't\b/g, " not").replace(/'ve\b/g, " have").replace(/'re\b/g, " are")
    .replace(/'m\b/g, " am").replace(/'ll\b/g, " will").replace(/'d\b/g, " 'd").replace(/'s\b/g, " 's").replace(/s'(?=\s)/g, "s");
  const raw = t.match(/'d|'s|[a-z]+(?:-[a-z]+)*|[.,?!;:"–—-]/g) || [];
  // resolve 's (is / has / possessive) and 'd (had / would)
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    let w = raw[i];
    if (w === "'s" || w === "'d") {
      let j = i + 1; while (j < raw.length && ADV.has(raw[j])) j++;
      const nx = raw[j] || "";
      const perfect = nx === "been" || (isV3(nx) && !ADJ_ED.has(nx));
      if (w === "'d") w = perfect ? "had" : "would";
      else if (perfect && (nx === "been" || !V2.has(nx) || V3.has(nx))) w = "has";
      else if (PRON.has(out[out.length - 1]) || /^(here|where|how|everything|nothing|something|what|who|that|there)$/.test(out[out.length - 1] || "")) w = "is";
      else continue;                                                                        // possessive: Peter's, Christie's
    }
    out.push(w === "-" ? "–" : w);
  }
  return out;
}

// ------------------------------------------------------------------ verb forms
// Returns [{tense, words, passive}] for every finite verb group that can be recognised.
export function verbForms(text) {
  const w = tokenize(text);
  const forms = [];
  const used = new Set();
  // find the next verb word after position i, skipping adverbs and (in questions) the subject
  const next = (i, maxSkip = 4) => {
    let j = i + 1, skipped = 0;
    while (j < w.length && skipped <= maxSkip) {
      const x = w[j];
      if (STOP.has(x) && x !== "–") return -1;
      if (ADV.has(x)) { j++; continue; }
      if (isV3(x) || isIng(x) || x === "been" || x === "be" || x === "have" || x === "being" || BASE.has(x)) return j;
      if (/^(am|is|are|was|were|has|had|do|does|did|will|would|shall)$/.test(x) || MODAL.has(x)) return -1;
      j++; skipped++;
    }
    return -1;
  };
  const add = (tense, from, to, passive = false) => {
    for (let k = from; k <= to; k++) used.add(k);
    forms.push({ tense, words: w.slice(from, to + 1).filter((x) => x !== "–").join(" "), passive, at: from });
  };
  for (let i = 0; i < w.length; i++) {
    if (used.has(i)) continue;
    const x = w[i];
    if (x === "have" || x === "has" || x === "had") {
      // "have to", "had better", "have a …" are not perfect forms
      const j = next(i);
      const pres = x !== "had";
      if (j > 0 && w[j] === "been") {
        const k = next(j, 0);
        if (k > 0 && isIng(w[k]) && !ADJ_ING.has(w[k])) { add(pres ? "PrPC" : "PaPC", i, k); i = k; continue; }
        if (k > 0 && isV3(w[k]) && !ADJ_ED.has(w[k])) { add(pres ? "PrP" : "PaP", i, k, true); i = k; continue; }
        add(pres ? "PrP" : "PaP", i, j); i = j; continue;
      }
      if (j > 0 && isV3(w[j]) && !(w[j] === "have")) { add(pres ? "PrP" : "PaP", i, j); i = j; continue; }
      // main verb have: "I have a headache", "she had a baby"
      if (w[i + 1] === "to") continue;                                    // have to = modal meaning, left out
      if (!pres) add("PaI", i, i);
      continue;
    }
    if (x === "will" || x === "shall") {
      const j = next(i);
      if (j < 0) continue;
      if (w[j] === "have") {
        const k = next(j, 0);
        if (k > 0 && w[k] === "been") { const m = next(k, 0); if (m > 0 && isIng(w[m])) { add("FuPC", i, m); i = m; continue; } add("FuP", i, k); i = k; continue; }
        if (k > 0 && isV3(w[k])) { add("FuP", i, k); i = k; continue; }
      }
      if (w[j] === "be") { const k = next(j, 0); if (k > 0 && isIng(w[k]) && !ADJ_ING.has(w[k])) { add("FuC", i, k); i = k; continue; } add("FuI", i, j, k > 0 && isV3(w[k])); i = j; continue; }
      add("FuI", i, j); i = j; continue;
    }
    if (x === "would") {
      const j = next(i);
      if (j > 0 && w[j] !== "have") { add("WD", i, j); i = j; }
      continue;
    }
    if (x === "used" && w[i + 1] === "to" && w[i + 2] && (BASE.has(w[i + 2]) || /^[a-z]+$/.test(w[i + 2])) && !isIng(w[i + 2])) {
      // used to + infinitive (not "be used to + -ing", not "get used to")
      const prev = w[i - 1] || "";
      if (!/^(be|am|is|are|was|were|been|get|got|getting|become|became)$/.test(prev)) { add("UT", i, i + 2); i += 2; continue; }
    }
    if (/^(am|is|are|was|were)$/.test(x)) {
      const pres = /^(am|is|are)$/.test(x);
      const j = next(i, 5);
      if (j > 0 && w[j] === "being") { const k = next(j, 0); add(pres ? "PrC" : "PaC", i, k > 0 ? k : j, true); i = k > 0 ? k : j; continue; }
      if (j > 0 && isIng(w[j]) && !ADJ_ING.has(w[j])) {
        if (w[j] === "going" && w[j + 1] === "to") { add(pres ? "PrI" : "PaI", i, j + 1); i = j + 1; continue; }   // be going to
        add(pres ? "PrC" : "PaC", i, j); i = j; continue;
      }
      if (j > 0 && isV3(w[j]) && !ADJ_ED.has(w[j])) { add(pres ? "PrI" : "PaI", i, j, true); i = j; continue; }
      add(pres ? "PrI" : "PaI", i, i); continue;
    }
    if (x === "do" || x === "does" || x === "did") {
      // "did it all themselves", "do it", "did so": do is the main verb
      if (/^(it|them|this|that|so|me|him|us)$/.test(w[i + 1] || "") && (!w[i + 2] || STOP.has(w[i + 2]) || /^(all|again|yourself|myself|himself|herself|themselves|ourselves|yourselves|together|now|today|yesterday|well|badly)$/.test(w[i + 2]))) { add(x === "did" ? "PaI" : "PrI", i, i); continue; }
      let j = i + 1;
      while (j < w.length && j <= i + 5 && (ADV.has(w[j]) || PRON.has(w[j]) || DETS.test(w[j]))) j++;
      if (j < w.length && /^[a-z]+$/.test(w[j]) && !STOP.has(w[j]) && !/^(so|too)$/.test(w[j])) { add(x === "did" ? "PaI" : "PrI", i, j); i = j; continue; }
      add(x === "did" ? "PaI" : "PrI", i, i);                            // "Mum did.", "didn't it?"
      continue;
    }
    if (MODAL.has(x)) { const j = next(i); if (j > 0) { for (let k = i; k <= j; k++) used.add(k); i = j; } continue; }
    // ellipsis after "and": "have only just arrived and (have) only seen"
    {
      let j = i - 1; while (j >= 0 && ADV.has(w[j])) j--;
      const last = forms[forms.length - 1];
      if (isV3(x) && /^(and|or|but)$/.test(w[j] || "") && last && /^(PrP|PaP|FuP)$/.test(last.tense) && !ADJ_ED.has(x)) { add(last.tense, i, i); continue; }
    }
    // lexical verb in the past: "went", "happened" (not after a determiner: "the stolen car", "a washed shirt")
    const prev = w[i - 1] || "";
    if (isV2(x) && !V3.has(x) || (isV2(x) && V3.has(x) && V2.has(x))) {
      if (/^(the|a|an|this|that|these|those|my|your|his|her|its|our|their|very|so|too|more|most|less|get|got|be|been|being|feel|felt|seem|seemed|look|looked|become|became)$/.test(prev)) continue;
      if (ADJ_ED.has(x)) continue;
      // ellipsis after "and": "have only just arrived and have only seen" / "and only seen"
      const last = forms[forms.length - 1];
      if (V3.has(x) && !V2.has(x) && last && /and|or|but/.test(prev + " " + (w[i - 2] || ""))) { add(last.tense, i, i); continue; }
      if (V3.has(x) && !V2.has(x)) continue;                             // "seen", "written" alone: no finite verb
      if (/ed$/.test(x) && last && (last.tense === "PrP" || last.tense === "PaP") && /^(and|or)$/.test(prev)) { add(last.tense, i, i); continue; }
      add("PaI", i, i);
    }
  }
  return forms;
}

// ------------------------------------------------------------------ model translations with alternatives
// "has run (has been running)", "He has been working (has worked)", "A. / B." become several variants.
export function modelVariants(key) {
  const list = (Array.isArray(key) ? key : [key]).filter(Boolean).map(String);
  const out = new Set();
  const norm = (x) => x.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z']/g, "");
  for (const k of list) {
    for (const v of k.split(/\s+\/\s+/)) {
      out.add(v.replace(/\s*\([^)]*\)/g, " ").replace(/\s+/g, " ").trim());
      // the words in brackets replace words before them:
      //  "has run (has been running)" from the same first word; "he left (had left)" the same last word; otherwise as many words
      let rest = v, alt = "";
      for (let m; (m = rest.match(/\(([^)]*)\)/)); ) {
        const before = rest.slice(0, m.index).trim().split(/\s+/).filter(Boolean);
        const inside = m[1].trim().split(/\s+/);
        let from = -1;
        for (let j = before.length - 1; j >= Math.max(0, before.length - 4); j--) if (norm(before[j]) === norm(inside[0])) { from = j; break; }
        if (from < 0 && norm(before[before.length - 1] || "") === norm(inside[inside.length - 1])) from = before.length - 1;
        if (from < 0) from = Math.max(0, before.length - inside.length);
        alt += [...before.slice(0, from), ...inside].join(" ") + " ";
        rest = rest.slice(m.index + m[0].length);
      }
      out.add((alt + rest).replace(/\s+/g, " ").trim());
    }
  }
  return [...out].filter(Boolean);
}

// ------------------------------------------------------------------ nouns with a fixed number
const SG_ONLY = "hair news advice information knowledge progress luggage baggage furniture money weather equipment homework evidence fun traffic scenery accommodation machinery jewellery jewelry garbage rubbish permission behaviour behavior applause mathematics physics phonetics linguistics economics measles mumps diabetes".split(" ");
const PL_ONLY = "police cattle people glasses spectacles scissors trousers jeans clothes goods riches outskirts premises contents thanks congratulations binoculars pyjamas pajamas shorts tongs pliers earnings surroundings belongings valuables poultry".split(" ");
const SG_VERB = /^(is|was|has|does)$/, PL_VERB = /^(are|were|have|do)$/;
const DETS = /^(the|this|that|these|those|my|your|his|her|its|our|their|all|some|any|much|many|no|such|a|an|every|each)$/;

const SG_FOR = { are: "is", were: "was", have: "has", do: "does" };
const PL_FOR = { is: "are", was: "were", has: "have", does: "do" };

export function nounNotes(text) {
  const w = tokenize(text);
  const notes = [];
  const seen = new Set();
  const note = (k, msg) => { if (!seen.has(k)) { seen.add(k); notes.push(msg); } };
  // the verb after the noun: skip up to 4 words of a phrase ("of English", "in this room", "all", "already")
  const verbAfter = (i) => {
    for (let j = i + 1; j < w.length && j <= i + 5; j++) {
      const x = w[j];
      if (SG_VERB.test(x) || PL_VERB.test(x)) {
        // "do" / "have" count only as auxiliaries: "the news have reached", not "the people have a car"
        if (/^(have|has)$/.test(x) && !(w[j + 1] && (isV3(w[j + 1]) || w[j + 1] === "been" || ADV.has(w[j + 1])))) return null;
        if (/^(do|does)$/.test(x) && w[j + 1] !== "not") return null;
        return x;
      }
      if (STOP.has(x) || /^(who|which|that|where|when)$/.test(x)) return null;
    }
    return null;
  };
  for (let i = 0; i < w.length; i++) {
    const x = w[i], prev = w[i - 1] || "", prev2 = w[i - 2] || "";
    // advices, informations, furnitures
    for (const n of SG_ONLY) if (!/s$/.test(n) && n !== "hair" && (x === n + "s" || x === n + "es")) note(n + "pl", `“${n}” is uncountable: it has no plural form (not “${x}”).`);
    if (SG_ONLY.includes(x)) {
      for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
        const y = w[j];
        if (/^(a|an)$/.test(y)) { note(x + "a", `“${x}” is uncountable: no “${y}” before it${x === "weather" || x === "news" ? "" : ` (say “some ${x}” or “a piece of ${x}”)`}.`); break; }
        if (y === "of" || STOP.has(y) || SG_VERB.test(y) || PL_VERB.test(y) || DETS.test(y)) break;
      }
      if (/^(these|those|many|few|several)$/.test(prev)) note(x + "det", `“${x}” is singular: not “${prev} ${x}” (use “this”, “that”, “much”, “little”).`);
      const v = verbAfter(i);
      if (v && PL_VERB.test(v)) note(x + "v", `“${x}” takes a singular verb: “${x} … ${SG_FOR[v]}”, not “${v}”.`);
      const q = PL_VERB.test(prev) ? prev : DETS.test(prev) && PL_VERB.test(prev2) ? prev2 : "";
      if (q && /^(are|were)$/.test(q)) note(x + "v", `“${x}” takes a singular verb: “${SG_FOR[q]} … ${x}”, not “${q}”.`);
      const after = w.slice(i + 1), t = after.indexOf("them");
      if (t >= 0 && !after.slice(0, t).some((y) => /[^s]s$/.test(y) && y.length > 3 && !SG_ONLY.includes(y))) note(x + "them", `“${x}” is singular: refer to it with “it”, not “them”.`);
    }
    if (PL_ONLY.includes(x)) {
      if (/^(a|an)$/.test(prev) && x !== "people") note(x + "a", `“${x}” is plural: no “${prev}” before it${/^(glasses|spectacles|scissors|trousers|jeans|binoculars|pyjamas|pajamas|shorts|tongs|pliers)$/.test(x) ? ` (say “a pair of ${x}”)` : ""}.`);
      if (/^(this|that|much)$/.test(prev)) note(x + "det", `“${x}” is plural: “${({ this: "these", that: "those", much: "many" })[prev]} ${x}”, not “${prev} ${x}”.`);
      const v = verbAfter(i);
      if (v && SG_VERB.test(v)) note(x + "v", `“${x}” takes a plural verb: “${x} … ${PL_FOR[v]}”, not “${v}”.`);
      const q = SG_VERB.test(prev) ? prev : DETS.test(prev) && SG_VERB.test(prev2) ? prev2 : "";
      if (q && /^(is|was)$/.test(q)) note(x + "v", `“${x}” takes a plural verb: “${PL_FOR[q]} … ${x}”, not “${q}”.`);
      if (/^(it|its)$/.test(w[i + 1] || "") || (w.slice(i + 1).includes("it") && !w.slice(i + 1).includes("them") && /^(glasses|spectacles|scissors|trousers|jeans)$/.test(x) && /find|lost|put|wear|buy|bought|found/.test(w.slice(i + 1).join(" ")))) note(x + "it", `“${x}” is plural: refer to it with “they / them”, not “it”.`);
    }
  }
  return notes;
}

// ------------------------------------------------------------------ the check
const countBy = (forms) => forms.reduce((m, f) => ((m[f.tense] = (m[f.tense] || 0) + 1), m), {});

// Compare a translation with the model(s). Returns {forms, missing:[tense], extra:[{tense, words}], fewer:[tense], nouns:[msg], variant}
export function focusCheck(text, key) {
  const forms = verbForms(text);
  const got = countBy(forms);
  let best = null;
  for (const v of modelVariants(key)) {
    const need = countBy(verbForms(v));
    const missing = [], fewer = [], extra = [];
    for (const t of COMPARED) {
      const a = need[t] || 0, b = got[t] || 0;
      if (a && !b) missing.push(t);
      else if (a > b) fewer.push(t);
      else if (!a && b) extra.push(t);
    }
    // a different tense used instead of the expected one is one problem, not two
    const score = missing.length * 2 + extra.length * 2 + fewer.length;
    if (!best || score < best.score) best = { score, missing, fewer, extra, variant: v };
  }
  const nouns = nounNotes(text);
  const modelNouns = new Set((best ? nounNotes(best.variant) : []));
  return {
    forms: forms.map(({ tense, words, passive }) => ({ tense, words, passive })),
    missing: best ? best.missing : [],
    fewer: best ? best.fewer : [],
    extra: best ? best.extra.map((t) => ({ tense: t, words: forms.filter((f) => f.tense === t).map((f) => f.words) })) : [],
    nouns: nouns.filter((n) => !modelNouns.has(n)),
    ok: best ? best.score === 0 && !nouns.length : !nouns.length,
  };
}

export const tenseName = (t) => TENSE_NAMES[t] || t;
