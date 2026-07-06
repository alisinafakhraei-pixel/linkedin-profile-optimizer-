import { NextRequest, NextResponse } from "next/server"

const LINKEDIN_URL_PATTERN = /^https?:\/\/(www\.)?linkedin\.com\/in\/[^/?#]+\/?$/i

function extractMeta(html: string, property: string): string | null {
  const regex = new RegExp(
    `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`,
    "i"
  )
  const match = html.match(regex)
  return match ? match[1].trim() : null
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title>([^<]*)<\/title>/i)
  return match ? match[1].replace(/\s*\|\s*LinkedIn\s*$/i, "").trim() : null
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const url = typeof body?.url === "string" ? body.url.trim() : ""

  if (!LINKEDIN_URL_PATTERN.test(url)) {
    return NextResponse.json(
      { success: false, reason: "invalid_url" },
      { status: 400 }
    )
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      return NextResponse.json({ success: false, reason: "blocked" })
    }

    const finalUrl = response.url
    if (/\/authwall|\/login|\/checkpoint/i.test(finalUrl)) {
      return NextResponse.json({ success: false, reason: "authwall" })
    }

    const html = await response.text()
    const description = extractMeta(html, "og:description")
    const title = extractTitle(html)

    if (!description || description.length < 30) {
      return NextResponse.json({ success: false, reason: "no_data" })
    }

    return NextResponse.json({
      success: true,
      data: {
        title: title ?? "",
        summary: description,
      },
    })
  } catch {
    return NextResponse.json({ success: false, reason: "fetch_error" })
  }
}
