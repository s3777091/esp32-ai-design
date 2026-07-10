# TODO — DS-02 AI Assistant (ESP32-S3)

Cập nhật: 2026-07-10. Mục tiêu: thiết bị giọng nói tiếng Việt hỗ trợ công việc
(note, task, lịch, phiên dịch Việt↔Trung, điều khiển Claude Code trên VM, RunPod).

Kiến trúc: **ESP32-S3 (thin client) → xiaozhi server trên VM (não) → agent layer (tay chân)**.

---

## ✅ Đã xong (server — VM 36.50.27.142, ai.protexa.cloud)

- [x] Backend `xinnan-tech/xiaozhi-esp32-server` chạy 3 container (server :8000/:8003, panel :8002, MySQL riêng)
- [x] Redis dùng chung `mdnac-redis` (network `protexa_default`), KHÔNG Supabase
- [x] Caddy + TLS: `wss://ai.protexa.cloud/xiaozhi/v1/` (thiết bị), `https://ai.protexa.cloud/xiaozhi/ota/` (OTA → :8002), panel = `https://ai.protexa.cloud`
- [x] **Chế độ panel điều khiển (API mode)** — cấu hình model/agent qua web, không sửa file
- [x] Models: LLM `google/gemini-3-flash-preview` + ASR Whisper large-v3-turbo (chung 1 key OpenRouter), TTS EdgeTTS `vi-VN-NamMinhNeural` (nam), Memory `mem_local_short`, Intent `function_call`
- [x] Agent "Vietnamese Assistant" trong panel, prompt tiếng Việt
- [x] Test end-to-end: TTS→ASR tiếng Việt chuẩn dấu, LLM trả lời tiếng Việt
- [x] Dọn VM: 107GB→44GB (data train material-train đã sync verify lên HF bucket `admincybers2/train_material` rồi mới xóa)

## ✅ Đã xong (firmware — repo này)

- [x] Xác nhận nền: component `main` của xiaozhi-esp32, ESP32-S3, board đích **ESP-BOX-3**, DS-02 home UI (mặc định bật), wake word "okke", ngôn ngữ mặc định vi_VN
- [x] Đổi OTA URL mặc định: `api.tenclass.net` → **`https://ai.protexa.cloud/xiaozhi/ota/`** (Kconfig.projbuild)
- [x] Scaffold build: `firmware-project/` (overlay sdkconfig ESP-BOX-3 + script `build-on-vm.sh` build bằng Docker `espressif/idf:release-v5.5` trên VM)
- [x] Source đã đưa lên VM tại `/root/fw/ds02-src`

## 🔄 Đang chờ

- [ ] **Build firmware lần đầu trên VM** — cần xác nhận cho phép clone upstream `78/xiaozhi-esp32` làm khung project (script đã sẵn: `/root/fw/ds02-src/firmware-project/build-on-vm.sh /root/fw/ds02-src`)
- [ ] Sửa lỗi build nếu có (lệch version script upstream ↔ component, model wake word "okke" trong assets)

## 📋 Tiếp theo — Firmware (giai đoạn 2)

- [ ] Flash ESP-BOX-3 + activation: thiết bị gọi OTA → nhập mã 6 số vào panel → bind vào agent "Vietnamese Assistant"
- [ ] Test giọng nói end-to-end trên thiết bị thật (wake "okke" → hỏi tiếng Việt → nghe trả lời)
- [ ] **Module báo thức local**: lưu NVS (settings.cc), MCP device tool `self.alarm.set/list/delete` để đặt bằng giọng nói, chuông qua `PlaySound()`, hoạt động cả khi mất mạng
- [ ] **Thẻ thông tin màn hình standby DS-02**: giờ + thời tiết + lịch hôm nay + note đầu ngày (server đẩy qua MCP/websocket)

## 📋 Tiếp theo — Server (giai đoạn 1, làm song song được)

- [ ] **#1 Take note**: plugin `plugins_func` save_note/query_notes (bảng MySQL mới) → LLM gợi ý dựa trên note
- [ ] **#2 Gợi ý công việc**: bảng tasks + tool add/list/done, cùng pattern #1
- [ ] **#3 Sắp xếp thời gian**: prompt tổng hợp note+task+lịch (không cần code mới sau #1/#2)
- [ ] **#7 Phiên dịch Việt↔Trung**: tạo agent "Interpreter" thứ 2 trong panel — Whisper tự nhận vi/zh, LLM dịch, TTS giọng multilingual (nói được cả vi+zh); chuyển vai bằng giọng nói
- [ ] **Briefing sáng**: cron trên VM → push TTS (thời tiết + lịch + việc hôm nay) xuống thiết bị đang online

## 📋 Sau đó — Agent layer (giai đoạn 3)

- [ ] OpenClaw prototype hybrid (container cô lập + shim OpenAI-compatible; đã chốt phương án)
- [ ] Bridge điều khiển **Claude Code trên VM** (headless `claude -p` trong tmux, pattern async "làm xong tôi báo", guardrail: allowlist repo + xác nhận trước hành động ghi)
- [ ] Tool **thuê RunPod** + chạy thử code (REST API, guardrail chi phí: giá trần + auto-terminate + xác nhận giọng nói)
- [ ] Sync lịch team (Google Calendar/Outlook OAuth)

## ⚠️ Ghi chú vận hành

- Key OpenRouter đã dán trong chat → **nên rotate** rồi cập nhật trong panel (Model Configuration)
- Panel admin mặc định tiếng Trung (có nút chuyển EN) — theo yêu cầu giữ nguyên
- Sửa config qua **UI panel** thì cache tự xử lý; sửa thẳng DB thì phải xóa Redis key `sys:params` + `server:config`
- VM có K8s cluster (`aie`) + dự án mdnac/zalobot/minio — không đụng containerd/volumes
- Backup: `data/.config.yaml.bak-*` (server), `/root/xiaozhi_db_backup_*.sql` (panel DB)
