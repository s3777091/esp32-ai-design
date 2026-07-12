#pragma once

#include "display/lcd_display.h"

#include <array>
#include <cstdint>
#include <ctime>
#include <functional>
#include <memory>
#include <string>

namespace home {

struct Ds02BluetoothState {
    bool available = false;
    bool connected = false;
};

using Ds02BluetoothStateProvider = std::function<Ds02BluetoothState()>;
using Ds02LunarDateProvider = std::function<std::string(const struct tm& local_time)>;

class Ds02HomeDisplay : public SpiLcdDisplay {
public:
    Ds02HomeDisplay(esp_lcd_panel_io_handle_t panel_io, esp_lcd_panel_handle_t panel,
                    int width, int height, int offset_x, int offset_y,
                    bool mirror_x, bool mirror_y, bool swap_xy);
    ~Ds02HomeDisplay() override;

    void SetupUI() override;
    void SetStatus(const char* status) override;
    void SetPowerSaveMode(bool on) override;
    void UpdateStatusBar(bool update_all = false) override;
    void SetTheme(Theme* theme) override;
    void SetChatMessage(const char* role, const char* content) override;
    void SetEmotion(const char* emotion) override;

    void ShowDimStandby();
    void ShowAwakeStandby();
    void ShowPureBlack();
    void ShowLauncher();
    void ShowOnboardSplash(int duration_ms = 4500);
    void ShowWifiConfigPrompt(const char* ssid, const char* password, const char* url) override;
    void HideWifiConfigPrompt() override;
    void AdvanceStandbyButtonState();
    void WakeFromWakeWord(const char* wake_word = nullptr);
    void SetProfileVoiceActive(bool active);

    void SetBluetoothStateProvider(Ds02BluetoothStateProvider provider);
    void SetLunarDateProvider(Ds02LunarDateProvider provider);
    void SetWallpaper(std::unique_ptr<LvglImage> image);
    bool SetBackgroundIndex(size_t index, bool persist = true);
    bool SetBackgroundByName(const std::string& name, bool persist = true);
    size_t GetBackgroundIndex() const { return background_index_; }
    size_t GetBackgroundCount() const;
    const char* GetBackgroundTitle(size_t index) const;
    const char* GetBackgroundFile(size_t index) const;
    void SetTextColor(uint32_t color, bool persist = true);
    uint32_t GetTextColor() const { return text_color_; }

private:
    enum class StandbyState {
        Dim,
        Awake,
        Launcher,
    };

    enum class LauncherView {
        Home,
        Drawer,
        Calendar,
        App,
    };

    static constexpr size_t kDockItemCount = 6;
    static constexpr size_t kWeekdayCount = 7;
    static constexpr size_t kCalendarDayCount = 42;
    static constexpr size_t kBackgroundCount = 20;
    static constexpr size_t kWakeSoundCount = 8;

    void CreateStandbyObjects();
    void CreateLauncherObjects();
    void CreateLauncherHomeObjects();
    void CreateAppDrawerObjects();
    void CreateAppBackButtonObject();
    void CreateSystemBarObjects();
    void CreateLowBatteryNotificationObjects();
    void CreateCalendarObjects();
    void CreateProfileObjects();
    void CreateSettingsObjects();
    void CreateWakeSoundPickerObjects();
    void CreateBackgroundGalleryObjects();
    void CreateOnboardSplashObjects();
    void CreateWifiConfigPromptObjects();
    void CreateDockObjects();
    void RefreshHomeData();
    void RefreshClock();
    void RefreshNetwork();
    void RefreshBattery();
    void RefreshBluetooth();
    void UpdateBatteryIcon(int level, bool charging, bool available);
    void UpdateLowBatteryNotification(int level, bool charging, bool discharging);
    void RefreshCalendar(bool force = false);
    void RefreshSettingsPage();
    void RefreshTranslateLabels();
    void RefreshWakeSoundPicker();
    void RefreshBackgroundGallery();
    void RefreshLauncherPage(bool force = false);
    void ApplyAppDrawerStyle();
    void ApplyStandbyState();
    void HideOnboardSplash();
    void HideWifiConfigPromptLocked();
    void SelectDockItem(size_t index);
    void ShowLauncherHome();
    void ShowAppDrawer();
    void ShowCalendar();
    void ShowAppDetail(size_t index);
    void ApplyDockSelection();
    void ApplyWakeSoundIndex(int index);
    void OpenWakeSoundPicker();
    void CloseWakeSoundPicker();
    void OpenBackgroundGallery();
    void CloseBackgroundGallery();
    void MoveBackground(int direction);
    bool ApplyBackgroundIndex(size_t index);
    void PersistBackgroundIndex();
    LvglImage* GetBackgroundImage(size_t index);
    void ApplyThemeColors(Theme* theme);
    void ApplyTextColor();
    void ApplyTextColorToObjectTree(lv_obj_t* obj, lv_color_t color);
    void SetProfileAvatarSpeaking(bool speaking);
    void ApplyProfileAvatarPulse(int value);
    void MoveTranslateOrb(int side);
    void ToggleTranslateMode();
    const char* TranslateModeLabel() const;
    const char* TranslateLeftLanguage() const;
    const char* TranslateRightLanguage() const;

