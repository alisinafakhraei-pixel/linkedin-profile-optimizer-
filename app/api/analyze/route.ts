import { NextRequest, NextResponse } from "next/server"
import { GoogleGenAI, Type } from "@google/genai"
import { checkRateLimit } from "@/lib/rate-limit"

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY })

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    overallScore: { type: Type.INTEGER },
    headline: {
      type: Type.OBJECT,
      properties: {
        score: { type: Type.INTEGER },
        feedback: { type: Type.STRING },
        suggestions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: ["score", "feedback", "suggestions"],
    },
    content: {
      type: Type.OBJECT,
      properties: {
        score: { type: Type.INTEGER },
        feedback: { type: Type.STRING },
        suggestions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: ["score", "feedback", "suggestions"],
    },
  },
  required: ["overallScore", "headline", "content"],
}

const SYSTEM_INSTRUCTION = `تو یک متخصص برندسازی شخصی و بهینه‌سازی پروفایل لینکدین هستی. متن پروفایل کاربر (که ممکن است ناقص یا خلاصه‌شده باشد) را تحلیل کن و خروجی را فقط به زبان فارسی و فقط در قالب JSON مطابق اسکیمای داده‌شده برگردان.

برای هر بخش (عنوان/هدلاین و محتوای پروفایل شامل درباره، تجربه، تحصیلات و مهارت‌ها):
- یک امتیاز از ۰ تا ۱۰۰ بده که واقعاً منعکس‌کننده کیفیت متن باشد، نه صرفاً امتیاز بالا برای دلگرمی.
- بازخورد صادقانه، مشخص و مبتنی بر متن واقعی کاربر بنویس؛ از کلی‌گویی بپرهیز.
- حداقل ۲ و حداکثر ۴ پیشنهاد بازنویسی یا بهبود متن، مشخص و قابل استفاده مستقیم ارائه بده.
- در متن بازخورد و پیشنهادها هرگز از نشانه‌گذاری مارک‌داون (مثل ** یا #) استفاده نکن؛ فقط متن ساده فارسی بنویس.
- هرگز عنوان شغلی، شرکت، تاریخ، مدرک تحصیلی، گواهی‌نامه یا عدد و آمار جدیدی که در متن کاربر نیامده، اختراع نکن.
- وقتی برای یک پیشنهاد به یک عدد یا آمار قابل‌سنجش نیاز است ولی در متن کاربر وجود ندارد، به‌جای ساختن عدد، از عبارت «[عدد قابل‌سنجش را اینجا اضافه کنید]» استفاده کن.

امتیاز کلی (overallScore) میانگین وزنی منطقی از این دو بخش باشد.`

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const { allowed, remaining } = checkRateLimit(ip)

  if (!allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429 }
    )
  }

  const body = await req.json().catch(() => null)
  const profileText = typeof body?.profileText === "string" ? body.profileText.trim() : ""

  if (!profileText || profileText.length < 20) {
    return NextResponse.json({ error: "insufficient_content" }, { status: 400 })
  }

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: `متن پروفایل لینکدین کاربر:\n\n${profileText}` }],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    })

    const text = result.text
    if (!text) {
      return NextResponse.json({ error: "empty_response" }, { status: 502 })
    }

    const parsed = JSON.parse(text)
    return NextResponse.json({ result: parsed, remaining })
  } catch (err) {
    console.error("Gemini analyze error:", err)
    return NextResponse.json({ error: "analysis_failed" }, { status: 502 })
  }
}
