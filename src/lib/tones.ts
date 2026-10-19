// Colour tones for statuses, task types and priorities (spec 09). Display only, and the label is always
// shown next to the colour, so colour is never the only signal.
// Shared meaning across features: not started = violet, in progress = blue, on hold = amber, done = green,
// stopped or blocked = red.
export type Tone = 'violet' | 'blue' | 'amber' | 'green' | 'red' | 'sky' | 'orange' | 'slate'

// Tinted fill with dark text (light text in dark mode), both above 4.5:1.
export const TONE_BADGE_CLASSES: Record<Tone, string> = {
  violet: 'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200',
  amber: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
  green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
  red: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200',
  sky: 'bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-200',
  orange: 'bg-orange-100 text-orange-900 dark:bg-orange-500/20 dark:text-orange-200',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200',
}

// The badge's leading dot, and the dot in select options.
export const TONE_DOT_CLASSES: Record<Tone, string> = {
  violet: 'bg-violet-500',
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  green: 'bg-emerald-500',
  red: 'bg-red-500',
  sky: 'bg-sky-500',
  orange: 'bg-orange-500',
  slate: 'bg-slate-400',
}

// Solid fill behind a white icon (task types): every fill is above 3:1 against white.
export const TONE_SOLID_CLASSES: Record<Tone, string> = {
  violet: 'bg-violet-600',
  blue: 'bg-blue-600',
  amber: 'bg-amber-600',
  green: 'bg-emerald-600',
  red: 'bg-red-600',
  sky: 'bg-sky-600',
  orange: 'bg-orange-600',
  slate: 'bg-slate-500',
}

// An icon on the page background (priorities).
export const TONE_TEXT_CLASSES: Record<Tone, string> = {
  violet: 'text-violet-600 dark:text-violet-400',
  blue: 'text-blue-600 dark:text-blue-400',
  amber: 'text-amber-600 dark:text-amber-400',
  green: 'text-emerald-600 dark:text-emerald-400',
  red: 'text-red-600 dark:text-red-400',
  sky: 'text-sky-600 dark:text-sky-400',
  orange: 'text-orange-600 dark:text-orange-400',
  slate: 'text-slate-500 dark:text-slate-400',
}
