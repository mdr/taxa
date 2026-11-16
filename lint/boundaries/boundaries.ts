import { posix } from "node:path"

/** One import, by repo-relative paths. */
export interface Import {
  from: string
  to: string
  typeOnly: boolean
  dynamic: boolean
}

const PACKAGE_NAME = /^@taxa\/(shared|server|web|cli)(\/.*)?$/

/** The repo-relative path an import names, or undefined for an outside package's. */
export const importedPath = (from: string, specifier: string): string | undefined => {
  if (specifier.startsWith(".")) return posix.join(posix.dirname(from), specifier)
  const named = PACKAGE_NAME.exec(specifier)
  return named ? `packages/${named[1]}${named[2] ?? ""}` : undefined
}

const packageOf = (path: string): string | undefined => /^packages\/([^/]+)\//.exec(path)?.[1]

const SERVER_TEST_SUPPORT = "packages/server/src/test-support/"

/** Test code in the web and CLI packages that may start the in-process server. */
const IN_PROCESS_TESTS = /^packages\/web\/browser\/|^packages\/cli\/src\/.*\.iwbt\.ts$/

/** Why an import crosses between the packages where it must not, if it does. */
export const packageProblem = ({ from, to }: Import): string | undefined => {
  const source = packageOf(from)
  const target = packageOf(to)
  if (source === target || target === "shared") return undefined
  if (source === "shared") return "shared is used by every other package, so it imports none of them."
  if (target === "server") {
    if (IN_PROCESS_TESTS.test(from) && to.startsWith(SERVER_TEST_SUPPORT)) return undefined
    return "Only the server imports the server, bar tests using server/src/test-support/ to start an in-process server: move what this needs into shared."
  }
  return `${source} doesn't import ${target}: move what both need into shared.`
}

const TEST_CODE = /(\.test\.tsx?|\.iwbt\.ts)$|\/test-support\/|^packages\/web\/browser\//

/** Why an import brings test helpers into code that ships, if it does. */
export const testSupportProblem = ({ from, to }: Import): string | undefined =>
  to.includes("/test-support/") && !TEST_CODE.test(from)
    ? "Only tests use test-support/: move what this needs out of it."
    : undefined
