#pragma once

#include "display/lcd_display.h"

#include <array>
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
    void AdvanceStandbyButtonState();
    void WakeFromWakeWord(const char* wake_word = nullptr);

    void SetBluetoothStateProvider(Ds02BluetoothStateProvider provider);
    void SetLunarDateProvider(Ds02LunarDateProvider provider);
    void SetWallpaper(std::unique_ptr<LvglImage> image);

private:
    enum class StandbyState {
        Dim,
        Awake,
        Launcher,
    };

    static constexpr size_t kDockItemCount = 6;
    static constexpr size_t kWeekdayCount = 7;
    static constexpr size_t kCalendarDayCount = 42;

    void CreateStandbyObjects();
    void CreateLauncherObjects();
    void CreateCalendarObjects();
    void CreateDockObjects();
    void RefreshHomeData();
    void RefreshClock();
    void RefreshNetwork();
    void RefreshBattery();
    void RefreshBluetooth();
    void RefreshLauncherStatus();
    void RefreshCalendar(bool force = false);
    void RefreshLauncherPage(bool force = false);
    void ApplyStandbyState();
    void SelectDockItem(size_t index);
    void ApplyDockSelection();

    static void OnRefreshTimer(void* arg);
    static void OnDockButtonClicked(lv_event_t* event);
    static bool GetLocalTime(struct tm& local_time);
    static bool IsLeapYear(int year);
    static int DaysInMonth(int year, int month);
    static std::string FormatTime(const struct tm& local_time);
    static std::string FormatDateLine(const struct tm& local_time, const std::string& lunar_suffix);
    static std::string FormatCalendarTitle(const struct tm& local_time);

    StandbyState standby_state_ = StandbyState::Dim;
    esp_timer_handle_t refresh_timer_ = nullptr;

    lv_obj_t* root_ = nullptr;
    lv_obj_t* standby_layer_ = nullptr;
    lv_obj_t* wallpaper_ = nullptr;
    lv_obj_t* dim_overlay_ = nullptr;
    lv_obj_t* corner_info_ = nullptr;
    lv_obj_t* status_row_ = nullptr;
    lv_obj_t* wifi_label_ = nullptr;
    lv_obj_t* bluetooth_label_ = nullptr;
    lv_obj_t* battery_label_ds02_ = nullptr;
    lv_obj_t* time_label_ = nullptr;
    lv_obj_t* bottom_info_ = nullptr;
    lv_obj_t* weather_label_ = nullptr;
    lv_obj_t* date_label_ = nullptr;
    lv_obj_t* launcher_layer_ = nullptr;
    lv_obj_t* launcher_content_ = nullptr;
    lv_obj_t* launcher_title_label_ = nullptr;
    lv_obj_t* launcher_body_label_ = nullptr;
    lv_obj_t* launcher_status_label_ = nullptr;
    lv_obj_t* calendar_root_ = nullptr;
    lv_obj_t* calendar_month_label_ = nullptr;
    lv_obj_t* dock_ = nullptr;
    std::array<lv_obj_t*, kWeekdayCount> calendar_weekday_labels_ = {};
    std::array<lv_obj_t*, kCalendarDayCount> calendar_day_cells_ = {};
    std::array<lv_obj_t*, kCalendarDayCount> calendar_day_labels_ = {};
    std::array<lv_obj_t*, kDockItemCount> dock_buttons_ = {};
    std::array<lv_obj_t*, kDockItemCount> dock_icon_labels_ = {};

    std::unique_ptr<LvglImage> wallpaper_image_ = nullptr;
    Ds02BluetoothStateProvider bluetooth_provider_ = nullptr;
    Ds02LunarDateProvider lunar_date_provider_ = nullptr;

    size_t active_dock_index_ = 0;
    int calendar_year_ = -1;
    int calendar_month_ = -1;
    int calendar_today_ = -1;
    std::string cached_time_;
    std::string cached_date_;
    std::string cached_wifi_;
    std::string cached_battery_;
    std::string cached_bluetooth_;
    std::string cached_launcher_status_;
    std::string cached_launcher_title_;
    std::string cached_launcher_body_;
    std::string cached_calendar_title_;
    std::array<std::string, kCalendarDayCount> cached_calendar_day_text_ = {};
};

} // namespace home
