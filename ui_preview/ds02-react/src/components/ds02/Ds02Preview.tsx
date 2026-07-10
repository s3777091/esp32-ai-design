import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Ds02SettingsPanel,
  type Ds02Theme,
  type Ds02SettingsPanelProps,
} from "@/components/ui/inline-dropdown";
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

const CIRCUIT_BUTTONS = [
  {
    id: "boot",
    label: "BOOT",
    gpio: "GPIO0",
    status: "short press",
    enabled: true,
  },
  {
    id: "touch",
    label: "TOUCH",
    gpio: "NC",
    status: "not mounted",
    enabled: false,
  },
  {
    id: "vol-up",
    label: "VOL+",
    gpio: "NC",
    status: "not mounted",
    enabled: false,
  },
  {
    id: "vol-down",
    label: "VOL-",
    gpio: "NC",
    status: "not mounted",
    enabled: false,
  },
  {
    id: "reset-nvs",
    label: "NVS",
    gpio: "NC",
    status: "not mounted",
    enabled: false,
  },
  {
    id: "factory",
    label: "FACTORY",
    gpio: "NC",
    status: "not mounted",
    enabled: false,
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
  const [batteryCharging, setBatteryCharging] = useState(false);
  const [lowBatteryNoticeVisible, setLowBatteryNoticeVisible] = useState(false);
  const [btAvailable, setBtAvailable] = useState<boolean | null>(null);
  const [previewVolume, setPreviewVolume] = useState(70);
  const [previewBrightness, setPreviewBrightness] = useState(75);
  const [previewTheme, setPreviewTheme] = useState<Ds02Theme>("light");
  const [deviceAecEnabled, setDeviceAecEnabled] = useState(true);

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
        charging: boolean;
        addEventListener: (t: string, cb: () => void) => void;
        removeEventListener: (t: string, cb: () => void) => void;
      }>;
    };
    if (!nav.getBattery) return;
    let battery: Awaited<ReturnType<NonNullable<typeof nav.getBattery>>> | null = null;
    let active = true;
    const sync = () => {
      if (battery) {
        setBatteryLevel(battery.level);
        setBatteryCharging(battery.charging);
      }
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

  useEffect(() => {
    if (!lowBatteryNoticeVisible) return;
    const id = window.setTimeout(() => setLowBatteryNoticeVisible(false), 2400);
    return () => window.clearTimeout(id);
  }, [lowBatteryNoticeVisible]);

  const state = STATES[stateIndex];
  const showDock = state.key === "black";
  const [activeTab, setActiveTab] = useState(1); // 1 = Home
  const pressBoot = () => setStateIndex((i) => (i + 1) % STATES.length);
  const togglePreviewWifi = () => setOffline((value) => !value);
  const togglePreviewBluetooth = () => {
    setBtAvailable((value) => !(value ?? false));
  };
  const togglePreviewTheme = () => {
    setPreviewTheme((value) => (value === "light" ? "dark" : "light"));
  };
  const forceLowBattery = () => {
    setBatteryLevel(0.1);
    setBatteryCharging(false);
    setLowBatteryNoticeVisible(false);
    window.setTimeout(() => setLowBatteryNoticeVisible(true), 0);
  };

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
              <div className="ds02-standby-clock absolute inset-x-0 bottom-0 grid justify-items-end items-start pr-4 pb-4">
                <div className="relative z-[1] grid gap-2 justify-items-end text-right">
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
                  settings={{
                    offline,
                    onToggleWifi: togglePreviewWifi,
                    bluetoothAvailable: btAvailable,
                    onToggleBluetooth: togglePreviewBluetooth,
                    volume: previewVolume,
                    onVolumeChange: setPreviewVolume,
                    brightness: previewBrightness,
                    onBrightnessChange: setPreviewBrightness,
                    theme: previewTheme,
                    onToggleTheme: togglePreviewTheme,
                    aecEnabled: deviceAecEnabled,
                    onToggleAec: () => setDeviceAecEnabled((value) => !value),
                  }}
                />
              )}
            </div>

            <SystemStatusBar
              offline={offline}
              batteryLevel={batteryLevel}
              batteryCharging={batteryCharging}
              btAvailable={btAvailable}
            />
            <LowBatteryPill
              visible={lowBatteryNoticeVisible}
              batteryLevel={batteryLevel}
            />
          </div>
        </div>
      </section>

      <section
        aria-label="Preview controls"
        className="w-full max-w-[430px] grid gap-3 px-3.5 py-3 border border-[var(--ds-panel-border)] rounded-lg bg-white/[0.03]"
      >
        <div className="grid grid-cols-[1fr_auto] gap-2.5 items-center">
          <div className="text-[var(--ds-muted)] text-[13px] leading-snug">
            <strong className="text-[var(--ds-text)]">{state.title}</strong>
            <br />
            {state.detail}
          </div>
          <Button
            type="button"
            onClick={pressBoot}
          >
            Press GPIO0
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {CIRCUIT_BUTTONS.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={!item.enabled}
              onClick={item.id === "boot" ? pressBoot : undefined}
              className="min-h-[48px] rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-left disabled:opacity-35 disabled:cursor-not-allowed enabled:hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <span className="block text-[11px] font-bold leading-tight text-white">
                {item.label}
              </span>
              <span className="block text-[10px] font-semibold leading-tight text-white/60">
                {item.gpio}
              </span>
              <span className="block text-[9px] leading-tight text-white/40">
                {item.status}
              </span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2 items-center border-t border-white/10 pt-3">
          <div className="text-[12px] font-semibold text-white/70">
            Function button
          </div>
          <Button
            type="button"
            variant="destructive"
            onClick={forceLowBattery}
          >
            Pin yếu
          </Button>
        </div>
      </section>
    </main>
  );
}

