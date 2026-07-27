import type { ApifyClient } from "apify-client";
import { describe, expect, it, vi } from "vitest";
import { removeApifySourceArtifacts } from "@/server/provider-cleanup";

describe("Apify source cleanup", () => {
  it("deletes dataset and run independently and treats 404 as success", async () => {
    const datasetDelete = vi.fn().mockRejectedValue({ statusCode: 404 });
    const runDelete = vi.fn().mockResolvedValue(undefined);
    const client = {
      dataset: vi.fn(() => ({ delete: datasetDelete })),
      run: vi.fn(() => ({ delete: runDelete })),
    } as unknown as ApifyClient;

    await expect(
      removeApifySourceArtifacts(client, {
        datasetId: "dataset-1",
        externalId: "run-1",
      }),
    ).resolves.toEqual({
      datasetRemoved: true,
      runRemoved: true,
      complete: true,
    });
    expect(datasetDelete).toHaveBeenCalledOnce();
    expect(runDelete).toHaveBeenCalledOnce();
  });

  it("still attempts the run when dataset deletion fails", async () => {
    const datasetDelete = vi.fn().mockRejectedValue({ statusCode: 500 });
    const runDelete = vi.fn().mockResolvedValue(undefined);
    const client = {
      dataset: vi.fn(() => ({ delete: datasetDelete })),
      run: vi.fn(() => ({ delete: runDelete })),
    } as unknown as ApifyClient;
    const result = await removeApifySourceArtifacts(client, {
      datasetId: "dataset-1",
      externalId: "run-1",
    });
    expect(result).toMatchObject({
      datasetRemoved: false,
      runRemoved: true,
      complete: false,
    });
    expect(runDelete).toHaveBeenCalledOnce();
  });
});