    static void OnRefreshTimer(void* arg);
    static void OnProfileAvatarTimer(void* arg);
    static void OnOnboardSplashTimer(void* arg);
    static void OnLauncherHomeGesture(lv_event_t* event);
    static void OnAppDrawerGesture(lv_event_t* event);
    static void OnCalendarGesture(lv_event_t* event);
    static void OnAppDrawerItemClicked(lv_event_t* event);
    static void OnAppBackClicked(lv_event_t* event);
    static void OnDockButtonClicked(lv_event_t* event);
    static void OnSettingsWifiClicked(lv_event_t* event);
    static void OnSettingsWakeSoundClicked(lv_event_t* event);
    static void OnWakeSoundPickerOverlayClicked(lv_event_t* event);
    static void OnWakeSoundPickerCloseClicked(lv_event_t* event);
    static void OnWakeSoundOptionClicked(lv_event_t* event);
    static void OnSettingsBackgroundClicked(lv_event_t* event);
    static void OnSettingsTranslateClicked(lv_event_t* event);
    static void OnTranslateLeftClicked(lv_event_t* event);
    static void OnTranslateRightClicked(lv_event_t* event);
    static void OnBackgroundGalleryPrevClicked(lv_event_t* event);
    static void OnBackgroundGalleryNextClicked(lv_event_t* event);
    static void OnBackgroundGalleryCloseClicked(lv_event_t* event);
    static void OnBackgroundGalleryGesture(lv_event_t* event);
    static bool GetLocalTime(struct tm& local_time);
    static bool IsLeapYear(int year);
    static int DaysInMonth(int year, int month);
    static std::string FormatTime(const struct tm& local_time);
    static std::string FormatDateLine(const struct tm& local_time, const std::string& lunar_suffix);
    static std::string FormatCalendarTitle(const struct tm& local_time);

    StandbyState standby_state_ = StandbyState::Dim;
    esp_timer_handle_t refresh_timer_ = nullptr;
    esp_timer_handle_t profile_avatar_timer_ = nullptr;
    esp_timer_handle_t onboard_splash_timer_ = nullptr;

