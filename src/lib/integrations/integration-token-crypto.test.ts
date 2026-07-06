import { describe, expect, it } from "vitest";
import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
} from "@/lib/integrations/integration-token-crypto";

describe("integration token crypto", () => {
  it("round-trips encrypted secrets", () => {
    const plain = "sq0atp-test-access-token-value";
    const encrypted = encryptIntegrationSecret(plain);
    expect(encrypted).not.toContain(plain);
    expect(decryptIntegrationSecret(encrypted)).toBe(plain);
  });
});
