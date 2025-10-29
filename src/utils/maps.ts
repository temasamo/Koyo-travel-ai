/**
 * Google Maps APIを使用した観光スポット取得と距離計算のユーティリティ
 */

/**
 * 指定された場所の周辺で観光スポットを検索
 * @param origin 出発地の座標と名前
 * @param radiusKm 検索半径（km）
 * @returns 観光スポットの一覧
 */
export async function getNearbyPlaces(origin: any, radiusKm: number): Promise<any[]> {
  // TODO: Google Places APIの実装
  // 現在はモックデータを返す
  const mockPlaces = [
    { name: "上山城", lat: 38.1435, lng: 140.2734, rating: 4.2 },
    { name: "リナワールド", lat: 38.1500, lng: 140.2800, rating: 4.5 },
    { name: "蔵王温泉", lat: 38.2000, lng: 140.3000, rating: 4.3 },
    { name: "くぐり滝", lat: 38.1200, lng: 140.2500, rating: 4.1 },
  ];
  
  return mockPlaces.filter(place => {
    const distance = calculateDistance(origin.lat, origin.lng, place.lat, place.lng);
    return distance <= radiusKm;
  });
}

/**
 * 観光スポットに距離情報を付与
 * @param origin 出発地の座標
 * @param places 観光スポットの一覧
 * @returns 距離情報付きの観光スポット一覧
 */
export async function enrichWithDistance(origin: any, places: any[]): Promise<any[]> {
  return places.map(place => ({
    ...place,
    distance: calculateDistance(origin.lat, origin.lng, place.lat, place.lng)
  }));
}

/**
 * 2点間の距離を計算（ハヴァサイン公式）
 * @param lat1 地点1の緯度
 * @param lng1 地点1の経度
 * @param lat2 地点2の緯度
 * @param lng2 地点2の経度
 * @returns 距離（km）
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // 地球の半径（km）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
