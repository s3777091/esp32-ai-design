#pragma once

#include <array>
#include <cstdint>

// Days on the calendar that carry a note/appointment. The server pushes them
// through the MCP tool self.calendar.set_marks whenever the schedule changes;
// Ds02HomeDisplay::RefreshCalendar() repaints when Version() moves.
// Keeps a rolling window of a few months in RAM (bitmask per month).
namespace CalendarMarks {

struct Entry {
    int ym = 0;         // year * 100 + month (1-12); 0 = free slot
    uint32_t mask = 0;  // bit (day-1) set = day has a note/appointment
};

struct State {
    std::array<Entry, 4> entries{};
    int version = 0;
};

inline State& GetState() {
    static State state;
    return state;
}

inline void SetMarks(int year, int month1, uint32_t mask) {
    auto& st = GetState();
    const int ym = year * 100 + month1;
    Entry* slot = nullptr;
    for (auto& e : st.entries) {
        if (e.ym == ym) {
            slot = &e;
            break;
        }
    }
    if (slot == nullptr) {
        slot = &st.entries[0];
        for (auto& e : st.entries) {
            if (e.ym < slot->ym) {
                slot = &e; // reuse the oldest slot
            }
        }
    }
    if (slot->ym == ym && slot->mask == mask) {
        return;
    }
    slot->ym = ym;
    slot->mask = mask;
    st.version++;
}

inline bool IsMarked(int year, int month1, int day) {
    if (day < 1 || day > 31) {
        return false;
    }
    const int ym = year * 100 + month1;
    for (const auto& e : GetState().entries) {
        if (e.ym == ym) {
            return (e.mask >> (day - 1)) & 1u;
        }
    }
    return false;
}

inline int Version() {
    return GetState().version;
}

} // namespace CalendarMarks
