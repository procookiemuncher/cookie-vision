const MODEL = "gemini-3.8-flash";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });

// "data:image/png;base64,XXXX" -> Gemini inlineData part
function imagePart(dataUrl) {
  const m = /^data:(image\/[\w.+-]+);base64,(.+)$/.exec(dataUrl || "");
  return m ? { inlineData: { mimeType: m[1], data: m[2] } } : null;
}

export default {
  async fetch(request, env) {

    // Allow bookmarklet to call this from any website
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Alt+M in the bookmarklet asks for the model name
    if (request.method === "GET") return json({ model: MODEL });

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const { pageText, images } = body;

    if (!pageText || pageText.length < 20) {
      return json({ error: "No page text provided" }, 400);
    }

    if (!env.GEMINI_API_KEY) {
      return json({ error: "GEMINI_API_KEY secret is not set in Cloudflare" }, 500);
    }

    const imageParts = (Array.isArray(images) ? images : []).slice(0, 4).map(imagePart).filter(Boolean);

    const fullPrompt = `You are an expert tutor. Find and answer any questions in the page text below.
${imageParts.length ? "\nImages of the charts/figures on the page are attached. Read values, labels and shapes from them; they are part of the question.\n" : ""}
PRECISION:
- Never round or truncate any intermediate value, keep all decimal places until the final step
- For e^x: use at least 10 decimal places
- For (1 + r/n)^(nt): always compute using e^(nt x ln(1 + r/n)) for maximum precision
- Double-check all exponent calculations step by step
- When rounding the final answer, round to the closest value (up OR down, whichever is nearer)

FORMAT:
- Start response directly with ANSWER: — no intro text or preamble ever
- If page text is pure unreadable gibberish with no recognizable words or math, respond with:
  "ANSWER: Could not read page clearly."
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

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }, ...imageParts] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) return json({ error: "Gemini API error", details: data }, 500);

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (!text) return json({ error: "Empty Gemini response", raw: data }, 500);

      return json({ result: text, model: MODEL });

    } catch (err) {
      return json({ error: err.message }, 500);
    }
  },
};
