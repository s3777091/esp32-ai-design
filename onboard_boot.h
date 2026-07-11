#pragma once

#include <cstddef>
#include <string_view>

namespace OnboardBoot {

std::string_view MusicMp3();
const void* LogoPngData();
size_t LogoPngSize();

} // namespace OnboardBoot
