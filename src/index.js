// 망고아이 AI 아바타 — Cloudflare Worker (학생 상담사 + 관리자 운영비서 통합)
// - 정적 파일(public/)은 자동 서빙. 이 Worker 는 /api/chat, /api/tts, /api/stt 처리.
// - mode 분기: 기본(student)=고객 상담사 / "ops"=관리자 운영 비서.
//     * student: public/student.html  (메인 홈페이지 우측 하단 'A.i 상담사')
//     * ops:     public/index.html     (관리자 페이지 'AI 운영 비서')
//   프론트가 /api/chat·/api/tts 요청 body 에 mode:"ops" 를 넣으면 운영비서, 없으면 학생 상담사.

const AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// =====================================================================
// 학생용(고객 상담사) 페르소나 — 예전 학생 홈페이지 'AI 상담직원' 그대로
// =====================================================================
const PERSONA_STUDENT =
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
  "- 학생 정보 / 내 정보 / 자녀 학습·출결·성적·학습 현황 조회: 이런 '학생 정보를 알고 싶다/보고 싶다'는 요청은 반드시 '마이페이지'로 안내해. " +
  "절대 '전체메뉴(all-menu)'로 보내지 마. 한두 문장으로 친절히 안내한 뒤 마지막 문장을 '마이페이지로 바로 열어드릴까요?'로 끝내고, 답 맨 끝에 [[GO:mypage]] 태그를 붙여줘.\n" +
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

const PERSONA_STUDENT_EN =
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

// =====================================================================
// 관리자용(운영 비서) 페르소나
// =====================================================================
const PERSONA_OPS =
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

const PERSONA_OPS_EN =
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

