-- insumos.parquet — catálogo regional de insumos: ~725 insumos × 140 provincias.
--
-- Entrada:  data/.staging/insumos.ndjson
-- Salida:   data/parquet/vigencia=2026-1/insumos.parquet
--
-- Rutas relativas a la raíz del repo (ver scripts/sql/apus.sql).
--
-- Son las cuatro hojas visibles del libro (MATERIALES, EQUIPO, MANO DE OBRA,
-- TRANSPORTE), ya resueltas para la provincia (FORMATO.md §4). En mano de obra
-- el `precio` es el salario base MENSUAL nacional y lo regional es el
-- `factorPrestacional` (≈ 2.03–2.05): sin él la fila no es regional.
--
-- Los precios NO se redondean: la fuente los publica con varios decimales
-- (7433.959551) y son la base de cálculo de los APU.

COPY (
  SELECT *
  FROM read_json(
    'data/.staging/insumos.ndjson',
    format = 'newline_delimited',
    columns = {
      vigencia:           'VARCHAR',
      regionCodigo:       'VARCHAR',
      slug:               'VARCHAR',
      departamento:       'VARCHAR',
      provincia:          'VARCHAR',
      codigoInsumo:       'VARCHAR',  -- "B0013791", "C0010052", "A0030040"…
      componente:         'VARCHAR',  -- equipo | materiales | transporte | manoDeObra
      descripcion:        'VARCHAR',
      unidad:             'VARCHAR',
      unidadCruda:        'VARCHAR',
      categoria:          'VARCHAR',  -- "AGREGADOS", "CONCRETO Y MORTERO"…
      precio:             'DOUBLE',   -- COP, costo directo
      factorPrestacional: 'DOUBLE'    -- solo mano de obra
    }
  )
  -- Por insumo y provincia: la consulta natural es "cuánto cuesta este insumo
  -- en cada región" (comparación regional de un mismo código).
  ORDER BY codigoInsumo, slug
)
TO 'data/parquet/vigencia=2026-1/insumos.parquet'
(
  FORMAT parquet,
  COMPRESSION zstd,
  -- ~101 500 filas: 16 384 deja 7 grupos y mantiene contiguas las 140 filas de
  -- un mismo insumo.
  ROW_GROUP_SIZE 16384
);
