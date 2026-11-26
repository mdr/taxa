import type { Style } from "./style.ts"
import { wrap } from "./style.ts"

const HEADING = /^#{1,6}\s+(.*)$/
const BULLET = /^(\s*)[-*+]\s+(.*)$/
const BOLD = /\*\*([^*]+)\*\*/g
const CODE = /`([^`]+)`/g
const LINK = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g

/** Bold, code and links within a line, as the terminal can show them. */
const inline = (text: string, style: Style): string =>
  text
    .replaceAll(LINK, (_whole, label: string, url: string) => style.link(url, style.cyan(label)))
    .replaceAll(BOLD, (_whole, bold: string) => style.bold(bold))
    .replaceAll(CODE, (_whole, code: string) => style.cyan(code))

/** One line of notes: a heading in bold, a bullet as •, wrapped to fit, the whole indented. */
const noteLine = (line: string, style: Style, indent: string): string => {
  const heading = HEADING.exec(line)
  if (heading) return `${indent}${style.bold(heading[1]!)}`
  const bullet = BULLET.exec(line)
  if (bullet) {
    const hang = `${indent}${bullet[1]!}  `
    return `${indent}${bullet[1]!}• ${inline(wrap(bullet[2]!, style.columns, hang), style)}`
  }
  return line === "" ? "" : `${indent}${inline(wrap(line, style.columns, indent), style)}`
}

/** A task's notes, which are Markdown, drawn for a terminal: headings, bullets, bold, code and links. */
export const markdownText = (notes: string, style: Style, indent = "  "): string =>
  notes
    .trimEnd()
    .split("\n")
    .map((line) => noteLine(line, style, indent))
    .join("\n")
