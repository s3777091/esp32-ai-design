# DS-02 Wake Word Reference

`main/` is the reference source for wake word detection. DS-02 home firmware now
has its own copied audio/app flow under `home/`.

## Source Flow Copied From Main

- `home/audio/audio_service.cc`
  - `AudioService::SetModelsList(...)` creates the wake word implementation.
  - `wake_word_->OnWakeWordDetected(...)` forwards detections through
    `AudioServiceCallbacks::on_wake_word_detected`.
- `home/application.cc`
  - `callbacks.on_wake_word_detected` sets `MAIN_EVENT_WAKE_WORD_DETECTED`.
  - `Application::HandleWakeWordDetectedEvent()` handles the detected word,
    wakes `Ds02HomeDisplay`, opens the audio channel if needed, and changes state.
  - `Application::HandleStateChangedEvent()` calls
    `display->SetStatus(Lang::Strings::CONNECTING)` and then
    `display->SetStatus(Lang::Strings::LISTENING)`.

## Home Hook

`home/application.cc` calls the DS-02 display directly when wake word is detected.
`home/display/ds02_home_display.cc` also uses display status calls as a backup
wake signal:

- `Ds02HomeDisplay::SetStatus(CONNECTING/LISTENING)`
- `Ds02HomeDisplay::WakeFromWakeWord(...)`
- `Ds02HomeDisplay::ShowPureBlack()`
- `Ds02HomeDisplay::ShowLauncher()`

This keeps the wake UI behavior inside `home/`.

## Wake Word Text

For an `okke` custom wake word, configure the firmware with the custom wake word
option and set:

```text
CONFIG_USE_CUSTOM_WAKE_WORD=y
CONFIG_CUSTOM_WAKE_WORD="okke"
CONFIG_CUSTOM_WAKE_WORD_DISPLAY="okke"
```

The exact recognition quality still depends on the ESP-SR model bundled with the
build assets.
