// ============================================================
//  AI SOLVER FOR TUTORING.ORG — BETA
//  Paste into browser console OR save as a bookmarklet
//
//  CONTROLS:
//  Alt+S → Solve current page
//  Alt+N → Next step
//  Alt+B → Back a step
//  Alt+V → Toggle show/hide
//  Alt+H → Toggle show/hide
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
        const matches = pageText.match(new RegExp(pat.source, 'gi'));
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
  let solving = false; // FIX 3: race condition lock

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

  function toggleVisible() { visible ? hide() : show(); }

  function panicHide() {
    steps = []; currentStep = 0;
    elStep.innerHTML = "";
    elCounter.textContent = "";
    hide();
  }

  // ── Safe text helper (FIX 7: XSS prevention) ─────────────
  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showStatus(msg) {
    elStep.innerHTML = `<span style="color:rgba(0,0,0,0.4);font-size:11px;font-family:monospace">${escapeHtml(msg)}</span>`;
  }

  // ── MathJax with retry (FIX 5: unreliable 1500ms guess) ──
  async function tryTypeset(el) {
    const MAX_WAIT = 8000;
    const INTERVAL = 300;
    let waited = 0;
    while (waited < MAX_WAIT) {
      if (window.MathJax?.typesetPromise) {
        await MathJax.typesetPromise([el]);
        return;
      }
      await new Promise(r => setTimeout(r, INTERVAL));
      waited += INTERVAL;
    }
    // MathJax never loaded — content still shows as plain text, no silent failure
  }

  // ── Render step ───────────────────────────────────────────
  async function renderStep() {
    if (!steps.length) return;
    elStep.innerHTML = steps[currentStep] || "";
    elCounter.textContent = `${currentStep + 1}/${steps.length}`;
    await tryTypeset(elStep); // FIX 5
    clearTimeout(autoHideTimer); // FIX 6: only set timer once here, not again in runSolve
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

  // ── Page scraper (FIX 4: scrape from inside iframe via contentWindow.eval) ──
  function scrapeDoc(doc) {
    const tags = ["h1","h2","h3","h4","p","li","td","th","label","span","div","pre","code"];
    const seen = new Set(), chunks = [];
    tags.forEach(tag => {
      doc.querySelectorAll(tag).forEach(el => {
        const t = el.innerText?.trim().replace(/\s+/g, " ");
        if (t && t.length > 8 && t.length < 1500 && !seen.has(t)) {
          seen.add(t);
          chunks.push(t);
        }
      });
    });
    const lines = chunks.join("\n").split("\n");
    const seenLines = new Set(), cleaned = [];
    for (const line of lines) {
      const n = line.trim().toLowerCase();
      if (n && !seenLines.has(n)) { seenLines.add(n); cleaned.push(line.trim()); }
    }
    return cleaned.join("\n").slice(0, 4000);
  }

  function getPageText() {
    // Try each iframe first using contentWindow.eval so the scraper
    // runs from INSIDE the iframe context — same as pasting in the iframe console
    const iframes = document.querySelectorAll("iframe");
    for (const iframe of iframes) {
      try {
        const iframeText = iframe.contentWindow.eval(`
          (function() {
            var tags = ["h1","h2","h3","h4","p","li","td","th","label","span","div","pre","code"];
            var seen = new Set(), chunks = [];
            tags.forEach(function(tag) {
              document.querySelectorAll(tag).forEach(function(el) {
                var t = el.innerText && el.innerText.trim().replace(/\\s+/g, " ");
                if (t && t.length > 8 && t.length < 1500 && !seen.has(t)) {
                  seen.add(t); chunks.push(t);
                }
              });
            });
            var lines = chunks.join("\\n").split("\\n");
            var sl = new Set(), cl = [];
            lines.forEach(function(l) {
              var n = l.trim().toLowerCase();
              if (n && !sl.has(n)) { sl.add(n); cl.push(l.trim()); }
            });
            return cl.join("\\n").slice(0, 4000);
          })()
        `);
        if (iframeText && iframeText.length > 50) return iframeText;
      } catch(e) {
        // Cross-origin or blocked — fall through
      }
    }
    // No usable iframe content — fall back to outer page
    return scrapeDoc(document);
  }

  // ── Worker API ────────────────────────────────────────────
  async function solveWithWorker(pageText) {
    const subject = detectSubject(pageText);
    const prompt = promptsConfig[subject];

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
    return { result: data.result, subject };
  }

  // ── Parse response (FIX 2: robust case-insensitive parsing) ──
  function parseResponse(text) {
    // Strip markdown bold markers the AI sometimes adds
    const cleaned = text.replace(/\*\*/g, "").replace(/__/g, "");
    const lines = cleaned.split("\n").map(l => l.trim()).filter(Boolean);
    let answer = "";
    const parsedSteps = [];

    for (const line of lines) {
      // Case-insensitive, tolerates space before colon: "Answer : foo"
      const answerMatch = line.match(/^answer\s*:\s*/i);
      const stepMatch   = line.match(/^step\s*\d*\s*:\s*/i);
      if (answerMatch)    answer = line.slice(answerMatch[0].length).trim();
      else if (stepMatch) parsedSteps.push(line.slice(stepMatch[0].length).trim());
    }

    return { answer, steps: parsedSteps };
  }

  // ── Format answer for subject (FIX 1: no math wrapping for non-math) ──
  function formatAnswer(answer, subject) {
    const tag = `<span style="font-size:8px;color:rgba(0,0,0,0.35);display:block;text-align:right;letter-spacing:0.08em;font-family:monospace">ans</span>`;
    if (subject === "Math") {
      // Strip any $ the AI already added to avoid double-wrapping ($$answer$$)
      const clean = answer.replace(/^\$+|\$+$/g, "").trim();
      return `${tag}$${clean}$`;
    }
    return `${tag}${escapeHtml(answer)}`;
  }

  // ── Solve ─────────────────────────────────────────────────
  async function runSolve() {
    // FIX 3: prevent concurrent solves
    if (solving) return;
    solving = true;

    root.style.setProperty("opacity", "1", "important");
    visible = true;
    elStep.style.color = "rgba(0,0,0,1)";
    showStatus("solving…");
    elCounter.textContent = "";
    steps = []; currentStep = 0;

    try {
      let pageText = getPageText();
      // Retry once if content is too short — iframe may still be loading
      if (!pageText || pageText.length < 80) {
        await new Promise(r => setTimeout(r, 900));
        pageText = getPageText();
      }
      if (!pageText || pageText.length < 20) {
        showStatus("no text found");
        return;
      }
      const { result: raw, subject } = await solveWithWorker(pageText);
      const parsed = parseResponse(raw);
      if (!parsed.answer && !parsed.steps.length) {
        showStatus("no answer found");
        return;
      }
      steps = [
        formatAnswer(parsed.answer, subject), // FIX 1
        ...parsed.steps.map(s => escapeHtml(s)) // FIX 7: escape step text too
      ];
      currentStep = 0;
      await renderStep(); // FIX 6: renderStep owns the auto-hide timer, not runSolve
      root.style.setProperty("opacity", "1", "important");
    } catch (e) {
      showStatus(`err: ${e.message.slice(0, 60)}`); // FIX 7: escaped via showStatus
      elCounter.textContent = "";
    } finally {
      solving = false; // FIX 3: always release the lock
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
