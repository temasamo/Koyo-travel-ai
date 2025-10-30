import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "あなたは旅行プランナーです。観光・温泉・食事などを含むプランを日本語で提案してください。",
        },
        { role: "user", content: String(prompt ?? "条件が不足しています。") },
      ],
      temperature: 0.6,
    });

    const plan = completion.choices[0]?.message?.content || "プラン生成に失敗しました。";
    return NextResponse.json({ plan });
  } catch (e) {
    console.error("/api/ai/travelplan error", e);
    return NextResponse.json({ plan: "プラン生成に失敗しました。" }, { status: 500 });
  }
}


