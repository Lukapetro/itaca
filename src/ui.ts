const colorEnabled: boolean =
  process.env.NO_COLOR === undefined &&
  process.env.TERM !== "dumb" &&
  (process.env.FORCE_COLOR !== undefined || process.stdout.isTTY === true)

function paint(code: string, s: string): string {
  return colorEnabled ? `\x1b[${code}m${s}\x1b[0m` : s
}

export const bold = (s: string) => paint("1", s)
export const dim = (s: string) => paint("2", s)
export const cyan = (s: string) => paint("36", s)
export const yellow = (s: string) => paint("33", s)
export const red = (s: string) => paint("31", s)
export const green = (s: string) => paint("32", s)

/** Render rows as aligned columns. Widths computed on plain text. */
export function table(rows: string[][]): string {
  const widths: number[] = []
  for (const row of rows) {
    row.forEach((cell, i) => {
      widths[i] = Math.max(widths[i] ?? 0, plain(cell).length)
    })
  }
  return rows
    .map((row) =>
      row
        .map((cell, i) =>
          i === row.length - 1 ? cell : cell + " ".repeat((widths[i] ?? 0) - plain(cell).length),
        )
        .join("  "),
    )
    .join("\n")
}

function plain(s: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI escapes
  return s.replace(/\x1b\[\d+m/g, "")
}

export interface CliError {
  code: string
  message: string
  fix?: string
}

/** Print an error (human on stderr, or JSON on stdout when --json). */
export function fail(err: CliError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ error: err }))
  } else {
    console.error(`${red("error")} ${err.message}${err.fix ? `\n${dim(`fix: ${err.fix}`)}` : ""}`)
  }
}
