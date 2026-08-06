import { describe, expect, test } from "bun:test"
import { upsertAgentsBlock, upsertSessionStartHook, upsertStopHook } from "../src/cli/agent.ts"

describe("agent install idempotence", () => {
  test("AGENTS.md block: created, appended, replaced in place — never duplicated", () => {
    const fresh = upsertAgentsBlock(undefined)
    expect(fresh).toContain("<!-- itaca:begin -->")

    const withExisting = upsertAgentsBlock("# my project\n\nsome docs\n")
    expect(withExisting).toStartWith("# my project")
    expect(withExisting.match(/itaca:begin/g)).toHaveLength(1)

    const twice = upsertAgentsBlock(withExisting)
    expect(twice.match(/itaca:begin/g)).toHaveLength(1)
    expect(twice).toStartWith("# my project")
  })

  test("SessionStart hook added once, existing hooks preserved", () => {
    const settings = upsertSessionStartHook({
      hooks: {
        SessionStart: [{ hooks: [{ type: "command", command: "echo existing" }] }],
        Stop: [{ hooks: [{ type: "command", command: "echo stop" }] }],
      },
      model: "opus",
    })
    expect(settings.hooks?.SessionStart).toHaveLength(2)
    expect(settings.model).toBe("opus")
    expect(settings.hooks?.Stop).toHaveLength(1)

    const again = upsertSessionStartHook(settings)
    expect(again.hooks?.SessionStart).toHaveLength(2)
  })

  test("Stop hook added once, other people's Stop hooks left alone", () => {
    const settings = upsertStopHook({
      hooks: { Stop: [{ hooks: [{ type: "command", command: "echo mine" }] }] },
    })
    expect(settings.hooks?.Stop).toHaveLength(2)
    expect(settings.hooks?.Stop?.[0]?.hooks[0]?.command).toBe("echo mine")
    expect(upsertStopHook(settings).hooks?.Stop).toHaveLength(2)
  })

  test("both hooks land on a settings file that has none", () => {
    const settings = upsertStopHook(upsertSessionStartHook({}))
    expect(settings.hooks?.SessionStart?.[0]?.hooks[0]?.command).toContain("itaca context")
    expect(settings.hooks?.Stop?.[0]?.hooks[0]?.command).toContain("itaca status check")
  })
})
