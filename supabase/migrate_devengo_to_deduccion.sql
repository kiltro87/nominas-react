-- Migration: rename 'Devengo' → 'Deducción' in nominas.categoría
-- Run this once via the Supabase SQL editor or psql.

update public.nominas
set "categoría" = 'Deducción'
where "categoría" = 'Devengo';
