// 망고아이 AI 운영 비서 — 테스트 하니스
// 실행: node test-harness.mjs   (또는 8_test.bat 더블클릭)
// src/index.js 의 순수 함수 로직을 검증한다. 외부 호출(AI/TTS/STT) 없이 동작.

import {
  isPointsQuestion,
  isRefundQuestion,
  extractStudentName,
  detectMenu,
  detectGo,
  extractGo,
  stripLeakedCodes,
  hasKorean,
  hasAzureKey,
  buildAzureSsml,
  azureVoice,
  ttsCacheKey,
  TTS_MAX_CHARS,
  normalizeTtsText,
  usageReport,
  usageMonth,
} from "./src/index.js";
import { matchFaq, prewarmTexts } from "./src/faq.js";

let pass = 0, fail = 0;
const fails = [];

function eq(got, want) {
  return JSON.stringify(got) === JSON.stringify(want);
}
function t(name, got, want) {
  if (eq(got, want)) { pass++; }
  else { fail++; fails.push({ name, got, want }); }
}
function menuGo(msg) { const m = detectMenu(msg); return m ? m.go : null; }

// ===== hasKorean (언어 자동 감지) =====
t("hasKorean: 한글", hasKorean("안녕하세요"), true);
t("hasKorean: 영어", hasKorean("hello there"), false);
t("hasKorean: 자모", hasKorean("ㅎㅇ"), true);

// ===== isPointsQuestion =====
t("points: 포인트 질문", isPointsQuestion("포인트가 뭐야?"), true);
t("points: 적립",        isPointsQuestion("적립은 어떻게 해?"), true);
t("points: 기프티콘",    isPointsQuestion("기프티콘 교환 방법"), true);
t("points: 영어 points", isPointsQuestion("how many points does she have"), true);
t("points: gifticon",    isPointsQuestion("redeem a gifticon"), true);
// 회귀: 영어 단수 'point'(point out)는 포인트 흐름이 아니어야 함
t("points: point out 오라우팅 방지", isPointsQuestion("let me point out the attendance issue"), false);
t("points: 무관한 운영 질문", isPointsQuestion("강사 급여 정산 도와줘"), false);

// ===== extractStudentName =====
// 회귀(핵심 버그): '포인트가'를 학생 이름으로 추출하면 안 됨
t("name: '포인트가 뭐야' → 이름없음", extractStudentName("포인트가 뭐야?"), "");
t("name: '포인트 충전 방법' → 이름없음", extractStudentName("포인트 충전 방법 알려줘"), "");
t("name: '적립은 어떻게' → 이름없음", extractStudentName("적립은 어떻게 해?"), "");
// 정상: 실제 학생 이름 추출
t("name: '홍길동 포인트' → 홍길동", extractStudentName("홍길동 포인트 얼마야?"), "홍길동");
t("name: '민수 포인트 잔액' → 민수", extractStudentName("민수 포인트 잔액 보여줘"), "민수");
t("name: 영문 아이디 → student01", extractStudentName("student01 포인트 조회"), "student01");

// ===== detectMenu (메뉴 라우팅 우선순위) =====
t("menu: 미납 → sub-overdue", menuGo("미납 알림과 지점·강사 정산을 도와줘"), "sub-overdue");
t("menu: 급여 → card-payroll", menuGo("강사 급여 정산 도와줘"), "card-payroll");
t("menu: 출석 → attendance", menuGo("학생 출석 현황 보여줘"), "card-school-attendance-stats");
t("menu: 이상감지 → admin-alerts", menuGo("실시간 이상감지 현황과 대응 방법"), "card-admin-alerts");
t("menu: 평가서 → sub-eval-create", menuGo("학생 평가서 작성 도와줘"), "sub-eval-create");
t("menu: 공휴일 → card-calendar", menuGo("공휴일 등록은 어디서 해?"), "card-calendar");
t("menu: 무관 → null", menuGo("오늘 날씨 어때?"), null);

// ===== isRefundQuestion =====
t("refund: 환불", isRefundQuestion("환불 규정 알려줘"), true);
t("refund: 위약금", isRefundQuestion("위약금 얼마예요?"), true);
t("refund: 돌려받기", isRefundQuestion("돈 돌려받고 싶어요"), true);
t("refund: 무관", isRefundQuestion("출석 현황 보여줘"), false);

