// 망고아이 AI 아바타 — 무작위 스트레스 테스트
// 실행: npm run stress   (또는 node stress-test.mjs [건수=1000] [시드=12345])
// 실제 Azure/AI/R2 대신 가짜(장애 포함: 500·429·빈 오디오·네트워크 끊김·R2 장애)로
// 수천 건을 요청하고, "절대 깨지면 안 되는 규칙" 을 매 건 검사한다.
//   - 200 이면 진짜 오디오(800B 이상)·공급자 헤더(azure|r2-cache)
//   - 캐시 적중이면 Azure 를 부르지 않음 · 미리 만들기는 고정 목록 수 이상 부르지 않음
//   - Azure 로 가는 SSML 에 주입·이모지 없음, 목소리 이름 형식 검사
//   - 채팅 답변이 비지 않고 [[GO:..]] 태그가 새지 않음
const mod = await import("./src/index.js");
const faq = await import("./src/faq.js");
const N = Number(process.argv[2] || 1000);
let seed = Number(process.argv[3] || 12345);
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];

// ---- 가짜 외부 서비스 ----
let azureMode = "ok", azureCalls = 0, aiCalls = 0, lastSsml = "";
globalThis.fetch = async (url, opt) => {
  azureCalls++;
  if (!String(url).includes("tts.speech.microsoft.com")) throw new Error("unexpected url " + url);
  lastSsml = opt.body;
  if (azureMode === "ok") return new Response(new Uint8Array(3000), { status: 200 });
  if (azureMode === "500") return new Response("server error", { status: 500 });
  if (azureMode === "429") return new Response("too many", { status: 429 });
  if (azureMode === "empty") return new Response(new Uint8Array(10), { status: 200 });
  throw new Error("network down");
};
const store = new Map();
let r2Broken = false;
const R2 = {
  async get(k) { if (r2Broken) throw new Error("r2 down"); const v = store.get(k); return v === undefined ? null : { body: new Response(v).body, text: async () => (typeof v === "string" ? v : "") }; },
  async put(k, v) { if (r2Broken) throw new Error("r2 down"); store.set(k, v); },
};
let aiBroken = false;
const AI = { async run() { aiCalls++; if (aiBroken) throw new Error("ai down"); return { response: pick(["안녕하세요! 도와드릴게요.", "수업 입장은 우측 하단 버튼이에요. [[GO:lesson-enter]]", "Sure, I can help. [[GO:report]]", "", "[[GO:nonexistent]]"]) }; } };

const fullEnv = () => ({ AZURE_SPEECH_KEY: "k", AZURE_SPEECH_REGION: pick(["koreacentral", "KoreaCentral", " koreacentral "]), TTS_CACHE: R2, AI });
const envVariants = [
  () => fullEnv(),
  () => ({ ...fullEnv(), AZURE_SPEECH_KEY: "" }),              // 키 없음
  () => ({ AI }),                                               // 캐시·키 없음
  () => ({ ...fullEnv(), TTS_CACHE: undefined }),              // 캐시 없음
  () => ({ ...fullEnv(), AZURE_VOICE_KO: 'bad"><x', AZURE_VOICE_KO_OPS: "ko-KR-InJoonNeural" }),
];

// ---- 무작위 입력 ----
const faqQs = ["수업 입장 어떻게 해요?", "수업 연기하고 싶어요", "결제는 어디서?", "수강료 얼마예요?", "성적표", "마이페이지", "숙제 확인", "교재 어디", "레벨테스트 신청", "비밀번호 변경", "How do I enter class?", "How much is the tuition?"];
const aiQs = ["결제가 안돼요", "결제 취소하고 싶어요", "교재비 얼마예요?", "아이가 영어를 싫어해요", "수업 연기하고 결제도 하고 싶어요", "얼마나 걸려요?", "수업방법", "I want feedback", "왜 소리가 안 나요?", "환불 받고 싶어요", "a".repeat(1500), "", "   ", "<script>alert(1)</script>", "😊😊😊", "포인트 얼마?"];
const ttsTexts = [
  () => pick(faq.prewarmTexts()).text,
  () => "무엇을 도와 드릴까요? 😊",
  () => "  네,   알겠어요!  ",
  () => "A<B & \"C\" 'D' > E",
  () => "</voice><voice name='evil'>hack",
  () => "**굵게** `코드` # 제목",
  () => "가".repeat(Math.floor(rnd() * 700)),
  () => "Hello there, how are you?",
  () => "😊🎉",
  () => "",
  () => String(Math.random()),
];

const ok = [], bad = [];
function check(cond, msg) { if (!cond) bad.push(msg); }

