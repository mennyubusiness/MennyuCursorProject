import { describe, expect, it } from "vitest";
import {
  allocateProcessingFeeLargestRemainder,
  computeVendorOrderPayoutSnapshots,
  netVendorTransferCentsFromGrossAndAllocated,
} from "./stripe-fee-allocation";

describe("allocateProcessingFeeLargestRemainder", () => {
  it("splits proportionally across two vendors with exact sum", () => {
    const fee = 100;
    const weights = [5000, 5000];
    const { allocatedCents, zeroWeightWithPositiveFee } = allocateProcessingFeeLargestRemainder(
      fee,
      weights
    );
    expect(zeroWeightWithPositiveFee).toBe(false);
    expect(allocatedCents).toHaveLength(2);
    expect(allocatedCents.reduce((a, b) => a + b, 0)).toBe(fee);
    expect(allocatedCents[0]).toBe(50);
    expect(allocatedCents[1]).toBe(50);
  });

  it("uses largest remainder so indivisible fee sums exactly (7 across 1:2)", () => {
    const fee = 7;
    const weights = [1000, 2000];
    const { allocatedCents } = allocateProcessingFeeLargestRemainder(fee, weights);
    expect(allocatedCents.reduce((a, b) => a + b, 0)).toBe(7);
    expect(allocatedCents[0]).toBe(2);
    expect(allocatedCents[1]).toBe(5);
  });

  it("does not dump entire remainder on first index — second index gets extra cent when fraction larger", () => {
    const fee = 3;
    const weights = [1, 2];
    const { allocatedCents } = allocateProcessingFeeLargestRemainder(fee, weights);
    expect(allocatedCents.reduce((a, b) => a + b, 0)).toBe(3);
    expect(allocatedCents).toEqual([1, 2]);
  });

  it("three-way split sums to total", () => {
    const fee = 101;
    const weights = [333, 333, 334];
    const { allocatedCents, zeroWeightWithPositiveFee } = allocateProcessingFeeLargestRemainder(
      fee,
      weights
    );
    expect(zeroWeightWithPositiveFee).toBe(false);
    expect(allocatedCents.reduce((a, b) => a + b, 0)).toBe(101);
  });

  it("zero fee yields all zeros", () => {
    const { allocatedCents, zeroWeightWithPositiveFee } = allocateProcessingFeeLargestRemainder(0, [
      100, 200,
    ]);
    expect(zeroWeightWithPositiveFee).toBe(false);
    expect(allocatedCents).toEqual([0, 0]);
  });

  it("zero weights with positive fee flags and allocates zero each (caller should throw before persist)", () => {
    const { allocatedCents, zeroWeightWithPositiveFee } = allocateProcessingFeeLargestRemainder(50, [
      0, 0,
    ]);
    expect(zeroWeightWithPositiveFee).toBe(true);
    expect(allocatedCents).toEqual([0, 0]);
    expect(allocatedCents.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("empty slices: fee must be zero", () => {
    expect(allocateProcessingFeeLargestRemainder(0, []).allocatedCents).toEqual([]);
    expect(() => allocateProcessingFeeLargestRemainder(1, [])).toThrow();
  });
});

describe("computeVendorOrderPayoutSnapshots (payment-time snapshot pipeline)", () => {
  it("matches fee sum and net = gross - allocated", () => {
    const gross = [3000, 7000];
    const fee = 50;
    const { allocatedProcessingFeeCents, netVendorTransferCents, zeroWeightWithPositiveFee } =
      computeVendorOrderPayoutSnapshots(gross, fee);
    expect(zeroWeightWithPositiveFee).toBe(false);
    expect(allocatedProcessingFeeCents.reduce((a, b) => a + b, 0)).toBe(fee);
    expect(netVendorTransferCents[0]).toBe(gross[0]! - allocatedProcessingFeeCents[0]!);
    expect(netVendorTransferCents[1]).toBe(gross[1]! - allocatedProcessingFeeCents[1]!);
  });

  it("null stripe fee allocates zero processing cents", () => {
    const { allocatedProcessingFeeCents, netVendorTransferCents } = computeVendorOrderPayoutSnapshots(
      [100, 200],
      null
    );
    expect(allocatedProcessingFeeCents).toEqual([0, 0]);
    expect(netVendorTransferCents).toEqual([100, 200]);
  });
});

describe("netVendorTransferCentsFromGrossAndAllocated", () => {
  it("net = gross - allocated, clamped at zero", () => {
    expect(netVendorTransferCentsFromGrossAndAllocated([1000, 500], [10, 5])).toEqual([990, 495]);
    expect(netVendorTransferCentsFromGrossAndAllocated([5, 100], [10, 0])).toEqual([0, 100]);
  });

  it("rejects length mismatch", () => {
    expect(() => netVendorTransferCentsFromGrossAndAllocated([1], [1, 2])).toThrow();
  });
});
