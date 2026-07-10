#include "ds02_home_display.h"

#include "application.h"
#include "assets.h"
#include "assets/lang_config.h"
#include "board.h"
#include "lvgl_theme.h"
#include "settings.h"
#include "wake_sound_settings.h"

#include <algorithm>
#include <array>
#include <cctype>
#include <cstring>
#include <cstdio>
#include <ctime>
#include <utility>

#include <font_awesome.h>
#include <esp_log.h>
#include <lvgl.h>

LV_FONT_DECLARE(BUILTIN_TEXT_FONT);
LV_FONT_DECLARE(BUILTIN_ICON_FONT);

namespace home {

namespace {
constexpr const char* TAG = "Ds02HomeDisplay";
constexpr int kRefreshIntervalUs = 1000 * 1000;
constexpr int kProfileAvatarIntervalUs = 80 * 1000;
constexpr int kValidYearBase = 2024 - 1900;
constexpr int kSystemBarHeight = 20;
constexpr int kDockHeight = 38;
constexpr int kDockBottomMargin = 4;
constexpr int kLowBatteryThreshold = 15;
constexpr size_t kProfileDockIndex = 3;
constexpr size_t kSettingsDockIndex = 5;

#if defined(CONFIG_CUSTOM_WAKE_WORD_DISPLAY)
#define DS02_WAKE_WORD_DISPLAY CONFIG_CUSTOM_WAKE_WORD_DISPLAY
#else
#define DS02_WAKE_WORD_DISPLAY "wake word"
#endif

struct DockItem {
    const char* icon;
    const char* title;
    const char* body;
};

struct BackgroundItem {
    const char* file;
    const char* title;
};

#if defined(FONT_AWESOME_CALENDAR_DAYS) && defined(FONT_AWESOME_MAGNIFYING_GLASS) && \
    defined(FONT_AWESOME_BELL) && defined(FONT_AWESOME_USER) && \
    defined(FONT_AWESOME_MUSIC) && defined(FONT_AWESOME_GEAR)
constexpr bool kDockUsesIconFont = true;
constexpr std::array<DockItem, 6> kDockItems = {{
    {FONT_AWESOME_CALENDAR_DAYS, "Calendar", ""},
    {FONT_AWESOME_MAGNIFYING_GLASS, "Search", "Tim kiem thiet bi, bai hat, cai dat..."},
    {FONT_AWESOME_BELL, "Alerts", "Khong co thong bao moi."},
    {FONT_AWESOME_USER, "Ekko Robot", "Wake word: " DS02_WAKE_WORD_DISPLAY},
    {FONT_AWESOME_MUSIC, "Music", "Chua co bai hat nao dang phat."},
    {FONT_AWESOME_GEAR, "Settings", "Wi-Fi, am thanh, hien thi, ngon ngu..."},
}};
#else
constexpr bool kDockUsesIconFont = false;
constexpr std::array<DockItem, 6> kDockItems = {{
    {"CAL", "Calendar", ""},
    {"SRC", "Search", "Tim kiem thiet bi, bai hat, cai dat..."},
    {"ALT", "Alerts", "Khong co thong bao moi."},
    {"USR", "Ekko Robot", "Wake word: " DS02_WAKE_WORD_DISPLAY},
    {"MUS", "Music", "Chua co bai hat nao dang phat."},
    {"SET", "Settings", "Wi-Fi, am thanh, hien thi, ngon ngu..."},
}};
#endif

constexpr std::array<const char*, 7> kCalendarWeekdays = {{
    "SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"
}};

constexpr std::array<BackgroundItem, 20> kBackgroundItems = {{
    {"mountain.png", "Mountain"},
    {"abtract.png", "Abstract"},
    {"anime_light.png", "Anime Light"},
    {"cat_dog_anime.png", "Cat Dog Anime"},
    {"cat_dog_chill.png", "Cat Dog Chill"},
    {"cat_dog_sleep.png", "Cat Dog Sleep"},
    {"europe.png", "Europe"},
    {"fantacy_anime.png", "Fantacy Anime"},
    {"follower.png", "Follower"},
    {"haivan.png", "Hai Van"},
    {"jp_temple.png", "JP Temple"},
    {"linh_ung_pagoda.png", "Linh Ung Pagoda"},
    {"morning_beach.png", "Morning Beach"},
    {"night_light.png", "Night Light"},
    {"pixel.png", "Pixel"},
    {"romance_anime.png", "Romance Anime"},
    {"rong_river.png", "Rong River"},
    {"rooftop.png", "Rooftop"},
    {"rubic.png", "Rubic"},
    {"sa_mac.png", "Sa Mac"},
}};

lv_color_t Color(uint32_t value) {
    return lv_color_hex(value);
}

void SetCachedText(lv_obj_t* label, std::string& cache, const std::string& text) {
    if (label == nullptr || cache == text) {
        return;
    }
    cache = text;
    lv_label_set_text(label, cache.c_str());
}

void SetCachedText(lv_obj_t* label, std::string& cache, const char* text) {
    SetCachedText(label, cache, std::string(text != nullptr ? text : ""));
}

void SetVisible(lv_obj_t* obj, bool visible) {
    if (obj == nullptr) {
        return;
    }
    if (visible) {
        lv_obj_clear_flag(obj, LV_OBJ_FLAG_HIDDEN);
    } else {
        lv_obj_add_flag(obj, LV_OBJ_FLAG_HIDDEN);
    }
}

void ClearBoxStyle(lv_obj_t* obj) {
    if (obj == nullptr) {
        return;
    }
    lv_obj_set_style_pad_all(obj, 0, 0);
    lv_obj_set_style_border_width(obj, 0, 0);
    lv_obj_set_style_radius(obj, 0, 0);
    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
}

int Clamp(int value, int low, int high) {
    return std::max(low, std::min(value, high));
}

uint32_t DimColor(uint32_t value, int percent) {
    percent = Clamp(percent, 0, 100);
    const uint32_t r = ((value >> 16) & 0xff) * percent / 100;
    const uint32_t g = ((value >> 8) & 0xff) * percent / 100;
    const uint32_t b = (value & 0xff) * percent / 100;
    return (r << 16) | (g << 8) | b;
}

std::string NormalizeBackgroundKey(const std::string& value) {
    std::string normalized;
    normalized.reserve(value.size());
    for (unsigned char ch : value) {
        if (std::isalnum(ch)) {
            normalized.push_back(static_cast<char>(std::tolower(ch)));
        }
    }
    return normalized;
}

bool TextEquals(const char* lhs, const char* rhs) {
    return lhs != nullptr && rhs != nullptr && std::strcmp(lhs, rhs) == 0;
}

bool IsEncodedRasterImage(const void* data, size_t size) {
    if (data == nullptr || size < 4) {
        return false;
    }

    const auto* bytes = static_cast<const uint8_t*>(data);
    const bool png = size >= 8 &&
                     bytes[0] == 0x89 && bytes[1] == 0x50 &&
                     bytes[2] == 0x4e && bytes[3] == 0x47;
    const bool jpg = size >= 3 &&
                     bytes[0] == 0xff && bytes[1] == 0xd8 && bytes[2] == 0xff;
    const bool gif = size >= 3 &&
                     bytes[0] == 'G' && bytes[1] == 'I' && bytes[2] == 'F';
    return png || jpg || gif;
}

std::unique_ptr<LvglImage> CreateBackgroundImage(void* data, size_t size) {
    if (IsEncodedRasterImage(data, size)) {
        return std::make_unique<LvglRawImage>(data, size);
    }
    return std::make_unique<LvglCBinImage>(data);
}

bool GetBackgroundAssetData(const char* file, void*& ptr, size_t& size) {
    auto& assets = Assets::GetInstance();
    if (assets.GetAssetData(file, ptr, size)) {
        return true;
    }

    char image_path[48];
    std::snprintf(image_path, sizeof(image_path), "image/%s", file);
    return assets.GetAssetData(image_path, ptr, size);
}

bool GetImageHeader(const lv_img_dsc_t* image_dsc, lv_image_header_t& header) {
    if (image_dsc == nullptr) {
        return false;
    }

    header = image_dsc->header;
    if (header.w > 0 && header.h > 0) {
        return true;
    }

    return lv_image_decoder_get_info(image_dsc, &header) == LV_RESULT_OK &&
           header.w > 0 && header.h > 0;
}

void ApplyCoverImage(lv_obj_t* container, lv_obj_t* image_obj, const lv_img_dsc_t* image_dsc,
                     int fallback_width, int fallback_height) {
    if (container == nullptr || image_obj == nullptr) {
        return;
    }

    if (image_dsc == nullptr) {
        lv_image_set_src(image_obj, nullptr);
        lv_obj_add_flag(image_obj, LV_OBJ_FLAG_HIDDEN);
        return;
    }

    lv_image_set_src(image_obj, image_dsc);
    lv_obj_clear_flag(image_obj, LV_OBJ_FLAG_HIDDEN);

    lv_image_header_t header = {};
    if (GetImageHeader(image_dsc, header)) {
        int box_width = lv_obj_get_width(container);
        int box_height = lv_obj_get_height(container);
        if (box_width <= 0) {
            box_width = fallback_width;
        }
        if (box_height <= 0) {
            box_height = fallback_height;
        }

        const int scale_width = std::max(1, box_width * 256 / static_cast<int>(header.w));
        const int scale_height = std::max(1, box_height * 256 / static_cast<int>(header.h));
        lv_image_set_scale(image_obj, std::max(scale_width, scale_height));
    } else {
        lv_image_set_scale(image_obj, 256);
    }

    lv_obj_center(image_obj);
}

lv_color_t BatteryStatusColor(int level, bool charging) {
    if (charging) {
        return Color(0x67e8f9);
    }
    if (level <= kLowBatteryThreshold) {
        return Color(0xff5c7a);
    }
    if (level <= 35) {
        return Color(0xfbbf24);
    }
    return Color(0x34d399);
}

lv_color_t NetworkStatusColor(const char* icon) {
    if (icon == nullptr || icon[0] == '\0') {
        return Color(0x6b7280);
    }
#ifdef FONT_AWESOME_WIFI_SLASH
    if (std::strcmp(icon, FONT_AWESOME_WIFI_SLASH) == 0) {
        return Color(0xff5c7a);
    }
#endif
    return Color(0x34d399);
}

} // namespace

Ds02HomeDisplay::Ds02HomeDisplay(esp_lcd_panel_io_handle_t panel_io, esp_lcd_panel_handle_t panel,
                                 int width, int height, int offset_x, int offset_y,
                                 bool mirror_x, bool mirror_y, bool swap_xy)
    : SpiLcdDisplay(panel_io, panel, width, height, offset_x, offset_y, mirror_x, mirror_y, swap_xy) {
}

Ds02HomeDisplay::~Ds02HomeDisplay() {
    if (profile_avatar_timer_ != nullptr) {
        if (profile_avatar_timer_running_) {
            esp_timer_stop(profile_avatar_timer_);
            profile_avatar_timer_running_ = false;
        }
        esp_timer_delete(profile_avatar_timer_);
        profile_avatar_timer_ = nullptr;
    }

    if (refresh_timer_ != nullptr) {
        esp_timer_stop(refresh_timer_);
        esp_timer_delete(refresh_timer_);
        refresh_timer_ = nullptr;
    }
}

void Ds02HomeDisplay::SetupUI() {
    if (setup_ui_called_) {
        ESP_LOGW(TAG, "SetupUI() called more than once");
        return;
    }

    Display::SetupUI();
    DisplayLockGuard lock(this);

    auto screen = lv_screen_active();
    lv_obj_clean(screen);
    lv_obj_set_style_bg_color(screen, Color(0x000000), 0);
    lv_obj_set_style_bg_opa(screen, LV_OPA_COVER, 0);

    CreateStandbyObjects();
    CreateLauncherObjects();
    CreateSystemBarObjects();
    CreateLowBatteryNotificationObjects();
    CreateBackgroundGalleryObjects();

    Settings settings("display", false);
    background_index_ = static_cast<size_t>(
        Clamp(settings.GetInt("ds02_background", 0), 0, static_cast<int>(kBackgroundItems.size()) - 1)
    );
    persisted_background_index_ = background_index_;
    text_color_ = static_cast<uint32_t>(settings.GetInt("ds02_text_color", static_cast<int32_t>(text_color_))) & 0xffffff;
    if (!ApplyBackgroundIndex(background_index_)) {
        MoveBackground(1);
        persisted_background_index_ = background_index_;
    }
    ApplyTextColor();

    esp_timer_create_args_t timer_args = {
        .callback = OnRefreshTimer,
        .arg = this,
        .dispatch_method = ESP_TIMER_TASK,
        .name = "ds02_home",
        .skip_unhandled_events = true,
    };
    esp_timer_create(&timer_args, &refresh_timer_);
    esp_timer_start_periodic(refresh_timer_, kRefreshIntervalUs);

    esp_timer_create_args_t avatar_timer_args = {
        .callback = OnProfileAvatarTimer,
        .arg = this,
        .dispatch_method = ESP_TIMER_TASK,
        .name = "ds02_profile",
        .skip_unhandled_events = true,
    };
    esp_timer_create(&avatar_timer_args, &profile_avatar_timer_);

    RefreshHomeData();
    ApplyStandbyState();
}

void Ds02HomeDisplay::CreateStandbyObjects() {
    auto screen = lv_screen_active();

    root_ = lv_obj_create(screen);
    lv_obj_set_size(root_, LV_HOR_RES, LV_VER_RES);
    ClearBoxStyle(root_);
    lv_obj_set_style_bg_color(root_, Color(0x000000), 0);
    lv_obj_set_style_bg_opa(root_, LV_OPA_COVER, 0);

    standby_layer_ = lv_obj_create(root_);
    lv_obj_set_size(standby_layer_, LV_PCT(100), LV_PCT(100));
    ClearBoxStyle(standby_layer_);
    lv_obj_set_style_bg_opa(standby_layer_, LV_OPA_TRANSP, 0);

    wallpaper_ = lv_obj_create(standby_layer_);
    lv_obj_set_size(wallpaper_, LV_PCT(100), LV_PCT(100));
    ClearBoxStyle(wallpaper_);
    lv_obj_set_style_bg_color(wallpaper_, Color(0x1b2630), 0);
    lv_obj_set_style_bg_grad_color(wallpaper_, Color(0x8b7966), 0);
    lv_obj_set_style_bg_grad_dir(wallpaper_, LV_GRAD_DIR_VER, 0);

    wallpaper_image_obj_ = lv_image_create(wallpaper_);
    lv_obj_add_flag(wallpaper_image_obj_, LV_OBJ_FLAG_HIDDEN);
    lv_obj_center(wallpaper_image_obj_);

    dim_overlay_ = lv_obj_create(standby_layer_);
    lv_obj_set_size(dim_overlay_, LV_PCT(100), LV_PCT(100));
    ClearBoxStyle(dim_overlay_);
    lv_obj_set_style_bg_color(dim_overlay_, Color(0x000000), 0);
    lv_obj_set_style_bg_opa(dim_overlay_, LV_OPA_60, 0);

    corner_info_ = lv_obj_create(standby_layer_);
    lv_obj_set_size(corner_info_, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
    ClearBoxStyle(corner_info_);
    lv_obj_set_style_bg_opa(corner_info_, LV_OPA_TRANSP, 0);
    lv_obj_set_flex_flow(corner_info_, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(corner_info_, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_END, LV_FLEX_ALIGN_END);
    lv_obj_align(corner_info_, LV_ALIGN_TOP_RIGHT, -12, kSystemBarHeight + 8);

    time_label_ = lv_label_create(corner_info_);
    lv_obj_set_style_text_color(time_label_, Color(0xffffff), 0);
    lv_obj_set_style_text_font(time_label_, &BUILTIN_TEXT_FONT, 0);
    lv_label_set_text(time_label_, "--:--");

    bottom_info_ = lv_obj_create(standby_layer_);
    lv_obj_set_size(bottom_info_, LV_HOR_RES, LV_SIZE_CONTENT);
    lv_obj_set_style_pad_top(bottom_info_, 0, 0);
    lv_obj_set_style_pad_bottom(bottom_info_, 6, 0);
    lv_obj_set_style_pad_left(bottom_info_, 0, 0);
    lv_obj_set_style_pad_right(bottom_info_, 0, 0);
    lv_obj_set_style_border_width(bottom_info_, 0, 0);
    lv_obj_set_style_bg_opa(bottom_info_, LV_OPA_TRANSP, 0);
    lv_obj_set_flex_flow(bottom_info_, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(bottom_info_, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_align(bottom_info_, LV_ALIGN_BOTTOM_MID, 0, 0);
    lv_obj_clear_flag(bottom_info_, LV_OBJ_FLAG_SCROLLABLE);

    weather_label_ = lv_label_create(bottom_info_);
    lv_obj_set_style_text_color(weather_label_, Color(0xffffff), 0);
    lv_obj_set_style_text_font(weather_label_, &BUILTIN_TEXT_FONT, 0);
    lv_label_set_text(weather_label_, "DIEU KIEN THOI TIET");

    date_label_ = lv_label_create(bottom_info_);
    lv_obj_set_width(date_label_, LV_HOR_RES);
    lv_obj_set_style_text_align(date_label_, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_style_text_color(date_label_, Color(0xd0d0d0), 0);
    lv_obj_set_style_text_font(date_label_, &BUILTIN_TEXT_FONT, 0);
    lv_label_set_text(date_label_, "");

}

void Ds02HomeDisplay::CreateLauncherObjects() {
    const int safe_width = width_ > 0 ? width_ : 320;
    const int safe_height = height_ > 0 ? height_ : 240;
    const int content_height = std::max(1, safe_height - kSystemBarHeight);

    launcher_layer_ = lv_obj_create(root_);
    lv_obj_set_size(launcher_layer_, LV_PCT(100), LV_PCT(100));
    ClearBoxStyle(launcher_layer_);
    lv_obj_set_style_bg_color(launcher_layer_, Color(0x000000), 0);
    lv_obj_set_style_bg_opa(launcher_layer_, LV_OPA_COVER, 0);
    lv_obj_add_flag(launcher_layer_, LV_OBJ_FLAG_HIDDEN);

    launcher_content_ = lv_obj_create(launcher_layer_);
    lv_obj_set_size(launcher_content_, LV_PCT(100), content_height);
    ClearBoxStyle(launcher_content_);
    lv_obj_set_style_bg_opa(launcher_content_, LV_OPA_TRANSP, 0);
    lv_obj_align(launcher_content_, LV_ALIGN_TOP_MID, 0, kSystemBarHeight);

    CreateCalendarObjects();
    CreateProfileObjects();
    CreateSettingsObjects();

    launcher_title_label_ = lv_label_create(launcher_content_);
    lv_obj_set_width(launcher_title_label_, safe_width - 32);
    lv_obj_set_style_text_align(launcher_title_label_, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_style_text_color(launcher_title_label_, Color(0xffffff), 0);
    lv_obj_set_style_text_font(launcher_title_label_, &BUILTIN_TEXT_FONT, 0);
    lv_label_set_long_mode(launcher_title_label_, LV_LABEL_LONG_DOT);
    lv_obj_align(launcher_title_label_, LV_ALIGN_CENTER, 0, -20);

    launcher_body_label_ = lv_label_create(launcher_content_);
    lv_obj_set_width(launcher_body_label_, safe_width - 48);
    lv_obj_set_style_text_align(launcher_body_label_, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_style_text_color(launcher_body_label_, Color(0xa9b2bd), 0);
    lv_obj_set_style_text_font(launcher_body_label_, &BUILTIN_TEXT_FONT, 0);
    lv_label_set_long_mode(launcher_body_label_, LV_LABEL_LONG_WRAP);
    lv_obj_align(launcher_body_label_, LV_ALIGN_CENTER, 0, 18);

    CreateDockObjects();
    RefreshLauncherPage(true);
    ApplyDockSelection();
}

void Ds02HomeDisplay::CreateSystemBarObjects() {
    if (root_ == nullptr) {
        return;
    }

    system_bar_ = lv_obj_create(root_);
    lv_obj_set_size(system_bar_, LV_PCT(100), kSystemBarHeight);
    ClearBoxStyle(system_bar_);
    lv_obj_set_style_bg_color(system_bar_, Color(0x000000), 0);
    lv_obj_set_style_bg_opa(system_bar_, LV_OPA_COVER, 0);
    lv_obj_set_style_pad_left(system_bar_, 6, 0);
    lv_obj_set_style_pad_right(system_bar_, 6, 0);
    lv_obj_set_style_pad_top(system_bar_, 2, 0);
    lv_obj_set_style_pad_bottom(system_bar_, 2, 0);
    lv_obj_set_flex_flow(system_bar_, LV_FLEX_FLOW_ROW);
    lv_obj_set_flex_align(system_bar_, LV_FLEX_ALIGN_END, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_align(system_bar_, LV_ALIGN_TOP_MID, 0, 0);

    status_row_ = lv_obj_create(system_bar_);
    lv_obj_set_size(status_row_, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
    ClearBoxStyle(status_row_);
    lv_obj_set_style_bg_opa(status_row_, LV_OPA_TRANSP, 0);
    lv_obj_set_style_pad_column(status_row_, 4, 0);
    lv_obj_set_flex_flow(status_row_, LV_FLEX_FLOW_ROW);
    lv_obj_set_flex_align(status_row_, LV_FLEX_ALIGN_END, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);

    wifi_label_ = lv_label_create(status_row_);
    bluetooth_label_ = lv_label_create(status_row_);
    battery_label_ds02_ = lv_label_create(status_row_);
    battery_icon_root_ = lv_obj_create(status_row_);

    lv_obj_set_style_text_color(wifi_label_, Color(0xffffff), 0);
    lv_obj_set_style_text_color(bluetooth_label_, Color(0x8f98a3), 0);
    lv_obj_set_style_text_color(battery_label_ds02_, Color(0xffffff), 0);
    lv_obj_set_style_text_font(wifi_label_, &BUILTIN_ICON_FONT, 0);
    lv_obj_set_style_text_font(bluetooth_label_, &BUILTIN_TEXT_FONT, 0);
    lv_obj_set_style_text_font(battery_label_ds02_, &BUILTIN_TEXT_FONT, 0);

    lv_obj_set_size(battery_icon_root_, 18, 10);
    ClearBoxStyle(battery_icon_root_);
    lv_obj_set_style_bg_opa(battery_icon_root_, LV_OPA_TRANSP, 0);

    battery_icon_body_ = lv_obj_create(battery_icon_root_);
    lv_obj_set_size(battery_icon_body_, 14, 8);
    ClearBoxStyle(battery_icon_body_);
    lv_obj_set_pos(battery_icon_body_, 0, 1);
    lv_obj_set_style_radius(battery_icon_body_, 2, 0);
    lv_obj_set_style_bg_opa(battery_icon_body_, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(battery_icon_body_, 1, 0);
    lv_obj_set_style_border_color(battery_icon_body_, Color(0xffffff), 0);

    battery_icon_fill_ = lv_obj_create(battery_icon_body_);
    lv_obj_set_size(battery_icon_fill_, 10, 4);
    ClearBoxStyle(battery_icon_fill_);
    lv_obj_set_pos(battery_icon_fill_, 2, 2);
    lv_obj_set_style_radius(battery_icon_fill_, 1, 0);
    lv_obj_set_style_bg_color(battery_icon_fill_, Color(0xffffff), 0);
    lv_obj_set_style_bg_opa(battery_icon_fill_, LV_OPA_COVER, 0);

    battery_icon_nub_ = lv_obj_create(battery_icon_root_);
    lv_obj_set_size(battery_icon_nub_, 2, 4);
    ClearBoxStyle(battery_icon_nub_);
    lv_obj_set_pos(battery_icon_nub_, 15, 3);
    lv_obj_set_style_radius(battery_icon_nub_, 1, 0);
    lv_obj_set_style_bg_color(battery_icon_nub_, Color(0xffffff), 0);
    lv_obj_set_style_bg_opa(battery_icon_nub_, LV_OPA_COVER, 0);
}

void Ds02HomeDisplay::CreateLowBatteryNotificationObjects() {
    if (root_ == nullptr) {
        return;
    }

    const int safe_width = width_ > 0 ? width_ : 320;
    low_battery_pill_ = lv_obj_create(root_);
    lv_obj_set_size(low_battery_pill_, Clamp(safe_width - 132, 136, 180), 28);
    ClearBoxStyle(low_battery_pill_);
    lv_obj_set_style_radius(low_battery_pill_, 999, 0);
    lv_obj_set_style_bg_color(low_battery_pill_, Color(0x070a0f), 0);
    lv_obj_set_style_bg_opa(low_battery_pill_, LV_OPA_90, 0);
    lv_obj_set_style_border_width(low_battery_pill_, 1, 0);
    lv_obj_set_style_border_color(low_battery_pill_, Color(0xff5c7a), 0);
    lv_obj_set_style_border_opa(low_battery_pill_, LV_OPA_50, 0);
    lv_obj_set_style_shadow_width(low_battery_pill_, 14, 0);
    lv_obj_set_style_shadow_color(low_battery_pill_, Color(0x000000), 0);
    lv_obj_set_style_shadow_opa(low_battery_pill_, LV_OPA_60, 0);
    lv_obj_align(low_battery_pill_, LV_ALIGN_TOP_MID, 0, kSystemBarHeight + 8);
    lv_obj_add_flag(low_battery_pill_, LV_OBJ_FLAG_HIDDEN);

    low_battery_pill_label_ = lv_label_create(low_battery_pill_);
    lv_obj_set_style_text_align(low_battery_pill_label_, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_style_text_color(low_battery_pill_label_, Color(0xffd4df), 0);
    lv_obj_set_style_text_font(low_battery_pill_label_, &BUILTIN_TEXT_FONT, 0);
    lv_label_set_text(low_battery_pill_label_, "Pin yếu");
    lv_obj_center(low_battery_pill_label_);
}

void Ds02HomeDisplay::CreateCalendarObjects() {
    const int safe_width = width_ > 0 ? width_ : 320;
    const int safe_height = height_ > 0 ? height_ : 240;
    const int content_height = std::max(120, safe_height - kSystemBarHeight);
    const int calendar_height = std::max(120, content_height - kDockHeight - kDockBottomMargin - 8);
    const int margin_x = 8;
    const int header_height = 30;
    const int grid_y = header_height;
    const int cell_width = std::max(18, (safe_width - margin_x * 2) / 7);
    const int cell_height = std::max(16, (calendar_height - grid_y - 2) / 7);

    calendar_root_ = lv_obj_create(launcher_content_);
    lv_obj_set_size(calendar_root_, safe_width, calendar_height);
    ClearBoxStyle(calendar_root_);
    lv_obj_set_style_bg_opa(calendar_root_, LV_OPA_TRANSP, 0);
    lv_obj_align(calendar_root_, LV_ALIGN_TOP_MID, 0, 0);

    calendar_month_label_ = lv_label_create(calendar_root_);
    lv_obj_set_width(calendar_month_label_, safe_width / 2);
    lv_obj_set_style_text_color(calendar_month_label_, Color(0xffffff), 0);
    lv_obj_set_style_text_font(calendar_month_label_, &BUILTIN_TEXT_FONT, 0);
    lv_label_set_long_mode(calendar_month_label_, LV_LABEL_LONG_DOT);
    lv_obj_align(calendar_month_label_, LV_ALIGN_TOP_LEFT, 12, 8);

    for (size_t i = 0; i < calendar_weekday_labels_.size(); ++i) {
        auto* label = lv_label_create(calendar_root_);
        calendar_weekday_labels_[i] = label;
        lv_obj_set_size(label, cell_width, cell_height);
        lv_obj_set_style_text_align(label, LV_TEXT_ALIGN_CENTER, 0);
        lv_obj_set_style_text_color(label, Color(0x69717c), 0);
        lv_obj_set_style_text_font(label, &BUILTIN_TEXT_FONT, 0);
        lv_label_set_text(label, kCalendarWeekdays[i]);
        lv_obj_align(label, LV_ALIGN_TOP_LEFT, margin_x + static_cast<int>(i) * cell_width, grid_y);
    }

    for (size_t i = 0; i < calendar_day_cells_.size(); ++i) {
        const int row = static_cast<int>(i / 7);
        const int col = static_cast<int>(i % 7);
        auto* cell = lv_obj_create(calendar_root_);
        calendar_day_cells_[i] = cell;
        lv_obj_set_size(cell, cell_width - 2, cell_height - 2);
        ClearBoxStyle(cell);
        lv_obj_set_style_bg_opa(cell, LV_OPA_TRANSP, 0);
        lv_obj_align(cell, LV_ALIGN_TOP_LEFT,
                     margin_x + col * cell_width + 1,
                     grid_y + (row + 1) * cell_height + 1);

        auto* label = lv_label_create(cell);
        calendar_day_labels_[i] = label;
        lv_obj_set_style_text_align(label, LV_TEXT_ALIGN_CENTER, 0);
        lv_obj_set_style_text_color(label, Color(0xe8edf2), 0);
        lv_obj_set_style_text_font(label, &BUILTIN_TEXT_FONT, 0);
        lv_obj_center(label);
    }
}

void Ds02HomeDisplay::CreateProfileObjects() {
    const int safe_width = width_ > 0 ? width_ : 320;
    const int safe_height = height_ > 0 ? height_ : 240;
    const int content_height = std::max(120, safe_height - kSystemBarHeight - kDockHeight - kDockBottomMargin - 4);
    profile_avatar_base_size_ = Clamp(std::min(safe_width, content_height) * 58 / 100, 82, 144);

    profile_avatar_root_ = lv_obj_create(launcher_content_);
    lv_obj_set_size(profile_avatar_root_, safe_width, content_height);
    ClearBoxStyle(profile_avatar_root_);
    lv_obj_set_style_bg_color(profile_avatar_root_, Color(0x000000), 0);
    lv_obj_set_style_bg_opa(profile_avatar_root_, LV_OPA_COVER, 0);
    lv_obj_align(profile_avatar_root_, LV_ALIGN_TOP_MID, 0, 0);
    lv_obj_add_flag(profile_avatar_root_, LV_OBJ_FLAG_HIDDEN);

    profile_avatar_shadow_ = lv_obj_create(profile_avatar_root_);
    lv_obj_set_size(profile_avatar_shadow_, profile_avatar_base_size_, profile_avatar_base_size_);
    ClearBoxStyle(profile_avatar_shadow_);
    lv_obj_set_style_radius(profile_avatar_shadow_, 999, 0);
    lv_obj_set_style_bg_color(profile_avatar_shadow_, Color(0x030605), 0);
    lv_obj_set_style_bg_opa(profile_avatar_shadow_, LV_OPA_70, 0);
    lv_obj_set_style_shadow_width(profile_avatar_shadow_, 18, 0);
    lv_obj_set_style_shadow_color(profile_avatar_shadow_, Color(0x000000), 0);
    lv_obj_set_style_shadow_opa(profile_avatar_shadow_, LV_OPA_80, 0);
    lv_obj_align(profile_avatar_shadow_, LV_ALIGN_CENTER, 0, 0);

    profile_avatar_sphere_ = lv_obj_create(profile_avatar_root_);
    lv_obj_set_size(profile_avatar_sphere_, profile_avatar_base_size_, profile_avatar_base_size_);
    ClearBoxStyle(profile_avatar_sphere_);
    lv_obj_set_style_radius(profile_avatar_sphere_, 999, 0);
    lv_obj_set_style_bg_color(profile_avatar_sphere_, Color(0x65d8ff), 0);
    lv_obj_set_style_bg_grad_color(profile_avatar_sphere_, Color(0x06251a), 0);
    lv_obj_set_style_bg_grad_dir(profile_avatar_sphere_, LV_GRAD_DIR_VER, 0);
    lv_obj_set_style_bg_opa(profile_avatar_sphere_, LV_OPA_COVER, 0);
    lv_obj_set_style_shadow_width(profile_avatar_sphere_, 10, 0);
    lv_obj_set_style_shadow_color(profile_avatar_sphere_, Color(0x04110d), 0);
    lv_obj_set_style_shadow_opa(profile_avatar_sphere_, LV_OPA_50, 0);
    lv_obj_align(profile_avatar_sphere_, LV_ALIGN_CENTER, 0, 0);

    auto* cloud_top = lv_obj_create(profile_avatar_sphere_);
    lv_obj_set_size(cloud_top, LV_PCT(58), LV_PCT(20));
    ClearBoxStyle(cloud_top);
    lv_obj_set_style_radius(cloud_top, 999, 0);
    lv_obj_set_style_bg_color(cloud_top, Color(0xf4fdff), 0);
    lv_obj_set_style_bg_opa(cloud_top, LV_OPA_70, 0);
    lv_obj_align(cloud_top, LV_ALIGN_TOP_LEFT, 18, 17);

    auto* cloud_side = lv_obj_create(profile_avatar_sphere_);
    lv_obj_set_size(cloud_side, LV_PCT(34), LV_PCT(26));
    ClearBoxStyle(cloud_side);
    lv_obj_set_style_radius(cloud_side, 999, 0);
    lv_obj_set_style_bg_color(cloud_side, Color(0xecffdb), 0);
    lv_obj_set_style_bg_opa(cloud_side, LV_OPA_70, 0);
    lv_obj_align(cloud_side, LV_ALIGN_TOP_RIGHT, -10, 29);

    auto* land_dark = lv_obj_create(profile_avatar_sphere_);
    lv_obj_set_size(land_dark, LV_PCT(62), LV_PCT(48));
    ClearBoxStyle(land_dark);
    lv_obj_set_style_radius(land_dark, 999, 0);
    lv_obj_set_style_bg_color(land_dark, Color(0x073521), 0);
    lv_obj_set_style_bg_opa(land_dark, LV_OPA_80, 0);
    lv_obj_align(land_dark, LV_ALIGN_BOTTOM_RIGHT, -2, -12);

    auto* land_light = lv_obj_create(profile_avatar_sphere_);
    lv_obj_set_size(land_light, LV_PCT(42), LV_PCT(18));
    ClearBoxStyle(land_light);
    lv_obj_set_style_radius(land_light, 999, 0);
    lv_obj_set_style_bg_color(land_light, Color(0xc5ee78), 0);
    lv_obj_set_style_bg_opa(land_light, LV_OPA_70, 0);
    lv_obj_align(land_light, LV_ALIGN_BOTTOM_LEFT, 2, -16);

    auto* highlight = lv_obj_create(profile_avatar_sphere_);
    lv_obj_set_size(highlight, LV_PCT(36), LV_PCT(16));
    ClearBoxStyle(highlight);
    lv_obj_set_style_radius(highlight, 999, 0);
    lv_obj_set_style_bg_color(highlight, Color(0xffffff), 0);
    lv_obj_set_style_bg_opa(highlight, LV_OPA_70, 0);
    lv_obj_align(highlight, LV_ALIGN_TOP_LEFT, 27, 10);
}

void Ds02HomeDisplay::CreateSettingsObjects() {
    const int safe_width = width_ > 0 ? width_ : 320;
    const int safe_height = height_ > 0 ? height_ : 240;
    const int content_height = std::max(120, safe_height - kSystemBarHeight - kDockHeight - kDockBottomMargin - 8);
    const int row_width = Clamp(safe_width - 24, 216, 296);

    settings_root_ = lv_obj_create(launcher_content_);
    lv_obj_set_size(settings_root_, safe_width, content_height);
    ClearBoxStyle(settings_root_);
    lv_obj_set_style_bg_color(settings_root_, Color(0x050609), 0);
    lv_obj_set_style_bg_opa(settings_root_, LV_OPA_COVER, 0);
    lv_obj_align(settings_root_, LV_ALIGN_TOP_MID, 0, 0);
    lv_obj_add_flag(settings_root_, LV_OBJ_FLAG_HIDDEN);

    auto* title = lv_label_create(settings_root_);
    lv_obj_set_style_text_color(title, Color(0xffffff), 0);
    lv_obj_set_style_text_font(title, &BUILTIN_TEXT_FONT, 0);
    lv_label_set_text(title, "Settings");
    lv_obj_align(title, LV_ALIGN_TOP_LEFT, 14, 7);

    auto* wake_row = lv_obj_create(settings_root_);
    lv_obj_set_size(wake_row, row_width, 32);
    ClearBoxStyle(wake_row);
    lv_obj_set_style_radius(wake_row, 8, 0);
    lv_obj_set_style_bg_color(wake_row, Color(0x111827), 0);
    lv_obj_set_style_bg_opa(wake_row, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(wake_row, 1, 0);
    lv_obj_set_style_border_color(wake_row, Color(0x273241), 0);
    lv_obj_align(wake_row, LV_ALIGN_TOP_MID, 0, 30);

    auto* wake_title = lv_label_create(wake_row);
    lv_obj_set_style_text_color(wake_title, Color(0xf8fafc), 0);
    lv_obj_set_style_text_font(wake_title, &BUILTIN_TEXT_FONT, 0);
    lv_label_set_text(wake_title, "Wake word");
    lv_obj_align(wake_title, LV_ALIGN_LEFT_MID, 10, -5);

    auto* wake_value = lv_label_create(wake_row);
    lv_obj_set_style_text_color(wake_value, Color(0x67e8f9), 0);
    lv_obj_set_style_text_font(wake_value, &BUILTIN_TEXT_FONT, 0);
    lv_label_set_text(wake_value, DS02_WAKE_WORD_DISPLAY);
    lv_obj_align(wake_value, LV_ALIGN_RIGHT_MID, -10, 5);

    auto* wake_sound_row = lv_obj_create(settings_root_);
    lv_obj_set_size(wake_sound_row, row_width, 32);
    ClearBoxStyle(wake_sound_row);
    lv_obj_set_style_radius(wake_sound_row, 8, 0);
    lv_obj_set_style_bg_color(wake_sound_row, Color(0x111827), 0);
    lv_obj_set_style_bg_opa(wake_sound_row, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(wake_sound_row, 1, 0);
    lv_obj_set_style_border_color(wake_sound_row, Color(0x273241), 0);
    lv_obj_add_flag(wake_sound_row, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(wake_sound_row, OnSettingsWakeSoundClicked, LV_EVENT_CLICKED, this);
    lv_obj_align(wake_sound_row, LV_ALIGN_TOP_MID, 0, 66);

    auto* wake_sound_title = lv_label_create(wake_sound_row);
    lv_obj_set_style_text_color(wake_sound_title, Color(0xf8fafc), 0);
    lv_obj_set_style_text_font(wake_sound_title, &BUILTIN_TEXT_FONT, 0);
    lv_label_set_text(wake_sound_title, "Wake sound");
    lv_obj_align(wake_sound_title, LV_ALIGN_LEFT_MID, 10, 0);

    settings_wake_sound_value_label_ = lv_label_create(wake_sound_row);
    lv_obj_set_width(settings_wake_sound_value_label_, row_width - 132);
    lv_obj_set_style_text_align(settings_wake_sound_value_label_, LV_TEXT_ALIGN_RIGHT, 0);
    lv_obj_set_style_text_color(settings_wake_sound_value_label_, Color(0x67e8f9), 0);
    lv_obj_set_style_text_font(settings_wake_sound_value_label_, &BUILTIN_TEXT_FONT, 0);
    lv_label_set_long_mode(settings_wake_sound_value_label_, LV_LABEL_LONG_DOT);
    lv_obj_align(settings_wake_sound_value_label_, LV_ALIGN_RIGHT_MID, -24, 0);

    auto* wake_sound_chevron = lv_label_create(wake_sound_row);
    lv_obj_set_style_text_color(wake_sound_chevron, Color(0x93a4b8), 0);
    lv_obj_set_style_text_font(wake_sound_chevron, &BUILTIN_TEXT_FONT, 0);
    lv_label_set_text(wake_sound_chevron, ">");
    lv_obj_align(wake_sound_chevron, LV_ALIGN_RIGHT_MID, -10, 0);

    auto* background_row = lv_obj_create(settings_root_);
    lv_obj_set_size(background_row, row_width, 34);
    ClearBoxStyle(background_row);
    lv_obj_set_style_radius(background_row, 8, 0);
    lv_obj_set_style_bg_color(background_row, Color(0x111827), 0);
    lv_obj_set_style_bg_opa(background_row, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(background_row, 1, 0);
    lv_obj_set_style_border_color(background_row, Color(0x273241), 0);
    lv_obj_add_flag(background_row, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(background_row, OnSettingsBackgroundClicked, LV_EVENT_CLICKED, this);
    lv_obj_align(background_row, LV_ALIGN_TOP_MID, 0, 102);

    auto* background_title = lv_label_create(background_row);
    lv_obj_set_style_text_color(background_title, Color(0xf8fafc), 0);
    lv_obj_set_style_text_font(background_title, &BUILTIN_TEXT_FONT, 0);
    lv_label_set_text(background_title, "Change background");
    lv_obj_align(background_title, LV_ALIGN_LEFT_MID, 10, -6);

    settings_background_value_label_ = lv_label_create(background_row);
    lv_obj_set_width(settings_background_value_label_, row_width - 48);
    lv_obj_set_style_text_align(settings_background_value_label_, LV_TEXT_ALIGN_LEFT, 0);
    lv_obj_set_style_text_color(settings_background_value_label_, Color(0x93a4b8), 0);
    lv_obj_set_style_text_font(settings_background_value_label_, &BUILTIN_TEXT_FONT, 0);
    lv_label_set_long_mode(settings_background_value_label_, LV_LABEL_LONG_DOT);
    lv_obj_align(settings_background_value_label_, LV_ALIGN_LEFT_MID, 10, 8);

    auto* chevron = lv_label_create(background_row);
    lv_obj_set_style_text_color(chevron, Color(0x93a4b8), 0);
    lv_obj_set_style_text_font(chevron, &BUILTIN_TEXT_FONT, 0);
    lv_label_set_text(chevron, ">");
    lv_obj_align(chevron, LV_ALIGN_RIGHT_MID, -10, 0);

    auto* text_color_row = lv_obj_create(settings_root_);
    lv_obj_set_size(text_color_row, row_width, 28);
    ClearBoxStyle(text_color_row);
    lv_obj_set_style_radius(text_color_row, 8, 0);
    lv_obj_set_style_bg_color(text_color_row, Color(0x111827), 0);
    lv_obj_set_style_bg_opa(text_color_row, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(text_color_row, 1, 0);
    lv_obj_set_style_border_color(text_color_row, Color(0x273241), 0);
    lv_obj_align(text_color_row, LV_ALIGN_TOP_MID, 0, 140);

    auto* text_color_title = lv_label_create(text_color_row);
    lv_obj_set_style_text_color(text_color_title, Color(0xf8fafc), 0);
    lv_obj_set_style_text_font(text_color_title, &BUILTIN_TEXT_FONT, 0);
    lv_label_set_text(text_color_title, "Font color");
    lv_obj_align(text_color_title, LV_ALIGN_LEFT_MID, 10, 0);

    settings_text_color_value_label_ = lv_label_create(text_color_row);
    lv_obj_set_width(settings_text_color_value_label_, row_width - 132);
    lv_obj_set_style_text_align(settings_text_color_value_label_, LV_TEXT_ALIGN_RIGHT, 0);
    lv_obj_set_style_text_color(settings_text_color_value_label_, Color(0x67e8f9), 0);
    lv_obj_set_style_text_font(settings_text_color_value_label_, &BUILTIN_TEXT_FONT, 0);
    lv_label_set_long_mode(settings_text_color_value_label_, LV_LABEL_LONG_DOT);
    lv_obj_align(settings_text_color_value_label_, LV_ALIGN_RIGHT_MID, -10, 0);

    RefreshSettingsPage();
}

void Ds02HomeDisplay::CreateBackgroundGalleryObjects() {
    if (root_ == nullptr) {
        return;
    }

    const int safe_width = width_ > 0 ? width_ : 320;
    const int safe_height = height_ > 0 ? height_ : 240;
    const int panel_width = Clamp(safe_width - 24, 216, 296);
    const int panel_height = Clamp(safe_height - 34, 178, 206);
    const int preview_width = panel_width - 20;
    const int preview_height = Clamp(panel_height - 70, 104, 142);

    background_gallery_overlay_ = lv_obj_create(root_);
    lv_obj_set_size(background_gallery_overlay_, LV_PCT(100), LV_PCT(100));
    ClearBoxStyle(background_gallery_overlay_);
    lv_obj_set_style_bg_color(background_gallery_overlay_, Color(0x000000), 0);
    lv_obj_set_style_bg_opa(background_gallery_overlay_, LV_OPA_70, 0);
    lv_obj_add_flag(background_gallery_overlay_, LV_OBJ_FLAG_HIDDEN);

    background_gallery_panel_ = lv_obj_create(background_gallery_overlay_);
    lv_obj_set_size(background_gallery_panel_, panel_width, panel_height);
    ClearBoxStyle(background_gallery_panel_);
    lv_obj_set_style_radius(background_gallery_panel_, 8, 0);
    lv_obj_set_style_bg_color(background_gallery_panel_, Color(0x070a10), 0);
    lv_obj_set_style_bg_opa(background_gallery_panel_, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(background_gallery_panel_, 1, 0);
    lv_obj_set_style_border_color(background_gallery_panel_, Color(0x263142), 0);
    lv_obj_set_style_shadow_width(background_gallery_panel_, 18, 0);
    lv_obj_set_style_shadow_color(background_gallery_panel_, Color(0x000000), 0);
    lv_obj_set_style_shadow_opa(background_gallery_panel_, LV_OPA_70, 0);
    lv_obj_center(background_gallery_panel_);

    auto* header = lv_label_create(background_gallery_panel_);
    lv_obj_set_style_text_color(header, Color(0xffffff), 0);
    lv_obj_set_style_text_font(header, &BUILTIN_TEXT_FONT, 0);
    lv_label_set_text(header, "Background");
    lv_obj_align(header, LV_ALIGN_TOP_LEFT, 10, 10);

    auto* close_button = lv_obj_create(background_gallery_panel_);
    lv_obj_set_size(close_button, 26, 26);
    ClearBoxStyle(close_button);
    lv_obj_set_style_radius(close_button, 6, 0);
    lv_obj_set_style_bg_color(close_button, Color(0x111827), 0);
    lv_obj_set_style_bg_opa(close_button, LV_OPA_TRANSP, 0);
    lv_obj_add_flag(close_button, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(close_button, OnBackgroundGalleryCloseClicked, LV_EVENT_CLICKED, this);
    lv_obj_align(close_button, LV_ALIGN_TOP_RIGHT, -6, 5);

    auto* close_label = lv_label_create(close_button);
    lv_obj_set_style_text_color(close_label, Color(0xd8dee8), 0);
    lv_obj_set_style_text_font(close_label, &BUILTIN_TEXT_FONT, 0);
    lv_label_set_text(close_label, "X");
    lv_obj_center(close_label);

    background_preview_box_ = lv_obj_create(background_gallery_panel_);
    lv_obj_set_size(background_preview_box_, preview_width, preview_height);
    ClearBoxStyle(background_preview_box_);
    lv_obj_set_style_radius(background_preview_box_, 6, 0);
    lv_obj_set_style_clip_corner(background_preview_box_, true, 0);
    lv_obj_set_style_bg_color(background_preview_box_, Color(0x111827), 0);
    lv_obj_set_style_bg_opa(background_preview_box_, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(background_preview_box_, 1, 0);
    lv_obj_set_style_border_color(background_preview_box_, Color(0x273241), 0);
    lv_obj_add_flag(background_preview_box_, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(background_preview_box_, OnBackgroundGalleryGesture, LV_EVENT_GESTURE, this);
    lv_obj_align(background_preview_box_, LV_ALIGN_TOP_MID, 0, 42);

    background_preview_image_obj_ = lv_image_create(background_preview_box_);
    lv_obj_add_flag(background_preview_image_obj_, LV_OBJ_FLAG_HIDDEN);
    lv_obj_center(background_preview_image_obj_);

    auto* prev_button = lv_obj_create(background_preview_box_);
    lv_obj_set_size(prev_button, 32, 32);
    ClearBoxStyle(prev_button);
    lv_obj_set_style_radius(prev_button, 999, 0);
    lv_obj_set_style_bg_color(prev_button, Color(0x000000), 0);
    lv_obj_set_style_bg_opa(prev_button, LV_OPA_50, 0);
    lv_obj_add_flag(prev_button, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(prev_button, OnBackgroundGalleryPrevClicked, LV_EVENT_CLICKED, this);
    lv_obj_align(prev_button, LV_ALIGN_LEFT_MID, 8, 0);

    auto* prev_label = lv_label_create(prev_button);
    lv_obj_set_style_text_color(prev_label, Color(0xffffff), 0);
    lv_obj_set_style_text_font(prev_label, &BUILTIN_TEXT_FONT, 0);
    lv_label_set_text(prev_label, "<");
    lv_obj_center(prev_label);

    auto* next_button = lv_obj_create(background_preview_box_);
    lv_obj_set_size(next_button, 32, 32);
    ClearBoxStyle(next_button);
    lv_obj_set_style_radius(next_button, 999, 0);
    lv_obj_set_style_bg_color(next_button, Color(0x000000), 0);
    lv_obj_set_style_bg_opa(next_button, LV_OPA_50, 0);
    lv_obj_add_flag(next_button, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(next_button, OnBackgroundGalleryNextClicked, LV_EVENT_CLICKED, this);
    lv_obj_align(next_button, LV_ALIGN_RIGHT_MID, -8, 0);

    auto* next_label = lv_label_create(next_button);
    lv_obj_set_style_text_color(next_label, Color(0xffffff), 0);
    lv_obj_set_style_text_font(next_label, &BUILTIN_TEXT_FONT, 0);
    lv_label_set_text(next_label, ">");
    lv_obj_center(next_label);

    background_title_label_ = lv_label_create(background_gallery_panel_);
    lv_obj_set_width(background_title_label_, panel_width - 20);
    lv_obj_set_style_text_color(background_title_label_, Color(0xe5edf7), 0);
    lv_obj_set_style_text_font(background_title_label_, &BUILTIN_TEXT_FONT, 0);
    lv_label_set_long_mode(background_title_label_, LV_LABEL_LONG_DOT);
    lv_obj_align(background_title_label_, LV_ALIGN_BOTTOM_LEFT, 10, -22);

    background_counter_label_ = lv_label_create(background_gallery_panel_);
    lv_obj_set_style_text_color(background_counter_label_, Color(0x64748b), 0);
    lv_obj_set_style_text_font(background_counter_label_, &BUILTIN_TEXT_FONT, 0);
    lv_obj_align(background_counter_label_, LV_ALIGN_BOTTOM_LEFT, 10, -7);

    RefreshBackgroundGallery();
}

void Ds02HomeDisplay::CreateDockObjects() {
    const int safe_width = width_ > 0 ? width_ : 320;
    const int dock_width = Clamp(safe_width - 28, 220, 292);
    const int button_width = std::max(24, (dock_width - 14) / static_cast<int>(dock_buttons_.size()));

    dock_ = lv_obj_create(launcher_layer_);
    lv_obj_set_size(dock_, dock_width, kDockHeight);
    lv_obj_set_style_radius(dock_, 10, 0);
    lv_obj_set_style_bg_color(dock_, Color(0x080e16), 0);
    lv_obj_set_style_bg_grad_color(dock_, Color(0x1f2b39), 0);
    lv_obj_set_style_bg_grad_dir(dock_, LV_GRAD_DIR_VER, 0);
    lv_obj_set_style_bg_opa(dock_, LV_OPA_60, 0);
    lv_obj_set_style_border_width(dock_, 1, 0);
    lv_obj_set_style_border_color(dock_, Color(0xb9e6ff), 0);
    lv_obj_set_style_border_opa(dock_, LV_OPA_20, 0);
    lv_obj_set_style_shadow_width(dock_, 8, 0);
    lv_obj_set_style_shadow_color(dock_, Color(0x000000), 0);
    lv_obj_set_style_shadow_opa(dock_, LV_OPA_50, 0);
    lv_obj_set_style_pad_left(dock_, 5, 0);
    lv_obj_set_style_pad_right(dock_, 5, 0);
    lv_obj_set_style_pad_top(dock_, 4, 0);
    lv_obj_set_style_pad_bottom(dock_, 4, 0);
    lv_obj_set_style_pad_column(dock_, 1, 0);
    lv_obj_set_flex_flow(dock_, LV_FLEX_FLOW_ROW);
    lv_obj_set_flex_align(dock_, LV_FLEX_ALIGN_SPACE_BETWEEN, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_clear_flag(dock_, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_align(dock_, LV_ALIGN_BOTTOM_MID, 0, -kDockBottomMargin);

    for (size_t i = 0; i < dock_buttons_.size(); ++i) {
        auto* button = lv_obj_create(dock_);
        dock_buttons_[i] = button;
        lv_obj_set_size(button, button_width, kDockHeight - 10);
        ClearBoxStyle(button);
        lv_obj_set_style_radius(button, 6, 0);
        lv_obj_set_style_border_width(button, 1, 0);
        lv_obj_set_style_border_color(button, Color(0x000000), 0);
        lv_obj_set_style_border_opa(button, LV_OPA_TRANSP, 0);
        lv_obj_add_flag(button, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_add_event_cb(button, OnDockButtonClicked, LV_EVENT_CLICKED, this);

        auto* icon = lv_label_create(button);
        dock_icon_labels_[i] = icon;
        lv_obj_set_style_text_align(icon, LV_TEXT_ALIGN_CENTER, 0);
        lv_obj_set_style_text_font(icon, kDockUsesIconFont ? &BUILTIN_ICON_FONT : &BUILTIN_TEXT_FONT, 0);
        lv_label_set_text(icon, kDockItems[i].icon);
        lv_obj_center(icon);
    }
}

void Ds02HomeDisplay::SetPowerSaveMode(bool on) {
    standby_state_ = on ? StandbyState::Dim : StandbyState::Awake;
    DisplayLockGuard lock(this);
    ApplyStandbyState();
}

void Ds02HomeDisplay::SetStatus(const char* status) {
    if (status == nullptr) {
        return;
    }

    if (TextEquals(status, Lang::Strings::CONNECTING)) {
        {
            DisplayLockGuard lock(this);
            SetProfileAvatarSpeaking(false);
        }
        WakeFromWakeWord();
        return;
    }

    if (TextEquals(status, Lang::Strings::LISTENING)) {
        DisplayLockGuard lock(this);
        standby_state_ = StandbyState::Launcher;
        active_dock_index_ = kProfileDockIndex;
        ApplyDockSelection();
        ApplyStandbyState();
        SetProfileAvatarSpeaking(false);
        return;
    }

    if (TextEquals(status, Lang::Strings::SPEAKING)) {
        DisplayLockGuard lock(this);
        SetProfileAvatarSpeaking(false);
        return;
    }

    if (TextEquals(status, Lang::Strings::STANDBY)) {
        DisplayLockGuard lock(this);
        SetProfileAvatarSpeaking(false);
    }

    Display::SetStatus(status);
}

void Ds02HomeDisplay::ShowDimStandby() {
    standby_state_ = StandbyState::Dim;
    DisplayLockGuard lock(this);
    ApplyStandbyState();
}

void Ds02HomeDisplay::ShowAwakeStandby() {
    standby_state_ = StandbyState::Awake;
    DisplayLockGuard lock(this);
    ApplyStandbyState();
}

void Ds02HomeDisplay::ShowPureBlack() {
    ShowLauncher();
}

void Ds02HomeDisplay::ShowLauncher() {
    standby_state_ = StandbyState::Launcher;
    DisplayLockGuard lock(this);
    ApplyStandbyState();
}

void Ds02HomeDisplay::AdvanceStandbyButtonState() {
    if (standby_state_ == StandbyState::Dim) {
        standby_state_ = StandbyState::Awake;
    } else if (standby_state_ == StandbyState::Awake) {
        standby_state_ = StandbyState::Launcher;
    } else {
        standby_state_ = StandbyState::Dim;
    }
    DisplayLockGuard lock(this);
    ApplyStandbyState();
}

void Ds02HomeDisplay::WakeFromWakeWord(const char* wake_word) {
    (void)wake_word;
    standby_state_ = StandbyState::Launcher;
    active_dock_index_ = kProfileDockIndex;
    DisplayLockGuard lock(this);
    ApplyDockSelection();
    ApplyStandbyState();
}

void Ds02HomeDisplay::SetProfileVoiceActive(bool active) {
    DisplayLockGuard lock(this);
    SetProfileAvatarSpeaking(active && standby_state_ == StandbyState::Launcher &&
                             active_dock_index_ == kProfileDockIndex);
}

void Ds02HomeDisplay::ApplyStandbyState() {
    if (root_ == nullptr || standby_layer_ == nullptr || launcher_layer_ == nullptr || dim_overlay_ == nullptr) {
        return;
    }

    lv_obj_clear_flag(root_, LV_OBJ_FLAG_HIDDEN);
    const bool launcher_visible = standby_state_ == StandbyState::Launcher;
    SetVisible(standby_layer_, !launcher_visible);
    SetVisible(launcher_layer_, launcher_visible);

    if (!launcher_visible) {
        SetProfileAvatarSpeaking(false);
        CloseBackgroundGallery();
    }

    if (launcher_visible) {
        RefreshLauncherPage();
        return;
    }

    if (standby_state_ == StandbyState::Dim) {
        lv_obj_set_style_bg_opa(dim_overlay_, LV_OPA_60, 0);
    } else {
        lv_obj_set_style_bg_opa(dim_overlay_, LV_OPA_TRANSP, 0);
    }
}

void Ds02HomeDisplay::UpdateStatusBar(bool update_all) {
    (void)update_all;
    DisplayLockGuard lock(this);
    RefreshHomeData();
}

void Ds02HomeDisplay::RefreshHomeData() {
    RefreshClock();
    RefreshNetwork();
    RefreshBattery();
    RefreshBluetooth();
    if (standby_state_ == StandbyState::Launcher) {
        RefreshCalendar();
    }
}

void Ds02HomeDisplay::RefreshClock() {
    struct tm local_time = {};
    if (!GetLocalTime(local_time)) {
        SetCachedText(time_label_, cached_time_, "--:--");
        SetCachedText(date_label_, cached_date_, "");
        return;
    }

    SetCachedText(time_label_, cached_time_, FormatTime(local_time));

    std::string lunar_suffix;
    if (lunar_date_provider_) {
        lunar_suffix = lunar_date_provider_(local_time);
    }
    SetCachedText(date_label_, cached_date_, FormatDateLine(local_time, lunar_suffix));
}

void Ds02HomeDisplay::RefreshNetwork() {
    const char* icon = Board::GetInstance().GetNetworkStateIcon();
    SetCachedText(wifi_label_, cached_wifi_, icon != nullptr ? icon : "");
    if (wifi_label_ != nullptr) {
        lv_obj_set_style_text_color(wifi_label_, NetworkStatusColor(icon), 0);
    }
}

void Ds02HomeDisplay::RefreshBattery() {
    int level = 0;
    bool charging = false;
    bool discharging = false;
    if (!Board::GetInstance().GetBatteryLevel(level, charging, discharging)) {
        SetCachedText(battery_label_ds02_, cached_battery_, "");
        UpdateBatteryIcon(0, false, false);
        UpdateLowBatteryNotification(100, false, false);
        return;
    }

    level = std::max(0, std::min(level, 100));
    char text[32];
    std::snprintf(text, sizeof(text), charging ? "%d+" : "%d", level);
    SetCachedText(battery_label_ds02_, cached_battery_, text);
    if (battery_label_ds02_ != nullptr) {
        lv_obj_set_style_text_color(battery_label_ds02_, BatteryStatusColor(level, charging), 0);
    }
    UpdateBatteryIcon(level, charging, true);
    UpdateLowBatteryNotification(level, charging, discharging);
}

void Ds02HomeDisplay::UpdateBatteryIcon(int level, bool charging, bool available) {
    if (battery_icon_root_ == nullptr) {
        return;
    }

    SetVisible(battery_icon_root_, available);
    if (!available) {
        return;
    }

    level = Clamp(level, 0, 100);
    const lv_color_t tone = BatteryStatusColor(level, charging);
    if (battery_icon_body_ != nullptr) {
        lv_obj_set_style_border_color(battery_icon_body_, tone, 0);
    }
    if (battery_icon_nub_ != nullptr) {
        lv_obj_set_style_bg_color(battery_icon_nub_, tone, 0);
    }
    if (battery_icon_fill_ != nullptr) {
        lv_obj_set_style_bg_color(battery_icon_fill_, tone, 0);
        SetVisible(battery_icon_fill_, level > 0);
        if (level > 0) {
            lv_obj_set_width(battery_icon_fill_, Clamp(level * 10 / 100, 1, 10));
        }
    }
}

void Ds02HomeDisplay::RefreshBluetooth() {
    if (!bluetooth_provider_) {
        SetCachedText(bluetooth_label_, cached_bluetooth_, "");
        if (bluetooth_label_ != nullptr) {
            lv_obj_set_style_text_color(bluetooth_label_, Color(0x4b5563), 0);
        }
        return;
    }

    auto state = bluetooth_provider_();
    if (!state.available) {
        SetCachedText(bluetooth_label_, cached_bluetooth_, "");
        if (bluetooth_label_ != nullptr) {
            lv_obj_set_style_text_color(bluetooth_label_, Color(0x4b5563), 0);
        }
        return;
    }

    SetCachedText(bluetooth_label_, cached_bluetooth_, state.connected ? "BT" : "BTx");
    if (bluetooth_label_ != nullptr) {
        lv_obj_set_style_text_color(bluetooth_label_, state.connected ? Color(0x60a5fa) : Color(0x8f98a3), 0);
    }
}

void Ds02HomeDisplay::UpdateLowBatteryNotification(int level, bool charging, bool discharging) {
    if (low_battery_pill_ == nullptr) {
        return;
    }

    const bool visible = level <= kLowBatteryThreshold && !charging && discharging;
    if (visible) {
        char text[32];
        std::snprintf(text, sizeof(text), "Pin yếu %d%%", std::max(0, std::min(level, 100)));
        SetCachedText(low_battery_pill_label_, cached_low_battery_text_, text);
    }

    if (low_battery_pill_visible_ == visible) {
        return;
    }

    low_battery_pill_visible_ = visible;
    SetVisible(low_battery_pill_, visible);
}

void Ds02HomeDisplay::RefreshCalendar(bool force) {
    struct tm local_time = {};
    if (!GetLocalTime(local_time)) {
        SetCachedText(calendar_month_label_, cached_calendar_title_, "");
        for (size_t i = 0; i < calendar_day_labels_.size(); ++i) {
            SetCachedText(calendar_day_labels_[i], cached_calendar_day_text_[i], "");
            if (calendar_day_cells_[i] != nullptr) {
                lv_obj_set_style_bg_opa(calendar_day_cells_[i], LV_OPA_TRANSP, 0);
            }
        }
        calendar_year_ = -1;
        calendar_month_ = -1;
        calendar_today_ = -1;
        return;
    }

    const int year = local_time.tm_year + 1900;
    const int month = local_time.tm_mon;
    const int today = local_time.tm_mday;
    if (!force && year == calendar_year_ && month == calendar_month_ && today == calendar_today_) {
        return;
    }

    calendar_year_ = year;
    calendar_month_ = month;
    calendar_today_ = today;
    SetCachedText(calendar_month_label_, cached_calendar_title_, FormatCalendarTitle(local_time));

    struct tm first_day = {};
    first_day.tm_year = year - 1900;
    first_day.tm_mon = month;
    first_day.tm_mday = 1;
    first_day.tm_isdst = -1;
    std::mktime(&first_day);

    const int first_weekday = first_day.tm_wday;
    const int days_in_month = DaysInMonth(year, month);
    for (size_t i = 0; i < calendar_day_labels_.size(); ++i) {
        const int day = static_cast<int>(i) - first_weekday + 1;
        const bool in_month = day >= 1 && day <= days_in_month;
        const bool is_today = in_month && day == today;

        char text[4] = {};
        if (in_month) {
            std::snprintf(text, sizeof(text), "%d", day);
        }
        SetCachedText(calendar_day_labels_[i], cached_calendar_day_text_[i], in_month ? text : "");

        if (calendar_day_cells_[i] == nullptr || calendar_day_labels_[i] == nullptr) {
            continue;
        }

        lv_obj_set_style_radius(calendar_day_cells_[i], 6, 0);
        if (is_today) {
            lv_obj_set_style_bg_color(calendar_day_cells_[i], Color(0xffffff), 0);
            lv_obj_set_style_bg_opa(calendar_day_cells_[i], LV_OPA_COVER, 0);
            lv_obj_set_style_text_color(calendar_day_labels_[i], Color(0x000000), 0);
        } else {
            lv_obj_set_style_bg_opa(calendar_day_cells_[i], LV_OPA_TRANSP, 0);
            lv_obj_set_style_text_color(calendar_day_labels_[i],
                                        in_month ? Color(text_color_) : Color(DimColor(text_color_, 35)), 0);
        }
    }
}

void Ds02HomeDisplay::RefreshSettingsPage() {
    if (background_index_ >= kBackgroundItems.size()) {
        background_index_ = 0;
    }
    SetCachedText(settings_wake_sound_value_label_, cached_settings_wake_sound_,
                  WakeSoundSettings::Label(WakeSoundSettings::LoadIndex()));
    SetCachedText(settings_background_value_label_, cached_settings_background_,
                  kBackgroundItems[background_index_].title);
    char color_text[10];
    std::snprintf(color_text, sizeof(color_text), "#%06lX", static_cast<unsigned long>(text_color_ & 0xffffff));
    SetCachedText(settings_text_color_value_label_, cached_settings_text_color_, color_text);
}

void Ds02HomeDisplay::RefreshBackgroundGallery() {
    if (background_index_ >= kBackgroundItems.size()) {
        background_index_ = 0;
    }

    auto* image = GetBackgroundImage(background_index_);
    ApplyCoverImage(background_preview_box_, background_preview_image_obj_,
                    image != nullptr ? image->image_dsc() : nullptr, 276, 136);

    const auto& background = kBackgroundItems[background_index_];
    SetCachedText(background_title_label_, cached_background_title_, background.title);

    char counter[16];
    std::snprintf(counter, sizeof(counter), "%u/%u",
                  static_cast<unsigned>(background_index_ + 1),
                  static_cast<unsigned>(kBackgroundItems.size()));
    SetCachedText(background_counter_label_, cached_background_counter_, counter);
    RefreshSettingsPage();
}

void Ds02HomeDisplay::RefreshLauncherPage(bool force) {
    const bool calendar_active = active_dock_index_ == 0;
    const bool profile_active = active_dock_index_ == kProfileDockIndex;
    const bool settings_active = active_dock_index_ == kSettingsDockIndex;
    SetVisible(calendar_root_, calendar_active);
    SetVisible(profile_avatar_root_, profile_active);
    SetVisible(settings_root_, settings_active);
    SetVisible(launcher_title_label_, !calendar_active && !profile_active && !settings_active);
    SetVisible(launcher_body_label_, !calendar_active && !profile_active && !settings_active);

    if (calendar_active) {
        RefreshCalendar(force);
        return;
    }

    if (profile_active) {
        ApplyProfileAvatarPulse(profile_avatar_pulse_);
        return;
    }

    if (settings_active) {
        RefreshSettingsPage();
        return;
    }

    if (active_dock_index_ >= kDockItems.size()) {
        return;
    }

    SetCachedText(launcher_title_label_, cached_launcher_title_, kDockItems[active_dock_index_].title);
    SetCachedText(launcher_body_label_, cached_launcher_body_, kDockItems[active_dock_index_].body);
}

void Ds02HomeDisplay::SelectDockItem(size_t index) {
    if (index >= dock_buttons_.size() || active_dock_index_ == index) {
        return;
    }
    if (index != kSettingsDockIndex) {
        CloseBackgroundGallery();
    }
    active_dock_index_ = index;
    ApplyDockSelection();
    RefreshLauncherPage(true);
}

void Ds02HomeDisplay::ApplyDockSelection() {
    for (size_t i = 0; i < dock_buttons_.size(); ++i) {
        auto* button = dock_buttons_[i];
        auto* label = dock_icon_labels_[i];
        if (button == nullptr || label == nullptr) {
            continue;
        }

        const bool active = i == active_dock_index_;
        lv_obj_set_style_bg_color(button, active ? Color(0x0e3346) : Color(0x000000), 0);
        lv_obj_set_style_bg_opa(button, active ? LV_OPA_60 : LV_OPA_TRANSP, 0);
        lv_obj_set_style_border_color(button, active ? Color(0x67e8f9) : Color(0x000000), 0);
        lv_obj_set_style_border_opa(button, active ? LV_OPA_30 : LV_OPA_TRANSP, 0);
        lv_obj_set_style_shadow_width(button, active ? 5 : 0, 0);
        lv_obj_set_style_shadow_color(button, Color(0x0ea5e9), 0);
        lv_obj_set_style_shadow_opa(button, active ? LV_OPA_20 : LV_OPA_TRANSP, 0);
        lv_obj_set_style_text_color(label, active ? Color(0x67e8f9) : Color(0xb8c3cf), 0);
    }
}

void Ds02HomeDisplay::ApplyNextWakeSound() {
    const int next_index = WakeSoundSettings::NextIndex(WakeSoundSettings::LoadIndex());
    WakeSoundSettings::SaveIndex(next_index);
    SetCachedText(settings_wake_sound_value_label_, cached_settings_wake_sound_,
                  WakeSoundSettings::Label(next_index));

    Application::GetInstance().Schedule([]() {
        Application::GetInstance().Reboot();
    });
}

void Ds02HomeDisplay::OpenBackgroundGallery() {
    if (background_gallery_overlay_ == nullptr) {
        return;
    }
    RefreshBackgroundGallery();
    lv_obj_move_foreground(background_gallery_overlay_);
    SetVisible(background_gallery_overlay_, true);
}

void Ds02HomeDisplay::CloseBackgroundGallery() {
    if (background_index_ != persisted_background_index_) {
        PersistBackgroundIndex();
    }
    SetVisible(background_gallery_overlay_, false);
}

void Ds02HomeDisplay::MoveBackground(int direction) {
    if (kBackgroundItems.empty()) {
        return;
    }

    const int count = static_cast<int>(kBackgroundItems.size());
    int next = static_cast<int>(background_index_);
    for (int i = 0; i < count; ++i) {
        next += direction;
        while (next < 0) {
            next += count;
        }
        next %= count;

        if (GetBackgroundImage(static_cast<size_t>(next)) != nullptr) {
            (void)ApplyBackgroundIndex(static_cast<size_t>(next));
            return;
        }
    }
}

bool Ds02HomeDisplay::SetBackgroundIndex(size_t index, bool persist) {
    DisplayLockGuard lock(this);
    if (!ApplyBackgroundIndex(index)) {
        return false;
    }
    if (persist) {
        PersistBackgroundIndex();
    }
    return true;
}

bool Ds02HomeDisplay::SetBackgroundByName(const std::string& name, bool persist) {
    const auto requested = NormalizeBackgroundKey(name);
    if (requested.empty()) {
        return false;
    }

    for (size_t i = 0; i < kBackgroundItems.size(); ++i) {
        const auto title = NormalizeBackgroundKey(kBackgroundItems[i].title);
        const auto file = NormalizeBackgroundKey(kBackgroundItems[i].file);
        if (requested == title || requested == file) {
            return SetBackgroundIndex(i, persist);
        }
    }
    return false;
}

size_t Ds02HomeDisplay::GetBackgroundCount() const {
    return kBackgroundItems.size();
}

const char* Ds02HomeDisplay::GetBackgroundTitle(size_t index) const {
    return index < kBackgroundItems.size() ? kBackgroundItems[index].title : "";
}

const char* Ds02HomeDisplay::GetBackgroundFile(size_t index) const {
    return index < kBackgroundItems.size() ? kBackgroundItems[index].file : "";
}

bool Ds02HomeDisplay::ApplyBackgroundIndex(size_t index) {
    if (index >= kBackgroundItems.size()) {
        return false;
    }

    auto* image = GetBackgroundImage(index);
    if (image == nullptr || image->image_dsc() == nullptr) {
        ESP_LOGW(TAG, "Background asset %s is unavailable", kBackgroundItems[index].file);
        return false;
    }

    background_index_ = index;
    wallpaper_image_.reset();
    wallpaper_override_active_ = true;

    if (wallpaper_ != nullptr) {
        ApplyCoverImage(wallpaper_, wallpaper_image_obj_, image->image_dsc(),
                        width_ > 0 ? width_ : 320, height_ > 0 ? height_ : 240);
    }
    if (kBackgroundItems.size() > 1) {
        const size_t next = (background_index_ + 1) % kBackgroundItems.size();
        const size_t prev = (background_index_ + kBackgroundItems.size() - 1) % kBackgroundItems.size();
        (void)GetBackgroundImage(next);
        (void)GetBackgroundImage(prev);
    }
    RefreshBackgroundGallery();
    return true;
}

void Ds02HomeDisplay::PersistBackgroundIndex() {
    Settings settings("display", true);
    settings.SetInt("ds02_background", static_cast<int32_t>(background_index_));
    persisted_background_index_ = background_index_;
}

LvglImage* Ds02HomeDisplay::GetBackgroundImage(size_t index) {
    if (index >= kBackgroundItems.size() || index >= background_image_cache_.size()) {
        return nullptr;
    }

    if (background_image_cache_[index] != nullptr) {
        return background_image_cache_[index].get();
    }
    if (background_load_failed_[index]) {
        return nullptr;
    }

    void* ptr = nullptr;
    size_t size = 0;
    const auto& background = kBackgroundItems[index];
    if (!GetBackgroundAssetData(background.file, ptr, size)) {
        background_load_failed_[index] = true;
        ESP_LOGW(TAG, "Background asset %s is not found", background.file);
        return nullptr;
    }

    auto image = CreateBackgroundImage(ptr, size);
    if (image == nullptr || image->image_dsc() == nullptr) {
        background_load_failed_[index] = true;
        ESP_LOGW(TAG, "Background asset %s could not be decoded", background.file);
        return nullptr;
    }

    background_image_cache_[index] = std::move(image);
    return background_image_cache_[index].get();
}

void Ds02HomeDisplay::SetTextColor(uint32_t color, bool persist) {
    color &= 0xffffff;
    DisplayLockGuard lock(this);
    text_color_ = color;
    if (persist) {
        Settings settings("display", true);
        settings.SetInt("ds02_text_color", static_cast<int32_t>(text_color_));
    }
    ApplyTextColor();
}

void Ds02HomeDisplay::ApplyTextColor() {
    const lv_color_t primary = Color(text_color_);
    const lv_color_t muted = Color(DimColor(text_color_, 72));
    const lv_color_t faint = Color(DimColor(text_color_, 45));

    ApplyTextColorToObjectTree(standby_layer_, primary);
    ApplyTextColorToObjectTree(launcher_layer_, primary);
    ApplyTextColorToObjectTree(background_gallery_overlay_, primary);

    if (date_label_ != nullptr) {
        lv_obj_set_style_text_color(date_label_, muted, 0);
    }
    if (launcher_body_label_ != nullptr) {
        lv_obj_set_style_text_color(launcher_body_label_, muted, 0);
    }
    if (background_counter_label_ != nullptr) {
        lv_obj_set_style_text_color(background_counter_label_, faint, 0);
    }
    for (auto* label : calendar_weekday_labels_) {
        if (label != nullptr) {
            lv_obj_set_style_text_color(label, faint, 0);
        }
    }

    RefreshSettingsPage();
    RefreshCalendar(true);
    RefreshNetwork();
    RefreshBattery();
    RefreshBluetooth();
    ApplyDockSelection();
}

void Ds02HomeDisplay::ApplyTextColorToObjectTree(lv_obj_t* obj, lv_color_t color) {
    if (obj == nullptr) {
        return;
    }

    lv_obj_set_style_text_color(obj, color, 0);
    const uint32_t child_count = lv_obj_get_child_cnt(obj);
    for (uint32_t i = 0; i < child_count; ++i) {
        ApplyTextColorToObjectTree(lv_obj_get_child(obj, i), color);
    }
}

void Ds02HomeDisplay::SetProfileAvatarSpeaking(bool speaking) {
    if (profile_avatar_speaking_ == speaking) {
        return;
    }

    profile_avatar_speaking_ = speaking;
    if (speaking) {
        profile_avatar_pulse_ = 0;
        profile_avatar_pulse_dir_ = 1;
        if (profile_avatar_timer_ != nullptr && !profile_avatar_timer_running_) {
            if (esp_timer_start_periodic(profile_avatar_timer_, kProfileAvatarIntervalUs) == ESP_OK) {
                profile_avatar_timer_running_ = true;
            }
        }
    } else {
        if (profile_avatar_timer_ != nullptr && profile_avatar_timer_running_) {
            esp_timer_stop(profile_avatar_timer_);
            profile_avatar_timer_running_ = false;
        }
        profile_avatar_pulse_ = 0;
        profile_avatar_pulse_dir_ = 1;
    }

    ApplyProfileAvatarPulse(profile_avatar_pulse_);
}

void Ds02HomeDisplay::ApplyProfileAvatarPulse(int value) {
    if (profile_avatar_sphere_ == nullptr || profile_avatar_base_size_ <= 0) {
        return;
    }

    value = Clamp(value, 0, 100);
    const int bump = profile_avatar_speaking_ ? (profile_avatar_base_size_ * value) / 1200 : 0;
    const int sphere_size = profile_avatar_base_size_ + bump;
    const int rise = profile_avatar_speaking_ ? bump / 2 : 0;

    lv_obj_set_size(profile_avatar_sphere_, sphere_size, sphere_size);
    lv_obj_align(profile_avatar_sphere_, LV_ALIGN_CENTER, 0, -rise);

    if (profile_avatar_shadow_ != nullptr) {
        lv_obj_set_size(profile_avatar_shadow_, sphere_size, sphere_size);
        lv_obj_align(profile_avatar_shadow_, LV_ALIGN_CENTER, 0, -rise / 2);
    }
}

void Ds02HomeDisplay::SetBluetoothStateProvider(Ds02BluetoothStateProvider provider) {
    bluetooth_provider_ = std::move(provider);
}

void Ds02HomeDisplay::SetLunarDateProvider(Ds02LunarDateProvider provider) {
    lunar_date_provider_ = std::move(provider);
}

void Ds02HomeDisplay::SetWallpaper(std::unique_ptr<LvglImage> image) {
    DisplayLockGuard lock(this);
    wallpaper_image_ = std::move(image);
    wallpaper_override_active_ = wallpaper_image_ != nullptr;
    if (wallpaper_ == nullptr) {
        return;
    }

    if (wallpaper_image_ == nullptr) {
        ApplyCoverImage(wallpaper_, wallpaper_image_obj_, nullptr,
                        width_ > 0 ? width_ : 320, height_ > 0 ? height_ : 240);
        return;
    }

    ApplyCoverImage(wallpaper_, wallpaper_image_obj_, wallpaper_image_->image_dsc(),
                    width_ > 0 ? width_ : 320, height_ > 0 ? height_ : 240);
}

void Ds02HomeDisplay::SetTheme(Theme* theme) {
    if (theme == nullptr) {
        return;
    }

    DisplayLockGuard lock(this);
    auto* lvgl_theme = dynamic_cast<LvglTheme*>(theme);
    if (lvgl_theme != nullptr && wallpaper_ != nullptr && !wallpaper_override_active_) {
        auto background = lvgl_theme->background_image();
        if (background != nullptr) {
            ApplyCoverImage(wallpaper_, wallpaper_image_obj_, background->image_dsc(),
                            width_ > 0 ? width_ : 320, height_ > 0 ? height_ : 240);
        } else {
            ApplyCoverImage(wallpaper_, wallpaper_image_obj_, nullptr,
                            width_ > 0 ? width_ : 320, height_ > 0 ? height_ : 240);
        }
    }
    Display::SetTheme(theme);
}

void Ds02HomeDisplay::SetChatMessage(const char* role, const char* content) {
    (void)role;
    (void)content;
}

void Ds02HomeDisplay::SetEmotion(const char* emotion) {
    (void)emotion;
}

void Ds02HomeDisplay::OnRefreshTimer(void* arg) {
    auto* display = static_cast<Ds02HomeDisplay*>(arg);
    if (display == nullptr) {
        return;
    }
    DisplayLockGuard lock(display);
    display->RefreshHomeData();
}

void Ds02HomeDisplay::OnProfileAvatarTimer(void* arg) {
    auto* display = static_cast<Ds02HomeDisplay*>(arg);
    if (display == nullptr) {
        return;
    }

    DisplayLockGuard lock(display);
    if (!display->profile_avatar_speaking_) {
        return;
    }

    display->profile_avatar_pulse_ += 28 * display->profile_avatar_pulse_dir_;
    if (display->profile_avatar_pulse_ >= 100) {
        display->profile_avatar_pulse_ = 100;
        display->profile_avatar_pulse_dir_ = -1;
    } else if (display->profile_avatar_pulse_ <= 0) {
        display->profile_avatar_pulse_ = 0;
        display->profile_avatar_pulse_dir_ = 1;
    }
    display->ApplyProfileAvatarPulse(display->profile_avatar_pulse_);
}

void Ds02HomeDisplay::OnDockButtonClicked(lv_event_t* event) {
    auto* display = static_cast<Ds02HomeDisplay*>(lv_event_get_user_data(event));
    if (display == nullptr) {
        return;
    }

    auto* target = static_cast<lv_obj_t*>(lv_event_get_target(event));
    for (size_t i = 0; i < display->dock_buttons_.size(); ++i) {
        if (display->dock_buttons_[i] == target) {
            display->SelectDockItem(i);
            return;
        }
    }
}

void Ds02HomeDisplay::OnSettingsWakeSoundClicked(lv_event_t* event) {
    auto* display = static_cast<Ds02HomeDisplay*>(lv_event_get_user_data(event));
    if (display == nullptr) {
        return;
    }
    display->ApplyNextWakeSound();
}

void Ds02HomeDisplay::OnSettingsBackgroundClicked(lv_event_t* event) {
    auto* display = static_cast<Ds02HomeDisplay*>(lv_event_get_user_data(event));
    if (display == nullptr) {
        return;
    }
    display->OpenBackgroundGallery();
}

void Ds02HomeDisplay::OnBackgroundGalleryPrevClicked(lv_event_t* event) {
    auto* display = static_cast<Ds02HomeDisplay*>(lv_event_get_user_data(event));
    if (display == nullptr) {
        return;
    }
    display->MoveBackground(-1);
}

void Ds02HomeDisplay::OnBackgroundGalleryNextClicked(lv_event_t* event) {
    auto* display = static_cast<Ds02HomeDisplay*>(lv_event_get_user_data(event));
    if (display == nullptr) {
        return;
    }
    display->MoveBackground(1);
}

void Ds02HomeDisplay::OnBackgroundGalleryCloseClicked(lv_event_t* event) {
    auto* display = static_cast<Ds02HomeDisplay*>(lv_event_get_user_data(event));
    if (display == nullptr) {
        return;
    }
    display->CloseBackgroundGallery();
}

void Ds02HomeDisplay::OnBackgroundGalleryGesture(lv_event_t* event) {
    auto* display = static_cast<Ds02HomeDisplay*>(lv_event_get_user_data(event));
    if (display == nullptr) {
        return;
    }

    auto* indev = lv_indev_active();
    if (indev == nullptr) {
        return;
    }

    const auto direction = lv_indev_get_gesture_dir(indev);
    if (direction == LV_DIR_LEFT) {
        display->MoveBackground(1);
    } else if (direction == LV_DIR_RIGHT) {
        display->MoveBackground(-1);
    }
}

bool Ds02HomeDisplay::GetLocalTime(struct tm& local_time) {
    std::time_t now = std::time(nullptr);
    if (now <= 0) {
        return false;
    }
    localtime_r(&now, &local_time);
    return local_time.tm_year >= kValidYearBase;
}

bool Ds02HomeDisplay::IsLeapYear(int year) {
    return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
}

int Ds02HomeDisplay::DaysInMonth(int year, int month) {
    static constexpr std::array<int, 12> kDays = {{
        31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31
    }};
    if (month < 0 || month >= static_cast<int>(kDays.size())) {
        return 30;
    }
    if (month == 1 && IsLeapYear(year)) {
        return 29;
    }
    return kDays[month];
}

std::string Ds02HomeDisplay::FormatTime(const struct tm& local_time) {
    char buffer[8];
    std::snprintf(buffer, sizeof(buffer), "%02d:%02d", local_time.tm_hour, local_time.tm_min);
    return buffer;
}

std::string Ds02HomeDisplay::FormatDateLine(const struct tm& local_time, const std::string& lunar_suffix) {
    static constexpr const char* kWeekdays[] = {
        "CN", "Thu 2", "Thu 3", "Thu 4", "Thu 5", "Thu 6", "Thu 7"
    };

    char buffer[48];
    std::snprintf(buffer, sizeof(buffer), "%s, %d thg %d",
                  kWeekdays[local_time.tm_wday],
                  local_time.tm_mday,
                  local_time.tm_mon + 1);

    if (lunar_suffix.empty()) {
        return buffer;
    }
    return std::string(buffer) + " - " + lunar_suffix;
}

std::string Ds02HomeDisplay::FormatCalendarTitle(const struct tm& local_time) {
    static constexpr std::array<const char*, 12> kMonths = {{
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    }};

    const int month = local_time.tm_mon;
    const char* name = month >= 0 && month < static_cast<int>(kMonths.size()) ? kMonths[month] : "Month";
    char buffer[24];
    std::snprintf(buffer, sizeof(buffer), "%s, %d", name, local_time.tm_year + 1900);
    return buffer;
}

} // namespace home
