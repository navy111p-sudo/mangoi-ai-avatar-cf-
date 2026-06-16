// 망고아이 AI 상담직원 — Cloudflare Worker
// - 정적 파일(public/)은 자동 서빙. 이 Worker 는 /api/chat, /api/tts 처리.
// - /api/chat : Cloudflare Workers AI 로 답변 생성(외부 키 불필요).
// - /api/tts  : 타입캐스트(Typecast) 한국어 음성 합성. 키는 환경변수 TYPECAST_API_KEY 에서만 읽음.

const AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const PERSONA =
  "너는 망고아이 학원·지점 운영자(매니저·원장·관리자)를 돕는 'AI 운영 비서'야. " +
  "항상 정중한 존댓말(해요체·합니다체)로, 매니저가 바로 실행할 수 있게 핵심만 또렷하게, 한국어로만 답해줘. 반말 금지. " +
  "답변은 보통 2~5문장으로 간결하게. 필요하면 짧은 단계(1·2·3)로 정리해도 좋아.\n" +
  "[너의 주요 업무]\n" +
  "1) AI 평가서·학습 리포트 초안: 학생의 출결·진도·점수·특이사항을 바탕으로 평가서/학습 리포트 초안을 작성해 주고, 어떤 정보가 더 필요한지 짚어줘.\n" +
  "2) 실시간 이상감지 대응: 출석 급감, 결제 실패, 수업 미입장, 강사 노쇼, 비정상 로그인 등 운영 이상 신호를 어떻게 확인·대응할지 단계로 안내해줘.\n" +
  "3) 미납 알림·정산: 수강료 미납자 알림 문구 초안, 지점별·강사별 정산 항목 정리, 정산 시 확인할 포인트를 안내해줘.\n" +
  "4) 그 밖의 운영 질문(공지·일정·인력·문의 응대 등)에도 실무적으로 도와줘.\n" +
  "[원칙] 모르는 수치나 실제 데이터는 지어내지 마. 데이터가 없으면 '어떤 값을 넣으면 되는지' 양식·예시로 보여주고, 필요한 입력을 요청해줘. " +
  "개인정보·금액은 신중히 다루고, 외부로 단정적 약속을 하지 마. " +
  "평가서/알림 문구를 만들 때는 바로 복사해 쓸 수 있게 완성형 예시 문장으로 제시해줘.";

const PERSONA_EN =
  "You are Mangoi's 'AI Operations Assistant' that helps academy/branch managers and admins. " +
  "Always reply politely in natural English, concise and action-oriented, in English only. " +
  "Usually 2-5 short sentences; you may use short numbered steps when helpful.\n" +
  "[Your main duties]\n" +
  "1) AI evaluations & learning report drafts: draft evaluations/learning reports from a student's attendance, progress, scores and notes, and point out what extra info is needed.\n" +
  "2) Real-time anomaly response: guide step-by-step how to check and respond to operational signals such as attendance drops, failed payments, no-show students/teachers, abnormal logins.\n" +
  "3) Overdue alerts & settlement: draft overdue-payment notices, organize per-branch/per-teacher settlement items, and list points to verify before settling.\n" +
  "4) Help with other operational questions (notices, scheduling, staffing, handling inquiries).\n" +
  "[Principles] Never invent real numbers or data. If data is missing, show the format/example fields to fill in and ask for the needed input. " +
  "Handle personal data and money carefully and avoid definitive external promises. " +
  "When drafting evaluations/notices, give ready-to-copy complete example sentences.";

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
const GO_CODES = ["lesson-enter","lesson-change","leveltest","booking","precheck","library","report","mypage","parent-dashboard","payment","teachers","review-quiz","microquiz","all-menu","admin","notice","faq","event","points-shop","mypoints","vocab","recordings","curriculum","trial","enroll","contact","inquiry","reviews","streak","checkin","mbti","about","goals","leaderboard","speech","speech-coach","write","remote","installguide","franchise","callcenter","videolesson","focus","teacher-praise","diagnosis","refund"];

// 환불 관련 질문인지 감지 (환불규정/환불/환급/돌려받기/refund)
function isRefundQuestion(msg) {
  if (!msg) return false;
  if (/refund|money\s*back/i.test(msg)) return true;
  // 한글: 환불 / 환급 / 돌려받 / 돌려 받 / 위약금
  if (msg.indexOf("환불") >= 0) return true;
  if (msg.indexOf("환급") >= 0) return true;
  if (msg.indexOf("위약금") >= 0) return true;
  if (msg.replace(/\s/g, "").indexOf("돌려받") >= 0) return true;
  return false;
}
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

// 한글(가-힣) 포함 여부 — 번들러의 유니코드 리터럴 처리에 영향받지 않도록 코드포인트로 검사
function hasKorean(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xAC00 && c <= 0xD7A3) return true;   // 한글 음절
    if (c >= 0x3130 && c <= 0x318F) return true;   // 한글 자모(ㄱ-ㅎ 등)
  }
  return false;
}

