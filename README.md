# 망고아이 AI 상담직원 — Cloudflare 배포판

영상 아바타 + 음성(TTS) + Gemini 상담을 **Cloudflare Pages**에 올리고, 망고아이 웹/모바일 웹에
**iframe 위젯**으로 띄우는 패키지입니다. (원본 Flask/Render 버전을 Cloudflare용 JavaScript로 재구성)

**핵심 안전 원칙**: Gemini 키는 **Cloudflare 환경변수(Secret)**에만 넣습니다. 코드·깃허브·브라우저
어디에도 키를 적지 않으므로 공개 배포해도 안전합니다.

## 폴더 구성
```
mangoi-develop2/
├─ functions/api/chat.js   # 백엔드: Gemini 호출(키는 환경변수에서만 읽음)
├─ public/
│  ├─ index.html           # 아바타 + 음성 + 채팅 화면 (반응형, iframe 안에서 꽉 참)
│  └─ _headers             # 권한/CORS 헤더
├─ embed-snippet.html      # 망고아이 웹/앱에 붙일 iframe 위젯
├─ wrangler.toml           # Cloudflare Pages 설정
├─ package.json
├─ .gitignore / .dev.vars.example
```
> 아바타 영상(`avatar.mp4`)은 원본 저장소의 파일을 jsDelivr CDN으로 자동 참조합니다.
> 직접 호스팅하려면 `public/avatar.mp4`로 넣고 `index.html`의 `<video src>`를 `/avatar.mp4`로 바꾸세요.

---

## 1) Gemini 키 준비
https://aistudio.google.com/apikey → 키 복사(`AIza...`). 무료 등급으로 충분합니다.

## 2) (선택) 로컬 테스트
```bash
npm install
cp .dev.vars.example .dev.vars     # .dev.vars 의 GEMINI_API_KEY 에 키 입력
npm run dev                        # http://localhost:8788
```

## 3) GitHub 업로드 (commit & push)
```bash
git init
git add .
git commit -m "mangoi ai avatar - cloudflare 배포판"
git branch -M main
git remote add origin https://github.com/navy111p-sudo/mangoi-develop2.git
git push -u origin main
```
> ⚠️ `.dev.vars`, `.env` 는 `.gitignore`로 제외돼 있어 키가 깃허브에 올라가지 않습니다.

## 4) Cloudflare Pages 배포
**방법 A — 대시보드(권장)**
1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. `mangoi-develop2` 저장소 선택
3. 빌드 설정:
   - **Framework preset**: None
   - **Build command**: 비움
   - **Build output directory**: `public`
4. **Settings → Environment variables → Production**에 추가:
   - `GEMINI_API_KEY` = (복사한 키)   ← ★ 여기에만 키를 넣습니다(안전)
5. **Save and Deploy** → 빌드 후 `https://OOO.pages.dev` 공개 주소 발급.

**방법 B — CLI**
```bash
npx wrangler pages project create mangoi-ai-avatar
npx wrangler pages secret put GEMINI_API_KEY        # 키 입력
npm run deploy
```

자동 배포: 4번 방법 A로 연결하면 이후 `git push` 할 때마다 **Cloudflare가 자동으로 재배포**합니다.

## 5) 망고아이 웹/앱에 연동
망고아이 웹 저장소의 페이지 `</body>` 바로 위에 `embed-snippet.html` 내용을 붙여넣고,
iframe 의 `src` 를 4번에서 받은 `https://OOO.pages.dev` 주소로 바꾸세요.
- 우측 하단 토글 버튼(💁‍♀️)으로 상담창이 열리고 닫힙니다.
- 모바일 웹에서는 화면 크기에 맞춰 자동으로 커집니다.
- 상담창 안 ❌ 버튼을 누르면 위젯이 접힙니다(부모 페이지로 신호 전달).

## 주의사항
- **키 안전**: 키는 Cloudflare 환경변수에만 존재. 브라우저로 내려가지 않습니다.
- **음성**: 답변은 방문자 브라우저의 한국어 TTS로 읽어줍니다(무료). 영상 자체 소리는 꺼져 있음.
- **HTTPS**: Pages 주소는 기본 HTTPS. 임베드하는 사이트도 HTTPS 여야 합니다.
- **콜드스타트 없음**: Render 무료판과 달리 Cloudflare는 잠들지 않아 첫 응답도 빠릅니다.
- **비용**: Gemini 무료 등급 + Cloudflare Pages 무료 플랜 한도 내에서 추가 비용 없음.
