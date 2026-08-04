import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  cacheComponents: true,

  /**
   * `lib/data/` compone las rutas de los artefactos en tiempo de ejecución
   * (`data/json/2026-1/items/${codigo}.json`), así que el trazado automático de
   * archivos de Next no puede deducirlas: sin esto, las páginas que se generen
   * por ISR fuera del build no encontrarían los datos en la función de Vercel.
   *
   * Son ~34 MB (30 MB de JSON + 3,1 MB del parquet del desglose), muy por
   * debajo del límite de la función. Solo la vigencia publicada: los .xlsx
   * originales no viven en el repo (no negociable 3).
   */
  outputFileTracingIncludes: {
    "/**": [
      "./data/json/2026-1/**",
      "./data/parquet/vigencia=2026-1/apu_lineas.parquet",
    ],
  },
}

export default nextConfig
