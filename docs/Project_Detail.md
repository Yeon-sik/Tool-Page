# Tool Page | Project Detail

2026-10-30 (Asia/Seoul) 갱신. 최신 감사 revision은 [main@8848cce](https://github.com/Yeon-sik/Tool-Page/tree/8848cce04c72f98a644ac254a310c55f7f981ff9), 구현 기준은 [main@ea8be73](https://github.com/Yeon-sik/Tool-Page/tree/ea8be73c8f2e38b997c94de20ab9e513f76abd0a)이다. 두 revision 사이에는 제품 source 변경이 없고 project-docs 자동화와 canonical 문서만 추가됐다.

## 1. 문서 목적과 범위

Tool Page는 이미지·GIF·PDF·PPTX·MP3 작업을 서버 업로드 없이 현재 브라우저에서 처리하는 정적 도구 허브다. 공통 파일 queue·validation·cancellation·download runtime을 공유하고 형식별 변환·편집 로직은 독립 모듈로 둔다.

## 2. 시스템 아키텍처

```text
Static hub / tool routing
  -> common file runtime
     -> input queue / validation / cancellation / naming
  -> format-specific tools
     -> Canvas / File API / Web Audio / Web Worker / bundled libraries
  -> preview / ZIP or individual download
Static assets / optional Sites Worker -> browser runtime
```

## 3. 데이터 모델과 불변식

- 제품 자체의 입력 파일 처리 경계는 browser-local이며 별도 application upload backend를 두지 않는다.
- file count·size·pixel·page·slide 안전 한도를 넘는 입력을 조용히 계속 처리하지 않는다.
- 형식별 실패가 공통 queue의 다른 파일 결과를 오염시키지 않게 한다.
- output filename 충돌을 방지하고 사용자가 취소한 작업을 완료 결과로 표시하지 않는다.
- 저장소 내 bundled library/font 경계와 외부 network dependency를 구분한다.
- 브라우저 로컬 처리 구조를 OS·extension·browser 전체의 완전한 privacy 보증으로 과장하지 않는다.

## 4. 핵심 기술 의사결정

### 결정 1. 정적 browser-local 구조
간단한 파일 작업을 위해 별도 서버 저장·처리 계층을 만들지 않아 배포·privacy 경계를 단순화한다.

### 결정 2. 공통 파일 runtime과 도구별 변환 분리
queue·validation·download UX는 공유하고 PDF/PPTX/audio/image 형식 특성은 독립 구현으로 격리한다.

### 결정 3. 안전 한도를 제품 규칙으로 둠
브라우저 메모리와 Canvas 한계가 입력에 따라 급격히 커질 수 있으므로 조용한 hang보다 사전 거절을 선택한다.

## 5. 테스트와 검증 전략

| 검사 | 결과 | 근거·환경과 한계 |
| --- | --- | --- |
| 최신 main diff | 저장소 검증 | `ea8be73..8848cce`는 project-docs 자동화·Intro/Detail 추가이며 제품 source 차이는 없다. |
| 테스트/정적 검사 | 저장소 근거 | Playwright 및 정적 검사 경로가 존재한다. 이번 문서 작업에서 독립 실행하지 않았다. |
| 운영 브라우저 | 미검증 | 최신 공개 배포의 모든 형식·대용량·브라우저 조합을 이번 작업에서 재검증하지 않았다. |

문서 validator와 Notion render-only 검사는 문서 구조 검증이며 파일 변환 runtime의 성공 증거가 아니다.

## 6. 배포·운영·복구

- 제품은 정적 bundle과 필요한 local asset으로 배포하며 입력 파일을 서버 데이터 저장소로 보내지 않는 구조를 유지한다.
- 대용량 작업 실패 시 브라우저 state를 무리하게 복구해 잘못된 output을 생성하지 않고 해당 작업을 명시적으로 실패·취소 처리한다.
- 다운로드 결과는 사용자가 로컬에 저장하는 artifact이며 서버-side canonical state가 아니다.

**문서 발행**: Git Markdown이 canonical이고 Notion은 generated mirror다.

## 7. 한계, 기술 부채, 다음 단계

- 브라우저 메모리·Canvas·codec 지원은 플랫폼별 차이가 있다.
- PDF/PPTX 변환은 복잡한 원본 레이아웃을 office/native renderer와 동일하게 보존한다고 주장하지 않는다.
- 다음 우선 작업은 대표 sample과 limit/error fixture로 각 tool의 정상·실패·cancel·download 경로를 최신 Chromium에서 재검증하는 것이다.

## 8. 근거와 관련 문서

- [최신 감사 revision](https://github.com/Yeon-sik/Tool-Page/tree/8848cce04c72f98a644ac254a310c55f7f981ff9)
- [구현 기준 revision](https://github.com/Yeon-sik/Tool-Page/tree/ea8be73c8f2e38b997c94de20ab9e513f76abd0a)
- [Project Intro](./Project_Intro.md)
- [README](../README.md)
