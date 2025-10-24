import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const { place } = await req.json();

  const prompt = `
次の観光地について100文字以内で日本語で要約してください。
内容は、特徴・雰囲気・おすすめポイントを簡潔に伝えてください。
観光地名: ${place}
`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  const summary = completion.choices[0]?.message?.content ?? "説明を取得できませんでした。";

  return NextResponse.json({ summary });
}
