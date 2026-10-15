import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeScanPoints, projectScanPoint } from "../src/lib/api/scan-view";
import {
  startSimulatorManualControl, heartbeatSimulatorManualControl,
  stopSimulatorManualControl, startManualControl,
} from "../src/lib/api/car-control";

test("actual FastAPI angle/range objects render; invalid points do not", () => {
  const points = normalizeScanPoints({ success: true, available: true,
    range_min: 0.05, range_max: 12, ranges: [
      { angle: Math.PI, range: 1.2 }, { angle: 0, range: null },
      { angle: 0, range: NaN }, { angle: 0, range: Infinity },
      { angle: 0, range: 13 }, { angle: 0, range: 0 },
    ] });
  assert.equal(points.length, 1);
  assert.equal(points[0].angle, Math.PI);
  assert.ok(Math.abs(points[0].x + 1.2) < 1e-10);
});

test("numeric ranges honor backend sample_step; unavailable cache is hidden", () => {
  const points = normalizeScanPoints({ angle_min: 0, angle_increment: 0.1,
    sample_step: 4, ranges: [1, 2, null] });
  assert.equal(points.length, 2);
  assert.equal(points[1].angle, 0.4);
  assert.deepEqual(normalizeScanPoints({ available: false, ranges: [1] }), []);
  assert.deepEqual(normalizeScanPoints({ success: false, points: [{ x: 1, y: 1 }] }), []);
});

test("physical 180-degree forward points up; positive relative angles point left", () => {
  const points = normalizeScanPoints({ ranges: [
    { angle: Math.PI, range: 1 }, { angle: Math.PI + 0.1, range: 1 },
  ] });
  const front = projectScanPoint(points[0], 180, 10);
  assert.ok(Math.abs(front.x) < 1e-10);
  assert.equal(front.y, -10);
  assert.ok(projectScanPoint(points[1], 180, 10).x < 0);
});

test("simulator controls never call real endpoints; left/right signs remain backend-owned", async () => {
  const original = globalThis.fetch;
  const calls: Array<{ url: string; body?: string }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: init?.body as string | undefined });
    return new Response(JSON.stringify({ success: true }));
  };
  try {
    await startSimulatorManualControl("left", "http://test/");
    await heartbeatSimulatorManualControl("right", "http://test");
    await stopSimulatorManualControl("http://test");
    assert.deepEqual(calls.map((call) => call.url), [
      "http://test/api/simulator/manual/start", "http://test/api/simulator/manual/heartbeat",
      "http://test/api/simulator/manual/stop",
    ]);
    assert.equal(JSON.parse(calls[0].body!).action, "rotate_left");
    assert.equal(JSON.parse(calls[1].body!).action, "rotate_right");
    await startManualControl("left", "http://test");
    assert.equal(calls[3].url, "http://test/api/ros/manual/start");
  } finally { globalThis.fetch = original; }
});

test("simulator HTTP-200 business failures are not treated as successful motion", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ success: false, message: "isolated topic required" }));
  try {
    await assert.rejects(startSimulatorManualControl("left", "http://test"), /isolated topic required/);
  } finally { globalThis.fetch = original; }
});
