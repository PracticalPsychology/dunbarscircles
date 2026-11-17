import { buildBackup } from "./backup";
import { generateFilename } from "./export-utils";
import { readHistory, readInteractions } from "./relationship-log";

/** Download all contacts, interactions and history as a JSON backup file. */
export function downloadBackupFile(
  contacts: ReadonlyArray<Record<string, any>>,
): void {
  const json = JSON.stringify(
    buildBackup(contacts, new Date(), {
      interactions: readInteractions(),
      history: readHistory(),
    }),
    null,
    2,
  );
  const url = URL.createObjectURL(
    new Blob([json], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = generateFilename("dunbars-circles-backup", "json");
  a.click();
  URL.revokeObjectURL(url);
}
