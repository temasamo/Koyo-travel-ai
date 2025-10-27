export type AreaKey = "kaminoyama" | "fujigoko";

export const AREA_CONFIG: Record<
  AreaKey,
  {
    label: string;
    center: google.maps.LatLngLiteral;
    zoom: number;
    defaultQuerySuffix: string;
    fixedPlaceIds: string[];
  }
> = {
  kaminoyama: {
    label: "上山温泉エリア",
    center: { lat: 38.1509, lng: 140.2608 },
    zoom: 14,
    defaultQuerySuffix: "上山市",
    fixedPlaceIds: [], // ← 一旦空に
  },

  fujigoko: {
    label: "富士五湖エリア",
    center: { lat: 35.4301, lng: 138.8219 },
    zoom: 13,
    defaultQuerySuffix: "富士五湖",
    fixedPlaceIds: [], // ← 一旦空に
  },
};

// 検索クエリにエリア名を自動補完する関数
export function buildSearchQuery(raw: string, area: AreaKey): string {
  const suffix = AREA_CONFIG[area].defaultQuerySuffix;
  return raw.includes(suffix) ? raw : `${raw} ${suffix}`;
}
