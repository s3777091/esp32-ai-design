import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Ds02SettingsPanel,
  type Ds02Theme,
  type Ds02SettingsPanelProps,
} from "@/components/ui/inline-dropdown";
import TiltedDock from "@/components/ui/tilted-dock";
import { DS02_WAKE_WORD } from "@/lib/ds02-config";
import "./ds02.css";

type ScreenState = "dim" | "awake" | "black";
type TranslateSide = "center" | "left" | "right";

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

const BACKGROUNDS = [
  { key: "mountain", label: "Mountain", url: "/mountain.png" },
  { key: "abtract", label: "Abstract", url: "/abtract.png" },
  { key: "anime-light", label: "Anime Light", url: "/anime_light.png" },
  { key: "cat-dog-anime", label: "Cat Dog Anime", url: "/cat_dog_anime.png" },
  { key: "cat-dog-chill", label: "Cat Dog Chill", url: "/cat_dog_chill.png" },
  { key: "cat-dog-sleep", label: "Cat Dog Sleep", url: "/cat_dog_sleep.png" },
  { key: "europe", label: "Europe", url: "/europe.png" },
  { key: "fantacy-anime", label: "Fantacy Anime", url: "/fantacy_anime.png" },
  { key: "follower", label: "Follower", url: "/follower.png" },
  { key: "haivan", label: "Hai Van", url: "/haivan.png" },
  { key: "jp-temple", label: "JP Temple", url: "/jp_temple.png" },
  { key: "linh-ung-pagoda", label: "Linh Ung Pagoda", url: "/linh_ung_pagoda.png" },
  { key: "morning-beach", label: "Morning Beach", url: "/morning_beach.png" },
  { key: "night-light", label: "Night Light", url: "/night_light.png" },
  { key: "pixel", label: "Pixel", url: "/pixel.png" },
  { key: "romance-anime", label: "Romance Anime", url: "/romance_anime.png" },
  { key: "rong-river", label: "Rong River", url: "/rong_river.png" },
  { key: "rooftop", label: "Rooftop", url: "/rooftop.png" },
  { key: "rubic", label: "Rubic", url: "/rubic.png" },
  { key: "sa-mac", label: "Sa Mac", url: "/sa_mac.png" },
] as const;

type BackgroundOption = (typeof BACKGROUNDS)[number];

const LEGACY_WAKE_SOUNDS = [
  "Popup",
  "Success",
  "Vibration",
  "Exclamation",
  "Welcome",
  "Activation",
  "Upgrade",
  "Low Battery",
] as const;

type RingtoneOption = {
  key: string;
  label: string;
  url: string;
};

type DeviceOption = {
  key: string;
  label: string;
  detail: string;
};

const WIFI_DEVICE_OPTIONS: readonly DeviceOption[] = [
  { key: "ekko-home-5g", label: "Ekko Home 5G", detail: "Strong signal" },
  { key: "studio-router", label: "Studio Router", detail: "Secured" },
  { key: "office-mesh", label: "Office Mesh", detail: "Saved network" },
  { key: "guest-wifi", label: "Guest Wi-Fi", detail: "Open network" },
];

const BLUETOOTH_DEVICE_OPTIONS: readonly DeviceOption[] = [
  { key: "ekko-buds", label: "Ekko Buds", detail: "Audio available" },
  { key: "ds02-speaker", label: "DS-02 Speaker", detail: "Nearby" },
  { key: "car-kit", label: "Car Kit", detail: "Previously paired" },
  { key: "dev-keyboard", label: "Dev Keyboard", detail: "Input device" },
];

const TRANSLATE_MODES = ["Vi <-> Chinese", "Vi <-> En"] as const;

function getTranslateLanguages(mode: string): [string, string] {
  return mode.toLowerCase().includes("chinese")
    ? ["Vi", "Chinese"]
    : ["Vi", "En"];
}

const RINGTONE_AUDIO_MODULES = import.meta.glob<string>(
  "../../../../../ringtone/*.mp3",
  {
    eager: true,
    query: "?url",
    import: "default",
  }
);

function ringtoneLabelFromPath(path: string) {
  const fileName = path.split(/[\\/]/).pop() ?? path;
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
}

const RINGTONE_OPTIONS: readonly RingtoneOption[] = Object.entries(
  RINGTONE_AUDIO_MODULES
)
  .map(([path, url]) => ({
    key: path,
    label: ringtoneLabelFromPath(path),
    url,
  }))
  .sort((a, b) => a.label.localeCompare(b.label, "vi"));

