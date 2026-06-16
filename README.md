# 망고아이 AI 운영 비서 — Cloudflare 배포판

영상 아바타 + 음성(TTS) + **Cloudflare Workers AI** 상담을 **Cloudflare Workers**(정적 자산 + API)에 올리고,
망고아이 웹/모바일 웹에 **iframe 위젯**으로 띄우는 패키지입니다.

- 답변 생성(`/api/chat`): **Cloudflare Workers AI** (Llama 3.3) — 외부 API 키 불필요.
- 음성 합성(`/api/tts`): **Typecast** — 키가 있으면 사용, 없으면 브라우저 한국어 TTS로 자동 폴백.
- 음성 인식(`/api/stt`): **Workers AI Whisper** — 외부 키 불필요.

**핵심 안전 원칙**: 외부 키(Typecast 등)는 **Cloudflare 환경변수(Secret)**에만 넣습니다. 코드·깃허브·브라우저
어디에도 키를 적지 않으므로 공개 배포해도 안전합니다.

## 폴더 구성
```
mangoi-develop2/
├─ src/index.js            # 백엔드 Worker: /api/chat(Workers AI), /api/tts(Typecast), /api/stt(Whisper)
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

## 1) (선택) Typecast 음성 키
답변 생성·음성 인식은 키 없이 동작합니다. 더 자연스러운 한국어 음성을 원하면 Typecast 키를 준비하세요.
키가 없으면 브라우저 내장 TTS로 자동 폴백되므로 필수는 아닙니다.

## 2) (선택) 로컬 테스트
```bash
npm install
# (선택) Typecast 키를 쓸 경우에만: 프로젝트 루트에 .dev.vars 파일을 만들고 아래 한 줄 추가
#   TYPECAST_API_KEY=발급받은_키
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
4. (선택) **Settings → Variables and Secrets** 에 `TYPECAST_API_KEY` 를 Secret 으로 추가하면 Typecast 음성이 켜집니다.
5. **Deploy** → 빌드 후 `https://OOO.workers.dev` 공개 주소 발급.

**방법 B — CLI**
```bash
npm install
npx wrangler deploy                         # 첫 배포
npx wrangler secret put TYPECAST_API_KEY     # (선택) Typecast 키 입력 후 재배포
```

자동 배포: 방법 A로 연결하면 이후 `git push` 할 때마다 **Cloudflare 가 자동으로 재배포**합니다.

## 5) 망고아이 웹/앱에 연동
망고아이 관리자 페이지에서 이 위젯을 `iframe` 으로 띄우고, `src` 를 4번에서 받은 `https://OOO.workers.dev`
주소로 지정하세요. 부모 페이지와는 `postMessage` 로 통신합니다.
- 부모 → 위젯: `mangoi-greet`(인사), `mangoi-stop`(음성 정지), `{type:"mangoi-lang", lang:"ko"|"en"}`(언어 전환).
- 위젯 → 부모: `mangoi-avatar-close`(닫기), `{type:"mangoi-open", go, q}`(관리자 메뉴 이동), `mangoi-typing`(입력 시작).
- 모바일 웹에서는 화면 크기에 맞춰 자동으로 커집니다.

## 주의사항
- **키 안전**: 외부 키(Typecast)는 Cloudflare 환경변수에만 존재. 브라우저로 내려가지 않습니다.
- **음성**: Typecast 키가 있으면 통일된 한국어 음성, 없으면 방문자 브라우저의 한국어 TTS로 읽어줍니다. 영어 답변은 브라우저 TTS 사용.
- **HTTPS**: Workers 주소는 기본 HTTPS. 임베드하는 사이트도 HTTPS 여야 합니다.
- **콜드스타트 없음**: Cloudflare는 잠들지 않아 첫 응답도 빠릅니다.
- **비용**: Workers AI + Cloudflare 무료 플랜 한도 내에서 추가 비용 없음(Typecast는 별도 과금 정책).
