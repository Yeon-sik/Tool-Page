# Tool Page

이미지, GIF, PDF, PPTX, MP3 작업을 서버 업로드 없이 현재 브라우저에서 처리하는 정적 도구 허브입니다. 실행 라이브러리와 글꼴도 저장소에 포함해 작업 중 제3자 CDN에 연결하지 않습니다.

## 제공 도구

- 이미지 형식 변환: JPG, PNG, WEBP, SVG, TIFF 입력과 JPG, PNG, WEBP 출력
- GIF 만들기: 프레임 순서, 개별 지연, 크기, 배치, 반복 횟수 설정
- PDF 정리: 이미지 묶음을 PDF로 생성하거나 PDF 페이지를 PNG, JPG, WEBP로 출력
- PPT 정리: 이미지 묶음을 PPTX로 생성하거나 기본 요소 중심의 PPTX를 이미지로 출력
- MP3 편집: 파형 탐색, 구간 선택, 배속 적용, 세그먼트와 ZIP 내보내기
- 이미지 편집: 한 장 확대·회전·자르기·텍스트 추가 또는 최대 50장 공통 크기 조정과 ZIP 내보내기

홈에는 검색, 카테고리 필터, 최근 사용 도구 바로가기와 키보드 단축키(`/`, `Esc`)가 있습니다. 공통 변환 화면은 드래그 앤 드롭, 키보드 순서 변경, 진행 단계, 실제 작업 취소, 설정 저장과 복원, 충돌 없는 결과 파일명을 제공합니다.

## 안전 한도와 정확성

- 공통 변환: 최대 100개, 파일당 120MB, 전체 250MB
- PDF 이미지 변환: 최대 120페이지, 페이지별 브라우저 Canvas 안전 한도 적용
- PPTX 이미지 변환: 최대 100슬라이드
- 이미지 편집: 단일 파일 최대 60MB·2,400만 픽셀, 일괄 모드 최대 50장·전체 250MB
- MP3 편집: 최대 150MB
- 다중 페이지 TIFF는 첫 페이지만 조용히 누락하지 않고 변환을 중단합니다.
- 브라우저가 요청한 WEBP 형식을 만들지 못하면 다른 형식에 잘못된 확장자를 붙이지 않고 오류를 표시합니다.
- PPTX 이미지 변환은 PowerPoint 자체 렌더러가 아닙니다. 텍스트, 기본 도형, 이미지 중심 문서를 대상으로 하며 표, 차트, SmartArt, 연결선, 미디어 등 미지원 요소가 있으면 데이터 누락을 막기 위해 변환을 중단합니다.

중요한 PDF/PPTX 결과는 원본과 대조해 확인해야 합니다. 브라우저 로컬 처리와 결과 정확성은 별개의 문제입니다.

## 로컬 실행

Node.js 20 이상을 권장합니다.

```powershell
npm.cmd ci
npm.cmd run serve
```

`http://127.0.0.1:4179`에서 열립니다. Sites 배포용 Worker 번들은 아래 명령으로 생성합니다.

```powershell
npm.cmd run build
```

## 검증

```powershell
npm.cmd run test:static
npm.cmd run test:e2e:chromium
npm.cmd run test:e2e:webkit
npm.cmd test
```

- 정적 검증: JavaScript 구문, 필수 HTML 메타데이터, 중복 ID, 끊어진 로컬 참조
- E2E: 7개 주요 경로 기본 렌더, axe 접근성, 360px overflow, 홈 검색/필터, 키보드 큐 정렬, 실제 PNG/JPG 다운로드, 파일 예산, 출력명 충돌 방지, GIF 실제 취소, PDF/PPT 방향 전환
- CI: GitHub Actions에서 정적 검사, Chromium/WebKit E2E와 npm 취약점 감사를 실행

현재 자동화 통과는 로컬 브라우저 실행 증거이며 실제 배포 URL, 모든 실사용 파일, 저사양 모바일 메모리 상황까지 보장하지 않습니다.

## 구조

```text
index.html                  홈 허브
app.js                     공통 업로드·설정·큐·변환·다운로드 흐름
styles.css                 공통 반응형 UI와 접근성 스타일
tools/                     각 도구 페이지
scripts/converter-*.js     형식별 변환 구현
scripts/editor-*.js        이미지·MP3 편집기
assets/vendor/             버전 고정 브라우저 라이브러리
tests/                     Playwright 사용자 흐름 검증
.github/workflows/         품질 CI
```

외부 라이브러리 버전과 SHA-256은 [`assets/vendor/README.md`](assets/vendor/README.md)에 기록합니다.

## 배포

GitHub Pages에는 저장소의 정적 파일을 루트 기준으로 배포할 수 있습니다. Sites 배포는 `npm.cmd run build`가 생성한 Cloudflare Worker 호환 산출물을 사용하며, 보안 헤더와 확장자 없는 HTML 경로 보정을 추가합니다. Sites 빌드의 canonical 및 공유 이미지 URL은 실제 요청 호스트로 치환됩니다.

기존 GitHub Pages 주소는 아래와 같지만, 이 문서만으로 현재 배포 상태를 증명하지는 않습니다.

`https://yeon-sik.github.io/Tool-Page/`