const WAKE_SOUNDS: readonly RingtoneOption[] =
  RINGTONE_OPTIONS.length > 0
    ? RINGTONE_OPTIONS
    : LEGACY_WAKE_SOUNDS.map((label, index) => ({
        key: `legacy-${index}`,
        label,
        url: "",
      }));

const TEXT_FONTS = [
  {
    key: "be-vietnam",
    label: "Be Vietnam",
    family: '"Be Vietnam Pro", "Segoe UI", "Noto Sans", Arial, sans-serif',
  },
  {
    key: "noto-sans",
    label: "Noto Sans",
    family: '"Noto Sans", "Segoe UI", Arial, sans-serif',
  },
  {
    key: "segoe",
    label: "Segoe UI",
    family: '"Segoe UI", "Noto Sans", Arial, sans-serif',
  },
  {
    key: "inter",
    label: "Inter",
    family: '"Inter", "Segoe UI", "Noto Sans", Arial, sans-serif',
  },
  {
    key: "mono-vn",
    label: "Mono VN",
    family: '"Cascadia Mono", "JetBrains Mono", "Noto Sans Mono", Consolas, monospace',
  },
] as const;

const TEXT_PAINTS = [
  {
    key: "protexa",
    label: "ProteXa",
    kind: "gradient",
    value: "linear-gradient(90deg, #63f5bf 0%, #68def8 50%, #9aa9ff 100%)",
  },
  {
    key: "aurora",
    label: "Aurora",
    kind: "gradient",
    value: "linear-gradient(90deg, #5eead4 0%, #38bdf8 44%, #c084fc 100%)",
  },
  {
    key: "sunrise",
    label: "Sunrise",
    kind: "gradient",
    value: "linear-gradient(90deg, #fde68a 0%, #fb7185 50%, #c084fc 100%)",
  },
  {
    key: "white",
    label: "White",
    kind: "solid",
    value: "#ffffff",
  },
  {
    key: "cyan",
    label: "Cyan",
    kind: "solid",
    value: "#67e8f9",
  },
  {
    key: "mint",
    label: "Mint",
    kind: "solid",
    value: "#6ee7b7",
  },
] as const;

type TextFontOption = (typeof TEXT_FONTS)[number];
type TextPaintOption = (typeof TEXT_PAINTS)[number];

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

function clampBrightness(value: number) {
  return Math.max(15, Math.min(100, value));
}

function getTextPaintStyle(paint: TextPaintOption): React.CSSProperties {
  if (paint.kind === "gradient") {
    return {
      background: paint.value,
      backgroundClip: "text",
      WebkitBackgroundClip: "text",
      color: "transparent",
      WebkitTextFillColor: "transparent",
    };
  }

  return {
    color: paint.value,
  };
}

