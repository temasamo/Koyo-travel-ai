import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const { messages, systemPrompt } = await req.json();

  const defaultSystemPrompt = `あなたは山形県上山市周辺の旅行AIプランナーです。ユーザーの希望に合わせて「1日目」「2日目」「3日目」などの日程付きで観光地を提案してください。

重要な指示：
- 各日の地名を明示的に出してください（例：「1日目：上山温泉」「2日目：蔵王温泉」「3日目：山寺」）
- 地名は具体的で検索可能な形で記載してください
- 山形県内の観光地を中心に提案してください
- 出発地は「古窯旅館」を想定してください

ピン表示機能：
- ユーザーが「ケーキ屋さんを探して」「カフェを教えて」など具体的な施設検索を求めた場合のみ
- 以下のJSON形式で回答してください：
{
  "response": "おすすめのケーキ屋さんを2件見つけました！",
  "pins": [
    { "name": "パティスリーカフェドゥ上山", "type": "ai" },
    { "name": "スイーツ工房なかやま", "type": "ai" }
  ]
}

- 通常の旅行プラン相談の場合は、従来通りテキストで回答してください

例：
「1日目は上山温泉で温泉を楽しみ、2日目は蔵王温泉でスキーを楽しみ、3日目は山寺で歴史を感じる旅はいかがでしょうか？」`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: systemPrompt || defaultSystemPrompt,
      },
      ...messages,
    ],
    temperature: 0.7,
  });

  const reply = completion.choices[0].message.content;
  
  try {
    // JSON形式の回答を試行
    const parsedReply = JSON.parse(reply || "{}");
    
    // pinsが含まれている場合はそのまま返す
    if (parsedReply.pins) {
      return NextResponse.json(parsedReply);
    }
    
    // pinsが含まれていない場合は従来形式で返す
    return NextResponse.json({ reply: parsedReply.response || reply });
  } catch (error) {
    // JSON解析に失敗した場合は従来形式で返す
    return NextResponse.json({ reply });
  }
}
