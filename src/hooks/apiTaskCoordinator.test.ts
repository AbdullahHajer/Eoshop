import { describe, expect, it } from "vitest";
import { ApiTaskCoordinator } from "./apiTaskCoordinator";

describe("ApiTaskCoordinator", () => {
  it("accepts only the latest completion and rejects updates after disposal", () => {
    const coordinator = new ApiTaskCoordinator<[]>();
    const slow = coordinator.begin([], false);
    const latest = coordinator.begin([], false);

    expect(coordinator.accepts(slow)).toBe(false);
    expect(coordinator.accepts(latest)).toBe(true);

    coordinator.dispose();
    expect(coordinator.accepts(latest)).toBe(false);

    coordinator.activate();
    const remounted = coordinator.begin([], false);
    expect(coordinator.accepts(remounted)).toBe(true);
  });

  it("retains arguments only for explicitly safe retry and clears them", () => {
    const coordinator = new ApiTaskCoordinator<[string]>();

    coordinator.begin(["sensitive-password"], false);
    expect(coordinator.retryArgs()).toBeNull();

    coordinator.begin(["safe-read-filter"], true);
    expect(coordinator.retryArgs()).toEqual(["safe-read-filter"]);

    coordinator.reset();
    expect(coordinator.retryArgs()).toBeNull();
  });
});
