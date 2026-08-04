import type { MetadataRoute } from "next"

import { numeroDeSitemaps, SITIO_URL, urlDeSitemap } from "@/lib/site"
import { contarUrls } from "./_ui/mapa-del-sitio"

/**
 * robots.txt.
 *
 * Todo abierto salvo `/theme`, que es la referencia interna de diseño: sus
 * números son ficticios y no llevan procedencia, así que no debe indexarse
 * (la propia página ya declara `robots: { index: false }`).
 *
 * El sitemap está partido en varios archivos (`/sitemap/{id}.xml`), y no existe
 * un `/sitemap.xml` índice: se listan todos aquí, que es lo que el estándar
 * espera cuando no hay archivo índice.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const sitemaps = numeroDeSitemaps(await contarUrls())

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/theme",
    },
    sitemap: Array.from({ length: sitemaps }, (_, id) => urlDeSitemap(id)),
    host: SITIO_URL,
  }
}
