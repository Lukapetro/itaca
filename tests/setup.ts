import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

// Isolate tests from the developer's real user config (~/.config/itaca/rules
// would otherwise change rule counts and golden results).
process.env.XDG_CONFIG_HOME = mkdtempSync(join(tmpdir(), "itaca-test-config-"))
process.env.XDG_DATA_HOME = mkdtempSync(join(tmpdir(), "itaca-test-data-"))
