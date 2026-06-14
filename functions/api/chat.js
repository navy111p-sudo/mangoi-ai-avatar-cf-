// 망고아이 AI 상담직원 — Cloudflare Pages Function 백엔드
// 경로: POST /api/chat
// - Gemini 키는 Cloudflare 환경변수(Secret) GEMINI_API_KEY 에서만 읽음 → 브라우저로 노출되지 않아 안전.
// - 원본 Flask app.py 의 PERSONA / 동작을 그대로 옮김.

const GEMINI_MODEL = "gemini-2.5-flash";

const PERSONA =
  "너는 망고아이의 친절하고 상냥한 AI 상담원이야. " +
  "고객이 [수업 입장]에 대해 물어보면 화면 우측 하단의 버튼을 눌러 " +
  "원어민 선생님 방으로 들어가라고 안내하고, [결제하기]를 물어보면 " +
  "좌측 하단의 노란색 버튼을 통해 수강권을 구매할 수 있다고 차근차근 설명해줘. " +
  "어려운 IT 용어나 문어체는 피하고, 초등학생과 학부모도 단번에 이해할 수 있도록 " +
  "쉽고 다정한 구어체로 예시를 들며 답변해줘. 답변은 2~4문장으로 너무 길지 않게 해줘.";

// CORS 허용(다른 도메인의 망고아이 웹/앱에서 iframe·fetch 로 호출 가능하게)
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}

// 프리플라이트(OPTIONS) 처리
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body = {};
  try {
    body = await request.json();
  } catch (_) {
    body = {};
  }
  const message = ((body && body.message) || "").toString().trim();
  if (!message) {
    return json({ error: "message 가 비어 있습니다." }, 400);
  }

  const apiKey = env.GEMINI_API_KEY || "";
  if (!apiKey) {
    return json({
      answer: "지금은 데모 모드예요. 서버에 GEMINI_API_KEY 를 설정하면 똑똑하게 답해 드려요!",
    });
  }

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    GEMINI_MODEL +
    ":generateContent?key=" +
    encodeURIComponent(apiKey);

  const payload = {
    system_instruction: { parts: [{ text: PERSONA }] },
    contents: [{ role: "user", parts: [{ text: message }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
  };

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return json({
        answer: "죄송해요, 잠시 문제가 생겼어요. 다시 한 번 물어봐 주시겠어요?",
        detail: detail.slice(0, 500),
      });
    }

    const data = await resp.json();
    const text =
      (data &&
        data.candidates &&
        data.candidates[0] &&
        data.candidates[0].content &&
        data.candidates[0].content.parts &&
        data.candidates[0].content.parts[0] &&
        data.candidates[0].content.parts[0].text) ||
      "";
    const answer = text.trim() || "음, 다시 한 번 말씀해 주시겠어요?";
    return json({ answer });
  } catch (e) {
    return json({
      answer: "죄송해요, 잠시 문제가 생겼어요. 다시 한 번 물어봐 주시겠어요?",
      detail: String(e),
    });
  }
}
