import { describe, expect, it } from "vitest";
import { applyCloseDecision, planClose } from "./closeFlow";
import {
  activateDocument,
  activeDocumentId,
  addDocuments,
  createWorkspace,
  updateDocumentText,
  type WorkspaceState,
} from "./workspaceStore";

function workspace(): WorkspaceState {
  return addDocuments(createWorkspace(), [
    { path: "/a.md", text: "A", id: "a" },
    { path: "/b.md", text: "B", id: "b" },
    { path: "/c.md", text: "C", id: "c" },
  ]);
}

describe("closeFlow", () => {
  it("closes a clean active tab and activates the previous neighbour", () => {
    const ws = workspace(); // active: c (last added)
    const plan = planClose(ws, { type: "single", documentId: "c" });
    expect(plan).toEqual({ targets: ["c"], dirtyTargets: [] });

    const next = applyCloseDecision(ws, plan, "discard");
    expect(next.documents.map((d) => d.id)).toEqual(["a", "b"]);
    expect(activeDocumentId(next)).toBe("b");
  });

  it("closing the active tab with a following neighbour activates it", () => {
    const ws = activateDocument(workspace(), "b");
    const next = applyCloseDecision(
      ws,
      planClose(ws, { type: "single", documentId: "b" }),
      "discard"
    );
    expect(activeDocumentId(next)).toBe("c");
  });

  it("closes a clean inactive tab without changing the active tab", () => {
    const ws = workspace();
    const next = applyCloseDecision(
      ws,
      planClose(ws, { type: "single", documentId: "a" }),
      "discard"
    );
    expect(next.documents.map((d) => d.id)).toEqual(["b", "c"]);
    expect(activeDocumentId(next)).toBe("c");
  });

  it("preserves dirty tabs when close is cancelled", () => {
    const ws = updateDocumentText(workspace(), "b", "B edited");
    const plan = planClose(ws, { type: "single", documentId: "b" });
    expect(plan.dirtyTargets).toEqual(["b"]);

    const next = applyCloseDecision(ws, plan, "cancel");
    expect(next).toBe(ws);
  });

  it("discard closes dirty targets", () => {
    const ws = updateDocumentText(workspace(), "b", "B edited");
    const next = applyCloseDecision(
      ws,
      planClose(ws, { type: "single", documentId: "b" }),
      "discard"
    );
    expect(next.documents.map((d) => d.id)).toEqual(["a", "c"]);
  });

  it("close others keeps only the excepted document", () => {
    const ws = activateDocument(workspace(), "b");
    const plan = planClose(ws, { type: "others", exceptDocumentId: "b" });
    expect(plan.targets).toEqual(["a", "c"]);

    const next = applyCloseDecision(ws, plan, "discard");
    expect(next.documents.map((d) => d.id)).toEqual(["b"]);
    expect(activeDocumentId(next)).toBe("b");
  });

  it("close others with a dirty sibling can be cancelled entirely", () => {
    const ws = updateDocumentText(workspace(), "a", "A edited");
    const plan = planClose(ws, { type: "others", exceptDocumentId: "b" });
    expect(plan.dirtyTargets).toEqual(["a"]);
    expect(applyCloseDecision(ws, plan, "cancel")).toBe(ws);
  });

  it("close saved closes only clean documents", () => {
    const ws = updateDocumentText(workspace(), "b", "B edited");
    const plan = planClose(ws, { type: "saved" });
    expect(plan).toEqual({ targets: ["a", "c"], dirtyTargets: [] });

    const next = applyCloseDecision(ws, plan, "discard");
    expect(next.documents.map((d) => d.id)).toEqual(["b"]);
  });

  it("close all targets every document", () => {
    const ws = workspace();
    const next = applyCloseDecision(
      ws,
      planClose(ws, { type: "all" }),
      "discard"
    );
    expect(next.documents).toEqual([]);
    expect(activeDocumentId(next)).toBeNull();
  });

  it("an empty plan is a no-op", () => {
    const ws = workspace();
    const plan = planClose(ws, { type: "single", documentId: "missing" });
    expect(applyCloseDecision(ws, plan, "discard")).toBe(ws);
  });
});
