// 망고아이 AI 상담직원 — Cloudflare Worker
// - 정적 파일(public/)은 자동 서빙. 이 Worker 는 /api/chat, /api/tts 처리.
// - /api/chat : Cloudflare Workers AI 로 답변 생성(외부 키 불필요).
// - /api/tts  : 타입캐스트(Typecast) 한국어 음성 합성. 키는 환경변수 TYPECAST_API_KEY 에서만 읽음.

const AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const PERSONA =
  "너는 망고아이의 친절하고 상냥한 AI 상담원이야. " +
  "초등학생과 학부모도 단번에 이해할 수 있게 쉽고 다정하게, 2~4문장으로 답해줘. " +
  "★ 매우 중요: 사용자가 메시지에 쓴 언어와 똑같은 언어로 답해줘 — 한국어로 물으면 한국어로, 영어로 물으면 영어로 답해. " +
  "한국어로 답할 때는 정중한 존댓말(해요체·합니다체)만 쓰고 반말은 절대 금지.\n" +
  "[화면 사용 안내 — 아래 적힌 사실만 정확히 안내하고, 이 목록에 없는 메뉴/버튼 위치나 조작 방법은 절대 지어내지 마.]\n" +
  "- 수업 입장: 화면 우측 하단의 버튼을 눌러 원어민 선생님 방으로 입장합니다.\n" +
  "- 결제 / 수강권 구매: 좌측 하단의 노란색 버튼을 누르면 됩니다.\n" +
  "- 성적표 / 평가표: 화면 왼쪽 사이드바 메뉴를 열면 '평가표(성적표)'가 있고, 그것을 누르면 수업 성적과 기록을 확인할 수 있습니다. " +
  "(우측 상단 프로필이 아니라 '왼쪽 사이드바의 평가표'가 정답입니다.)\n" +
  "- 시간표 / 출석 확인: 왼쪽 메뉴(또는 로그인)에서 '마이페이지'를 열면 확인할 수 있습니다.\n" +
  "- 교재 / 수업 자료 / 자료실: '자료실'(교재·다운로드) 메뉴에서 보실 수 있습니다. 숙제는 '마이페이지'에서 확인할 수 있어요.\n" +
  "- 수업 연기: 왼쪽 메뉴를 열어 '수업 연기'(연기/변경)를 누르면 됩니다. 수업 연기는 반드시 수업 시작 30분 전에 하셔야 합니다. " +
  "자세한 내용이 필요하시면 화면 하단의 '카톡 상담'에 글을 남겨 주시면 처리해 드려요. 다만 상담원이 다른 상담으로 바빠서 늦어질 수 있으니, " +
  "가능하면 메뉴에서 직접 '수업 연기'를 눌러 처리해 주시길 꼭 부탁드립니다.\n" +
  "- 수업 변경: 왼쪽 메뉴를 열고 '수업 변경'(연기/변경)을 누르면 됩니다.\n" +
  "- 회원정보 수정 / 비밀번호 변경: 우측 상단의 로그인 표시 또는 왼쪽 메뉴의 '마이페이지'에 들어가서 변경합니다.\n" +
  "- 레벨테스트 / 실력 진단: 왼쪽 메뉴(또는 전체메뉴)의 '레벨테스트'에서 신청합니다. 선생님 1:1 평가와 AI 자동 진단을 함께 진행해 정확한 레벨을 찾아드려요. 원하는 날짜·시간을 골라 예약하면 됩니다.\n" +
  "- 환불 문의: 화면 하단의 '카톡 상담'에 글을 남겨 주시면 처리해 드립니다.\n" +
  "위 목록에 없는 메뉴 위치를 물어보면 추측해서 답하지 말고, '정확한 위치를 확인한 뒤 안내드릴게요' 라고 하거나 하단 카톡 상담 연결을 권해줘.\n" +
  "[페이지 바로 열기 기능] 질문이 아래 코드 목록의 메뉴와 관련 있으면, 짧게 안내한 뒤 마지막 문장으로 '○○ 페이지를 열어드릴까요?'라고 물어봐. " +
  "그리고 답변의 맨 끝(마침표 뒤)에 사용자에게 보이지 않는 태그 [[GO:코드]] 를 정확히 한 개만 붙여줘. 태그는 설명하지 말고 그냥 붙이기만 해.\n" +
  "코드 목록: lesson-enter(수업 입장=지금 화상수업 로비로 들어가기), lesson-change(수업 연기/변경=일정 바꾸기), leveltest(레벨테스트/실력 진단 신청), library(교재/수업 자료/자료실), report(평가표/성적표), mypage(마이페이지/학생 대시보드), payment(결제/수강권), booking(수업 신청/예약), precheck(수업 진단), teachers(교사 소개), review-quiz(복습퀴즈), all-menu(전체메뉴).\n" +
  "★ 매우 중요: '수업 입장/수업 들어가기'는 반드시 lesson-enter 다. '수업 연기/변경/취소'는 lesson-change 다. 이 둘을 절대 바꿔 쓰지 마.\n" +
  "이 목록에 없는 주제면 '열어드릴까요?'도, 태그도 절대 붙이지 마. 한 답변에 태그는 최대 한 개.";

