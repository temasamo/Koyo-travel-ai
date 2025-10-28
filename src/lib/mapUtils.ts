// マップ関連の共通ユーティリティ関数

export interface AIPin {
  name: string;
  type: string;
}

// マップ上にピンを表示する共通関数
export const showPinsOnMap = (
  map: google.maps.Map,
  pins: AIPin[],
  iconUrl: string = "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
) => {
  if (!map || !pins?.length) return;

  const service = new google.maps.places.PlacesService(map);
  const bounds = new google.maps.LatLngBounds();

  pins.forEach((pin) => {
    const request = {
      query: pin.name,
      fields: ["name", "geometry", "place_id", "formatted_address", "rating", "photos"],
    };

    service.findPlaceFromQuery(request, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results?.[0]) {
        const place = results[0];
        
        if (place.geometry?.location) {
          const marker = new google.maps.Marker({
            map: map,
            position: place.geometry.location,
            title: place.name,
            icon: {
              url: iconUrl,
              scaledSize: new google.maps.Size(32, 32),
            },
            zIndex: 50,
          });

          bounds.extend(place.geometry.location);
          console.log("✅ ピン表示成功:", place.name);
        }
      } else {
        console.warn("❌ ピン検索失敗:", pin.name, status);
      }
    });
  });

  // マップをピンに合わせてズーム
  setTimeout(() => {
    if (bounds.isEmpty()) return;
    map.fitBounds(bounds);
    const currentZoom = map.getZoom();
    if (currentZoom && currentZoom > 15) {
      map.setZoom(15);
    }
  }, 1000);
};

// AIレスポンスからJSONを検出・解析する関数
export const extractPinsFromResponse = (response: string): AIPin[] => {
  try {
    // JSONブロックを検出（```json または ``` で囲まれた部分）
    const jsonBlockMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonBlockMatch) {
      const jsonString = jsonBlockMatch[1];
      const parsed = JSON.parse(jsonString);
      if (parsed?.pins && Array.isArray(parsed.pins)) {
        return parsed.pins;
      }
    }
    
    // インラインJSONを検出
    const jsonMatch = response.match(/\{[\s\S]*?"pins"[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed?.pins && Array.isArray(parsed.pins)) {
        return parsed.pins;
      }
    }
  } catch (error) {
    console.warn("JSON解析失敗:", error);
  }
  return [];
};
