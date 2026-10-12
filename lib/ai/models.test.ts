// Run with `npm test`. Model ids, request parameters and prices for the
// Haiku 5.5 / Sonnet 5.5 defaults (checked against platform.claude.com on
// 2026-10-11), and the previous-generation fallbacks.
import { test } from "node:test";
import assert from "node:assert/strict";

type Mod = typeof import("./models");

void (import("./models.ts" as string) as Promise<Mod>).then(
  ({ DEFAULT_MODELS, FALLBACK_MODELS, modelParams, priceFor, estimateCostUsd, minCacheableTokens, supportsSampling, AI_TASKS }) => {
    const withEnv = <T>(fast: string | undefined, smart: string | undefined, fn: () => T): T => {
      const saved = [process.env.AI_MODEL_FAST, process.env.AI_MODEL_SMART];
      if (fast === undefined) delete process.env.AI_MODEL_FAST;
      else process.env.AI_MODEL_FAST = fast;
      if (smart === undefined) delete process.env.AI_MODEL_SMART;
      else process.env.AI_MODEL_SMART = smart;
      try {
        return fn();
      } finally {
        if (saved[0] === undefined) delete process.env.AI_MODEL_FAST;
        else process.env.AI_MODEL_FAST = saved[0];
        if (saved[1] === undefined) delete process.env.AI_MODEL_SMART;
        else process.env.AI_MODEL_SMART = saved[1];
      }
    };

    test("defaults are Haiku 5.5 and Sonnet 5.5, falling back to Haiku 4.5 and Sonnet 5", () => {
      assert.deepEqual({ ...DEFAULT_MODELS }, { FAST: "claude-haiku-5-5", SMART: "claude-sonnet-5-5" });
      assert.deepEqual({ ...FALLBACK_MODELS }, { FAST: "claude-haiku-4-5", SMART: "claude-sonnet-5" });
    });

    test("Sonnet 5.5 never gets thinking disabled or a temperature", () => {
      withEnv(undefined, undefined, () => {
        for (const task of Object.keys(AI_TASKS) as (keyof typeof AI_TASKS)[]) {
          const p = modelParams(task, { tier: "SMART" });
          assert.equal(p.model, "claude-sonnet-5-5");
          assert.notEqual(p.thinking?.type, "disabled", task);
          assert.equal(p.temperature, undefined, task);
        }
        assert.deepEqual(modelParams("planOutline").thinking, { type: "between_tools" });
      });
    });

    test("Haiku 5.5: thinking off, no temperature, low effort for routing only", () => {
      withEnv(undefined, undefined, () => {
        const router = modelParams("intentRouter", { format: { type: "json_schema", schema: {} } });
        assert.equal(router.model, "claude-haiku-5-5");
        assert.deepEqual(router.thinking, { type: "disabled" });
        assert.equal(router.temperature, undefined);
        assert.deepEqual(router.output_config, { format: { type: "json_schema", schema: {} }, effort: "low" });
        // Student-facing text keeps the model's default effort.
        assert.equal(modelParams("proactive").output_config, undefined);
        assert.equal(modelParams("planDetail").output_config, undefined);
      });
    });

    test("the fallback models get only what they accept", () => {
      const haiku = modelParams("intentRouter", { model: FALLBACK_MODELS.FAST });
      assert.equal(haiku.thinking, undefined);
      assert.equal(haiku.output_config, undefined);
      assert.equal(haiku.temperature, 0);
      const sonnet = modelParams("planOutline", { model: FALLBACK_MODELS.SMART });
      assert.deepEqual(sonnet.thinking, { type: "disabled" });
      assert.equal(supportsSampling("claude-sonnet-5"), false);
    });

    test("prices: Sonnet 5.5 is not priced as Sonnet 5; Haiku 5.5 long-context tier", () => {
      assert.equal(priceFor("claude-sonnet-5-5").cacheRead, 0.05);
      assert.equal(priceFor("claude-sonnet-5-5-20260901").cacheRead, 0.05);
      assert.equal(priceFor("claude-sonnet-5").cacheRead, undefined);
      // Standard Haiku 5.5 rates under 100K prompt tokens …
      assert.equal(estimateCostUsd("claude-haiku-5-5", { input_tokens: 50_000, output_tokens: 10_000 }), (50_000 * 0.1 + 10_000 * 0.5) / 1e6);
      // … and over 100K prompt tokens (cache reads count) every rate is 5×.
      const long = estimateCostUsd("claude-haiku-5-5", { input_tokens: 10_000, cache_read_input_tokens: 95_000, output_tokens: 1_000 });
      assert.equal(long, Math.round(((10_000 * 0.5 + 95_000 * 0.5 * 0.1 + 1_000 * 2.5) / 1e6) * 1e6) / 1e6);
      // Sonnet 5.5 cache reads are $0.10/MTok.
      assert.equal(estimateCostUsd("claude-sonnet-5-5", { cache_read_input_tokens: 1_000_000 }), 0.1);
      assert.equal(estimateCostUsd("claude-sonnet-5", { cache_read_input_tokens: 1_000_000 }), 0.2);
    });

    test("minimum cacheable prompt per model", () => {
      assert.equal(minCacheableTokens("claude-haiku-5-5"), 512);
      assert.equal(minCacheableTokens("claude-sonnet-5-5"), 512);
      assert.equal(minCacheableTokens("claude-sonnet-5"), 1024);
      assert.equal(minCacheableTokens("claude-haiku-4-5"), 4096);
    });
  }
);
