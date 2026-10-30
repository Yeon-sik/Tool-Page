# Tool Page | 서버 업로드 없이 브라우저에서 처리하는 파일 도구 허브

이미지, GIF, PDF, PPTX, MP3 작업을 한곳에서 실행하고 결과를 바로 내려받는 정적 웹 애플리케이션이다. 입력 파일은 현재 브라우저에서 처리하며 실행 라이브러리·글꼴도 저장소 자산으로 관리한다.

| 항목 | 내용 |
| --- | --- |
| 문서 갱신 | 2026-10-30 (Asia/Seoul) |
| 최신 감사 revision | [main@8848cce](https://github.com/Yeon-sik/Tool-Page/tree/8848cce04c72f98a644ac254a310c55f7f981ff9) |
| 구현 기준 | [main@ea8be73](https://github.com/Yeon-sik/Tool-Page/tree/ea8be73c8f2e38b997c94de20ab9e513f76abd0a) — 이후 main 변경은 project-docs 자동화와 Intro/Detail 추가뿐 |
| 주요 기술 | HTML · CSS · JavaScript · Canvas · Web Audio API · Web Worker · Playwright |
| 저장소 | [Yeon-sik/Tool-Page](https://github.com/Yeon-sik/Tool-Page) |

## 1. 30초 요약

- 이미지·문서·오디오의 간단한 변환을 별도 서버 업로드 없이 브라우저 안에서 수행한다.
- 이미지 형식 변환, GIF 생성, PDF/PPTX 작업, MP3 구간 편집, 단일·일괄 이미지 편집을 공통 파일 큐·검증·취소·다운로드 UX로 묶는다.
- 파일 수·용량·픽셀·페이지·슬라이드 한도를 두어 브라우저 자원 고갈과 조용한 실패를 줄인다.
- `ea8be73..8848cce` 비교 결과 제품 source 변경은 없고 project-docs 자동화·canonical 문서만 추가됐다.

## 2. 문제와 해결

**문제**: 간단한 이미지·문서·오디오 작업도 서로 다른 외부 서비스나 데스크톱 도구를 오가야 하고, 원본 파일을 서버에 업로드해야 하는 경우가 많다.

**해결**: File API·Canvas·Web Audio·Web Worker와 저장소에 포함한 라이브러리를 사용해 변환·편집·미리보기·다운로드를 브라우저 안에서 처리하고, 공통 파일 queue와 안전 한도를 적용한다.

## 3. 핵심 기능과 결과

| 영역 | 현재 source에서 확인한 범위 |
| --- | --- |
| 이미지 | 형식 변환, 크기/품질 조정, 단일·일괄 편집과 다운로드. |
| GIF | 이미지 sequence 기반 GIF 생성과 순서 조정. |
| PDF/PPTX | 브라우저 내 문서 변환·분해/생성 경로. |
| 오디오 | MP3 구간 선택·편집과 결과 export. |
| 공통 런타임 | 파일 queue, validation, cancellation, filename collision 방지와 ZIP/개별 다운로드. |
| 배포 | 정적 자산 기반 웹 배포와 Sites용 Worker 경계. |

## 4. 데이터·보안 경계

- 선택한 원본 파일은 제품 설계상 브라우저 처리 경계에 두고 앱 자체 업로드 backend를 사용하지 않는다.
- 외부 CDN 의존보다 저장소에 포함한 라이브러리·font 자산을 우선한다.
- 브라우저 로컬 처리라는 구조가 OS·브라우저·extension 수준의 완전한 기밀성을 자동 보장하는 것은 아니다.
- 지원하지 않는 형식이나 안전 한도를 넘는 입력은 명시적으로 실패시킨다.

## 5. 검증 현황

| 항목 | 상태 | 근거와 한계 |
| --- | --- | --- |
| 최신 main diff | 저장소 검증 | `ea8be73..8848cce`는 project-docs 자동화와 Intro/Detail 문서 추가이며 제품 source 차이는 없다. |
| 기능 검증 | 저장소 근거 | Playwright·정적 검사와 기존 문서에 기록된 기능 검증 범위를 유지한다. 이번 작업에서 브라우저 E2E를 새로 실행하지 않았다. |
| 실제 운영 배포 | 미검증 | 현재 공개 URL의 모든 형식·브라우저 조합과 대용량 파일 runtime은 이번 갱신에서 재검증하지 않았다. |

## 6. 현재 한계와 다음 단계

- 브라우저 메모리·Canvas 제한은 기기와 브라우저마다 다르다.
- 복잡한 PDF/PPTX 원본의 레이아웃 보존은 데스크톱 전용 변환기 수준을 보장하지 않는다.
- 다음 우선 검증은 최신 Chromium에서 대표 도구별 정상 입력·한도 초과·취소·download를 Playwright와 실제 파일로 다시 확인하는 것이다.

## 7. 관련 문서

- [프로젝트 상세](./Project_Detail.md)
- [README](../README.md)

Git Markdown이 원본이며 Notion은 생성 미러다.
