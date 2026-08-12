/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { GeoJSON, MapContainer, Pane, useMap } from "react-leaflet";
import L, { type Layer } from "leaflet";
import "leaflet/dist/leaflet.css";
import { ArrowUpRight, ChevronRight, Compass } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import {
  fetchBudgetSnapshot,
  type BudgetSnapshot,
} from "../api/mapBudgetApi";
import {
  loadProvinceGeometry,
  localLevelById,
  localLevels,
  provinces,
  validUrlSelection,
  type GeoCollection,
  type MunicipalityProperties,
  type ProvinceOption,
} from "../model/geography";
import {
  isCurrentRequest,
  selectMunicipality,
  selectProvince,
  updateSelectionParams,
  type MapSelectionIds,
} from "../model/mapSelection";

type ProvinceProperties = { PROVINCE: number; PR_NAME: string };
type LoadedGeometry = { provinceId: string; data: GeoCollection };
type LoadedSnapshot = {
  municipalityId: string;
  fiscalYear: string;
  data: BudgetSnapshot;
};

const NEPAL_BOUNDS = L.latLngBounds([26.3, 80], [30.48, 88.22]);
const MAP_FISCAL_YEAR = "2081/82";

function MapMotion({
  bounds,
  reduced,
  hasOverlay,
}: {
  bounds: L.LatLngBoundsExpression;
  reduced: boolean;
  hasOverlay: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    const hasDesktopOverlay = hasOverlay && map.getSize().x >= 768;
    const options = {
      paddingTopLeft: L.point(34, 34),
      paddingBottomRight: L.point(hasDesktopOverlay ? 340 : 34, hasDesktopOverlay ? 148 : 34),
      maxZoom: 10,
    };

    if (reduced) map.fitBounds(bounds, options);
    else map.flyToBounds(bounds, { ...options, duration: 0.9 });
  }, [bounds, hasOverlay, map, reduced]);

  return null;
}

function formatAmount(value: string | null) {
  if (value === null) return "—";
  return `NPR ${new Intl.NumberFormat("en-NP", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value))}`;
}

function SnapshotCard({
  province,
  municipality,
  status,
  snapshot,
}: {
  province: ProvinceOption;
  municipality: (typeof localLevels)[number] | null;
  status: "idle" | "loading" | "ready" | "error";
  snapshot: BudgetSnapshot | null;
}) {
  const name = municipality?.nameEn ?? `${province.name} Province`;
  const hasData = status === "ready" && Boolean(snapshot?.dataScope);
  const insightsPath = municipality
    ? `/insights/local?province=${encodeURIComponent(province.name)}&municipalityCode=${encodeURIComponent(municipality.code)}&fy=${encodeURIComponent(MAP_FISCAL_YEAR)}`
    : `/insights/provincial?province=${encodeURIComponent(province.name)}&fy=${encodeURIComponent(MAP_FISCAL_YEAR)}`;

  return (
    <section
      aria-label={`Budget context for ${name}`}
      className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-slate-950 dark:text-white">
            {name}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">FY {MAP_FISCAL_YEAR}</p>
        </div>
        <Compass className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
      </div>

      {!municipality ? (
        <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
          Provincial revenue, grants and expenditure.
        </p>
      ) : status === "loading" ? (
        <div className="mt-4" aria-live="polite">
          <div className="h-3 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <div className="mt-2 h-7 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        </div>
      ) : hasData ? (
        <div className="mt-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Available project budget</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
            {formatAmount(snapshot?.totalBudget ?? null)}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
          Local revenue, transfers and expenditure.
        </p>
      )}

      <Button asChild size="sm" variant="outline" className="mt-3 h-8 w-full text-xs">
          <Link to={insightsPath}>
            Explore insights
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
      </Button>
    </section>
  );
}

