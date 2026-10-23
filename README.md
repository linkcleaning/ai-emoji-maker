# AI 이모티콘 메이커 (PWA)

사진 한 장(인물 · 고양이 · 강아지)으로 **12종 감정 이모티콘 스티커 팩**을 만드는 모바일 PWA.
React 18 + Vite + Tailwind CSS + Lucide + JSZip.

## 두 가지 운영 방식
| 주소 | 방식 |
|---|---|
| **Cloudflare 주소** (`ai-emoji-maker.….workers.dev`) | **무료 이용 모드**: 사장님 Gemini 키를 서버에 숨겨두고 손님은 키 없이 사용. 1인 하루 2팩 무료, 추가는 입금 → 관리자가 이용 코드에 충전 |
| 깃허브 페이지 (`linkcleaning.github.io/ai-emoji-maker`) | 각자 자기 API 키를 넣어 사용 |

### Cloudflare 배포 (무료 이용 모드)
1. Cloudflare 대시보드 → Workers & Pages → 만들기 → **Git 저장소 가져오기** → `linkcleaning/ai-emoji-maker`
2. 프로젝트 이름 `ai-emoji-maker`, 빌드 명령 `npm run build`, 배포 명령 `npx wrangler deploy`
3. 배포 후 → 설정 → **변수 및 비밀** → 유형 '비밀'로 2개 추가
   - `GEMINI_API_KEY` : 결제 연결된(link 프로젝트) Gemini 키
   - `ADMIN_PASSWORD` : 관리자 비밀번호
4. 주소 뒤에 `#admin` 을 붙이거나 ⚙️ → 관리자 → 입금 안내·한도 설정

서버 코드는 `worker/` (사용량 기록은 Durable Object SQLite, 별도 DB 생성 불필요).

## 실행
```bash
npm install
npm run dev      # 개발 서버 (같은 와이파이의 폰에서 접속 가능: --host)
npm run build    # dist/ 생성 → 정적 호스팅에 업로드
```
Cloudflare 배포: Build command `npm run build`, 출력 디렉터리 `dist`.
PWA 설치·서비스 워커는 **HTTPS(또는 localhost)** 에서만 동작합니다.

## 사용법
1. 오른쪽 위 ⚙️ → Gemini 또는 OpenAI API 키 입력 (이 기기 localStorage에만 저장)
2. 사진 업로드/촬영 → `인물 | 고양이 | 강아지` · `3D 피규어풍 | 2D 감성 카툰풍` 선택
3. **이모티콘 12종 만들기** → 스티커 탭해서 크게 보기 / 개별 저장 / 공유 / 다시 생성
4. 하단 바: **전체 ZIP**(12장 + 시트 이미지), **시트**(베이지 배경 한 장), **공유**(모바일 공유 시트 → 카카오톡 등)

## 생성 방식 (설정에서 선택)
| 방식 | 호출 | 특징 |
|---|---|---|
| 개별 12장 (기본) | 12회 | 1번 스티커로 캐릭터를 먼저 디자인 → 나머지 11장에 **원본 사진 + 기준 캐릭터**를 함께 보내 얼굴·무늬 일관성 유지. 실패한 칸만 재생성 가능 |
| 시트 1장 | 1회 | 4행×3열 시트를 한 번에 그린 뒤 자동 분할. 빠르고 저렴 |

## 투명 배경 · 다이컷 테두리 처리
- **Gemini**: 투명 PNG를 못 주므로 `#00FF00` 크로마 배경으로 요청 → 앱이 가장자리에서 연결된 배경만 지움(캐릭터 안의 흰 옷 등은 보존) → 초록 번짐 제거
- **OpenAI gpt-image-1**: `background: transparent`로 직접 투명 PNG 수신
- 이후 공통으로 **굵은 흰 다이컷 테두리 + 은은한 그림자**를 앱에서 합성 → 12장 테두리 두께가 항상 균일, 768×768 PNG 출력
- 설정에서 끄면 AI가 테두리까지 직접 그림

## 파일 구조
```
src/lib/prompts.js     ← 프롬프트 엔진 (스타일·카테고리·12감정 포즈) — 문구 튜닝은 여기서
src/lib/api.js         ← Gemini / OpenAI 호출
src/lib/imageTools.js  ← 배경 제거, 다이컷 테두리, 시트 분할/합성
src/lib/share.js       ← PNG·ZIP 다운로드, Web Share
src/components/*       ← UI
public/sw.js, manifest.webmanifest ← PWA
```

## 비용 · 결제 (중요)
- **Gemini 이미지 모델은 무료 할당량이 없습니다.** Google AI Studio에서 결제(빌링)를 연결해야 생성돼요. 연결 안 하면 `429 You exceeded your current quota` 오류가 납니다.
- 기본 모델 `gemini-3.1-flash-image`(Nano Banana 2): 1024px 한 장 약 $0.067 → 12장 팩 약 $0.8. 더 싸게: `gemini-3.1-flash-lite-image`, 시트 1장 모드(호출 1회).
- `gemini-2.5-flash-image`는 신규 사용자에게 막혀 있어 목록에서 뺐습니다.

## 참고
- API 키를 브라우저에서 직접 쓰는 구조라 **개인용/사내용**에 적합합니다. 공개 서비스로 운영하려면 키를 서버(Cloudflare Worker 등)로 옮기세요.
- 카카오톡 공유는 Web Share API(모바일 공유 시트)를 사용합니다. 공유 미지원 브라우저(대부분 PC)는 자동으로 다운로드됩니다.
- 모델 ID는 `src/lib/api.js`의 `PROVIDERS`에서 바꿀 수 있습니다.
