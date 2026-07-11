#pragma once

#include "assets/lang_config.h"
#include "settings.h"

#include <string_view>

namespace WakeSoundSettings {

constexpr const char* kNamespace = "audio";
constexpr const char* kKey = "wake_sound";
constexpr int kDefaultIndex = 0;
constexpr int kSoundCount = 8;

inline int NormalizeIndex(int index) {
    return (index >= 0 && index < kSoundCount) ? index : kDefaultIndex;
}

inline int LoadIndex() {
    Settings settings(kNamespace, false);
    return NormalizeIndex(settings.GetInt(kKey, kDefaultIndex));
}

inline void SaveIndex(int index) {
    Settings settings(kNamespace, true);
    settings.SetInt(kKey, NormalizeIndex(index));
}

inline int NextIndex(int index) {
    return (NormalizeIndex(index) + 1) % kSoundCount;
}

inline const char* Label(int index) {
    switch (NormalizeIndex(index)) {
        case 1:
            return "Success";
        case 2:
            return "Vibration";
        case 3:
            return "Exclamation";
        case 4:
            return "Welcome";
        case 5:
            return "Activation";
        case 6:
            return "Upgrade";
        case 7:
            return "Low Battery";
        case 0:
        default:
            return "Popup";
    }
}

inline std::string_view Sound(int index) {
    switch (NormalizeIndex(index)) {
        case 1:
            return Lang::Sounds::OGG_SUCCESS;
        case 2:
            return Lang::Sounds::OGG_VIBRATION;
        case 3:
            return Lang::Sounds::OGG_EXCLAMATION;
        case 4:
            return Lang::Sounds::OGG_WELCOME;
        case 5:
            return Lang::Sounds::OGG_ACTIVATION;
        case 6:
            return Lang::Sounds::OGG_UPGRADE;
        case 7:
            return Lang::Sounds::OGG_LOW_BATTERY;
        case 0:
        default:
            return Lang::Sounds::OGG_POPUP;
    }
}

} // namespace WakeSoundSettings
