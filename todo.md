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
- [x] **Repo tự build được, không cần clone upstream** (quyết định của chủ repo): vendor `scripts/gen_lang.py` + `scripts/build_default_assets.py` (đã scan: thuần stdlib, không network/exec, đã được duyệt) + wrapper `firmware-project/` (CMakeLists project, partition v2 16MB có `assets`, sdkconfig defaults + overlay ESP-BOX-3, `build-on-vm.sh`)
- [x] Source đã đưa lên VM tại `/root/fw/ds02-src`

## 🔄 Build firmware trên VM (Docker `espressif/idf:release-v5.5`, `/root/fw/ds02-project`)

Các lỗi đã sửa qua từng vòng build:
- [x] Thiếu model MultiNet cho wake word "okke" → bật `CONFIG_SR_MN_EN_MULTINET7_QUANT` (mn7_en); assets.bin 10MB sinh OK (kèm srmodels + font)
- [x] LVGL thiếu `LV_USE_IMGFONT` → áp nguyên bộ 57 config chuẩn upstream vào `firmware-project/sdkconfig.defaults` (kèm `BOOTLOADER_APP_ROLLBACK_ENABLE` cho OTA an toàn)
- [x] `ApplyBackgroundIndex` lệch snapshot code đang sửa dở → đồng bộ lại source mới nhất
- [x] Race sinh `assets/lang_config.h` → thêm `add_dependencies(${COMPONENT_LIB} lang_header)` vào CMakeLists.txt (fix tận gốc trong repo)
- [x] `-Werror=format-truncation` ở lịch DS-02 (`ds02_home_display.cc:1303`) → nới buffer `text[4]`→`text[12]`
- [x] **BUILD THÀNH CÔNG (vòng 7)** — `Successfully created esp32s3 image`. Artifacts tại `firmware-project/artifacts/` (local) và `/root/fw/artifacts-ds02-0.1.0` (VM): ds02.bin 3.4MB + bootloader + partition-table + ota_data + assets 10MB
- [ ] **Flash ESP-BOX-3** (cắm USB, thay COMx):
      `pip install esptool` rồi chạy trong `firmware-project/artifacts/`:
      `esptool --chip esp32s3 --port COMx --baud 921600 write_flash --flash_mode dio --flash_freq 80m --flash_size 16MB 0x0 bootloader.bin 0x8000 partition-table.bin 0xd000 ota_data_initial.bin 0x20000 ds02.bin 0x800000 generated_assets.bin`
- [ ] Sau flash: thiết bị hiện mã 6 số → panel `https://ai.protexa.cloud` → gắn thiết bị vào agent "Vietnamese Assistant" → test giọng nói (wake "okke")

## 📋 Tiếp theo — Firmware (giai đoạn 2)

- [ ] Flash ESP-BOX-3 + activation: thiết bị gọi OTA → nhập mã 6 số vào panel → bind vào agent "Vietnamese Assistant"
- [ ] Test giọng nói end-to-end trên thiết bị thật (wake "okke" → hỏi tiếng Việt → nghe trả lời)
- [x] **Báo thức bằng giọng nói (luồng hoàn chỉnh)**:
      - Firmware: [alarm_settings.h](alarm_settings.h) (NVS, one-shot, tự disarm) + `Application::CheckAlarmTick()` chạy mỗi giây — reo bằng **ringtone đã chọn trong picker settings** (WakeSoundSettings), lặp 10 lần cách 3s, wake màn hình + notification, tự tắt khi người dùng tương tác
      - MCP tools cho LLM: `self.alarm.set(hour,minute)` / `self.alarm.get` / `self.alarm.cancel` ([mcp_server.cc](mcp_server.cc)) → nói *"mai đặt báo thức 6h30"* là LLM tự đặt; *"tắt báo thức"* để hủy
      - Server: scheduler thêm job **evening_ask@21:30** — mỗi tối thiết bị tự hỏi *"mai đặt báo thức mấy giờ?"*, trả lời là nó gọi self.alarm.set (đổi giờ qua env `EVENING_ASK_TIME`)
      - Verify: scheduler log `briefing@06:30, evening_ask@21:30` ✅; build firmware vòng 9 đang chạy
- [ ] **Thẻ thông tin màn hình standby DS-02**: giờ + thời tiết + lịch hôm nay + note đầu ngày (server đẩy qua MCP/websocket)

## ✅ Server — Giai đoạn 1 (deploy 2026-07-10, chờ test giọng nói trên thiết bị thật)

