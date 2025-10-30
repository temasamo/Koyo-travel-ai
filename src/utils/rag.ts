/**
 * RAG（Retrieval-Augmented Generation）タグ付与のユーティリティ
 */

/**
 * 観光スポット名の一覧からRAGタグを取得
 * @param placeNames 観光スポット名の配列
 * @returns RAGタグの配列
 */
export async function getRAGTagsForPlaces(placeNames: string[]): Promise<string[]> {
  // TODO: 実際のRAGシステムとの連携実装
  // 現在はモックデータを返す
  const mockTags: { [key: string]: string } = {
    "上山城": "歴史好きにおすすめ！天守閣からの眺めが絶景です",
    "リナワールド": "家族連れに人気！アトラクションが充実",
    "蔵王温泉": "疲れた体を癒す名湯。露天風呂が自慢",
    "くぐり滝": "自然の美しさを満喫。写真撮影スポット",
  };
  
  return placeNames.map(name => mockTags[name] || "おすすめ観光スポット");
}
