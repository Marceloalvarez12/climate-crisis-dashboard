CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre, rol, status)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(LEFT(NEW.raw_user_meta_data->>'nombre', 120), ''), NEW.email, 'Usuario'),
    'operador',
    'suspendido'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.replace_operator_resources(p_operator_id uuid, p_resource_ids text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid() AND rol = 'admin' AND status = 'activo'
  ) THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = p_operator_id AND rol = 'operador' AND status = 'activo'
  ) THEN
    RAISE EXCEPTION 'Operador inválido';
  END IF;
  IF COALESCE(array_length(p_resource_ids, 1), 0) > 100 OR EXISTS (
    SELECT 1 FROM unnest(p_resource_ids) id
    WHERE id IS NULL OR NOT EXISTS (SELECT 1 FROM public.recursos r WHERE r.id::text = id AND r.estado <> 'retired')
  ) THEN
    RAISE EXCEPTION 'Recurso inválido';
  END IF;

  PERFORM 1 FROM public.perfiles WHERE id = p_operator_id FOR UPDATE;
  DELETE FROM public.asignaciones_recursos WHERE operador_id = p_operator_id;
  INSERT INTO public.asignaciones_recursos (operador_id, recurso_id)
  SELECT p_operator_id, id FROM (SELECT DISTINCT unnest(p_resource_ids) id) ids;
  INSERT INTO public.auditoria_admin (admin_id, accion, detalle)
  VALUES (auth.uid(), 'assign_resources', jsonb_build_object('user_id', p_operator_id, 'resource_ids', p_resource_ids));
END;
$$;

REVOKE ALL ON FUNCTION public.replace_operator_resources(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_operator_resources(uuid, text[]) TO authenticated;
