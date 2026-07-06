"use client"

import { useState } from "react"
import { useTheme } from "next-themes"
import { Loader2, Sparkles, AlertCircle, CheckCircle2, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"

type SectionResult = {
  score: number
  feedback: string
  suggestions: string[]
}

type AnalysisResult = {
  overallScore: number
  headline: SectionResult
  content: SectionResult
}

type Step = "input" | "loading" | "manual" | "result"

function scoreColor(score: number) {
  if (score >= 75) return "text-emerald-600"
  if (score >= 50) return "text-amber-600"
  return "text-red-600"
}

function ScoreSection({ title, data }: { title: string; data: SectionResult }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <span className={`text-2xl font-bold ${scoreColor(data.score)}`}>
          {data.score}
          <span className="text-sm font-normal text-muted-foreground">/۱۰۰</span>
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={data.score} className="h-1.5" />
        <p className="text-sm leading-7 text-foreground/90">{data.feedback}</p>
        {data.suggestions?.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground">پیشنهادها</p>
            <ul className="space-y-2">
              {data.suggestions.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm leading-7">
                  <CheckCircle2 className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function Page() {
  const { resolvedTheme, setTheme } = useTheme()
  const [step, setStep] = useState<Step>("input")
  const [url, setUrl] = useState("")
  const [manualText, setManualText] = useState("")
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runAnalysis(profileText: string) {
    setStep("loading")
    setError(null)
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileText }),
      })
      const data = await res.json()

      if (res.status === 429) {
        setError("امروز به سقف ۵ تحلیل رایگان رسیدید. فردا دوباره امتحان کنید.")
        setStep("input")
        return
      }
      if (!res.ok || data.error) {
        setError("مشکلی در تحلیل پروفایل پیش آمد. لطفاً دوباره تلاش کنید.")
        setStep(manualText ? "manual" : "input")
        return
      }

      setResult(data.result)
      setStep("result")
    } catch {
      setError("ارتباط با سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید.")
      setStep(manualText ? "manual" : "input")
    }
  }

  async function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return

    setStep("loading")
    setError(null)

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()

      if (!res.ok || data.reason === "invalid_url") {
        setError("لینک وارد شده معتبر نیست. لطفاً یک لینک پروفایل لینکدین صحیح وارد کنید.")
        setStep("input")
        return
      }

      if (data.success) {
        const profileText = `${data.data.title}\n\n${data.data.summary}`
        await runAnalysis(profileText)
      } else {
        setStep("manual")
      }
    } catch {
      setStep("manual")
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!manualText.trim()) return
    await runAnalysis(manualText.trim())
  }

  function reset() {
    setStep("input")
    setUrl("")
    setManualText("")
    setResult(null)
    setError(null)
  }

  return (
    <div className="relative mx-auto flex min-h-svh max-w-2xl flex-col items-center px-6 py-16">
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-4 top-4"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        aria-label="تغییر حالت روشن/تاریک"
      >
        {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>

      <div className="mb-10 flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground">
          <Sparkles className="h-6 w-6 text-background" />
        </div>
        <h1 className="text-3xl font-bold">بهینه‌ساز پروفایل لینکدین</h1>
        <p className="max-w-md text-sm leading-7 text-muted-foreground">
          لینک پروفایل لینکدین خود را وارد کنید تا هوش مصنوعی، عنوان و محتوای پروفایل شما را
          بررسی کرده و امتیاز و پیشنهاد بهبود ارائه دهد.
        </p>
      </div>

      {step === "input" && (
        <form onSubmit={handleUrlSubmit} className="w-full space-y-3">
          <Input
            type="url"
            dir="ltr"
            placeholder="https://www.linkedin.com/in/your-name"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="h-12 text-center text-sm"
            required
          />
          <Button type="submit" className="h-12 w-full text-base">
            تحلیل پروفایل
          </Button>
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </form>
      )}

      {step === "loading" && (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">در حال بررسی پروفایل...</p>
        </div>
      )}

      {step === "manual" && (
        <form onSubmit={handleManualSubmit} className="w-full space-y-3">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>لینکدین اجازه دریافت خودکار اطلاعات را نداد</AlertTitle>
            <AlertDescription>
              لطفاً محتوای پروفایل خود (عنوان، درباره، تجربه، تحصیلات و مهارت‌ها) را از صفحه
              لینکدین کپی و در کادر زیر جای‌گذاری کنید.
            </AlertDescription>
          </Alert>
          <Textarea
            placeholder="محتوای پروفایل خود را اینجا جای‌گذاری کنید..."
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            className="min-h-48 text-sm"
            required
          />
          <Button type="submit" className="h-12 w-full text-base">
            تحلیل پروفایل
          </Button>
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </form>
      )}

      {step === "result" && result && (
        <div className="w-full space-y-5">
          <Card className="border-2">
            <CardContent className="flex flex-col items-center gap-2 py-6">
              <p className="text-sm text-muted-foreground">امتیاز کلی پروفایل</p>
              <span className={`text-5xl font-bold ${scoreColor(result.overallScore)}`}>
                {result.overallScore}
              </span>
              <Progress value={result.overallScore} className="h-1.5 w-40" />
            </CardContent>
          </Card>

          <ScoreSection title="عنوان (هدلاین)" data={result.headline} />
          <ScoreSection title="محتوای پروفایل" data={result.content} />

          <Button variant="outline" className="h-11 w-full" onClick={reset}>
            تحلیل پروفایل دیگر
          </Button>
        </div>
      )}
    </div>
  )
}
