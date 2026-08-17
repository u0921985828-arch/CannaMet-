-- ═══════════ 1. REPORTES AUTOMATICOS ═══════════
-- ATENCION: 'alter type ... add value' no puede usarse en la misma transaccion
-- que lo consume. Ejecutar este bloque por separado del siguiente.
alter type public.motivo_reporte add value if not exists 'bloqueos_repetidos';
