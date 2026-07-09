#include "ds02_home_display.h"

#include "assets/lang_config.h"
#include "board.h"
#include "lvgl_theme.h"

#include <algorithm>
#include <array>
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
constexpr int kValidYearBase = 2024 - 1900;
constexpr int kDockHeight = 48;
constexpr int kDockBottomMargin = 6;

struct DockItem {
    const char* icon;
    const char* title;
    const char* body;
};

#if defined(FONT_AWESOME_CALENDAR_DAYS) && defined(FONT_AWESOME_MAGNIFYING_GLASS) && \
    defined(FONT_AWESOME_BELL) && defined(FONT_AWESOME_USER) && \
    defined(FONT_AWESOME_MUSIC) && defined(FONT_AWESOME_GEAR)
constexpr bool kDockUsesIconFont = true;
constexpr std::array<DockItem, 6> kDockItems = {{
    {FONT_AWESOME_CALENDAR_DAYS, "Calendar", ""},
    {FONT_AWESOME_MAGNIFYING_GLASS, "Search", "Tim kiem thiet bi, bai hat, cai dat..."},
    {FONT_AWESOME_BELL, "Alerts", "Khong co thong bao moi."},
    {FONT_AWESOME_USER, "Profile", "Nguoi dung: ekko.huynh"},
    {FONT_AWESOME_MUSIC, "Music", "Chua co bai hat nao dang phat."},
    {FONT_AWESOME_GEAR, "Settings", "Wi-Fi, am thanh, hien thi, ngon ngu..."},
}};
#else
constexpr bool kDockUsesIconFont = false;
constexpr std::array<DockItem, 6> kDockItems = {{
    {"CAL", "Calendar", ""},
    {"SRC", "Search", "Tim kiem thiet bi, bai hat, cai dat..."},
    {"ALT", "Alerts", "Khong co thong bao moi."},
    {"USR", "Profile", "Nguoi dung: ekko.huynh"},
    {"MUS", "Music", "Chua co bai hat nao dang phat."},
    {"SET", "Settings", "Wi-Fi, am thanh, hien thi, ngon ngu..."},
}};
#endif

