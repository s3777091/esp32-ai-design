# syntax=docker/dockerfile:1.7

ARG GO_VERSION=1.25
ARG DEBIAN_VERSION=bookworm

FROM golang:${GO_VERSION}-${DEBIAN_VERSION} AS builder

ARG XIAOZHI_SERVER_REPO=https://github.com/xiaozhi-labs/xiaozhi-server.git
ARG XIAOZHI_SERVER_REF=main
ARG ENABLE_SHERPA_ONNX=false

ENV CGO_ENABLED=1 \
    GOFLAGS="-trimpath" \
    GOPATH=/go \
    GOMODCACHE=/go/pkg/mod

WORKDIR /build

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        cmake \
        git \
        build-essential \
        nodejs \
        npm \
        pkg-config \
    && npm install -g pnpm@9 \
    && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
    rm -rf /src; \
    git clone --depth 1 --branch "${XIAOZHI_SERVER_REF}" "${XIAOZHI_SERVER_REPO}" /src \
    || (rm -rf /src \
        && git clone "${XIAOZHI_SERVER_REPO}" /src \
        && cd /src \
        && git checkout "${XIAOZHI_SERVER_REF}")

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    set -eux; \
    commit="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"; \
    tags=""; \
    if [ "${ENABLE_SHERPA_ONNX}" = "true" ]; then tags="-tags=sherpa_onnx"; fi; \
    mkdir -p /out/manager-server /out/backend-server; \
    cd /src/manager-server; \
    go mod download; \
    go build ${tags} -ldflags "-s -w -X main.version=${commit}" -o /out/manager-server/manager-server ./cmd/server; \
    cd /src/backend-server; \
    go mod download; \
    go build ${tags} -ldflags "-s -w -X main.version=${commit}" -o /out/backend-server/backend-server ./cmd/server

RUN --mount=type=cache,target=/root/.npm \
    --mount=type=cache,target=/root/.local/share/pnpm/store \
    set -eux; \
    mkdir -p /out/manager-server/config /out/backend-server/config /out/web /out/seed; \
    if [ -d /src/manager-server/config ]; then cp -a /src/manager-server/config/. /out/manager-server/config/; fi; \
    if [ -d /src/backend-server/config ]; then cp -a /src/backend-server/config/. /out/backend-server/config/; fi; \
    if [ -d /src/web/manager-web ]; then \
        cd /src/web/manager-web; \
        if [ -f package-lock.json ]; then npm ci; else npm install; fi; \
        npm run build; \
        mkdir -p /out/manager-server/web/manager-web /out/web/manager-web; \
        cp -a dist /out/manager-server/web/manager-web/; \
        cp -a dist /out/web/manager-web/; \
    fi; \
    if [ -d /src/web/manager-mobile ]; then \
        cd /src/web/manager-mobile; \
        if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else pnpm install; fi; \
        pnpm run build:h5 || pnpm run build; \
        if [ -d dist ]; then \
            mkdir -p /out/manager-server/web/manager-mobile /out/web/manager-mobile; \
            cp -a dist /out/manager-server/web/manager-mobile/; \
            cp -a dist /out/web/manager-mobile/; \
        fi; \
    fi; \
    for dir in sql db migrations database; do \
        if [ -d "/src/${dir}" ]; then cp -a "/src/${dir}" "/out/seed/${dir}"; fi; \
    done

FROM ubuntu:24.04 AS runtime

ENV TZ=Asia/Bangkok \
    XIAOZHI_SERVER_PORT=8003

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        ca-certificates \
        curl \
        netcat-openbsd \
        supervisor \
        tzdata \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --system --uid 10001 --gid root --home-dir /apps --shell /usr/sbin/nologin xiaozhi \
    && mkdir -p /apps/manager-server /apps/backend-server /apps/web /apps/logs /apps/data /apps/seed \
    && chown -R xiaozhi:root /apps

WORKDIR /apps

COPY --from=builder /out/manager-server/ /apps/manager-server/
COPY --from=builder /out/backend-server/ /apps/backend-server/
COPY --from=builder /out/web/ /apps/web/
COPY --from=builder /out/seed/ /apps/seed/
COPY supervisord.conf /etc/supervisor/conf.d/xiaozhi.conf
COPY entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh \
    && chown -R xiaozhi:root /apps

VOLUME ["/apps/logs", "/apps/data"]

EXPOSE 8003/tcp 8007/tcp 2883/tcp 8883/tcp 8990/tcp 8990/udp

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${XIAOZHI_SERVER_PORT}/xiaozhi/health" \
        || curl -fsS "http://127.0.0.1:${XIAOZHI_SERVER_PORT}/" \
        || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
