/**
 * 時間帯に基づく距離制限と時間フォーマットのユーティリティ
 */

/**
 * 時間帯に基づいて検索範囲の距離制限を取得
 * @param date 対象の日時（未指定の場合は現在時刻）
 * @returns 距離制限（km）
 */
export function getDistanceLimitByTime(date?: Date): number {
  const target = date ?? new Date();
  const hour = target.getHours();

  if (hour >= 15 && hour <= 19) return 3; // 午後：徒歩圏
  if (hour >= 9 && hour <= 14) return 15; // 午前：車圏（Phase5.2）
  if (hour >= 19 && hour <= 23) return 2; // 夜間：徒歩圏
  return 3; // 時間情報なし → 午後想定
}

/**
 * 日時を日本語形式でフォーマット
 * @param date 対象の日時（未指定の場合は現在時刻）
 * @returns フォーマットされた時間文字列
 */
export function formatTime(date?: Date): string {
  const d = date ?? new Date();
  return `${d.getHours()}時${d.getMinutes().toString().padStart(2, '0')}分`;
}