- [x] **#1 Take note**: plugin `save_note`/`query_notes` (custom_plugins/assistant_tools.py, DB MySQL `assistant_data`, user riêng, pass tại `/root/.assistant_db_pass`)
- [x] **#2 Gợi ý công việc**: `add_task`/`list_tasks`/`complete_task` cùng module
- [x] **#3 Sắp xếp thời gian**: prompt agent đã dạy cách tổng hợp list_tasks + query_notes → đề xuất ưu tiên kèm mốc giờ
- [x] **#7 Phiên dịch Việt↔Trung — TAB TRỰC TIẾP trên firmware** (thiết kế lại theo yêu cầu: không đi qua LLM, không nằm trong tool của agent trợ lý):
      - Server: `custom_plugins/interpreter_mode.py` chặn magic token trong handler `listen/detect` → đổi prompt + giọng multilingual tức thì + đọc xác nhận TTS (không gọi LLM). Log verify: `listen-handler patch installed`
      - Firmware: đã thêm `Application::SetInterpreterMode(bool enable)` ([application.h](application.h) / [application.cc](application.cc)) — **tab UI của bạn chỉ cần gọi hàm này** khi click (true=bật, false=tắt); nó tự mở channel nếu chưa có và gửi `__INTERPRETER_ON__/__INTERPRETER_OFF__`
      - 2 tool interpreter đã GỠ khỏi agent "Vietnamese Assistant" (còn 6 mapping); prompt agent đã bỏ mục phiên dịch
      - Test giả lập: dispatch OK tới ngưỡng auth thiết bị (đúng thiết kế — cần thiết bị đã kích hoạt); E2E cuối test khi flash máy thật
- [x] **Briefing sáng (bản voice-triggered)**: tool `morning_briefing` — nói "chào buổi sáng"/"hôm nay có gì" → ngày giờ + việc chờ + note 48h + thời tiết → LLM tổng hợp + gợi ý đồ mang theo
- [x] Weather đổi default_location → Ho Chi Minh; các function đã đăng ký vào panel (ai_model_provider + ai_agent_plugin_mapping), server nạp plugin OK
- [x] **Tra cứu internet bằng Lightpanda** (lightpanda.io): service `lightpanda` trong compose (headless browser, RAM ~5MB!, CDP :9222 nội bộ) + plugin `internet_search` (custom_plugins/internet_search.py): DuckDuckGo → render trang qua Lightpanda (chạy JS) → LLM tóm tắt tiếng Việt kèm nguồn. Nói: "<wake word>, tra cứu...", "giá ... hôm nay", "tin tức về...". **Lightpanda là đường duy nhất — KHÔNG fallback HTTP** (quyết định của chủ dự án); nếu Lightpanda chết, AI báo "dịch vụ duyệt web không khả dụng". Test E2E cả 2 kịch bản: giá vàng SJC live ✅ + thời tiết HCM từ thoitiet.vn ✅ + kịch bản lightpanda down báo lỗi đúng ✅. Agent hiện có 7 tool
- [x] **Briefing sáng TỰ ĐỘNG (push 06:30)**: plugin `custom_plugins/auto_briefing.py` — scheduler chạy trong process server, theo dõi connection thiết bị, đúng giờ tự bơm `startToChat("Chào buổi sáng...")` → thiết bị tự đọc bản tin. **Đã test bắn đúng giờ** (log `fire time reached`); giờ chỉnh qua env `BRIEFING_TIME` trong docker-compose.protexa.yml. Cần thiết bị đang online (giữ websocket) lúc 06:30

## ✅ Trợ lý thông minh kiểu Việt Nam + Lịch hẹn (2026-07-11)

- [x] **Hồ sơ cá nhân trong agent**: tên (anh Đạt), AI engineer @ AvePoint 8h30-17h30 T2-T6, SĐT — agent xưng "em", biết chủ nhân bận giờ hành chính
- [x] **Trí khôn bối cảnh VN** (system prompt): cơ quan hành chính nghỉ T7/CN, nghỉ trưa 12h-13h, lịch trùng giờ làm thì hỏi lại/đề xuất giờ khác (sáng sớm/sau 17h30/cuối tuần), kiểm tra list_tasks trước khi chốt lịch mới
- [x] **Luồng lịch hẹn** ("mai tôi đi khám sức khỏe"): save_note → hỏi giờ → add_task với due_at → **tự nhắc trước 30 phút** (job quét mỗi 20s trong scheduler, test round-trip PASS) → đặt được ngày bất kỳ ("20/06 14:00" tự hiểu năm sau nếu đã qua; hỗ trợ "mai/mốt/hôm nay HH:MM")
- [x] **Lịch UI tô ngày có hẹn**: server đẩy marks qua MCP `self.calendar.set_marks` (khi thêm hẹn + sync mỗi 30'), firmware [calendar_marks.h](calendar_marks.h) + RefreshCalendar tô **tím nhạt 40%** ([ds02_home_display.cc](display/ds02_home_display.cc)) — giữ nguyên màu chữ, ô "today" vẫn ưu tiên
- [x] **Build11 THÀNH CÔNG** — `ds02.bin` cuối (3.4MB) đã tải về `firmware-project/artifacts/`, chứa đủ: báo thức + tab phiên dịch + lịch tô ngày hẹn + MCP tools (alarm/calendar)

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