const PERSONA_EN =
  "You are Mangoi's friendly, warm AI assistant. Always reply politely in natural English, " +
  "in a simple, kind tone that both children and parents can easily understand, in 2-4 short sentences. " +
  "IMPORTANT: always reply in the SAME language as the user's message — if they ask in English, answer in English; if they ask in Korean, answer in Korean.\n" +
  "[Screen guidance — only state the facts listed below; never invent menu/button locations or steps not in this list.]\n" +
  "- Enter class: tap the button at the bottom-right to enter the native teacher's room.\n" +
  "- Payment / buy passes: tap the yellow button at the bottom-left.\n" +
  "- Report card / evaluation: open the left sidebar menu and tap 'Report (grades)' to see class results and records. (It's the left sidebar's report, not the top-right profile.)\n" +
  "- Timetable / attendance: open 'My Page' from the left menu (or after login).\n" +
  "- Textbooks / class materials / library: see the 'Library' (textbooks & downloads) menu. Homework is in 'My Page'.\n" +
  "- Postpone a class: open the left menu and tap 'Postpone' (postpone/change). It must be done at least 30 minutes before the class starts. If you need help, leave a message in the 'KakaoTalk consult' at the bottom; an agent may be slow if busy, so please try to postpone yourself from the menu.\n" +
  "- Change a class: open the left menu and tap 'Change' (postpone/change).\n" +
  "- Edit member info / change password: use the login area at the top-right or 'My Page' in the left menu.\n" +
  "- Level test / placement: apply from 'Level Test' in the left menu (or all-menu). It combines a 1:1 teacher evaluation and AI auto-diagnosis; pick a date and time to book.\n" +
  "- Refund inquiry: leave a message in the 'KakaoTalk consult' at the bottom.\n" +
  "If asked about a location not in this list, don't guess — say 'Let me check the exact location and guide you,' or suggest the bottom KakaoTalk consult.\n" +
  "[Open-page feature] If the question relates to a menu in the code list below, give a short answer, then as the last sentence ask 'Would you like me to open the ○○ page?' " +
  "and append exactly one hidden tag [[GO:code]] at the very end (after the period). Do not explain the tag; just append it.\n" +
  "Code list: lesson-enter (enter class = go to the live class lobby now), lesson-change (postpone/change a class), leveltest (level test/placement), library (textbooks/materials/library), report (report card/grades), mypage (my page/student dashboard), payment (payment/passes), booking (book a class), precheck (class diagnosis), teachers (meet teachers), review-quiz (review quiz), all-menu (full menu).\n" +
  "Very important: 'enter class' is always lesson-enter; 'postpone/change/cancel a class' is lesson-change. Never swap these.\n" +
  "If the topic isn't in the list, don't ask 'shall I open?' and don't append a tag. At most one tag per reply.";

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

// ===== 답변 생성 (Workers AI) =====
async function callAI(message, env, lang) {
  const isEn = lang === "en";
  if (!env.AI) {
    return { answer: isEn ? "Demo mode for now. Set the Workers AI (AI) binding for smart replies!" : "지금은 데모 모드예요. Workers AI 바인딩(AI)을 설정하면 똑똑하게 답해 드려요!" };
  }
  const result = await env.AI.run(AI_MODEL, {
    messages: [
      { role: "system", content: isEn ? PERSONA_EN : PERSONA },
      { role: "user", content: message },
    ],
    max_tokens: 512,
    temperature: 0.7,
  });
  const text = ((result &&
    (result.response ||
      result.text ||
      (result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content))) || "")
    .toString().trim();
  return { answer: text || (isEn ? "Sorry, could you say that again?" : "음, 다시 한 번 말씀해 주시겠어요?") };
}

