// 망고아이 AI 상담사 — 자주 묻는 질문(FAQ) 정해진 답변
// ---------------------------------------------------------------------------
// 왜: AI 답변은 매번 글자가 조금씩 달라서 음성 캐시(R2)가 거의 안 맞는다.
//     정해진 답변은 글자가 «항상 같으므로» 음성을 한 번만 만들고 계속 무료로 재생한다.
//     AI(Llama) 호출도 0 이다.
// 품질: 답변 문장은 index.js 의 PERSONA_STUDENT(_EN) 「화면 사용 안내」 사실을 그대로 옮긴 것이다.
//      ⛔ 페르소나의 안내 내용을 바꾸면 이 파일도 «함께» 바꾸세요(짝입니다).
// 안전: 애매하면 AI 로 넘긴다 — ① 40자 넘는 질문 ② 「안 돼요/오류/왜」 같은 문제 상황
//      ③ 두 가지 이상 주제가 섞인 질문. 정해진 답변은 «확실한 단순 질문» 에만 쓴다.
// ---------------------------------------------------------------------------

const FAQ_MAX_LEN = 40;

// 문제 상황·이유 질문은 안내문이 아니라 AI 의 공감·판단이 필요하다.
// 취소·교재비처럼 정해진 답변과 «비슷하지만 다른» 질문도 AI 로 넘긴다.
const AMBIGUOUS = ["취소", "교재비", "cancel"];
const PROBLEM_RE = /(안\s?돼|안\s?되|안\s?나|안\s?열|오류|에러|못\s?하|못\s?해|못\s?들|왜|문제|고장|느려|끊겨|멈춰|error|not\s+working|doesn'?t\s+work|can'?t|cannot|why|problem|broken)/i;

// kw: 공백을 뺀 소문자 기준으로 «포함» 검사합니다.
export const FAQ_STUDENT = [
  {
    id: "lesson-enter", go: "lesson-enter",
    kw: ["수업입장", "수업들어가", "enterclass", "entertheclass", "joinclass", "jointheclass", "classlobby"],
    ko: "수업 입장은 화면 우측 하단의 버튼을 누르면 원어민 선생님 방으로 들어갈 수 있어요. 수업 입장 페이지를 열어드릴까요?",
    en: "To enter your class, tap the button at the bottom-right to go into the native teacher's room. Would you like me to open the Enter Class page?",
  },
  {
    id: "lesson-change", go: "lesson-change",
    kw: ["수업연기", "수업변경", "수업바꾸", "수업날짜바꾸", "수업시간바꾸", "postpone", "reschedule", "changemyclass", "changeclass"],
    ko: "수업 연기나 변경은 왼쪽 메뉴를 열어 '연기/변경'을 누르시면 돼요. 수업 연기는 꼭 수업 시작 30분 전까지 해 주셔야 해요. 연기/변경 페이지를 열어드릴까요?",
    en: "To postpone or change a class, open the left menu and tap 'Postpone/Change'. Please postpone at least 30 minutes before the class starts. Would you like me to open the Postpone/Change page?",
  },
  {
    id: "payment", go: "payment",
    kw: ["결제", "수강권구매", "수강권사", "payment", "buyapass", "buypasses", "purchase"],
    ko: "결제나 수강권 구매는 화면 좌측 하단의 노란색 버튼을 누르시면 돼요. 망고아이 수강료 메뉴로 열어드릴까요?",
    en: "For payment or buying passes, tap the yellow button at the bottom-left. Would you like me to open the Tuition page?",
  },
  {
    id: "price", go: "payment",
    kw: ["수강료", "가격", "얼마예요", "얼마에요", "얼마인가요", "얼마죠", "비용", "학비", "교육비", "요금", "price", "howmuchis", "howmuchdoes", "tuition", "fees", "cost"],
    ko: "정확한 금액은 '수강료' 메뉴에서 확인하실 수 있어요. 망고아이 수강료 메뉴로 열어드릴까요?",
    en: "You can check the exact price in the 'Tuition' menu. Would you like me to open the Tuition page?",
  },
  {
    id: "report", go: "report",
    kw: ["성적표", "평가표", "성적", "reportcard", "grades"],
    ko: "성적표는 화면 왼쪽 사이드바 메뉴를 열고 '평가표'를 누르시면 수업 성적과 기록을 확인할 수 있어요. 평가표 페이지를 열어드릴까요?",
    en: "To see your report card, open the left sidebar menu and tap 'Report' to check class results and records. Would you like me to open the Report page?",
  },
  {
    id: "mypage", go: "mypage",
    kw: ["마이페이지", "학생정보", "내정보", "자녀정보", "학습현황", "시간표", "출석확인", "출결확인", "출석현황", "mypage", "timetable", "attendance"],
    ko: "시간표, 출석, 학습 현황 같은 학생 정보는 '마이페이지'에서 확인하실 수 있어요. 마이페이지로 바로 열어드릴까요?",
    en: "You can check student info like the timetable, attendance and learning progress in 'My Page'. Would you like me to open My Page?",
  },
  {
    id: "homework", go: "mypage",
    kw: ["숙제", "homework"],
    ko: "숙제는 '마이페이지'에서 확인하실 수 있어요. 마이페이지로 바로 열어드릴까요?",
    en: "You can check your homework in 'My Page'. Would you like me to open My Page?",
  },
  {
    id: "library", go: "library",
    kw: ["교재", "자료실", "수업자료", "library", "textbook", "materials"],
    ko: "교재와 수업 자료는 '자료실'(교재·다운로드) 메뉴에서 보실 수 있어요. 자료실 페이지를 열어드릴까요?",
    en: "You can find textbooks and class materials in the 'Library' menu. Would you like me to open the Library page?",
  },
  {
    id: "leveltest", go: "leveltest",
    kw: ["레벨테스트", "레벨진단", "실력진단", "실력테스트", "leveltest", "placement"],
    ko: "레벨테스트는 왼쪽 메뉴의 '레벨테스트'에서 원하는 날짜와 시간을 골라 신청하시면 돼요. 선생님 1:1 평가와 AI 자동 진단으로 정확한 레벨을 찾아드려요. 레벨테스트 페이지를 열어드릴까요?",
    en: "You can apply for a level test from 'Level Test' in the left menu by picking a date and time. It combines a 1:1 teacher evaluation and AI diagnosis. Would you like me to open the Level Test page?",
  },
  {
    id: "account", go: "mypage",
    kw: ["비밀번호", "회원정보", "password", "memberinfo"],
    ko: "회원정보 수정이나 비밀번호 변경은 우측 상단의 로그인 표시나 왼쪽 메뉴의 '마이페이지'에서 하실 수 있어요. 마이페이지로 바로 열어드릴까요?",
    en: "You can edit your member info or change your password from the login area at the top-right or 'My Page' in the left menu. Would you like me to open My Page?",
  },
];

