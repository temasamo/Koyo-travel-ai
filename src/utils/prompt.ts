import OpenAI from "openai";
import { formatTime } from "./time";
import type { PlanMode } from "@/types/plan";

/**
 * 旅行プランのプロンプトを構築
 * @param origin 出発地情報
 * @param inferredTime 推定された出発時間
 * @param enrichedPlaces 距離情報付きの観光スポット一覧
 * @param userInput ユーザーの入力テキスト
 * @returns AI用のプロンプト文字列
 */
export function buildTravelPlanPrompt(
  origin: any,
  inferredTime: string,
  enrichedPlaces: any[],
  userInput: string,
  mode: PlanMode
): string {
  const basePrompt = `
あなたは「${origin.name}」専属の旅プランナーAIです。
ユーザー入力: 「${userInput || "時間未指定"}」
現在時刻: ${formatTime(new Date(inferredTime))}

${JSON.stringify(enrichedPlaces, null, 2)}
`;

  if (mode === "ask") {
    return `
${basePrompt}
ユーザーの入力から出発時刻が特定できません。
「午前」「午後」「夜」「今から」などを尋ねて、希望時間帯を確認してください。
まだプランを提案しないでください。
`;
  }

  if (mode === "instant") {
    return `
${basePrompt}
ユーザーは「今から」または「これから」と入力しています。
${origin.name}から徒歩圏（3km以内）で、約2〜3時間で楽しめる短時間プランを3件提案してください。
飲食・温泉・軽い観光などを中心にしてください。
`;
  }

  return `
${basePrompt}
通常の観光プランを提案してください。午前なら遠出、午後なら近場中心にしてください。
`;
}

/**
 * OpenAI APIを使用してAIサマリーを取得
 * @param prompt AI用のプロンプト
 * @returns AIが生成したサマリーテキスト
 */
export async function getAISummary(prompt: string): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `あなたは観光プランナーAIです。出発時間が不明な場合は午後を仮定し、またはユーザーに「何時頃のプランをご希望ですか？」と丁寧に尋ねてください。`,
        },
        { role: "user", content: prompt },
      ],
    });
    return response.choices[0].message.content ?? "";
  } catch (error) {
    console.error("AI API Error:", error);
    return "申し訳ございませんが、AIからの提案を取得できませんでした。";
  }
}
