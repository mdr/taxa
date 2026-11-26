import { UsageError } from "../command.ts"

/** --color: whether to style what's printed for a person. */
export enum ColorChoice {
  /** When printing to a terminal, unless NO_COLOR says not to or FORCE_COLOR says to anyway. */
  AUTO = "auto",
  ALWAYS = "always",
  NEVER = "never"
}

/**
 * How output is drawn. Plain is what agents, pipes and scripts get: the
 * layout they've always had, unchanged. Styled is for a person at a
 * terminal: marks, colour, grouping, and lines cut to the terminal's width.
 */
export interface Style {
  styled: boolean
  /** The terminal's width, when printing to one: lines are cut to fit. */
  columns: number | undefined
  bold: (text: string) => string
  dim: (text: string) => string
  red: (text: string) => string
  orange: (text: string) => string
  amber: (text: string) => string
  green: (text: string) => string
  cyan: (text: string) => string
  violet: (text: string) => string
  /** A link the terminal can open, where it supports them. */
  link: (url: string, text: string) => string
}

const same = (text: string): string => text

export const PLAIN: Style = {
  styled: false,
  columns: undefined,
  bold: same,
  dim: same,
  red: same,
  orange: same,
  amber: same,
  green: same,
  cyan: same,
  violet: same,
  link: (_url, text) => text
}

const ESC = "\u001B"

/** In the terminal's own palette, so it suits its theme; orange from the 256, as the 16 have none. */
const sgr =
  (on: string, off: string) =>
  (text: string): string =>
    text === "" ? text : `${ESC}[${on}m${text}${ESC}[${off}m`

const styled = (columns: number | undefined, links: boolean): Style => ({
  styled: true,
  columns,
  bold: sgr("1", "22"),
  dim: sgr("2", "22"),
  red: sgr("31", "39"),
  orange: sgr("38;5;208", "39"),
  amber: sgr("33", "39"),
  green: sgr("32", "39"),
  cyan: sgr("36", "39"),
  violet: sgr("35", "39"),
  // OSC 8: terminals that don't know it show the text alone.
  link: links ? (url, text) => `${ESC}]8;;${url}${ESC}\\${text}${ESC}]8;;${ESC}\\` : (_url, text) => text
})

const set = (value: string | undefined): boolean => value !== undefined && value !== ""

const forced = (value: string | undefined): boolean => set(value) && value !== "0" && value !== "false"

const COLOR_CHOICES: Record<string, ColorChoice> = Object.fromEntries(
  Object.values(ColorChoice).map((choice) => [choice, choice])
)

export const colorChoiceOf = (option: string | undefined): ColorChoice => {
  if (option === undefined) return ColorChoice.AUTO
  const choice = COLOR_CHOICES[option]
  if (!choice) throw new UsageError(`--color is auto, always or never, not ${JSON.stringify(option)}.`)
  return choice
}

/**
 * Styled for a person at a terminal, plain otherwise: NO_COLOR (no-color.org)
 * and FORCE_COLOR as usual, and --color over both. Links and cutting lines
 * to width need a terminal, so forced colour into a pipe has neither.
 */
export const styleFor = (
  choice: ColorChoice,
  env: Record<string, string | undefined>,
  terminal: { columns: number } | undefined
): Style => {
  const on =
    choice === ColorChoice.AUTO
      ? !set(env["NO_COLOR"]) && (forced(env["FORCE_COLOR"]) || terminal !== undefined)
      : choice === ColorChoice.ALWAYS
  return on ? styled(terminal?.columns, terminal !== undefined) : PLAIN
}

/** What a line takes up on screen: its characters, without the styling. */
// oxlint-disable-next-line no-control-regex
const STYLING = /\u001B\[[\d;]*m|\u001B\]8;;[^\u001B]*\u001B\\/g

const GRAPHEMES = new Intl.Segmenter()

/** What a person sees as one character, an emoji with its modifiers included. */
const graphemes = (text: string): string[] => Array.from(GRAPHEMES.segment(text), ({ segment }) => segment)

export const shownLength = (text: string): number => graphemes(text.replaceAll(STYLING, "")).length

/** Cut plain text to fit `room` characters, ending "…" if it had to. */
export const cut = (text: string, room: number): string => {
  const characters = graphemes(text)
  if (characters.length <= room) return text
  return `${characters
    .slice(0, Math.max(room - 1, 0))
    .join("")
    .trimEnd()}…`
}
