/**
 * Split a SQL script into individual statements.
 *
 * D1's `exec()` requires every statement to sit on a single line, which no real
 * migration file does. Rather than reformat user SQL, we split it ourselves and
 * run the statements as a batch.
 *
 * Handles: single/double/backtick/bracket quoting, `--` line comments,
 * block comments, and `CREATE TRIGGER ... BEGIN ... END;` bodies (whose inner
 * semicolons must not split the statement).
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let index = 0;

  /** Inside a `CREATE TRIGGER` body, semicolons belong to the body. */
  let triggerDepth = 0;

  const push = () => {
    const trimmed = current.trim();
    if (trimmed !== "") statements.push(trimmed);
    current = "";
  };

  while (index < sql.length) {
    const char = sql[index]!;
    const next = sql[index + 1];

    // -- line comment
    if (char === "-" && next === "-") {
      const end = sql.indexOf("\n", index);
      index = end === -1 ? sql.length : end + 1;
      current += "\n";
      continue;
    }

    // /* block comment */
    if (char === "/" && next === "*") {
      const end = sql.indexOf("*/", index + 2);
      index = end === -1 ? sql.length : end + 2;
      current += " ";
      continue;
    }

    // Quoted literals and identifiers pass through verbatim.
    if (char === "'" || char === '"' || char === "`" || char === "[") {
      const closing = char === "[" ? "]" : char;
      current += char;
      index += 1;
      while (index < sql.length) {
        const inner = sql[index]!;
        if (inner === closing) {
          // Doubled quote is an escaped quote, not a terminator.
          if (sql[index + 1] === closing && closing !== "]") {
            current += closing + closing;
            index += 2;
            continue;
          }
          current += closing;
          index += 1;
          break;
        }
        current += inner;
        index += 1;
      }
      continue;
    }

    // Word boundaries: track BEGIN/END nesting for trigger bodies.
    if (/[A-Za-z_]/.test(char)) {
      let word = "";
      while (index < sql.length && /[A-Za-z0-9_]/.test(sql[index]!)) {
        word += sql[index]!;
        index += 1;
      }
      const upper = word.toUpperCase();
      if (upper === "BEGIN" && /\bCREATE\s+(?:TEMP\s+|TEMPORARY\s+)?TRIGGER\b/i.test(current)) {
        triggerDepth += 1;
      } else if (upper === "END" && triggerDepth > 0) {
        triggerDepth -= 1;
      }
      current += word;
      continue;
    }

    if (char === ";" && triggerDepth === 0) {
      push();
      index += 1;
      continue;
    }

    current += char;
    index += 1;
  }

  push();
  return statements;
}