export default function OpenBudgetMap() {
  const [params, setParams] = useSearchParams();
  const { province, municipality } = validUrlSelection(
    params.get("province"),
    params.get("municipality"),
  );
  const [provinceGeometry, setProvinceGeometry] = useState<GeoCollection | null>(null);
  const [loadedLocalGeometry, setLoadedLocalGeometry] = useState<LoadedGeometry | null>(null);
  const [geoStatus, setGeoStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadedSnapshot, setLoadedSnapshot] = useState<LoadedSnapshot | null>(null);
  const [budgetStatus, setBudgetStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const geoController = useRef<AbortController | null>(null);
  const budgetController = useRef<AbortController | null>(null);
  const geoRequestId = useRef(0);
  const budgetRequestId = useRef(0);
  const activeProvinceId = useRef<string | null>(province?.id ?? null);
  const activeMunicipalityId = useRef<string | null>(municipality?.id ?? null);

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fiscalYear = MAP_FISCAL_YEAR;
  const localOptions = useMemo(
    () =>
      province
        ? localLevels
            .filter((item) => item.provinceId === province.id)
            .sort((a, b) => a.nameEn.localeCompare(b.nameEn))
        : [],
    [province],
  );
  const localGeometry =
    loadedLocalGeometry && loadedLocalGeometry.provinceId === province?.id
      ? loadedLocalGeometry.data
      : null;
  const snapshot =
    loadedSnapshot &&
    loadedSnapshot.municipalityId === municipality?.id &&
    loadedSnapshot.fiscalYear === fiscalYear
      ? loadedSnapshot.data
      : null;

  useEffect(() => {
    activeProvinceId.current = province?.id ?? null;
    activeMunicipalityId.current = municipality?.id ?? null;
  }, [municipality, province]);

  const commitSelection = (selection: MapSelectionIds) => {
    activeProvinceId.current = selection.provinceId;
    activeMunicipalityId.current = selection.municipalityId;
    geoController.current?.abort();
    budgetController.current?.abort();
    geoRequestId.current += 1;
    budgetRequestId.current += 1;
    setLoadedLocalGeometry(null);
    setLoadedSnapshot(null);
    setBudgetStatus("idle");
    setGeoStatus(selection.provinceId ? "loading" : "ready");
    setParams((current) => updateSelectionParams(current, selection));
  };

  const chooseProvince = (nextProvince: ProvinceOption | null) => {
    commitSelection(selectProvince(nextProvince?.id ?? null));
  };

  const chooseMunicipality = (municipalityId: string | null) => {
    if (!province) return;
    const nextMunicipality = municipalityId ? localLevelById.get(municipalityId) ?? null : null;
    activeMunicipalityId.current = nextMunicipality?.provinceId === province.id
      ? nextMunicipality.id
      : null;
    budgetController.current?.abort();
    budgetRequestId.current += 1;
    setLoadedSnapshot(null);
    setBudgetStatus("idle");
    setParams((current) =>
      updateSelectionParams(
        current,
        selectMunicipality(
          province.id,
          nextMunicipality?.id ?? null,
          nextMunicipality?.provinceId ?? null,
        ),
      ),
    );
  };

  useEffect(() => {
    const controller = new AbortController();
    fetch("/geo/nepal/provinces.geojson", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("National boundaries could not be loaded.");
        return response.json();
      })
      .then((data: GeoCollection) => {
        if (data.features?.length !== 7) throw new Error("Expected seven provinces.");
        setProvinceGeometry(data);
        if (!activeProvinceId.current) setGeoStatus("ready");
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setGeoStatus("error");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    geoController.current?.abort();
    const requestId = ++geoRequestId.current;
    setLoadedLocalGeometry(null);

    if (!province) {
      setGeoStatus(provinceGeometry ? "ready" : "loading");
      return;
    }

    const requestedProvinceId = province.id;
    const controller = new AbortController();
    geoController.current = controller;
    setGeoStatus("loading");

    loadProvinceGeometry(province, controller.signal)
      .then((data) => {
        if (
          requestId !== geoRequestId.current ||
          !isCurrentRequest(requestedProvinceId, activeProvinceId.current)
        ) return;
        setLoadedLocalGeometry({ provinceId: requestedProvinceId, data });
        setGeoStatus("ready");
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError" && requestId === geoRequestId.current) {
          setGeoStatus("error");
        }
      });

    return () => controller.abort();
  }, [province, provinceGeometry]);

  useEffect(() => {
    budgetController.current?.abort();
    const requestId = ++budgetRequestId.current;
    setLoadedSnapshot(null);

    if (!municipality || !fiscalYear) {
      setBudgetStatus("idle");
      return;
    }

    const requestedMunicipalityId = municipality.id;
    const controller = new AbortController();
    budgetController.current = controller;
    setBudgetStatus("loading");

    fetchBudgetSnapshot(requestedMunicipalityId, fiscalYear, controller.signal)
      .then((data) => {
        if (
          requestId !== budgetRequestId.current ||
          !isCurrentRequest(requestedMunicipalityId, activeMunicipalityId.current)
        ) return;
        setLoadedSnapshot({ municipalityId: requestedMunicipalityId, fiscalYear, data });
        setBudgetStatus("ready");
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError" && requestId === budgetRequestId.current) {
          setBudgetStatus("error");
        }
      });

    return () => controller.abort();
  }, [fiscalYear, municipality]);

  const selectedBounds = useMemo(() => {
    if (municipality && localGeometry) {
      const feature = localGeometry.features.find(
        (item) => item.properties?.municipalityId === municipality.id,
      );
      if (feature) return L.geoJSON(feature).getBounds();
    }
    if (province && provinceGeometry) {
      const feature = provinceGeometry.features.find(
        (item) => String(item.properties?.PROVINCE) === province.id,
      );
      if (feature) return L.geoJSON(feature).getBounds();
    }
    return NEPAL_BOUNDS;
  }, [localGeometry, municipality, province, provinceGeometry]);

  return (
    <Layout>
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-bold tracking-[-.025em] text-slate-950 dark:text-white">Open Budget Map</h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            Explore Nepal by province and local government, then open the available budget context.
          </p>
        </header>

        <nav aria-label="Map location" className="flex flex-wrap items-center gap-1 text-sm">
          <button className="font-medium text-emerald-700 hover:underline dark:text-emerald-400" onClick={() => chooseProvince(null)}>Nepal</button>
          {province ? (
            <>
              <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <button className="font-medium text-emerald-700 hover:underline dark:text-emerald-400" onClick={() => chooseProvince(province)}>{province.name}</button>
            </>
          ) : null}
          {municipality ? (
            <>
              <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <span className="text-slate-700 dark:text-slate-300">{municipality.nameEn}</span>
            </>
          ) : null}
        </nav>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-800 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Province
              <select value={province?.id ?? ""} onChange={(event) => chooseProvince(provinces.find((item) => item.id === event.target.value) ?? null)} className="mt-1 block h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                <option value="">All Nepal</option>
                {provinces.map((item) => <option key={item.id} value={item.id}>{item.name} Province</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Local Level
              <select disabled={!province} value={municipality?.id ?? ""} onChange={(event) => chooseMunicipality(event.target.value || null)} className="mt-1 block h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:disabled:bg-slate-800">
                <option value="">{province ? "All local levels" : "Select a province first"}</option>
                {localOptions.map((item) => <option key={item.id} value={item.id}>{item.nameEn}</option>)}
              </select>
            </label>
          </div>

          <div className="relative">
            <div className="relative h-[450px] bg-slate-100 sm:h-[520px] lg:h-[calc(100dvh-17rem)] lg:min-h-[390px] lg:max-h-[680px] dark:bg-slate-900">
              <MapContainer bounds={NEPAL_BOUNDS} zoomControl attributionControl={false} className="h-full w-full bg-slate-100 dark:bg-slate-900" minZoom={6} maxZoom={12}>
                <MapMotion bounds={selectedBounds} reduced={reduced} hasOverlay={Boolean(province)} />
                {provinceGeometry ? (
                  <Pane name="provinces" style={{ zIndex: 410 }}>
                    <GeoJSON data={provinceGeometry as any} style={(feature) => { const selected = province?.id === String((feature?.properties as ProvinceProperties).PROVINCE); return { color: selected ? "#047857" : "#64748b", weight: selected ? 3 : 1.5, fillColor: selected ? "#d1fae5" : "#e2e8f0", fillOpacity: province && !selected ? 0.14 : 0.62 }; }} onEachFeature={(feature, layer) => { const properties = feature.properties as ProvinceProperties; const current = provinces.find((item) => item.id === String(properties.PROVINCE)); layer.bindTooltip(current?.name ?? properties.PR_NAME, { sticky: true, direction: "top" }); layer.on({ click: () => current && chooseProvince(current), mouseover: (event) => event.target.setStyle({ fillColor: "#a7f3d0", fillOpacity: 0.82 }), mouseout: (event) => event.target.setStyle({ fillColor: province?.id === current?.id ? "#d1fae5" : "#e2e8f0", fillOpacity: province && province.id !== current?.id ? 0.14 : 0.62 }) }); }} />
                  </Pane>
                ) : null}
                {province && localGeometry ? (
                  <Pane name="local-levels" style={{ zIndex: 430 }}>
                    <GeoJSON key={`local-levels-${province.id}`} data={localGeometry as any} style={(feature) => { const properties = feature?.properties as MunicipalityProperties; const selected = municipality?.id === properties.municipalityId; return { color: selected ? "#065f46" : "#64748b", weight: selected ? 3 : 0.8, fillColor: selected ? "#34d399" : "#f8fafc", fillOpacity: selected ? 0.76 : 0.34 }; }} onEachFeature={(feature, layer: Layer) => { const properties = feature.properties as MunicipalityProperties; layer.bindTooltip(`<strong>${properties.municipalityName}</strong><br>${properties.districtName}`, { sticky: true, direction: "top" }); layer.on({ click: () => chooseMunicipality(properties.municipalityId) }); }} />
                  </Pane>
                ) : null}
              </MapContainer>

              {geoStatus === "loading" ? <div className="pointer-events-none absolute left-4 top-4 z-[500] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs font-medium text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-300" aria-live="polite">Loading local boundaries…</div> : null}
              {geoStatus === "error" ? <div className="absolute inset-x-4 top-4 z-[500] rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">Administrative boundaries could not be loaded. <button className="font-semibold underline" onClick={() => chooseProvince(null)}>Return to Nepal</button></div> : null}

              {province ? <div className="absolute bottom-5 right-5 z-[500] hidden w-[280px] md:block"><SnapshotCard province={province} municipality={municipality} status={budgetStatus} snapshot={snapshot} /></div> : null}
            </div>

            {province ? <div className="border-t border-slate-200 p-3 dark:border-slate-800 md:hidden"><SnapshotCard province={province} municipality={municipality} status={budgetStatus} snapshot={snapshot} /></div> : null}
          </div>
        </section>
      </div>
    </Layout>
  );
}
