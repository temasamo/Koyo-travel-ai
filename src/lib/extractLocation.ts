// シンプルな正規表現ベースの地名抽出例（将来的にOpenAI APIに置き換え可能）
export default function extractLocation(input: string): string | null {
  const regex = /(東京|新宿|上野|山形|仙台|京都|大阪|札幌|名古屋|富士|上山|河口湖|山中湖|本栖湖|精進湖|西湖)/;
  const match = input.match(regex);
  return match ? match[0] : null;
}
