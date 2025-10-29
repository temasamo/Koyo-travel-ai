/**
 * ユーザーの自然文入力から時間を抽出するユーティリティ
 * 例：「明日の午前」「夕方出発」「15時から」などから出発時刻を抽出
 */

export function extractTimeFromText(userInput: string): string | null {
  if (!userInput) return null;

  // 「15時」「3時」など数値時刻を抽出
  const hourMatch = userInput.match(/([0-9]{1,2})時/);
  if (hourMatch) {
    const hour = parseInt(hourMatch[1]);
    const now = new Date();
    now.setHours(hour, 0, 0, 0);
    return now.toISOString();
  }

  // 午前・午後・夜などの曖昧表現
  if (userInput.includes("午前")) {
    const morning = new Date();
    morning.setHours(9, 0, 0, 0);
    return morning.toISOString();
  }
  if (userInput.includes("午後")) {
    const afternoon = new Date();
    afternoon.setHours(15, 0, 0, 0);
    return afternoon.toISOString();
  }
  if (userInput.includes("夜") || userInput.includes("夕方")) {
    const evening = new Date();
    evening.setHours(19, 0, 0, 0);
    return evening.toISOString();
  }
  if (userInput.includes("朝")) {
    const morning = new Date();
    morning.setHours(8, 0, 0, 0);
    return morning.toISOString();
  }

  // 明日・明後日などの表現（未来時刻生成）
  if (userInput.includes("明日")) {
    const tomorrow = new Date(Date.now() + 86400000);
    tomorrow.setHours(10, 0, 0, 0);
    return tomorrow.toISOString();
  }
  if (userInput.includes("明後日")) {
    const dayAfterTomorrow = new Date(Date.now() + 172800000);
    dayAfterTomorrow.setHours(10, 0, 0, 0);
    return dayAfterTomorrow.toISOString();
  }

  // 指定がない場合はnullを返し、AIやAPI側で補完
  return null;
}

// Phase 5.2: ユーザーの時間意図を解析してモード判定
import type { PlanMode } from "@/types/plan";

export function analyzeUserTimeIntent(userInput: string): {
  inferredTime: string | null;
  mode: PlanMode;
} {
  if (!userInput) return { inferredTime: null, mode: "ask" };

  const lower = userInput; // 日本語なのでlower不要だが将来拡張用
  const now = new Date();

  // 即時行動モード
  if (lower.includes("これから") || lower.includes("今から")) {
    return { inferredTime: now.toISOString(), mode: "instant" };
  }

  // 「今日」→午後15時想定
  if (lower.includes("今日")) {
    const today = new Date();
    today.setHours(15, 0, 0, 0);
    return { inferredTime: today.toISOString(), mode: "normal" };
  }

  // 明日
  if (lower.includes("明日")) {
    const tomorrow = new Date(Date.now() + 86400000);
    tomorrow.setHours(10, 0, 0, 0);
    return { inferredTime: tomorrow.toISOString(), mode: "normal" };
  }

  // 午前／午後／夜
  if (lower.includes("午前"))
    return { inferredTime: new Date(new Date().setHours(9, 0, 0, 0)).toISOString(), mode: "normal" };
  if (lower.includes("午後"))
    return { inferredTime: new Date(new Date().setHours(15, 0, 0, 0)).toISOString(), mode: "normal" };
  if (lower.includes("夜"))
    return { inferredTime: new Date(new Date().setHours(19, 0, 0, 0)).toISOString(), mode: "normal" };

  // 曖昧すぎる場合 → AI確認モード
  return { inferredTime: null, mode: "ask" };
}
