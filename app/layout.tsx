import { Vazirmatn } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils";

const vazirmatn = Vazirmatn({ subsets: ["arabic"], variable: "--font-sans" })

export const metadata = {
  title: "بهینه‌ساز پروفایل لینکدین",
  description: "پروفایل لینکدین خود را با هوش مصنوعی تحلیل و بهینه کنید",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="fa"
      dir="rtl"
      suppressHydrationWarning
      className={cn("antialiased", "font-sans", vazirmatn.variable)}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
