-- apus.parquet — un APU por ítem de pago × provincia (526 × 140 = 73 640 filas).
--
-- Entrada:  data/.staging/apus.ndjson   (lo escribe la etapa 1 de scripts/pipeline.ts)
-- Salida:   data/parquet/vigencia=2026-1/apus.parquet
--
-- Las rutas son RELATIVAS a la raíz del repo: el pipeline lanza el CLI de
-- DuckDB con `cwd` en la raíz. Así el .sql se puede ejecutar a mano con
--   duckdb -c ".read scripts/sql/apus.sql"
-- desde la raíz, sin variables ni sustituciones.
--
-- El esquema se declara explícitamente en vez de dejar que DuckDB lo infiera:
--   * `regionCodigo` es VARCHAR y NO INTEGER — "0509" tiene un cero a la
--     izquierda que INVIAS usa como identidad de la provincia.
--   * inferir el tipo por muestreo haría que el pipeline dejara de ser
--     determinista si cambia el orden o el contenido de las primeras filas.
--
-- Los importes ya llegan redondeados a 2 decimales desde el parser (la propia
-- hoja los calcula con ROUND(x,2); el valor cacheado trae ruido IEEE-754).

COPY (
  SELECT *
  FROM read_json(
    'data/.staging/apus.ndjson',
    format = 'newline_delimited',
    columns = {
      vigencia:          'VARCHAR',  -- "2026-1"
      archivo:           'VARCHAR',  -- libro fuente (procedencia por número)
      regionCodigo:      'VARCHAR',  -- código INVIAS de 4 dígitos, p. ej. "0509"
      regionCodigoDane:  'VARCHAR',  -- 2 primeros dígitos = departamento DANE
      departamento:      'VARCHAR',
      provincia:         'VARCHAR',
      slug:              'VARCHAR',  -- "antioquia-valle-de-aburra"
      codigo:            'VARCHAR',  -- ítem de pago normalizado: "630.1.1"
      capitulo:          'VARCHAR',  -- primer segmento del código: "630"
      capituloNumero:    'INTEGER',  -- capítulo constructivo del ÍNDICE (2…9)
      capituloNombre:    'VARCHAR',
      articulo:          'VARCHAR',
      clasificacion:     'VARCHAR',
      descripcion:       'VARCHAR',
      unidad:            'VARCHAR',  -- canónica: "m3", "kg-km"…
      unidadCruda:       'VARCHAR',  -- grafía original cuando difiere
      equipo:            'DOUBLE',   -- subtotales por componente, COP
      materiales:        'DOUBLE',
      transporte:        'DOUBLE',
      manoDeObra:        'DOUBLE',
      costoDirecto:      'DOUBLE',   -- COP, sin AIU ni IVA
      notaFuente:        'VARCHAR'   -- aclaración del propio libro INVIAS
    }
  )
  -- Orden natural del código (200.1.1 < 200.2 < 200.12) y luego provincia:
  -- el orden lexicográfico pondría "200.12" antes de "200.2".
  ORDER BY
    list_transform(string_split(codigo, '.'), x -> CAST(x AS INTEGER)),
    slug
)
TO 'data/parquet/vigencia=2026-1/apus.parquet'
(
  FORMAT parquet,
  COMPRESSION zstd,
  -- 73 640 filas: con 16 384 quedan 5 grupos de fila. El archivo es pequeño y
  -- se lee entero (alimenta listados y mapas), así que no hace falta afinar
  -- más; agrupar de menos solo añadiría metadatos.
  ROW_GROUP_SIZE 16384
);
