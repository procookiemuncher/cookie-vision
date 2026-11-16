// ============================================================
//  AI SOLVER FOR TUTORING.ORG
//  Paste into browser console OR save as a bookmarklet
//
//  CONTROLS:
//  Alt+S → Solve current page (multiple choice: dash next to the correct letter)
//  Alt+N → Next step
//  Alt+B → Back a step
//  Alt+V → Toggle show/hide
//  Alt+H → toggle show/hide
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

  const elStep    = document.getElementById("__ss_step__");
  const elCounter = document.getElementById("__ss_counter__");

  // ── State ─────────────────────────────────────────────────
  let steps = [], currentStep = 0, visible = false, autoHideTimer = null;

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
    clearChoiceMarks();
  }

  function toggleVisible() { visible ? hide() : show(); }

  function clearStepsAndHide() {
    steps = []; currentStep = 0;
    elStep.innerHTML = "";
    elCounter.textContent = "";
    hide();
  }

  // ── Render step ───────────────────────────────────────────
  async function renderStep() {
    if (!steps.length) return;
    elStep.innerHTML = steps[currentStep] || "";
    elCounter.textContent = `${currentStep + 1}/${steps.length}`;
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

  function nextStep() {
    if (!steps.length) return;
    currentStep = (currentStep + 1) % steps.length;
    renderStep();
    if (!visible) show();
  }

  function prevStep() {
    if (!steps.length) return;
    currentStep = (currentStep - 1 + steps.length) % steps.length;
    renderStep();
    if (!visible) show();
  }

  // ── Page scraper ──────────────────────────────────────────
  function getPageText() {
    const tags = ["h1","h2","h3","h4","p","li","td","th","label","span","div","pre","code"];
    const seen = new Set(), chunks = [];
    tags.forEach(tag => {
      document.querySelectorAll(tag).forEach(el => {
        const t = el.innerText?.trim().replace(/\s+/g, " ");
        if (t && t.length > 8 && !seen.has(t)) { seen.add(t); chunks.push(t); }
      });
    });

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

    return cleaned.join("\n").slice(0, 4000);
  }

  // ── Worker API ────────────────────────────────────────────
  async function solveWithWorker(pageText, promptOverride) {
    const subject = detectSubject(pageText);
    const prompt = promptOverride || promptsConfig[subject];

    const res = await fetch(`${WORKER_URL}/solve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageText, subject, prompt })
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
  function parseResponse(text) {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    let answer = "";
    const parsedSteps = [];
    for (const line of lines) {
      if (line.startsWith("ANSWER:")) answer = line.replace("ANSWER:", "").trim();
      else if (line.startsWith("STEP:")) parsedSteps.push(line.replace("STEP:", "").trim());
    }
    return { answer, steps: parsedSteps };
  }

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

  function viewportArea(el) {
    const win = el.ownerDocument.defaultView;
    if (!win) return 0;
    const r = el.getBoundingClientRect();
    const w = Math.min(r.right, win.innerWidth) - Math.max(r.left, 0);
    const h = Math.min(r.bottom, win.innerHeight) - Math.max(r.top, 0);
    if (w <= 0 || h <= 0) return 0;
    const cs = win.getComputedStyle(el);
    return cs.visibility === "hidden" || cs.display === "none" ? 0 : w * h;
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
      if (!t || t.length > 300) return;
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

  function clearChoiceMarks() {
    clearInterval(markTimer);
    markNode?.remove();
    markNode = null;
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
  }

  async function runChoiceSolve(choices, pageText) {
    const optionList = choices.map(c => `${c.letter}. ${c.text}`).join("\n");
    const raw = await solveWithWorker(`${pageText}\n\nOPTIONS:\n${optionList}`, mcqPrompt);
    console.log("[ss] options", choices.map(c => c.letter + ": " + c.text), "reply", raw);
    const letter = (raw.match(/CHOICE:\s*\(?([A-Ha-h])\b/) || raw.match(/ANSWER:\s*\(?([A-Ha-h])\b/))?.[1]?.toUpperCase();
    const answerText = raw.match(/ANSWER:\s*(.+)/)?.[1]?.toLowerCase();
    const picked = choices.find(c => c.letter === letter)
      || (answerText && choices.find(c => c.text && answerText.includes(c.text.toLowerCase())));
    if (!picked) return false;
    markChoice(picked.el);
    visible = true;
    clearTimeout(autoHideTimer);
    autoHideTimer = setTimeout(hide, AUTO_HIDE_MS);
    return true;
  }

  // ── Solve ─────────────────────────────────────────────────
  async function runSolve() {
    clearChoiceMarks();
    const choices = findChoiceGroup();
    if (!choices) console.log("[ss] no multiple choice group found");
    if (choices) {
      try {
        const pageText = getPageText();
        if (await runChoiceSolve(choices, pageText)) return;
      } catch (e) { console.log("[ss] mcq failed", e); }
    }
    root.style.setProperty("opacity", "1", "important");
    visible = true;
    elStep.style.color = "rgba(0,0,0,1)";
    elStep.innerHTML = `<span style="color:rgba(0,0,0,0.4);font-size:11px;font-family:monospace">solving…</span>`;
    elCounter.textContent = "";
    steps = []; currentStep = 0;

    try {
      const pageText = getPageText();
      if (!pageText || pageText.length < 20) {
        elStep.innerHTML = `<span style="color:rgba(0,0,0,0.4);font-size:11px;font-family:monospace">no text found</span>`;
        return;
      }
      const raw = await solveWithWorker(pageText);
      const parsed = parseResponse(raw);
      if (!parsed.answer && !parsed.steps.length) {
        elStep.innerHTML = `<span style="color:rgba(0,0,0,0.4);font-size:11px;font-family:monospace">no answer found</span>`;
        return;
      }
      steps = [
        `<span style="font-size:8px;color:rgba(0,0,0,0.35);display:block;text-align:right;letter-spacing:0.08em;font-family:monospace">ans</span>$${parsed.answer}$`,
        ...parsed.steps
      ];
      currentStep = 0;
      await renderStep();
      root.style.setProperty("opacity", "1", "important");
      clearTimeout(autoHideTimer);
      autoHideTimer = setTimeout(hide, AUTO_HIDE_MS);
    } catch (e) {
      elStep.innerHTML = `<span style="color:rgba(0,0,0,0.4);font-size:11px;font-family:monospace">err: ${e.message.slice(0, 40)}</span>`;
      elCounter.textContent = "";
    }
  }

  // ── Keys ──────────────────────────────────────────────────
  document.addEventListener("keydown", (e) => {
    if (!e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "s") { e.preventDefault(); runSolve(); }
    if (k === "n") { e.preventDefault(); nextStep(); }
    if (k === "b") { e.preventDefault(); prevStep(); }
    if (k === "v") { e.preventDefault(); toggleVisible(); }
    if (k === "h") { e.preventDefault(); toggleVisible(); }
  });

})();
