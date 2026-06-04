import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  enqueueCartMutation,
  flushCartMutations,
  getPendingCartMutationCount,
  hasPendingCartMutations,
  isStaleCartSnapshotCommit,
  markCartSnapshotCommitted,
  resetCartMutationQueuesForTests,
} from "./cart-mutation-queue";

describe("cart-mutation-queue", () => {
  beforeEach(() => {
    resetCartMutationQueuesForTests();
  });

  it("serializes concurrent mutations per cartId", async () => {
    const order: number[] = [];
    const delay = (ms: number, n: number) =>
      new Promise<void>((resolve) => {
        setTimeout(() => {
          order.push(n);
          resolve();
        }, ms);
      });

    const p1 = enqueueCartMutation("cart_1", () => delay(30, 1));
    const p2 = enqueueCartMutation("cart_1", () => delay(10, 2));

    await Promise.all([p1, p2]);
    expect(order).toEqual([1, 2]);
  });

  it("tracks pending mutations until flush completes", async () => {
    let resolveBlock!: () => void;
    const block = new Promise<void>((r) => {
      resolveBlock = r;
    });

    const pending = enqueueCartMutation("cart_1", async () => {
      await block;
      return "done";
    });

    expect(hasPendingCartMutations("cart_1")).toBe(true);
    expect(getPendingCartMutationCount("cart_1")).toBe(1);

    resolveBlock();
    await pending;
    await flushCartMutations("cart_1");

    expect(hasPendingCartMutations("cart_1")).toBe(false);
  });

  it("older committed snapshot seq is stale after newer commit", () => {
    const seq1 = markCartSnapshotCommitted("cart_1");
    const seq2 = markCartSnapshotCommitted("cart_1");
    expect(isStaleCartSnapshotCommit("cart_1", seq1)).toBe(true);
    expect(isStaleCartSnapshotCommit("cart_1", seq2)).toBe(false);
  });

  it("rapid adds complete in order so later cart has both items", async () => {
    let serverItems: string[] = [];

    const addItem = (menuItemId: string) =>
      enqueueCartMutation("cart_1", async () => {
        await new Promise((r) => setTimeout(r, 5));
        serverItems = [...serverItems, menuItemId];
        return serverItems;
      });

    await Promise.all([addItem("item_a"), addItem("item_b")]);
    expect(serverItems).toEqual(["item_a", "item_b"]);
  });
});
