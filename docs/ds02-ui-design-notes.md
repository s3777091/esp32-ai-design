# DS-02 UI Design Notes

Target device: Loa Chatbot AI Xiaozhi Doi Thoai Tri Tue Nhan Tao Hoc Tap Giai Tri ESP32-S3 Loa Thong Minh DS-02.

## Hardware And Config Rules

- Keep existing board pins and hardware config unchanged unless explicitly requested.
- UI work should be preview-first when no physical DS-02 device is available.
- Do not rely on visual guesses from firmware-only changes; create a desktop/mock preview for layout decisions before porting to ESP32 display code.

## Standby And Button Flow

The standby UI follows a 3-step hardware button flow. The preview source is `tools/ui_preview/ds02/index.html`.

Target hardware button for ESP-BOX / ESP-BOX-3 style boards:

- `BOOT_BUTTON_GPIO`
- GPIO: `GPIO_NUM_0`
- Current firmware click behavior: enters Wi-Fi config during starting state, otherwise calls `Application::ToggleChatState()`.

Desired DS-02 standby behavior:

1. Initial standby/power-save screen is dim, dark, and visible.
2. The standby screen content is only a background image, Wi-Fi connection indicator, battery indicator, time digits, and weather label.
3. Wi-Fi connection state and battery belong in one corner.
4. The Wi-Fi indicator should reflect whether the device is currently connected.
5. Time digits sit directly under the Wi-Fi/battery indicators.
6. Weather label stays in its original lower position, not under Wi-Fi/battery.
7. Weather label is one line: `DIEU KIEN THOI TIET` in firmware if the selected font cannot render Vietnamese accents.
8. A compact calendar line sits directly under the weather label, e.g. `Thu 5, 9 thg 7 · 25/5 nam Binh Ngo`.
9. No title text, location carousel, menu, full status bar, subtitle, or navigation inside the device screen.
10. First button press wakes the same standby screen to full brightness.
11. Second button press changes the display to pure black.

## Pure Black State

The pure black state must be completely blank.

- Background color: `#000000`.
- No text.
- No icon.
- No emotion/face.
- No status bar.
- No subtitle/chat message.
- No notification.
- No animation.

The display should look completely blank and black in this state.
