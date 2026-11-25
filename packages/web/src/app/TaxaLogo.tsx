import { useId } from "react"
import styles from "./TaxaLogo.module.css"

/** The tag, tilted on its string, as `public/favicon.svg` draws it. */
const TILT = "translate(0 1) rotate(-12 16 17)"

/** Taxa's mark: a specimen tag, ticked, hanging on its string. */
export const TaxaLogo = ({ size }: { size: number }) => {
  const mask = useId()
  return (
    <svg className={styles.logo} width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <mask id={mask}>
        <rect width="32" height="32" fill="#fff" />
        <g transform={TILT}>
          <circle cx="16" cy="8.5" r="2" fill="#000" />
          <path d="M10.5 17.5 14.5 21 21.5 13.5" className={styles.cut} />
        </g>
      </mask>
      <g mask={`url(#${mask})`}>
        <path transform={TILT} d="M8 3.5H24A2.5 2.5 0 0 1 26.5 6V23.5L16 29 5.5 23.5V6A2.5 2.5 0 0 1 8 3.5Z" />
      </g>
      <path transform={TILT} d="M16 8.5V2" className={styles.string} />
    </svg>
  )
}
