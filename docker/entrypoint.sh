#!/usr/bin/env bash
set -euo pipefail

wait_for_port() {
    local host="$1"
    local port="$2"
    local name="$3"
    local timeout="${4:-60}"
    local elapsed=0

    echo "Waiting for ${name} at ${host}:${port}..."
    until nc -z "${host}" "${port}" >/dev/null 2>&1; do
        elapsed=$((elapsed + 1))
        if [ "${elapsed}" -ge "${timeout}" ]; then
            echo "Timed out waiting for ${name} at ${host}:${port}" >&2
            return 1
        fi
        sleep 1
    done
}

mkdir -p /apps/logs /apps/data
chown -R xiaozhi:root /apps/logs /apps/data

if [ -n "${WAIT_FOR_DATABASE_HOST:-}" ]; then
    wait_for_port "${WAIT_FOR_DATABASE_HOST}" "${WAIT_FOR_DATABASE_PORT:-5432}" "Database" "${WAIT_FOR_TIMEOUT:-90}"
elif [ -n "${WAIT_FOR_MYSQL_HOST:-}" ]; then
    wait_for_port "${WAIT_FOR_MYSQL_HOST}" "${WAIT_FOR_MYSQL_PORT:-3306}" "MySQL" "${WAIT_FOR_TIMEOUT:-90}"
fi

if [ -n "${WAIT_FOR_REDIS_HOST:-}" ]; then
    wait_for_port "${WAIT_FOR_REDIS_HOST}" "${WAIT_FOR_REDIS_PORT:-6379}" "Redis" "${WAIT_FOR_TIMEOUT:-90}"
fi

exec /usr/bin/supervisord -c /etc/supervisor/conf.d/xiaozhi.conf -n
