/* BM Translator - app logic */
(function () {
  "use strict";
  // never run inside another website's frame (clickjacking guard)
  if (window.top !== window.self) {
    document.documentElement.style.display = "none";
    try { window.top.location.replace(window.location.href); } catch (e) { /* blocked: stay hidden */ }
    return;
  }
  var VERSION = window.APP.version;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem("bm." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem("bm." + k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };
  var toastT;
  function toast(msg, ms) {
    var t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("show"); }, ms || 2200);
  }
  function debounce(fn, ms) { var t; return function () { var a = arguments, th = this; clearTimeout(t); t = setTimeout(function () { fn.apply(th, a); }, ms); }; }
  var ICON = {
    speak: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
    del: '<svg viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'
  };

  /* ---------- data ---------- */
  var CATS = window.BM_CATS;
  var builtIn = BMEngine.parse(window.BM_DATA, "built-in");
  var mine = store.get("mine", []);
  var settings = Object.assign({ rate: 0.9, voiceURI: "", mmEmail: "", ocrLang: "msa+eng" }, store.get("settings", {}));
  var dir = store.get("dir", "ms-en");
  var fav = new Set(store.get("fav", []));
  var hist = store.get("hist", []);
  var engine;
  function rebuild() {
    engine = new BMEngine.Engine(mine.map(function (m) {
      return { id: m.id, ms: m.ms, en: m.en, note: m.note || "", cat: m.cat || "gen", phrase: String(m.cat || "").indexOf("p:") === 0, source: "mine" };
    }).concat(builtIn));
  }
  rebuild();
  function saveSettings() { store.set("settings", settings); }
  function favKey(e) { return e.ms + "|" + e.en; }
  function catTag(e) {
    var t = "";
    if (e.source === "mine") t += '<span class="tag mine">My word</span>';
    if (e.cat === "brunei" || /brunei/i.test(e.note)) t += '<span class="tag br">Brunei</span>';
    if (CATS[e.cat] && e.cat !== "brunei") t += '<span class="tag">' + esc(CATS[e.cat].replace(/^Phrases - /, "")) + "</span>";
    return t;
  }

  /* ---------- tabs ---------- */
  function showView(v) {
    $$("section.view").forEach(function (s) { s.classList.toggle("on", s.id === "v-" + v); });
    $$("#tabs button").forEach(function (b) { b.classList.toggle("on", b.dataset.v === v); });
    store.set("tab", v);
    window.scrollTo(0, 0);
    if (v === "phrases") renderPhrases(true);
    if (v === "mine") renderMine();
    if (v === "settings") refreshSettings();
    if (v === "scan") refreshScanState();
  }
  $$("#tabs button").forEach(function (b) { b.addEventListener("click", function () { showView(b.dataset.v); }); });

  /* ---------- online status ---------- */
  function netUI() {
    var on = navigator.onLine;
    $("#net").classList.toggle("off", !on);
    $("#net span").textContent = on ? "Online" : "Offline";
    var ob = $("#onlineBtn"); if (ob) ob.disabled = !on;
  }
  window.addEventListener("online", netUI); window.addEventListener("offline", netUI);

  /* ---------- speech out ---------- */
  function allVoices() { return ("speechSynthesis" in window) ? speechSynthesis.getVoices() : []; }
  function pickVoice(lang) {
    var v = allVoices();
    if (lang === "ms" && settings.voiceURI) { var f = v.find(function (x) { return x.voiceURI === settings.voiceURI; }); if (f) return f; }
    var pref = lang === "ms" ? ["ms", "id", "in"] : ["en-gb", "en"];
    for (var i = 0; i < pref.length; i++) {
      var p = pref[i];
      var m = v.find(function (x) { return x.lang.replace("_", "-").toLowerCase().indexOf(p) === 0; });
      if (m) return m;
    }
    return null;
  }
  function speak(text, lang) {
    if (!text) return;
    if (!("speechSynthesis" in window)) { toast("Reading aloud is not supported on this browser"); return; }
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      var v = pickVoice(lang);
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = lang === "ms" ? "ms-MY" : "en-GB";
      u.rate = settings.rate;
      speechSynthesis.speak(u);
      if (!v && lang === "ms") toast("No Malay voice on this phone - see Settings > Voice");
    } catch (e) { toast("Could not read aloud"); }
  }
  if ("speechSynthesis" in window) speechSynthesis.onvoiceschanged = function () { if ($("#v-settings").classList.contains("on")) fillVoices(); };

  /* ---------- translate ---------- */
  var src = $("#src");
  function dirUI() {
    var ms = dir === "ms-en";
    $("#dirFrom").textContent = ms ? "Malay" : "English";
    $("#dirTo").textContent = ms ? "English" : "Malay";
    src.placeholder = ms ? "Type, paste or speak Malay..." : "Type, paste or speak English...";
  }
  $("#swapBtn").addEventListener("click", function () {
    dir = dir === "ms-en" ? "en-ms" : "ms-en"; store.set("dir", dir); dirUI();
    if (lastResult && lastResult.phrase) src.value = lastResult.out;
    doTranslate();
  });

  var lastResult = null, selChip = -1;
  function outText(r) {
    if (r.phrase) return r.dir === "ms-en" ? r.phrase.en : r.phrase.ms.split(/\s*\/\s*/)[0];
    return r.rough.replace(/\[|\]/g, "");
  }
  function doTranslate() {
    var text = src.value;
    store.set("draft", text);
    var box = $("#result");
    selChip = -1;
    if (!text.trim()) {
      lastResult = null;
      box.innerHTML = '<div class="card empty"><b>Type, speak or scan</b>Works offline from the built-in glossary of ' + engine.entries.length +
        ' words and phrases. Use <i>Online</i> for full sentences when you have data.</div>';
      return;
    }
    var r = engine.translate(text, dir);
    lastResult = r; r.out = outText(r);
    var toMs = dir === "en-ms";
    var h = "";
    if (r.phrase) {
      var main = toMs ? r.phrase.ms.split(/\s*\/\s*/)[0] : r.phrase.en;
      h += '<div class="card match"><p class="lbl">Phrasebook match</p><div class="row" style="align-items:flex-start;flex-wrap:nowrap"><div style="flex:1"><div class="big">' + esc(main) + "</div>" +
        (r.phrase.note ? '<div class="mute">' + esc(r.phrase.note) + "</div>" : "") + "</div>" +
        '<button class="icon" data-say="' + esc(r.phrase.ms) + '" aria-label="Listen">' + ICON.speak + "</button>" +
        '<button class="icon" data-copy="' + esc(main) + '" aria-label="Copy">' + ICON.copy + "</button></div></div>";
    }
    var unknown = r.tokens.filter(function (t) { return !t.known; }).length;
    var known = r.tokens.length - unknown;
    var chips = r.tokens.map(function (t, i) {
      return '<button class="chip' + (t.known ? "" : " unk") + '" data-i="' + i + '"><small>' + esc(t.src) + "</small><b>" + esc(t.known ? t.gloss : "?") + "</b></button>";
    }).join("");
    h += '<div class="card"><p class="lbl">' + (r.phrase ? "Word by word" : "Quick meaning &middot; offline") + "</p>";
    if (!r.phrase) {
      h += '<div class="row" style="align-items:flex-start;flex-wrap:nowrap"><div class="rough" style="flex:1">' + esc(r.rough).replace(/\[([^\]]+)\]/g, '<span style="color:var(--red)">[$1]</span>') + "</div>" +
        (toMs ? '<button class="icon" data-say="' + esc(r.out) + '" aria-label="Listen">' + ICON.speak + "</button>" : "") +
        '<button class="icon" data-copy="' + esc(r.out) + '" aria-label="Copy">' + ICON.copy + "</button></div>";
      h += '<p class="mute" style="margin:6px 0 4px">' + (r.tokens.length > 2 ? "Word-by-word guide - grammar is not rearranged. " : "") +
        (unknown ? unknown + " word" + (unknown > 1 ? "s" : "") + " not in the glossary (red) - tap to add, or use Online below." : "All words found (" + known + ").") + "</p>";
    }
    h += '<div class="chips">' + chips + '</div><div id="chipInfo"></div></div>';
    if (r.similar.length) {
      h += '<div class="card"><p class="lbl">Similar phrases</p><div class="list">' + r.similar.map(function (e) {
        return '<div class="it" data-use="' + esc(toMs ? e.en : e.ms) + '" style="cursor:pointer"><div class="tx"><div class="ms">' + esc(e.ms) + '</div><div class="en">' + esc(e.en) + "</div></div>" +
          '<div class="acts"><button class="icon" data-say="' + esc(e.ms) + '">' + ICON.speak + "</button></div></div>";
      }).join("") + "</div></div>";
    }
    var gUrl = "https://translate.google.com/?sl=" + (toMs ? "en" : "ms") + "&tl=" + (toMs ? "ms" : "en") + "&text=" + encodeURIComponent(text) + "&op=translate";
    h += '<div class="card"><p class="lbl">Full sentence &middot; online</p><div class="row"><button class="btn yel" id="onlineBtn">Translate online</button>' +
      '<a class="btn" href="' + gUrl + '" target="_blank" rel="noopener">Open in Google Translate</a></div><div id="onlineOut" style="margin-top:8px"></div></div>';
    box.innerHTML = h;
    netUI();
    $("#onlineBtn").addEventListener("click", onlineTranslate);
    saveHistSoon();
  }
  src.addEventListener("input", debounce(doTranslate, 220));

  $("#result").addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-say],[data-copy],[data-use],.chip,[data-add]");
    if (!t) return;
    if (t.dataset.say != null) { speak(t.dataset.say.split(/\s*\/\s*/)[0], "ms"); return; }
    if (t.dataset.copy != null) { copy(t.dataset.copy); return; }
    if (t.dataset.add != null) { prefillMine(t.dataset.add); return; }
    if (t.dataset.use != null) { src.value = t.dataset.use; doTranslate(); window.scrollTo(0, 0); return; }
    if (t.classList.contains("chip")) showChip(+t.dataset.i);
  });

  function showChip(i) {
    var info = $("#chipInfo"); if (!lastResult) return;
    $$(".chip", $("#result")).forEach(function (c) { c.classList.toggle("sel", +c.dataset.i === i && selChip !== i); });
    if (selChip === i) { selChip = -1; info.innerHTML = ""; return; }
    selChip = i;
    var t = lastResult.tokens[i], toMs = dir === "en-ms", h = '<div class="info">';
    if (!t.known) {
      h += "<b>" + esc(t.src) + "</b> is not in the glossary yet." +
        '<div class="row" style="margin-top:8px"><button class="btn sm pri" data-add="' + esc(t.src) + '">' + ICON.plus + 'Add to My words</button></div>';
    } else {
      h += "<b>" + esc(t.src) + "</b>";
      if (t.root && t.root !== t.src && !toMs) h += ' &rarr; root word <b>' + esc(t.root) + "</b>";
      if (t.tags.length) h += "<div>" + t.tags.map(function (x) { return '<span class="tag">' + esc(x) + "</span>"; }).join("") + "</div>";
      if (t.alts.length) {
        h += "<ul>" + t.alts.slice(0, 6).map(function (e) {
          return "<li><b>" + esc(e.ms) + "</b> = " + esc(e.en) + (e.note ? ' <span class="mute">(' + esc(e.note) + ")</span>" : "") + " " + catTag(e) + "</li>";
        }).join("") + "</ul>";
        h += '<div class="row" style="margin-top:8px"><button class="btn sm" data-say="' + esc(t.alts[0].ms) + '">' + ICON.speak + "Listen</button></div>";
      }
    }
    info.innerHTML = h + "</div>";
  }

  function chunks(text, max) {
    var parts = text.match(/[^.!?\n]+[.!?]*\s*|\n+/g) || [text], out = [], cur = "";
    parts.forEach(function (p) {
      if ((cur + p).length > max && cur) { out.push(cur); cur = ""; }
      while (p.length > max) { out.push(p.slice(0, max)); p = p.slice(max); }
      cur += p;
    });
    if (cur.trim()) out.push(cur);
    return out;
  }
  function onlineTranslate() {
    var text = src.value.trim(); if (!text) return;
    var out = $("#onlineOut"), btn = $("#onlineBtn");
    if (!navigator.onLine) { out.innerHTML = '<div class="warn">You are offline. The quick meaning above still works.</div>'; return; }
    btn.disabled = true; out.innerHTML = '<span class="mute">Translating...</span>';
    var pair = dir === "ms-en" ? "ms|en" : "en|ms";
    var parts = chunks(text, 450), results = [];
    var run = function (k) {
      if (k >= parts.length) {
        var res = results.join(" ").replace(/\s+/g, " ").trim();
        out.innerHTML = '<div class="row" style="align-items:flex-start;flex-wrap:nowrap"><div class="rough" style="flex:1">' + esc(res) + "</div>" +
          (dir === "en-ms" ? '<button class="icon" data-say="' + esc(res) + '">' + ICON.speak + "</button>" : "") +
          '<button class="icon" data-copy="' + esc(res) + '">' + ICON.copy + '</button></div><p class="mute" style="margin:6px 0 0">Machine translation (MyMemory). Check important wording.</p>';
        btn.disabled = false;
        var h0 = hist[0]; if (h0 && h0.t === text) { h0.o = res; store.set("hist", hist); }
        return;
      }
      var url = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(parts[k].trim()) + "&langpair=" + pair +
        (settings.mmEmail ? "&de=" + encodeURIComponent(settings.mmEmail) : "");
      fetch(url).then(function (r) { return r.json(); }).then(function (j) {
        if (!j || !j.responseData || (j.responseStatus && +j.responseStatus !== 200)) throw new Error((j && j.responseDetails) || "Service error");
        if (j.quotaFinished) throw new Error("Free daily limit reached - add your email in Settings, or use Google Translate.");
        results.push(j.responseData.translatedText); run(k + 1);
      }).catch(function (e) {
        btn.disabled = false;
        out.innerHTML = '<div class="warn">Online translation failed: ' + esc(e.message || e) + ". Try <b>Open in Google Translate</b>.</div>";
      });
    };
    run(0);
  }

  /* history */
  var saveHistSoon = debounce(function () {
    var t = src.value.trim(); if (t.length < 2) return;
    hist = hist.filter(function (h) { return h.t !== t; });
    hist.unshift({ t: t, d: dir, o: lastResult ? lastResult.out : "", ts: Date.now() });
    hist = hist.slice(0, 40); store.set("hist", hist); renderHist();
  }, 1600);
  function renderHist() {
    var c = $("#histCard"), l = $("#histList");
    c.classList.toggle("hide", !hist.length);
    l.innerHTML = hist.slice(0, 15).map(function (h, i) {
      return '<div class="it" data-h="' + i + '"><div class="tx"><div class="ms">' + esc(h.t) + '</div><div class="nt">' + esc(h.o || "") + " &middot; " + (h.d === "ms-en" ? "MS&rarr;EN" : "EN&rarr;MS") + "</div></div></div>";
    }).join("");
  }
  $("#histList").addEventListener("click", function (ev) {
    var it = ev.target.closest("[data-h]"); if (!it) return;
    var h = hist[+it.dataset.h]; dir = h.d; store.set("dir", dir); dirUI(); src.value = h.t; doTranslate(); window.scrollTo(0, 0);
  });
  $("#histClear").addEventListener("click", function () { hist = []; store.set("hist", hist); renderHist(); });

  function copy(text) {
    var done = function () { toast("Copied"); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    function fallback() {
      var ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { toast("Copy failed"); } ta.remove();
    }
  }
  $("#clearBtn").addEventListener("click", function () { src.value = ""; doTranslate(); src.focus(); });
  $("#pasteBtn").addEventListener("click", function () {
    if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(function (t) { src.value = t; doTranslate(); }, function () { toast("Long-press the box and choose Paste"); });
    else toast("Long-press the box and choose Paste");
  });
  $("#sayBtn").addEventListener("click", function () {
    if (dir === "ms-en") speak(src.value.trim(), "ms");
    else if (lastResult) speak(lastResult.out, "ms");
  });

  /* voice input */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition, rec = null, listening = false;
  $("#micBtn").addEventListener("click", function () {
    if (!SR) { toast("Voice input not supported here - use the mic on your keyboard", 3500); return; }
    if (listening && rec) { rec.stop(); return; }
    if (!navigator.onLine) { toast("Voice input needs internet. Offline: use your keyboard's mic button.", 3800); return; }
    rec = new SR();
    rec.lang = dir === "ms-en" ? "ms-MY" : "en-GB";
    rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    var base = src.value.trim() ? src.value.trim() + " " : "";
    rec.onstart = function () { listening = true; $("#micBtn").classList.add("rec"); $("#micBtn span").textContent = "Stop"; $("#liveVoice").textContent = "Listening (" + (dir === "ms-en" ? "Malay" : "English") + ")..."; };
    rec.onresult = function (e) {
      var fin = "", interim = "";
      for (var i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) fin += e.results[i][0].transcript; else interim += e.results[i][0].transcript;
      }
      if (interim) $("#liveVoice").textContent = interim;
      if (fin) { src.value = base + fin; base = src.value + " "; doTranslate(); }
    };
    rec.onerror = function (e) {
      var m = { "not-allowed": "Microphone permission denied - allow it in browser settings", "service-not-allowed": "Microphone permission denied",
        network: "Voice input needs internet. Use your keyboard's mic offline.", "no-speech": "Didn't hear anything - try again",
        "language-not-supported": "Malay voice input not available on this phone" }[e.error] || ("Voice error: " + e.error);
      toast(m, 3500);
    };
    rec.onend = function () { listening = false; $("#micBtn").classList.remove("rec"); $("#micBtn span").textContent = "Speak"; $("#liveVoice").textContent = ""; };
    try { rec.start(); } catch (e) { toast("Could not start the microphone"); }
  });

  /* ---------- scan (OCR) ---------- */
  var ocrWorker = null, ocrLoadedLang = "", tessLoading = null;
  function loadTess() {
    if (window.Tesseract) return Promise.resolve();
    if (tessLoading) return tessLoading;
    tessLoading = new Promise(function (res, rej) {
      var s = document.createElement("script"); s.src = "ocr/tesseract.min.js";
      s.onload = res; s.onerror = function () { tessLoading = null; rej(new Error("Scanner files not available - connect once to download them.")); };
      document.head.appendChild(s);
    });
    return tessLoading;
  }
  function getWorker(lang, onProg) {
    if (ocrWorker && ocrLoadedLang === lang) return Promise.resolve(ocrWorker);
    var base = new URL("ocr/", location.href).href;
    var start = function () {
      return loadTess().then(function () {
        return Tesseract.createWorker(lang.split("+"), 1, {
          workerPath: base + "worker.min.js", corePath: base + "core", langPath: base + "lang",
          gzip: true, workerBlobURL: false,
          logger: function (m) { if (onProg) onProg(m); }
        });
      }).then(function (w) { ocrWorker = w; ocrLoadedLang = lang; return w; });
    };
    if (ocrWorker) { var old = ocrWorker; ocrWorker = null; return old.terminate().then(start, start); }
    return start();
  }
  var OCR_FILES = ["ocr/tesseract.min.js", "ocr/worker.min.js", "ocr/lang/msa.traineddata.gz", "ocr/lang/eng.traineddata.gz"];
  function scannerCached() {
    if (!("caches" in window)) return Promise.resolve(false);
    var abs = function (p) { return new URL(p, location.href).href; };
    return Promise.all(OCR_FILES.map(function (f) { return caches.match(abs(f)); })).then(function (rs) {
      if (rs.some(function (r) { return !r; })) return false;
      return Promise.all([caches.match(abs("ocr/core/tesseract-core-simd-lstm.wasm.js")), caches.match(abs("ocr/core/tesseract-core-lstm.wasm.js"))])
        .then(function (c) { return !!(c[0] || c[1]); });
    }).catch(function () { return false; });
  }
  function refreshScanState() {
    $("#ocrLang").value = settings.ocrLang;
    scannerCached().then(function (ok) {
      $("#ocrState").innerHTML = ok ? '<span class="ok">&#10003; Scanner saved on this phone - works offline</span>' :
        (navigator.onLine ? "First scan downloads the scanner (about 8 MB) - then it works offline." : '<span style="color:var(--red)">Scanner not downloaded yet - connect to Wi-Fi or data once.</span>');
    });
  }
  $("#ocrLang").addEventListener("change", function () { settings.ocrLang = this.value; saveSettings(); });

  /* photo + crop box */
  var photo = null, sel = null, drag = null, cv = $("#cropCv"), cx = cv.getContext("2d");
  function loadPhoto(file) {
    return new Promise(function (res, rej) {
      if (!file || !/^image\//.test(file.type || "image/")) { rej(new Error("Please choose a photo")); return; }
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        photo = img; sel = null;
        var k = Math.min(1, 1100 / Math.max(img.naturalWidth, img.naturalHeight));
        cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
        drawCrop(); res();
      };
      img.onerror = function () { rej(new Error("Could not open this image")); };
      img.src = url;
    });
  }
  function drawCrop() {
    if (!photo) return;
    var k = cv.width / photo.naturalWidth;
    cx.drawImage(photo, 0, 0, cv.width, cv.height);
    if (sel) {
      var x = sel.x * k, y = sel.y * k, w = sel.w * k, h = sel.h * k;
      cx.fillStyle = "rgba(20,28,36,.55)";
      cx.fillRect(0, 0, cv.width, y); cx.fillRect(0, y + h, cv.width, cv.height - y - h);
      cx.fillRect(0, y, x, h); cx.fillRect(x + w, y, cv.width - x - w, h);
      cx.strokeStyle = "#F7E017"; cx.lineWidth = Math.max(2, cv.width / 250); cx.strokeRect(x, y, w, h);
    }
    $("#cropClear").classList.toggle("hide", !sel);
  }
  function toImg(e) {
    var r = cv.getBoundingClientRect();
    return { x: Math.max(0, Math.min(photo.naturalWidth, (e.clientX - r.left) / r.width * photo.naturalWidth)),
             y: Math.max(0, Math.min(photo.naturalHeight, (e.clientY - r.top) / r.height * photo.naturalHeight)) };
  }
  cv.addEventListener("pointerdown", function (e) {
    if (!photo) return; e.preventDefault(); drag = toImg(e);
    try { cv.setPointerCapture(e.pointerId); } catch (x) {}
  });
  cv.addEventListener("pointermove", function (e) {
    if (!drag) return; var p = toImg(e);
    sel = { x: Math.min(drag.x, p.x), y: Math.min(drag.y, p.y), w: Math.abs(p.x - drag.x), h: Math.abs(p.y - drag.y) };
    drawCrop();
  });
  function endDrag() {
    if (!drag) return; drag = null;
    if (sel && (sel.w < photo.naturalWidth * 0.03 || sel.h < photo.naturalHeight * 0.02)) sel = null;
    drawCrop();
    $("#cropHint").innerHTML = sel ? "Box set. Tap <b>Read text</b> to read only inside it." : "Tip: drag a box around the text, then tap <b>Read text</b>. Everything outside the box is ignored.";
  }
  cv.addEventListener("pointerup", endDrag); cv.addEventListener("pointercancel", endDrag);
  $("#cropClear").addEventListener("click", function () { sel = null; drawCrop(); endDrag(); });

  // the part to read: crop box (or whole photo), sized for the scanner, in grey
  function regionCanvas() {
    var r = sel || { x: 0, y: 0, w: photo.naturalWidth, h: photo.naturalHeight };
    var k = Math.min(2000 / Math.max(r.w, r.h), 2.5);
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(r.w * k)); c.height = Math.max(1, Math.round(r.h * k));
    var x = c.getContext("2d");
    x.imageSmoothingQuality = "high";
    x.drawImage(photo, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
    try {
      var d = x.getImageData(0, 0, c.width, c.height), p = d.data;
      for (var i = 0; i < p.length; i += 4) { var g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; p[i] = p[i + 1] = p[i + 2] = g; }
      x.putImageData(d, 0, 0);
    } catch (e) { /* keep colour */ }
    return c;
  }
  var busy = false;
  function runOCR() {
    if (!photo || busy) return;
    busy = true; $("#ocrRun").disabled = true;
    var prog = $("#ocrProg"), bar = $("#ocrProg i"), msg = $("#ocrMsg");
    prog.classList.remove("hide"); bar.style.width = "3%"; msg.textContent = "Preparing image...";
    $("#ocrOut").classList.add("hide"); $("#ocrNone").classList.add("hide");
    var onProg = function (m) {
      var labels = { "loading tesseract core": "Loading scanner", "loading language traineddata": "Loading language data", "initializing api": "Starting", "recognizing text": "Reading text" };
      msg.textContent = (labels[m.status] || m.status) + "..." + (m.status === "recognizing text" ? " " + Math.round(m.progress * 100) + "%" : "");
      bar.style.width = (m.status === "recognizing text" ? 30 + m.progress * 70 : Math.max(5, Math.round(m.progress * 30))) + "%";
    };
    var canvas = regionCanvas();
    getWorker(settings.ocrLang, onProg).then(function (w) {
      return w.recognize(canvas, {}, { text: true, blocks: true });
    }).then(function (r) {
      bar.style.width = "100%"; msg.textContent = "";
      var c = BMEngine.cleanOCR(r.data);
      $("#rawBox1").textContent = $("#rawBox2").textContent = c.raw || "(nothing)";
      $("#rawBox1").classList.add("hide"); $("#rawBox2").classList.add("hide");
      if (!c.text) {
        $("#ocrNone").classList.remove("hide");
        $("#rawShow1").classList.toggle("hide", !c.raw);
        $("#cropHint").innerHTML = "No clear text. Drag a box tightly around the words and tap <b>Read text</b> again.";
      } else {
        $("#ocrText").value = c.text;
        $("#ocrConf").textContent = "(" + c.confidence + "% confidence)";
        $("#ocrDropped").innerHTML = c.dropped ? 'Ignored ' + c.dropped + ' unclear line' + (c.dropped > 1 ? "s" : "") + ' (<button class="linkbtn" id="rawShow2">show</button>).' : "";
        $("#ocrOut").classList.remove("hide");
      }
      setTimeout(function () { prog.classList.add("hide"); }, 400);
      refreshScanState();
    }).catch(function (e) {
      prog.classList.add("hide");
      msg.innerHTML = '<span style="color:var(--red)">' + esc(e && e.message ? e.message : e) + "</span>";
    }).then(function () { busy = false; $("#ocrRun").disabled = false; });
  }
  function pickPhoto(file) {
    if (!file) return;
    $("#ocrMsg").textContent = "";
    loadPhoto(file).then(function () {
      $("#cropCard").classList.remove("hide");
      $("#cropHint").innerHTML = "Tip: drag a box around the text, then tap <b>Read text</b>. Everything outside the box is ignored.";
      runOCR();
    }).catch(function (e) { toast(e.message || "Could not open this image"); });
  }
  $("#camIn").addEventListener("change", function () { pickPhoto(this.files[0]); this.value = ""; });
  $("#imgIn").addEventListener("change", function () { pickPhoto(this.files[0]); this.value = ""; });
  $("#ocrRun").addEventListener("click", runOCR);
  $("#rawShow1").addEventListener("click", function () { $("#rawBox1").classList.toggle("hide"); });
  $("#ocrOut").addEventListener("click", function (e) { if (e.target.id === "rawShow2") $("#rawBox2").classList.toggle("hide"); });
  function ocrSend(d) {
    var t = $("#ocrText").value.trim(); if (!t) return;
    dir = d; store.set("dir", dir); dirUI(); src.value = t.replace(/\s*\n\s*/g, " "); showView("translate"); doTranslate();
  }
  $("#ocrToMs").addEventListener("click", function () { ocrSend("ms-en"); });
  $("#ocrToEn").addEventListener("click", function () { ocrSend("en-ms"); });
  $("#ocrCopy").addEventListener("click", function () { copy($("#ocrText").value); });
  $("#ocrLang").addEventListener("change", function () { if (photo) $("#cropHint").innerHTML = "Language changed. Tap <b>Read text</b> to read again."; });

  /* ---------- phrasebook ---------- */
  var pbCat = store.get("pbCat", "phrases"), pbShown = 0, pbItems = [];
  function renderCats() {
    var cats = [["phrases", "All phrases"], ["fav", "★ Saved"], ["all", "Everything"]];
    Object.keys(CATS).forEach(function (k) { cats.push([k, CATS[k].replace(/^Phrases - /, "")]); });
    $("#catBar").innerHTML = cats.map(function (c) { return '<button data-c="' + c[0] + '" class="' + (c[0] === pbCat ? "on" : "") + '">' + esc(c[1]) + "</button>"; }).join("");
  }
  function renderPhrases(reset) {
    if (reset) { pbShown = 0; renderCats(); }
    var q = $("#pbSearch").value;
    if (reset) {
      pbItems = pbCat === "fav" ? engine.search(q).filter(function (e) { return fav.has(favKey(e)); }) : engine.search(q, { cat: pbCat });
    }
    var next = pbItems.slice(pbShown, pbShown + 80);
    var html = next.map(itemHTML).join("");
    if (reset) $("#pbList").innerHTML = html || '<div class="empty"><b>Nothing found</b>' + (pbCat === "fav" ? "Tap the star on any word or phrase to save it here." : "Try another word, or add it in My words.") + "</div>";
    else $("#pbList").insertAdjacentHTML("beforeend", html);
    pbShown += next.length;
    $("#pbMore").classList.toggle("hide", pbShown >= pbItems.length);
  }
  function itemHTML(e) {
    var k = favKey(e);
    return '<div class="it"><div class="tx"><div class="ms">' + esc(e.ms) + '</div><div class="en">' + esc(e.en) + "</div>" +
      (e.note ? '<div class="nt">' + esc(e.note) + "</div>" : "") + "<div>" + catTag(e) + "</div></div>" +
      '<div class="acts"><button class="icon" data-say="' + esc(e.ms) + '" aria-label="Listen">' + ICON.speak + "</button>" +
      '<button class="icon star' + (fav.has(k) ? " on" : "") + '" data-fav="' + esc(k) + '" aria-label="Save">' + ICON.star + "</button></div></div>";
  }
  $("#catBar").addEventListener("click", function (ev) {
    var b = ev.target.closest("button"); if (!b) return;
    pbCat = b.dataset.c; store.set("pbCat", pbCat); renderPhrases(true);
  });
  $("#pbSearch").addEventListener("input", debounce(function () { renderPhrases(true); }, 150));
  $("#pbMore").addEventListener("click", function () { renderPhrases(false); });
  $("#pbList").addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-say],[data-fav]"); if (!t) return;
    if (t.dataset.say != null) speak(t.dataset.say.split(/\s*\/\s*/)[0], "ms");
    else {
      var k = t.dataset.fav;
      if (fav.has(k)) fav.delete(k); else fav.add(k);
      store.set("fav", Array.from(fav)); t.classList.toggle("on", fav.has(k));
      toast(fav.has(k) ? "Saved to ★ Saved" : "Removed");
    }
  });

  /* ---------- my words ---------- */
  var editId = null;
  (function fillCatSel() {
    var o = '<option value="gen">General</option>';
    Object.keys(CATS).forEach(function (k) { if (k !== "gen") o += '<option value="' + k + '">' + esc(CATS[k]) + "</option>"; });
    $("#mCat").innerHTML = o;
  })();
  function saveMine() { store.set("mine", mine); rebuild(); }
  function prefillMine(word) {
    showView("mine"); editId = null; formMode();
    if (dir === "ms-en") { $("#mMs").value = word; $("#mEn").value = ""; $("#mEn").focus(); }
    else { $("#mEn").value = word; $("#mMs").value = ""; $("#mMs").focus(); }
  }
  function formMode() {
    $("#mineFormTitle").textContent = editId ? "Edit word" : "Add a word or phrase";
    $("#mCancel").classList.toggle("hide", !editId);
    $("#mSave").textContent = editId ? "Save changes" : "Save word";
  }
  $("#mSave").addEventListener("click", function () {
    var ms = $("#mMs").value.trim(), en = $("#mEn").value.trim();
    if (!ms || !en) { toast("Fill in both Malay and English"); return; }
    var rec = { ms: ms, en: en, cat: $("#mCat").value, note: $("#mNote").value.trim() };
    if (editId) { var m = mine.find(function (x) { return x.id === editId; }); if (m) Object.assign(m, rec); }
    else { rec.id = "w" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); rec.ts = Date.now(); mine.unshift(rec); }
    saveMine(); editId = null; formMode();
    $("#mMs").value = $("#mEn").value = $("#mNote").value = "";
    renderMine(); toast("Saved - the translator uses it now");
    if (src.value.trim()) doTranslate();
  });
  $("#mCancel").addEventListener("click", function () { editId = null; formMode(); $("#mMs").value = $("#mEn").value = $("#mNote").value = ""; });
  function renderMine() {
    $("#mineCount").textContent = mine.length;
    var q = BMEngine.norm($("#mineSearch").value);
    var list = mine.filter(function (m) { return !q || BMEngine.norm(m.ms + " " + m.en + " " + (m.note || "")).indexOf(q) >= 0; });
    $("#mineList").innerHTML = list.length ? list.map(function (m) {
      return '<div class="it"><div class="tx"><div class="ms">' + esc(m.ms) + '</div><div class="en">' + esc(m.en) + "</div>" +
        (m.note ? '<div class="nt">' + esc(m.note) + "</div>" : "") + '<div><span class="tag">' + esc((CATS[m.cat] || "General").replace(/^Phrases - /, "")) + "</span></div></div>" +
        '<div class="acts"><button class="icon" data-say="' + esc(m.ms) + '">' + ICON.speak + '</button><button class="icon" data-edit="' + m.id + '">' + ICON.edit +
        '</button><button class="icon" data-del="' + m.id + '">' + ICON.del + "</button></div></div>";
    }).join("") : '<div class="empty"><b>No words yet</b>Add terms you hear on site, from tender documents, or tap a red word in the translator.</div>';
  }
  $("#mineSearch").addEventListener("input", debounce(renderMine, 150));
  var delArm = null;
  $("#mineList").addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-say],[data-edit],[data-del]"); if (!t) return;
    if (t.dataset.say != null) speak(t.dataset.say, "ms");
    else if (t.dataset.edit) {
      var m = mine.find(function (x) { return x.id === t.dataset.edit; }); if (!m) return;
      editId = m.id; $("#mMs").value = m.ms; $("#mEn").value = m.en; $("#mCat").value = m.cat || "gen"; $("#mNote").value = m.note || "";
      formMode(); window.scrollTo(0, 0);
    } else if (t.dataset.del) {
      if (delArm !== t.dataset.del) { delArm = t.dataset.del; toast("Tap delete again to remove"); setTimeout(function () { delArm = null; }, 3000); return; }
      mine = mine.filter(function (x) { return x.id !== t.dataset.del; }); delArm = null; saveMine(); renderMine(); toast("Deleted");
    }
  });
  function exportData() { return JSON.stringify({ app: "bm-translator", version: VERSION, exported: new Date().toISOString(), words: mine, favourites: Array.from(fav) }, null, 1); }
  $("#expBtn").addEventListener("click", function () {
    var blob = new Blob([exportData()], { type: "application/json" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "bm-translator-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  });
  $("#expCopy").addEventListener("click", function () {
    copy(mine.map(function (m) { return [m.ms, m.en, m.note || ""].map(function (x) { return /[,"]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }).join(", "); }).join("\n") || "(no words yet)");
  });
  function parseCSVLine(line) {
    if (line.indexOf("|") >= 0 && line.indexOf(",") < 0) return line.split("|").map(function (s) { return s.trim(); });
    var out = [], cur = "", q = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === "," || c === "\t" || c === ";") { out.push(cur.trim()); cur = ""; } else cur += c;
    }
    out.push(cur.trim()); return out;
  }
  $("#impIn").addEventListener("change", function () {
    var f = this.files[0]; this.value = ""; if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast("File too large (max 2 MB)"); return; }
    var clip = function (x, n) { return String(x == null ? "" : x).replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, n); };
    f.text().then(function (txt) {
      var incoming = [];
      try {
        var j = JSON.parse(txt);
        var arr = Array.isArray(j) ? j : (j.words || []);
        if (!Array.isArray(arr)) arr = [];
        arr.slice(0, 5000).forEach(function (w) {
          if (w && typeof w === "object" && w.ms && w.en) incoming.push({ ms: clip(w.ms, 300), en: clip(w.en, 300), note: clip(w.note, 300), cat: (typeof w.cat === "string" && CATS[w.cat]) ? w.cat : "gen" });
        });
        if (Array.isArray(j.favourites)) j.favourites.slice(0, 5000).forEach(function (k) { if (typeof k === "string" && k.length < 700) fav.add(k); });
        store.set("fav", Array.from(fav));
      } catch (e) {
        txt.split(/\r?\n/).forEach(function (line, i) {
          if (!line.trim()) return;
          var f2 = parseCSVLine(line);
          if (i === 0 && /^malay$/i.test(f2[0])) return;
          if (i < 5000 && f2[0] && f2[1]) incoming.push({ ms: clip(f2[0], 300), en: clip(f2[1], 300), note: clip(f2[2], 300), cat: (f2[3] && CATS[f2[3]]) ? f2[3] : "gen" });
        });
      }
      var have = new Set(mine.map(function (m) { return BMEngine.norm(m.ms) + "|" + BMEngine.norm(m.en); })), added = 0;
      incoming.forEach(function (w) {
        if (mine.length >= 10000 || !w.ms || !w.en) return;
        var k = BMEngine.norm(w.ms) + "|" + BMEngine.norm(w.en); if (have.has(k)) return; have.add(k);
        w.id = "w" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); w.ts = Date.now(); mine.push(w); added++;
      });
      saveMine(); renderMine(); toast(added ? "Imported " + added + " word" + (added > 1 ? "s" : "") : "No new words in that file", 3000);
    }).catch(function () { toast("Could not read that file"); });
  });

  /* ---------- settings ---------- */
  function fillVoices() {
    var v = allVoices(), sel = $("#voiceSel");
    var ms = v.filter(function (x) { return /^(ms|id|in)/i.test(x.lang); });
    var opts = '<option value="">Automatic (best Malay / Indonesian voice)</option>';
    ms.forEach(function (x) { opts += '<option value="' + esc(x.voiceURI) + '">' + esc(x.name + " (" + x.lang + ")") + "</option>"; });
    if (!ms.length) opts += '<option value="" disabled>No Malay voice found on this phone</option>';
    sel.innerHTML = opts; sel.value = settings.voiceURI || "";
  }
  function refreshSettings() {
    fillVoices();
    $("#rate").value = settings.rate; $("#rateV").textContent = settings.rate + "x";
    $("#mmEmail").value = settings.mmEmail || ""; mmUI();
    var sw = ("serviceWorker" in navigator) && navigator.serviceWorker.controller;
    scannerCached().then(function (ok) {
      $("#offStatus").innerHTML =
        (sw ? '<div class="ok">&#10003; Translator, phrasebook and My words work offline</div>' : '<div>Offline mode activates after the app is opened from its web address (https) once.</div>') +
        (ok ? '<div class="ok">&#10003; Photo scanner saved for offline use</div>' : "<div>Photo scanner not downloaded yet (about 8 MB).</div>");
      $("#dlScanner").classList.toggle("hide", ok);
    });
    if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then(function (p) {
      $("#storeInfo").textContent = p ? "Storage is protected - the phone won't clear your words automatically." : "Tip: install the app to the home screen so the phone keeps your saved words.";
    });
  }
  $("#voiceSel").addEventListener("change", function () { settings.voiceURI = this.value; saveSettings(); });
  $("#rate").addEventListener("input", function () { settings.rate = +this.value; $("#rateV").textContent = settings.rate + "x"; saveSettings(); });
  $("#testVoice").addEventListener("click", function () { speak("Selamat pagi. Tolong hantar sebut harga ke pejabat kami.", "ms"); });
  var EMAIL_RE = /^[^\s@<>"'`]{1,64}@[A-Za-z0-9.-]{1,180}\.[A-Za-z]{2,24}$/;
  function mmUI() {
    var e = settings.mmEmail || "";
    $("#mmStatus").innerHTML = e ? '<span class="ok-line">&#10003; Saved on this phone:</span> ' + esc(e) + "<br>Sent only to MyMemory to raise your free daily limit."
      : "Not set - online translation uses the free anonymous limit.";
    $("#mmRemove").classList.toggle("hide", !e);
  }
  $("#mmSave").addEventListener("click", function () {
    var v = $("#mmEmail").value.trim();
    if (!v) { settings.mmEmail = ""; saveSettings(); mmUI(); toast("Email removed"); return; }
    if (v.length > 120 || !EMAIL_RE.test(v)) { toast("That doesn't look like an email address"); $("#mmEmail").focus(); return; }
    settings.mmEmail = v; var ok = store.set("settings", settings); mmUI();
    toast(ok ? "Email saved" : "Could not save - storage is blocked on this browser");
  });
  $("#mmEmail").addEventListener("keydown", function (e) { if (e.key === "Enter") $("#mmSave").click(); });
  $("#mmRemove").addEventListener("click", function () { settings.mmEmail = ""; $("#mmEmail").value = ""; saveSettings(); mmUI(); toast("Email removed"); });
  $("#clrHist").addEventListener("click", function () { hist = []; store.set("hist", hist); renderHist(); toast("Cleared"); });
  $("#dlScanner").addEventListener("click", function () {
    if (!navigator.onLine) { toast("Connect to Wi-Fi or data first"); return; }
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) { toast("Close and reopen the app once, then try again", 3500); return; }
    var b = this; b.disabled = true; b.textContent = "Downloading...";
    var fresh = ocrWorker ? ocrWorker.terminate().catch(function () {}) : Promise.resolve();
    ocrWorker = null; ocrLoadedLang = "";
    fresh.then(function () { return getWorker("msa+eng", function (m) { b.textContent = "Downloading... " + (m.status === "loading language traineddata" ? "language data" : "scanner"); }); })
      .then(scannerCached).then(function (ok) { if (!ok) throw new Error("files not saved - reopen the app and retry"); })
      .then(function () { b.disabled = false; b.textContent = "Download scanner for offline use"; toast("Scanner ready offline"); refreshSettings(); })
      .catch(function (e) { b.disabled = false; b.textContent = "Download scanner for offline use"; toast("Download failed: " + (e.message || e), 3500); });
  });
  $("#updBtn").addEventListener("click", function () {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistration().then(function (r) { if (!r) { toast("Not installed from the web yet"); return; } return r.update().then(function () { toast(r.waiting || r.installing ? "Update found - reopening..." : "You have the latest version"); }); })
      .catch(function () { toast("Can't check while offline"); });
  });

  /* ---------- install & service worker ---------- */
  var deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferredPrompt = e; $("#installBtn").style.display = "inline-block"; });
  $("#installBtn").addEventListener("click", function () {
    if (!deferredPrompt) return;
    deferredPrompt.prompt(); deferredPrompt.userChoice.then(function () { deferredPrompt = null; $("#installBtn").style.display = "none"; });
  });
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register("sw.js").catch(function () {});
    navigator.serviceWorker.addEventListener("controllerchange", function () { if (hadController) { toast("App updated"); setTimeout(function () { location.reload(); }, 900); } });
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});

  /* ---------- version / what's new ---------- */
  function showVersions() {
    $("#verList").innerHTML = '<div class="vers">' + window.CHANGELOG.map(function (e) {
      return "<h3>v" + esc(e.v) + " <span>&middot; " + esc(e.date) + "</span></h3><ul>" + e.items.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>";
    }).join("") + "</div>";
    $("#verModal").classList.remove("hide");
  }
  function hideVersions() { $("#verModal").classList.add("hide"); }
  $("#btnVer").addEventListener("click", showVersions);
  $("#brandVer").addEventListener("click", showVersions);
  $("#verClose").addEventListener("click", hideVersions);
  $("#verModal").addEventListener("click", function (e) { if (e.target.id === "verModal") hideVersions(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") hideVersions(); });
  // after an update, show what changed once
  var seen = store.get("seenVersion", "");
  if (seen && seen !== VERSION) setTimeout(function () { showVersions(); }, 600);
  store.set("seenVersion", VERSION);

  /* ---------- start ---------- */
  $("#btnVer").textContent = "v" + VERSION; $("#brandVer").textContent = "v" + VERSION;
  $("#ver").textContent = VERSION;
  $("#glossCount").textContent = builtIn.length;
  dirUI(); netUI(); renderHist();
  src.value = store.get("draft", "");
  doTranslate();
  var startTab = store.get("tab", "translate");
  if (startTab !== "translate" && $("#v-" + startTab)) showView(startTab);
  window.BMApp = { engine: function () { return engine; }, speak: speak };
})();
