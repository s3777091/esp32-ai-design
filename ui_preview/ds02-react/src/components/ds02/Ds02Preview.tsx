import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import TiltedDock from "@/components/ui/tilted-dock";
import "./ds02.css";

type ScreenState = "dim" | "awake" | "black";

interface StateInfo {
  key: ScreenState;
  title: string;
  detail: string;
}

const STATES: StateInfo[] = [
  {
    key: "dim",
    title: "Dim standby",
    detail:
      "Background is darkened. Time sits under Wi-Fi + battery; weather label stays at the bottom.",
  },
  {
    key: "awake",
    title: "Awake standby",
    detail:
      "First press brightens the same background, Wi-Fi/battery, time, and weather label.",
  },
  {
    key: "black",
    title: "Device menu",
    detail:
      "Second press opens the black launcher menu; the TiltedDock appears at the bottom of the screen.",
  },
];

function formatDate(date: Date) {
  const weekday = new Intl.DateTimeFormat("vi-VN", { weekday: "long" }).format(date);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const lunar = formatLunarDate(date);
  return `${weekday}, ${day} thg ${month}${lunar ? ` · ${lunar}` : ""}`;
}

function formatLunarDate(date: Date) {
  try {
    const parts = new Intl.DateTimeFormat("vi-VN-u-ca-chinese", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    }).formatToParts(date);
    const day = parts.find((p) => p.type === "day")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const year =
      parts.find((p) => p.type === "year")?.value;
    if (!day || !month || !year) return "";
    return `${day}/${month} năm ${year}`;
  } catch {
    return "";
  }
}

function noop() {}

