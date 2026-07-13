import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";

// Fix Leaflet default marker asset paths (they break under bundlers)
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const pinIcon = (color: string, letter: string, ring: string) =>
  L.divIcon({
    className: "",
    html: `<div style="position:relative;width:44px;height:44px;">
      <span style="position:absolute;inset:0;border-radius:999px;background:${ring};opacity:.35;animation:brPulse 1.8s ease-out infinite;"></span>
      <span style="position:absolute;inset:4px;border-radius:999px;background:${ring};opacity:.55;animation:brPulse 1.8s ease-out infinite;animation-delay:.6s;"></span>
      <div style="
        position:absolute;inset:10px;border-radius:999px;
        background:${color};
        display:grid;place-items:center;
        color:#111;font-family:Inter,sans-serif;font-weight:700;font-size:13px;
        box-shadow:0 8px 24px rgba(0,0,0,.55), 0 0 0 3px rgba(255,255,255,.14);
        border:2px solid rgba(255,255,255,.75);
      ">${letter}</div>
    </div>
    <style>@keyframes brPulse{0%{transform:scale(.6);opacity:.7}100%{transform:scale(1.6);opacity:0}}</style>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

const carIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:44px;height:44px;border-radius:12px;
    background:#0b0d14;border:1px solid rgba(240,200,90,.7);
    display:grid;place-items:center;box-shadow:0 10px 30px rgba(0,0,0,.6);
  "><span style="color:#f0c85a;font-size:18px">🚖</span></div>`,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, map.getZoom(), { duration: 1.2 });
  }, [center, map]);
  return null;
}

export interface RideMapProps {
  center: [number, number];
  pickup?: [number, number] | null;
  dropoff?: [number, number] | null;
  driver?: [number, number] | null;
  className?: string;
}

function AnimatedRoute({ points }: { points: [number, number][] }) {
  const [progress, setProgress] = useState(0);
  const keyRef = useRef("");
  const key = points.map((p) => p.join(",")).join("|");

  useEffect(() => {
    if (points.length < 2) return;
    if (keyRef.current === key) return;
    keyRef.current = key;
    setProgress(0);
    let raf = 0;
    const start = performance.now();
    const duration = 1400;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      // easeOutCubic
      setProgress(1 - Math.pow(1 - p, 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key, points.length]);

  const drawn = useMemo<[number, number][]>(() => {
    if (points.length < 2) return points;
    // Interpolate along polyline by progress
    const segs = points.length - 1;
    const total = progress * segs;
    const full = Math.floor(total);
    const frac = total - full;
    const out: [number, number][] = points.slice(0, full + 1) as [number, number][];
    if (full < segs) {
      const a = points[full];
      const b = points[full + 1];
      out.push([a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac]);
    }
    return out;
  }, [points, progress]);

  if (drawn.length < 2) return null;
  return (
    <>
      {/* Glow underlay */}
      <Polyline
        positions={drawn}
        pathOptions={{ color: "#f0c85a", weight: 12, opacity: 0.18, lineCap: "round" }}
      />
      {/* Main dashed line */}
      <Polyline
        positions={drawn}
        pathOptions={{
          color: "#f0c85a",
          weight: 4,
          opacity: 0.95,
          dashArray: "8 10",
          lineCap: "round",
        }}
      />
    </>
  );
}

export function RideMap({ center, pickup, dropoff, driver, className }: RideMapProps) {
  const ref = useRef<L.Map | null>(null);
  const line = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [];
    if (driver) pts.push(driver);
    if (pickup) pts.push(pickup);
    if (dropoff) pts.push(dropoff);
    return pts;
  }, [driver, pickup, dropoff]);

  return (
    <div className={className}>
      <MapContainer
        center={center}
        zoom={14}
        zoomControl={false}
        ref={ref}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter center={center} />
        <AnimatedRoute points={line} />
        {pickup && <Marker position={pickup} icon={pinIcon("#f0c85a", "A", "#f0c85a")} />}
        {dropoff && <Marker position={dropoff} icon={pinIcon("#ffffff", "B", "#ffffff")} />}
        {driver && <Marker position={driver} icon={carIcon} />}
      </MapContainer>
    </div>
  );
}
