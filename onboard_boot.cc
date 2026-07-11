#include "onboard_boot.h"

extern const char boot_mp3_start[] asm("_binary_boot_mp3_start");
extern const char boot_mp3_end[] asm("_binary_boot_mp3_end");
extern const char logo_png_start[] asm("_binary_logo_png_start");
extern const char logo_png_end[] asm("_binary_logo_png_end");

namespace OnboardBoot {

std::string_view MusicMp3() {
    return {
        boot_mp3_start,
        static_cast<size_t>(boot_mp3_end - boot_mp3_start),
    };
}

const void* LogoPngData() {
    return logo_png_start;
}

size_t LogoPngSize() {
    return static_cast<size_t>(logo_png_end - logo_png_start);
}

} // namespace OnboardBoot
