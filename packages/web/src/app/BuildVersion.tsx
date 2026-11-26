import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "../api/query-keys.ts"
import { taxaApi } from "../api/taxa-api.ts"
import styles from "./BuildVersion.module.css"
import { buildVersionTestIds } from "./BuildVersionTestIds.ts"

/** "0.6.0" from a build such as "0.6.0+fa6c57e": the release, without the commit. */
export const releaseOf = (build: string): string => build.split("+")[0] ?? build

/** Which version of Taxa this is, at the foot of the sidebar; the commit too, on hover. */
export const BuildVersion = () => {
  const health = useQuery({ queryKey: queryKeys.health, queryFn: () => taxaApi.health(), staleTime: Infinity })
  if (!health.data) return undefined
  const { build } = health.data
  return (
    <p className={styles.version} title={`Build ${build}`} data-testid={buildVersionTestIds.version}>
      Taxa {releaseOf(build)}
    </p>
  )
}
