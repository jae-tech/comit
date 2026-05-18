#!/usr/bin/env bash
# Comit 초기 설치 스크립트
# 사용법: chmod +x setup.sh && ./setup.sh
set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}[✓]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }
error()   { echo -e "${RED}[✗]${NC} $*" >&2; exit 1; }
prompt()  { echo -e "${BOLD}[?]${NC} $*"; }

echo ""
echo -e "${BOLD}Comit 배포 초기화${NC}"
echo "=================================="
echo ""

# ── 사전 요구사항 확인 ─────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1  || error "Docker가 설치되지 않았습니다. https://docs.docker.com/get-docker/ 참고"
command -v openssl >/dev/null 2>&1 || error "openssl이 필요합니다."

if [ -f .env ]; then
  warn ".env 파일이 이미 존재합니다."
  prompt "덮어쓰시겠습니까? (y/N)"
  read -r OVERWRITE
  if [[ "$OVERWRITE" != "y" && "$OVERWRITE" != "Y" ]]; then
    info ".env 파일을 유지합니다. 스크립트를 종료합니다."
    exit 0
  fi
fi

# ── 도메인 입력 ────────────────────────────────────────────────────────────
echo ""
prompt "백엔드 API 도메인을 입력하세요 (예: api.yourdomain.com):"
read -r API_DOMAIN
[ -z "$API_DOMAIN" ] && error "도메인은 필수입니다."

prompt "프론트엔드 URL을 입력하세요 (예: https://app.yourdomain.com 또는 Vercel URL):"
read -r FRONTEND_URL
[ -z "$FRONTEND_URL" ] && error "프론트엔드 URL은 필수입니다."

# ── 비밀키 자동 생성 ────────────────────────────────────────────────────────
info "보안 키 생성 중..."
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
DEMO_ADMIN_TOKEN=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -hex 16)

# ── .env 작성 ──────────────────────────────────────────────────────────────
cat > .env <<EOF
# ── Database ──────────────────────────────────────────────
POSTGRES_USER=comit
POSTGRES_PASSWORD=${DB_PASSWORD}
POSTGRES_DB=comit
DATABASE_URL=postgres://comit:${DB_PASSWORD}@postgres:5432/comit

# ── Redis ─────────────────────────────────────────────────
REDIS_URL=redis://redis:6379

# ── JWT ───────────────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# ── Encryption (API Key 저장용 AES-256-GCM) ───────────────
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# ── App ───────────────────────────────────────────────────
PORT=4000
NODE_ENV=production

# ── Frontend (CORS 허용 origin) ───────────────────────────
FRONTEND_URL=${FRONTEND_URL}
NEXT_PUBLIC_API_URL=https://${API_DOMAIN}

# ── Demo 페이지 (공개 RAG 데모) ──────────────────────────
# 배포 후 DEPLOY.md의 "데모 세드" 단계를 참고해 아래 값을 채우세요.
DEMO_ENABLED=false
DEMO_USER_ID=
DEMO_WORKSPACE_ID=
DEMO_HIDE_DOCS=false
DEMO_ADMIN_TOKEN=${DEMO_ADMIN_TOKEN}
DEMO_DOMAIN=demo.${API_DOMAIN#api.}
EOF

info ".env 파일이 생성되었습니다."

# ── 요약 출력 ──────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}설정 완료${NC}"
echo "=================================="
echo "  API 도메인:       https://${API_DOMAIN}"
echo "  프론트엔드:       ${FRONTEND_URL}"
echo "  DB 비밀번호:      (자동 생성, .env 참고)"
echo "  JWT 시크릿:       (자동 생성, .env 참고)"
echo "  암호화 키:        (자동 생성, .env 참고)"
echo "  Demo 어드민 토큰: (자동 생성, .env 참고)"
echo ""
warn ".env 파일에는 민감한 키가 포함되어 있습니다. git에 절대 커밋하지 마세요."
echo ""
echo "다음 단계: DEPLOY.md를 읽고 SSL 설정과 서비스 시작을 완료하세요."
echo ""