// ===== extractGo (페이지 이동 태그 추출 + 정리) =====
t("go: 유효 코드 추출", extractGo("환불 규정을 열어드릴게요. [[GO:refund]]", "ko").go, "refund");
t("go: 태그 본문 제거", /GO|\[\[/.test(extractGo("안내드릴게요 [[GO:report]]", "ko").answer), false);
t("go: 무효 코드 → null", extractGo("그냥 답변 [[GO:nonexistent]]", "ko").go, null);
t("go: 빈 답변 한글 폴백", extractGo("[[GO:report]]", "ko").answer, "음, 다시 한 번 말씀해 주시겠어요?");
t("go: 빈 답변 영어 폴백", extractGo("[[GO:report]]", "en").answer, "Sorry, could you say that again?");

// ===== detectGo (학생 상담사 모드 — 메시지 키워드 → GO 코드) =====
t("student go: 수업 입장 → lesson-enter", detectGo("수업 입장 어떻게 해요?"), "lesson-enter");
t("student go: 수업 연기 → lesson-change", detectGo("수업 연기하고 싶어요"), "lesson-change");
t("student go: 환불 → refund", detectGo("환불 받을 수 있나요?"), "refund");
t("student go: 결제 → payment", detectGo("결제는 어디서 하나요?"), "payment");
t("student go: 무관 → null", detectGo("오늘 기분이 좋아요"), null);
t("student go: 마이페이지 → mypage", detectGo("마이페이지 가게 해줘"), "mypage");
t("student go: 학생정보 → mypage", detectGo("학생정보 알고싶어요"), "mypage");
t("student go: 내 정보 → mypage", detectGo("내 정보 확인하고 싶어요"), "mypage");
t("student go: 학습 현황 → mypage(전체메뉴 아님)", detectGo("자녀 학습 현황 보고 싶어요"), "mypage");

// ===== stripLeakedCodes (본문에 흘린 코드 토큰 정리) =====
t("strip: 괄호 코드 제거", /lesson-enter/.test(stripLeakedCodes("수업 입장은 (lesson-enter) 하세요")), false);
t("strip: 일반 문장 보존", stripLeakedCodes("안녕하세요 반갑습니다"), "안녕하세요 반갑습니다");

// ===== Azure 음성 (TTS) =====
{
  const AZ = { AZURE_SPEECH_KEY: "k", AZURE_SPEECH_REGION: "koreacentral" };
  t("tts: 키+리전 → Azure 사용", hasAzureKey(AZ), true);
  t("tts: 리전 없음 → 미사용", hasAzureKey({ AZURE_SPEECH_KEY: "k" }), false);
  t("tts: 키 없음 → 미사용", hasAzureKey({}), false);
}
t("voice: 학생 한국어 기본", azureVoice({}, "ko"), "ko-KR-SunHiNeural");
t("voice: 영어 기본", azureVoice({}, "en"), "en-US-JennyNeural");
t("voice: 운영비서 전용 목소리", azureVoice({ AZURE_VOICE_KO_OPS: "ko-KR-InJoonNeural" }, "ko", "ops"), "ko-KR-InJoonNeural");
t("voice: 운영비서 전용 없으면 학생 목소리", azureVoice({ AZURE_VOICE_KO: "ko-KR-JiMinNeural" }, "ko", "ops"), "ko-KR-JiMinNeural");
t("voice: 학생은 운영비서 목소리 안 씀", azureVoice({ AZURE_VOICE_KO_OPS: "ko-KR-InJoonNeural" }, "ko"), "ko-KR-SunHiNeural");
t("voice: 잘못된 환경변수 → 기본값", azureVoice({ AZURE_VOICE_KO: 'x"><bad' }, "ko"), "ko-KR-SunHiNeural");
t("tts: 글자 상한 500", TTS_MAX_CHARS, 500);
{
  const a = await ttsCacheKey("ko-KR-SunHiNeural", "안녕하세요");
  t("cache: 키 형식", /^tts\/[0-9a-f]{64}\.mp3$/.test(a), true);
  t("cache: 같은 입력 → 같은 키", a, await ttsCacheKey("ko-KR-SunHiNeural", "안녕하세요"));
  t("cache: 목소리 다르면 다른 키", a === await ttsCacheKey("ko-KR-InJoonNeural", "안녕하세요"), false);
}
t("ssml: 목소리·언어", buildAzureSsml("Hello", "en", "en-US-JennyNeural").includes('xml:lang="en-US"><voice name="en-US-JennyNeural">'), true);
t("ssml: 특수문자 이스케이프", buildAzureSsml('A<B & "C"', "en", "en-US-JennyNeural").includes("A&lt;B &amp; &quot;C&quot;"), true);

// ===== FAQ 정해진 답변 (src/faq.js) =====
{
  const id = (q) => { const r = matchFaq(q, /[가-힣]/.test(q) ? "ko" : "en"); return r ? r.id : null; };
  t("faq: 수업 입장", id("수업 입장 어떻게 해요?"), "lesson-enter");
  t("faq: 수업 연기", id("수업 연기하고 싶어요"), "lesson-change");
  t("faq: 결제", id("결제는 어디서 하나요?"), "payment");
  t("faq: 수강료", id("수강료 얼마예요?"), "price");
  t("faq: 성적표", id("성적표 보고 싶어요"), "report");
  t("faq: 비밀번호", id("비밀번호 바꾸고 싶어요"), "account");
  t("faq: 영어 입장", id("How do I enter class?"), "lesson-enter");
  t("faq: 영어 가격", id("How much is the tuition?"), "price");
  // 애매하면 AI 로
  t("faq: '얼마나 걸려요'는 가격 아님", id("얼마나 걸려요?"), null);
  t("faq: '수업방법'은 입장 아님", id("수업방법이 궁금해요"), null);
  t("faq: 결제 취소 → AI", id("결제 취소하고 싶어요"), null);
  t("faq: 문제 상황 → AI", id("결제가 안돼요"), null);
  t("faq: 교재비 → AI", id("교재비 얼마예요?"), null);
  t("faq: 주제 두 개 → AI", id("수업 연기하고 결제도 하고 싶어요"), null);
  t("faq: feedback 은 fee 아님", id("I want feedback"), null);
  t("faq: 긴 질문 → AI", id("수업 입장하려고 하는데 우리 아이가 처음이라 어떻게 해야 할지 잘 모르겠어요 알려주세요"), null);
  const r = matchFaq("성적표", "ko");
  t("faq: go 코드", r.go, "report");
  t("faq: 답변에 태그 없음", /\[\[/.test(r.answer), false);
}
{
  const list = prewarmTexts();
  t("prewarm: 중복 없음", new Set(list.map((x) => x.mode + x.text)).size, list.length);
  t("prewarm: 모두 500자 이하", list.every((x) => x.text.length <= TTS_MAX_CHARS), true);
  t("prewarm: 운영비서 인사 포함", list.some((x) => x.mode === "ops"), true);
}

// ===== 읽을 글자 정리 (캐시 키 통일) =====
t("norm: 이모지 제거", normalizeTtsText("무엇을 도와 드릴까요? 😊"), "무엇을 도와 드릴까요?");
t("norm: 공백 정리", normalizeTtsText("  네,   알겠어요!\n"), "네, 알겠어요!");
t("norm: 마크다운 기호 제거", normalizeTtsText("**중요** 안내"), "중요 안내");
t("norm: 📂 메뉴 안내", normalizeTtsText("📂 ‘학생관리’ 메뉴로 열어드릴까요?"), "‘학생관리’ 메뉴로 열어드릴까요?");

// ===== Azure 사용량 / 약정 권장 =====
t("usage: 월 (한국시간)", usageMonth(Date.UTC(2026, 9, 31, 16, 0)), "2026-11");
t("usage: 적을 때 권장 안 함", usageReport("2026-10", { chars: 1000000, calls: 10 }).commit_recommended, false);
t("usage: 6,400만 자 이상 권장", usageReport("2026-10", { chars: 64000000, calls: 10 }).commit_recommended, true);
t("usage: 종량제 금액", usageReport("2026-10", { chars: 2000000, calls: 1 }).payg_usd, 30);

// ===== 결과 출력 =====
console.log("\n=== 망고아이 운영비서 test-harness ===");
if (fails.length) {
  console.log(`\n❌ 실패 ${fail}건:`);
  for (const f of fails) {
    console.log(`  - ${f.name}\n      got : ${JSON.stringify(f.got)}\n      want: ${JSON.stringify(f.want)}`);
  }
}
console.log(`\n총 ${pass + fail}개  |  ✅ 통과 ${pass}  |  ❌ 실패 ${fail}`);
console.log(fail === 0 ? "🎉 모든 테스트 통과!\n" : "⚠️  실패한 테스트가 있어요.\n");
process.exit(fail === 0 ? 0 : 1);