// 허용된 페이지 열기 코드 + 답변에서 [[GO:코드]] 추출 & 잔여 태그 제거(깨진 변형 포함)
const GO_CODES = ["lesson-enter","lesson-change","leveltest","library","report","mypage","payment","booking","precheck","teachers","review-quiz","all-menu"];
function extractGo(text) {
  let go = null;
  const m = text.match(/\[\[\s*GO\s*:\s*([a-zA-Z_\-]+)\s*\]\]/);
  if (m) {
    const code = m[1].toLowerCase().replace(/_/g, "-");
    if (GO_CODES.indexOf(code) >= 0) go = code;
  }
  const clean = text
    .replace(/\[\[\s*GO\s*:[^\]]*\]\]/gi, "")
    .replace(/\[\[\s*GO[^\]]*\]?\]?/gi, "")
    .trim();
  return { answer: clean || "음, 다시 한 번 말씀해 주시겠어요?", go: go };
}

async function handleChat(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method === "GET") return json({ status: "ok", note: "POST {\"message\":\"...\"}" });
  if (request.method !== "POST") return json({ error: "POST 메서드만 허용됩니다." }, 405);

  let body = {};
  try { body = await request.json(); } catch (_) {}
  const message = ((body && body.message) || "").toString().trim().slice(0, 1000);
  const lang = /[가-힣]/.test(message) ? "ko" : "en";   // 입력 메시지 언어 자동 감지(토글과 무관)
  if (!message) return json({ error: "message 가 비어 있습니다." }, 400);

  try {
    const r = await callAI(message, env, lang);
    const parsed = extractGo(r.answer);
    return json({ answer: parsed.answer, go: parsed.go });
  } catch (e) {
    return json({ answer: lang === "en" ? "Sorry, something went wrong. Could you ask again?" : "죄송해요, 잠시 문제가 생겼어요. 다시 한 번 물어봐 주시겠어요?", detail: String(e) });
  }
}

// ===== 음성 합성 (Typecast) =====
let cachedVoiceId = null; // 동일 isolate 재사용

async function pickVoiceId(env) {
  if (env.TYPECAST_VOICE_ID) return env.TYPECAST_VOICE_ID;
  if (cachedVoiceId) return cachedVoiceId;
  try {
    const r = await fetch(
      "https://api.typecast.ai/v2/voices?model=ssfm-v30&gender=female&age=young_adult",
      { headers: { "X-API-KEY": env.TYPECAST_API_KEY } }
    );
    if (r.ok) {
      const data = await r.json();
      const list = Array.isArray(data) ? data : (data && (data.voices || data.data || data.result));
      if (Array.isArray(list)) {
        const v = list.find((x) => x && x.voice_id);
        if (v) { cachedVoiceId = v.voice_id; return cachedVoiceId; }
      }
    }
  } catch (_) {}
  return null;
}

async function handleTTS(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return json({ error: "POST 메서드만 허용됩니다." }, 405);

  const key = env.TYPECAST_API_KEY || "";
  if (!key) return json({ error: "no_tts_key" }, 503); // 프론트가 브라우저 음성으로 폴백

  let body = {};
  try { body = await request.json(); } catch (_) {}
  const text = ((body && body.text) || "").toString().trim().slice(0, 2000);
  if (!text) return json({ error: "empty" }, 400);

  const voiceId = await pickVoiceId(env);
  if (!voiceId) return json({ error: "no_voice" }, 503);

  const payload = {
    voice_id: voiceId,
    text: text,
    model: "ssfm-v30",
    language: "kor",
    prompt: { emotion_type: "preset", emotion_preset: "happy", emotion_intensity: 1 },
    output: { volume: 100, audio_pitch: 0, audio_tempo: 1, audio_format: "mp3" },
  };

  let r;
  try {
    r = await fetch("https://api.typecast.ai/v1/text-to-speech", {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return json({ error: "tts_fetch_failed", detail: String(e) }, 502);
  }

  if (!r.ok) {
    const det = await r.text();
    return json({ error: "tts_failed", status: r.status, detail: det.slice(0, 400) }, 502);
  }

  return new Response(r.body, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", ...CORS },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/chat") return handleChat(request, env);
    if (url.pathname === "/api/tts")  return handleTTS(request, env);
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not found", { status: 404 });
  },
};