constexpr std::array<const char*, 7> kCalendarWeekdays = {{
    "SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"
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

bool TextEquals(const char* lhs, const char* rhs) {
    return lhs != nullptr && rhs != nullptr && std::strcmp(lhs, rhs) == 0;
}

} // namespace

Ds02HomeDisplay::Ds02HomeDisplay(esp_lcd_panel_io_handle_t panel_io, esp_lcd_panel_handle_t panel,
                                 int width, int height, int offset_x, int offset_y,
                                 bool mirror_x, bool mirror_y, bool swap_xy)
    : SpiLcdDisplay(panel_io, panel, width, height, offset_x, offset_y, mirror_x, mirror_y, swap_xy) {
}

Ds02HomeDisplay::~Ds02HomeDisplay() {
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

    esp_timer_create_args_t timer_args = {
        .callback = OnRefreshTimer,
        .arg = this,
        .dispatch_method = ESP_TIMER_TASK,
        .name = "ds02_home",
        .skip_unhandled_events = true,
    };
    esp_timer_create(&timer_args, &refresh_timer_);
    esp_timer_start_periodic(refresh_timer_, kRefreshIntervalUs);

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
    lv_obj_align(corner_info_, LV_ALIGN_TOP_RIGHT, -12, 12);

    status_row_ = lv_obj_create(corner_info_);
    lv_obj_set_size(status_row_, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
    ClearBoxStyle(status_row_);
    lv_obj_set_style_bg_opa(status_row_, LV_OPA_TRANSP, 0);
    lv_obj_set_flex_flow(status_row_, LV_FLEX_FLOW_ROW);
    lv_obj_set_flex_align(status_row_, LV_FLEX_ALIGN_END, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);

    wifi_label_ = lv_label_create(status_row_);
    bluetooth_label_ = lv_label_create(status_row_);
    battery_label_ds02_ = lv_label_create(status_row_);

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

    lv_obj_set_style_text_color(wifi_label_, Color(0xffffff), 0);
    lv_obj_set_style_text_color(bluetooth_label_, Color(0xffffff), 0);
    lv_obj_set_style_text_color(battery_label_ds02_, Color(0xffffff), 0);
    lv_obj_set_style_text_font(wifi_label_, &BUILTIN_ICON_FONT, 0);
    lv_obj_set_style_text_font(bluetooth_label_, &BUILTIN_TEXT_FONT, 0);
    lv_obj_set_style_text_font(battery_label_ds02_, &BUILTIN_TEXT_FONT, 0);
}

void Ds02HomeDisplay::CreateLauncherObjects() {
    const int safe_width = width_ > 0 ? width_ : 320;

    launcher_layer_ = lv_obj_create(root_);
    lv_obj_set_size(launcher_layer_, LV_PCT(100), LV_PCT(100));
    ClearBoxStyle(launcher_layer_);
    lv_obj_set_style_bg_color(launcher_layer_, Color(0x000000), 0);
    lv_obj_set_style_bg_opa(launcher_layer_, LV_OPA_COVER, 0);
    lv_obj_add_flag(launcher_layer_, LV_OBJ_FLAG_HIDDEN);

    launcher_content_ = lv_obj_create(launcher_layer_);
    lv_obj_set_size(launcher_content_, LV_PCT(100), LV_PCT(100));
    ClearBoxStyle(launcher_content_);
    lv_obj_set_style_bg_opa(launcher_content_, LV_OPA_TRANSP, 0);

    CreateCalendarObjects();

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

void Ds02HomeDisplay::CreateCalendarObjects() {
    const int safe_width = width_ > 0 ? width_ : 320;
    const int safe_height = height_ > 0 ? height_ : 240;
    const int calendar_height = std::max(120, safe_height - kDockHeight - kDockBottomMargin - 8);
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

    launcher_status_label_ = lv_label_create(calendar_root_);
    lv_obj_set_width(launcher_status_label_, safe_width / 2 - 8);
    lv_obj_set_style_text_align(launcher_status_label_, LV_TEXT_ALIGN_RIGHT, 0);
    lv_obj_set_style_text_color(launcher_status_label_, Color(0x767f8b), 0);
    lv_obj_set_style_text_font(launcher_status_label_, &BUILTIN_TEXT_FONT, 0);
    lv_label_set_long_mode(launcher_status_label_, LV_LABEL_LONG_DOT);
    lv_obj_align(launcher_status_label_, LV_ALIGN_TOP_RIGHT, -10, 9);

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

void Ds02HomeDisplay::CreateDockObjects() {
    const int safe_width = width_ > 0 ? width_ : 320;
    const int dock_width = Clamp(safe_width - 20, 220, 300);
    const int button_width = std::max(30, (dock_width - 16) / static_cast<int>(dock_buttons_.size()));

    dock_ = lv_obj_create(launcher_layer_);
    lv_obj_set_size(dock_, dock_width, kDockHeight);
    lv_obj_set_style_radius(dock_, 8, 0);
    lv_obj_set_style_bg_color(dock_, Color(0x15181d), 0);
    lv_obj_set_style_bg_opa(dock_, LV_OPA_80, 0);
    lv_obj_set_style_border_width(dock_, 1, 0);
    lv_obj_set_style_border_color(dock_, Color(0x303640), 0);
    lv_obj_set_style_pad_left(dock_, 6, 0);
    lv_obj_set_style_pad_right(dock_, 6, 0);
    lv_obj_set_style_pad_top(dock_, 5, 0);
    lv_obj_set_style_pad_bottom(dock_, 5, 0);
    lv_obj_set_style_pad_column(dock_, 2, 0);
    lv_obj_set_flex_flow(dock_, LV_FLEX_FLOW_ROW);
    lv_obj_set_flex_align(dock_, LV_FLEX_ALIGN_SPACE_BETWEEN, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_clear_flag(dock_, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_align(dock_, LV_ALIGN_BOTTOM_MID, 0, -kDockBottomMargin);

    for (size_t i = 0; i < dock_buttons_.size(); ++i) {
        auto* button = lv_obj_create(dock_);
        dock_buttons_[i] = button;
        lv_obj_set_size(button, button_width, kDockHeight - 12);
        ClearBoxStyle(button);
        lv_obj_set_style_radius(button, 7, 0);
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

    if (TextEquals(status, Lang::Strings::CONNECTING) || TextEquals(status, Lang::Strings::LISTENING)) {
        WakeFromWakeWord();
        return;
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
    ShowPureBlack();
}

void Ds02HomeDisplay::ApplyStandbyState() {
    if (root_ == nullptr || standby_layer_ == nullptr || launcher_layer_ == nullptr || dim_overlay_ == nullptr) {
        return;
    }

    lv_obj_clear_flag(root_, LV_OBJ_FLAG_HIDDEN);
    const bool launcher_visible = standby_state_ == StandbyState::Launcher;
    SetVisible(standby_layer_, !launcher_visible);
    SetVisible(launcher_layer_, launcher_visible);

    if (launcher_visible) {
        RefreshLauncherPage();
        RefreshLauncherStatus();
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
        RefreshLauncherStatus();
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
}

void Ds02HomeDisplay::RefreshBattery() {
    int level = 0;
    bool charging = false;
    bool discharging = false;
    if (!Board::GetInstance().GetBatteryLevel(level, charging, discharging)) {
        SetCachedText(battery_label_ds02_, cached_battery_, "");
        return;
    }

    level = std::max(0, std::min(level, 100));
    char text[32];
    std::snprintf(text, sizeof(text), charging ? "%d%%+" : "%d%%", level);
    SetCachedText(battery_label_ds02_, cached_battery_, text);
}

void Ds02HomeDisplay::RefreshBluetooth() {
    if (!bluetooth_provider_) {
        SetCachedText(bluetooth_label_, cached_bluetooth_, "");
        return;
    }

    auto state = bluetooth_provider_();
    if (!state.available) {
        SetCachedText(bluetooth_label_, cached_bluetooth_, "");
        return;
    }

    SetCachedText(bluetooth_label_, cached_bluetooth_, state.connected ? "BT" : "BTx");
}

void Ds02HomeDisplay::RefreshLauncherStatus() {
    std::string status = cached_wifi_.empty() ? "" : "NET";
    if (!cached_bluetooth_.empty()) {
        if (!status.empty()) {
            status += " ";
        }
        status += cached_bluetooth_;
    }
    if (!cached_battery_.empty()) {
        if (!status.empty()) {
            status += " ";
        }
        status += cached_battery_;
    }
    SetCachedText(launcher_status_label_, cached_launcher_status_, status);
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
            lv_obj_set_style_text_color(calendar_day_labels_[i], in_month ? Color(0xe8edf2) : Color(0x3d444d), 0);
        }
    }
}

void Ds02HomeDisplay::RefreshLauncherPage(bool force) {
    const bool calendar_active = active_dock_index_ == 0;
    SetVisible(calendar_root_, calendar_active);
    SetVisible(launcher_title_label_, !calendar_active);
    SetVisible(launcher_body_label_, !calendar_active);

    if (calendar_active) {
        RefreshCalendar(force);
        RefreshLauncherStatus();
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
        lv_obj_set_style_bg_color(button, active ? Color(0x1f9bff) : Color(0x000000), 0);
        lv_obj_set_style_bg_opa(button, active ? LV_OPA_30 : LV_OPA_TRANSP, 0);
        lv_obj_set_style_text_color(label, active ? Color(0x7fd0ff) : Color(0xe4e8ee), 0);
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
    if (wallpaper_ == nullptr) {
        return;
    }

    if (wallpaper_image_ == nullptr) {
        lv_obj_set_style_bg_image_src(wallpaper_, nullptr, 0);
        return;
    }

    lv_obj_set_style_bg_image_src(wallpaper_, wallpaper_image_->image_dsc(), 0);
}

void Ds02HomeDisplay::SetTheme(Theme* theme) {
    if (theme == nullptr) {
        return;
    }

    DisplayLockGuard lock(this);
    auto* lvgl_theme = dynamic_cast<LvglTheme*>(theme);
    if (lvgl_theme != nullptr && wallpaper_ != nullptr && wallpaper_image_ == nullptr) {
        auto background = lvgl_theme->background_image();
        if (background != nullptr) {
            lv_obj_set_style_bg_image_src(wallpaper_, background->image_dsc(), 0);
        } else {
            lv_obj_set_style_bg_image_src(wallpaper_, nullptr, 0);
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
