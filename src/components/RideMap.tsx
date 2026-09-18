import { useEffect, useMemo, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
    __brMapsReady?: boolean;
    __brMapsInit?: () => void;
  }
}

const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as
  | string
  | undefined;
const CHANNEL = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as
  | string
  | undefined;

let loaderPromise: Promise<void> | null = null;

function loadMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.__brMapsReady && window.google?.maps) return Promise.resolve();
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<void>((resolve, reject) => {
    if (!BROWSER_KEY) {
      reject(new Error("Missing Google Maps browser key"));
      return;
    }
    window.__brMapsInit = () => {
      window.__brMapsReady = true;
      resolve();
    };
    const s = document.createElement("script");
    const params = new URLSearchParams({
      key: BROWSER_KEY,
      loading: "async",
      callback: "__brMapsInit",
    });
    if (CHANNEL) params.set("channel", CHANNEL);
    s.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    s.async = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return loaderPromise;
}

// Dark premium basemap matching the app's gold-on-black UI
const DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#0b0d14" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8b8f9c" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b0d14" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#1a1d28" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1a1d28" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#11141d" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2a2416" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#3a3016" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#05060a" }] },
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#0e111a" }] },
];

function pinSymbol(fill: string) {
  return {
    path: "M 0,0 m -9,0 a 9,9 0 1,0 18,0 a 9,9 0 1,0 -18,0",
    fillColor: fill,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeOpacity: 0.8,
    strokeWeight: 2,
    scale: 1.2,
  };
}

export interface RideMapProps {
  center: [number, number];
  pickup?: [number, number] | null;
  dropoff?: [number, number] | null;
  driver?: [number, number] | null;
  className?: string;
}

export function RideMap({ center, pickup, dropoff, driver, className }: RideMapProps) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const lineRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then(() => {
        if (cancelled || !divRef.current || mapRef.current) return;
        mapRef.current = new window.google.maps.Map(divRef.current, {
          center: { lat: center[0], lng: center[1] },
          zoom: 14,
          disableDefaultUI: true,
          gestureHandling: "greedy",
          clickableIcons: false,
          backgroundColor: "#0b0d14",
          styles: DARK_STYLE,
        });
        setReady(true);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const points = useMemo(() => {
    const pts: Array<{ key: string; pos: [number, number] }> = [];
    if (driver) pts.push({ key: "driver", pos: driver });
    if (pickup) pts.push({ key: "pickup", pos: pickup });
    if (dropoff) pts.push({ key: "dropoff", pos: dropoff });
    return pts;
  }, [driver, pickup, dropoff]);

  // Markers, route line, and viewport fitting
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const g = window.google.maps;
    const map = mapRef.current;

    const colors: Record<string, string> = {
      pickup: "#f0c85a",
      dropoff: "#ffffff",
      driver: "#3ddc97",
    };
    const labels: Record<string, string> = { pickup: "A", dropoff: "B", driver: "" };

    // Remove markers no longer present
    for (const key of Object.keys(markersRef.current)) {
      if (!points.find((p) => p.key === key)) {
        markersRef.current[key].setMap(null);
        delete markersRef.current[key];
      }
    }

    for (const p of points) {
      const position = { lat: p.pos[0], lng: p.pos[1] };
      const existing = markersRef.current[p.key];
      if (existing) {
        existing.setPosition(position);
      } else {
        markersRef.current[p.key] = new g.Marker({
          map,
          position,
          zIndex: p.key === "driver" ? 3 : 2,
          icon:
            p.key === "driver"
              ? {
                  path: g.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: colors.driver,
                  fillOpacity: 1,
                  strokeColor: "#0b0d14",
                  strokeWeight: 4,
                }
              : pinSymbol(colors[p.key]),
          label: labels[p.key]
            ? { text: labels[p.key], color: "#0b0d14", fontSize: "11px", fontWeight: "700" }
            : undefined,
        });
      }
    }

    // Route line
    const path = points.map((p) => ({ lat: p.pos[0], lng: p.pos[1] }));
    if (path.length >= 2) {
      if (!lineRef.current) {
        lineRef.current = new g.Polyline({
          map,
          geodesic: true,
          strokeColor: "#f0c85a",
          strokeOpacity: 0.95,
          strokeWeight: 4,
        });
      }
      lineRef.current.setPath(path);

      // Try real road route between pickup and dropoff
      if (pickup && dropoff && g.DirectionsService) {
        new g.DirectionsService().route(
          {
            origin: { lat: (driver ?? pickup)[0], lng: (driver ?? pickup)[1] },
            destination: { lat: dropoff[0], lng: dropoff[1] },
            waypoints: driver ? [{ location: { lat: pickup[0], lng: pickup[1] } }] : [],
            travelMode: g.TravelMode.DRIVING,
          },
          (res: any, status: string) => {
            if (status === "OK" && res?.routes?.[0]?.overview_path && lineRef.current) {
              lineRef.current.setPath(res.routes[0].overview_path);
            }
          },
        );
      }
    } else if (lineRef.current) {
      lineRef.current.setMap(null);
      lineRef.current = null;
    }

    // Fit / center
    if (path.length >= 2) {
      const bounds = new g.LatLngBounds();
      path.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, { top: 120, bottom: 320, left: 60, right: 60 });
    } else {
      map.panTo({ lat: center[0], lng: center[1] });
    }
  }, [ready, points, center, pickup, dropoff, driver]);

  return (
    <div className={className}>
      <div ref={divRef} className="absolute inset-0 h-full w-full bg-background" />
      {error && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 text-center text-xs text-muted-foreground">
          Map unavailable
        </div>
      )}
    </div>
  );
}