// ===== 답변 생성 (Workers AI) — mode 에 따라 페르소나 선택 =====
async function callAI(message, env, lang, mode) {
  const isEn = lang === "en";
  if (!env.AI) {
    return { answer: isEn ? "Demo mode for now. Set the Workers AI (AI) binding for smart replies!" : "지금은 데모 모드예요. Workers AI 바인딩(AI)을 설정하면 똑똑하게 답해 드려요!" };
  }
  const persona = mode === "ops"
    ? (isEn ? PERSONA_OPS_EN : PERSONA_OPS)
    : (isEn ? PERSONA_STUDENT_EN : PERSONA_STUDENT);
  const result = await env.AI.run(AI_MODEL, {
    messages: [
      { role: "system", content: persona },
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

// 환불 관련 질문인지 감지 (환불/환급/위약금/돌려받기/refund)
function isRefundQuestion(msg) {
  if (!msg) return false;
  if (/refund|money\s*back/i.test(msg)) return true;
  if (msg.indexOf("환불") >= 0) return true;
  if (msg.indexOf("환급") >= 0) return true;
  if (msg.indexOf("위약금") >= 0) return true;
  if (msg.replace(/\s/g, "").indexOf("돌려받") >= 0) return true;
  return false;
}

// '포인트' = 학생 포인트 관련 질문 감지(운영비서 전용)
function isPointsQuestion(msg) {
  if (!msg) return false;
  const KO = ["포인트","적립","기프티콘","기프트콘","충전","차감"];
  for (let i = 0; i < KO.length; i++) { if (msg.indexOf(KO[i]) >= 0) return true; }
  if (/\bpoints\b|gifticon|reward\s*points?/i.test(msg)) return true;
  return false;
}
function isHangulCode(c) { return c >= 0xAC00 && c <= 0xD7A3; }
function isAsciiAlpha(c) { return (c >= 65 && c <= 90) || (c >= 97 && c <= 122); }
// 메시지에서 학생 이름 후보 추출(운영비서 말투용)
function extractStudentName(msg) {
  if (!msg) return "";
  const words = msg.split(/[\s,.!?~"'`()\[\]{}…·\-:;/\\]+/).filter(Boolean);
  const stop = ["포인트","포인트는","점수","잔액","적립","사용","충전","차감","기프티콘","학생","학생의","님","얼마","조회","검색","보여줘","알려줘","알고","싶어","싶어요","좀","현재","지금","의","이름","누적","내역","확인","해줘","주세요","해주세요","무엇","뭐야","뭐예요",
    "교환","교환해","바꿔","바꾸기","변경","교체","방법","어떻게","얼마나","상품","쿠폰","기프트","적립금","사용처","문의","관련","대해"];
  const TOPIC = ["포인트","적립","기프티콘","기프트콘","기프트","충전","차감","점수","잔액"];
  for (const w of words) {
    let topical = false;
    for (let t = 0; t < TOPIC.length; t++) { if (w.indexOf(TOPIC[t]) === 0) { topical = true; break; } }
    if (topical) continue;
    if (stop.indexOf(w) >= 0) continue;
    if (w.length >= 2 && w.length <= 4) {
      let allHangul = true;
      for (let i = 0; i < w.length; i++) { if (!isHangulCode(w.charCodeAt(i))) { allHangul = false; break; } }
      if (allHangul) return w;
    }
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
// ===== 관리자(admin) 메뉴 카탈로그(운영비서 전용): 유사어 → 대상 메뉴 + 라벨 =====
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
  const fallback = lang === "en" ? "Sorry, could you say that again?" : "음, 다시 한 번 말씀해 주시겠어요?";
  return { answer: clean || fallback, go: go };
}

// 사용자 메시지/답변의 타깃 키워드 → GO 코드 (학생 상담사 폴백)
const GO_KEYWORDS = [
  ["lesson-enter", ["수업 입장","수업입장","입장","로비","enter class","enter the class","class lobby","join the class","join class","enter my class"]],
  ["lesson-change", ["수업 연기","연기","수업 변경","변경","수업 취소","취소","reschedule","postpone","change my class","change class","cancel class","cancel my class"]],
  ["precheck", ["수업 진단","수업진단","사전 진단","사전점검","사전 점검","수업 전 점검","수업전점검","precheck","pre-check","class diagnosis"]],
  ["leveltest", ["레벨테스트","레벨 테스트","실력테스트","실력 진단","level test","leveltest","placement"]],
  ["report", ["평가표","성적표","성적","report card","grades"]],
  ["refund", ["환불","환급","위약금","돌려받","refund","money back"]],
  ["payment", ["결제","수강권","구매","payment","purchase","buy a pass","buy passes"]],
  ["library", ["자료실","교재","수업 자료","library","textbook","materials"]],
  ["mypage", ["마이페이지","마이 페이지","my page","mypage","학생정보","학생 정보","내 정보","내정보","자녀 정보","자녀 학습","학습 현황","학습현황","출결 현황","출석 현황","내 학습"]],
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

// 한글(가-힣) 포함 여부 — 번들러의 유니코드 리터럴 처리에 영향받지 않도록 코드포인트로 검사
function hasKorean(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xAC00 && c <= 0xD7A3) return true;
    if (c >= 0x3130 && c <= 0x318F) return true;
  }
  return false;
}

// 본문에 흘린 코드 토큰 정리
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
  const mode = (body && body.mode === "ops") ? "ops" : "student";   // 기본=학생 상담사
  const lang = hasKorean(message) ? "ko" : "en";   // 입력 메시지 언어 자동 감지(토글과 무관)
  if (!message) return json({ error: "message 가 비어 있습니다." }, 400);

  // ============ 관리자(운영 비서) 모드 ============
  if (mode === "ops") {
    // '포인트' 질문은 LLM 오답을 막기 위해 결정적 답변 + 포인트 메뉴 이동
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

    if (isRefundQuestion(message)) {
      const isEn = lang === "en";
      const answer = isEn
        ? "Here's our refund schedule — the rate depends on how far the course has progressed. Shall I open the full Refund Policy page?"
        : "환불 기준을 안내해 드릴게요. 환불 비율은 수업 진행 정도에 따라 달라져요. 자세한 환불규정 페이지를 열어드릴까요?";
      return json({ answer, refund: true, go: "refund", goLabel: isEn ? "Refund Policy" : "환불 규정" });
    }

    try {
      const r = await callAI(message, env, lang, "ops");
      const parsed = extractGo(r.answer, lang);
      let answer = stripLeakedCodes(parsed.answer);
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

  // ============ 학생(고객 상담사) 모드 — 기본 ============
  // 환불 관련 질문: AI 호출 없이 환불 기준표를 보여주고 환불규정 메뉴로 연결 제안
  if (isRefundQuestion(message)) {
    const intro = lang === "en"
      ? "Mangoi's refund follows the Office of Education's policy, calculated by how much of the course has been completed — please see the table below."
      : "망고아이 환불은 교육청 환불규정에 따라 수업 진행 정도에 맞춰 아래 표 기준으로 처리돼요. 아래 표를 참고해 주세요!";
    return json({ answer: intro, refund: true, go: "refund", lang });
  }

  try {
    const r = await callAI(message, env, lang, "student");
    const parsed = extractGo(r.answer, lang);
    // 사용자 메시지의 명시적 키워드를 최우선 → 없으면 태그/답변으로 폴백
    const go = detectGo(message) || parsed.go || detectGo(parsed.answer);
    const answer = stripLeakedCodes(parsed.answer);
    return json({ answer, go });
  } catch (e) {
    return json({ answer: lang === "en" ? "Sorry, something went wrong. Could you ask again?" : "죄송해요, 잠시 문제가 생겼어요. 다시 한 번 물어봐 주시겠어요?", detail: String(e) });
  }
}

// ===== 음성 합성 (Typecast) — mode 에 따라 목소리 선택 =====
// 운영비서(ops): 인사 영상과 동일한 '재선'(Jaesun) 고정 voice_id.
// 학생 상담사(student): 예전처럼 Typecast 의 young_adult female 보이스를 동적으로 선택.
const JAESUN_VOICE_ID = "tc_684a7a1446e2a628b5b07230"; // '재선'(Jaesun) ssfm-v30
const VOICE_MODEL = "ssfm-v30";
let cachedStudentVoiceId = null; // 동일 isolate 재사용(학생 동적 보이스)

async function pickVoiceId(env, mode) {
  if (mode === "ops") {
    return (env && env.TYPECAST_VOICE_ID) || JAESUN_VOICE_ID;
  }
  // 학생 상담사: 예전 동적 보이스 선택(young_adult female)
  if (env && env.TYPECAST_VOICE_ID_STUDENT) return env.TYPECAST_VOICE_ID_STUDENT;
  if (cachedStudentVoiceId) return cachedStudentVoiceId;
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
        if (v) { cachedStudentVoiceId = v.voice_id; return cachedStudentVoiceId; }
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
  const mode = (body && body.mode === "ops") ? "ops" : "student";
  if (!text) return json({ error: "empty" }, 400);

  const voiceId = await pickVoiceId(env, mode);
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

  // 1순위: whisper-large-v3-turbo (base64 입력, language 지정 → 한국어 정확도 ↑)
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
    try {
      const r = await env.AI.run("@cf/openai/whisper", { audio: [...bytes] });
      const text = (r && r.text || "").trim();
      return json({ text });
    } catch (e2) {
      return json({ error: "stt_failed", detail: String(e2) }, 502);
    }
  }
}

// 테스트 하니스용 named export. Worker 런타임은 default(fetch)만 사용.
export {
  isPointsQuestion,
  isRefundQuestion,
  extractStudentName,
  detectMenu,
  detectGo,
  extractGo,
  stripLeakedCodes,
  hasKorean,
};

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
