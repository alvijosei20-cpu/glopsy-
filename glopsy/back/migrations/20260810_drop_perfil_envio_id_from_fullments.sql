-- Eliminar la columna perfil_envio_id de la tabla fullments ya que los perfiles de envío se asocian directamente a cada producto en produc.perfil_envio_id
ALTER TABLE fullments DROP COLUMN IF EXISTS perfil_envio_id;