// 사용자 메시지/답변의 타깃 키워드 → GO 코드 (모델이 태그를 빠뜨렸을 때 서버 폴백)
const GO_KEYWORDS = [
  ["lesson-enter", ["수업 입장","수업입장","입장","로비","enter class","enter the class","class lobby","join the class","join class","enter my class"]],
  ["lesson-change", ["수업 연기","연기","수업 변경","변경","수업 취소","취소","reschedule","postpone","change my class","change class","cancel class","cancel my class"]],
  ["precheck", ["수업 진단","수업진단","사전 진단","사전점검","사전 점검","수업 전 점검","수업전점검","precheck","pre-check","class diagnosis"]],
  ["leveltest", ["레벨테스트","레벨 테스트","실력테스트","실력 진단","level test","leveltest","placement"]],
  ["report", ["평가표","성적표","성적","report card","grades"]],
  ["refund", ["환불","환급","위약금","돌려받","refund","money back"]],
  ["payment", ["결제","수강권","구매","payment","purchase","buy a pass","buy passes"]],
  ["library", ["자료실","교재","수업 자료","library","textbook","materials"]],
  ["mypage", ["마이페이지","마이 페이지","my page","mypage"]],
  ["booking", ["수업 신청","수업신청","예약","book a class","booking","reserve a class"]],
  ["teachers", ["교사 소개","선생님 소개","teacher introduction","teachers","instructors"]],
  ["review-quiz", ["복습퀴즈","복습 퀴즈","review quiz","review-quiz"]],
  ["all-menu", ["전체메뉴","전체 메뉴","all menu","full menu","all-menu"]],
];
function detectGo(text) {
  if (!text) return null;
  const low = text.toLowerCase();
  for (const [code, kws] of GO_KEYWORDS) {
    for (const kw of kws) { if (low.indexOf(kw.toLowerCase()) >= 0) return code; }
  }
  return null;
}
// 본문에 흘린 코드 토큰 정리: 괄호/대괄호로 감싼 코드 + 자연어가 아닌 하이픈/합성 코드만 안전 제거
const HYPHEN_CODES = ["lesson-enter","lesson-change","review-quiz","all-menu","leveltest","mypage","precheck"];
function stripLeakedCodes(text) {
  let t = text || "";
  t = t.replace(/[\(\[]\s*(lesson-enter|lesson-change|leveltest|library|report|mypage|payment|booking|precheck|teachers|review-quiz|all-menu)\s*[\)\]]/gi, "");
  HYPHEN_CODES.forEach(function (c) { t = t.replace(new RegExp("(^|[^a-zA-Z])" + c + "([^a-zA-Z]|$)", "gi"), "$1$2"); });
  return t.replace(/\s{2,}/g, " ").replace(/\s+([.,!?])/g, "$1").trim();
}

async function handleChat(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method === "GET") return json({ status: "ok", note: "POST {\"message\":\"...\"}" });
  if (request.method !== "POST") return json({ error: "POST 메서드만 허용됩니다." }, 405);

  let body = {};
  try { body = await request.json(); } catch (_) {}
  const message = ((body && body.message) || "").toString().trim().slice(0, 1000);
  const lang = hasKorean(message) ? "ko" : "en";   // 입력 메시지 언어 자동 감지(토글과 무관)
  if (!message) return json({ error: "message 가 비어 있습니다." }, 400);

  try {
    const r = await callAI(message, env, lang);
    const parsed = extractGo(r.answer);
    // 사용자 메시지의 명시적 키워드를 최우선(모델 태그가 진단/점검 등에서 자주 혼동) → 없으면 태그/답변으로 폴백
    const go = detectGo(message) || parsed.go || detectGo(parsed.answer);
    const answer = stripLeakedCodes(parsed.answer);
    return json({ answer, go });
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

// ===== 음성 인식 (STT) — Cloudflare Workers AI Whisper =====
// 교차 출처 iframe 안에서는 브라우저 Web Speech API 가 차단되므로,
// 프론트가 녹음한 오디오(바이너리)를 받아 서버에서 텍스트로 변환한다.
async function handleSTT(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return json({ error: "POST 메서드만 허용됩니다." }, 405);
  if (!env.AI) return json({ error: "no_ai_binding" }, 503);

  let bytes;
  try {
    const buf = await request.arrayBuffer();
    bytes = new Uint8Array(buf);
  } catch (e) {
    return json({ error: "bad_audio", detail: String(e) }, 400);
  }
  if (!bytes || !bytes.length) return json({ error: "empty_audio" }, 400);

  // 1순위: whisper-large-v3-turbo (base64 입력, language 지정 가능 → 한국어 정확도 ↑)
  try {
    let bin = "";
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    }
    const b64 = btoa(bin);
    const r = await env.AI.run("@cf/openai/whisper-large-v3-turbo", {
      audio: b64, language: "ko", task: "transcribe",
    });
    const text = (r && (r.text || r.transcription) || "").trim();
    return json({ text });
  } catch (e1) {
    // 2순위 폴백: 기본 whisper (바이트 배열 입력)
    try {
      const r = await env.AI.run("@cf/openai/whisper", { audio: [...bytes] });
      const text = (r && r.text || "").trim();
      return json({ text });
    } catch (e2) {
      return json({ error: "stt_failed", detail: String(e2) }, 502);
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/chat") return handleChat(request, env);
    if (url.pathname === "/api/tts")  return handleTTS(request, env);
    if (url.pathname === "/api/stt")  return handleSTT(request, env);
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not found", { status: 404 });
  },
};
