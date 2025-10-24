import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const { messages } = await req.json();

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "あなたは旅行AIプランナーです。出発地・目的地・宿泊日数などをもとに、ユーザーに最適な旅行プランを会話形式で提案してください。",
      },
      ...messages,
    ],
    temperature: 0.7,
  });

  const reply = completion.choices[0].message.content;
  return NextResponse.json({ reply });
}
