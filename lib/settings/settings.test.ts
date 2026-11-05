// Run with `npm test`. Same resolve hook as lib/context/context.test.ts.
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";

type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
(nodeModule as unknown as { registerHooks: (h: { resolve: Resolve }) => void }).registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
      try { return next(`${specifier}.ts`, context); } catch { /* fall through */ }
    }
    return next(specifier, context);
  },
});

type Routes = typeof import("./routes");
type Prefs = typeof import("./notification-prefs");
type Export = typeof import("./data-export");

void Promise.all([import("./routes") as Promise<Routes>, import("./notification-prefs") as Promise<Prefs>, import("./data-export") as Promise<Export>]).then(
  ([routes, prefs, exp]) => {
    test("old Settings links land on the right page", () => {
      const t = routes.legacySettingsTarget;
      assert.equal(t("", "#ai-activity"), "/settings/activity");
      assert.equal(t("?activity=cs:abc", "#ai-activity"), "/settings/activity?activity=cs%3Aabc");
      assert.equal(t("?reset=1", "#security"), "/settings/security?reset=1");
      assert.equal(t("", "#security"), "/settings/security");
      assert.equal(t("", "#onboarding"), "/settings/context");
      assert.equal(t("", "#what-tangent-knows"), "/settings/context");
      assert.equal(t("", "#connections"), "/settings/schedule");
      assert.equal(t("", ""), null);
      assert.equal(t("", "#nope"), null);
    });

    test("/settings lands on Account on a laptop and the list on a phone", () => {
      assert.equal(routes.settingsLanding(true, "", ""), "/settings/account");
      assert.equal(routes.settingsLanding(false, "", ""), null);
      assert.equal(routes.settingsLanding(false, "", "#ai-activity"), "/settings/activity");
    });

    test("quiet hours, including past midnight", () => {
      const night = { quietHours: { start: "22:00", end: "07:00" } };
      assert.equal(prefs.inQuietHours(night, "23:30"), true);
      assert.equal(prefs.inQuietHours(night, "06:59"), true);
      assert.equal(prefs.inQuietHours(night, "07:00"), false);
      assert.equal(prefs.inQuietHours(night, "12:00"), false);
      const lunch = { quietHours: { start: "12:00", end: "13:00" } };
      assert.equal(prefs.inQuietHours(lunch, "12:30"), true);
      assert.equal(prefs.inQuietHours(lunch, "13:00"), false);
      assert.equal(prefs.inQuietHours({}, "03:00"), false);
    });

    test("wall clock in a timezone", () => {
      const at = new Date("2026-11-05T15:00:00Z");
      assert.equal(prefs.localClock("America/Chicago", at), "09:00");
      assert.equal(prefs.localClock("Asia/Kolkata", at), "20:30");
    });

    test("bad notification prefs read as not set", () => {
      assert.deepEqual(prefs.parseNotificationPrefs(null), {});
      assert.deepEqual(
        prefs.parseNotificationPrefs({ nudgeTimes: ["9am", "08:00", "08:00"], quietHours: { start: "25:00", end: "07:00" } }),
        { nudgeTimes: ["08:00"] }
      );
      assert.deepEqual(prefs.parseNotificationPrefs({ quietHours: { start: "08:00", end: "08:00" } }), {});
    });

    test("export never includes the Canvas link or pen key", () => {
      assert.ok(exp.EXPORT_TABLES.includes("canvas_feeds"));
      const feed = exp.redactExportRow("canvas_feeds", {
        user_id: "u",
        ics_url: "https://x.instructure.com/feeds/calendars/user_SECRET.ics",
        last_sync_count: 3,
      });
      assert.equal("ics_url" in feed, false);
      assert.equal(JSON.stringify(feed).includes("SECRET"), false);
      assert.equal(feed.last_sync_count, 3);
      const pen = exp.redactExportRow("pen_devices", { id: "p", device_key_hash: "abc" });
      assert.equal("device_key_hash" in pen, false);
      const task = { id: "t", title: "Essay" };
      assert.deepEqual(exp.redactExportRow("tasks", task), task);
    });
  }
);
