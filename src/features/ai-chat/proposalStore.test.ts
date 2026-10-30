import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { aiProposals } from "./proposalStore";

describe("aiProposals", () => {
  beforeEach(() => aiProposals.resolveAll());

  it("keeps proposals for several songs at once", () => {
    aiProposals.stageSong({ songId: "a", content: "A" });
    aiProposals.stageSong({ songId: "b", content: "B" });
    aiProposals.stageSong({ songId: "c", content: "C" });
    assert.equal(aiProposals.getAll().length, 3);
  });

  it("replaces an older proposal for the same song and puts it first", () => {
    aiProposals.stageSong({ songId: "a", content: "v1" });
    aiProposals.stageSong({ songId: "b", content: "B" });
    aiProposals.stageSong({ songId: "a", content: "v2" });
    const all = aiProposals.getAll();
    assert.equal(all.length, 2);
    assert.equal(all[0].kind === "song" && all[0].content, "v2");
  });

  it("resolves single and multiple proposals and notifies", () => {
    let calls = 0;
    const off = aiProposals.subscribe(() => calls++);
    aiProposals.stageSong({ songId: "a", content: "A" });
    aiProposals.stageService({ serviceId: "s", elements: [] });
    aiProposals.resolve("song:a");
    assert.deepEqual(
      aiProposals.getAll().map((p) => p.key),
      ["service:s"],
    );
    aiProposals.resolve("song:missing");
    aiProposals.resolveAll(["service:s"]);
    assert.equal(aiProposals.getAll().length, 0);
    off();
    assert.equal(calls, 4);
  });
});
