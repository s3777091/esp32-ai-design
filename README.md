# DS-02 Home Firmware

`home/` is now a firmware copy based on `main/`, with DS-02 home-screen changes
kept inside this folder.

## Copied From Main

The app, audio, assets, display base classes, boards, LEDs, protocols, OTA,
settings, and build metadata were copied from `main/` into `home/`.

The ESP-BOX and ESP-BOX-3 board files that already existed in `home/boards`
were kept so DS-02 still allocates `home::Ds02HomeDisplay`.

## DS-02 Behavior

- Initial standby screen: wallpaper background, dimmed in power-save mode.
- Top corner: real Wi-Fi state, real battery level when the board exposes it,
  Bluetooth state only when a real provider is wired.
- Time/date: real system clock; invalid clock shows `--:--`.
- Button flow: dim standby -> awake standby -> black launcher.
- Wake flow: `home/application.cc` wakes `Ds02HomeDisplay` when wake word is
  detected, and `Ds02HomeDisplay::SetStatus()` also wakes on connecting/listening.
- Wake word default: DS-02 home Kconfig defaults to custom wake word `okke`.

## Build Notes

`home/CMakeLists.txt` is standalone component wiring copied from `main` and now
includes `display/ds02_home_display.cc` directly.

Use a non-emote LVGL/SPI-LCD display style for DS-02.
