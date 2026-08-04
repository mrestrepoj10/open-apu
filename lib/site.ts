/**
 * Identidad del sitio publicado: la URL absoluta y el tamaño de los sitemaps.
 *
 * Vive aparte de `lib/data/` porque no describe el dato sino dónde se publica.
 * No importa `node:*` (solo `process.env`, que Next inlinea en build para las
 * variables `NEXT_PUBLIC_*`), así que puede importarse desde cualquier parte.
 */

/**
 * URL absoluta del sitio, sin barra final. La usan `metadataBase`, el sitemap
 * y el robots.txt, que exigen URLs absolutas.
 *
 * TODO: fijar el dominio definitivo (p. ej. `https://apu.frame.co`) y quitar el
 * valor por defecto de Vercel. Mientras tanto se puede sobreescribir con
 * `NEXT_PUBLIC_SITE_URL` en el entorno de despliegue.
 */
export const SITIO_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://apu-stack.vercel.app"
).replace(/\/+$/, "")

/**
 * URLs por archivo de sitemap.
 *
 * El protocolo permite 50 000 URLs (o 50 MB) por archivo; se corta en 40 000
 * para dejar margen y para que cada archivo pese ~3 MB en vez de rozar el
 * límite. El sitio publica ~74 000 URLs (526 ítems × 140 provincias + índices),
 * así que hacen falta varios archivos: ver `app/sitemap.ts`.
 */
export const URLS_POR_SITEMAP = 40_000

/** Cuántos archivos de sitemap hacen falta para `total` URLs (mínimo 1). */
export function numeroDeSitemaps(total: number): number {
  return Math.max(1, Math.ceil(total / URLS_POR_SITEMAP))
}

/**
 * URL pública de un archivo de sitemap generado con `generateSitemaps`.
 * Next los sirve en `/sitemap/{id}.xml` (ver `generate-sitemaps.md`).
 */
export function urlDeSitemap(id: number): string {
  return `${SITIO_URL}/sitemap/${id}.xml`
}
