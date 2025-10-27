import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const { place } = await req.json();

  const prompt = `
次の観光地について100文字以内で日本語で要約してください。
内容は、特徴・雰囲気・おすすめポイントを簡潔に伝えてください。

重要な注意事項：
- 正確な情報のみを提供してください
- 推測や不確実な情報は含めないでください
- 山形空港は東根市にあります（南陽市ではありません）

観光地名: ${place}
`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  const summary = completion.choices[0]?.message?.content ?? "説明を取得できませんでした。";

  return NextResponse.json({ summary });
}
