"use client";

import { motion } from "framer-motion";
import { BookOpen, Terminal, Mic2, Languages, Settings, Music } from "lucide-react";
import { useState, type ReactNode } from "react";

const defaultItems: TiltedDockItem[] = [
  { id: 1, icon: <BookOpen size={28} />, label: "Teach" },
  { id: 2, icon: <Terminal size={28} />, label: "Code" },
  { id: 3, icon: <Mic2 size={28} />, label: "Record" },
  { id: 4, icon: <Languages size={28} />, label: "Translate" },
  { id: 5, icon: <Music size={28} />, label: "Music" },
  { id: 6, icon: <Settings size={28} />, label: "Settings" },
];

export type TiltedDockItem = {
  id: number;
  icon: ReactNode;
  label: string;
};

type Variant = "fixed" | "inset";

interface TiltedDockProps {
  /**
   * `fixed` (default) — pinned to the viewport like a macOS dock.
   * `inset`  — fills its parent (use when the dock lives inside another
   *            container, e.g. the device-screen preview).
   */
  variant?: Variant;
  /**
   * Scale factor applied to the dock. Useful when mounting inside a small
   * container (the 360px-wide device screen, for instance).
   */
  scale?: number;
  /** Optional override for the wrapper element. */
  className?: string;
  /** Items to render. Defaults to the built-in Home / Code / ... / Settings set. */
  items?: TiltedDockItem[];
  /** Currently selected tab id. Visually highlighted as the active tab. */
  activeId?: number;
  /** Visual theme used when the dock is embedded in a themed surface. */
  theme?: "light" | "dark";
  /** Called when the user clicks a dock item. */
  onSelect?: (id: number) => void;
  children?: ReactNode;
}

export default function TiltedDock({
  variant = "fixed",
  scale = 1,
  className = "",
  items = defaultItems,
  activeId,
  theme = "dark",
  onSelect,
  children,
}: TiltedDockProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const isLight = theme === "light";

  const wrapperClass =
    variant === "inset"
      ? `absolute inset-x-0 bottom-2 z-10 flex justify-center ${className}`
      : `fixed bottom-10 left-1/2 -translate-x-1/2 z-50 ${className}`;

  return (
    <div className={wrapperClass}>
      <motion.div
        className={
          "flex w-[330px] max-w-[92%] justify-between gap-2 rounded-xl border px-3 py-1.5 backdrop-blur-2xl origin-bottom " +
          (isLight
            ? "border-slate-300/80 bg-white/75 shadow-[0_10px_28px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.78),inset_0_-1px_0_rgba(15,23,42,0.06)]"
            : "border-white/[0.14] bg-[rgba(8,14,22,0.66)] shadow-[0_10px_28px_rgba(0,0,0,0.52),inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(255,255,255,0.05)]")
        }
        style={{
          transformStyle: "preserve-3d",
          transform: `scale(${scale})`,
        }}
        animate={{
          rotateX: 18, // static stage tilt
          rotateY: 0, // no parallax — dock stays still
        }}
        transition={{ type: "spring", stiffness: 80, damping: 20 }}
      >
        {items.map((item) => {
          const isHovered = hovered === item.id;
          const isDimmed = hovered !== null && !isHovered;
          const isActive = activeId === item.id;
          const isLit = isActive || isHovered;
          return (
            <motion.button
              key={item.id}
              type="button"
              onClick={() => onSelect?.(item.id)}
              onHoverStart={() => setHovered(item.id)}
              onHoverEnd={() => setHovered(null)}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
              animate={{
                scale: 1,
                z: 0,
                opacity: isDimmed ? 0.5 : 1,
              }}
              transition={{ type: "spring", stiffness: 200, damping: 18 }}
              style={{ transformStyle: "preserve-3d" }}
              className={
                "relative flex h-8 w-8 flex-col items-center justify-center border-0 p-0 cursor-pointer outline-none rounded-md transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-cyan-300 " +
                (isActive
                  ? isLight
                    ? "bg-cyan-500/[0.12] shadow-[inset_0_0_0_1px_rgba(8,145,178,0.28),0_0_14px_rgba(8,145,178,0.14)]"
                    : "bg-cyan-300/[0.10] shadow-[inset_0_0_0_1px_rgba(103,232,249,0.24),0_0_16px_rgba(14,165,233,0.20)]"
                  : isLight
                    ? "bg-transparent hover:bg-slate-900/[0.06]"
                    : "bg-transparent hover:bg-white/[0.06]")
              }
            >
              {/* Icon — color flips when active or hovered. */}
              <motion.div
                animate={{ rotateX: 0, rotateY: 0 }}
                transition={{ type: "spring", stiffness: 150, damping: 15 }}
                className={
                  "scale-[0.72] transition-colors duration-200 " +
                  (isLit
                    ? isLight ? "text-cyan-700" : "text-cyan-300"
                    : isLight ? "text-slate-500" : "text-slate-200/75")
                }
              >
                {item.icon}
              </motion.div>

              {/* Label — always hidden (bottom-tab style). */}
              <motion.span
                className="absolute -bottom-5 text-[10px] font-medium
                           text-slate-200/75 whitespace-nowrap"
                animate={{ opacity: 0, y: 5 }}
                transition={{ duration: 0.3 }}
                aria-hidden
              >
                {item.label}
              </motion.span>
            </motion.button>
          );
        })}
        {children}
      </motion.div>
    </div>
  );
}
