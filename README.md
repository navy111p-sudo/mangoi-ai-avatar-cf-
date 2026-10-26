# 망고아이 AI 운영 비서 — Cloudflare 배포판

영상 아바타 + 음성(TTS) + **Cloudflare Workers AI** 상담을 **Cloudflare Workers**(정적 자산 + API)에 올리고,
망고아이 웹/모바일 웹에 **iframe 위젯**으로 띄우는 패키지입니다.

- 답변 생성(`/api/chat`): **Cloudflare Workers AI** (Llama 3.3) — 외부 API 키 불필요.
- 음성 합성(`/api/tts`): **Azure Speech** 만 사용 (100만 자당 $15) — mangoi.ai 와 같은 구조
  - ① **R2 캐시** 먼저 확인 → 같은 문장은 한 번만 만들고 이후 무료 재생
  - ② 없으면 Azure 로 생성 (학생·운영비서·영어 목소리 따로 지정 가능)
  - ③ 실패·키 없음·500자 초과 → 브라우저 음성으로 자동 폴백
  - ⛔ Typecast 는 쓰지 않습니다 (100만 자당 $70~90, Azure 의 5배 이상)
- 자주 묻는 질문(`src/faq.js`): 수업 입장·연기, 결제·수강료, 성적표, 마이페이지, 교재, 레벨테스트, 비밀번호는
  **AI 없이 정해진 답변** → 글자가 늘 같아 음성도 캐시에서 무료 재생. 애매한 질문(문제 상황·두 가지 주제·40자 초과)은 AI 로.
- `POST /api/tts/prewarm`: 정해진 문장 음성을 미리 만들어 둠(약 2,800자 ≈ $0.04, 한 번) → `13_prewarm.bat`
- `GET /api/tts/usage`: 이번 달 Azure 사용 글자 수·예상 요금·**약정 요금제 권장 여부**(월 6,400만 자 이상)
- 음성 인식(`/api/stt`): **Workers AI Whisper** — 외부 키 불필요.

**핵심 안전 원칙**: 외부 키(Azure)는 **Cloudflare 환경변수(Secret)**에만 넣습니다. 코드·깃허브·브라우저
어디에도 키를 적지 않으므로 공개 배포해도 안전합니다.

## 폴더 구성
```
mangoi-develop2/
├─ src/index.js            # 백엔드 Worker: /api/chat(Workers AI), /api/tts(Azure Speech + R2 캐시), /api/stt(Whisper)
├─ public/
│  ├─ index.html           # 아바타 + 음성 + 채팅 화면 (반응형, iframe 안에서 꽉 참)
│  ├─ ops-greeting.mp4      # 인사 영상(말하는 아바타)
│  └─ _headers             # 권한/CORS 헤더
├─ wrangler.toml           # Cloudflare Workers(+정적 자산) 설정
├─ package.json
└─ .gitignore
```
> 인사 영상은 `public/ops-greeting.mp4` 로 직접 호스팅하며, `index.html` 의 `<video src="./ops-greeting.mp4">` 에서 참조합니다.

---

## 1) 음성 캐시 버킷 (처음 한 번)
`12_r2_cache.bat` 더블클릭 (또는 `npx wrangler r2 bucket create mangoi-avatar-tts-cache`).
⚠️ 버킷이 없으면 배포가 실패합니다.

## 1-1) Azure Speech 키
1. Azure 포털 → Speech 리소스 → **Keys and Endpoint** 에서 **KEY 1** 과 **Location/Region**(예: `koreacentral`) 확인
2. `11_azure_key.bat` 더블클릭 → 키와 리전 입력 → `3_재배포.bat`
   (또는 `npx wrangler secret put AZURE_SPEECH_KEY` / `npx wrangler secret put AZURE_SPEECH_REGION`)
3. (선택) 목소리 변경: `AZURE_VOICE_KO`(학생, 기본 `ko-KR-SunHiNeural`), `AZURE_VOICE_KO_OPS`(운영비서, 없으면 학생과 같음), `AZURE_VOICE_EN`(기본 `en-US-JennyNeural`)
4. 확인: 응답 헤더 `X-TTS-Provider` 가 `azure`(새로 만듦) 또는 `r2-cache`(캐시 재생)
5. 배포 후 `13_prewarm.bat` 한 번 실행 → 자주 쓰는 문장 음성 미리 만들기

