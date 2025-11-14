"use client";
import { useEffect, useRef, useState } from "react";
import CustomInfoPanel from "./CustomInfoPanel";
import { DEFAULT_ORIGIN, MAX_PROCESS_PLACES } from "@/constants/map";
import { filterPlacesByConfidence } from "@/utils/maps";
import { usePlanStore } from "@/store/planStore";
import { STAFF_RECOMMENDATIONS, CATEGORY_COLORS } from "@/constants/staffRecommendations";

interface Location {
  name: string;
  type: string;
  confidence: number;
  categories?: string[]; // スタッフおすすめ用
  address?: string; // スタッフおすすめ用
  lat?: number; // 緯度（事前定義でAPI呼び出し不要）
  lng?: number; // 経度（事前定義でAPI呼び出し不要）
}

interface MapViewProps {
  locations?: Location[];
  onPlaceClick?: (place: string) => void;
}
// ラッパー: Hook数を安定させるため、フェーズ分岐はここでのみ行う
export default function MapView({ locations = [], onPlaceClick }: MapViewProps) {
  const { planPhase, planMessage, origin, lodging } = usePlanStore();
  return <ActualMapView locations={locations} onPlaceClick={onPlaceClick} />;
}

function ActualMapView({ locations = [], onPlaceClick }: MapViewProps) {
  const { 
    planMessage, 
    origin, 
    lodging, 
    selectedCategories, 
    setSelectedCategories, 
    showStaffRecommendations,
    routeRules,
    shouldGenerateRoute,
    resetRouteGeneration,
    triggerRouteGeneration
  } = usePlanStore();
  if (typeof window !== "undefined" && (!window.google || !(window as any).google.maps)) {
    console.warn("Google Maps not ready yet.");
    // 初期ロード時はスクリプト読み込みで復帰する
  }
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);
  const routePolyline = useRef<google.maps.DirectionsRenderer | null>(null);
  const aiRoutePolyline = useRef<google.maps.Polyline | null>(null);
  const [routeLegs, setRouteLegs] = useState<google.maps.DirectionsLeg[]>([]);
  const [routePointNames, setRoutePointNames] = useState<string[]>([]);
  const [aiRouteSegments, setAiRouteSegments] = useState<Array<{from: string; to: string; distance?: string; duration?: string}>>([]);
  const [shouldShowAiRoute, setShouldShowAiRoute] = useState(false); // ルート表表示フラグ
  // 各ルートセグメントのPolylineを管理（ハイライト用）
  const routeSegmentPolylines = useRef<google.maps.Polyline[]>([]);
  // AI生成ルート用のPolylineを管理（ホバー用）
  const aiRouteSegmentPolylines = useRef<google.maps.Polyline[]>([]);
  const [hoveredSegmentIndex, setHoveredSegmentIndex] = useState<number | null>(null);
  const [hoveredAiSegmentIndex, setHoveredAiSegmentIndex] = useState<number | null>(null);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);
  const blinkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // 地点名から座標へのマッピング（AI生成ルート用）
  const locationCoordinatesMap = useRef<Map<string, {lat: number; lng: number}>>(new Map());
  // 初期レンダリング時には google は未定義のため、プレーン文字列で管理
  const [travelMode, setTravelMode] = useState<'DRIVING' | 'WALKING' | 'TRANSIT'>('DRIVING');
  const infoWindows = useRef<google.maps.InfoWindow[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [extractedFromPlan, setExtractedFromPlan] = useState<Location[]>([]);
  const categorySearchCache = useRef<Map<string, Location[]>>(new Map());

  // グローバル関数を設定（CustomInfoPanel用）
  useEffect(() => {
    (window as any).openCustomPanel = (placeId: string) => {
      setSelectedPlaceId(placeId);
    };
  }, []);

  useEffect(() => {
    const loadGoogleMaps = () =>
      new Promise<void>((resolve, reject) => {
        if (window.google?.maps) return resolve();
        const s = document.createElement("script");
        s.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=marker,places,geometry&v=weekly`;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Google Maps failed to load"));
        document.head.appendChild(s);
      });

    const init = async () => {
      await loadGoogleMaps();
      const { Map } = (await google.maps.importLibrary("maps")) as google.maps.MapsLibrary;
      const { AdvancedMarkerElement } = (await google.maps.importLibrary("marker")) as google.maps.MarkerLibrary;

      const target = { lat: 38.146, lng: 140.274 }; // 上山エリア中心
      const mapInstance = new Map(mapRef.current!, {
        zoom: 12,
        center: target,
        mapId: "DEMO_MAP_ID",
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      setMap(mapInstance);
      setIsMapReady(true);
      console.log("✔ Map initialized successfully");
    };

    init();
  }, []);

  // Planのテキストから地名抽出とルート情報抽出 → マップへ反映
  useEffect(() => {
    const extract = async () => {
      console.log("🔍 extract開始 - planMessage:", planMessage ? "存在" : "なし", "isMapReady:", isMapReady);
      if (!planMessage || !isMapReady) {
        console.log("⏸️ planMessageまたはisMapReadyが未準備のためスキップ");
        return;
      }
      
      // 古いルート情報をクリア（AI生成ルートが抽出される前に、既存のルート情報をクリア）
      // ただし、スタッフおすすめモードで既にAI生成ルートが存在する場合は、抽出後に上書きされるため一時的にクリア
      setAiRouteSegments([]);
      setShouldShowAiRoute(false); // ルート表表示フラグもリセット
      setRouteLegs([]);
      setRoutePointNames([]);
      // AIルート線もクリア
      if (aiRoutePolyline.current) {
        aiRoutePolyline.current.setMap(null);
        aiRoutePolyline.current = null;
      }
      
      // スタッフおすすめモードでも、AIが提案したルートを抽出する
      try {
        // 地名抽出
        const locRes = await fetch("/api/ai/extract-locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: planMessage }),
        });
        const locData = await locRes.json();
        const locs: Location[] = Array.isArray(locData.locations) ? locData.locations : (locData.locations?.locations ?? []);
        setExtractedFromPlan(locs);
        console.log("📍 抽出された地名:", locs.map(l => l.name));

        // AI生成テキストからルート情報を抽出
        const routeRes = await fetch("/api/ai/extract-route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: planMessage }),
        });
        const routeData = await routeRes.json();
        const routeSegments = routeData.routeSegments || [];
        console.log("🔍 抽出されたルート情報:", routeSegments);
        
        if (routeSegments.length > 0) {
          console.log("✅ AI生成ルート情報を抽出:", routeSegments);
          console.log("🔘 ルート表とボタンが表示されるはずです。aiRouteSegments:", routeSegments.length, "件");
          setAiRouteSegments(routeSegments);
          // Google Directions APIのルートは不要なのでクリア
          setRouteLegs([]);
          setRoutePointNames([]);
          // ルート線は「ルートを表示する」ボタンを押したときに描画
          setShouldShowAiRoute(false);
        } else {
          console.log("⚠️ ルート情報が見つからない - 地名の順番からルート表を作成");
          // ルート情報が見つからない場合、地名の順番からルート表を作成
          if (locs.length > 1) {
            const segmentsFromLocs = [];
            // 古窯旅館から開始（最初の地点が古窯旅館でない場合は追加）
            const startPoint = locs[0].name === "古窯旅館" ? locs[0].name : "古窯旅館";
            if (locs[0].name !== "古窯旅館") {
              segmentsFromLocs.push({
                from: "古窯旅館",
                to: locs[0].name,
                distance: "推定",
                duration: "推定"
              });
            }
            // 残りの地点間のルート
            for (let i = 0; i < locs.length - 1; i++) {
              segmentsFromLocs.push({
                from: locs[i].name,
                to: locs[i + 1].name,
                distance: "推定",
                duration: "推定"
              });
            }
            console.log("📍 地名順から生成したルート表:", segmentsFromLocs);
            setAiRouteSegments(segmentsFromLocs);
            // ルート線は「ルートを表示する」ボタンを押したときに描画
            setShouldShowAiRoute(false);
          }
        }
      } catch (e) {
        console.warn("extract failed", e);
      }
    };
    extract();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planMessage, isMapReady, showStaffRecommendations]);

  // shouldShowAiRouteがtrueになったときにルートを描画
  useEffect(() => {
    if (shouldShowAiRoute && aiRouteSegments.length > 0 && map && isMapReady) {
      console.log("✅ ルート表示ボタンが押されました。ルートを描画します。");
      // スタッフおすすめモードの場合は、STAFF_RECOMMENDATIONSから座標を取得
      if (showStaffRecommendations) {
        console.log("📍 スタッフおすすめモード: STAFF_RECOMMENDATIONSから座標を取得");
        // スタッフおすすめの地点をLocation形式に変換
        const staffLocationsForRoute: Location[] = STAFF_RECOMMENDATIONS.map(rec => ({
          name: rec.name,
          type: 'attraction',
          confidence: 1.0,
          categories: rec.categories,
          address: rec.address,
          lat: rec.lat,
          lng: rec.lng,
        }));
        drawAiRouteLines(aiRouteSegments, staffLocationsForRoute);
      } else if (extractedFromPlan.length > 0) {
        // AIプランモードの場合
        drawAiRouteLines(aiRouteSegments, extractedFromPlan);
      } else {
        console.warn("⚠️ ルート描画に必要な地点情報がありません");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldShowAiRoute, aiRouteSegments, extractedFromPlan, map, isMapReady, showStaffRecommendations]);

  // AI生成ルートの地点間に線を引く（Google Directions APIを使用して実際の道路に沿ったルートを取得）
  const drawAiRouteLines = async (segments: Array<{from: string; to: string; distance?: string; duration?: string}>, locations: Location[]) => {
    if (!map || !isMapReady || segments.length === 0) return;

    // 既存のAIルート線をクリア
    if (aiRoutePolyline.current) {
      aiRoutePolyline.current.setMap(null);
      aiRoutePolyline.current = null;
    }

    try {
      // 地点名から座標を取得
      const locationMap = new Map<string, {lat: number; lng: number}>();
      
      // 抽出された地点の座標をマップに追加
      for (const loc of locations) {
        if ((loc as any).lat && (loc as any).lng) {
          locationMap.set(loc.name, { lat: (loc as any).lat, lng: (loc as any).lng });
        }
      }

      // スタッフおすすめの座標も追加
      for (const rec of STAFF_RECOMMENDATIONS) {
        if (rec.lat && rec.lng) {
          locationMap.set(rec.name, { lat: rec.lat, lng: rec.lng });
        }
      }

      // 古窯旅館の座標を追加
      locationMap.set("古窯旅館", { lat: DEFAULT_ORIGIN.lat, lng: DEFAULT_ORIGIN.lng });

      // 各セグメントの座標を取得
      const missingLocations: string[] = [];
      const allPaths: google.maps.LatLng[] = [];

      const directionsService = new google.maps.DirectionsService();

      // 各セグメントごとにGoogle Directions APIを呼び出して実際の道路に沿ったルートを取得
      for (const segment of segments) {
        // 出発地点の座標を取得
        let fromCoord = locationMap.get(segment.from);
        if (!fromCoord) {
          try {
            const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": String(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
                "X-Goog-FieldMask": "places.location",
              },
              body: JSON.stringify({
                textQuery: `${segment.from} 山形県`,
                languageCode: "ja",
                regionCode: "JP",
              }),
            });
            const searchData = await searchRes.json();
            const place = searchData.places?.[0];
            if (place?.location) {
              fromCoord = { lat: place.location.latitude, lng: place.location.longitude };
              locationMap.set(segment.from, fromCoord);
            } else {
              missingLocations.push(segment.from);
              continue;
            }
          } catch (e) {
            console.warn(`座標取得失敗 (${segment.from}):`, e);
            missingLocations.push(segment.from);
            continue;
          }
        }

        // 目的地の座標を取得
        let toCoord = locationMap.get(segment.to);
        if (!toCoord) {
          try {
            const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": String(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
                "X-Goog-FieldMask": "places.location",
              },
              body: JSON.stringify({
                textQuery: `${segment.to} 山形県`,
                languageCode: "ja",
                regionCode: "JP",
              }),
            });
            const searchData = await searchRes.json();
            const place = searchData.places?.[0];
            if (place?.location) {
              toCoord = { lat: place.location.latitude, lng: place.location.longitude };
              locationMap.set(segment.to, toCoord);
            } else {
              missingLocations.push(segment.to);
              continue;
            }
          } catch (e) {
            console.warn(`座標取得失敗 (${segment.to}):`, e);
            missingLocations.push(segment.to);
            continue;
          }
        }

        // Google Directions APIで実際の道路に沿ったルートを取得
        if (fromCoord && toCoord) {
          try {
            await new Promise<void>((resolve, reject) => {
              directionsService.route({
                origin: new google.maps.LatLng(fromCoord!.lat, fromCoord!.lng),
                destination: new google.maps.LatLng(toCoord!.lat, toCoord!.lng),
                travelMode: travelMode as any,
              }, (result, status) => {
                if (status === "OK" && result) {
                  // ルートのパスを取得（stepsから詳細なパスを取得）
                  const route = result.routes?.[0];
                  if (route && route.legs && route.legs.length > 0) {
                    const leg = route.legs[0];
                    // legのstepsから詳細なパスを取得
                    leg.steps.forEach(step => {
                      if (step.path) {
                        step.path.forEach(point => {
                          allPaths.push(point);
                        });
                      }
                    });
                  }
                  resolve();
                } else {
                  console.warn(`⚠️ ルート取得失敗 (${segment.from} → ${segment.to}):`, status);
                  // フォールバック: 直線で結ぶ
                  allPaths.push(new google.maps.LatLng(fromCoord!.lat, fromCoord!.lng));
                  allPaths.push(new google.maps.LatLng(toCoord!.lat, toCoord!.lng));
                  resolve();
                }
              });
            });
          } catch (e) {
            console.warn(`ルート取得エラー (${segment.from} → ${segment.to}):`, e);
            // フォールバック: 直線で結ぶ
            allPaths.push(new google.maps.LatLng(fromCoord.lat, fromCoord.lng));
            allPaths.push(new google.maps.LatLng(toCoord.lat, toCoord.lng));
          }
        }
      }

      if (missingLocations.length > 0) {
        console.warn("⚠️ 座標が見つからない地点:", missingLocations);
      }

      if (allPaths.length >= 2) {
        // Polylineを描画（実際の道路に沿ったルート）
        const polyline = new google.maps.Polyline({
          path: allPaths,
          geodesic: true,
          strokeColor: "#007BFF",
          strokeOpacity: 0.6,
          strokeWeight: 3,
          map: map,
        });
        aiRoutePolyline.current = polyline;
        console.log("✅ AI生成ルート線を描画（道路に沿ったルート）:", allPaths.length, "地点");
      } else {
        console.warn("⚠️ ルート線描画に必要な座標が不足しています");
      }
    } catch (error) {
      console.error("❌ AIルート線描画エラー:", error);
    }
  };

  // カテゴリマッチャ
  const matchCategory = (name: string, category: string) => {
    const n = name || "";
    if (category === "歴史") return /(城|寺|神社|史跡)/.test(n);
    if (category === "自然") return /(公園|滝|湖|展望|蔵王|お釜|峡|岳|山)/.test(n);
    if (category === "遊ぶ") return /(ロープウェイ|体験|スキー|遊園|アクティビティ|スノー|テーマパーク|ワールド|リナ)/.test(n);
    if (category === "食べる") return /(食|レストラン|カフェ|そば|郷土|食堂)/.test(n);
    return true;
  };

  // カテゴリ選択時、Places検索で補完（キャッシュ機能付き）
  useEffect(() => {
    const runCategorySearch = async () => {
      if (!isMapReady || !selectedCategories || selectedCategories.length === 0) return;
      
      const cat = selectedCategories[0];
      
      // キャッシュチェック
      if (categorySearchCache.current.has(cat)) {
        const cached = categorySearchCache.current.get(cat)!;
        console.log(`💾 キャッシュから取得 (${cat}): ${cached.length}件`, cached.map(l => l.name));
        setExtractedFromPlan(cached);
        return;
      }
      
      // 既存データでカテゴリにマッチするものがあるかチェック
      const effective = locations.length > 0 ? locations : extractedFromPlan;
      const matched = effective.filter((loc) => matchCategory(loc.name, cat));
      if (matched.length >= 3) {
        console.log(`✅ 既存データで十分 (${cat}): ${matched.length}件`, matched.map(l => l.name));
        setExtractedFromPlan(matched);
        categorySearchCache.current.set(cat, matched);
        return;
      }
      
      // API呼び出しが必要な場合のみ実行
      try {
        const headers = {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': String(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
          'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.rating,places.userRatingCount',
        };
        
        // 1カテゴリ1クエリに縮小（API使用量削減）
        let textQuery = '';
        if (cat === '歴史') {
          textQuery = '上山市 城 寺 神社 史跡';
        } else if (cat === '自然') {
          textQuery = '上山市 公園 滝 湖 展望 蔵王';
        } else if (cat === '遊ぶ') {
          textQuery = '山形県 遊園地 テーマパーク リナワールド ロープウェイ 体験';
        } else {
          textQuery = '上山市 レストラン カフェ 郷土料理';
        }
        
        console.log(`🔍 API呼び出し開始 (${cat}): 1クエリ - "${textQuery}"`);
        const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers,
          body: JSON.stringify({ textQuery, languageCode: 'ja', regionCode: 'JP' }),
        });
        const data = await res.json();
        
        const locs: Location[] = (data.places || []).slice(0, 15).map((p: any) => ({
          name: p.displayName?.text ?? 'スポット',
          type: 'attraction',
          confidence: 0.9, // Placesでヒットしたので高めに
        }));
        
        console.log(`🔍 API検索結果 (${cat}): ${locs.length}件`, locs.map(l => l.name));
        if (locs.length > 0) {
          setExtractedFromPlan(locs);
          categorySearchCache.current.set(cat, locs);
        }
      } catch (e) {
        console.warn(`category search failed (${cat}):`, e);
      }
    };
    runCategorySearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategories, isMapReady]);

  // 地名に基づいてピンを追加し、ルートを描画する機能
  useEffect(() => {
    console.log("🔍 MapView useEffect - map:", !!map, "isMapReady:", isMapReady, "locations:", locations, "showStaffRecommendations:", showStaffRecommendations);
    
    // スタッフおすすめモードになったとき、既存のルート情報をクリア
    if (showStaffRecommendations) {
      console.log("🔍 スタッフおすすめモード: 既存のルート情報をクリア");
      setRouteLegs([]);
      setRoutePointNames([]);
      setAiRouteSegments([]);
      setShouldShowAiRoute(false);
      if (routePolyline.current) {
        routePolyline.current.setMap(null);
        routePolyline.current = null;
      }
      if (aiRoutePolyline.current) {
        aiRoutePolyline.current.setMap(null);
        aiRoutePolyline.current = null;
      }
      // セグメントPolylineもクリア
      routeSegmentPolylines.current.forEach(polyline => {
        if (polyline) polyline.setMap(null);
      });
      routeSegmentPolylines.current = [];
    }
    
    // スタッフおすすめスポットをLocation形式に変換（座標も含む）
    const staffLocations: Location[] = showStaffRecommendations 
      ? STAFF_RECOMMENDATIONS.map(rec => ({
          name: rec.name,
          type: 'attraction',
          confidence: 1.0, // スタッフおすすめは最高信頼度
          categories: rec.categories,
          address: rec.address,
          lat: rec.lat,
          lng: rec.lng,
        }))
      : [];
    
    // スタッフおすすめボタンがONの場合、スタッフおすすめのスポットのみを使用
    let effectiveLocations: Location[] = [];
    if (showStaffRecommendations && staffLocations.length > 0) {
      // スタッフおすすめのみを使用（他のソースは無視）
      effectiveLocations = [...staffLocations];
      console.log("✅ スタッフおすすめモード: スタッフおすすめのスポットのみを使用", effectiveLocations.length, "件");
    } else {
      // スタッフおすすめがOFFの場合のみ、他のソースを使用
      // カテゴリ選択時はカテゴリ検索結果を優先、それ以外はlocationsを優先
      effectiveLocations = (selectedCategories && selectedCategories.length > 0 && extractedFromPlan.length > 0) 
        ? extractedFromPlan 
        : (locations.length > 0 ? locations : extractedFromPlan);
    }
    
    // カテゴリフィルタ（選択がある場合のみ）
    // スタッフおすすめモードでもカテゴリフィルタは適用
    if (selectedCategories && selectedCategories.length > 0) {
      const beforeFilter = effectiveLocations.length;
      effectiveLocations = effectiveLocations.filter((loc: any) => {
        // スタッフおすすめの場合は、categoriesプロパティで判定
        if (loc.categories) {
          return selectedCategories.some((c) => loc.categories.includes(c));
        }
        return selectedCategories.some((c) => matchCategory(loc.name, c));
      });
      console.log(`🎯 カテゴリフィルタ: ${beforeFilter}件 → ${effectiveLocations.length}件`, effectiveLocations.map((l: any) => l.name));
    }
    
    // スタッフおすすめがONかつ有効な地点がない場合でも、スタッフおすすめがあれば表示
    if (!map || !isMapReady) return;
    if (effectiveLocations.length === 0 && (!showStaffRecommendations || staffLocations.length === 0)) return;

    const addLocationMarkersAndRoute = async () => {
      try {
        const { AdvancedMarkerElement } = (await google.maps.importLibrary("marker")) as google.maps.MarkerLibrary;
        
        // 既存のマーカーとルートをクリア
        markers.forEach(marker => {
          if (marker && marker.map) {
            marker.map = null;
          }
        });
        setMarkers([]);

        // 既存の吹き出しをクリア
        infoWindows.current.forEach(infoWindow => {
          infoWindow.close();
        });
        infoWindows.current = [];

        // 既存のルートをクリア
        if (routePolyline.current) {
          routePolyline.current.setMap(null);
          routePolyline.current = null;
        }
        // セグメントPolylineもクリア
        routeSegmentPolylines.current.forEach(polyline => {
          if (polyline) polyline.setMap(null);
        });
        routeSegmentPolylines.current = [];
        setRouteLegs([]);
        setRoutePointNames([]);
        setHoveredSegmentIndex(null);
        setSelectedSegmentIndex(null);
        // AI生成ルートセグメントは保持（planMessageが変わらない限り）

        // フィルタリング適用（スタッフおすすめの場合は制限なし）
        let candidates: any[];
        const hasStaffLocations = effectiveLocations.some((loc: any) => loc.lat && loc.lng && loc.confidence === 1.0);
        if (showStaffRecommendations && hasStaffLocations) {
          // スタッフおすすめの場合：制限なしで全件表示（API呼び出しなしのため）
          candidates = effectiveLocations;
          console.log(`📍 処理対象地点: ${candidates.length}件（スタッフおすすめ: 制限なし）`);
        } else {
          // 通常の場合：信頼度フィルタと件数制限を適用
          candidates = filterPlacesByConfidence(effectiveLocations as any);
          console.log(`📍 処理対象地点: ${candidates.length}件（制限: ${MAX_PROCESS_PLACES}）`);
        }

        await resolveAndRender(candidates);
      } catch (error) {
        console.error("❌ マーカー・ルート描画エラー:", error);
      }
    };

    addLocationMarkersAndRoute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isMapReady, locations, extractedFromPlan, showStaffRecommendations, shouldGenerateRoute]);

  // 地名解決とマーカー・ルート描画
  const resolveAndRender = async (candidates: any[]) => {
    if (!map) {
      console.log("❌ Map not ready");
      return;
    }

    console.log("🔍 resolveAndRender開始 - candidates:", candidates.length);
    
    // AdvancedMarkerElementをインポート
    const { AdvancedMarkerElement } = (await google.maps.importLibrary("marker")) as google.maps.MarkerLibrary;
    
    const newMarkers: google.maps.marker.AdvancedMarkerElement[] = [];
    const resolved: { name: string; lat: number; lng: number; placeId?: string }[] = [];

    for (const candidate of candidates) {
      try {
        const query = candidate.name || candidate.text;
        if (!query) continue;

        // 座標が既に定義されている場合はAPI呼び出し不要（スタッフおすすめなど）
        let position: google.maps.LatLng | null = null;
        let place: any = null;
        
        if ((candidate as any).lat && (candidate as any).lng) {
          // 座標が定義済み：API呼び出し不要
          position = new google.maps.LatLng((candidate as any).lat, (candidate as any).lng);
          place = {
            displayName: { text: query },
            formattedAddress: (candidate as any).address || query,
          };
          console.log(`📍 座標使用 (${query}):`, position);
        } else {
          // 座標が未定義：Places APIで検索
          const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": String(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
              "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.rating,places.userRatingCount,places.photos,places.formattedAddress",
            },
            body: JSON.stringify({
              textQuery: `${query} 山形県`,
              languageCode: "ja",
              regionCode: "JP",
            }),
          });

          const searchData = await searchRes.json();
          place = searchData.places?.[0];
          
          console.log(`🔍 検索結果 (${query}):`, place);

          if (place?.location) {
            position = new google.maps.LatLng(place.location.latitude, place.location.longitude);
          }
        }

        if (position) {
          // 番号バッジ付きマーカー（解決順 1..n）
          const order = resolved.length + 1;
          
          // カテゴリ別の色を決定（優先順位：「遊ぶ」>「自然」>「歴史」>「食べる」>「学ぶ」）
          const categories = (candidate as any).categories || [];
          let categoryColor = "#EF4444"; // デフォルトは赤
          if (categories.length > 0) {
            // 優先順位に従って色を決定
            if (categories.includes("遊ぶ")) {
              categoryColor = CATEGORY_COLORS["遊ぶ"] || "#EF4444";
            } else if (categories.includes("自然")) {
              categoryColor = CATEGORY_COLORS["自然"] || "#EF4444";
            } else if (categories.includes("歴史")) {
              categoryColor = CATEGORY_COLORS["歴史"] || "#EF4444";
            } else if (categories.includes("食べる")) {
              categoryColor = CATEGORY_COLORS["食べる"] || "#EF4444";
            } else if (categories.includes("学ぶ")) {
              categoryColor = CATEGORY_COLORS["学ぶ"] || "#EF4444";
            } else {
              // その他のカテゴリは最初の色を使用
              categoryColor = CATEGORY_COLORS[categories[0]] || "#EF4444";
            }
          }
          
          const badge = document.createElement("div");
          badge.style.display = "flex";
          badge.style.alignItems = "center";
          badge.style.justifyContent = "center";
          badge.style.width = "28px";
          badge.style.height = "28px";
          badge.style.borderRadius = "9999px";
          badge.style.background = categoryColor;
          badge.style.color = "#fff";
          badge.style.fontSize = "12px";
          badge.style.fontWeight = "700";
          badge.style.boxShadow = "0 1px 6px rgba(0,0,0,.25)";
          badge.textContent = String(order);

          const marker = new AdvancedMarkerElement({
            map,
            position,
            title: place.displayName?.text || query,
            content: badge,
          });

          // 画像・レーティング対応のInfoWindow
          const photoUrl = place.photos && place.photos.length > 0 && place.photos[0].name
            ? `https://places.googleapis.com/v1/${place.photos[0].name}/media?key=${String(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)}&maxWidthPx=300`
            : null;

          const commentId = place.id || query.replace(/\s+/g, '-');
          const mapUrl = place.id 
            ? `https://www.google.com/maps/place/?q=place_id:${place.id}`
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

          const infoWindow = new google.maps.InfoWindow({
            content: `
              <div style="max-width:300px; font-family: system-ui, -apple-system, sans-serif;">
                ${photoUrl ? `
                  <img src="${photoUrl}" style="width:100%; border-radius:8px; aspect-ratio:16/9; object-fit:cover; margin-bottom:8px;" />
                ` : `
                  <div style="width:100%; aspect-ratio:16/9; background-color:#f3f4f6; border-radius:8px; margin-bottom:8px; display:flex; align-items:center; justify-content:center; color:#9ca3af; font-size:12px;">
                    画像なし
                  </div>
                `}
                <h3 style="margin:8px 0 4px; font-size:16px; font-weight:bold;">${place.displayName?.text || query}</h3>
                <div style="opacity:.8; font-size:13px; color:#f59e0b; margin-bottom:4px;">
                  ⭐ ${place.rating ? place.rating.toFixed(1) : "-"}（${place.userRatingCount || 0}件）
                </div>
                <div id="ai-comment-${commentId}" style="font-size:13px; color:#374151; background:#F9FAFB; padding:6px 8px; border-radius:6px; margin:6px 0;">
                  AIコメント生成中...
                </div>
                <div style="margin-top:6px; font-size:13px; color:#6b7280;">
                  ${place.formattedAddress || (candidate as any).address || ""}
                </div>
                <a href="${mapUrl}" target="_blank" 
                   style="display:inline-block;margin-top:8px; padding:4px 8px; background-color:#10b981; color:white; text-decoration:none; border-radius:4px; font-size:12px;">
                  Googleマップで見る
                </a>
              </div>
            `,
          });

          // マーカークリック時の処理
          marker.addListener("click", async () => {
            infoWindows.current.forEach(iw => iw.close());
            infoWindow.open(map, marker);
            
            if (onPlaceClick) {
              onPlaceClick(place.displayName?.text || query);
            }
            
            map.panTo(position);

            // AIコメント取得
            try {
              const title = place.displayName?.text || query;
              const prompt = `観光スポット「${title}」のおすすめポイントを日本語で60〜90字で、カジュアルに1文で。固有名詞はそのまま、箇条書き禁止。`;
              const res = await fetch("/api/ai/comment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt }),
              });
              const data = await res.json();
              const el = document.getElementById(`ai-comment-${commentId}`);
              if (el) {
                el.textContent = data?.comment || "コメントを取得できませんでした。";
              }
            } catch (e) {
              console.warn("AIコメント取得失敗", e);
              const el = document.getElementById(`ai-comment-${commentId}`);
              if (el) {
                el.textContent = "コメントを取得できませんでした。";
              }
            }
          });

          newMarkers.push(marker);
          infoWindows.current.push(infoWindow);
          
          // 座標を取得（定義済みの場合はcandidateから、APIの場合はplaceから）
          const lat = (candidate as any).lat || place?.location?.latitude || position.lat();
          const lng = (candidate as any).lng || place?.location?.longitude || position.lng();
          
          resolved.push({ 
            name: place.displayName?.text || query, 
            lat,
            lng,
            placeId: place.id
          });
        }
      } catch (error) {
        console.error(`❌ 地点検索エラー (${candidate.name}):`, error);
      }
    }

    console.log(`✅ 解決完了 - マーカー: ${newMarkers.length}件, 解決済み: ${resolved.length}件`);
    
    // 地点名から座標へのマッピングを更新
    resolved.forEach(r => {
      locationCoordinatesMap.current.set(r.name, { lat: r.lat, lng: r.lng });
    });
    // 古窯旅館の座標も追加
    const actualKoyoOrigin = koyoCoordinates || DEFAULT_ORIGIN;
    locationCoordinatesMap.current.set("古窯旅館", actualKoyoOrigin);
    
    if (resolved.length > 0) {
      setMarkers(newMarkers);
      
      // スタッフおすすめモードの場合、AIが提案したルートセグメントが既に存在する場合は使用し、存在しない場合のみ全スポット間のルートを生成
      if (showStaffRecommendations && resolved.length > 1) {
        // AIが提案したルートセグメントが既に存在する場合は、それを使用する（上書きしない）
        if (aiRouteSegments.length > 0) {
          console.log("✅ スタッフおすすめモード: AIが提案したルートセグメントを使用（", aiRouteSegments.length, "件）");
          setShouldShowAiRoute(false); // 初期状態ではルートは表示しない
          return; // AIが提案したルートを使用するため、ここで終了
        }
        
        // planMessageが存在する場合は、AIが提案したルートを抽出するまで待つ（全スポット間のルートは生成しない）
        if (planMessage) {
          console.log("⏸️ スタッフおすすめモード: planMessageが存在するため、AIが提案したルートを待機中（全スポット間のルートは生成しない）");
          setShouldShowAiRoute(false);
          return;
        }
        
        console.log("⚠️ スタッフおすすめモード: AIが提案したルートがないため、全スポット間のルートを生成");
        // 古窯旅館から開始するルートセグメントを生成
        const segments: Array<{from: string; to: string; distance?: string; duration?: string}> = [];
        
        // 古窯旅館を最初に追加（存在する場合）
        const hasKoyo = resolved.some(r => r.name === "古窯旅館");
        const startIndex = hasKoyo ? resolved.findIndex(r => r.name === "古窯旅館") : 0;
        
        // 古窯旅館が最初でない場合、古窯旅館から最初の地点へのルートを追加
        if (!hasKoyo || startIndex !== 0) {
          segments.push({
            from: "古窯旅館",
            to: resolved[0].name,
            distance: "推定",
            duration: "推定"
          });
        }
        
        // 残りの地点間のルート
        for (let i = 0; i < resolved.length - 1; i++) {
          segments.push({
            from: resolved[i].name,
            to: resolved[i + 1].name,
            distance: "推定",
            duration: "推定"
          });
        }
        
        // 最後の地点から古窯旅館へのルート（古窯旅館が最初でない場合）
        if (!hasKoyo || startIndex !== 0) {
          segments.push({
            from: resolved[resolved.length - 1].name,
            to: "古窯旅館",
            distance: "推定",
            duration: "推定"
          });
        }
        
        console.log("📍 スタッフおすすめ全スポット間ルートセグメント:", segments);
        setAiRouteSegments(segments);
        setShouldShowAiRoute(false); // 初期状態ではルートは表示しない
        return; // スタッフおすすめモードではGoogle Directions APIのルート生成は行わない
      }
      
      // スタッフおすすめモードではルートを自動生成しない（AIプランが生成された後にルートを表示）
      // ルート生成ルールに基づいて判断
      const shouldAutoGenerate = (!showStaffRecommendations && routeRules.autoGenerate) || shouldGenerateRoute;
      
      if (shouldAutoGenerate) {
        drawRouteFromOrigin(resolved);
        if (shouldGenerateRoute) {
          resetRouteGeneration(); // フラグをリセット
        }
      } else {
        console.log("⏸️ ルート自動生成が無効化されています。手動でトリガーしてください。");
      }
    } else {
      console.log("❌ 解決できた地点が0件");
    }
  };

  // 古窯旅館の座標を取得（初回のみ）
  const [koyoCoordinates, setKoyoCoordinates] = useState<{lat: number; lng: number} | null>(null);
  
  useEffect(() => {
    const fetchKoyoCoordinates = async () => {
      if (koyoCoordinates || !isMapReady) return;
      
      try {
        const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": String(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
            "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.formattedAddress",
          },
          body: JSON.stringify({
            textQuery: "古窯旅館 山形県上山市",
            languageCode: "ja",
            regionCode: "JP",
          }),
        });

        const searchData = await searchRes.json();
        const place = searchData.places?.[0];
        
        if (place?.location) {
          const coords = {
            lat: place.location.latitude,
            lng: place.location.longitude
          };
          setKoyoCoordinates(coords);
          console.log("✅ 古窯旅館の座標を取得:", coords, place.displayName?.text);
        } else {
          console.warn("⚠️ 古窯旅館の座標を取得できませんでした。DEFAULT_ORIGINを使用します。");
          setKoyoCoordinates(DEFAULT_ORIGIN);
        }
      } catch (error) {
        console.error("❌ 古窯旅館の座標取得エラー:", error);
        setKoyoCoordinates(DEFAULT_ORIGIN);
      }
    };

    fetchKoyoCoordinates();
  }, [isMapReady, koyoCoordinates]);

  // 古窯旅館からのルート描画（ルールに基づいて実行）
  const drawRouteFromOrigin = (points: { name: string; lat: number; lng: number; placeId?: string }[]) => {
    if (!map || points.length === 0) return;
    
    // 古窯旅館の座標を決定（取得済みならそれを使用、なければDEFAULT_ORIGIN）
    const actualKoyoOrigin = koyoCoordinates || DEFAULT_ORIGIN;

    // 広範囲な地名（県、市）を除外するかどうかはルールで制御
    let filteredPoints = points;
    if (routeRules.excludeBroadAreas) {
      filteredPoints = points.filter(p => 
        !p.name.includes('県') && 
        !p.name.includes('市') && 
        !p.name.includes('町') &&
        p.name !== '山形県' &&
        p.name !== '上山市' &&
        p.name !== '山形市'
      );
    }

    // 最大地点数はルールで設定可能（デフォルト: 6）
    const limitedPoints = filteredPoints.slice(0, routeRules.maxPoints);

    console.log(`🗺️ ルート描画対象: ${limitedPoints.length}件 (元: ${points.length}件)`);
    console.log('地点:', limitedPoints.map(p => p.name));

    if (limitedPoints.length === 0) {
      console.log("❌ ルート描画対象地点なし");
      return;
    }

    const directionsService = new google.maps.DirectionsService();
    const directionsRenderer = new google.maps.DirectionsRenderer({ 
      suppressMarkers: true, 
      map: map,
      polylineOptions: {
        strokeColor: "#007BFF",
        strokeWeight: 3,
        strokeOpacity: 0.6,
      }
    });

    // 1地点のみの場合は直接ルート
    if (limitedPoints.length === 1 && !lodging) {
      // 名前リスト（出発→目的地）
      // 出発地は常に「古窯旅館」
      setRoutePointNames(["古窯旅館", limitedPoints[0].name]);
      directionsService.route({
        origin: actualKoyoOrigin, // 取得した「古窯旅館」の座標を使用
        destination: { lat: limitedPoints[0].lat, lng: limitedPoints[0].lng },
        travelMode: travelMode as any,
      }, (result, status) => {
        if (status === "OK" && result) {
          directionsRenderer.setDirections(result);
          routePolyline.current = directionsRenderer;
          const legs = result.routes?.[0]?.legs ?? [];
          setRouteLegs(legs);
          
          // 既存のセグメントPolylineをクリア
          routeSegmentPolylines.current.forEach(polyline => {
            if (polyline) polyline.setMap(null);
          });
          routeSegmentPolylines.current = [];
          
          // 1地点でもlegがある場合はPolylineを作成
          if (legs.length > 0) {
            const leg = legs[0];
            const path: google.maps.LatLng[] = [];
            leg.steps.forEach(step => {
              if (step.path) {
                step.path.forEach(point => {
                  path.push(point);
                });
              }
            });
            
            if (path.length > 0) {
              const polyline = new google.maps.Polyline({
                path: path,
                strokeColor: "#007BFF",
                strokeWeight: 3,
                strokeOpacity: 0.6,
                map: map,
              });
              routeSegmentPolylines.current.push(polyline);
            }
          }
          
          console.log("✅ ルート描画成功（1地点）");
        } else {
          console.warn("⚠️ ルート描画失敗（1地点）:", status);
        }
      });
    } else {
      // 複数地点の場合は経由地設定
      // 出発地は常に「古窯旅館」の座標を使用
      const startName = "古窯旅館";
      const actualOrigin = actualKoyoOrigin; // 取得した「古窯旅館」の座標を使用
      
      // limitedPointsから「古窯旅館」を除外（出発地として扱うため）
      const filteredPoints = limitedPoints.filter(p => p.name !== "古窯旅館");
      
      // 目的地を決定
      const finalDestination = filteredPoints.length > 0 
        ? filteredPoints[filteredPoints.length - 1]
        : limitedPoints[limitedPoints.length - 1];
      const destName = (lodging && lodging.trim().length > 0) ? lodging : finalDestination.name;
      
      // 経由地を設定（最後の地点は目的地なので除外）
      const waypoints = filteredPoints.slice(0, -1).map(p => ({ 
        location: { lat: p.lat, lng: p.lng }, 
        stopover: true 
      }));
      
      // 名前リスト（出発「古窯旅館」→経由→目的地）
      const pointNames = filteredPoints.slice(0, -1).map(p => p.name);
      setRoutePointNames([startName, ...pointNames, destName]);

      directionsService.route({
        origin: actualOrigin,
        destination: (lodging && lodging.trim().length > 0)
          ? lodging
          : { lat: finalDestination.lat, lng: finalDestination.lng },
        waypoints,
        travelMode: travelMode as any,
        optimizeWaypoints: routeRules.optimizeWaypoints, // ルールで制御可能
        // optimizeWaypoints: false → 通常料金（$5.00/1,000リクエスト）
        // optimizeWaypoints: true → Directions Advanced SKU（$10.00/1,000リクエスト）
      }, (result, status) => {
        if (status === "OK" && result) {
          directionsRenderer.setDirections(result);
          routePolyline.current = directionsRenderer;
          const legs = result.routes?.[0]?.legs ?? [];
          setRouteLegs(legs);
          
          // 既存のセグメントPolylineをクリア
          routeSegmentPolylines.current.forEach(polyline => {
            if (polyline) polyline.setMap(null);
          });
          routeSegmentPolylines.current = [];
          
          // 各legごとに個別のPolylineを作成
          const route = result.routes?.[0];
          if (route && route.overview_path) {
            // 全体のパスから各legの範囲を取得
            let currentPathIndex = 0;
            legs.forEach((leg, legIndex) => {
              // legの開始・終了座標からPolylineを作成
              const startPoint = leg.start_location;
              const endPoint = leg.end_location;
              
              // legのstepsから詳細なパスを取得
              const path: google.maps.LatLng[] = [];
              leg.steps.forEach(step => {
                if (step.path) {
                  step.path.forEach(point => {
                    path.push(point);
                  });
                }
              });
              
              if (path.length > 0) {
                const polyline = new google.maps.Polyline({
                  path: path,
                  strokeColor: "#007BFF",
                  strokeWeight: 3,
                  strokeOpacity: 0.6,
                  map: map,
                });
                routeSegmentPolylines.current.push(polyline);
              }
            });
            console.log(`✅ ${routeSegmentPolylines.current.length}個のセグメントPolylineを作成`);
          }
          
          console.log("✅ ルート描画成功（複数地点）");
        } else {
          console.warn("⚠️ ルート描画失敗（複数地点）:", status);
          // フォールバック: 最初の地点のみでルート描画
          if (limitedPoints.length > 1) {
            console.log("🔄 フォールバック: 最初の地点のみでルート描画");
            directionsService.route({
              origin: actualKoyoOrigin,
              destination: { lat: limitedPoints[0].lat, lng: limitedPoints[0].lng },
              travelMode: travelMode as any,
            }, (fallbackResult, fallbackStatus) => {
              if (fallbackStatus === "OK" && fallbackResult) {
                directionsRenderer.setDirections(fallbackResult);
                routePolyline.current = directionsRenderer;
                const fallbackLegs = fallbackResult.routes?.[0]?.legs ?? [];
                setRouteLegs(fallbackLegs);
                
                // 既存のセグメントPolylineをクリア
                routeSegmentPolylines.current.forEach(polyline => {
                  if (polyline) polyline.setMap(null);
                });
                routeSegmentPolylines.current = [];
                
                // フォールバックでもPolylineを作成
                if (fallbackLegs.length > 0) {
                  const leg = fallbackLegs[0];
                  const path: google.maps.LatLng[] = [];
                  leg.steps.forEach(step => {
                    if (step.path) {
                      step.path.forEach(point => {
                        path.push(point);
                      });
                    }
                  });
                  
                  if (path.length > 0) {
                    const polyline = new google.maps.Polyline({
                      path: path,
                      strokeColor: "#007BFF",
                      strokeWeight: 3,
                      strokeOpacity: 0.6,
                      map: map,
                    });
                    routeSegmentPolylines.current.push(polyline);
                  }
                }
                
                console.log("✅ フォールバックルート描画成功");
              } else {
                console.warn("⚠️ フォールバックルート描画失敗:", fallbackStatus);
              }
            });
          }
        }
      });
    }
  };

  // ホバー/クリック時のハイライト処理
  useEffect(() => {
    // 点滅アニメーションをクリア
    if (blinkIntervalRef.current) {
      clearInterval(blinkIntervalRef.current);
      blinkIntervalRef.current = null;
    }

    routeSegmentPolylines.current.forEach((polyline, index) => {
      if (!polyline) return;
      
      const isHovered = hoveredSegmentIndex === index;
      const isSelected = selectedSegmentIndex === index;
      
      if (isSelected) {
        // 選択時: 点滅アニメーション（最初は明るく表示）
        polyline.setOptions({
          strokeColor: "#FF0000",
          strokeWeight: 6,
          strokeOpacity: 1.0,
        });
      } else if (isHovered) {
        // ホバー時: オレンジ、太く
        polyline.setOptions({
          strokeColor: "#FF6B35",
          strokeWeight: 5,
          strokeOpacity: 1.0,
        });
      } else {
        // 通常時: 青、通常の太さ
        polyline.setOptions({
          strokeColor: "#007BFF",
          strokeWeight: 3,
          strokeOpacity: 0.6,
        });
      }
    });

    // 選択されたセグメントがあれば点滅アニメーションを開始
    if (selectedSegmentIndex !== null && routeSegmentPolylines.current[selectedSegmentIndex]) {
      const selectedPolyline = routeSegmentPolylines.current[selectedSegmentIndex];
      let currentOpacity = 1.0;
      blinkIntervalRef.current = setInterval(() => {
        currentOpacity = currentOpacity === 1.0 ? 0.5 : 1.0;
        if (selectedPolyline) {
          selectedPolyline.setOptions({
            strokeOpacity: currentOpacity,
          });
        }
      }, 500);
    }

    return () => {
      if (blinkIntervalRef.current) {
        clearInterval(blinkIntervalRef.current);
        blinkIntervalRef.current = null;
      }
    };
  }, [hoveredSegmentIndex, selectedSegmentIndex]);

  // セグメント選択のトグル
  const handleSegmentClick = (index: number) => {
    setSelectedSegmentIndex(selectedSegmentIndex === index ? null : index);
  };

  // AI生成ルートのホバー時にルートを描画
  useEffect(() => {
    if (!map || !isMapReady || hoveredAiSegmentIndex === null) {
      // ホバー解除時は既存のPolylineをクリア
      aiRouteSegmentPolylines.current.forEach(polyline => {
        if (polyline) polyline.setMap(null);
      });
      aiRouteSegmentPolylines.current = [];
      return;
    }

    const segment = aiRouteSegments[hoveredAiSegmentIndex];
    if (!segment) {
      console.log("⚠️ セグメントが見つかりません:", hoveredAiSegmentIndex);
      return;
    }

    console.log("🖱️ ホバー検出:", segment.from, "→", segment.to);

    // 地点名から座標を取得
    const fromCoords = locationCoordinatesMap.current.get(segment.from);
    const toCoords = locationCoordinatesMap.current.get(segment.to);
    console.log("📍 座標取得:", { from: fromCoords, to: toCoords });

    // 座標が取得できない場合はPlaces APIで検索
    const fetchRoute = async () => {
      let fromPos = fromCoords;
      let toPos = toCoords;

      // fromの座標が取得できない場合
      if (!fromPos) {
        if (segment.from === "古窯旅館") {
          fromPos = koyoCoordinates || DEFAULT_ORIGIN;
        } else {
          try {
            const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": String(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
                "X-Goog-FieldMask": "places.location",
              },
              body: JSON.stringify({
                textQuery: `${segment.from} 山形県`,
                languageCode: "ja",
                regionCode: "JP",
              }),
            });
            const searchData = await searchRes.json();
            const place = searchData.places?.[0];
            if (place?.location) {
              fromPos = { lat: place.location.latitude, lng: place.location.longitude };
              locationCoordinatesMap.current.set(segment.from, fromPos);
            }
          } catch (error) {
            console.error(`❌ 地点検索エラー (${segment.from}):`, error);
          }
        }
      }

      // toの座標が取得できない場合
      if (!toPos) {
        if (segment.to === "古窯旅館") {
          toPos = koyoCoordinates || DEFAULT_ORIGIN;
        } else {
          try {
            const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": String(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
                "X-Goog-FieldMask": "places.location",
              },
              body: JSON.stringify({
                textQuery: `${segment.to} 山形県`,
                languageCode: "ja",
                regionCode: "JP",
              }),
            });
            const searchData = await searchRes.json();
            const place = searchData.places?.[0];
            if (place?.location) {
              toPos = { lat: place.location.latitude, lng: place.location.longitude };
              locationCoordinatesMap.current.set(segment.to, toPos);
            }
          } catch (error) {
            console.error(`❌ 地点検索エラー (${segment.to}):`, error);
          }
        }
      }

      // 両方の座標が取得できた場合のみルートを描画
      if (fromPos && toPos) {
        console.log("✅ 座標取得完了、ルートを取得します:", { from: fromPos, to: toPos });
        const directionsService = new google.maps.DirectionsService();
        directionsService.route({
          origin: fromPos,
          destination: toPos,
          travelMode: travelMode as any,
        }, (result, status) => {
          console.log("🗺️ Directions API結果:", status);
          if (status === "OK" && result) {
            // 既存のPolylineをクリア
            aiRouteSegmentPolylines.current.forEach(polyline => {
              if (polyline) polyline.setMap(null);
            });
            aiRouteSegmentPolylines.current = [];

            // ルートの各legをPolylineとして描画
            const route = result.routes[0];
            if (route && route.legs && route.legs.length > 0) {
              // 各legのステップからpathを構築
              const path: google.maps.LatLng[] = [];
              route.legs.forEach(leg => {
                if (leg.steps) {
                  leg.steps.forEach(step => {
                    if (step.path) {
                      step.path.forEach(point => {
                        path.push(point);
                      });
                    }
                  });
                }
              });
              
              if (path.length > 0) {
                console.log("✅ ルートを描画します:", path.length, "地点");
                const polyline = new google.maps.Polyline({
                  path: path,
                  map: map,
                  strokeColor: "#FF6B35",
                  strokeWeight: 5,
                  strokeOpacity: 1.0,
                });
                aiRouteSegmentPolylines.current.push(polyline);
                console.log("✅ オレンジ色のルートを描画しました");
              } else {
                console.warn("⚠️ pathが空です");
              }
            } else {
              console.warn("⚠️ ルートが見つかりません");
            }
          } else {
            // ZERO_RESULTSはルートが見つからない場合の正常なレスポンス
            if (status === "ZERO_RESULTS") {
              console.warn("⚠️ ルートが見つかりませんでした (ZERO_RESULTS)");
            } else {
              console.error("❌ Directions APIエラー:", status);
            }
          }
        });
      } else {
        console.warn("⚠️ 座標が取得できませんでした:", { fromPos, toPos });
      }
    };

    fetchRoute();
  }, [hoveredAiSegmentIndex, map, isMapReady, aiRouteSegments, travelMode, koyoCoordinates]);

  const toggleCategory = (cat: string) => {
    const set = new Set(selectedCategories || []);
    if (set.has(cat)) set.delete(cat); else set.add(cat);
    setSelectedCategories(Array.from(set));
  };

  const chip = (label: string) => (
    <button
      key={label}
      onClick={() => toggleCategory(label)}
      style={{
        padding: "6px 10px",
        borderRadius: 9999,
        border: "1px solid #e5e7eb",
        background: selectedCategories?.includes(label) ? "#111827" : "#ffffff",
        color: selectedCategories?.includes(label) ? "#ffffff" : "#111827",
        fontSize: 12,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      <div ref={mapRef} style={{ width: "100%", height: "100vh" }} />
      {/* カテゴリチップ（左上） */}
      <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 8, zIndex: 2 }}>
        {chip("歴史")}
        {chip("自然")}
        {chip("遊ぶ")}
        {chip("食べる")}
      </div>
      {/* 交通手段セレクタ（右上） */}
      <div style={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 8, zIndex: 2 }}>
        {([
          { label: '車', mode: 'DRIVING' },
          { label: '徒歩', mode: 'WALKING' },
          { label: '公共交通', mode: 'TRANSIT' },
        ] as {label: string; mode: 'DRIVING'|'WALKING'|'TRANSIT'}[]).map((opt) => (
          <button
            key={opt.label}
            onClick={() => setTravelMode(opt.mode)}
            style={{
              padding: '6px 10px',
              borderRadius: 9999,
              border: '1px solid #e5e7eb',
              background: travelMode === opt.mode ? '#111827' : '#ffffff',
              color: travelMode === opt.mode ? '#ffffff' : '#111827',
              fontSize: 12,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {/* ルートを表示するボタン（AIプランが生成されているが、まだルートが表示されていないとき） */}
      {(() => {
        // スタッフおすすめモードでも、ルートセグメントが存在する場合はボタンを表示
        const shouldShowButton = aiRouteSegments.length > 0 && !shouldShowAiRoute;
        if (aiRouteSegments.length > 0) {
          console.log("🔍 ボタン表示条件チェック:", {
            showStaffRecommendations,
            aiRouteSegmentsLength: aiRouteSegments.length,
            shouldShowAiRoute,
            shouldShowButton
          });
        }
        return shouldShowButton;
      })() && (
        <button
          onClick={() => {
            console.log("🔘 ルートを表示するボタンがクリックされました");
            setShouldShowAiRoute(true);
          }}
          style={{
            position: 'absolute',
            top: 60,
            right: 12,
            padding: '10px 20px',
            borderRadius: 8,
            border: '1px solid #007BFF',
            background: '#007BFF',
            color: '#ffffff',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,123,255,0.3)',
            whiteSpace: 'nowrap',
            zIndex: 10,
          }}
        >
          ルートを表示する
        </button>
      )}
      {/* レッグ要約（下部） - AI生成ルートまたはGoogle Directions APIルート */}
      {/* スタッフおすすめモードでAIがルートを生成していない場合は表示しない */}
      {((aiRouteSegments.length > 0 && (planMessage || !showStaffRecommendations)) || (routeLegs && routeLegs.length > 0)) && (
        <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '8px 12px', fontSize: 12, color: '#111827', zIndex: 2 }}>
          {aiRouteSegments.length > 0 ? (
            // AI生成ルート表（ホバー対応）
            aiRouteSegments.map((segment, i) => {
              const isHovered = hoveredAiSegmentIndex === i;
              return (
                <div
                  key={i}
                  onMouseEnter={() => {
                    console.log("🖱️ マウスホバー開始:", i, segment);
                    setHoveredAiSegmentIndex(i);
                  }}
                  onMouseLeave={() => {
                    console.log("🖱️ マウスホバー終了:", i);
                    setHoveredAiSegmentIndex(null);
                  }}
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    padding: '4px 8px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    backgroundColor: isHovered ? '#F0F9FF' : 'transparent',
                    border: '1px solid transparent',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span style={{ fontWeight: 700, color: isHovered ? '#007BFF' : '#111827' }}>
                    {i + 1}.
                  </span>
                  <span style={{ color: isHovered ? '#007BFF' : '#111827' }}>
                    {segment.from} → {segment.to}
                  </span>
                  {segment.distance && segment.duration && (
                    <span style={{ color: '#6b7280' }}>{segment.distance} / {segment.duration}</span>
                  )}
                </div>
              );
            })
          ) : (
            // Google Directions APIルート表（ハイライト対応）
            routeLegs.map((leg, i) => {
              const isHovered = hoveredSegmentIndex === i;
              const isSelected = selectedSegmentIndex === i;
              return (
                <div
                  key={i}
                  onMouseEnter={() => setHoveredSegmentIndex(i)}
                  onMouseLeave={() => setHoveredSegmentIndex(null)}
                  onClick={() => handleSegmentClick(i)}
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    padding: '4px 8px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    backgroundColor: isSelected ? '#FFF4E6' : isHovered ? '#F0F9FF' : 'transparent',
                    border: isSelected ? '1px solid #FF6B35' : '1px solid transparent',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span style={{ fontWeight: 700, color: isSelected ? '#FF6B35' : isHovered ? '#007BFF' : '#111827' }}>
                    {i + 1}.
                  </span>
                  <span style={{ color: isSelected ? '#FF6B35' : isHovered ? '#007BFF' : '#111827' }}>
                    {routePointNames[i] ?? ''} → {routePointNames[i + 1] ?? ''}
                  </span>
                  <span style={{ color: '#6b7280' }}>{leg.distance?.text} / {leg.duration?.text}</span>
                </div>
              );
            })
          )}
        </div>
      )}
      {selectedPlaceId && (
        <CustomInfoPanel 
          placeId={selectedPlaceId} 
          onClose={() => setSelectedPlaceId(null)} 
        />
      )}
    </div>
  );
}