export function Ds02Preview() {
  const [stateIndex, setStateIndex] = useState(0);
  const [time, setTime] = useState("--:--");
  const [dateText, setDateText] = useState("");
  const [offline, setOffline] = useState(!navigator.onLine);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [batteryCharging, setBatteryCharging] = useState(false);
  const [lowBatteryNoticeVisible, setLowBatteryNoticeVisible] = useState(false);
  const [btAvailable, setBtAvailable] = useState<boolean | null>(null);
  const [wifiDeviceIndex, setWifiDeviceIndex] = useState(0);
  const [bluetoothDeviceIndex, setBluetoothDeviceIndex] = useState(0);
  const [devicePicker, setDevicePicker] = useState<"wifi" | "bluetooth" | null>(
    null
  );
  const [previewVolume, setPreviewVolume] = useState(70);
  const [previewBrightness, setPreviewBrightness] = useState(75);
  const [previewTheme, setPreviewTheme] = useState<Ds02Theme>("light");
  const [wakeSoundIndex, setWakeSoundIndex] = useState(0);
  const [wakeSoundPickerOpen, setWakeSoundPickerOpen] = useState(false);
  const [previewingWakeSoundKey, setPreviewingWakeSoundKey] = useState<string | null>(
    null
  );
  const [backgroundIndex, setBackgroundIndex] = useState(0);
  const [backgroundGalleryOpen, setBackgroundGalleryOpen] = useState(false);
  const [textFontIndex, setTextFontIndex] = useState(0);
  const [textPaintIndex, setTextPaintIndex] = useState(0);
  const [textStyleOpen, setTextStyleOpen] = useState(false);
  const [translateModeIndex, setTranslateModeIndex] = useState(0);
  const [translateSide, setTranslateSide] = useState<TranslateSide>("center");
  const ringtoneAudioRef = useRef<HTMLAudioElement | null>(null);
  const ringtonePreviewTimerRef = useRef<number | null>(null);

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

  useEffect(() => {
    setTranslateSide("center");
  }, [translateModeIndex]);

  useEffect(() => {
    if (ringtoneAudioRef.current) {
      ringtoneAudioRef.current.volume = previewVolume / 100;
    }
  }, [previewVolume]);

  useEffect(() => {
    return () => {
      if (ringtonePreviewTimerRef.current !== null) {
        window.clearTimeout(ringtonePreviewTimerRef.current);
      }
      if (ringtoneAudioRef.current) {
        ringtoneAudioRef.current.pause();
        ringtoneAudioRef.current.src = "";
      }
    };
  }, []);

  const state = STATES[stateIndex];
  const showDock = state.key === "black";
  const textFont = TEXT_FONTS[textFontIndex] ?? TEXT_FONTS[0];
  const textPaint = TEXT_PAINTS[textPaintIndex] ?? TEXT_PAINTS[0];
  const translateMode = TRANSLATE_MODES[translateModeIndex] ?? TRANSLATE_MODES[0];
  const wakeSound = WAKE_SOUNDS[wakeSoundIndex] ?? WAKE_SOUNDS[0];
  const wifiDevice = WIFI_DEVICE_OPTIONS[wifiDeviceIndex] ?? WIFI_DEVICE_OPTIONS[0];
  const bluetoothDevice =
    BLUETOOTH_DEVICE_OPTIONS[bluetoothDeviceIndex] ?? BLUETOOTH_DEVICE_OPTIONS[0];
  const [activeTab, setActiveTab] = useState(1); // 1 = Home
  const pressBoot = () => setStateIndex((i) => (i + 1) % STATES.length);
  const togglePreviewWifi = () => setOffline((value) => !value);
  const togglePreviewBluetooth = () => {
    setBtAvailable((value) => !(value ?? false));
  };
  const togglePreviewTheme = () => {
    setPreviewTheme((value) => (value === "light" ? "dark" : "light"));
  };
  const updatePreviewBrightness = (value: number) => {
    setPreviewBrightness(clampBrightness(value));
  };
  const openWakeSoundPicker = () => {
    setDevicePicker(null);
    setBackgroundGalleryOpen(false);
    setTextStyleOpen(false);
    setWakeSoundPickerOpen(true);
  };
  const stopWakeSoundPreview = () => {
    if (ringtonePreviewTimerRef.current !== null) {
      window.clearTimeout(ringtonePreviewTimerRef.current);
      ringtonePreviewTimerRef.current = null;
    }
    if (ringtoneAudioRef.current) {
      ringtoneAudioRef.current.pause();
      ringtoneAudioRef.current.currentTime = 0;
    }
    setPreviewingWakeSoundKey(null);
  };
  const previewWakeSound = (sound: RingtoneOption) => {
    if (!sound.url) return;

    if (ringtonePreviewTimerRef.current !== null) {
      window.clearTimeout(ringtonePreviewTimerRef.current);
      ringtonePreviewTimerRef.current = null;
    }

    const audio = ringtoneAudioRef.current ?? new Audio();
    ringtoneAudioRef.current = audio;
    audio.pause();
    audio.preload = "metadata";
    audio.volume = previewVolume / 100;
    audio.onended = () => setPreviewingWakeSoundKey(null);
    audio.onerror = () => setPreviewingWakeSoundKey(null);

    if (audio.dataset.ringtoneKey !== sound.key) {
      audio.src = sound.url;
      audio.dataset.ringtoneKey = sound.key;
      audio.load();
    }

    audio.currentTime = 0;
    setPreviewingWakeSoundKey(sound.key);
    void audio.play().catch(() => setPreviewingWakeSoundKey(null));

    ringtonePreviewTimerRef.current = window.setTimeout(() => {
      if (ringtoneAudioRef.current === audio) {
        audio.pause();
        setPreviewingWakeSoundKey(null);
      }
    }, 8000);
  };
  const closeWakeSoundPicker = () => {
    stopWakeSoundPreview();
    setWakeSoundPickerOpen(false);
  };
  const selectWakeSound = (index: number) => {
    const sound = WAKE_SOUNDS[index];
    if (!sound) return;
    setWakeSoundIndex(index);
    previewWakeSound(sound);
  };
  const openBackgroundGallery = () => {
    stopWakeSoundPreview();
    setDevicePicker(null);
    setWakeSoundPickerOpen(false);
    setTextStyleOpen(false);
    setBackgroundGalleryOpen(true);
  };
  const closeBackgroundGallery = () => {
    setBackgroundGalleryOpen(false);
  };
  const openTextStyle = () => {
    stopWakeSoundPreview();
    setDevicePicker(null);
    setWakeSoundPickerOpen(false);
    setBackgroundGalleryOpen(false);
    setTextStyleOpen(true);
  };
  const closeTextStyle = () => {
    setTextStyleOpen(false);
  };
  const moveBackground = (direction: -1 | 1) => {
    setBackgroundIndex(
      (value) => (value + direction + BACKGROUNDS.length) % BACKGROUNDS.length
    );
  };
  const openDevicePicker = (kind: "wifi" | "bluetooth") => {
    stopWakeSoundPreview();
    setWakeSoundPickerOpen(false);
    setBackgroundGalleryOpen(false);
    setTextStyleOpen(false);
    setDevicePicker(kind);
  };
  const closeDevicePicker = () => setDevicePicker(null);
  const selectDevice = (kind: "wifi" | "bluetooth", index: number) => {
    if (kind === "wifi") {
      setWifiDeviceIndex(index);
      setOffline(false);
    } else {
      setBluetoothDeviceIndex(index);
      setBtAvailable(true);
    }
    setDevicePicker(null);
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
        <h1 className="text-xl font-bold m-0">Ekko Robot UI Preview</h1>
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
            data-theme={previewTheme}
            data-wallpaper={BACKGROUNDS[backgroundIndex].key}
            data-text-paint={textPaint.kind}
            aria-label="DS-02 screen"
            className="relative w-full aspect-[4/3] bg-black rounded-sm overflow-hidden text-white ds02-screen"
            style={{
              "--ds02-brightness-dim": String(
                (100 - clampBrightness(previewBrightness)) / 100
              ),
              "--ds02-wallpaper-image": `url("${BACKGROUNDS[backgroundIndex].url}")`,
              "--ds02-app-font": textFont.family,
              "--ds02-text-color": textPaint.kind === "solid" ? textPaint.value : "#ffffff",
              "--ds02-text-gradient":
                textPaint.kind === "gradient"
                  ? textPaint.value
                  : `linear-gradient(90deg, ${textPaint.value}, ${textPaint.value})`,
            } as React.CSSProperties}
          >
            {/* Standby wallpaper + status */}
            <div aria-hidden="true" className="ds02-standby absolute inset-0">
              <div className="ds02-overlay" />
              <div className="ds02-standby-clock absolute inset-x-0 bottom-0 grid justify-items-end items-start pr-4 pb-4">
                <div className="relative z-[1] grid gap-2 justify-items-end text-right">
                  <div className="ds02-styled-text relative text-[56px] font-light leading-none drop-shadow-[0_2px_16px_rgba(0,0,0,0.78)]">
                    {time}
                  </div>
                </div>
              </div>
              <div className="absolute left-4 bottom-4 z-[1] grid gap-1">
                <div className="ds02-styled-text text-[12px] font-extrabold leading-[1.05] drop-shadow-[0_1px_10px_rgba(0,0,0,0.86)]">
                  ĐIỀU KIỆN THỜI TIẾT
                </div>
                <div className="ds02-styled-text text-[10px] font-bold leading-[1.1] whitespace-nowrap drop-shadow-[0_1px_10px_rgba(0,0,0,0.86)]">
                  {dateText}
                </div>
              </div>
            </div>

            {/* Black launcher = TiltedDock + tab content */}
            <div
              aria-hidden={!showDock}
              className="ds02-launcher absolute inset-0 transition-[background-color,color,opacity] duration-200"
              style={{
                opacity: showDock ? 1 : 0,
                pointerEvents: showDock ? "auto" : "none",
              }}
            >
              {showDock && (
                <DockPage
                  activeTab={activeTab}
                  onSelect={setActiveTab}
                  translateSide={translateSide}
                  onSelectTranslateSide={setTranslateSide}
                  settings={{
                    offline,
                    wifiDeviceName: wifiDevice.label,
                    onChooseWifiDevice: () => openDevicePicker("wifi"),
                    onToggleWifi: togglePreviewWifi,
                    bluetoothAvailable: btAvailable,
                    bluetoothDeviceName: bluetoothDevice.label,
                    onChooseBluetoothDevice: () => openDevicePicker("bluetooth"),
                    onToggleBluetooth: togglePreviewBluetooth,
                    volume: previewVolume,
                    onVolumeChange: setPreviewVolume,
                    brightness: previewBrightness,
                    onBrightnessChange: updatePreviewBrightness,
                    theme: previewTheme,
                    onToggleTheme: togglePreviewTheme,
                    wakeWordName: DS02_WAKE_WORD,
                    wakeSoundName: wakeSound?.label ?? "Ringtone",
                    onChangeWakeSound: openWakeSoundPicker,
                    backgroundName: BACKGROUNDS[backgroundIndex].label,
                    onChangeBackground: openBackgroundGallery,
                    textStyleName: `${textFont.label} / ${textPaint.label}`,
                    onChangeTextStyle: openTextStyle,
                    translateModeName: translateMode,
                    onChangeTranslate: () =>
                      setTranslateModeIndex(
                        (value) => (value + 1) % TRANSLATE_MODES.length
                      ),
                  }}
                />
              )}
            </div>

            {wakeSoundPickerOpen && (
              <WakeSoundModal
                sounds={WAKE_SOUNDS}
                currentIndex={wakeSoundIndex}
                previewingKey={previewingWakeSoundKey}
                onSelect={selectWakeSound}
                onClose={closeWakeSoundPicker}
              />
            )}

            {devicePicker !== null && (
              <DevicePickerModal
                title={
                  devicePicker === "wifi" ? "Wi-Fi networks" : "Bluetooth devices"
                }
                options={
                  devicePicker === "wifi"
                    ? WIFI_DEVICE_OPTIONS
                    : BLUETOOTH_DEVICE_OPTIONS
                }
                currentIndex={
                  devicePicker === "wifi" ? wifiDeviceIndex : bluetoothDeviceIndex
                }
                onSelect={(index) => selectDevice(devicePicker, index)}
                onClose={closeDevicePicker}
              />
            )}

            {backgroundGalleryOpen && (
              <BackgroundGalleryModal
                backgrounds={BACKGROUNDS}
                currentIndex={backgroundIndex}
                onMove={moveBackground}
                onClose={closeBackgroundGallery}
              />
            )}

            {textStyleOpen && (
              <TextStyleModal
                fonts={TEXT_FONTS}
                paints={TEXT_PAINTS}
                fontIndex={textFontIndex}
                paintIndex={textPaintIndex}
                onSelectFont={setTextFontIndex}
                onSelectPaint={setTextPaintIndex}
                onClose={closeTextStyle}
              />
            )}

            <SystemStatusBar
              theme={previewTheme}
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

function WakeSoundModal({
  sounds,
  currentIndex,
  previewingKey,
  onSelect,
  onClose,
}: {
  sounds: readonly RingtoneOption[];
  currentIndex: number;
  previewingKey: string | null;
  onSelect: (index: number) => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ringtone"
      className="absolute inset-0 z-[70] grid place-items-center bg-black/70 px-3 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100%_-_24px)] w-full max-w-[296px] flex-col overflow-hidden rounded-lg border border-white/[0.15] bg-[#070a10] text-white shadow-[0_18px_44px_rgba(0,0,0,0.62)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex h-8 shrink-0 items-center justify-between px-2">
          <div className="min-w-0 text-[11px] font-bold leading-none">
            Ringtone
          </div>
          <button
            type="button"
            aria-label="Close ringtone picker"
            onClick={onClose}
            className="grid h-6 w-6 place-items-center rounded-md text-white/75 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <X size={15} aria-hidden />
          </button>
        </div>

        <div className="ds02-style-list min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2 touch-pan-y">
          {sounds.map((sound, index) => {
            const selected = index === currentIndex;
            const previewing = sound.key === previewingKey;
            return (
              <button
                key={sound.key}
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(index)}
                className={`ds02-ringtone-row${selected ? " is-selected" : ""}${
                  previewing ? " is-previewing" : ""
                }`}
              >
                <span className="ds02-ringtone-name">{sound.label}</span>
                {previewing && (
                  <span className="ds02-ringtone-meter" aria-hidden>
                    <span />
                    <span />
                    <span />
                  </span>
                )}
                {selected && (
                  <Check size={13} className="ds02-ringtone-check" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DevicePickerModal({
  title,
  options,
  currentIndex,
  onSelect,
  onClose,
}: {
  title: string;
  options: readonly DeviceOption[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="absolute inset-0 z-[70] grid place-items-center bg-black/70 px-3 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100%_-_24px)] w-full max-w-[296px] flex-col overflow-hidden rounded-lg border border-white/[0.15] bg-[#070a10] text-white shadow-[0_18px_44px_rgba(0,0,0,0.62)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex h-8 shrink-0 items-center justify-between px-2">
          <div className="min-w-0 text-[11px] font-bold leading-none">
            {title}
          </div>
          <button
            type="button"
            aria-label={`Close ${title}`}
            onClick={onClose}
            className="grid h-6 w-6 place-items-center rounded-md text-white/75 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <X size={15} aria-hidden />
          </button>
        </div>

        <div className="ds02-style-list min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2 touch-pan-y">
          {options.map((option, index) => {
            const selected = index === currentIndex;
            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(index)}
                className={`ds02-device-row${selected ? " is-selected" : ""}`}
              >
                <span className="ds02-device-copy">
                  <span className="ds02-device-name">{option.label}</span>
                  <span className="ds02-device-detail">{option.detail}</span>
                </span>
                {selected && (
                  <Check size={13} className="ds02-device-check" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BackgroundGalleryModal({
  backgrounds,
  currentIndex,
  onMove,
  onClose,
}: {
  backgrounds: readonly BackgroundOption[];
  currentIndex: number;
  onMove: (direction: -1 | 1) => void;
  onClose: () => void;
}) {
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const current = backgrounds[currentIndex] ?? backgrounds[0];

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches.item(0);
    if (!touch || touchStartX === null) return;

    const deltaX = touch.clientX - touchStartX;
    if (Math.abs(deltaX) > 32) {
      onMove(deltaX < 0 ? 1 : -1);
    }
    setTouchStartX(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Background gallery"
      className="absolute inset-0 z-[70] grid place-items-center bg-black/70 px-3 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[296px] overflow-hidden rounded-lg border border-white/[0.15] bg-[#070a10] text-white shadow-[0_18px_44px_rgba(0,0,0,0.62)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex h-8 items-center justify-between px-2">
          <div className="min-w-0 text-[11px] font-bold leading-none">
            Background
          </div>
          <button
            type="button"
            aria-label="Close background gallery"
            onClick={onClose}
            className="grid h-6 w-6 place-items-center rounded-md text-white/75 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <X size={15} aria-hidden />
          </button>
        </div>

        <div
          className="relative mx-2 h-[142px] overflow-hidden rounded-md border border-white/[0.12] bg-black"
          onTouchStart={(event) =>
            setTouchStartX(event.touches.item(0)?.clientX ?? null)
          }
          onTouchEnd={handleTouchEnd}
        >
          <img
            src={current.url}
            alt={current.label}
            draggable={false}
            className="h-full w-full select-none object-cover"
          />
          <button
            type="button"
            aria-label="Previous background"
            onClick={() => onMove(-1)}
            className="absolute left-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-black/[0.46] text-white shadow-[0_6px_16px_rgba(0,0,0,0.42)] hover:bg-black/[0.68] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <ChevronLeft size={17} aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Next background"
            onClick={() => onMove(1)}
            className="absolute right-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-black/[0.46] text-white shadow-[0_6px_16px_rgba(0,0,0,0.42)] hover:bg-black/[0.68] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <ChevronRight size={17} aria-hidden />
          </button>
        </div>

        <div className="flex h-9 items-center justify-between gap-2 px-2">
          <div className="min-w-0 text-[10px] font-semibold leading-none text-white/[0.78]">
            <span className="block truncate">{current.label}</span>
            <span className="mt-0.5 block text-[9px] text-white/[0.42]">
              {currentIndex + 1}/{backgrounds.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TextStyleModal({
  fonts,
  paints,
  fontIndex,
  paintIndex,
  onSelectFont,
  onSelectPaint,
  onClose,
}: {
  fonts: readonly TextFontOption[];
  paints: readonly TextPaintOption[];
  fontIndex: number;
  paintIndex: number;
  onSelectFont: (index: number) => void;
  onSelectPaint: (index: number) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"color" | "font">("color");
  const font = fonts[fontIndex] ?? fonts[0];
  const paint = paints[paintIndex] ?? paints[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Text style"
      className="absolute inset-0 z-[70] grid place-items-center bg-black/70 px-3 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[296px] overflow-hidden rounded-lg border border-white/[0.15] bg-[#070a10] text-white shadow-[0_18px_44px_rgba(0,0,0,0.62)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex h-8 items-center justify-between px-2">
          <div className="min-w-0 text-[11px] font-bold leading-none">
            Text style
          </div>
          <button
            type="button"
            aria-label="Close text style"
            onClick={onClose}
            className="grid h-6 w-6 place-items-center rounded-md text-white/75 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <X size={15} aria-hidden />
          </button>
        </div>

        <div className="mx-2 overflow-hidden rounded-md border border-white/[0.12] bg-black px-2 py-2">
          <div className="text-[20px] font-bold leading-tight">
            <span
              className="inline-block max-w-full truncate align-top"
              style={{
                fontFamily: font.family,
                ...getTextPaintStyle(paint),
              }}
            >
              Chào Ekko
            </span>
          </div>
        </div>

        <div className="mx-2 mt-2 grid grid-cols-2 gap-1 rounded-md bg-white/[0.06] p-0.5">
          <button
            type="button"
            onClick={() => setTab("color")}
            className={`h-6 rounded-[5px] text-[10px] font-bold leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
              tab === "color" ? "bg-cyan-300 text-slate-950" : "text-white/[0.68]"
            }`}
          >
            Color
          </button>
          <button
            type="button"
            onClick={() => setTab("font")}
            className={`h-6 rounded-[5px] text-[10px] font-bold leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
              tab === "font" ? "bg-cyan-300 text-slate-950" : "text-white/[0.68]"
            }`}
          >
            Font
          </button>
        </div>

        <div className="ds02-style-list mt-1 max-h-[92px] overflow-y-auto px-2 pb-2">
          {tab === "color"
            ? paints.map((option, index) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => onSelectPaint(index)}
                  className="mb-1 flex h-8 w-full items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.045] px-2 text-left hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                >
                  <span
                    className="h-4 w-4 shrink-0 rounded-full border border-white/20"
                    style={{ background: option.value }}
                    aria-hidden
                  />
                  <span
                    className="min-w-0 flex-1 truncate text-[11px] font-bold leading-none"
                    style={getTextPaintStyle(option)}
                  >
                    {option.label}
                  </span>
                  {index === paintIndex && (
                    <Check size={13} className="shrink-0 text-cyan-300" aria-hidden />
                  )}
                </button>
              ))
            : fonts.map((option, index) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => onSelectFont(index)}
                  className="mb-1 flex h-8 w-full items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.045] px-2 text-left hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                >
                  <span
                    className="min-w-0 flex-1 truncate text-[12px] font-bold leading-none"
                    style={{
                      fontFamily: option.family,
                      ...getTextPaintStyle(paint),
                    }}
                  >
                    {option.label}
                  </span>
                  {index === fontIndex && (
                    <Check size={13} className="shrink-0 text-cyan-300" aria-hidden />
                  )}
                </button>
              ))}
        </div>
      </div>
    </div>
  );
}

function SystemStatusBar({
  theme,
  offline,
  batteryLevel,
  batteryCharging,
  btAvailable,
}: {
  theme: Ds02Theme;
  offline: boolean;
  batteryLevel: number | null;
  batteryCharging: boolean;
  btAvailable: boolean | null;
}) {
  const level = batteryLevel ?? 0.99;
  const statusTone = theme === "light" ? "text-slate-950" : "text-white";

  return (
    <div className="ds02-system-bar" aria-hidden="true">
      <div className="inline-flex items-center gap-1.5 pr-0.5 text-[9px] font-bold leading-none">
        <span className={statusTone}>
          <MiniWifiIcon offline={offline} />
        </span>
        <span className={statusTone}>
          <MiniBluetoothIcon unavailable={btAvailable !== true} />
        </span>
        <span className={statusTone}>{Math.round(level * 100)}</span>
        <span className={statusTone}>
          <MiniBatteryBar level={level} charging={batteryCharging} theme={theme} />
        </span>
      </div>
    </div>
  );
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
    <svg
      aria-hidden
      viewBox="0 0 18 14"
      className="h-[10px] w-[14px] overflow-visible"
      fill="none"
    >
      <path
        d="M2 5.2C5.9 2.1 12.1 2.1 16 5.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M5 8.1C7.25 6.45 10.75 6.45 13 8.1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M8.15 10.8C8.65 10.45 9.35 10.45 9.85 10.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {offline && (
        <path
          d="M3 2L15 13"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function MiniBluetoothIcon({ unavailable }: { unavailable: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 14 14"
      className="h-[10px] w-[10px] overflow-visible"
      fill="none"
    >
      <path
        d="M6.1 1.6L10 5.05L6.1 8.5V1.6Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path
        d="M3.2 3.65L10 9.75L6.1 12.4V1.6"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {unavailable && (
        <path
          d="M2 2L12 12"
          stroke="currentColor"
          strokeWidth="1.45"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function MiniBatteryBar({
  level,
  charging,
  theme,
}: {
  level: number;
  charging: boolean;
  theme: Ds02Theme;
}) {
  const pct = Math.max(0, Math.min(1, level));
  const fillWidth = Math.max(1, Math.round(pct * 13));
  const boltFill = theme === "light" ? "#f4f6fb" : "#020617";

  return (
    <svg
      aria-hidden
      viewBox="0 0 22 12"
      className="h-[10px] w-[19px] shrink-0 overflow-visible"
      fill="none"
    >
      <rect
        x="1"
        y="2"
        width="17"
        height="8"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <rect x="19" y="4" width="2" height="4" rx="1" fill="currentColor" />
      <rect x="3" y="4" width={fillWidth} height="4" rx="1" fill="currentColor" />
      {charging && (
        <path
          d="M10.7 2.7L7.8 6.3H10L8.9 9.4L12.2 5.4H10L10.7 2.7Z"
          fill={boltFill}
        />
      )}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dock + tab content (black-screen menu)                                    */
/* -------------------------------------------------------------------------- */

const TAB_PAGES: Record<number, { title: string; body: string }> = {
  1: { title: "Home", body: "" }, // Home renders the real <Calendar /> below.
  2: { title: "Search", body: "Tìm kiếm thiết bị, bài hát, cài đặt…" },
  3: { title: "Alerts", body: "Không có thông báo mới." },
  4: { title: "Translate", body: "Vi <-> Chinese / Vi <-> En" },
  5: { title: "Music", body: "Chưa có bài hát nào đang phát." },
  6: { title: "Settings", body: "Wi-Fi, âm thanh, hiển thị, ngôn ngữ…" },
};

function DockPage({
  activeTab,
  onSelect,
  translateSide,
  onSelectTranslateSide,
  settings,
}: {
  activeTab: number;
  onSelect: (id: number) => void;
  translateSide: TranslateSide;
  onSelectTranslateSide: (side: TranslateSide) => void;
  settings: Ds02SettingsPanelProps;
}) {
  const isHome = activeTab === 1;
  const isProfile = activeTab === 4;
  const isSettings = activeTab === 6;
  const isLight = settings.theme === "light";

  return (
    <div className={isLight ? "absolute inset-0 flex flex-col text-slate-950" : "absolute inset-0 flex flex-col text-white"}>
      {/* Tab content fills the screen above the dock. */}
      <div className="flex-1 relative overflow-hidden">
        {isHome ? (
          <div
            className="ds02-dock-page"
          >
            <Calendar compact theme={settings.theme} />
          </div>
        ) : isProfile ? (
          <div className="ds02-dock-page">
            <ProfileAvatar3D
              speaking={false}
              theme={settings.theme}
              translateModeName={settings.translateModeName}
              activeSide={translateSide}
              onSelectSide={onSelectTranslateSide}
            />
          </div>
        ) : isSettings ? (
          <div className="ds02-dock-page">
            <Ds02SettingsPanel {...settings} />
          </div>
        ) : (
          <div className="ds02-dock-page grid place-items-center px-6 text-center">
            <div>
              <div className={isLight ? "text-[10px] uppercase tracking-widest text-slate-500" : "text-[10px] uppercase tracking-widest text-white/50"}>
                Tab #{activeTab}
              </div>
              <div className="text-2xl font-semibold mt-1">
                {TAB_PAGES[activeTab]?.title}
              </div>
              <div className={isLight ? "text-xs text-slate-600 mt-2 max-w-[220px]" : "text-xs text-white/70 mt-2 max-w-[220px]"}>
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
        theme={settings.theme}
        onSelect={onSelect}
      />
    </div>
  );
}

function ProfileAvatar3D({
  speaking,
  theme,
  translateModeName,
  activeSide,
  onSelectSide,
}: {
  speaking: boolean;
  theme: Ds02Theme;
  translateModeName: string;
  activeSide: TranslateSide;
  onSelectSide: (side: TranslateSide) => void;
}) {
  const [leftLanguage, rightLanguage] = getTranslateLanguages(translateModeName);

  return (
    <div
      className="profile-avatar-screen"
      data-theme={theme}
      data-speaking={speaking ? "true" : "false"}
      data-side={activeSide}
      aria-label="Translate voice avatar"
    >
      <button
        type="button"
        className="translate-side-hit translate-side-hit-left"
        aria-label={`Move to ${leftLanguage}`}
        onClick={() => onSelectSide("left")}
      />
      <button
        type="button"
        className="translate-side-hit translate-side-hit-right"
        aria-label={`Move to ${rightLanguage}`}
        onClick={() => onSelectSide("right")}
      />
      <div className="translate-language translate-language-left">
        {leftLanguage}
      </div>
      <div className="translate-language translate-language-right">
        {rightLanguage}
      </div>
      <div className="translate-audio-spine" aria-hidden />
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
