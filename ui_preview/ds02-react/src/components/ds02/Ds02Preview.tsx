import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Languages,
  Mic2,
  Music,
  Settings,
  Terminal,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Ds02SettingsPanel,
  type Ds02Theme,
  type Ds02SettingsPanelProps,
} from "@/components/ui/inline-dropdown";
import "./ds02.css";

type ScreenState = "dim" | "awake" | "black";
type TranslateSide = "center" | "left" | "right";
type LauncherSurface = "home" | "drawer" | "calendar";

type VoiceMessage = {
  id: number;
  text: string;
  role: "user" | "bot";
};

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionResultListLike = {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

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
    title: "Launcher",
    detail:
      "Second press opens the white orb home. Swipe right for apps, or left for the calendar.",
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

const BLUETOOTH_DEVICE_OPTIONS: readonly DeviceOption[] = [
  { key: "ekko-buds", label: "Ekko Buds", detail: "Audio available" },
  { key: "ds02-speaker", label: "DS-02 Speaker", detail: "Nearby" },
  { key: "car-kit", label: "Car Kit", detail: "Previously paired" },
  { key: "dev-keyboard", label: "Dev Keyboard", detail: "Input device" },
];

const TRANSLATE_MODES = ["Vi <-> Chinese", "Vi <-> En"] as const;
const WIFI_CONFIG_AP = {
  ssid: "Ekko-Huynh-Robot",
  password: "0799888358",
  url: "http://192.168.4.1",
} as const;

function getTranslateLanguages(mode: string): [string, string] {
  return mode.toLowerCase().includes("chinese")
    ? ["Vi", "Chinese"]
    : ["Vi", "En"];
}

function getSpeechRecognitionConstructor() {
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return (
    speechWindow.SpeechRecognition ??
    speechWindow.webkitSpeechRecognition ??
    null
  );
}

function getVoiceErrorText(error: string) {
  if (error === "not-allowed" || error === "service-not-allowed") {
    return "Mic permission is blocked.";
  }
  if (error === "no-speech") {
    return "No speech detected.";
  }
  if (error === "audio-capture") {
    return "Mic is unavailable.";
  }
  return "Voice input stopped.";
}

function getVoiceBotReply(text: string) {
  if (text.toLocaleLowerCase("vi-VN").includes("chào")) {
    return "Xin chào.";
  }

  return "Đã nghe.";
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
  const [bluetoothDeviceIndex, setBluetoothDeviceIndex] = useState(0);
  const [devicePicker, setDevicePicker] = useState<"bluetooth" | null>(null);
  const [wifiSetupOpen, setWifiSetupOpen] = useState(false);
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
  const [launcherSurface, setLauncherSurface] =
    useState<LauncherSurface>("home");
  const [activeAppId, setActiveAppId] = useState<number | null>(null);
  const [translatePanelActive, setTranslatePanelActive] = useState(false);
  const [translatePanelClosing, setTranslatePanelClosing] = useState(false);
  const [voicePanelActive, setVoicePanelActive] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceInterimText, setVoiceInterimText] = useState("");
  const [voiceErrorText, setVoiceErrorText] = useState("");
  const [voiceMessages, setVoiceMessages] = useState<VoiceMessage[]>([]);
  const launcherPointerStartXRef = useRef<number | null>(null);
  const launcherPointerIdRef = useRef<number | null>(null);
  const suppressLauncherClickRef = useRef(false);
  const translateLastTapAtRef = useRef(0);
  const translateOpenFrameRef = useRef<number | null>(null);
  const translateCloseTimerRef = useRef<number | null>(null);
  const voiceLastTapAtRef = useRef(0);
  const voiceRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceMessageIdRef = useRef(0);
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

  useEffect(() => {
    return () => {
      if (voiceRecognitionRef.current) {
        voiceRecognitionRef.current.onstart = null;
        voiceRecognitionRef.current.onend = null;
        voiceRecognitionRef.current.onerror = null;
        voiceRecognitionRef.current.onresult = null;
        voiceRecognitionRef.current.abort();
        voiceRecognitionRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (translateOpenFrameRef.current !== null) {
        window.cancelAnimationFrame(translateOpenFrameRef.current);
      }
      if (translateCloseTimerRef.current !== null) {
        window.clearTimeout(translateCloseTimerRef.current);
      }
    };
  }, []);

  const state = STATES[stateIndex];
  const showDock = state.key === "black";
  const textFont = TEXT_FONTS[textFontIndex] ?? TEXT_FONTS[0];
  const textPaint = TEXT_PAINTS[textPaintIndex] ?? TEXT_PAINTS[0];
  const translateMode = TRANSLATE_MODES[translateModeIndex] ?? TRANSLATE_MODES[0];
  const wakeSound = WAKE_SOUNDS[wakeSoundIndex] ?? WAKE_SOUNDS[0];
  const bluetoothDevice =
    BLUETOOTH_DEVICE_OPTIONS[bluetoothDeviceIndex] ?? BLUETOOTH_DEVICE_OPTIONS[0];
  const pressBoot = () => setStateIndex((i) => (i + 1) % STATES.length);
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
    setWifiSetupOpen(false);
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
    setWifiSetupOpen(false);
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
    setWifiSetupOpen(false);
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
  const openDevicePicker = (kind: "bluetooth") => {
    stopWakeSoundPreview();
    setWifiSetupOpen(false);
    setWakeSoundPickerOpen(false);
    setBackgroundGalleryOpen(false);
    setTextStyleOpen(false);
    setDevicePicker(kind);
  };
  const openWifiSetup = () => {
    stopWakeSoundPreview();
    setDevicePicker(null);
    setWakeSoundPickerOpen(false);
    setBackgroundGalleryOpen(false);
    setTextStyleOpen(false);
    setOffline(true);
    setWifiSetupOpen(true);
  };
  const closeWifiSetup = () => setWifiSetupOpen(false);
  const closeDevicePicker = () => setDevicePicker(null);
  const selectDevice = (index: number) => {
    setBluetoothDeviceIndex(index);
    setBtAvailable(true);
    setDevicePicker(null);
  };
  const forceLowBattery = () => {
    setBatteryLevel(0.1);
    setBatteryCharging(false);
    setLowBatteryNoticeVisible(false);
    window.setTimeout(() => setLowBatteryNoticeVisible(true), 0);
  };
  const stopVoiceRecognition = () => {
    const recognition = voiceRecognitionRef.current;
    if (!recognition) {
      setVoiceListening(false);
      return;
    }

    recognition.onstart = null;
    recognition.onend = null;
    recognition.onerror = null;
    recognition.onresult = null;
    try {
      recognition.stop();
    } catch {
      recognition.abort();
    }
    voiceRecognitionRef.current = null;
    setVoiceListening(false);
    setVoiceInterimText("");
  };
  const closeVoicePanel = () => {
    stopVoiceRecognition();
    setVoicePanelActive(false);
    setVoiceInterimText("");
    setVoiceErrorText("");
  };
  const startVoiceRecognition = () => {
    const Recognition = getSpeechRecognitionConstructor();
    setVoicePanelActive(true);
    setVoiceErrorText("");
    setVoiceInterimText("");

    if (!Recognition) {
      setVoiceListening(false);
      setVoiceErrorText("Voice input is unavailable.");
      return;
    }

    stopVoiceRecognition();

    const recognition = new Recognition();
    recognition.lang = "vi-VN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setVoiceListening(true);
      setVoiceErrorText("");
    };
    recognition.onend = () => {
      if (voiceRecognitionRef.current === recognition) {
        voiceRecognitionRef.current = null;
      }
      setVoiceListening(false);
      setVoiceInterimText("");
    };
    recognition.onerror = (event) => {
      setVoiceListening(false);
      setVoiceInterimText("");
      setVoiceErrorText(getVoiceErrorText(event.error));
    };
    recognition.onresult = (event) => {
      const finalSegments: string[] = [];
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result || result.length === 0) continue;

        const transcript = result[0].transcript.trim();
        if (!transcript) continue;

        if (result.isFinal) {
          finalSegments.push(transcript);
        } else {
          interim = `${interim} ${transcript}`.trim();
        }
      }

      if (finalSegments.length > 0) {
        setVoiceMessages((items) => [
          ...items,
          ...finalSegments.flatMap((text) => [
            {
              id: ++voiceMessageIdRef.current,
              role: "user" as const,
              text,
            },
            {
              id: ++voiceMessageIdRef.current,
              role: "bot" as const,
              text: getVoiceBotReply(text),
            },
          ]),
        ].slice(-10));
      }
      setVoiceInterimText(interim);
    };

    voiceRecognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      voiceRecognitionRef.current = null;
      setVoiceListening(false);
      setVoiceErrorText("Voice input could not start.");
    }
  };
  const clearTranslateCloseTimer = () => {
    if (translateCloseTimerRef.current === null) return;
    window.clearTimeout(translateCloseTimerRef.current);
    translateCloseTimerRef.current = null;
  };
  const clearTranslateOpenFrame = () => {
    if (translateOpenFrameRef.current === null) return;
    window.cancelAnimationFrame(translateOpenFrameRef.current);
    translateOpenFrameRef.current = null;
  };
  const openTranslatePanel = () => {
    clearTranslateOpenFrame();
    clearTranslateCloseTimer();
    closeVoicePanel();
    translateLastTapAtRef.current = 0;
    setActiveAppId(null);
    setLauncherSurface("home");
    setTranslateSide("center");
    setTranslatePanelClosing(false);
    setTranslatePanelActive(false);

    translateOpenFrameRef.current = window.requestAnimationFrame(() => {
      translateOpenFrameRef.current = window.requestAnimationFrame(() => {
        translateOpenFrameRef.current = null;
        setTranslatePanelActive(true);
      });
    });
  };
  const closeTranslatePanel = (instant = false) => {
    clearTranslateOpenFrame();
    clearTranslateCloseTimer();
    translateLastTapAtRef.current = 0;

    if (!translatePanelActive) {
      setTranslatePanelClosing(false);
      return;
    }

    if (instant) {
      setTranslatePanelActive(false);
      setTranslatePanelClosing(false);
      return;
    }

    setTranslatePanelClosing(true);
    translateCloseTimerRef.current = window.setTimeout(() => {
      setTranslatePanelActive(false);
      setTranslatePanelClosing(false);
      translateCloseTimerRef.current = null;
    }, 720);
  };
  const handleVoiceSurfaceTap = () => {
    const now = window.performance.now();

    if (translatePanelActive) {
      const previousTranslateTapAt = translateLastTapAtRef.current;
      if (!translatePanelClosing && now - previousTranslateTapAt <= 360) {
        closeTranslatePanel();
        return;
      }

      translateLastTapAtRef.current = now;
      return;
    }

    const previousTapAt = voiceLastTapAtRef.current;

    if (voicePanelActive) {
      if (now - previousTapAt <= 360) {
        voiceLastTapAtRef.current = 0;
        closeVoicePanel();
        return;
      }

      voiceLastTapAtRef.current = now;
      return;
    }

    voiceLastTapAtRef.current = now;
    startVoiceRecognition();
  };
  const openLauncherApp = (id: number) => {
    if (id === 4) {
      openTranslatePanel();
      return;
    }

    closeVoicePanel();
    closeTranslatePanel(true);
    setActiveAppId(id);
    setLauncherSurface("drawer");
  };
  const goBackToAppDrawer = () => {
    closeVoicePanel();
    closeTranslatePanel(true);
    setActiveAppId(null);
    setLauncherSurface("drawer");
  };
  const suppressNextLauncherClick = () => {
    suppressLauncherClickRef.current = true;
    window.setTimeout(() => {
      suppressLauncherClickRef.current = false;
    }, 180);
  };
  const handleLauncherSwipe = (deltaX: number) => {
    if (activeAppId !== null) return;
    if (deltaX < -36) {
      closeVoicePanel();
      closeTranslatePanel(true);
      setLauncherSurface((surface) =>
        surface === "drawer" ? "home" : "calendar"
      );
      suppressNextLauncherClick();
    } else if (deltaX > 36) {
      closeVoicePanel();
      closeTranslatePanel(true);
      setLauncherSurface((surface) =>
        surface === "calendar" ? "home" : "drawer"
      );
      suppressNextLauncherClick();
    }
  };
  const handleLauncherPointerDown = (
    event: React.PointerEvent<HTMLElement>
  ) => {
    if (!event.isPrimary) return;
    launcherPointerStartXRef.current = event.clientX;
    launcherPointerIdRef.current = event.pointerId;
  };
  const handleLauncherPointerUp = (
    event: React.PointerEvent<HTMLElement>
  ) => {
    if (
      launcherPointerIdRef.current !== null &&
      event.pointerId !== launcherPointerIdRef.current
    ) {
      return;
    }

    const startX = launcherPointerStartXRef.current;
    launcherPointerStartXRef.current = null;
    launcherPointerIdRef.current = null;
    if (startX === null) return;

    handleLauncherSwipe(event.clientX - startX);
  };
  const handleLauncherPointerCancel = () => {
    launcherPointerStartXRef.current = null;
    launcherPointerIdRef.current = null;
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

            {/* Launcher = orb home, app drawer, and full-screen app pages. */}
            <div
              aria-hidden={!showDock}
              className="ds02-launcher absolute inset-0 transition-[background-color,color,opacity] duration-200"
              style={{
                opacity: showDock ? 1 : 0,
                pointerEvents: showDock ? "auto" : "none",
              }}
            >
              {showDock && (
                <LauncherPage
                  surface={launcherSurface}
                  activeAppId={activeAppId}
                  onOpenApp={(id) => {
                    if (!suppressLauncherClickRef.current) {
                      openLauncherApp(id);
                    }
                  }}
                  onBack={goBackToAppDrawer}
                  translatePanelActive={translatePanelActive}
                  translatePanelClosing={translatePanelClosing}
                  voicePanelActive={voicePanelActive}
                  voiceListening={voiceListening}
                  voiceMessages={voiceMessages}
                  voiceInterimText={voiceInterimText}
                  voiceErrorText={voiceErrorText}
                  onVoiceTap={() => {
                    if (!suppressLauncherClickRef.current) {
                      handleVoiceSurfaceTap();
                    }
                  }}
                  onPointerDown={handleLauncherPointerDown}
                  onPointerUp={handleLauncherPointerUp}
                  onPointerCancel={handleLauncherPointerCancel}
                  translateSide={translateSide}
                  onSelectTranslateSide={setTranslateSide}
                  settings={{
                    offline,
                    wifiDeviceName: "Connected",
                    onConfigureWifi: openWifiSetup,
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
                title="Bluetooth devices"
                options={BLUETOOTH_DEVICE_OPTIONS}
                currentIndex={bluetoothDeviceIndex}
                onSelect={selectDevice}
                onClose={closeDevicePicker}
              />
            )}

            {wifiSetupOpen && (
              <WifiSetupModal
                ssid={WIFI_CONFIG_AP.ssid}
                password={WIFI_CONFIG_AP.password}
                url={WIFI_CONFIG_AP.url}
                onClose={closeWifiSetup}
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

function WifiSetupModal({
  ssid,
  password,
  url,
  onClose,
}: {
  ssid: string;
  password: string;
  url: string;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Wi-Fi setup"
      className="absolute inset-0 z-[70] grid place-items-center bg-[#061018] px-4 text-white"
      onClick={onClose}
    >
      <div
        className="grid w-full max-w-[292px] gap-3 text-center"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between text-left">
          <div className="text-[13px] font-bold leading-none text-white">
            Wi-Fi setup
          </div>
          <button
            type="button"
            aria-label="Close Wi-Fi setup"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-md text-white/75 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <X size={15} aria-hidden />
          </button>
        </div>

        <div className="text-[11px] font-semibold leading-snug text-slate-400">
          Vao Wi-Fi cua ban, tim mang:
        </div>
        <div className="truncate text-[18px] font-black leading-none text-cyan-300">
          {ssid}
        </div>
        <div className="truncate text-[12px] font-bold leading-none text-slate-100">
          Pass: {password}
        </div>
        <div className="pt-2 text-[11px] font-semibold leading-snug text-slate-400">
          Sau do mo link:
        </div>
        <div className="break-all text-[14px] font-black leading-tight text-emerald-300">
          {url}
        </div>
        <div className="text-[10px] font-semibold leading-snug text-slate-400">
          Trang nay se quet Wi-Fi va luu mat khau vao mach.
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
  1: { title: "Teach", body: "Bai hoc, tro giang va luyen tap." },
  2: { title: "Code", body: "Code, terminal, cài đặt debug…" },
  3: { title: "Record", body: "Ghi âm và lưu lại giọng nói." },
  4: { title: "Translate", body: "Vi <-> Chinese / Vi <-> En" },
  5: { title: "Music", body: "Chưa có bài hát nào đang phát." },
  6: { title: "Settings", body: "Wi-Fi, âm thanh, hiển thị, ngôn ngữ…" },
};

type LauncherAppItem = {
  id: number;
  label: string;
  icon: ReactNode;
};

const APP_ITEMS: LauncherAppItem[] = [
  { id: 1, icon: <BookOpen size={24} />, label: "Teach" },
  { id: 2, icon: <Terminal size={24} />, label: "Code" },
  { id: 3, icon: <Mic2 size={24} />, label: "Record" },
  { id: 4, icon: <Languages size={24} />, label: "Translate" },
  { id: 5, icon: <Music size={24} />, label: "Music" },
  { id: 6, icon: <Settings size={24} />, label: "Settings" },
];

function LauncherPage({
  surface,
  activeAppId,
  onOpenApp,
  onBack,
  translatePanelActive,
  translatePanelClosing,
  voicePanelActive,
  voiceListening,
  voiceMessages,
  voiceInterimText,
  voiceErrorText,
  onVoiceTap,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  translateSide,
  onSelectTranslateSide,
  settings,
}: {
  surface: LauncherSurface;
  activeAppId: number | null;
  onOpenApp: (id: number) => void;
  onBack: () => void;
  translatePanelActive: boolean;
  translatePanelClosing: boolean;
  voicePanelActive: boolean;
  voiceListening: boolean;
  voiceMessages: VoiceMessage[];
  voiceInterimText: string;
  voiceErrorText: string;
  onVoiceTap: () => void;
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void;
  translateSide: TranslateSide;
  onSelectTranslateSide: (side: TranslateSide) => void;
  settings: Ds02SettingsPanelProps;
}) {
  const activeApp =
    activeAppId === null || activeAppId === 4
      ? null
      : APP_ITEMS.find((item) => item.id === activeAppId) ?? null;

  if (activeApp) {
    return (
      <AppDetailScreen
        app={activeApp}
        onBack={onBack}
        translateSide={translateSide}
        onSelectTranslateSide={onSelectTranslateSide}
        settings={settings}
      />
    );
  }

  if (surface === "drawer") {
    return (
      <AppDrawer
        apps={APP_ITEMS}
        onOpenApp={onOpenApp}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      />
    );
  }

  if (surface === "calendar") {
    return (
      <CalendarPanel
        theme={settings.theme}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      />
    );
  }

  return (
    <LauncherHome
      voicePanelActive={voicePanelActive}
      voiceListening={voiceListening}
      voiceMessages={voiceMessages}
      voiceInterimText={voiceInterimText}
      voiceErrorText={voiceErrorText}
      translatePanelActive={translatePanelActive}
      translatePanelClosing={translatePanelClosing}
      translateSide={translateSide}
      translateLanguages={getTranslateLanguages(settings.translateModeName)}
      onSelectTranslateSide={onSelectTranslateSide}
      onVoiceTap={onVoiceTap}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    />
  );
}

function CalendarPanel({
  theme,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
}: {
  theme: Ds02Theme;
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void;
}) {
  return (
    <div
      className="ds02-calendar-panel"
      data-theme={theme}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <Calendar compact theme={theme} className="px-2 pt-1" />
    </div>
  );
}

function LauncherHome({
  voicePanelActive,
  voiceListening,
  voiceMessages,
  voiceInterimText,
  voiceErrorText,
  translatePanelActive,
  translatePanelClosing,
  translateSide,
  translateLanguages,
  onSelectTranslateSide,
  onVoiceTap,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
}: {
  voicePanelActive: boolean;
  voiceListening: boolean;
  voiceMessages: VoiceMessage[];
  voiceInterimText: string;
  voiceErrorText: string;
  translatePanelActive: boolean;
  translatePanelClosing: boolean;
  translateSide: TranslateSide;
  translateLanguages: [string, string];
  onSelectTranslateSide: (side: TranslateSide) => void;
  onVoiceTap: () => void;
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void;
}) {
  const voiceChatRef = useRef<HTMLSpanElement | null>(null);
  const hasVoiceCopy =
    voiceMessages.length > 0 || voiceInterimText.length > 0 || voiceErrorText.length > 0;

  useEffect(() => {
    const chat = voiceChatRef.current;
    if (!voicePanelActive || !chat) return;

    chat.scrollTop = chat.scrollHeight;
  }, [voicePanelActive, voiceMessages.length, voiceInterimText, voiceErrorText]);

  const homeClassName = [
    "ds02-home-orb-screen",
    voicePanelActive ? "is-voice-active" : "",
    voiceListening ? "is-listening" : "",
    translatePanelActive ? "is-translate-active" : "",
    translatePanelClosing ? "is-translate-closing" : "",
    translatePanelActive && translateSide === "left" ? "is-translate-left" : "",
    translatePanelActive && translateSide === "right" ? "is-translate-right" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={translatePanelActive ? "Translate mode" : "Voice input"}
      aria-pressed={voicePanelActive || translatePanelActive}
      className={homeClassName}
      onClick={onVoiceTap}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onVoiceTap();
      }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <button
        type="button"
        className="ds02-translate-language is-left"
        aria-label={`Move orb to ${translateLanguages[0]}`}
        onClick={(event) => {
          event.stopPropagation();
          onSelectTranslateSide("left");
        }}
      >
        {translateLanguages[0]}
      </button>
      <button
        type="button"
        className="ds02-translate-language is-right"
        aria-label={`Move orb to ${translateLanguages[1]}`}
        onClick={(event) => {
          event.stopPropagation();
          onSelectTranslateSide("right");
        }}
      >
        {translateLanguages[1]}
      </button>
      <span className="ds02-translate-line" aria-hidden />
      <span className="ds02-voice-frame">
        <span className="profile-avatar-stage ds02-home-orb-stage">
          <span className="profile-avatar-orb" aria-hidden>
            <span className="profile-avatar-cloud profile-avatar-cloud-a" />
            <span className="profile-avatar-cloud profile-avatar-cloud-b" />
            <span className="profile-avatar-cloud profile-avatar-cloud-c" />
          </span>
        </span>
        {voicePanelActive && (
          <span ref={voiceChatRef} className="ds02-voice-chat" aria-live="polite">
            {hasVoiceCopy ? (
              <>
                {voiceMessages.map((message) => (
                  <span
                    key={message.id}
                    className={`ds02-voice-message is-${message.role}`}
                  >
                    {message.text}
                  </span>
                ))}
                {voiceInterimText && (
                  <span className="ds02-voice-message is-user is-interim">
                    {voiceInterimText}
                  </span>
                )}
                {voiceErrorText && (
                  <span className="ds02-voice-message is-bot is-error">
                    {voiceErrorText}
                  </span>
                )}
              </>
            ) : (
              <span className="ds02-voice-idle" aria-hidden>
                <span />
                <span />
                <span />
              </span>
            )}
          </span>
        )}
      </span>
    </div>
  );
}

function AppDrawer({
  apps,
  onOpenApp,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
}: {
  apps: LauncherAppItem[];
  onOpenApp: (id: number) => void;
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void;
}) {
  return (
    <div
      className="ds02-app-drawer"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div className="ds02-app-grid">
        {apps.map((app) => (
          <button
            key={app.id}
            type="button"
            className="ds02-app-button"
            onClick={() => onOpenApp(app.id)}
            aria-label={app.label}
          >
            <span className="ds02-app-icon-bubble" aria-hidden>
              {app.icon}
            </span>
            <span className="ds02-app-label">{app.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AppDetailScreen({
  app,
  onBack,
  translateSide,
  onSelectTranslateSide,
  settings,
}: {
  app: LauncherAppItem;
  onBack: () => void;
  translateSide: TranslateSide;
  onSelectTranslateSide: (side: TranslateSide) => void;
  settings: Ds02SettingsPanelProps;
}) {
  return (
    <div className="ds02-app-detail" data-theme={settings.theme}>
      {app.id === 6 && (
        <div className="ds02-app-header-title">Settings</div>
      )}

      <button
        type="button"
        className="ds02-app-back-button"
        aria-label="Back"
        onClick={onBack}
      >
        <ArrowLeft size={15} aria-hidden />
      </button>

      <div className="ds02-app-content">
        {app.id === 4 ? (
          <ProfileAvatar3D
            speaking={false}
            theme={settings.theme}
            translateModeName={settings.translateModeName}
            activeSide={translateSide}
            onSelectSide={onSelectTranslateSide}
          />
        ) : app.id === 6 ? (
          <Ds02SettingsPanel {...settings} />
        ) : (
          <div className="ds02-app-placeholder">
            <div className="ds02-app-placeholder-title">
              {TAB_PAGES[app.id]?.title ?? app.label}
            </div>
            <div className="ds02-app-placeholder-body">
              {TAB_PAGES[app.id]?.body ?? ""}
            </div>
          </div>
        )}
      </div>
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