function SystemStatusBar({
  offline,
  batteryLevel,
  batteryCharging,
  btAvailable,
}: {
  offline: boolean;
  batteryLevel: number | null;
  batteryCharging: boolean;
  btAvailable: boolean | null;
}) {
  const level = batteryLevel ?? 0.99;
  const batteryTone = getBatteryTone(level, batteryCharging);
  const wifiTone = offline ? "text-rose-400" : "text-emerald-300";
  const btTone = btAvailable ? "text-sky-300" : "text-slate-500";

  return (
    <div className="ds02-system-bar" aria-hidden="true">
      <div className="inline-flex items-center gap-1.5 pr-0.5 text-[9px] font-bold leading-none">
        <span className={wifiTone}>
          <MiniWifiIcon offline={offline} />
        </span>
        <span className={btTone}>{btAvailable ? "BT" : "BTx"}</span>
        <span className={batteryTone}>{Math.round(level * 100)}</span>
        <span className={batteryTone}>
          <MiniBatteryBar level={level} />
        </span>
      </div>
    </div>
  );
}

function getBatteryTone(level: number, charging: boolean) {
  if (charging) return "text-cyan-300";
  if (level <= 0.15) return "text-rose-400";
  if (level <= 0.35) return "text-amber-300";
  return "text-emerald-300";
}

function LowBatteryPill({
  visible,
  batteryLevel,
}: {
  visible: boolean;
  batteryLevel: number | null;
}) {
  const level = batteryLevel ?? 0.99;

  return (
    <div
      aria-hidden={!visible}
      className="ds02-low-battery-pill"
      data-visible={visible ? "true" : "false"}
    >
      Pin yếu {Math.round(level * 100)}%
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
  settings,
}: {
  activeTab: number;
  onSelect: (id: number) => void;
  settings: Ds02SettingsPanelProps;
}) {
  const isHome = activeTab === 1;
  const isProfile = activeTab === 4;
  const isSettings = activeTab === 6;
  return (
    <div className="absolute inset-0 flex flex-col text-white">
      {/* Tab content fills the screen above the dock. */}
      <div className="flex-1 relative overflow-hidden">
        {isHome ? (
          <div
            className="ds02-dock-page"
          >
            <Calendar compact />
          </div>
        ) : isProfile ? (
          <div className="ds02-dock-page bg-black">
            <ProfileAvatar3D speaking={false} />
          </div>
        ) : isSettings ? (
          <div className="ds02-dock-page bg-black">
            <Ds02SettingsPanel {...settings} />
          </div>
        ) : (
          <div className="ds02-dock-page grid place-items-center px-6 text-center">
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
        scale={0.72}
        activeId={activeTab}
        onSelect={onSelect}
      />
    </div>
  );
}

function ProfileAvatar3D({ speaking }: { speaking: boolean }) {
  return (
    <div
      className="profile-avatar-screen"
      data-speaking={speaking ? "true" : "false"}
      aria-label="Profile voice avatar"
    >
      <div className="profile-avatar-stage">
        <div className="profile-avatar-orb" aria-hidden>
          <span className="profile-avatar-cloud profile-avatar-cloud-a" />
          <span className="profile-avatar-cloud profile-avatar-cloud-b" />
          <span className="profile-avatar-cloud profile-avatar-cloud-c" />
        </div>
      </div>
    </div>
  );
}
