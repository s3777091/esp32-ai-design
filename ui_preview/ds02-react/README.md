# DS-02 UI Preview (React + shadcn)

React port of the plain HTML preview in `../ds02/`. Recreates the standby screen
and replaces the previously-empty black "device menu" with a 3D **TiltedDock**
(Home / Search / Alerts / Profile / Settings).

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS v3 (with the shadcn CSS variables)
- shadcn/ui structure (`components/ui/`, `lib/utils.ts`)
- framer-motion (dock tilt / hover), lucide-react (icons),
  @radix-ui/react-slot, class-variance-authority, @radix-ui/react-tooltip

## Install & run

```bash
cd tools/ui_preview/ds02-react
npm install
npm run dev
```

Vite serves at <http://localhost:5173> by default. Press **Press GPIO0** to
cycle through `dim → awake → black`; the third state reveals the TiltedDock
over the device screen.

## Why `components/ui/`

shadcn ships components via the CLI into `src/components/ui/` (or whichever
folder is configured). The CLI also writes the import alias `@/components/ui/...`
into its registry, and every copy-pasted shadcn snippet — including the
`TiltedDock` integration — assumes that exact path. Keeping the default
`src/components/ui/` lets new components be added with `npx shadcn@latest add
<component>` without re-pointing imports or rewriting the `components.json`.

## Where things live

```
src/
  index.css                       # Tailwind + shadcn CSS variables
  main.tsx                        # entry, mounts <Ds02Preview />
  lib/utils.ts                    # cn() — clsx + tailwind-merge
  components/
    ui/
      button.tsx                  # shadcn button primitive
      tooltip.tsx                 # shadcn tooltip primitive
      tilted-dock.tsx             # the dock from the task brief
      demo.tsx                    # standalone <TiltedDock /> demo
    ds02/
      Ds02Preview.tsx             # full DS-02 screen wired to TiltedDock
      ds02.css                    # standby wallpaper + state transitions
```

The plain HTML/JS preview under `../ds02/` is left untouched.
