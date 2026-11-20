/** Parse comma-delimited records, including quoted values and embedded newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const finishRow = () => {
    if (row.length || field.trim()) rows.push([...row, field]);
    row = [];
    field = "";
  };

  // Strip the UTF-8 BOM used by some spreadsheet exporters.
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const character = input[i];
    if (quoted) {
      if (character !== '"') {
        field += character;
      } else if (input[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = false;
      }
    } else if (character === '"' && !field.trim()) {
      field = "";
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\r" || character === "\n") {
      finishRow();
      if (character === "\r" && input[i + 1] === "\n") i++;
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  finishRow();
  return rows;
}
