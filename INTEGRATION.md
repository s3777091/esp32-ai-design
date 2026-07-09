# DS-02 Home Integration Notes

`home/` is a standalone firmware copy derived from `main/`.

## Copied Layout

Most runtime code now lives directly under `home/`:

- `home/application.*`
- `home/audio/`
- `home/assets*`
- `home/boards/`
- `home/display/`
- `home/led/`
- `home/protocols/`
- `home/CMakeLists.txt`
- `home/Kconfig.projbuild`

The DS-02-specific files are kept in place:

- `home/display/ds02_home_display.*`
- `home/boards/esp-box/esp_box_board.cc`
- `home/boards/esp-box-3/esp_box3_board.cc`

## Wake Word Wiring

Wake word detection code was copied from `main/audio` into `home/audio`.

When a wake word is detected:

- `home/audio/audio_service.cc` emits `on_wake_word_detected`.
- `home/application.cc` handles `MAIN_EVENT_WAKE_WORD_DETECTED`.
- `home/application.cc` calls `Ds02HomeDisplay::WakeFromWakeWord(...)`.
- `Ds02HomeDisplay` shows the black launcher.

`home/display/ds02_home_display.cc` also wakes the launcher when status becomes
connecting or listening, so the UI still follows the app state.

## Wake Word Text

`home/Kconfig.projbuild` defaults DS-02 home builds to:

```text
CONFIG_USE_CUSTOM_WAKE_WORD=y
CONFIG_CUSTOM_WAKE_WORD="okke"
CONFIG_CUSTOM_WAKE_WORD_DISPLAY="okke"
```

Recognition still depends on the ESP-SR model/assets included in the build.
