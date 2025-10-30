import OpenAI from "openai";
import { formatTime } from "./time";

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
  userInput: string
): string {
  return `
あなたは「${origin.name}」専属の旅プランナーAIです。
ユーザーの入力: 「${userInput || "時間未指定"}」

現在時刻は ${formatTime(new Date(inferredTime))} です。
ただし、ユーザーが具体的な出発時間を指定していない場合は、
「午後（15:00〜）」を仮定して提案してください。

徒歩圏内（3km以内）で午後におすすめの観光スポットを3〜5件提案し、
RAG情報（スタッフおすすめ等）がある場合は優先してください。

利用可能な観光スポット:
${JSON.stringify(enrichedPlaces, null, 2)}
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
