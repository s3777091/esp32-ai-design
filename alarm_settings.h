#pragma once

#include "settings.h"

#include <ctime>

// One-shot alarm clock persisted in NVS. The AI sets it through the
// self.alarm.* MCP tools ("mai đặt báo thức 6h30"), Application ticks it every
// second, and the ring uses the ringtone the user picked in the sound picker
// (WakeSoundSettings). One-shot: it disarms itself right before ringing; the
// nightly ask-flow (server side) re-arms it for the next day.
namespace AlarmSettings {

constexpr const char* kNamespace = "alarm";
constexpr int kRingRepeats = 10;      // how many times the ringtone replays
constexpr int kTicksBetweenRings = 3; // seconds between replays

struct State {
    bool loaded = false;
    bool enabled = false;
    int hour = 0;
    int minute = 0;
    // runtime ringing state
    bool ringing = false;
    int rings_left = 0;
    int tick_countdown = 0;
    int last_fired_stamp = -1; // yday*10000 + hh*100 + mm, de-dup guard
};

inline State& GetState() {
    static State state;
    return state;
}

inline void EnsureLoaded() {
    auto& st = GetState();
    if (st.loaded) {
        return;
    }
    Settings settings(kNamespace, false);
    st.enabled = settings.GetBool("enabled", false);
    st.hour = settings.GetInt("hour", 0);
    st.minute = settings.GetInt("minute", 0);
    st.loaded = true;
}

inline void Persist() {
    auto& st = GetState();
    Settings settings(kNamespace, true);
    settings.SetBool("enabled", st.enabled);
    settings.SetInt("hour", st.hour);
    settings.SetInt("minute", st.minute);
}

inline void Set(int hour, int minute) {
    EnsureLoaded();
    auto& st = GetState();
    st.enabled = true;
    st.hour = hour;
    st.minute = minute;
    Persist();
}

inline void StopRinging() {
    auto& st = GetState();
    st.ringing = false;
    st.rings_left = 0;
}

inline void Cancel() {
    EnsureLoaded();
    auto& st = GetState();
    st.enabled = false;
    Persist();
    StopRinging();
}

inline bool Get(int& hour, int& minute) {
    EnsureLoaded();
    auto& st = GetState();
    hour = st.hour;
    minute = st.minute;
    return st.enabled;
}

inline bool IsRinging() {
    return GetState().ringing;
}

// Returns true exactly once when the armed time is reached (and disarms —
// one-shot). Caller starts the ring cycle.
inline bool ShouldFire(const struct tm& tm_now) {
    EnsureLoaded();
    auto& st = GetState();
    if (!st.enabled) {
        return false;
    }
    if (tm_now.tm_hour != st.hour || tm_now.tm_min != st.minute) {
        return false;
    }
    int stamp = tm_now.tm_yday * 10000 + tm_now.tm_hour * 100 + tm_now.tm_min;
    if (st.last_fired_stamp == stamp) {
        return false;
    }
    st.last_fired_stamp = stamp;
    st.enabled = false; // one-shot
    Persist();
    st.ringing = true;
    st.rings_left = kRingRepeats;
    st.tick_countdown = 0;
    return true;
}

// Per-second ringing driver: returns true when the ringtone should replay now.
inline bool RingTick() {
    auto& st = GetState();
    if (!st.ringing) {
        return false;
    }
    if (st.rings_left <= 0) {
        st.ringing = false;
        return false;
    }
    if (st.tick_countdown > 0) {
        st.tick_countdown--;
        return false;
    }
    st.tick_countdown = kTicksBetweenRings - 1;
    st.rings_left--;
    return true;
}

} // namespace AlarmSettings
