// 망고아이 AI 상담직원 — Cloudflare Worker
// - 정적 파일(public/)은 자동 서빙. 이 Worker 는 /api/chat, /api/tts 처리.
// - /api/chat : Cloudflare Workers AI 로 답변 생성(외부 키 불필요).
// - /api/tts  : 타입캐스트(Typecast) 한국어 음성 합성. 키는 환경변수 TYPECAST_API_KEY 에서만 읽음.

const AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const PERSONA =
  "너는 망고아이의 친절하고 상냥한 AI 상담원이야. 항상 정중한 존댓말(해요체·합니다체)로, " +
  "초등학생과 학부모도 단번에 이해할 수 있게 쉽고 다정하게, 2~4문장으로 한국어로만 답해줘. 반말은 절대 금지.\n" +
  "[화면 사용 안내 — 아래 적힌 사실만 정확히 안내하고, 이 목록에 없는 메뉴/버튼 위치나 조작 방법은 절대 지어내지 마.]\n" +
  "- 수업 입장: 화면 우측 하단의 버튼을 눌러 원어민 선생님 방으로 입장합니다.\n" +
  "- 결제 / 수강권 구매: 좌측 하단의 노란색 버튼을 누르면 됩니다.\n" +
  "- 수강료 / 가격 / 비용 / 학비 / 교육비 / 강사료 / 요금 / 얼마예요 등 '돈·금액'에 관한 질문: 정확한 금액은 '수강료' 메뉴에서 확인하실 수 있어요. " +
  "이런 비용 질문에는 절대 '확인 후 안내드릴게요'로 미루지 말고, 한두 문장으로 친절히 안내한 뒤 반드시 마지막 문장을 '망고아이 수강료 메뉴로 열어드릴까요?'로 끝내고, 답 맨 끝에 [[GO:payment]] 태그를 붙여줘.\n" +
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
  "- 망고아이 장점 / 특징 / 경쟁사·타사와의 차이 / 비교 / 왜 망고아이를 선택해야 하는지: '망고아이란?'(소개) 메뉴에 망고아이의 자세한 장점과 특징이 정리되어 있어요. " +
  "이런 질문에는 한두 문장으로 친절히 소개한 뒤 마지막 문장을 '망고아이란? 으로 열어드릴까요?'로 끝내고, 답 맨 끝에 [[GO:about]] 태그를 붙여줘.\n" +
  "- 환불 / 환불규정 / 환급 / 돌려받기: 망고아이 '환불규정' 메뉴에 환불 기준표가 정리되어 있어요. 한두 문장으로 친절히 안내한 뒤 마지막 문장을 '환불규정 메뉴로 연결해 드릴까요?'로 끝내고, 답 맨 끝에 [[GO:refund]] 태그를 붙여줘. (환불을 '수강료/결제'로 안내하지 마.)\n" +
  "위 목록에 없는 메뉴 위치를 물어보면 추측해서 답하지 말고, '정확한 위치를 확인한 뒤 안내드릴게요' 라고 하거나 하단 카톡 상담 연결을 권해줘.\n" +
  "[페이지 바로 열기 기능] 질문이 아래 코드 목록의 메뉴와 관련 있으면, 짧게 안내한 뒤 마지막 문장으로 '○○ 페이지를 열어드릴까요?'라고 물어봐. " +
  "그리고 답변의 맨 끝(마침표 뒤)에 사용자에게 보이지 않는 태그 [[GO:코드]] 를 정확히 한 개만 붙여줘. 태그는 설명하지 말고 그냥 붙이기만 해.\n" +
  "코드 목록(코드=무엇): lesson-enter(수업 입장=지금 화상수업 로비로 들어가기), lesson-change(수업 연기/변경=일정 바꾸기), leveltest(레벨테스트), booking(수업 신청/예약), precheck(수업 진단), library(교재/수업 자료/자료실), report(평가표/성적표), mypage(마이페이지/학생 대시보드), parent-dashboard(학부모 대시보드), payment(결제/수강권), teachers(교사/선생님 소개), review-quiz(복습퀴즈), microquiz(미니퀴즈), admin(관리자 페이지), notice(공지사항), faq(자주 묻는 질문), event(이벤트), points-shop(포인트상점), mypoints(내 포인트), vocab(단어장), recordings(녹화본/다시보기), curriculum(커리큘럼/교육과정), trial(무료체험), enroll(수강 등록), contact(고객센터/문의), inquiry(신규상담), reviews(수강 후기), streak(연속출석), checkin(출석체크), mbti(MBTI 검사), about(망고아이 소개), goals(학습 목표), leaderboard(리더보드/순위), speech(단계별 발음), speech-coach(발음 코치), write(AI 작문), remote(원격 지원), installguide(설치 가이드), franchise(가맹 문의), callcenter(콜센터), videolesson(화상수업), focus(집중도 측정), teacher-praise(칭찬 스티커), diagnosis(자가진단), all-menu(전체메뉴).\n" +
  "★ 매우 중요: '수업 입장/수업 들어가기'는 반드시 lesson-enter 다. '수업 연기/변경/취소'는 lesson-change 다. 이 둘을 절대 바꿔 쓰지 마.\n" +
  "이 목록에 없는 주제면 '열어드릴까요?'도, 태그도 절대 붙이지 마. 한 답변에 태그는 최대 한 개.";

const PERSONA_EN =
  "You are Mangoi's friendly, warm AI assistant. Always reply politely in natural English, " +
  "in a simple, kind tone that both children and parents can easily understand, in 2-4 short sentences. Reply in English only.\n" +
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
  "- Refund / refund policy / money back: the 'Refund Policy' menu has the full refund schedule. Give a short, kind answer, end with 'Would you like me to open the Refund Policy page?', and append [[GO:refund]] at the very end. (Never route refunds to 'payment/tuition'.)\n" +
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

  // 환불 관련 질문: AI 호출 없이 환불 기준표를 보여주고 환불규정 메뉴로 연결 제안
  if (isRefundQuestion(message)) {
    const intro = lang === "en"
      ? "Mangoi's refund follows the Office of Education's policy, calculated by how much of the course has been completed — please see the table below."
      : "망고아이 환불은 교육청 환불규정에 따라 수업 진행 정도에 맞춰 아래 표 기준으로 처리돼요. 아래 표를 참고해 주세요!";
    return json({ answer: intro, refund: true, go: "refund", lang });
  }

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
