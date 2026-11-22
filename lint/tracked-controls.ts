// The parts of the ESTree nodes this rule reads.
interface Node {
  type: string
}

interface JsxAttribute extends Node {
  name?: { name?: string }
}

interface JsxOpeningElement extends Node {
  name: { type: string; name?: string }
  attributes: JsxAttribute[]
}

interface RuleContext {
  report: (problem: { node: Node; message: string }) => void
}

const CONTROLS = new Set(["button", "input", "textarea", "select", "dialog"])

/** The problem with a JSX element, if it's a control that doesn't say what it's for. */
export const trackProblem = (element: string, attributes: readonly string[]): string | undefined =>
  CONTROLS.has(element) && !attributes.includes("data-track")
    ? `<${element}> needs data-track="Component.what" for analytics, or data-track="" if its component tracks it.`
    : undefined

/** Every button, field and dialog says what it's for, so the app's analytics track it (CLAUDE.md). */
const trackedControls = {
  meta: { type: "problem", schema: [] },
  create(context: RuleContext) {
    return {
      JSXOpeningElement(node: JsxOpeningElement): void {
        if (node.name.type !== "JSXIdentifier" || node.name.name === undefined) return
        const attributes = node.attributes.flatMap((attribute) =>
          attribute.type === "JSXAttribute" && attribute.name?.name ? [attribute.name.name] : []
        )
        const problem = trackProblem(node.name.name, attributes)
        if (problem) context.report({ node, message: problem })
      }
    }
  }
}

export default { meta: { name: "tracking" }, rules: { "tracked-controls": trackedControls } }
