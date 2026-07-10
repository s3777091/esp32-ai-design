# Xiaozhi Server Docker Deploy

Thu muc nay dung de build va chay `xiaozhi-labs/xiaozhi-server` tren server rieng.
Dockerfile se clone source server, build `manager-server` va `backend-server`, sau do chay ca hai bang `supervisord`.

Theo DeepWiki, xiaozhi-server gom `manager-server` control plane o cong `8003` va `backend-server` data plane voi WebSocket `8007`, MQTT `2883/8883`, UDP `8990`. He thong dung database MySQL/PostgreSQL va Redis.

Mac dinh trien khai VM cua bo compose nay la MySQL local cho rieng Xiaozhi va Redis dung dich vu co san tren VM. Neu can local self-contained thi dung them `docker-compose.local.yml`.

## Chay tren VM hien tai

```powershell
cd docker
Copy-Item .env.example .env
notepad .env
docker compose -f docker-compose.yml -f docker-compose.vm.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.vm.yml logs -f xiaozhi-server
```

Tren Linux server:

```bash
cd docker
cp .env.example .env
nano .env
docker compose -f docker-compose.yml -f docker-compose.vm.mysql.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.vm.mysql.yml logs -f xiaozhi-server
```

Trong `.env`, dien:

- `MYSQL_ROOT_PASSWORD`: mat khau root MySQL rieng cho container `xiaozhi-mysql`.
- `MYSQL_DATABASE=xiaozhi`: database mac dinh.
- `XIAOZHI_REDIS_HOST=redis`: dung Redis container co san khi container duoc join vao network `protexa_default`.
- `SHARED_REDIS_NETWORK=protexa_default`: network Docker hien co cua Redis tren VM.

## Chay local self-contained

Neu muon tu chay ca MySQL va Redis local:

```bash
cd docker
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.local.yml logs -f xiaozhi-server
```

## Endpoint mac dinh

- Web console / Manager API: `http://SERVER_IP:8003`
- Manager API context: `http://SERVER_IP:8003/xiaozhi`
- WebSocket thiet bi: `ws://SERVER_IP:8007`
- MQTT TCP: `SERVER_IP:2883`
- MQTT TLS: `SERVER_IP:8883`
- UDP audio: `SERVER_IP:8990`

Trong production VM, MySQL chi bind `127.0.0.1` cua host va Redis duoc dung tu container co san tren network noi bo. Khi chay local self-contained bang `docker-compose.local.yml`, MySQL va Redis deu chi bind tren `127.0.0.1` cua host de tranh mo database/cache ra Internet.

## Cau hinh quan trong

- `XIAOZHI_SERVER_REPO`: repo source cua server. Neu upstream khong public, doi sang fork/mirror ban co quyen truy cap.
- `XIAOZHI_SERVER_REF`: branch/tag/commit de build.
- `XIAOZHI_DATABASE_DRIVER` / `XIAOZHI_DATABASE_DSN`: database driver va DSN. VM hien tai dung `mysql`; overlay `docker-compose.vm.mysql.yml` tu tao DSN neu `XIAOZHI_DATABASE_DSN` de trong.
- `WAIT_FOR_DATABASE_HOST` / `WAIT_FOR_DATABASE_PORT`: endpoint DB de doi truoc khi start server.
- `XIAOZHI_REDIS_HOST` / `XIAOZHI_REDIS_PORT`: Redis cache va short-term memory.
- `WAIT_FOR_REDIS_HOST` / `WAIT_FOR_REDIS_PORT`: endpoint Redis de doi truoc khi start server.
- Cac bien `XIAOZHI_<SECTION>_<KEY>` co the override config YAML cua server, vi du `XIAOZHI_DATABASE_DRIVER`, `XIAOZHI_DATABASE_DSN`, `XIAOZHI_SERVER_PORT`.

Neu upstream can file SQL seed rieng, dat file `.sql` vao `docker/mysql/init/` truoc lan chay MySQL dau tien.

## Reverse proxy / firmware

Firmware hien tai khong hard-code server audio truc tiep. Khi boot, no goi OTA URL (`CONFIG_OTA_URL` hoac `wifi.ota_url`) de nhan cau hinh `mqtt` hoac `websocket`, sau do moi ket noi data plane.

Neu muon di qua HTTPS/WSS va de firewall don gian, them Caddy site rieng cho manager va WebSocket. Tren VM hien tai co the public ca hai qua `ai.protexa.cloud`:

```caddyfile
ai.protexa.cloud {
    encode zstd gzip

    @xiaozhi_ws path /xiaozhi/v1 /xiaozhi/v1/*
    reverse_proxy @xiaozhi_ws 127.0.0.1:8007

    reverse_proxy 127.0.0.1:8003
}
```

Sau do OTA/config can tra `websocket.url` dang `wss://ai.protexa.cloud/xiaozhi/v1/`.

Neu dung MQTT + UDP, can mo truc tiep port `2883` hoac `8883` va UDP `8990`; Caddy mac dinh khong proxy TCP/UDP MQTT.

## Lenh van hanh

```bash
docker compose -f docker-compose.yml -f docker-compose.vm.mysql.yml ps
docker compose -f docker-compose.yml -f docker-compose.vm.mysql.yml logs -f xiaozhi-server
docker compose -f docker-compose.yml -f docker-compose.vm.mysql.yml restart xiaozhi-server
docker compose -f docker-compose.yml -f docker-compose.vm.mysql.yml down
```

Neu chay local self-contained va doi file SQL init sau khi MySQL da tao volume, can tao lai volume database:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml down -v
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```
