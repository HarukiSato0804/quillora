import { describe, expect, it } from "vitest";
import {
  commandById,
  commandForKeyEvent,
  createCommands,
  runCommand,
  shortcutToAccelerator,
  type AppCommandId,
  type CommandHandlers,
} from "./commands";
import {
  addDocuments,
  createWorkspace,
  newUntitledDocument,
  updateDocumentText,
} from "../editor/store/workspaceStore";

function makeHandlers(calls: AppCommandId[] = []): CommandHandlers {
  const handlers = {} as CommandHandlers;
  for (const command of createCommands({} as CommandHandlers)) {
    handlers[command.id] = () => {
      calls.push(command.id);
    };
  }
  return handlers;
}

const emptyWorkspace = createWorkspace();
const untitledWorkspace = newUntitledDocument(createWorkspace(), { id: "u" });
const fileWorkspace = addDocuments(createWorkspace(), [
  { path: "/a.md", text: "A", id: "a" },
]);

describe("createCommands", () => {
  it("has unique command ids", () => {
    const commands = createCommands(makeHandlers());
    const ids = commands.map((command) => command.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("disables save commands without an active document", () => {
    const commands = createCommands(makeHandlers());
    expect(commandById(commands, "saveDocument")!.enabled(emptyWorkspace)).toBe(
      false
    );
    expect(
      commandById(commands, "saveDocument")!.enabled(untitledWorkspace)
    ).toBe(true);
  });

  it("disables reveal in Finder and copy path for untitled documents", () => {
    const commands = createCommands(makeHandlers());
    for (const id of ["revealInFinder", "copyFilePath"] as const) {
      expect(commandById(commands, id)!.enabled(untitledWorkspace)).toBe(false);
      expect(commandById(commands, id)!.enabled(fileWorkspace)).toBe(true);
    }
  });

  it("enables format commands only with an active document", () => {
    const commands = createCommands(makeHandlers());
    for (const id of [
      "toggleBold",
      "toggleItalic",
      "toggleInlineCode",
      "insertLink",
    ] as const) {
      expect(commandById(commands, id)!.enabled(emptyWorkspace)).toBe(false);
      expect(commandById(commands, id)!.enabled(fileWorkspace)).toBe(true);
    }
  });

  it("enables save all only when something is dirty", () => {
    const commands = createCommands(makeHandlers());
    const saveAll = commandById(commands, "saveAllDocuments")!;
    expect(saveAll.enabled(fileWorkspace)).toBe(false);
    expect(saveAll.enabled(updateDocumentText(fileWorkspace, "a", "x"))).toBe(
      true
    );
  });
});

describe("runCommand", () => {
  it("runs enabled commands and refuses disabled ones", () => {
    const calls: AppCommandId[] = [];
    const commands = createCommands(makeHandlers(calls));
    expect(runCommand(commands, "saveDocument", emptyWorkspace)).toBe(false);
    expect(runCommand(commands, "saveDocument", fileWorkspace)).toBe(true);
    expect(calls).toEqual(["saveDocument"]);
  });
});

describe("commandForKeyEvent", () => {
  const commands = createCommands(makeHandlers());

  it("matches plain and shifted shortcuts", () => {
    expect(
      commandForKeyEvent(commands, {
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        key: "s",
      })?.id
    ).toBe("saveDocument");
    expect(
      commandForKeyEvent(commands, {
        metaKey: true,
        ctrlKey: false,
        shiftKey: true,
        altKey: false,
        key: "S",
      })?.id
    ).toBe("saveDocumentAs");
    expect(
      commandForKeyEvent(commands, {
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        key: "\\",
      })?.id
    ).toBe("view:split-right");
    expect(
      commandForKeyEvent(commands, {
        metaKey: true,
        ctrlKey: false,
        shiftKey: true,
        altKey: false,
        key: "\\",
      })?.id
    ).toBe("view:split-down");
  });

  it("matches option-modified shortcuts", () => {
    expect(
      commandForKeyEvent(commands, {
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: true,
        key: "f",
      })?.id
    ).toBe("replace");
  });

  it("ignores non-meta events", () => {
    expect(
      commandForKeyEvent(commands, {
        metaKey: false,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        key: "s",
      })
    ).toBeUndefined();
  });
});

describe("shortcutToAccelerator", () => {
  it("converts Cmd and Option", () => {
    expect(shortcutToAccelerator("Cmd+Option+F")).toBe("CmdOrCtrl+Alt+F");
    expect(shortcutToAccelerator("Cmd+,")).toBe("CmdOrCtrl+,");
  });
});
