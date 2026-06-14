// 망고아이 AI 상담직원 — Cloudflare Worker (정적 자산 + Workers AI)
// - Cloudflare Workers AI 사용 → 외부 키 불필요, 지역 제한 없음, 같은 Cloudflare 안에서 동작.
// - 정적 파일(public/)은 자동으로 먼저 서빙됨. 이 Worker 는 /api/chat 만 처리.

const AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const PERSONA =
  "너는 망고아이의 친절하고 상냥한 AI 상담원이야. " +
  "고객이 [수업 입장]에 대해 물어보면 화면 우측 하단의 버튼을 눌러 " +
  "원어민 선생님 방으로 들어가라고 안내하고, [결제하기]를 물어보면 " +
  "좌측 하단의 노란색 버튼을 통해 수강권을 구매할 수 있다고 차근차근 설명해줘. " +
  "어려운 IT 용어나 문어체는 피하고, 초등학생과 학부모도 단번에 이해할 수 있도록 " +
  "쉽고 다정한 구어체로 예시를 들며 답변해줘. 답변은 2~4문장으로 너무 길지 않게, " +
  "반드시 한국어로만 답해줘.";

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

async function callAI(message, env) {
  if (!env.AI) {
    return { demo: true, answer: "지금은 데모 모드예요. Workers AI 바인딩(AI)을 설정하면 똑똑하게 답해 드려요!" };
  }
  const result = await env.AI.run(AI_MODEL, {
    messages: [
      { role: "system", content: PERSONA },
      { role: "user", content: message },
    ],
    max_tokens: 512,
    temperature: 0.7,
  });
  const text = ((result && result.response) || "").toString().trim();
  return { ok: true, answer: text || "음, 다시 한 번 말씀해 주시겠어요?" };
}

async function handleChat(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  // 헬스 체크(AI 호출 안 함 → 비용/오남용 방지)
  if (request.method === "GET") {
    return json({ status: "ok", note: "POST {\"message\":\"...\"} 로 질문하세요." });
  }

  if (request.method !== "POST") {
    return json({ error: "POST 메서드만 허용됩니다." }, 405);
  }

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

  try {
    const r = await callAI(message, env);
    return json({ answer: r.answer });
  } catch (e) {
    return json({
      answer: "죄송해요, 잠시 문제가 생겼어요. 다시 한 번 물어봐 주시겠어요?",
      detail: String(e),
    });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat") {
      return handleChat(request, env);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response("Not found", { status: 404 });
  },
};
