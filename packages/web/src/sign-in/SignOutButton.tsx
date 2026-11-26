import { LogOut } from "lucide-react"
import { useMe } from "../tasks/task-queries.ts"
import styles from "./SignOutButton.module.css"
import { signOutButtonTestIds } from "./SignOutButtonTestIds.ts"
import { signOut } from "./sign-in.ts"

/** At the foot of the sidebar, for a browser signed in through Google: not in development, where no one signs in. */
export const SignOutButton = () => {
  const me = useMe()
  if (!me.data?.signedIn) return undefined
  return (
    <button
      type="button"
      className={styles.signOut}
      onClick={() => void signOut()}
      data-testid={signOutButtonTestIds.signOut}
      data-track="SignOutButton.signOut"
    >
      <LogOut size={16} aria-hidden />
      Sign out {me.data.user.name}
    </button>
  )
}
