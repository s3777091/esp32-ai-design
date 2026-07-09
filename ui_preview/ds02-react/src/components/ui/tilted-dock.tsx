"use client";

import { motion } from "framer-motion";
import { Calendar, Search, Bell, User, Settings, Music } from "lucide-react";
import { useState, type ReactNode } from "react";

const defaultItems: TiltedDockItem[] = [
  { id: 1, icon: <Calendar size={28} />, label: "Lịch" },
  { id: 2, icon: <Search size={28} />, label: "Search" },
  { id: 3, icon: <Bell size={28} />, label: "Alerts" },
  { id: 4, icon: <User size={28} />, label: "Profile" },
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
  /** Items to render. Defaults to the built-in Home / Search / ... / Settings set. */
  items?: TiltedDockItem[];
  /** Currently selected tab id. Visually highlighted as the active tab. */
  activeId?: number;
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
  onSelect,
  children,
}: TiltedDockProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const wrapperClass =
    variant === "inset"
      ? `absolute inset-x-0 bottom-4 z-10 flex justify-center ${className}`
      : `fixed bottom-10 left-1/2 -translate-x-1/2 z-50 ${className}`;

  return (
    <div className={wrapperClass}>
      <motion.div
        className="flex gap-6 px-4 py-2 rounded-2xl
                   backdrop-blur-2xl bg-white/30 dark:bg-black/30
                   border border-white/20 dark:border-white/10
                   shadow-[0_15px_40px_rgba(0,0,0,0.35)] origin-bottom"
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
              className="relative flex flex-col items-center justify-center bg-transparent border-0 p-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-md"
            >
              {/* Icon — color flips when active or hovered. */}
              <motion.div
                animate={{ rotateX: 0, rotateY: 0 }}
                transition={{ type: "spring", stiffness: 150, damping: 15 }}
                className={
                  "scale-[0.85] transition-colors duration-200 " +
                  (isLit
                    ? "text-sky-400 dark:text-sky-300"
                    : "text-gray-900 dark:text-gray-100")
                }
              >
                {item.icon}
              </motion.div>

              {/* Label — always hidden (bottom-tab style). */}
              <motion.span
                className="absolute -bottom-5 text-[10px] font-medium
                           text-gray-800 dark:text-gray-200 whitespace-nowrap"
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
