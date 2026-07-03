import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";

// Fix Leaflet default marker asset paths (they break under bundlers)
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const pinIcon = (color: string, letter: string) =>
  L.divIcon({
    className: "",
    html: `<div style="
      width:36px;height:36px;border-radius:999px;
      background:${color};
      display:grid;place-items:center;
      color:#111;font-family:Inter,sans-serif;font-weight:600;font-size:14px;
      box-shadow:0 8px 24px rgba(0,0,0,.5), 0 0 0 4px rgba(255,255,255,.08);
      border:2px solid rgba(255,255,255,.6);
    ">${letter}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
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
        {pickup && <Marker position={pickup} icon={pinIcon("#f0c85a", "A")} />}
        {dropoff && <Marker position={dropoff} icon={pinIcon("#ffffff", "B")} />}
        {driver && <Marker position={driver} icon={carIcon} />}
        {line.length >= 2 && (
          <Polyline
            positions={line}
            pathOptions={{ color: "#f0c85a", weight: 4, opacity: 0.9, dashArray: "6 8" }}
          />
        )}
      </MapContainer>
    </div>
  );
}
