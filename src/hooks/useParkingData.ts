import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { createLatestRequest } from "../lib/latest-request";
import { emptySummary } from "../lib/types";
import type {
  ParkingRecord,
  ParkingConfig,
  ParkingLocation,
} from "../lib/types";

export type ParkingLoadStatus = "loading" | "ready" | "error";

export function useParkingData(isAdmin: boolean) {
  const [active, setActive] = useState<ParkingRecord[]>([]);
  const [history, setHistory] = useState<ParkingRecord[]>([]);
  const [summary, setSummary] = useState(emptySummary);
  const [location, setLocation] = useState<ParkingLocation | null>(null);
  const [parkingConfig, setParkingConfig] = useState<ParkingConfig | null>(
    null,
  );
  const [status, setStatus] = useState<ParkingLoadStatus>("loading");
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loader = useMemo(
    () =>
      createLatestRequest(
        async (signal) => {
          const init = {
            signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
          };
          return Promise.all([
            api<ParkingRecord[]>("/parking?status=active", init),
            api<ParkingRecord[]>("/parking?status=completed", init),
            api<typeof emptySummary>("/parking/summary/today", init),
            api<ParkingLocation>("/locations/current", init),
            api<ParkingConfig>("/parking/config", init),
            api<ParkingRecord[]>("/parking?status=evaded", init),
          ] as const);
        },
        ([
          activeRecords,
          completed,
          today,
          currentLocation,
          config,
          evaded,
        ]) => {
          const movements = [...completed, ...evaded].sort(
            (a, b) =>
              new Date(b.exitTime ?? b.entryTime).getTime() -
              new Date(a.exitTime ?? a.entryTime).getTime(),
          );
          setActive(activeRecords);
          setHistory(isAdmin ? movements : movements.slice(0, 10));
          setSummary(today);
          setLocation(currentLocation);
          setParkingConfig(config);
          setLastUpdated(Date.now());
          setStatus("ready");
          setRefreshing(false);
        },
        () => {
          setStatus("error");
          setRefreshing(false);
        },
      ),
    [isAdmin],
  );

  const loadData = useCallback(() => {
    setRefreshing(true);
    return loader.run();
  }, [loader]);

  useEffect(() => {
    void loadData();
    const timer = window.setInterval(() => void loadData(), 30_000);
    const onFocus = () => void loadData();
    window.addEventListener("focus", onFocus);
    return () => {
      loader.cancel();
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [loader, loadData]);

  return {
    active,
    history,
    summary,
    location,
    parkingConfig,
    status,
    lastUpdated,
    refreshing,
    loadData,
  };
}
