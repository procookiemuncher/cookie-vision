// ============================================================
//  AI SOLVER FOR TUTORING.ORG
//  Paste into browser console OR save as a bookmarklet
//
//  CONTROLS:
//  Alt+P → Snapshot this page as context (repeat for multi-part questions)
//  Alt+S → Solve current page, plus any snapshots (multiple choice: dash next to the correct letter)
//  Alt+H → Reveal the steps (again → hide the widget)
//  Ctrl+N / Alt+N → Next step (once revealed)
//  Alt+B → Back a step
//  Alt+V → Toggle show/hide
//  Alt+T → Type the answer into the nearest fill-in box (FRQ)
// ============================================================

(function () {

  const WORKER_URL = "https://cookie-vision.thegoatcodercookie.workers.dev";
  const WIDGET_ID = "__ss_widget__";
  const AUTO_HIDE_MS = 15000;

  if (document.getElementById(WIDGET_ID)) return;

  // ── Load MathJax ─────────────────────────────────────────
  if (!window.MathJax) {
    window.MathJax = {
      tex: { inlineMath: [['$', '$'], ['\\(', '\\)']] },
      options: { skipHtmlTags: ['script','noscript','style','textarea','pre'] }
    };
    const mj = document.createElement("script");
    mj.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js";
    mj.async = true;
    document.head.appendChild(mj);
  }

  // ── Subject Detection ──────────────────────────────────────
  const subjectKeywords = {
    Math: [
      /solv/i, /equation/i, /calculat/i, /find\s*x/i, /derivative/i, /graph/i,
      /integra/i, /factor/i, /simplif/i, /polynomial/i, /quadratic/i, /slope/i,
      /intercept/i, /exponent/i, /logarithm/i, /fraction/i, /inequalit/i,
      /trigonometr/i, /sine|cosine|tangent/i, /algebra/i, /geometry/i,
      /[+\-*/=<>]{2,}/, /\d+\s*[+\-*/^]\s*\d+/, /\bx\s*[=+\-*/^]\s*\d/i
    ],
    English: [
      /\bessay/i, /\banalyz/i, /\btheme/i, /\bcharacter/i, /\bargument/i,
      /\bquote/i, /\bdiscuss/i, /\bliterar/i, /\bmetaphor/i, /\bsymbol/i,
      /\bnarrat/i, /\bauthor/i, /\bpoem/i, /\brheto/i, /\bthesis/i,
      /\btone/i, /\bperspective/i, /\bpassage/i, /\bcontext\s*clue/i,
      /\bvocabulary/i, /\bgrammar/i, /\bsentence/i, /\bparagraph/i
    ],
    History: [
      /\bwar\b/i, /\brevolution/i, /\bpresident/i, /\btreaty/i, /\bciviliz/i,
      /\bcoloni/i, /\bempire/i, /\bamendment/i, /\bconstitution/i, /\bindependence/i,
      /\bcivil\s*rights/i, /\bcold\s*war/i, /\bworld\s*war/i, /\b\d{4}\s*(ad|bc|ce|bce)/i,
      /\bhistor/i, /\bancient/i, /\bmedieval/i, /\bdemocra/i, /\bmonarch/i
    ],
    Science: [
      /\breaction/i, /\batom/i, /\bDNA\b/i, /\bphotosynthe/i, /\bforce\b/i,
      /\benergy/i, /\bcell\b/i, /\bmolecul/i, /\belement/i, /\bchemic/i,
      /\bphysic/i, /\bbiolog/i, /\becosystem/i, /\bgravit/i, /\bveloci/i,
      /\bgenetic/i, /\bevolution/i, /\borganism/i, /\bhypothes/i, /\bexperiment/i
    ]
  };

  function detectSubject(pageText) {
    const scores = { Math: 0, English: 0, History: 0, Science: 0 };
    for (const [subject, patterns] of Object.entries(subjectKeywords)) {
      for (const pat of patterns) {
        const matches = pageText.match(new RegExp(pat, 'gi'));
        if (matches) scores[subject] += matches.length;
      }
    }
    let best = "Default", bestScore = 0;
    for (const [subject, score] of Object.entries(scores)) {
      if (score > bestScore) { bestScore = score; best = subject; }
    }
    return bestScore >= 2 ? best : "Default";
  }

  // ── Prompts Config ─────────────────────────────────────────
  const promptsConfig = {
    Math: `You are a math tutor. Find and solve the question.
ANSWER: [final answer]
STEP: [formula]
STEP: [plug in numbers]
STEP: [simplify]
STEP: [final result]
Be precise. No fluff.`,
    English: `You are an English teacher. Answer the question.
ANSWER: [main thesis/answer]
STEP: [evidence or reasoning 1]
STEP: [evidence or reasoning 2]
STEP: [conclusion]
Be concise.`,
    History: `You are a history expert. Answer the question.
ANSWER: [fact/date/answer]
STEP: [historical context]
STEP: [why it matters]
STEP: [related events]
Be factual.`,
    Science: `You are a science tutor. Answer the question.
ANSWER: [concept/answer]
STEP: [explanation 1]
STEP: [explanation 2]
STEP: [real-world example]
Be clear.`,
    Default: `Answer the question clearly.
ANSWER: [answer]
STEP: [reasoning 1]
STEP: [reasoning 2]`
  };

  // ── Styles ───────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    #${WIDGET_ID} {
      position: fixed !important;
      bottom: 16px !important;
      right: 18px !important;
      z-index: 2147483647 !important;
      padding: 10px 18px !important;
      min-width: 260px !important;
      max-width: 440px !important;
      background: transparent !important;
      border: none !important;
      border-radius: 6px !important;
      box-shadow: none !important;
      backdrop-filter: none !important;
      pointer-events: none !important;
      user-select: none !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      box-sizing: border-box !important;
      transition: opacity 0.2s !important;
    }
    #__ss_step__ {
      text-align: center !important;
      line-height: 1.7 !important;
      font-size: 14px !important;
      font-family: Georgia, serif !important;
      color: rgba(0,0,0,1) !important;
    }
    #__ss_step__ mjx-container {
      display: inline !important;
      margin: 0 2px !important;
    }
    #__ss_counter__ {
      position: absolute !important;
      bottom: 3px !important;
      right: 7px !important;
      font-family: monospace !important;
      font-size: 8px !important;
      letter-spacing: 0.06em !important;
      color: rgba(0,0,0,0.5) !important;
    }
    #__ss_mj__ mjx-container,
    #__ss_mj__ mjx-container * {
      color: rgba(0,0,0,1) !important;
      fill: rgba(0,0,0,1) !important;
    }
  `;
  document.head.appendChild(style);

  // ── MathJax color ─────────────────────────────────────────
  const mjStyle = document.createElement("style");
  mjStyle.id = "__ss_mj__";
  mjStyle.textContent = `
    #__ss_step__ mjx-container,
    #__ss_step__ mjx-container * {
      color: rgba(0,0,0,1) !important;
      fill: rgba(0,0,0,1) !important;
    }
  `;
  document.head.appendChild(mjStyle);

  // ── DOM ──────────────────────────────────────────────────
  const root = document.createElement("div");
  root.id = WIDGET_ID;
  root.style.cssText = "opacity:0;";
  root.innerHTML = `<div id="__ss_step__"></div><div id="__ss_counter__"></div>`;
  document.body.appendChild(root);

  // tiny dot in the bottom-right corner while a request is in flight
  const busyDot = document.createElement("div");
  busyDot.style.cssText = "position:fixed!important;right:8px!important;bottom:8px!important;width:6px!important;height:6px!important;border-radius:50%!important;background:rgba(0,0,0,0.45)!important;z-index:2147483647!important;pointer-events:none!important;display:none!important;";
  document.body.appendChild(busyDot);
  const setBusy = on => busyDot.style.setProperty("display", on ? "block" : "none", "important");

  const elStep    = document.getElementById("__ss_step__");
  const elCounter = document.getElementById("__ss_counter__");

  // ── State ─────────────────────────────────────────────────
  let steps = [], currentStep = 0, stepsRevealed = false, visible = false, autoHideTimer = null;
  let typeAnswer = "";
  let boxAnswers = new Map(); // answer box element -> what to type (pages with several fill-in boxes)

  // ── Visibility ────────────────────────────────────────────
  function show() {
    visible = true;
    root.style.setProperty("opacity", "1", "important");
    clearTimeout(autoHideTimer);
    autoHideTimer = setTimeout(hide, AUTO_HIDE_MS);
  }

  function hide() {
    visible = false;
    root.style.setProperty("opacity", "0", "important");
  }

  // the dash outlives the auto-hide; only the manual toggle or a new solve removes it
  function toggleVisible() {
    if (markNode) { clearChoiceMarks(); hide(); return; }
    visible ? hide() : show();
  }

  function clearStepsAndHide() {
    steps = []; currentStep = 0; stepsRevealed = false; typeAnswer = ""; boxAnswers = new Map();
    elStep.innerHTML = "";
    elCounter.textContent = "";
    clearChoiceMarks();
    hide();
  }

  // ── Render step ───────────────────────────────────────────
  async function renderStep() {
    if (!steps.length) return;
    elStep.innerHTML = steps[currentStep] || "";
    elCounter.textContent = stepsRevealed ? `${currentStep + 1}/${steps.length}` : "";
    if (window.MathJax?.typesetPromise) {
      await MathJax.typesetPromise([elStep]);
    } else {
      setTimeout(async () => {
        if (window.MathJax?.typesetPromise) await MathJax.typesetPromise([elStep]);
      }, 1500);
    }
    clearTimeout(autoHideTimer);
    autoHideTimer = setTimeout(hide, AUTO_HIDE_MS);
  }

  // Alt+H: reveal the steps; press again to hide the whole widget (Alt+N steps forward from there)
  function toggleSteps() {
    if (!steps.length) return;
    if (stepsRevealed && visible) {
      hide();
      return;
    }
    stepsRevealed = true;
    currentStep = steps.length > 1 ? 1 : 0;
    renderStep();
    show();
  }

  function nextStep() {
    if (!steps.length || !stepsRevealed) return;
    currentStep = (currentStep + 1) % steps.length;
    renderStep();
    if (!visible) show();
  }

  function prevStep() {
    if (!steps.length || !stepsRevealed) return;
    currentStep = (currentStep - 1 + steps.length) % steps.length;
    renderStep();
    if (!visible) show();
  }

  // ── Page scraper ──────────────────────────────────────────
  // Toolbars, menus and nav bars are noise; the question is never in them
  const CHROME_SELECTOR = 'nav,header,footer,aside,[role="toolbar"],[role="navigation"],[role="banner"],[role="menu"],[role="menubar"],[role="contentinfo"],[class*="toolbar" i],[class*="navbar" i]';

  function getPageText() {
    shownPass++;
    const tags = ["h1","h2","h3","h4","p","li","td","th","label","span","div","pre","code"];
    const collect = onlyShown => {
      const seen = new Set(), onscreen = [], offscreen = [];
      tags.forEach(tag => {
        deepQueryAll(tag).forEach(el => {
          if (root.contains(el) || el.closest(CHROME_SELECTOR) || !el.getClientRects().length) return;
          if (onlyShown && !isShown(el)) return;
          const t = el.innerText?.trim().replace(/\s+/g, " ");
          if (!t || t.length <= 8 || seen.has(t)) return;
          seen.add(t);
          // what the tutor can see goes first so a long page can't push the question out
          (viewportArea(el) > 0 ? onscreen : offscreen).push(t);
        });
      });
      return [...onscreen, ...offscreen];
    };
    // stacked questions: only what's actually on top. A page-wide invisible overlay would hide
    // everything, so if that leaves almost nothing, take the unfiltered text instead.
    let chunks = collect(true);
    if (chunks.join("").length < 40) chunks = collect(false);

    const lines = chunks.join("\n").split("\n");
    const seenLines = new Set();
    const cleaned = [];
    for (const line of lines) {
      const normalized = line.trim().toLowerCase();
      if (normalized && !seenLines.has(normalized)) {
        seenLines.add(normalized);
        cleaned.push(line.trim());
      }
    }

    return cleaned.join("\n").slice(0, 8000);
  }

  // ── Chart / image capture ─────────────────────────────────
  const MAX_TOTAL_IMAGES = 8, MAX_IMAGES = 4, MAX_SIDE = 1024, MIN_W = 80, MIN_H = 60;

  function drawToDataUrl(source, w, h) {
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * scale));
    c.height = Math.max(1, Math.round(h * scale));
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(source, 0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  }

  const loadImage = src => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

  async function elementToDataUrl(el) {
    const r = el.getBoundingClientRect();
    const w = Math.round(r.width), h = Math.round(r.height);
    if (el.tagName === "CANVAS") return drawToDataUrl(el, w, h);
    if (el.tagName === "IMG") {
      if (el.src.startsWith("data:")) return el.src;
      try { return drawToDataUrl(el, w, h); } catch (_) {}
      // cross-origin without CORS: the browser can't read it, so the worker fetches the URL itself
      const src = el.currentSrc || el.src;
      if (/^https?:/i.test(src)) return src;
      throw new Error("unreadable image " + src.slice(0, 30));
    }
    // SVG: serialize and rasterize
    const clone = el.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", w);
    clone.setAttribute("height", h);
    if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${w} ${h}`);
    const svgUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(clone));
    return drawToDataUrl(await loadImage(svgUrl), w, h);
  }

  // Biggest visible charts/figures on the page, as data URLs. Never throws.
  async function getPageImages() {
    const candidates = deepQueryAll("canvas,svg,img")
      .filter(el => !root.contains(el) && !el.closest?.("svg svg"))
      .map(el => {
        const r = el.getBoundingClientRect();
        return { el, w: r.width, h: r.height, area: viewportArea(el) };
      })
      .filter(c => c.area > 0 && c.w >= MIN_W && c.h >= MIN_H)
      .sort((a, b) => b.area - a.area);
    const out = (await Promise.all(candidates.slice(0, MAX_IMAGES).map(async c => {
      try { return await elementToDataUrl(c.el); }
      catch (e) { console.log("[ss] image skipped", c.el.tagName, e); return null; }
    }))).filter(Boolean);
    console.log("[ss] images", out.length);
    return out;
  }

  // ── Worker API ────────────────────────────────────────────
  async function solveWithWorker(pageText, promptOverride, snapshotImages = []) {
    const images = [...snapshotImages, ...await getPageImages()].slice(-MAX_TOTAL_IMAGES);
    const subject = detectSubject(pageText);
    const prompt = promptOverride || promptsConfig[subject];

    const res = await fetch(`${WORKER_URL}/solve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageText, subject, prompt, images, mode: promptOverride === mcqPrompt ? "choice" : promptOverride === blanksPrompt ? "blanks" : "solve" })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.result;
  }

  // ── Parse response ────────────────────────────────────────
  function plainAnswer(a) {
    let t = a.replace(/\$/g, "")
      .replace(/\\(?:d|t)?frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2")
      .replace(/\\sqrt\{([^{}]*)\}/g, "sqrt($1)")
      .replace(/\\(?:cdot|times)/g, "*").replace(/\\pi/g, "pi")
      .replace(/\\[a-zA-Z]+/g, "").replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
    return t.length > 60 ? "" : t;
  }

  function parseResponse(text) {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    let answer = "", type = "";
    const parsedSteps = [];
    for (const line of lines) {
      if (line.startsWith("ANSWER:")) answer = line.replace("ANSWER:", "").trim();
      else if (line.startsWith("TYPE:")) type = line.replace("TYPE:", "").trim();
      else if (line.startsWith("STEP:")) parsedSteps.push(line.replace("STEP:", "").trim());
    }
    type = /^none$/i.test(type) ? "" : type;
    // model skipped TYPE: fall back to the answer with the latex stripped
    if (!type && answer) type = plainAnswer(answer);
    return { answer, type, steps: parsedSteps };
  }

  const blanksPrompt = "blanks";

  // ── Multiple choice (adaptive) ────────────────────────────
  const mcqPrompt = `Find the multiple choice question and pick the single correct option from the OPTIONS list.
CHOICE: [letter only]
STEP: [one-line reason]
Be precise.`;

  // Walks open shadow roots and same-origin iframes
  function deepQueryAll(selector, scope = document, out = []) {
    scope.querySelectorAll(selector).forEach(el => out.push(el));
    scope.querySelectorAll("*").forEach(el => {
      if (el.shadowRoot) deepQueryAll(selector, el.shadowRoot, out);
      if (el.tagName === "IFRAME") {
        try { if (el.contentDocument) deepQueryAll(selector, el.contentDocument, out); } catch (_) {}
      }
    });
    return out;
  }

  const cleanText = el => (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ");

  // ── Real visibility ───────────────────────────────────────
  // Some sites stack every question on top of each other, so "inside the viewport" isn't enough:
  // an element only counts if it isn't faded out / hidden and nothing unrelated is painted over it.
  let shownPass = 0;
  const shownCache = new WeakMap();

  function styleShown(el) {
    const win = el.ownerDocument.defaultView;
    if (!win) return false;
    const cs = win.getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.visibility === "collapse" || parseFloat(cs.opacity) < 0.05) return false;
    const parent = el.parentElement || el.getRootNode?.().host;
    return parent ? styleShown(parent) : true;
  }

  function topElementAt(el, x, y) {
    let scope = el.getRootNode?.();
    if (!scope || !scope.elementFromPoint) scope = el.ownerDocument;
    let hit = scope.elementFromPoint(x, y);
    while (hit?.shadowRoot) {
      const inner = hit.shadowRoot.elementFromPoint(x, y);
      if (!inner || inner === hit) break;
      hit = inner;
    }
    return hit;
  }

  function computeShown(el) {
    const win = el.ownerDocument.defaultView;
    if (!win || !styleShown(el)) return false;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x >= win.innerWidth || y >= win.innerHeight) return true; // can't hit-test off screen
    let hit = null;
    try { hit = topElementAt(el, x, y); } catch (_) {}
    if (!hit) return true;
    return hit === el || el.contains(hit) || hit.contains(el);
  }

  // cached per pass (a pass = one Alt+S / Alt+P / Alt+T press) so big pages stay fast
  function isShown(el) {
    const c = shownCache.get(el);
    if (c && c.pass === shownPass) return c.v;
    const v = computeShown(el);
    shownCache.set(el, { pass: shownPass, v });
    return v;
  }

  function viewportArea(el) {
    const win = el.ownerDocument.defaultView;
    if (!win) return 0;
    const r = el.getBoundingClientRect();
    const w = Math.min(r.right, win.innerWidth) - Math.max(r.left, 0);
    const h = Math.min(r.bottom, win.innerHeight) - Math.max(r.top, 0);
    if (w <= 0 || h <= 0) return 0;
    return isShown(el) ? w * h : 0;
  }

  // The clickable row that holds an input / role element
  function optionElementFor(input, siblings) {
    if (!(input instanceof HTMLInputElement)) return input;
    const label = input.labels?.[0] || input.closest("label");
    if (label) return label;
    let el = input;
    for (let i = 0; i < 4 && el.parentElement; i++) {
      const p = el.parentElement;
      if (siblings.filter(s => p.contains(s)).length > 1 || cleanText(p).length > 300) break;
      el = p;
    }
    return el;
  }

  // Strategy 1: radio / checkbox inputs and ARIA roles
  function groupsFromInputs() {
    const inputs = deepQueryAll('input[type="radio"],input[type="checkbox"],[role="radio"],[role="option"],[role="checkbox"]');
    const buckets = new Map();
    for (const inp of inputs) {
      const key = (inp.name && inp.ownerDocument.location + "#" + inp.name)
        || inp.closest('[role="radiogroup"],[role="listbox"],[role="group"],fieldset')
        || inp.parentElement?.parentElement;
      if (!key) continue;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(inp);
    }
    const groups = [];
    for (const members of buckets.values()) {
      if (members.length < 2 || members.length > 10) continue;
      const els = members.map(m => optionElementFor(m, members));
      if (new Set(els).size !== els.length) continue;
      groups.push(els);
    }
    return groups;
  }

  // Strategy 2: options that start with a letter (A. / (B) / C:)
  function groupsFromLetters() {
    const byLetter = {};
    deepQueryAll("label,li,button,p,span,div").forEach(el => {
      if (root.contains(el)) return;
      const t = cleanText(el);
      if (!t || t.length > 300 || !isShown(el)) return;
      const m = t.match(/^\(?([A-Ha-h])[.):]?(\s+\S|$)/);
      if (!m) return;
      const letter = m[1].toUpperCase();
      const best = byLetter[letter];
      if (!best || t.length < cleanText(best).length) byLetter[letter] = el;
    });
    const letters = Object.keys(byLetter).sort();
    if (letters.length < 2 || letters[0] !== "A" || letters[1] !== "B") return [];
    return [letters.map(l => byLetter[l])];
  }

  // Strategy 3: a short row of similar, clickable siblings
  function groupsFromSiblings() {
    const groups = [];
    deepQueryAll("div,ul,ol,section,fieldset").forEach(parent => {
      if (root.contains(parent)) return;
      const kids = [...parent.children];
      if (kids.length < 2 || kids.length > 8) return;
      if (new Set(kids.map(k => k.tagName)).size !== 1) return;
      const ok = kids.every(k => {
        const t = cleanText(k);
        return t.length > 0 && t.length < 200 && viewportArea(k) > 0
          && (k.tagName === "BUTTON" || k.getAttribute("tabindex") !== null
              || k.ownerDocument.defaultView.getComputedStyle(k).cursor === "pointer");
      });
      if (ok) groups.push(kids);
    });
    return groups;
  }

  function pickBestGroup(groups) {
    let best = null, bestScore = 0;
    for (const els of groups) {
      const visible = els.filter(el => viewportArea(el) > 0).length;
      if (visible < els.length) continue;
      const score = els.reduce((sum, el) => sum + viewportArea(el), 0);
      if (score > bestScore) { bestScore = score; best = els; }
    }
    return best;
  }

  function findChoiceGroup() {
    for (const strategy of [groupsFromInputs, groupsFromLetters, groupsFromSiblings]) {
      let els = null;
      try { els = pickBestGroup(strategy()); } catch (_) {}
      if (els) {
        console.log("[ss] strategy", strategy.name, els.length, "options");
        return els.map((el, i) => ({
          el,
          letter: String.fromCharCode(65 + i),
          text: cleanText(el).replace(/^\(?[A-Ha-h][.):]\s*/, "")
        }));
      }
    }
    return null;
  }

  // The dash is an overlay on the top page; the site's own DOM is never touched
  let markNode = null, markTimer = null;

  let markDocs = [];

  function clearChoiceMarks() {
    clearInterval(markTimer);
    markNode?.remove();
    markNode = null;
    markDocs.forEach(d => d.removeEventListener("pointerdown", clearChoiceMarks, true));
    markDocs = [];
  }

  function placeMark(el) {
    if (!el.isConnected) { clearChoiceMarks(); return; }
    let { left, top, height } = el.getBoundingClientRect();
    for (let win = el.ownerDocument.defaultView; win && win.frameElement; win = win.parent) {
      const f = win.frameElement.getBoundingClientRect();
      left += f.left; top += f.top;
    }
    markNode.style.left = `${Math.max(2, left - 14)}px`;
    markNode.style.top = `${top + height / 2 - 10}px`;
  }

  function markChoice(el) {
    clearChoiceMarks();
    markNode = document.createElement("div");
    markNode.textContent = "-";
    markNode.style.cssText = "position:fixed!important;z-index:2147483647!important;font:bold 16px/20px monospace!important;color:rgba(0,0,0,0.55)!important;pointer-events:none!important;user-select:none!important;background:transparent!important;";
    document.body.appendChild(markNode);
    placeMark(el);
    markTimer = setInterval(() => placeMark(el), 150);
    // any click (top page or the option's own iframe) removes the dash
    markDocs = [...new Set([document, el.ownerDocument])];
    markDocs.forEach(d => d.addEventListener("pointerdown", clearChoiceMarks, true));
  }

  async function runChoiceSolve(choices, pageText, snapshotImages) {
    const optionList = choices.map(c => `${c.letter}. ${c.text}`).join("\n");
    const raw = await solveWithWorker(`${pageText}\n\nOPTIONS:\n${optionList}`, mcqPrompt, snapshotImages);
    console.log("[ss] options", choices.map(c => c.letter + ": " + c.text), "reply", raw);
    const letter = (raw.match(/CHOICE:\s*\(?([A-Ha-h])\b/) || raw.match(/ANSWER:\s*\(?([A-Ha-h])\b/))?.[1]?.toUpperCase();
    const answerText = raw.match(/ANSWER:\s*(.+)/)?.[1]?.toLowerCase();
    const picked = choices.find(c => c.letter === letter)
      || (answerText && choices.find(c => c.text && answerText.includes(c.text.toLowerCase())));
    if (!picked) return false;
    markChoice(picked.el);
    // the reason stays hidden until Alt+H
    steps = [
      `<span style="font-size:8px;color:rgba(0,0,0,0.35);display:block;text-align:right;letter-spacing:0.08em;font-family:monospace">ans</span>${picked.letter}`,
      ...parseResponse(raw).steps
    ];
    return true;
  }

  // ── Fill-in answer box (Alt+T) ─────────────────────────────
  const ANSWER_BOX_SELECTOR = 'input:not([type]),input[type="text"],input[type="number"],input[type="tel"],textarea,[contenteditable="true"]';

  // Closest visible, editable box to the center of the screen — that's whatever
  // question the student is currently looking at, not some stray search bar.
  function findAnswerBoxes() {
    return deepQueryAll(ANSWER_BOX_SELECTOR).filter(el => {
      if (root.contains(el) || el.disabled || el.readOnly) return false;
      const id = `${el.id} ${el.className} ${el.name || ""}`.toLowerCase();
      if (/search|filter/.test(id)) return false;
      // counts boxes scrolled off-screen too, otherwise the list depends on where the tutor is scrolled
      return isShown(el);
    });
  }

  function distFromCenter(el) {
    const win = el.ownerDocument.defaultView;
    const r = el.getBoundingClientRect();
    return Math.hypot(r.left + r.width / 2 - win.innerWidth / 2, r.top + r.height / 2 - win.innerHeight / 2);
  }

  // the box the tutor just clicked into wins, otherwise whatever is closest to the middle of the screen
  function findAnswerBox() {
    const candidates = findAnswerBoxes();
    if (!candidates.length) return null;
    const focused = candidates.find(el => el.ownerDocument.activeElement === el);
    if (focused) return focused;
    return candidates.sort((a, b) => distFromCenter(a) - distFromCenter(b))[0];
  }

  // Text of the question that belongs to this box: widen the container until it would swallow another box
  function boxContext(el, boxes) {
    let node = el.parentElement, best = "";
    while (node && node !== node.ownerDocument.body) {
      if (boxes.some(o => o !== el && node.contains(o))) break;
      const t = cleanText(node);
      if (t) best = t;
      if (t.length > 250) break;
      node = node.parentElement;
    }
    return best.slice(0, 250);
  }

  function setNativeValue(el, value) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    setter ? setter.call(el, value) : (el.value = value);
  }

  // Types char-by-char with real keyboard events, for inputs that ignore a plain .value set
  async function simulateTyping(el, text) {
    setNativeValue(el, "");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    for (const ch of text) {
      const opts = { key: ch, bubbles: true, cancelable: true };
      el.dispatchEvent(new KeyboardEvent("keydown", opts));
      el.dispatchEvent(new KeyboardEvent("keypress", opts));
      setNativeValue(el, el.value + ch);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent("keyup", opts));
    }
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function fillAnswerBox(el, text) {
    el.focus();
    if (el.isContentEditable) {
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    setNativeValue(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    // a controlled component that ignores the native setter will have reverted this
    await new Promise(r => setTimeout(r, 30));
    if (el.value !== text) await simulateTyping(el, text);
  }

  async function runTypeAnswer() {
    shownPass++;
    if (!typeAnswer && !boxAnswers.size) { console.log("[ss] alt+t: no typed answer from the last solve"); return; }
    const box = findAnswerBox();
    if (!box) { console.log("[ss] alt+t: no fillable box found on the page"); return; }
    const text = boxAnswers.size ? boxAnswers.get(box) : typeAnswer;
    if (!text) { console.log("[ss] alt+t: no answer for that box, click into the one you want or scroll it to the middle"); return; }
    console.log("[ss] alt+t: typing", JSON.stringify(text), "into", box.tagName, box.type || "", box.id || box.className || "");
    setBusy(true);
    try { await fillAnswerBox(box, text); console.log("[ss] alt+t: box value is now", JSON.stringify(box.value ?? box.textContent)); }
    finally { setBusy(false); }
  }

  // Page with several fill-in boxes (e.g. a list of Spanish questions): one request, one answer per box
  async function runBlanksSolve(boxes, ctx) {
    boxes = boxes.sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return (ra.top - rb.top) || (ra.left - rb.left);
    });
    const list = boxes.map((el, i) => `BOX ${i + 1} (nearby text: ${boxContext(el, boxes) || "none"})`).join("\n");
    const pageText = `${ctx.text}${getPageText()}\n\nFILL-IN BOXES (top to bottom):\n${list}`;
    const raw = await solveWithWorker(pageText, blanksPrompt, ctx.images);
    console.log("[ss] blanks reply:", JSON.stringify(raw.slice(0, 600)));
    const answers = [];
    for (const m of raw.matchAll(/^\s*BOX\s*(\d+)\s*[:.)-]\s*(.+)$/gim)) {
      const i = +m[1] - 1, text = m[2].trim();
      if (boxes[i] && text && !/^none$/i.test(text)) { boxAnswers.set(boxes[i], text); answers[i] = text; }
    }
    if (!boxAnswers.size) return false;
    steps = boxes.map((_, i) => `${i + 1}. ${(answers[i] || "—").replace(/&/g, "&amp;").replace(/</g, "&lt;")}`);
    return true;
  }

  // ── Snapshots (multi-part questions) ──────────────────────
  // Alt+P stores the current page; the next Alt+S solves with all of them as context
  let snapshots = [];

  async function takeSnapshot() {
    setBusy(true);
    try {
      snapshots.push({ text: getPageText(), images: await getPageImages() });
      console.log("[ss] snapshot", snapshots.length);
    } finally { setBusy(false); }
    // two quick blinks confirm the capture
    for (let i = 0; i < 2; i++) {
      setBusy(true); await new Promise(r => setTimeout(r, 150));
      setBusy(false); await new Promise(r => setTimeout(r, 150));
    }
  }

  function takeSnapshots() {
    const taken = snapshots;
    snapshots = [];
    if (!taken.length) return { text: "", images: [] };
    const seen = new Set();
    const parts = taken.map((snap, i) => {
      const lines = snap.text.split("\n").filter(l => !seen.has(l.toLowerCase()) && seen.add(l.toLowerCase()));
      return `EARLIER PART ${i + 1}:\n${lines.join("\n")}`;
    });
    return {
      text: `${parts.join("\n\n")}\n\nCURRENT PART (answer this one, using the earlier parts as context):\n`,
      images: taken.flatMap(s => s.images)
    };
  }

  // ── Solve ─────────────────────────────────────────────────
  async function runSolve() {
    shownPass++;
    setBusy(true);
    try { await solveCurrentPage(); } finally { setBusy(false); }
  }

  async function solveCurrentPage() {
    clearChoiceMarks();
    steps = []; currentStep = 0; stepsRevealed = false; typeAnswer = ""; boxAnswers = new Map();
    hide();
    const ctx = takeSnapshots();
    const boxes = findAnswerBoxes();
    if (boxes.length >= 2) {
      console.log("[ss]", boxes.length, "answer boxes found, solving them one by one");
      try {
        if (await runBlanksSolve(boxes, ctx)) {
          currentStep = 0;
          stepsRevealed = true;
          await renderStep();
          clearTimeout(autoHideTimer);
          autoHideTimer = setTimeout(hide, AUTO_HIDE_MS);
          return;
        }
      } catch (e) { console.log("[ss] blanks failed", e); }
    }
    const choices = findChoiceGroup();
    if (!choices) console.log("[ss] no multiple choice group found");
    if (choices) {
      try {
        const pageText = ctx.text + getPageText();
        if (await runChoiceSolve(choices, pageText, ctx.images)) return;
      } catch (e) { console.log("[ss] mcq failed", e); }
    }
    // stays hidden while solving; Alt+H reveals the answer
    elStep.style.color = "rgba(0,0,0,1)";
    elCounter.textContent = "";
    steps = []; currentStep = 0; stepsRevealed = false;

    try {
      const pageText = ctx.text + getPageText();
      if (!pageText || pageText.length < 20) {
        elStep.innerHTML = `<span style="color:rgba(0,0,0,0.4);font-size:11px;font-family:monospace">no text found</span>`;
        show();
        return;
      }
      const raw = await solveWithWorker(pageText, undefined, ctx.images);
      const parsed = parseResponse(raw);
      console.log("[ss] solve reply:", JSON.stringify(raw.slice(0, 300)), "-> type:", JSON.stringify(parsed.type));
      if (!parsed.answer && !parsed.steps.length) {
        elStep.innerHTML = `<span style="color:rgba(0,0,0,0.4);font-size:11px;font-family:monospace">no answer found</span>`;
        show();
        return;
      }
      steps = [
        `<span style="font-size:8px;color:rgba(0,0,0,0.35);display:block;text-align:right;letter-spacing:0.08em;font-family:monospace">ans</span>$${parsed.answer}$`,
        ...parsed.steps
      ];
      typeAnswer = parsed.type;
      currentStep = 0;
      await renderStep();
      root.style.setProperty("opacity", "1", "important");
      clearTimeout(autoHideTimer);
      autoHideTimer = setTimeout(hide, AUTO_HIDE_MS);
    } catch (e) {
      elStep.innerHTML = `<span style="color:rgba(0,0,0,0.4);font-size:11px;font-family:monospace">err: ${e.message.slice(0, 40)}</span>`;
      elCounter.textContent = "";
      show();
    }
  }

  // ── Keys ──────────────────────────────────────────────────
  document.addEventListener("keydown", (e) => {
    // use the physical key so mac option+letter (which types ß, ∂, etc) still works
    const k = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3).toLowerCase() : e.key.toLowerCase();
    if (e.ctrlKey && !e.altKey && k === "n") { e.preventDefault(); nextStep(); return; }
    if (!e.altKey) return;
    if (k === "s") { e.preventDefault(); runSolve(); }
    if (k === "p") { e.preventDefault(); takeSnapshot(); }
    if (k === "n") { e.preventDefault(); nextStep(); }
    if (k === "b") { e.preventDefault(); prevStep(); }
    if (k === "v") { e.preventDefault(); toggleVisible(); }
    if (k === "h") { e.preventDefault(); steps.length ? toggleSteps() : toggleVisible(); }
    if (k === "t") { e.preventDefault(); runTypeAnswer(); }
  });

})();