    lv_obj_t* root_ = nullptr;
    lv_obj_t* system_bar_ = nullptr;
    lv_obj_t* standby_layer_ = nullptr;
    lv_obj_t* wallpaper_ = nullptr;
    lv_obj_t* wallpaper_image_obj_ = nullptr;
    lv_obj_t* dim_overlay_ = nullptr;
    lv_obj_t* corner_info_ = nullptr;
    lv_obj_t* status_row_ = nullptr;
    lv_obj_t* wifi_label_ = nullptr;
    lv_obj_t* bluetooth_label_ = nullptr;
    lv_obj_t* battery_label_ds02_ = nullptr;
    lv_obj_t* battery_icon_root_ = nullptr;
    lv_obj_t* battery_icon_body_ = nullptr;
    lv_obj_t* battery_icon_fill_ = nullptr;
    lv_obj_t* battery_icon_nub_ = nullptr;
    lv_obj_t* low_battery_pill_ = nullptr;
    lv_obj_t* low_battery_pill_label_ = nullptr;
    lv_obj_t* time_label_ = nullptr;
    lv_obj_t* bottom_info_ = nullptr;
    lv_obj_t* weather_label_ = nullptr;
    lv_obj_t* date_label_ = nullptr;
    lv_obj_t* launcher_layer_ = nullptr;
    lv_obj_t* launcher_content_ = nullptr;
    lv_obj_t* launcher_home_ = nullptr;
    lv_obj_t* home_avatar_shadow_ = nullptr;
    lv_obj_t* home_avatar_sphere_ = nullptr;
    lv_obj_t* app_drawer_ = nullptr;
    lv_obj_t* app_back_button_ = nullptr;
    lv_obj_t* app_back_label_ = nullptr;
    lv_obj_t* settings_header_title_label_ = nullptr;
    lv_obj_t* launcher_title_label_ = nullptr;
    lv_obj_t* launcher_body_label_ = nullptr;
    lv_obj_t* calendar_root_ = nullptr;
    lv_obj_t* calendar_month_label_ = nullptr;
    lv_obj_t* profile_avatar_root_ = nullptr;
    lv_obj_t* translate_left_label_ = nullptr;
    lv_obj_t* translate_right_label_ = nullptr;
    lv_obj_t* profile_avatar_shadow_ = nullptr;
    lv_obj_t* profile_avatar_sphere_ = nullptr;
    lv_obj_t* settings_root_ = nullptr;
    lv_obj_t* settings_wifi_value_label_ = nullptr;
    lv_obj_t* settings_wake_sound_value_label_ = nullptr;
    lv_obj_t* settings_background_value_label_ = nullptr;
    lv_obj_t* settings_text_color_value_label_ = nullptr;
    lv_obj_t* settings_translate_value_label_ = nullptr;
    lv_obj_t* wake_sound_picker_overlay_ = nullptr;
    lv_obj_t* wake_sound_picker_panel_ = nullptr;
    lv_obj_t* wake_sound_picker_list_ = nullptr;
    lv_obj_t* background_gallery_overlay_ = nullptr;
    lv_obj_t* background_gallery_panel_ = nullptr;
    lv_obj_t* background_preview_box_ = nullptr;
    lv_obj_t* background_preview_image_obj_ = nullptr;
    lv_obj_t* background_title_label_ = nullptr;
    lv_obj_t* background_counter_label_ = nullptr;
    lv_obj_t* onboard_splash_layer_ = nullptr;
    lv_obj_t* onboard_splash_logo_ = nullptr;
    lv_obj_t* wifi_config_layer_ = nullptr;
    lv_obj_t* wifi_config_ssid_label_ = nullptr;
    lv_obj_t* wifi_config_password_label_ = nullptr;
    lv_obj_t* wifi_config_url_label_ = nullptr;
    lv_obj_t* dock_ = nullptr;
    std::array<lv_obj_t*, kWeekdayCount> calendar_weekday_labels_ = {};
    std::array<lv_obj_t*, kCalendarDayCount> calendar_day_cells_ = {};
    std::array<lv_obj_t*, kCalendarDayCount> calendar_day_labels_ = {};
    std::array<lv_obj_t*, kWakeSoundCount> wake_sound_option_rows_ = {};
    std::array<lv_obj_t*, kWakeSoundCount> wake_sound_option_labels_ = {};
    std::array<lv_obj_t*, kWakeSoundCount> wake_sound_check_labels_ = {};
    std::array<lv_obj_t*, kDockItemCount> dock_buttons_ = {};
    std::array<lv_obj_t*, kDockItemCount> dock_icon_labels_ = {};
    std::array<lv_obj_t*, kDockItemCount> app_grid_buttons_ = {};
    std::array<lv_obj_t*, kDockItemCount> app_grid_icon_boxes_ = {};
    std::array<lv_obj_t*, kDockItemCount> app_grid_icon_labels_ = {};
    std::array<lv_obj_t*, kDockItemCount> app_grid_title_labels_ = {};

    std::unique_ptr<LvglImage> wallpaper_image_ = nullptr;
    std::unique_ptr<LvglImage> onboard_logo_image_ = nullptr;
    std::array<std::unique_ptr<LvglImage>, kBackgroundCount> background_image_cache_ = {};
    std::array<bool, kBackgroundCount> background_load_failed_ = {};
    Ds02BluetoothStateProvider bluetooth_provider_ = nullptr;
    Ds02LunarDateProvider lunar_date_provider_ = nullptr;

    size_t active_dock_index_ = 0;
    LauncherView launcher_view_ = LauncherView::Home;
    size_t background_index_ = 0;
    size_t persisted_background_index_ = 0;
    uint32_t text_color_ = 0xffffff;
    int calendar_year_ = -1;
    int calendar_month_ = -1;
    int calendar_today_ = -1;
    int calendar_marks_version_ = -1;
    int translate_mode_index_ = 0;
    int translate_orb_side_ = 0;
    int profile_avatar_base_size_ = 0;
    int profile_avatar_pulse_ = 0;
    int profile_avatar_pulse_dir_ = 1;
    bool profile_avatar_speaking_ = false;
    bool profile_avatar_timer_running_ = false;
    bool low_battery_pill_visible_ = false;
    bool wallpaper_override_active_ = false;
    std::string cached_time_;
    std::string cached_date_;
    std::string cached_wifi_;
    std::string cached_battery_;
    std::string cached_bluetooth_;
    std::string cached_low_battery_text_;
    std::string cached_launcher_title_;
    std::string cached_launcher_body_;
    std::string cached_calendar_title_;
    std::string cached_settings_wifi_;
    std::string cached_settings_wake_sound_;
    std::string cached_settings_background_;
    std::string cached_settings_text_color_;
    std::string cached_settings_translate_;
    std::string cached_translate_left_;
    std::string cached_translate_right_;
    std::string cached_background_title_;
    std::string cached_background_counter_;
    std::string cached_wifi_config_ssid_;
    std::string cached_wifi_config_password_;
    std::string cached_wifi_config_url_;
    std::array<std::string, kCalendarDayCount> cached_calendar_day_text_ = {};
};

} // namespace home
