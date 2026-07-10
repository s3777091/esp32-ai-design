'use client'

import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Bluetooth,
  ChevronRight,
  Cloud,
  Cpu,
  Mic2,
  Moon,
  Signal,
  SlidersHorizontal,
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
  aecEnabled: boolean;
  onToggleAec: () => void;
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
  aecEnabled,
  onToggleAec,
}: Ds02SettingsPanelProps) {
  const bluetoothOn = bluetoothAvailable === true;

  return (
    <div className="ds02-settings-scroll absolute inset-0 overflow-y-auto bg-[#050609] px-3 pb-3 pt-2 text-white">
      <div className="mb-2 flex items-center justify-between px-1">
        <div>
          <div className="text-[18px] font-semibold leading-none">Settings</div>
          <div className="mt-1 text-[10px] font-medium leading-none text-white/45">
            Runtime preview
          </div>
        </div>
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.08] text-cyan-200">
          <SlidersHorizontal size={16} aria-hidden />
        </div>
      </div>

      <SettingsGroup>
        <SettingRow
          icon={offline ? <WifiOff size={15} /> : <Wifi size={15} />}
          iconClassName={offline ? "bg-rose-500" : "bg-sky-500"}
          title="Wi-Fi"
          detail={offline ? "Disconnected" : "Connected"}
          control={
            <MiniSwitch
              checked={!offline}
              onClick={onToggleWifi}
              label="Toggle Wi-Fi"
            />
          }
        />
        <SettingRow
          icon={<Bluetooth size={15} />}
          iconClassName="bg-blue-500"
          title="Bluetooth"
          detail={bluetoothOn ? "Available" : "Unavailable"}
          control={
            <MiniSwitch
              checked={bluetoothOn}
              onClick={onToggleBluetooth}
              label="Toggle Bluetooth"
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingRow
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
          icon={<Sun size={15} />}
          iconClassName="bg-amber-500"
          title="Brightness"
          detail={`${brightness}%`}
          control={
            <CompactRange
              label="Brightness"
              value={brightness}
              onChange={onBrightnessChange}
            />
          }
        />
        <SettingRow
          icon={theme === "dark" ? <Moon size={15} /> : <Sun size={15} />}
          iconClassName="bg-violet-500"
          title="Theme"
          detail={theme}
          onClick={onToggleTheme}
          value={<ChevronRight size={14} aria-hidden />}
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingRow
          icon={<Mic2 size={15} />}
          iconClassName="bg-cyan-500"
          title="Wake word"
          detail="okke"
          value="active"
        />
        <SettingRow
          icon={<Signal size={15} />}
          iconClassName="bg-teal-500"
          title="Device AEC"
          detail={aecEnabled ? "Realtime mode" : "Auto-stop mode"}
          control={
            <MiniSwitch
              checked={aecEnabled}
              onClick={onToggleAec}
              label="Toggle device AEC"
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingRow
          icon={<Cpu size={15} />}
          iconClassName="bg-zinc-500"
          title="Board"
          detail="ESP32-S3 / DS-02"
          value="320x240"
        />
        <SettingRow
          icon={<Cloud size={15} />}
          iconClassName="bg-indigo-500"
          title="OTA"
          detail="Uses server config when available"
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
  const [aecEnabled, setAecEnabled] = useState(true);

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
        aecEnabled={aecEnabled}
        onToggleAec={() => setAecEnabled((value) => !value)}
      />
    </div>
  );
};

function SettingsGroup({ children }: { children: ReactNode }) {
  return (
    <section className="mb-2 overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.075] shadow-[0_10px_26px_rgba(0,0,0,0.24)]">
      {children}
    </section>
  );
}

function SettingRow({
  icon,
  iconClassName,
  title,
  detail,
  value,
  control,
  onClick,
}: {
  icon: ReactNode;
  iconClassName: string;
  title: string;
  detail: string;
  value?: ReactNode;
  control?: ReactNode;
  onClick?: () => void;
}) {
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
        <span className="block truncate text-[12px] font-semibold leading-tight text-white">
          {title}
        </span>
        <span className="mt-0.5 block truncate text-[9px] font-medium leading-tight text-white/45">
          {detail}
        </span>
      </span>
      {control ?? (
        <span className="shrink-0 text-[10px] font-semibold capitalize leading-none text-white/42">
          {value}
        </span>
      )}
    </>
  );

  const className =
    "flex min-h-[44px] w-full items-center gap-2 border-t border-white/[0.07] px-2.5 py-2 first:border-t-0";

  if (onClick) {
    return (
      <motion.button
        type="button"
        className={cn(
          className,
          "hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
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
  checked,
  onClick,
  label,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={checked}
      onClick={onClick}
      className={cn(
        "relative h-[18px] w-[32px] shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
        checked ? "bg-emerald-400" : "bg-white/20"
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
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      aria-label={label}
      className="ds02-settings-range h-5 w-[74px] shrink-0"
      type="range"
      min={0}
      max={100}
      value={value}
      onChange={(event) => onChange(Number(event.currentTarget.value))}
    />
  );
}
