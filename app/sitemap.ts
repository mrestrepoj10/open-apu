import type { MetadataRoute } from "next"

import { numeroDeSitemaps, URLS_POR_SITEMAP } from "@/lib/site"
import {
  absoluta,
  contarUrls,
  fechaDePublicacion,
  urlsDelSitio,
} from "./_ui/mapa-del-sitio"

/**
 * Sitemap partido en archivos de {@link URLS_POR_SITEMAP} URLs.
 *
 * El sitio publica ~74 000 URLs (526 ítems × 140 provincias más los índices),
 * por encima del límite de 50 000 del protocolo, así que se usa
 * `generateSitemaps`: Next sirve cada trozo en `/sitemap/{id}.xml` y el
 * robots.txt los referencia todos (ver `app/robots.ts`).
 *
 * Ver `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-sitemaps.md`
 * — en Next 16 el `id` llega como promesa de `string`, no como número.
 */
export async function generateSitemaps() {
  const total = await contarUrls()
  return Array.from({ length: numeroDeSitemaps(total) }, (_, id) => ({ id }))
}

export default async function sitemap({
  id,
}: {
  id: Promise<string>
}): Promise<MetadataRoute.Sitemap> {
  const indice = Number(await id)
  const [urls, lastModified] = await Promise.all([
    urlsDelSitio(),
    fechaDePublicacion(),
  ])

  const desde = indice * URLS_POR_SITEMAP

  return urls.slice(desde, desde + URLS_POR_SITEMAP).map((entrada) => ({
    url: absoluta(entrada.url),
    lastModified,
    // El dato cambia cuando INVIAS publica una vigencia nueva: dos veces al
    // año. "yearly" es la pista honesta; "daily" solo desperdiciaría rastreo.
    changeFrequency: "yearly" as const,
    priority: entrada.prioridad,
  }))
}