/** 확실한 단순 FAQ 이면 { id, go, answer }, 아니면 null(= AI 로 넘김). */
export function matchFaq(message, lang) {
  const msg = String(message || "").trim();
  if (!msg || msg.length > FAQ_MAX_LEN) return null;
  if (PROBLEM_RE.test(msg)) return null;
  const n = msg.toLowerCase().replace(/\s+/g, "");
  if (AMBIGUOUS.some((k) => n.indexOf(k) >= 0)) return null;
  const hits = FAQ_STUDENT.filter((f) => f.kw.some((k) => n.indexOf(k) >= 0));
  if (hits.length !== 1) return null;
  const f = hits[0];
  return { id: f.id, go: f.go, answer: lang === "en" ? f.en : f.ko };
}

// ===== 미리 만들어 둘 음성 문장(/api/tts/prewarm) =====
// ⛔ 화면(public/*.html)이 «실제로 읽는 글자» 와 한 글자라도 다르면 캐시가 안 맞습니다(짝입니다).
//    다르면 그냥 첫 재생 때 한 번 더 만들 뿐이라 고장은 아닙니다.
// student.html 의 GO_LABELS 중 FAQ·환불에서 쓰는 라벨 — 「네, ○○ 페이지를 열어드릴게요!」
const PAGE_OPEN_LABELS_KO = ["수업 입장", "연기/변경", "수강료", "평가표", "마이페이지", "자료실(교재)", "레벨테스트", "환불규정"];

export function prewarmTexts() {
  const student = [];
  for (const f of FAQ_STUDENT) student.push(f.ko, f.en);
  // student.html I18N.greet / deliverRefund / 거절 응답 / openGoNow
  student.push(
    "무엇을 도와 드릴까요?",
    "How can I help you?",
    "망고아이 환불은 교육청 환불규정에 따라 수업 진행 정도에 맞춰 아래 표 기준으로 처리돼요. 아래 표를 참고해 주세요! 환불규정 메뉴로 연결해 드릴까요?",
    "Mangoi's refund follows the Office of Education's policy, calculated by how much of the course has been completed — please see the table below. Would you like me to open the Refund Policy page?",
    "네, 알겠어요! 다른 궁금한 점이 있으면 언제든 물어봐 주세요.",
    "Opening the page for you.",
  );
  for (const lb of PAGE_OPEN_LABELS_KO) student.push("네, " + lb + " 페이지를 열어드릴게요!");
  // index.html I18N.greetSpeak (운영비서)
  const ops = [
    "안녕하세요 관리자님! 저는 망고아이 AI 운영 비서예요. 평가서 작성, 실시간 이상감지 대응, 정산과 알림까지 도와드릴게요.",
    "Hello, admin! I'm Mangoi's AI Operations Assistant. I can help with evaluations, real-time anomaly response, settlements and alerts.",
  ];
  return [...new Set(student)].map((text) => ({ text, mode: "student" }))
    .concat(ops.map((text) => ({ text, mode: "ops" })));
}
