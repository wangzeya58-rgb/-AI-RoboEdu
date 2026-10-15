import type { LatestScan, ScanPoint } from "./car-control";

export function normalizeScanPoints(scan: LatestScan | null): ScanPoint[] {
  if (!scan || scan.available === false || scan.success === false) return [];
  const min = typeof scan.range_min === "number" ? scan.range_min : 0;
  const max = typeof scan.range_max === "number" ? scan.range_max : Infinity;
  const validDistance = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value) && value > 0 &&
    value >= min && value <= max;

  if (Array.isArray(scan.points)) {
    return scan.points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) &&
      validDistance(Math.hypot(p.x, p.y))).slice(0, 360);
  }
  if (!Array.isArray(scan.ranges)) return [];
  const step = Math.max(1, scan.sample_step ?? 1);
  const increment = scan.angle_increment !== undefined
    ? scan.angle_increment * step
    : ((scan.angle_max ?? Math.PI) - (scan.angle_min ?? -Math.PI)) /
      Math.max(1, scan.ranges.length - 1);

  return scan.ranges.flatMap((entry, index) => {
    const objectPoint = typeof entry === "object" && entry !== null;
    const distance = objectPoint ? entry.range : entry;
    const angle = objectPoint ? entry.angle : (scan.angle_min ?? -Math.PI) + index * increment;
    if (!validDistance(distance) || !Number.isFinite(angle)) return [];
    return [{ x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, distance, angle }];
  }).slice(0, 360);
}

// ROS positive angles turn left; robot forward is the top of the display.
export function projectScanPoint(point: ScanPoint, frontDegrees: number, scale: number) {
  const angle = Math.atan2(point.y, point.x) - frontDegrees * Math.PI / 180;
  const distance = Math.hypot(point.x, point.y);
  return { x: -Math.sin(angle) * distance * scale, y: -Math.cos(angle) * distance * scale };
}
