import { LogIn } from "lucide-react"
import { useLocation, useSearch } from "wouter"
import { TaxaLogo } from "../app/TaxaLogo.tsx"
import styles from "./SignInPage.module.css"
import { signInPageTestIds } from "./SignInPageTestIds.ts"
import { signInHref, signInProblem } from "./sign-in.ts"

/** What a browser that isn't signed in sees, wherever it was going: it comes back there after. */
export const SignInPage = () => {
  const [path] = useLocation()
  const search = useSearch()
  const problem = signInProblem(search)
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.brand}>
          <TaxaLogo size={28} />
          Taxa
        </p>
        <h1 className={styles.heading}>Sign in</h1>
        <p className={styles.lede}>With the Google account Taxa knows you by.</p>
        {problem && (
          <p className={styles.problem} role="alert" data-testid={signInPageTestIds.problem}>
            {problem}
          </p>
        )}
        <a
          className={styles.signIn}
          href={signInHref(path, search ? `?${search}` : "")}
          data-testid={signInPageTestIds.signIn}
          data-track="SignInPage.signIn"
        >
          <LogIn size={18} aria-hidden />
          Sign in with Google
        </a>
      </section>
    </main>
  )
}
