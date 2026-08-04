import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import "./globals.css"
import { Encabezado, PieDePagina } from "@/app/_ui/chrome"
import { ThemeProvider } from "@/components/theme-provider"
import { VIGENCIA_ACTUAL } from "@/lib/data"
import { SITIO_URL } from "@/lib/site"
import { cn } from "@/lib/utils"

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

/**
 * Metadatos raíz. El `template` deja que cada ruta ponga solo su propio título
 * ("Ítems", "Provincia X…") y el sitio añade la marca; la portada usa
 * `title.absolute` para no repetirse.
 *
 * `metadataBase` hace absolutas las URLs relativas (canónicas, Open Graph):
 * ver `lib/site.ts` para el dominio.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITIO_URL),
  title: {
    default: `Explorador APU — precios de referencia INVIAS ${VIGENCIA_ACTUAL}`,
    template: "%s · Explorador APU",
  },
  description:
    "Análisis de Precios Unitarios (APU) de referencia de INVIAS, " +
    `regionalizados en 140 provincias, vigencia ${VIGENCIA_ACTUAL}. ` +
    "Costo directo, sin AIU, con procedencia en cada número.",
  applicationName: "Explorador APU",
  openGraph: {
    type: "website",
    locale: "es_CO",
    siteName: "Explorador APU",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        "font-sans",
        fontSans.variable,
        fontMono.variable
      )}
    >
      <body>
        <ThemeProvider>
          <div className="flex min-h-svh flex-col">
            <Encabezado />
            <div className="flex-1">{children}</div>
            <PieDePagina />
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
