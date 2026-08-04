import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  cacheComponents: true,

  /**
   * Prefetch parcial (Next 16.3): un `<Link>` precarga el App Shell de su RUTA
   * —contenido estático y cacheado que no depende de la URL— y Next reutiliza
   * ese mismo shell para todos los enlaces que apunten a la ruta.
   *
   * Es lo que hace viable poner `next/link` en tablas de cientos de filas: sin
   * esto, cada enlace precargaba su destino por separado (medido: 293
   * peticiones / 4,5 MB en una sola vista de página); con esto, una tabla de
   * 1.050 enlaces a `/items/[codigo]` y `/items/[codigo]/[provincia]` precarga
   * dos shells (medido: 14 peticiones / 85 kB).
   *
   * Requiere `cacheComponents`. La contrapartida está en las rutas: leer
   * `params` fuera de un `<Suspense>` ata el shell a una sola URL, así que las
   * tres rutas con parámetro pasan el `Promise` de `params` a un hijo dentro
   * del límite (ver `01-app/02-guides/adopting-partial-prefetching.md`).
   */
  partialPrefetching: true,

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
