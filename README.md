# Cking Frontend

크리에이터와 팬을 잇는 이벤트 응모·추첨 플랫폼 **Cking**의 프론트엔드입니다.

**백엔드 저장소**: [URECA-Cking/Cking-BE](https://github.com/URECA-Cking/Cking-BE)

## 목차

* 기술 스택
* 1. 사전 준비
* 2. 처음 프로젝트를 받는 경우
* 3. 이미 프로젝트를 받은 경우
* 4. 백엔드 연동
* 5. 애플리케이션 실행
* 6. 검증 명령
* 7. 작업 흐름
* 8. 코드 구조

---

## 기술 스택

* React 19
* Vite 8
* Oxlint

**로컬 포트**

| 서버 | 주소 |
|---|---|
| 프론트 dev 서버 | http://localhost:5173 |
| 백엔드 (프록시 대상) | http://localhost:8080 |

---

# 1. 사전 준비

로컬 실행 전에 아래 프로그램이 필요합니다.

* Git
* Node.js (LTS)
* [Cking-BE](https://github.com/URECA-Cking/Cking-BE) 로컬 실행 환경 (Docker Desktop 포함, 백엔드 README 참고)

설치 확인:

```bash
git --version
node --version
npm --version
```

이 저장소는 화면만 담당합니다. 데이터 조회·저장은 전부 백엔드를 거치므로, 프론트를 실행하기 전에 [Cking-BE](https://github.com/URECA-Cking/Cking-BE)를 먼저 로컬에 띄워야 합니다.

---

# 2. 처음 프로젝트를 받는 경우

```bash
git clone https://github.com/URECA-Cking/Cking-FE.git
cd Cking-FE

git switch develop

npm install

npm run dev
```

브라우저에서 `http://localhost:5173`으로 접속합니다.

> Windows PowerShell에서 실행 정책 때문에 `npm.ps1`이 차단되면 다음 명령을 대신 사용합니다.
>
> ```powershell
> npm.cmd install
> npm.cmd run dev
> ```

---

# 3. 이미 프로젝트를 받은 경우

작업 시작 전에 최신 `develop`을 반영합니다.

```bash
git switch develop
git pull origin develop
```

이후 작업 브랜치를 생성합니다.

```bash
git switch -c chore/이슈번호-작업내용
```

예:

```bash
git switch -c chore/1-setup-api-proxy
```

브랜치 이름 규칙은 [CONTRIBUTING.md](https://github.com/URECA-Cking/.github/blob/main/CONTRIBUTING.md)를 참고합니다.

---

# 4. 백엔드 연동

Cking-FE와 Cking-BE는 별도 저장소로 관리합니다. 프론트 코드를 백엔드에 합치지 않고, `vite.config.js`의 dev 프록시로 두 서버를 연결합니다.

```js
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
    },
  },
}
```

* 백엔드 컨트롤러가 이미 `/api` 접두사로 매핑되어 있어 경로를 그대로 전달합니다. (예: `fetch('/api/events')` → `http://localhost:8080/api/events`)
* 브라우저 입장에서는 프론트 서버(`5173`)와 같은 출처로 보이므로 CORS 설정 없이 개발할 수 있습니다.
* 프록시는 `npm run dev`(dev 서버)에만 적용됩니다. 배포 빌드(`npm run build`)는 별도 정적 파일로 생성되며, 실제 서비스 환경에서는 리버스 프록시나 서버 설정으로 API 경로를 연결해야 합니다.

API 호출은 `src/api/http.js`의 공통 요청 함수(`apiGet`/`apiPost`/`apiPatch`/`apiDelete`)를 통해서만 합니다. 백엔드 공통 응답 봉투(`{code, data, message}`)를 이 함수가 벗겨서 `data`만 반환하며, 실패 시 `ApiError`(비즈니스 실패)와 `NetworkError`(연결 자체 실패)를 구분해서 던집니다.

백엔드가 켜져 있는지 확인:

```bash
curl http://localhost:8080/actuator/health
```

`{"status":"UP"}`이 나오지 않으면 [Cking-BE README](https://github.com/URECA-Cking/Cking-BE)를 따라 백엔드부터 띄웁니다.

---

# 5. 애플리케이션 실행

```bash
npm run dev
```

실행을 종료하려면:

```text
Ctrl + C
```

프로덕션 빌드:

```bash
npm run build
npm run preview
```

---

# 6. 검증 명령

```bash
npm run lint
npm run build
```

* `lint`: Oxlint 정적 검사
* `build`: Vite 번들 생성 (문법·구성 오류를 걸러냄)

이 저장소에는 아직 단위 테스트 프레임워크가 없습니다. 실제 동작 검증은 백엔드를 로컬에 띄운 상태에서 `npm run dev`로 브라우저에서 직접 확인합니다.

---

# 7. 작업 흐름

기본 개발 흐름은 다음과 같습니다.

```text
Issue 생성
↓
develop 최신화
↓
작업 브랜치 생성
↓
개발
↓
Commit
↓
Push
↓
Pull Request → develop
↓
Review
↓
Squash and Merge
```

작업 완료 후:

```bash
git add .
git commit -m "chore: 작업 내용"
git push -u origin 현재브랜치명
```

PR의 Base Branch는 `develop`으로 지정합니다.

`main`, `develop` 브랜치에는 직접 Push하지 않습니다.

자세한 브랜치·커밋·PR 규칙은 [CONTRIBUTING.md](https://github.com/URECA-Cking/.github/blob/main/CONTRIBUTING.md)를 참고합니다.

---

# 8. 코드 구조

```text
src/
├── api/        도메인별 API 클라이언트와 공통 HTTP 래퍼(http.js)
├── assets/     이미지 등 정적 리소스
├── App.jsx     루트 컴포넌트
├── App.css
├── index.css
└── main.jsx    엔트리 포인트
```

아직 라우팅·페이지·컴포넌트 구조가 없는 초기 단계입니다. 화면이 늘어나면 `pages/`, `components/` 등을 도메인 단위로 분리합니다.
