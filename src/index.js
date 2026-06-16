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
  "3) 미납 알림·정산: 수강료 미납자 알림 문구 초안, 지점별·강사별 정산 항목 정리, 정산 시 확인할 항목을 안내해줘.\n" +
  "4) 그 밖의 운영 질문(공지·일정·인력·문의 응대 등)에도 실무적으로 도와줘.\n" +
  "[용어] '포인트'는 망고아이의 '학생 포인트'(적립 점수)를 뜻해. 출석·숙제·레벨업 등으로 적립되고, 충전·차감하거나 기프티콘으로 교환할 수 있어. " +
  "관리자 화면의 「🎁 포인트 & 기프티콘 → 💰 학생 포인트 잔액」 메뉴에서 학생별 잔액·누적적립·누적사용·최근 내역을 확인해. " +
  "'포인트'를 운영상의 '핵심 항목/요점' 같은 다른 뜻으로 해석하지 마.\n" +
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
  "[Term] '포인트'/'points' means Mangoi's STUDENT points (reward score) — earned via attendance, homework, level-ups, redeemable for gifticons. Check them under the admin menu 「🎁 Points & Gifts → 💰 Student Balances」. Never read 'points' as a generic 'key item'.\n" +
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

// '포인트' = 학생 포인트 관련 질문 감지 → 관리자 포인트 메뉴(포인트 & 기프티콘)로 안내/이동
// (번들러의 유니코드 처리 영향을 피하려 한글은 indexOf 로 검사)
function isPointsQuestion(msg) {
  if (!msg) return false;
  const KO = ["포인트","적립","기프티콘","기프트콘","충전","차감"];
  for (let i = 0; i < KO.length; i++) { if (msg.indexOf(KO[i]) >= 0) return true; }
  if (/\bpoints?\b|gifticon|reward/i.test(msg)) return true;
  return false;
}
// 글자가 한글 음절(가-힣)인지 — 코드포인트로 검사(번들러 영향 회피)
function isHangulCode(c) { return c >= 0xAC00 && c <= 0xD7A3; }
function isAsciiAlpha(c) { return (c >= 65 && c <= 90) || (c >= 97 && c <= 122); }
// 메시지에서 학생 이름 후보 추출(말투용) — 실제 검색·매칭은 부모(관리자)가 전체 메시지로 수행
function extractStudentName(msg) {
  if (!msg) return "";
  // 공백/구두점으로 단어 분리(한글 범위 정규식 없이)
  const words = msg.split(/[\s,.!?~"'`()\[\]{}…·\-:;/\\]+/).filter(Boolean);
  const stop = ["포인트","포인트는","점수","잔액","적립","사용","충전","차감","기프티콘","학생","학생의","님","얼마","조회","검색","보여줘","알려줘","알고","싶어","싶어요","좀","현재","지금","의","이름","누적","내역","확인","해줘","주세요","해주세요","무엇","뭐야","뭐예요",
    // [수정] 키워드 뒤 일반 명사/동작어가 학생 이름으로 오인되던 버그 보강
    "교환","교환해","바꿔","바꾸기","변경","교체","방법","어떻게","얼마나","상품","쿠폰","기프트","적립금","사용처","문의","관련","대해"];
  for (const w of words) {
    if (stop.indexOf(w) >= 0) continue;
    // 한글 2~4자 이름
    if (w.length >= 2 && w.length <= 4) {
      let allHangul = true;
      for (let i = 0; i < w.length; i++) { if (!isHangulCode(w.charCodeAt(i))) { allHangul = false; break; } }
      if (allHangul) return w;
    }
    // 영문/숫자 아이디(영문 시작, 3자 이상)
    if (w.length >= 3 && isAsciiAlpha(w.charCodeAt(0))) {
      let okId = true;
      for (let i = 1; i < w.length; i++) {
        const c = w.charCodeAt(i);
        if (!(isAsciiAlpha(c) || (c >= 48 && c <= 57) || c === 95)) { okId = false; break; }
      }
      if (okId) return w;
    }
  }
  return "";
}
// ===== 관리자(admin) 메뉴 카탈로그: 유사어 → 대상 메뉴(손자/카드 id) + 안내 라벨 =====
// 우선순위 순서대로 검사(구체적인 것 먼저). kw 는 소문자/한글 부분일치(indexOf)로 매칭.
// go 값은 admin.html 의 실제 DOM id(또는 alias) → 부모가 그 메뉴를 펼치고 스크롤.
const MENU_CATALOG = [
  { go: "sub-overdue",                 label: "수강료 미납 자동 알림",      kw: ["미납","연체","독촉","미수금","수강료 미납","밀린","overdue","dunning"] },
  { go: "card-payroll",                label: "강사 급여·정산",            kw: ["급여","월급","페이","강사료","교사 급여","강사 급여","교사급여","강사급여","급여정산","급여 정산","payroll","salary","월급여"] },
  { go: "card-settlement-stats",       label: "지점/가맹점 정산",          kw: ["지점 정산","지점별 정산","가맹점 정산","지사 정산","정산 통계","정산 대시보드","branch settlement"] },
  { go: "card-accounting-mgmt",        label: "회계관리(환불/취소)",       kw: ["환불","환급","위약금","결제 취소","refund"] },
  { go: "card-accounting-mgmt",        label: "회계관리",                 kw: ["회계","매출","세금","세무","부가세","세금계산서","현금영수증","법인카드","전표","분개","손익","재무제표","미지급","정산"] },
  { go: "card-payments-b2c",           label: "BtoC 결제관리",            kw: ["btoc","b2c","학부모 결제","직판매"] },
  { go: "card-payments-b2b",           label: "BtoB 결제관리",            kw: ["btob","b2b","본사 결제","대리점 결제"] },
  { go: "card-recurring-billing",      label: "정기결제 자동화",           kw: ["정기결제","자동결제","구독결제","recurring"] },
  { go: "card-accounting-mgmt",        label: "회계관리(결제 내역)",        kw: ["결제 내역","결제내역","학생 결제","결제","payment"] },
  // 포인트는 별도 단락(isPointsQuestion)에서 처리
  { go: "card-auto-attendance",        label: "QR 출결 자동 체크",         kw: ["qr 출결","qr출결","qr 출석","큐알"] },
  { go: "card-school-attendance-stats",label: "학생 출석 현황",            kw: ["출석","출결","출석부","등원","결석","출석률","attendance"] },
  { go: "card-calendar",               label: "캘린더(휴가·공휴일)",       kw: ["공휴일","휴일","휴가","연차","캘린더","달력","일정 관리","휴무","holiday","calendar","vacation"] },
  { go: "card-auto-schedule",          label: "AI 주간 시간표 자동 짜기",   kw: ["시간표 자동","자동 시간표","주간 시간표","auto schedule"] },
  { go: "card-timetable",              label: "통합 시간표",              kw: ["시간표","타임테이블","timetable"] },
  { go: "card-homework",               label: "숙제 관리",                kw: ["숙제","과제","homework"] },
  { go: "card-lesson-log",             label: "수업 일지",                kw: ["수업일지","수업 일지","lesson log"] },
  { go: "sub-eval-create",             label: "학생 평가서 작성",          kw: ["평가서","평가표","학생 평가","평가 작성","성적표 작성","evaluation"] },
  { go: "card-monthly-report",         label: "월별 학습 보고서",          kw: ["학습 리포트","학습리포트","월별 보고서","월간 보고서","학습 보고서","monthly report"] },
  { go: "card-bulk-eval",              label: "강사 일괄 평가서",          kw: ["일괄 평가","벌크 평가","bulk eval"] },
  { go: "sub-points-balances",         label: "포인트 & 기프티콘",         kw: ["기프티콘","적립","충전","차감","포인트"] },
  { go: "card-badges-mgmt",            label: "학생 배지(게이미피케이션)",   kw: ["배지","뱃지","badge","게이미피케이션"] },
  { go: "card-students-mgmt",          label: "학생관리",                 kw: ["학생관리","학생 관리","학생 목록","학생목록","회원관리","회원 관리","학생 등록","원생"] },
  { go: "card-teacher-mgmt",           label: "강사관리",                 kw: ["강사관리","강사 관리","강사 등록","강사 정보","선생님 관리","교사 관리","강사 평가","teacher"] },
  { go: "card-permissions",            label: "권한 설정",                kw: ["권한","역할","접근권한","접근 권한","permission","role"] },
  { go: "card-kakao-mgmt",             label: "카카오 알림톡",             kw: ["알림톡","카카오","카톡","kakao","알림 톡"] },
  { go: "card-webpush-mgmt",           label: "Web Push 알림",            kw: ["웹푸시","웹 푸시","푸시","push"] },
  { go: "card-notice-board",           label: "공지사항 게시판",           kw: ["공지사항","게시판","공지글"] },
  { go: "card-popups-mgmt",            label: "공지/팝업 관리",            kw: ["팝업","공지","popup"] },
  { go: "card-textbooks",              label: "교재 콘텐츠 관리",          kw: ["교재","textbook","교재 관리"] },
  { go: "card-level-tests",            label: "레벨 테스트",              kw: ["레벨테스트","레벨 테스트","배치고사","level test","레벨 진단"] },
  { go: "card-pronunciation",          label: "발음교정",                 kw: ["발음","pronunciation"] },
  { go: "card-enrollments",            label: "수강신청 관리",             kw: ["수강신청","수강 신청","enrollment","등록 관리"] },
  { go: "card-franchises",             label: "가맹점 관리",              kw: ["가맹점","대리점","지사","franchise","영입본부","대표지사"] },
  { go: "card-centers",                label: "교육센터",                 kw: ["교육센터","센터","center"] },
  { go: "card-review-quiz",            label: "복습퀴즈 출제",             kw: ["복습퀴즈","복습 퀴즈","퀴즈","quiz"] },
  { go: "card-recording-storage",      label: "녹화 관리",                kw: ["녹화","녹화본","recording"] },
  { go: "card-data-export",            label: "데이터 내보내기(CSV)",      kw: ["내보내기","csv","export","백업","데이터 추출"] },
  { go: "card-admin-alerts",           label: "실시간 알림 센터(이상 감지)", kw: ["이상감지","이상 감지","실시간 알림","알림 센터","이상 신호","이상징후","anomaly","alert"] },
  { go: "card-retention-risk",         label: "학생 이탈 위험(AI)",        kw: ["이탈","리텐션","retention","이탈 위험"] },
  { go: "card-kpi-dashboard",          label: "운영 대시보드 KPI",         kw: ["kpi","대시보드","운영 현황","지표"] },
  { go: "card-ai-forecast",            label: "AI 매출·이탈 예측",         kw: ["예측","forecast","전망"] },
  { go: "card-counseling-booking",     label: "1:1 상담 예약",            kw: ["상담 예약","1:1 상담","예약 상담","상담예약"] },
  { go: "card-inquiry-mgmt",           label: "신규상담 → 등록 전환",       kw: ["신규상담","신규 상담","문의","상담 전환","inquiry","리드"] },
  { go: "card-alumni",                 label: "졸업생 동문 커뮤니티",       kw: ["졸업생","동문","alumni"] },
  { go: "card-gallery",                label: "사진/영상 갤러리",          kw: ["갤러리","사진첩","gallery"] },
  { go: "card-admin-ghost",            label: "라이브 참관(Ghost)",        kw: ["참관","ghost","모니터링","라이브 관찰"] },
  { go: "card-admin-whisper",          label: "강사 귓속말(Whisper)",      kw: ["귓속말","whisper"] },
];
// 메시지에서 가장 알맞은 관리자 메뉴 1개 매칭 → {go,label} 또는 null
function detectMenu(msg) {
  if (!msg) return null;
  const low = msg.toLowerCase();
  for (const m of MENU_CATALOG) {
    for (const k of m.kw) {
      if (low.indexOf(k.toLowerCase()) >= 0) return { go: m.go, label: m.label };
    }
  }
  return null;
}

function extractGo(text, lang) {
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
  // [수정] 언어별 폴백 (영어 사용자에게 한국어가 노출되던 버그 수정)
  const fallback = lang === "en" ? "Sorry, could you say that again?" : "음, 다시 한 번 말씀해 주시겠어요?";
  return { answer: clean || fallback, go: go };
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

  // '포인트' 질문은 LLM 오답을 막기 위해 결정적(정확) 답변 + 포인트 메뉴로 이동 신호를 바로 반환
  if (isPointsQuestion(message)) {
    const isEn = lang === "en";
    const name = extractStudentName(message);
    let answer;
    if (name) {
      answer = isEn
        ? `In Mangoi, "포인트" means student points. Let me open 🎁 Points & Gifts → 💰 Student Balances and search for ${name} — you'll see the balance, lifetime earned/spent and recent history.`
        : `포인트는 망고아이의 ‘학생 포인트’예요. 「🎁 포인트 & 기프티콘 → 💰 학생 포인트 잔액」을 열고 ${name} 학생을 검색해 드릴게요. 잔액·누적적립·누적사용과 최근 내역을 확인하실 수 있어요.`;
    } else {
      answer = isEn
        ? `"포인트" means Mangoi's student points — earned via attendance, homework, level-ups, etc., and redeemable for gifticons. Opening 🎁 Points & Gifts → 💰 Student Balances now. Tell me a student's name and I'll search it for you.`
        : `포인트는 망고아이의 ‘학생 포인트’예요. 출석·숙제·레벨업 등으로 적립되고, 충전·차감하거나 기프티콘으로 교환할 수 있어요. 「🎁 포인트 & 기프티콘 → 💰 학생 포인트 잔액」 메뉴를 열어 드릴게요. 학생 이름을 말씀하시면 바로 검색해 보여드릴게요.`;
    }
    return json({ answer, go: "points", goLabel: isEn ? "Points & Gifts → Student Balances" : "포인트 & 기프티콘 → 학생 포인트 잔액" });
  }

  try {
    const r = await callAI(message, env, lang);
    const parsed = extractGo(r.answer, lang);
    let answer = stripLeakedCodes(parsed.answer);
    // 답변 끝에 '○○ 메뉴로 열어드릴까요?'를 붙이고, 부모 관리자 페이지에서 해당 메뉴로 이동시킬 신호(go) 전달
    const menu = detectMenu(message);
    if (menu) {
      const ask = lang === "en"
        ? `\n\n📂 Shall I open the “${menu.label}” menu for you?`
        : `\n\n📂 ‘${menu.label}’ 메뉴로 열어드릴까요?`;
      answer = answer + ask;
      return json({ answer, go: menu.go, goLabel: menu.label });
    }
    return json({ answer, go: null });
  } catch (e) {
    return json({ answer: lang === "en" ? "Sorry, something went wrong. Could you ask again?" : "죄송해요, 잠시 문제가 생겼어요. 다시 한 번 물어봐 주시겠어요?", detail: String(e) });
  }
}

// ===== 음성 합성 (Typecast) =====
// 인사 영상(talking avatar)에 쓴 목소리 '재선'(Jaesun, female)으로 답변도 통일.
// Typecast 보이스 목록에서 확인한 실제 voice_id 를 고정 사용.
// 변경하려면 Cloudflare 시크릿 TYPECAST_VOICE_ID 로 덮어쓸 수 있음.
const JAESUN_VOICE_ID = "tc_684a7a1446e2a628b5b07230"; // '재선'(Jaesun) ssfm-v30
const VOICE_MODEL = "ssfm-v30";

function pickVoiceId(env) {
  return (env && env.TYPECAST_VOICE_ID) || JAESUN_VOICE_ID;
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
    model: VOICE_MODEL,
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
