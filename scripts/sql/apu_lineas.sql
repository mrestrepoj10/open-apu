-- apu_lineas.parquet — el desglose completo: ~4 428 líneas × 140 provincias.
--
-- Entrada:  data/.staging/apu_lineas.ndjson
-- Salida:   data/parquet/vigencia=2026-1/apu_lineas.parquet
--
-- Rutas relativas a la raíz del repo (ver scripts/sql/apus.sql).
--
-- Semántica de `cantidad` y `precioUnitario` (FORMATO.md §3.3) — el mismo par
-- de columnas significa cosas distintas según el componente:
--   equipo      cantidad = horas de equipo por unidad de obra   (× tarifa)
--   materiales  cantidad = insumo por unidad de obra            (× precio)
--   transporte  cantidad × distancia × tarifa; distancia SIEMPRE 1, porque la
--               tarifa es por unidad-kilómetro
--   manoDeObra  cantidad = RENDIMIENTO (unidades de obra por jornal): aquí se
--               DIVIDE, subtotal = precioUnitario / cantidad
-- La herramienta menor es una línea de `equipo` con `porcentaje` (0.05) y
-- `base` (el subtotal de mano de obra): no es un equipo real.
--
-- `cantidad`, `precioUnitario`, `jornal` y `factorPrestacional` se publican con
-- TODOS sus decimales: la fuente no los redondea y redondearlos falsearía el
-- dato. Solo `subtotal` y `base` llegan redondeados a 2 decimales, porque la
-- propia hoja los calcula con ROUND(x,2).

COPY (
  SELECT *
  FROM read_json(
    'data/.staging/apu_lineas.ndjson',
    format = 'newline_delimited',
    columns = {
      vigencia:           'VARCHAR',
      regionCodigo:       'VARCHAR',
      slug:               'VARCHAR',
      departamento:       'VARCHAR',
      provincia:          'VARCHAR',
      codigo:             'VARCHAR',  -- ítem de pago: "630.1.1"
      orden:              'INTEGER',  -- posición de la línea dentro del APU
      componente:         'VARCHAR',  -- equipo | materiales | transporte | manoDeObra
      codigoInsumo:       'VARCHAR',  -- "B0013791", "HERMENINV"…
      descripcion:        'VARCHAR',
      unidad:             'VARCHAR',
      unidadCruda:        'VARCHAR',
      cantidad:           'DOUBLE',
      precioUnitario:     'DOUBLE',
      subtotal:           'DOUBLE',   -- COP
      porcentaje:         'DOUBLE',   -- herramienta menor: 0.05
      base:               'DOUBLE',   -- herramienta menor: subtotal de mano de obra
      distancia:          'DOUBLE',   -- transporte: siempre 1
      jornal:             'DOUBLE',   -- mano de obra: jornal diario sin prestaciones
      factorPrestacional: 'DOUBLE'    -- mano de obra: factor ≈ 2.05 (no un %)
    }
  )
  -- ORDEN = ESTRATEGIA DE LECTURA. La consulta dominante del explorador es
  -- "dame el desglose del ítem X en la provincia Y", así que se ordena por
  -- (codigo, slug, orden): las ~1 180 filas de un ítem (8,4 líneas × 140
  -- provincias) quedan contiguas y las estadísticas min/max de `codigo` por
  -- grupo de fila permiten descartar el resto del archivo sin leerlo.
  ORDER BY
    list_transform(string_split(codigo, '.'), x -> CAST(x AS INTEGER)),
    slug,
    orden
)
TO 'data/parquet/vigencia=2026-1/apu_lineas.parquet'
(
  FORMAT parquet,
  COMPRESSION zstd,
  -- 8 192 filas por grupo ≈ 7 ítems completos. Un lector como hyparquet
  -- resuelve un ítem leyendo 1–2 grupos (≈ 16 k filas en el peor caso) en vez
  -- de los ~620 k del archivo. Bajar más (p. ej. 2 048) multiplicaría los
  -- metadatos del footer, que hyparquet sí lee entero; subir al valor por
  -- defecto de DuckDB (122 880) obligaría a leer 15 veces más datos por punto.
  ROW_GROUP_SIZE 8192
);