export function Ds02Preview() {
  const [stateIndex, setStateIndex] = useState(0);
  const [time, setTime] = useState("--:--");
  const [dateText, setDateText] = useState("");
  const [offline, setOffline] = useState(!navigator.onLine);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [btAvailable, setBtAvailable] = useState<boolean | null>(null);

  // Clock.
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(
        new Intl.DateTimeFormat("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(now)
      );
      setDateText(formatDate(now));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Network.
  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Battery (best-effort — Chromium only).
  useEffect(() => {
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<{
        level: number;
        addEventListener: (t: string, cb: () => void) => void;
        removeEventListener: (t: string, cb: () => void) => void;
      }>;
    };
    if (!nav.getBattery) return;
    let battery: Awaited<ReturnType<NonNullable<typeof nav.getBattery>>> | null = null;
    let active = true;
    const sync = () => {
      if (battery) setBatteryLevel(battery.level);
    };
    nav.getBattery().then((b) => {
      if (!active) {
        b.addEventListener("levelchange", noop);
        b.addEventListener("chargingchange", noop);
        b.removeEventListener("levelchange", noop);
        b.removeEventListener("chargingchange", noop);
        return;
      }
      battery = b;
      sync();
      b.addEventListener("levelchange", sync);
      b.addEventListener("chargingchange", sync);
    });
    return () => {
      active = false;
      if (battery) {
        battery.removeEventListener("levelchange", sync);
        battery.removeEventListener("chargingchange", sync);
      }
      battery = null;
    };
  }, []);

  // Bluetooth availability (best-effort).
  useEffect(() => {
    const bt = (navigator as Navigator & {
      bluetooth?: { getAvailability: () => Promise<boolean> };
    }).bluetooth;
    if (!bt?.getAvailability) return;
    let active = true;
    const sync = async () => {
      const ok = await bt.getAvailability!();
      if (active) setBtAvailable(ok);
    };
    sync();
    return () => {
      active = false;
    };
  }, []);

  const state = STATES[stateIndex];
  const showDock = state.key === "black";
  const [activeTab, setActiveTab] = useState(1); // 1 = Home

  return (
    <main className="min-h-screen w-full grid place-items-center bg-[var(--ds-page-bg)] text-[var(--ds-text)] font-sans p-4 gap-5">
      <header className="text-center max-w-[640px]">
        <h1 className="text-xl font-bold m-0">DS-02 Standby UI Preview</h1>
        <p className="text-[13px] text-[var(--ds-muted)] leading-snug mt-1">
          Device screen content: wallpaper, Wi-Fi/battery, time, and weather label.
        </p>
      </header>

      <section
        aria-label="DS-02 device preview"
        className="w-full max-w-[430px] p-6 border border-[var(--ds-panel-border)] rounded-[22px] bg-[var(--ds-panel-bg)] shadow-[0_24px_60px_rgba(0,0,0,0.35)] grid place-items-center"
      >
        <div className="w-full max-w-[360px] p-2.5 rounded-xl bg-[#07080a] border border-[#30343d]">
          <div
            data-state={state.key}
            aria-label="DS-02 screen"
            className="relative w-full aspect-[4/3] bg-black rounded-sm overflow-hidden text-white ds02-screen"
          >
            {/* Standby wallpaper + status */}
            <div aria-hidden="true" className="ds02-standby absolute inset-0">
              <div className="ds02-overlay" />
              <div className="absolute inset-0 grid justify-items-end items-start pt-3.5 pr-4 pb-4">
                <div className="relative z-[1] grid gap-2 justify-items-end text-right">
                  <div className="flex items-center gap-2 text-white/90 drop-shadow-[0_1px_8px_rgba(0,0,0,0.85)]">
                    <WifiIcon offline={offline} />
                    {btAvailable !== null && (
                      <span className="text-[10px] font-extrabold">
                        {btAvailable ? "BT" : "BTx"}
                      </span>
                    )}
                    {batteryLevel !== null && (
                      <span className="inline-flex items-center gap-[3px] text-[11px] font-bold">
                        <span>{Math.round(batteryLevel * 100)}</span>
                        <BatteryBar level={batteryLevel} />
                      </span>
                    )}
                  </div>
                  <div className="relative text-[56px] font-light leading-none drop-shadow-[0_2px_16px_rgba(0,0,0,0.78)]">
                    {time}
                  </div>
                </div>
              </div>
              <div className="absolute left-4 bottom-4 z-[1] grid gap-1">
                <div className="text-white/90 text-[12px] font-extrabold leading-[1.05] drop-shadow-[0_1px_10px_rgba(0,0,0,0.86)]">
                  ĐIỀU KIỆN THỜI TIẾT
                </div>
                <div className="text-white/80 text-[10px] font-bold leading-[1.1] whitespace-nowrap drop-shadow-[0_1px_10px_rgba(0,0,0,0.86)]">
                  {dateText}
                </div>
              </div>
            </div>

            {/* Black launcher = TiltedDock + tab content */}
            <div
              aria-hidden={!showDock}
              className="ds02-launcher absolute inset-0 bg-black transition-opacity duration-200"
              style={{
                opacity: showDock ? 1 : 0,
                pointerEvents: showDock ? "auto" : "none",
              }}
            >
              {showDock && (
                <DockPage
                  activeTab={activeTab}
                  onSelect={setActiveTab}
                  offline={offline}
                  batteryLevel={batteryLevel}
                  btAvailable={btAvailable}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      <section
        aria-label="Preview controls"
        className="w-full max-w-[430px] grid grid-cols-[1fr_auto] gap-2.5 items-center px-3.5 py-3 border border-[var(--ds-panel-border)] rounded-lg bg-white/[0.03]"
      >
        <div className="text-[var(--ds-muted)] text-[13px] leading-snug">
          <strong className="text-[var(--ds-text)]">{state.title}</strong>
          <br />
          {state.detail}
        </div>
        <Button
          type="button"
          onClick={() => setStateIndex((i) => (i + 1) % STATES.length)}
        >
          Press GPIO0
        </Button>
      </section>
    </main>
  );
}

function WifiIcon({ offline }: { offline: boolean }) {
  return (
    <div
      aria-hidden
      className={`relative w-[19px] h-[14px] text-white ${
        offline ? "after:content-[''] after:absolute after:left-px after:top-1.5 after:w-5 after:h-0.5 after:rounded-full after:bg-current after:rotate-[-42deg] after:origin-center" : ""
      }`}
    >
      <span className="absolute left-1/2 bottom-0 w-[18px] h-[13px] border-2 border-current border-t-transparent border-l-transparent border-r-transparent rounded-full -translate-x-1/2" />
      <span className="absolute left-1/2 bottom-0 w-3 h-2 border-2 border-current border-t-transparent border-l-transparent border-r-transparent rounded-full -translate-x-1/2" />
      <span className="absolute left-1/2 bottom-0 w-1 h-1 bg-current rounded-full -translate-x-1/2" />
    </div>
  );
}

function BatteryBar({ level }: { level: number }) {
  const pct = Math.max(0, Math.min(1, level));
  return (
    <span
      aria-hidden
      className="relative w-6 h-3 border-[1.5px] border-current rounded"
      style={
        {
          "--battery-level": pct,
        } as React.CSSProperties
      }
    >
      <span
        className="absolute left-0.5 top-0.5 h-1.5 rounded-sm bg-current"
        style={{ width: "calc((100% - 4px) * var(--battery-level, 0))" }}
      />
      <span className="absolute -right-1 top-[3px] w-0.5 h-[5px] rounded-r bg-current" />
    </span>
  );
}

function LauncherStatus({
  offline,
  batteryLevel,
  btAvailable,
}: {
  offline: boolean;
  batteryLevel: number | null;
  btAvailable: boolean | null;
}) {
  const level = batteryLevel ?? 0.99;

  return (
    <div className="inline-flex items-center gap-1 pr-0.5 text-[9px] font-bold leading-none text-white/40">
      <MiniWifiIcon offline={offline} />
      <span className={btAvailable === false ? "opacity-60" : undefined}>BT</span>
      <span>{Math.round(level * 100)}</span>
      <MiniBatteryBar level={level} />
    </div>
  );
}

function MiniWifiIcon({ offline }: { offline: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative inline-block h-[9px] w-[13px] text-current ${
        offline ? "after:content-[''] after:absolute after:left-0 after:top-[4px] after:h-px after:w-[14px] after:rounded-full after:bg-current after:rotate-[-42deg]" : ""
      }`}
    >
      <span className="absolute left-1/2 bottom-0 h-[9px] w-[13px] -translate-x-1/2 rounded-full border-[1.4px] border-current border-l-transparent border-r-transparent border-t-transparent" />
      <span className="absolute left-1/2 bottom-0 h-[6px] w-[8px] -translate-x-1/2 rounded-full border-[1.4px] border-current border-l-transparent border-r-transparent border-t-transparent" />
      <span className="absolute bottom-0 left-1/2 h-[2px] w-[2px] -translate-x-1/2 rounded-full bg-current" />
    </span>
  );
}

function MiniBatteryBar({ level }: { level: number }) {
  const pct = Math.max(0, Math.min(1, level));

  return (
    <span
      aria-hidden
      className="relative h-[9px] w-[18px] rounded-[3px] border border-current"
      style={
        {
          "--battery-level": pct,
        } as React.CSSProperties
      }
    >
      <span
        className="absolute left-px top-px h-[5px] rounded-[2px] bg-current"
        style={{ width: "calc((100% - 4px) * var(--battery-level, 0))" }}
      />
      <span className="absolute -right-[3px] top-[2px] h-[5px] w-[2px] rounded-r bg-current" />
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dock + tab content (black-screen menu)                                    */
/* -------------------------------------------------------------------------- */

const TAB_PAGES: Record<number, { title: string; body: string }> = {
  1: { title: "Home", body: "" }, // Home renders the real <Calendar /> below.
  2: { title: "Search", body: "Tìm kiếm thiết bị, bài hát, cài đặt…" },
  3: { title: "Alerts", body: "Không có thông báo mới." },
  4: { title: "Profile", body: "Người dùng: ekko.huynh" },
  5: { title: "Music", body: "Chưa có bài hát nào đang phát." },
  6: { title: "Settings", body: "Wi-Fi, âm thanh, hiển thị, ngôn ngữ…" },
};

function DockPage({
  activeTab,
  onSelect,
  offline,
  batteryLevel,
  btAvailable,
}: {
  activeTab: number;
  onSelect: (id: number) => void;
  offline: boolean;
  batteryLevel: number | null;
  btAvailable: boolean | null;
}) {
  const isHome = activeTab === 1;
  return (
    <div className="absolute inset-0 flex flex-col text-white">
      {/* Tab content fills the screen above the dock. */}
      <div className="flex-1 relative overflow-hidden">
        {isHome ? (
          <div
            className="absolute inset-x-0 top-0 bottom-[4rem] overflow-hidden"
          >
            <Calendar
              compact
              headerAction={
                <LauncherStatus
                  offline={offline}
                  batteryLevel={batteryLevel}
                  btAvailable={btAvailable}
                />
              }
            />
          </div>
        ) : (
          <div className="absolute inset-0 grid place-items-center px-6 pb-14 text-center">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/50">
                Tab #{activeTab}
              </div>
              <div className="text-2xl font-semibold mt-1">
                {TAB_PAGES[activeTab]?.title}
              </div>
              <div className="text-xs text-white/70 mt-2 max-w-[220px]">
                {TAB_PAGES[activeTab]?.body}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom dock navigation. */}
      <TiltedDock
        variant="inset"
        scale={0.78}
        activeId={activeTab}
        onSelect={onSelect}
      />
    </div>
  );
}
