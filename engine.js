/* Offline translation engine: phrase match + longest-match glossary + Malay word-root analysis.
   Works in the browser (window.BMEngine) and in Node (module.exports) for testing. */
(function (root) {
  "use strict";

  function norm(s) {
    return String(s || "").toLowerCase()
      .normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .replace(/[‘’]/g, "'")
      .replace(/[^a-z0-9\-' ]+/g, " ")
      .replace(/(^|\s)[-']+|[-']+(\s|$)/g, " ")
      .replace(/\s+/g, " ").trim();
  }
  function firstAlt(en) {
    return String(en).replace(/\([^)]*\)/g, "").split(/\s*[\/,;]\s*/)[0].trim() || en;
  }
  function msVariants(ms) { return String(ms).split(/\s*\/\s*/).map(norm).filter(Boolean); }
  function enKeys(en) {
    return String(en).replace(/\([^)]*\)/g, " ").split(/\s*[\/,;]\s*/)
      .map(function (s) { return norm(s).replace(/^(to|a|an|the) /, ""); })
      .filter(function (s) { return s && s.length > 0; });
  }

  function parse(raw, source) {
    var out = [], cat = "gen";
    String(raw).split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line) return;
      if (line[0] === "#") { cat = line.slice(1).trim(); return; }
      var f = line.split("|");
      if (f.length < 2) return;
      out.push({ ms: f[0].trim(), en: f[1].trim(), note: (f[2] || "").trim(), cat: cat,
                 phrase: cat.indexOf("p:") === 0, source: source || "built-in" });
    });
    return out;
  }

  // Malay affixes (prefix, possible restored first letters of the root)
  var PREFIXES = [
    ["meng", ["", "k"]], ["meny", ["s"]], ["mem", ["p", ""]], ["men", ["t", ""]], ["me", [""]],
    ["peng", ["", "k"]], ["peny", ["s"]], ["pem", ["p", ""]], ["pen", ["t", ""]],
    ["per", [""]], ["pe", [""]], ["ber", [""]], ["be", [""]], ["ter", [""]],
    ["di", [""]], ["ke", [""]], ["se", [""]]
  ];
  var SUFFIXES = ["kan", "an", "i"];
  var CLITICS = { nya: "the / his / its", lah: "(emphasis)", kah: "(question)", tah: "(emphasis)",
                  pun: "also / even", ku: "my", mu: "your" };
  var PREFIX_TAG = {
    di: "passive: is/was ...-ed", ter: "already / accidentally / most", ber: "has / is doing",
    be: "has / is doing", ke: "", se: "one / same as", per: "make more", pe: "person / thing that",
    pem: "person / thing that", pen: "person / thing that", peng: "person / thing that", peny: "person / thing that",
    me: "active verb", mem: "active verb", men: "active verb", meng: "active verb", meny: "active verb"
  };
  var SUFFIX_TAG = { kan: "do it / cause", i: "do to it", an: "thing / result / place" };

  var EN_STOP = { the: 1, a: 1, an: 1, is: 1, are: 1, am: 1, was: 1, were: 1, be: 1, been: 1, of: 1,
                  do: 1, does: 1, did: 1, it: 0 };
  var EN_POSS = { my: "saya", your: "awda", his: "dia", her: "dia", our: "kita", their: "mereka", its: "nya" };

  function Engine(entries) { this.load(entries || []); }

  Engine.prototype.load = function (entries) {
    var self = this;
    self.entries = entries;
    self.ms = new Map(); self.en = new Map();
    self.msPhrase = new Map(); self.enPhrase = new Map();
    self.maxMs = 1; self.maxEn = 1;
    // user words first so they win
    var ordered = entries.filter(function (e) { return e.source === "mine"; })
      .concat(entries.filter(function (e) { return e.source !== "mine" && !e.phrase; }))
      .concat(entries.filter(function (e) { return e.source !== "mine" && e.phrase; }));
    ordered.forEach(function (e) {
      if (e.phrase) {
        // whole sentences: matched only as a complete input, never inside a longer sentence
        msVariants(e.ms).forEach(function (k) { if (!self.msPhrase.has(k)) self.msPhrase.set(k, e); });
        String(e.en).replace(/\([^)]*\)/g, " ").split(/\s*\/\s*/).map(norm).filter(Boolean)
          .forEach(function (k) { if (!self.enPhrase.has(k)) self.enPhrase.set(k, e); });
        return;
      }
      msVariants(e.ms).forEach(function (k) {
        if (!self.ms.has(k)) self.ms.set(k, []);
        self.ms.get(k).push(e);
        self.maxMs = Math.max(self.maxMs, Math.min(k.split(" ").length, 10));
      });
      enKeys(e.en).forEach(function (k) {
        if (!self.en.has(k)) self.en.set(k, []);
        self.en.get(k).push(e);
        self.maxEn = Math.max(self.maxEn, Math.min(k.split(" ").length, 10));
      });
    });
  };

  // find the root of one Malay word
  Engine.prototype.analyze = function (w) {
    var self = this;
    var has = function (k) { var l = self.ms.get(k); return l && l.some(function (e) { return !e.phrase; }); };
    if (has(w)) return { root: w, tags: [] };
    var redup = w.match(/^([a-z']+)-\1$/);
    if (redup) { var r = self.analyze(redup[1]); if (r) { r.tags = r.tags.concat(["plural / repeated"]); return r; } }
    var dash = w.split("-");
    if (dash.length === 2 && dash[0] && dash[1] && has(dash[0])) return { root: dash[0], tags: ["(" + dash[1] + ")"] };

    var cands = [];
    var clitic = [[w, null]];
    Object.keys(CLITICS).forEach(function (c) {
      if (w.length > c.length + 2 && w.slice(-c.length) === c) clitic.push([w.slice(0, -c.length), c]);
    });
    clitic.forEach(function (cl) {
      var base = cl[0];
      var sufs = [[base, null]];
      SUFFIXES.forEach(function (s) {
        if (base.length > s.length + 2 && base.slice(-s.length) === s) sufs.push([base.slice(0, -s.length), s]);
      });
      sufs.forEach(function (sf) {
        var stem = sf[0];
        var cost = (cl[1] ? 1 : 0) + (sf[1] ? 1 : 0);
        cands.push({ root: stem, pre: null, suf: sf[1], cl: cl[1], cost: cost });
        PREFIXES.forEach(function (p) {
          var pre = p[0];
          if (stem.length > pre.length + 1 && stem.indexOf(pre) === 0) {
            var rest = stem.slice(pre.length);
            p[1].forEach(function (add) {
              cands.push({ root: add + rest, pre: pre, suf: sf[1], cl: cl[1], cost: cost + 1 + (add ? 0.1 : 0) });
            });
            // double prefix, e.g. memper-, diper-, ber+ke-
            PREFIXES.forEach(function (p2) {
              if (rest.length > p2[0].length + 1 && rest.indexOf(p2[0]) === 0 && (pre === "di" || pre === "mem" || pre === "ber" || pre === "ke")) {
                p2[1].forEach(function (add2) {
                  cands.push({ root: add2 + rest.slice(p2[0].length), pre: pre + "+" + p2[0], suf: sf[1], cl: cl[1], cost: cost + 2.2 });
                });
              }
            });
          }
        });
      });
    });
    cands.sort(function (a, b) { return a.cost - b.cost || b.root.length - a.root.length; });
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      if (c.root.length >= 2 && has(c.root)) {
        var tags = [];
        if (c.pre) {
          var p0 = c.pre.split("+")[0];
          if (p0 === "ke" && c.suf === "an") tags.push("state / quality of");
          else if (/^pe/.test(p0) && c.suf === "an") tags.push(c.pre + "-...-an: the act / process of");
          else if (PREFIX_TAG[p0]) tags.push(c.pre + "-: " + PREFIX_TAG[p0]);
        }
        if (c.suf && !(c.pre && (c.pre === "ke" || /^pe/.test(c.pre)) && c.suf === "an")) tags.push("-" + c.suf + ": " + SUFFIX_TAG[c.suf]);
        if (c.cl) tags.push("-" + c.cl + ": " + CLITICS[c.cl]);
        return { root: c.root, tags: tags };
      }
    }
    return null;
  };

  function pickEntry(list) {
    var nonPhrase = list.filter(function (e) { return !e.phrase; });
    return (nonPhrase.length ? nonPhrase : list)[0];
  }

  // Malay -> English
  Engine.prototype.msToEn = function (text) {
    var self = this, n = norm(text);
    var res = { dir: "ms-en", input: text, phrase: null, tokens: [], rough: "", similar: [] };
    if (!n) return res;
    if (self.msPhrase.has(n)) res.phrase = self.msPhrase.get(n);
    else if (self.ms.has(n)) { var ex = pickEntry(self.ms.get(n)); if (ex && n.indexOf(" ") > 0) res.phrase = ex; }
    var words = n.split(" "), i = 0, rough = [];
    while (i < words.length) {
      var hit = null;
      for (var len = Math.min(self.maxMs, words.length - i); len >= 1; len--) {
        var key = words.slice(i, i + len).join(" ");
        if (self.ms.has(key)) { hit = { key: key, len: len, list: self.ms.get(key) }; break; }
      }
      if (hit) {
        var e = pickEntry(hit.list);
        res.tokens.push({ src: hit.key, root: hit.key, known: true, entry: e, alts: hit.list, tags: [], gloss: firstAlt(e.en) });
        rough.push(firstAlt(e.en)); i += hit.len; continue;
      }
      var w = words[i], a = self.analyze(w);
      if (a) {
        var e2 = pickEntry(self.ms.get(a.root));
        var g = firstAlt(e2.en);
        if (a.tags.some(function (t) { return t.indexOf("plural") === 0; })) g += "(s)";
        if (a.tags.some(function (t) { return t.indexOf("passive") >= 0; })) g = "(be) " + g;
        if (a.tags.some(function (t) { return t.indexOf("process of") >= 0; })) g = "(act of) " + g;
        res.tokens.push({ src: w, root: a.root, known: true, entry: e2, alts: self.ms.get(a.root), tags: a.tags, gloss: g });
        rough.push(g);
      } else if (/^\d+([.,]\d+)?$/.test(w)) {
        res.tokens.push({ src: w, root: w, known: true, entry: null, alts: [], tags: [], gloss: w }); rough.push(w);
      } else {
        res.tokens.push({ src: w, root: w, known: false, entry: null, alts: [], tags: [], gloss: w }); rough.push("[" + w + "]");
      }
      i++;
    }
    res.rough = rough.join(" ");
    res.similar = self.similar(n, "ms");
    return res;
  };

  function enStem(w) {
    var c = [];
    if (/ies$/.test(w)) c.push(w.replace(/ies$/, "y"));
    if (/es$/.test(w)) c.push(w.replace(/es$/, ""));
    if (/s$/.test(w)) c.push(w.replace(/s$/, ""));
    if (/ing$/.test(w)) { c.push(w.replace(/ing$/, "")); c.push(w.replace(/ing$/, "e")); c.push(w.replace(/(.)\1ing$/, "$1")); }
    if (/ed$/.test(w)) { c.push(w.replace(/ed$/, "")); c.push(w.replace(/d$/, "")); c.push(w.replace(/(.)\1ed$/, "$1")); c.push(w.replace(/ied$/, "y")); }
    if (/'s$/.test(w)) c.push(w.replace(/'s$/, ""));
    return c;
  }

  var NOUN_CATS = { build: 1, mep: 1, mat: 1, tool: 1, trade: 1, office: 1, daily: 1, pron: 1, unit: 1 };

  // English -> Malay
  Engine.prototype.enToMs = function (text) {
    var self = this, n = norm(text);
    var res = { dir: "en-ms", input: text, phrase: null, tokens: [], rough: "", similar: [] };
    if (!n) return res;
    if (self.enPhrase.has(n)) res.phrase = self.enPhrase.get(n);
    var words = n.split(" ").map(function (w) { return w === "dont" || w === "don't" ? "don't" : w; });
    var i = 0, toks = [];
    while (i < words.length) {
      var hit = null;
      for (var len = Math.min(self.maxEn, words.length - i); len >= 1; len--) {
        var key = words.slice(i, i + len).join(" ");
        if (len === 1 && (EN_POSS[key] || EN_STOP[key])) break;
        if (self.en.has(key)) { hit = { key: key, len: len, list: self.en.get(key) }; break; }
      }
      if (hit) {
        var e = pickEntry(hit.list);
        toks.push({ src: hit.key, known: true, entry: e, alts: hit.list, tags: [], gloss: msVariants(e.ms)[0] ? e.ms.split(/\s*\/\s*/)[0] : e.ms });
        i += hit.len; continue;
      }
      var w = words[i];
      if (EN_POSS[w]) { toks.push({ src: w, known: true, entry: null, alts: [], tags: ["possessive - goes after the noun"], gloss: EN_POSS[w], poss: true }); i++; continue; }
      if (EN_STOP[w]) { i++; continue; }
      var found = null;
      enStem(w).some(function (s) { if (s && self.en.has(s)) { found = s; return true; } return false; });
      if (found) {
        var e3 = pickEntry(self.en.get(found));
        var tags = [];
        if (/s$/.test(w) && !/ss$/.test(w)) tags.push("plural: repeat the word or add a number");
        toks.push({ src: w, known: true, entry: e3, alts: self.en.get(found), tags: tags, gloss: e3.ms.split(/\s*\/\s*/)[0] });
      } else if (/^\d+([.,]\d+)?$/.test(w)) {
        toks.push({ src: w, known: true, entry: null, alts: [], tags: [], gloss: w });
      } else {
        toks.push({ src: w, known: false, entry: null, alts: [], tags: [], gloss: "[" + w + "]" });
      }
      i++;
    }
    // Malay word order: describing words and possessives go AFTER the noun ("my new helmet" -> helmet baru saya)
    var ordered = [], k = 0;
    var isMod = function (t) { return t.poss || (t.entry && t.entry.cat === "adj"); };
    var isNoun = function (t) { return t && (!t.known || (t.entry && NOUN_CATS[t.entry.cat])); };
    while (k < toks.length) {
      if (isMod(toks[k])) {
        var j = k, mods = [];
        while (j < toks.length && isMod(toks[j])) { mods.push(toks[j]); j++; }
        if (isNoun(toks[j])) {
          var adjs = mods.filter(function (t) { return !t.poss; }), poss = mods.filter(function (t) { return t.poss; });
          ordered.push(toks[j]); ordered = ordered.concat(adjs, poss); k = j + 1; continue;
        }
        ordered = ordered.concat(mods); k = j; continue;
      }
      ordered.push(toks[k]); k++;
    }
    toks = ordered;
    res.tokens = toks;
    res.rough = toks.map(function (t) { return t.gloss; }).join(" ").replace(/ nya\b/g, "nya");
    res.similar = self.similar(n, "en");
    return res;
  };

  Engine.prototype.translate = function (text, dir) {
    return dir === "en-ms" ? this.enToMs(text) : this.msToEn(text);
  };

  // phrasebook sentences that share most words with the input
  Engine.prototype.similar = function (n, lang) {
    var words = n.split(" ").filter(function (w) { return w.length > 2; });
    if (!words.length) return [];
    var scored = [];
    this.entries.forEach(function (e) {
      if (!e.phrase) return;
      var t = norm(lang === "ms" ? e.ms : e.en);
      if (t === n) return;
      var tw = t.split(" ");
      var hits = words.filter(function (w) { return tw.indexOf(w) >= 0; }).length;
      var score = hits / Math.max(words.length, tw.length * 0.6);
      if (hits && score >= 0.34) scored.push({ e: e, s: score });
    });
    scored.sort(function (a, b) { return b.s - a.s; });
    return scored.slice(0, 4).map(function (x) { return x.e; });
  };

  // dictionary search (both languages)
  Engine.prototype.search = function (q, opts) {
    opts = opts || {};
    var n = norm(q);
    var list = this.entries.filter(function (e) {
      if (opts.cat && opts.cat !== "all") {
        if (opts.cat === "phrases" ? !e.phrase : opts.cat === "words" ? e.phrase : e.cat !== opts.cat) return false;
      }
      return true;
    });
    if (!n) return list;
    var scored = [];
    list.forEach(function (e) {
      var m = norm(e.ms), en = norm(e.en), s = 0;
      var mv = msVariants(e.ms), ek = enKeys(e.en);
      if (mv.indexOf(n) >= 0 || ek.indexOf(n) >= 0) s = 100;
      else if (m.indexOf(n) === 0 || en.indexOf(n) === 0) s = 60;
      else if ((" " + m).indexOf(" " + n) >= 0 || (" " + en).indexOf(" " + n) >= 0) s = 40;
      else if (m.indexOf(n) >= 0 || en.indexOf(n) >= 0 || norm(e.note).indexOf(n) >= 0) s = 20;
      if (s) scored.push({ e: e, s: s - (e.phrase ? 5 : 0) + (e.source === "mine" ? 3 : 0) });
    });
    scored.sort(function (a, b) { return b.s - a.s || a.e.ms.length - b.e.ms.length; });
    return scored.map(function (x) { return x.e; });
  };

  /* Scanner clean-up: keep only lines that look like real text.
     Photos of objects, logos and textured backgrounds make the scanner "see" random symbols;
     those come back with low confidence or without real words, and are dropped here. */
  function wordLike(t) {
    var letters = (t.match(/[A-Za-z\u00C0-\u024F]/g) || []).length;
    var digits = (t.match(/[0-9]/g) || []).length;
    var core = t.replace(/^[^A-Za-z0-9\u00C0-\u024F]+|[^A-Za-z0-9\u00C0-\u024F]+$/g, "");
    if (!core) return false;
    if (letters >= 2 && letters / core.length >= 0.6) return true;
    return digits >= 3 && (digits + letters) / core.length >= 0.7;
  }
  function cleanOCR(data, opts) {
    opts = opts || {};
    var minLine = opts.minLine || 60, minWord = opts.minWord || 70, keepWord = opts.keepWord || 45;
    var kept = [], dropped = [], confs = [];
    var lines = [];
    (data.blocks || []).forEach(function (b) { (b.paragraphs || []).forEach(function (p) { (p.lines || []).forEach(function (l) { lines.push(l); }); }); });
    if (!lines.length && data.text) {
      // no layout info: fall back to overall confidence
      var ok = (data.confidence || 0) >= minLine;
      return { text: ok ? String(data.text).trim() : "", confidence: ok ? Math.round(data.confidence) : 0,
               kept: ok ? 1 : 0, dropped: ok ? 0 : 1, raw: String(data.text || "").trim() };
    }
    lines.forEach(function (l) {
      var words = (l.words || []).filter(function (w) { return String(w.text || "").trim(); });
      var strong = words.filter(function (w) { return w.confidence >= minWord && wordLike(w.text); });
      var raw = String(l.text || words.map(function (w) { return w.text; }).join(" ")).trim();
      if (l.confidence >= minLine && strong.length) {
        var out = words.filter(function (w) { return w.confidence >= keepWord && /[A-Za-z0-9\u00C0-\u024F]/.test(w.text); })
          .map(function (w) { return w.text; }).join(" ");
        if (out) { kept.push(out); confs.push(l.confidence); return; }
      }
      if (raw) dropped.push(raw);
    });
    var avg = confs.length ? Math.round(confs.reduce(function (a, b) { return a + b; }, 0) / confs.length) : 0;
    return { text: kept.join("\n"), confidence: avg, kept: kept.length, dropped: dropped.length,
             raw: lines.map(function (l) { return String(l.text || "").trim(); }).filter(Boolean).join("\n") };
  }

  var api = { Engine: Engine, parse: parse, norm: norm, firstAlt: firstAlt, cleanOCR: cleanOCR, wordLike: wordLike };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BMEngine = api;
})(this);
