// Line glyphs from Lucide, by what they stand for.

import Calendar from "@lucide/svelte/icons/calendar";
import Info from "@lucide/svelte/icons/info";
import Pause from "@lucide/svelte/icons/pause";
import Play from "@lucide/svelte/icons/play";
import Search from "@lucide/svelte/icons/search";
import Settings from "@lucide/svelte/icons/settings";
import X from "@lucide/svelte/icons/x";
import type { Component } from "svelte";

export const icons = {
  calendar: Calendar,
  close: X,
  info: Info,
  pause: Pause,
  play: Play,
  search: Search,
  settings: Settings,
} satisfies Record<string, Component>;

export type IconName = keyof typeof icons;
