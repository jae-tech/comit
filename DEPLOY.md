# Comit 배포 가이드

프론트엔드는 Vercel(또는 기타 플랫폼), 백엔드(API + DB + Redis)는 Docker로 고객 서버에 배포하는 방법을 안내합니다.

## 사전 요구사항

- Ubuntu 22.04 이상 서버 (최소 사양: 2 vCPU, 4GB RAM, 30GB 디스크)
- 도메인 이름 (예: `api.yourdomain.com`)
- Docker 및 Docker Compose v2 설치

```bash
# Docker 설치 (Ubuntu)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

---

## 1단계: 코드 배포

```bash
git clone https://github.com/yourorg/comit.git
cd comit
chmod +x setup.sh
./setup.sh
```

`setup.sh`가 실행되면:
- 도메인과 프론트엔드 URL을 입력합니다
- JWT 시크릿, 암호화 키, DB 비밀번호가 자동 생성됩니다
- `.env` 파일이 완성됩니다

---

## 2단계: SSL 인증서 (Let's Encrypt)

### 2-1. Certbot 설치

```bash
sudo apt install -y certbot
```

### 2-2. 인증서 발급 (도메인이 이 서버의 IP를 가리키고 있어야 함)

```bash
sudo certbot certonly --standalone -d api.yourdomain.com
```

### 2-3. 인증서를 nginx/certs/에 복사

```bash
mkdir -p nginx/certs
sudo cp /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem nginx/certs/
sudo cp /etc/letsencrypt/live/api.yourdomain.com/privkey.pem nginx/certs/
sudo chown $USER:$USER nginx/certs/*.pem
```

### 2-4. nginx.conf 도메인 설정

`nginx/nginx.conf`의 `server_name _`을 실제 도메인으로 변경합니다:

```nginx
server_name api.yourdomain.com;
```

### 2-5. 인증서 자동 갱신

```bash
# crontab에 추가
echo "0 3 * * * certbot renew --pre-hook 'docker compose -f /path/to/comit/docker-compose.yml stop nginx' --post-hook 'docker compose -f /path/to/comit/docker-compose.yml start nginx'" | sudo tee -a /etc/crontab
```

---

## 3단계: 서비스 시작

```bash
# 백엔드 + DB + Redis + Nginx 시작 (Nginx는 prod 프로파일 필요)
docker compose --profile prod up -d
```

시작 순서는 자동으로 관리됩니다:
1. PostgreSQL → 헬스체크 통과 대기
2. Redis → 헬스체크 통과 대기
3. API → 시작 시 Drizzle 마이그레이션 자동 실행 + pgvector 활성화
4. Nginx → API 준비 후 시작

### 서비스 상태 확인

```bash
docker compose ps
docker compose logs api --tail=50
```

### API 헬스체크

```bash
curl https://api.yourdomain.com/health
# 응답: {"status":"ok","timestamp":"2026-05-18T..."}
```

---

## 4단계: 프론트엔드 배포 (Vercel 예시)

1. Vercel 대시보드에서 monorepo 루트를 연결합니다
2. **Root Directory**: `apps/web`
3. **Framework Preset**: Next.js
4. **환경변수** 설정:

| 변수 | 값 |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.yourdomain.com` |

5. 배포 후 Vercel URL을 확인하고 서버의 `.env`에서 `FRONTEND_URL`을 업데이트합니다:

```bash
# .env에서 FRONTEND_URL 수정
nano .env

# API 컨테이너 재시작 (CORS 적용)
docker compose restart api
```

---

## 5단계: 데모 모드 활성화 (선택)

데모 페이지(`/demo`)를 활성화하려면 데모 전용 사용자와 워크스페이스를 먼저 생성해야 합니다.

### 5-1. 데모 계정 생성

브라우저에서 프론트엔드에 접속해 데모 전용 계정을 회원가입합니다 (예: `demo@yourdomain.com`).

### 5-2. UUID 확인

```bash
# DB 컨테이너에 접속
docker compose exec postgres psql -U comit -d comit

-- 방금 생성한 사용자 UUID 확인
SELECT id, email FROM users WHERE email = 'demo@yourdomain.com';

-- 워크스페이스 생성 후 UUID 확인 (프론트에서 워크스페이스 생성 필요)
SELECT id, name FROM workspaces WHERE owner_id = '여기에_USER_ID';
```

### 5-3. .env 업데이트

```bash
nano .env
```

아래 항목을 채웁니다:

```env
DEMO_ENABLED=true
DEMO_USER_ID=<5-2에서 확인한 users.id>
DEMO_WORKSPACE_ID=<5-2에서 확인한 workspaces.id>
DEMO_HIDE_DOCS=false
```

### 5-4. API 재시작

```bash
docker compose restart api
```

### 5-5. AI Provider 등록

프론트엔드에서 데모 계정으로 로그인 후 API 설정에서 OpenAI, Anthropic, 또는 Gemini 키를 등록합니다. 임베딩은 OpenAI 모델이 필요합니다.

---

## 운영 참고사항

### 로그 확인

```bash
docker compose logs api -f          # API 실시간 로그
docker compose logs postgres -f     # DB 로그
```

### 업로드 파일 백업

업로드된 문서는 Docker 볼륨 `uploads_data`에 저장됩니다. 정기 백업:

```bash
docker run --rm -v comit_uploads_data:/data -v $(pwd)/backup:/backup \
  alpine tar czf /backup/uploads-$(date +%Y%m%d).tar.gz /data
```

### DB 백업

```bash
docker compose exec postgres pg_dump -U comit comit > backup-$(date +%Y%m%d).sql
```

### 업데이트

```bash
git pull
docker compose build
docker compose --profile prod up -d
```

API 시작 시 Drizzle이 미적용 마이그레이션을 자동으로 실행합니다.

---

## 환경변수 전체 목록

| 변수 | 필수 | 설명 | 예시 |
|---|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL 연결 문자열 | `postgres://comit:pw@postgres:5432/comit` |
| `REDIS_URL` | ✅ | Redis 연결 문자열 | `redis://redis:6379` |
| `JWT_SECRET` | ✅ | JWT 서명 시크릿 | `openssl rand -hex 32` |
| `JWT_ACCESS_EXPIRES` | ✅ | 액세스 토큰 만료 | `15m` |
| `JWT_REFRESH_EXPIRES` | ✅ | 리프레시 토큰 만료 | `7d` |
| `ENCRYPTION_KEY` | ✅ | API 키 암호화 AES 키 (64 hex chars) | `openssl rand -hex 32` |
| `FRONTEND_URL` | ✅ | CORS 허용 origin (콤마 구분) | `https://app.yourdomain.com` |
| `NEXT_PUBLIC_API_URL` | ✅ | 프론트엔드 → API URL | `https://api.yourdomain.com` |
| `DEMO_ENABLED` | — | 데모 기능 활성화 | `true` |
| `DEMO_USER_ID` | — | 데모 사용자 UUID | DB에서 확인 |
| `DEMO_WORKSPACE_ID` | — | 데모 워크스페이스 UUID | DB에서 확인 |
| `DEMO_ADMIN_TOKEN` | — | 데모 어드민 Bearer 토큰 | `openssl rand -hex 32` |
| `DEMO_HIDE_DOCS` | — | 문서 목록 숨김 | `false` |
| `DEMO_DOMAIN` | — | 데모 전용 도메인 | `demo.yourdomain.com` |

---

## 문제 해결

### API가 시작되지 않음

```bash
docker compose logs api | grep -i error
```

가장 흔한 원인:
- `DATABASE_URL`이 PostgreSQL 컨테이너와 맞지 않음 (`@postgres:5432` 확인)
- `ENCRYPTION_KEY`가 64자 hex가 아님 (`openssl rand -hex 32` 출력 확인)

### 임베딩 실패 (문서 업로드 후 `failed` 상태)

임베딩은 OpenAI API 키가 필요합니다. 프론트엔드 API 설정에서 OpenAI 키를 등록했는지 확인하세요.

### CORS 오류

`FRONTEND_URL`에 프론트엔드 도메인이 정확히 포함되어 있는지 확인하세요. 포트 번호까지 일치해야 합니다.
