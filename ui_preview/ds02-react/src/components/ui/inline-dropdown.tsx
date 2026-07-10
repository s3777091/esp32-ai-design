'use client'

import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Bluetooth,
  ChevronRight,
  Image,
  Mic2,
  Moon,
  Palette,
  Sun,
  Volume2,
  Wifi,
  WifiOff,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type Ds02Theme = "light" | "dark";

export interface Ds02SettingsPanelProps {
  offline: boolean;
  onToggleWifi: () => void;
  bluetoothAvailable: boolean | null;
  onToggleBluetooth: () => void;
  volume: number;
  onVolumeChange: (value: number) => void;
  brightness: number;
  onBrightnessChange: (value: number) => void;
  theme: Ds02Theme;
  onToggleTheme: () => void;
  backgroundName: string;
  onChangeBackground: () => void;
  textStyleName: string;
  onChangeTextStyle: () => void;
}

export function Ds02SettingsPanel({
  offline,
  onToggleWifi,
  bluetoothAvailable,
  onToggleBluetooth,
  volume,
  onVolumeChange,
  brightness,
  onBrightnessChange,
  theme,
  onToggleTheme,
  backgroundName,
  onChangeBackground,
  textStyleName,
  onChangeTextStyle,
}: Ds02SettingsPanelProps) {
  const bluetoothOn = bluetoothAvailable === true;
  const isLight = theme === "light";

  return (
    <div
      className={cn(
        "ds02-settings-scroll absolute inset-0 overflow-y-auto px-3 pb-3 pt-2 transition-colors",
        isLight ? "bg-[#f4f6fb] text-slate-950" : "bg-[#050609] text-white"
      )}
    >
      <div className="mb-2 px-1">
        <div>
          <div className="text-[18px] font-semibold leading-none">Settings</div>
          <div
            className={cn(
              "mt-1 text-[10px] font-medium leading-none",
              isLight ? "text-slate-500" : "text-white/45"
            )}
          >
            Runtime preview
          </div>
        </div>
      </div>

      <SettingsGroup theme={theme}>
        <SettingRow
          theme={theme}
          icon={offline ? <WifiOff size={15} /> : <Wifi size={15} />}
          iconClassName={offline ? "bg-rose-500" : "bg-sky-500"}
          title="Wi-Fi"
          detail={offline ? "Disconnected" : "Connected"}
          control={
            <MiniSwitch
              theme={theme}
              checked={!offline}
              onClick={onToggleWifi}
              label="Toggle Wi-Fi"
            />
          }
        />
        <SettingRow
          theme={theme}
          icon={<Bluetooth size={15} />}
          iconClassName="bg-blue-500"
          title="Bluetooth"
          detail={bluetoothOn ? "Available" : "Unavailable"}
          control={
            <MiniSwitch
              theme={theme}
              checked={bluetoothOn}
              onClick={onToggleBluetooth}
              label="Toggle Bluetooth"
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup theme={theme}>
        <SettingRow
          theme={theme}
          icon={<Volume2 size={15} />}
          iconClassName="bg-emerald-500"
          title="Volume"
          detail={`${volume}%`}
          control={
            <CompactRange
              label="Volume"
              value={volume}
              onChange={onVolumeChange}
            />
          }
        />
        <SettingRow
          theme={theme}
          icon={<Sun size={15} />}
          iconClassName="bg-amber-500"
          title="Brightness"
          detail={`${brightness}%`}
          control={
            <CompactRange
              label="Brightness"
              value={brightness}
              min={15}
              max={100}
              onChange={onBrightnessChange}
            />
          }
        />
        <SettingRow
          theme={theme}
          icon={theme === "dark" ? <Moon size={15} /> : <Sun size={15} />}
          iconClassName="bg-violet-500"
          title="Theme"
          detail={theme}
          onClick={onToggleTheme}
          value={<ChevronRight size={14} aria-hidden />}
        />
      </SettingsGroup>

      <SettingsGroup theme={theme}>
        <SettingRow
          theme={theme}
          icon={<Mic2 size={15} />}
          iconClassName="bg-cyan-500"
          title="Wake word"
          detail="hi ekko"
          value="active"
        />
        <SettingRow
          theme={theme}
          icon={<Image size={15} />}
          iconClassName="bg-sky-500"
          title="Change background"
          detail={backgroundName}
          onClick={onChangeBackground}
          value={<ChevronRight size={14} aria-hidden />}
        />
        <SettingRow
          theme={theme}
          icon={<Palette size={15} />}
          iconClassName="bg-fuchsia-500"
          title="Font & text color"
          detail={textStyleName}
          onClick={onChangeTextStyle}
          value={<ChevronRight size={14} aria-hidden />}
        />
      </SettingsGroup>
    </div>
  );
}

export const Component = () => {
  const [offline, setOffline] = useState(false);
  const [bluetoothAvailable, setBluetoothAvailable] = useState(true);
  const [volume, setVolume] = useState(70);
  const [brightness, setBrightness] = useState(75);
  const [theme, setTheme] = useState<Ds02Theme>("light");
  const [backgroundIndex, setBackgroundIndex] = useState(0);
  const [textStyleIndex, setTextStyleIndex] = useState(0);
  const backgrounds = [
    "Mountain",
    "Abstract",
    "Anime Light",
    "Cat Dog Anime",
    "Cat Dog Chill",
    "Cat Dog Sleep",
    "Europe",
    "Fantacy Anime",
    "Follower",
    "Hai Van",
    "JP Temple",
    "Linh Ung Pagoda",
    "Morning Beach",
    "Night Light",
    "Pixel",
    "Romance Anime",
    "Rong River",
    "Rooftop",
    "Rubic",
    "Sa Mac",
  ];
  const textStyles = [
    "Be Vietnam / ProteXa",
    "Noto Sans / Aurora",
    "Segoe UI / Sunrise",
  ];

  return (
    <div className="relative h-[220px] w-[320px] overflow-hidden rounded-lg bg-black">
      <Ds02SettingsPanel
        offline={offline}
        onToggleWifi={() => setOffline((value) => !value)}
        bluetoothAvailable={bluetoothAvailable}
        onToggleBluetooth={() => setBluetoothAvailable((value) => !value)}
        volume={volume}
        onVolumeChange={setVolume}
        brightness={brightness}
        onBrightnessChange={setBrightness}
        theme={theme}
        onToggleTheme={() => setTheme((value) => (value === "light" ? "dark" : "light"))}
        backgroundName={backgrounds[backgroundIndex]}
        onChangeBackground={() =>
          setBackgroundIndex((value) => (value + 1) % backgrounds.length)
        }
        textStyleName={textStyles[textStyleIndex]}
        onChangeTextStyle={() =>
          setTextStyleIndex((value) => (value + 1) % textStyles.length)
        }
      />
    </div>
  );
};

function SettingsGroup({
  children,
  theme,
}: {
  children: ReactNode;
  theme: Ds02Theme;
}) {
  const isLight = theme === "light";

  return (
    <section
      className={cn(
        "mb-2 overflow-hidden rounded-lg border shadow-[0_10px_26px_rgba(0,0,0,0.18)] transition-colors",
        isLight ? "border-slate-200 bg-white" : "border-white/[0.08] bg-white/[0.075]"
      )}
    >
      {children}
    </section>
  );
}

function SettingRow({
  theme,
  icon,
  iconClassName,
  title,
  detail,
  value,
  control,
  onClick,
}: {
  theme: Ds02Theme;
  icon: ReactNode;
  iconClassName: string;
  title: string;
  detail: string;
  value?: ReactNode;
  control?: ReactNode;
  onClick?: () => void;
}) {
  const isLight = theme === "light";
  const content = (
    <>
      <span
        className={cn(
          "grid h-7 w-7 shrink-0 place-items-center rounded-md text-white shadow-sm",
          iconClassName
        )}
        aria-hidden
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span
          className={cn(
            "block truncate text-[12px] font-semibold leading-tight",
            isLight ? "text-slate-950" : "text-white"
          )}
        >
          {title}
        </span>
        <span
          className={cn(
            "mt-0.5 block truncate text-[9px] font-medium leading-tight",
            isLight ? "text-slate-500" : "text-white/45"
          )}
        >
          {detail}
        </span>
      </span>
      {control ?? (
        <span
          className={cn(
            "shrink-0 text-[10px] font-semibold capitalize leading-none",
            isLight ? "text-slate-500" : "text-white/[0.42]"
          )}
        >
          {value}
        </span>
      )}
    </>
  );

  const className = cn(
    "flex min-h-[44px] w-full items-center gap-2 border-t px-2.5 py-2 first:border-t-0 transition-colors",
    isLight ? "border-slate-100" : "border-white/[0.07]"
  );

  if (onClick) {
    return (
      <motion.button
        type="button"
        className={cn(
          className,
          isLight ? "hover:bg-slate-50" : "hover:bg-white/[0.06]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        )}
        whileTap={{ scale: 0.99 }}
        onClick={onClick}
      >
        {content}
      </motion.button>
    );
  }

  return <div className={className}>{content}</div>;
}

function MiniSwitch({
  theme,
  checked,
  onClick,
  label,
}: {
  theme: Ds02Theme;
  checked: boolean;
  onClick: () => void;
  label: string;
}) {
  const isLight = theme === "light";

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={checked}
      onClick={onClick}
      className={cn(
        "relative h-[18px] w-[32px] shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
        checked ? "bg-emerald-400" : isLight ? "bg-slate-300" : "bg-white/20"
      )}
    >
      <motion.span
        className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-sm"
        animate={{ left: checked ? 16 : 2 }}
        transition={{ type: "spring", stiffness: 520, damping: 32 }}
      />
    </button>
  );
}

function CompactRange({
  label,
  value,
  min = 0,
  max = 100,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      aria-label={label}
      className="ds02-settings-range h-5 w-[74px] shrink-0"
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(event) => onChange(Number(event.currentTarget.value))}
    />
  );
}
