import { NextRequest, NextResponse } from "next/server"
import { GoogleGenAI, Type } from "@google/genai"

if (!process.env.GOOGLE_AI_API_KEY) {
  console.error("[analyze] GOOGLE_AI_API_KEY is not set. Requests will fail.")
}

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
  const requestId = Math.random().toString(36).slice(2, 8)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const log = (...args: unknown[]) => console.log(`[analyze:${requestId}] ip=${ip}`, ...args)
  const logError = (...args: unknown[]) => console.error(`[analyze:${requestId}] ip=${ip}`, ...args)

  const body = await req.json().catch((err) => {
    logError("failed to parse request body as JSON:", err)
    return null
  })
  const profileText = typeof body?.profileText === "string" ? body.profileText.trim() : ""

  if (!profileText || profileText.length < 20) {
    log("rejected: profileText missing or too short", { length: profileText.length })
    return NextResponse.json(
      { error: "insufficient_content", requestId },
      { status: 400 }
    )
  }

  log("starting analysis", { textLength: profileText.length })

  let rawText: string | undefined
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

    rawText = result.text

    if (!rawText) {
      logError("empty response from Gemini", {
        finishReason: result.candidates?.[0]?.finishReason,
        promptFeedback: result.promptFeedback,
      })
      return NextResponse.json(
        { error: "empty_response", requestId },
        { status: 502 }
      )
    }

    let parsed
    try {
      parsed = JSON.parse(rawText)
    } catch (parseErr) {
      logError("failed to parse Gemini output as JSON:", parseErr, {
        rawTextPreview: rawText.slice(0, 500),
      })
      return NextResponse.json(
        { error: "invalid_json_response", requestId },
        { status: 502 }
      )
    }

    log("analysis succeeded")
    return NextResponse.json({ result: parsed })
  } catch (err) {
    const status = (err as { status?: number })?.status
    const message = err instanceof Error ? err.message : String(err)
    logError("Gemini API call failed:", message, { status })

    const isKeyMissing = /API key should be set|Could not load the default credentials/i.test(
      message
    )
    const isKeyInvalid = /API_KEY_INVALID|API key not valid/i.test(message)

    if (isKeyMissing || isKeyInvalid) {
      return NextResponse.json(
        { error: "invalid_api_key", requestId, detail: message.slice(0, 300) },
        { status: 502 }
      )
    }
    if (status === 429 || /RESOURCE_EXHAUSTED/i.test(message)) {
      return NextResponse.json(
        { error: "provider_rate_limited", requestId, detail: message.slice(0, 300) },
        { status: 502 }
      )
    }

    return NextResponse.json(
      { error: "analysis_failed", requestId, detail: message.slice(0, 300) },
      { status: 502 }
    )
  }
}