## 2) (선택) 로컬 테스트
```bash
npm install
# (선택) 로컬에서 음성까지 테스트하려면 프로젝트 루트에 .dev.vars 파일을 만들고 아래 추가
#   AZURE_SPEECH_KEY=발급받은_키
#   AZURE_SPEECH_REGION=koreacentral
npm run dev                        # http://localhost:8787
```

## 3) GitHub 업로드 (commit & push)
```bash
git init
git add .
git commit -m "mangoi ai avatar - cloudflare 배포판"
git branch -M main
git remote add origin https://github.com/navy111p-sudo/mangoi-ai-avatar-cf-.git
git push -u origin main
```
> ⚠️ `.dev.vars`, `.env` 는 `.gitignore`로 제외돼 있어 키가 깃허브에 올라가지 않습니다.
> (Windows 사용자는 루트의 `1_github_배포.bat` 더블클릭으로 위 과정을 자동 실행할 수 있습니다.
>  단, 스크립트의 `REMOTE_URL` 이 실제 GitHub 저장소 주소와 같은지 먼저 확인하세요.)

## 4) Cloudflare Workers 배포 (정적 자산 + API)
이 프로젝트는 Cloudflare **Workers + static assets** 방식입니다.
`public/` 정적 파일이 먼저 서빙되고, `/api/*` 경로만 `src/index.js` Worker 가 처리합니다.

**방법 A — 대시보드(권장)**
1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Import a repository**
2. 위 3)에서 올린 저장소 선택
3. 설정:
   - **Project name**: `mangoi-ai-avatar-cf` (wrangler.toml 의 name 과 동일하게)
   - **Build command**: 비움
   - **Deploy command**: `npx wrangler deploy` (기본값 그대로)
4. **Settings → Variables and Secrets** 에 `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` 을 Secret 으로 추가합니다.
5. **Deploy** → 빌드 후 `https://OOO.workers.dev` 공개 주소 발급.

**방법 B — CLI**
```bash
npm install
npx wrangler deploy                         # 첫 배포
npx wrangler r2 bucket create mangoi-avatar-tts-cache   # 음성 캐시 버킷(처음 한 번)
npx wrangler secret put AZURE_SPEECH_KEY
npx wrangler secret put AZURE_SPEECH_REGION
```

자동 배포: 방법 A로 연결하면 이후 `git push` 할 때마다 **Cloudflare 가 자동으로 재배포**합니다.

## 5) 망고아이 웹/앱에 연동
망고아이 관리자 페이지에서 이 위젯을 `iframe` 으로 띄우고, `src` 를 4번에서 받은 `https://OOO.workers.dev`
주소로 지정하세요. 부모 페이지와는 `postMessage` 로 통신합니다.
- 부모 → 위젯: `mangoi-greet`(인사), `mangoi-stop`(음성 정지), `{type:"mangoi-lang", lang:"ko"|"en"}`(언어 전환).
- 위젯 → 부모: `mangoi-avatar-close`(닫기), `{type:"mangoi-open", go, q}`(관리자 메뉴 이동), `mangoi-typing`(입력 시작).
- 모바일 웹에서는 화면 크기에 맞춰 자동으로 커집니다.

## 주의사항
- **키 안전**: 외부 키(Azure)는 Cloudflare 환경변수에만 존재. 브라우저로 내려가지 않습니다.
- **음성**: Azure 음성(한국어·영어). 키가 없거나 실패하면 방문자 브라우저 음성으로 읽어줍니다.
- **HTTPS**: Workers 주소는 기본 HTTPS. 임베드하는 사이트도 HTTPS 여야 합니다.
- **콜드스타트 없음**: Cloudflare는 잠들지 않아 첫 응답도 빠릅니다.
- **비용**: Workers AI는 하루 1만 뉴런 무료, 초과분 1,000뉴런당 $0.011. 음성은 Azure $15/100만 자(R2 캐시 재생분은 0원), R2는 월 10GB 무료.