for (let i = 0; i < N; i++) {
  azureMode = pick(["ok", "ok", "ok", "500", "429", "empty", "throw"]);
  r2Broken = rnd() < 0.1;
  aiBroken = rnd() < 0.1;
  const env = pick(envVariants)();
  const kind = pick(["chat", "chat", "tts", "tts", "tts", "prewarm", "usage", "bad"]);
  try {
    if (kind === "chat") {
      const q = rnd() < 0.5 ? pick(faqQs) : pick(aiQs);
      const mode = rnd() < 0.2 ? "ops" : undefined;
      const res = await mod.default.fetch(new Request("https://x/api/chat", { method: "POST", body: JSON.stringify({ message: q, mode }) }), env, {});
      const j = await res.json();
      check(res.status === 200 || res.status === 400, `chat status ${res.status} q=${q.slice(0, 20)}`);
      if (res.status === 200) {
        check(typeof j.answer === "string" && j.answer.length > 0, `chat empty answer q=${q.slice(0, 20)}`);
        check(!/\[\[\s*GO/i.test(j.answer), `chat leaked GO tag q=${q.slice(0, 20)}`);
        if (j.faq) check(mode !== "ops", `ops got FAQ answer q=${q}`);
      }
    } else if (kind === "tts") {
      const text = pick(ttsTexts)();
      const mode = rnd() < 0.3 ? "ops" : "student";
      const before = azureCalls;
      const res = await mod.default.fetch(new Request("https://x/api/tts", { method: "POST", body: JSON.stringify({ text, mode }) }), env, {});
      const ct = res.headers.get("content-type") || "";
      if (res.status === 200) {
        const buf = new Uint8Array(await res.arrayBuffer());
        check(ct.includes("audio/mpeg"), `tts 200 but not audio`);
        check(buf.byteLength >= 800, `tts 200 but tiny audio ${buf.byteLength}`);
        const src = res.headers.get("X-TTS-Provider");
        check(src === "azure" || src === "r2-cache", `bad provider ${src}`);
        if (src === "r2-cache") check(azureCalls === before, `cache hit still called azure`);
      } else {
        check([400, 413, 502, 503].includes(res.status), `tts unexpected status ${res.status}`);
        check(ct.includes("application/json"), `tts error not json`);
      }
      if (azureCalls > before) {
        check(!/<voice name='evil'>|<\/voice><voice/.test(lastSsml.replace(/^<speak[^>]*><voice name="[^"]+">/, "").replace(/<\/voice><\/speak>$/, "")), `SSML injection: ${lastSsml.slice(0, 120)}`);
        check(/<voice name="[a-z]{2}-[A-Z]{2}-[A-Za-z0-9]+Neural">/.test(lastSsml), `bad voice in ssml ${lastSsml.slice(0, 120)}`);
        check(!/[😊🎉]/u.test(lastSsml), `emoji sent to azure`);
      }
    } else if (kind === "prewarm") {
      const before = azureCalls;
      const res = await mod.default.fetch(new Request("https://x/api/tts/prewarm", { method: "POST" }), env, {});
      const j = await res.json();
      check([200, 503].includes(res.status), `prewarm status ${res.status}`);
      check(azureCalls - before <= faq.prewarmTexts().length, `prewarm called azure too many times ${azureCalls - before}`);
      if (res.status === 200) check(j.made + j.cached + j.failed.length === faq.prewarmTexts().length, `prewarm count mismatch`);
    } else if (kind === "usage") {
      const res = await mod.default.fetch(new Request("https://x/api/tts/usage?month=" + pick(["", "2026-10", "bad", "2026-13"])), env, {});
      check([200, 503].includes(res.status), `usage status ${res.status}`);
      if (res.status === 200) { const j = await res.json(); check(j.azure_chars >= 0 && typeof j.commit_recommended === "boolean", `usage shape`); }
    } else {
      const method = pick(["GET", "PUT", "POST"]);
      const body = method === "GET" ? undefined : pick(["not json", "{", "[]", "null", '{"text":123}', '{"text":null}']);
      const res = await mod.default.fetch(new Request("https://x/api/tts", { method, body }), env, {});
      check([400, 405, 413, 503].includes(res.status), `bad request status ${res.status} method=${method} body=${body}`);
    }
    ok.push(kind);
  } catch (e) {
    bad.push(`${kind} threw: ${e && e.stack ? e.stack.split("\n")[0] : e}`);
  }
}

const count = ok.reduce((m, k) => ((m[k] = (m[k] || 0) + 1), m), {});
console.log(`총 ${N}건 | 종류별`, JSON.stringify(count), `| 가짜 Azure 호출 ${azureCalls} | 가짜 AI 호출 ${aiCalls} | 캐시 ${store.size}개`);
const uniq = [...new Set(bad)];
console.log(uniq.length ? `❌ 규칙 위반 ${bad.length}건 (${uniq.length}종):\n  ` + uniq.slice(0, 20).join("\n  ") : "✅ 규칙 위반 0건");
process.exit(uniq.length ? 1 : 0);
