import { describe, expect, test } from "bun:test"
import { safeUrl } from "../src/cli/open.ts"

describe("safeUrl (Greptile P1 — https-only boundary)", () => {
  test.each([
    ["https://dashboard.stripe.com", true],
    ["http://localhost:4983", true],
    ["http://127.0.0.1:5555/studio", true],
    ["http://evil.example.com", false],
    ["file:///etc/passwd", false],
    ["vscode://malicious/payload", false],
    ["--new-window=https://x.com", false],
    ["javascript:alert(1)", false],
    ["not a url", false],
  ])("%s → %p", (url, expected) => {
    expect(safeUrl(url)).toBe(expected)
  })
})
