// ============================================================
//  AI SOLVER — STEALTH MODE
//  Paste into browser console OR save as a bookmarklet
//  Replace YOUR_GEMINI_API_KEY with your actual key
//
//  CONTROLS:
//  Alt+S → Solve current page
//  Alt+N → Next step
//  Alt+B → Back a step
//  Alt+V → Toggle show/hide
//  Alt+H → Panic hide (instant wipe)
// ============================================================

(function () {

  const GEMINI_API_KEY = "AIzaSyCghXbUMN0zmsfYefdrY89YLv6xnRFSYaI";
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
  }

  function toggleVisible() { visible ? hide() : show(); }

  function panicHide() {
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
        const t = el.innerText?.trim();
        if (t && t.length > 8 && !seen.has(t)) { seen.add(t); chunks.push(t); }
      });
    });
    return chunks.join("\n").slice(0, 6000);
  }

  // ── Gemini API ────────────────────────────────────────────
  async function solveWithGemini(pageText) {
    const prompt = `You are an expert tutor. Find and answer any questions in the page text below.

PRECISION:
- Never round or truncate any intermediate value, keep all decimal places until the final step
- For e^x: use at least 10 decimal places
- For (1 + r/n)^(nt): always compute using e^(nt x ln(1 + r/n)) for maximum precision
- Double-check all exponent calculations step by step
- When rounding the final answer, round to the closest value (up OR down, whichever is nearer)

FORMAT:
- Start response directly with ANSWER: — no intro text or preamble ever
- If page text is corrupted or has repeated characters, respond with: "ANSWER: Could not read page clearly."
- Use LaTeX math notation for ALL equations, wrapped in $...$
- Format EVERY response EXACTLY like this (each on its own line, nothing else):

ANSWER: [final answer]
STEP: [formula in LaTeX]
STEP: [plug in numbers in LaTeX]
STEP: [simplify in LaTeX]
STEP: [simplify further in LaTeX]
STEP: [final calculation in LaTeX]
STEP: [rounded answer]

- Each STEP line shows ONE small change from the previous step
- No labels, no extra words, no blank lines — just ANSWER: and STEP: lines
- For written subjects: each STEP is one short sentence, no LaTeX needed
- Extract questions only, ignore all navigation, ads, and irrelevant page content

PAGE TEXT:
${pageText}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
        })
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
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

  // ── Solve ─────────────────────────────────────────────────
  async function runSolve() {
    // Force visible immediately
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
      const raw = await solveWithGemini(pageText);
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
      // Make sure still visible after render
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
    if (k === "h") { e.preventDefault(); panicHide(); }
  });

})();
