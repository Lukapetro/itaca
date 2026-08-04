import { loadRules } from "../core/engine.ts"
import { EXIT } from "../types.ts"
import { cyan, dim, fail, green, red, table } from "../ui.ts"

export async function run(args: string[], json: boolean): Promise<number> {
  const verb = args[0] ?? "list"
  const { rules, issues } = loadRules()

  if (verb === "validate") {
    if (json) {
      console.log(JSON.stringify({ valid: issues.length === 0, rules: rules.length, issues }))
    } else if (issues.length) {
      for (const issue of issues) console.log(`${red("✗")} ${issue.file}: ${issue.message}`)
    } else {
      console.log(`${green("✓")} ${rules.length} rules valid`)
    }
    return issues.length ? EXIT.FAILURE : EXIT.OK
  }

  if (verb !== "list") {
    fail({ code: "usage", message: "usage: itaca rules list|validate" }, json)
    return EXIT.USAGE
  }
  if (json) {
    console.log(
      JSON.stringify(rules.map((r) => ({ id: r.id, service: r.service, category: r.category }))),
    )
    return EXIT.OK
  }
  console.log(table(rules.map((r) => [cyan(r.id), r.service, dim(r.category)])))
  if (issues.length)
    console.log(red(`\n${issues.length} invalid rule file(s) — run: itaca rules validate`))
  return EXIT.OK
}
