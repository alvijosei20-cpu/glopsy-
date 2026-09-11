-- Creación de la geografía de Venezuela (entidades federales + ciudades).
-- Modelo relacional igual al de Colombia: pais -> departamento(estado) -> ciudad.

DO $$
DECLARE
  v_pais_id INT;
  v_estado INT;
BEGIN
  INSERT INTO paises (nombre, codigo_iso)
  VALUES ('Venezuela', 'VE')
  ON CONFLICT (nombre) DO UPDATE SET codigo_iso = EXCLUDED.codigo_iso
  RETURNING id INTO v_pais_id;
  IF v_pais_id IS NULL THEN
    SELECT id INTO v_pais_id FROM paises WHERE nombre = 'Venezuela';
  END IF;

  -- Distrito Capital
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Distrito Capital') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_estado;
  IF v_estado IS NULL THEN SELECT id INTO v_estado FROM departamentos WHERE pais_id = v_pais_id AND nombre='Distrito Capital'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_estado, 'Caracas') ON CONFLICT DO NOTHING;

  -- Anzoátegui
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Anzoátegui') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_estado;
  IF v_estado IS NULL THEN SELECT id INTO v_estado FROM departamentos WHERE pais_id = v_pais_id AND nombre='Anzoátegui'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_estado, 'Barcelona'), (v_estado, 'Puerto La Cruz'), (v_estado, 'El Tigre'), (v_estado, 'Anaco') ON CONFLICT DO NOTHING;

  -- Apure
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Apure') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_estado;
  IF v_estado IS NULL THEN SELECT id INTO v_estado FROM departamentos WHERE pais_id = v_pais_id AND nombre='Apure'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_estado, 'San Fernando de Apure') ON CONFLICT DO NOTHING;

  -- Aragua
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Aragua') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_estado;
  IF v_estado IS NULL THEN SELECT id INTO v_estado FROM departamentos WHERE pais_id = v_pais_id AND nombre='Aragua'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_estado, 'Maracay'), (v_estado, 'Turmero'), (v_estado, 'Cagua'), (v_estado, 'La Victoria') ON CONFLICT DO NOTHING;

  -- Barinas
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Barinas') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_estado;
  IF v_estado IS NULL THEN SELECT id INTO v_estado FROM departamentos WHERE pais_id = v_pais_id AND nombre='Barinas'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_estado, 'Barinas') ON CONFLICT DO NOTHING;

  -- Bolívar
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Bolívar') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_estado;
  IF v_estado IS NULL THEN SELECT id INTO v_estado FROM departamentos WHERE pais_id = v_pais_id AND nombre='Bolívar'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_estado, 'Ciudad Bolívar'), (v_estado, 'Ciudad Guayana'), (v_estado, 'Upata') ON CONFLICT DO NOTHING;

  -- Carabobo
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Carabobo') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_estado;
  IF v_estado IS NULL THEN SELECT id INTO v_estado FROM departamentos WHERE pais_id = v_pais_id AND nombre='Carabobo'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_estado, 'Valencia'), (v_estado, 'Puerto Cabello'), (v_estado, 'Naguanagua'), (v_estado, 'Guacara') ON CONFLICT DO NOTHING;

  -- Cojedes
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Cojedes') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_estado;
  IF v_estado IS NULL THEN SELECT id INTO v_estado FROM departamentos WHERE pais_id = v_pais_id AND nombre='Cojedes'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_estado, 'San Carlos') ON CONFLICT DO NOTHING;

  -- Delta Amacuro
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Delta Amacuro') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_estado;
  IF v_estado IS NULL THEN SELECT id INTO v_estado FROM departamentos WHERE pais_id = v_pais_id AND nombre='Delta Amacuro'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_estado, 'Tucupita') ON CONFLICT DO NOTHING;

  -- Falcón
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Falcón') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_estado;
  IF v_estado IS NULL THEN SELECT id INTO v_estado FROM departamentos WHERE pais_id = v_pais_id AND nombre='Falcón'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_estado, 'Coro'), (v_estado, 'Punto Fijo') ON CONFLICT DO NOTHING;

  -- Guárico
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Guárico') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_estado;
  IF v_estado IS NULL THEN SELECT id INTO v_estado FROM departamentos WHERE pais_id = v_pais_id AND nombre='Guárico'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_estado, 'San Juan de los Morros'), (v_estado, 'Calabozo') ON CONFLICT DO NOTHING;

  -- Lara
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Lara') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_estado;
  IF v_estado IS NULL THEN SELECT id INTO v_estado FROM departamentos WHERE pais_id = v_pais_id AND nombre='Lara'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_estado, 'Barquisimeto'), (v_estado, 'Cabudare'), (v_estado, 'Carora'), (v_estado, 'El Tocuyo') ON CONFLICT DO NOTHING;

  -- Mérida
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Mérida') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_estado;
  IF v_estado IS NULL THEN SELECT id INTO v_estado FROM departamentos WHERE pais_id = v_pais_id AND nombre='Mérida'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_estado, 'Mérida'), (v_estado, 'El Vigía') ON CONFLICT DO NOTHING;

  -- Miranda
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Miranda') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_estado;
  IF v_estado IS NULL THEN SELECT id INTO v_estado FROM departamentos WHERE pais_id = v_pais_id AND nombre='Miranda'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_estado, 'Los Teques'), (v_estado, 'Guarenas'), (v_estado, 'Guatire'), (v_estado, 'Charallave'), (v_estado, 'Ocumare del Tuy') ON CONFLICT DO NOTHING;

  -- Monagas
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Monagas') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_estado;
  IF v_estado IS NULL THEN SELECT id INTO v_estado FROM departamentos WHERE pais_id = v_pais_id AND nombre='Monagas'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_estado, 'Maturín') ON CONFLICT DO NOTHING;

  -- Nueva Esparta
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Nueva Esparta') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_estado;
  IF v_estado IS NULL THEN SELECT id INTO v_estado FROM departamentos WHERE pais_id = v_pais_id AND nombre='Nueva Esparta'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_estado, 'La Asunción'), (v_estado, 'Porlamar') ON CONFLICT DO NOTHING;

  -- Portuguesa
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Portuguesa') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_estado;
  IF v_estado IS NULL THEN SELECT id INTO v_estado FROM departamentos WHERE pais_id = v_pais_id AND nombre='Portuguesa'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_estado, 'Acarigua'), (v_estado, 'Guanare') ON CONFLICT DO NOTHING;

  -- Sucre
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Sucre') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_estado;
  IF v_estado IS NULL THEN SELECT id INTO v_estado FROM departamentos WHERE pais_id = v_pais_id AND nombre='Sucre'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_estado, 'Cumaná'), (v_estado, 'Carúpano') ON CONFLICT DO NOTHING;

  -- Táchira
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Táchira') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_estado;
  IF v_estado IS NULL THEN SELECT id INTO v_estado FROM departamentos WHERE pais_id = v_pais_id AND nombre='Táchira'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_estado, 'San Cristóbal'), (v_estado, 'Táriba'), (v_estado, 'Rubio') ON CONFLICT DO NOTHING;

  -- Trujillo
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Trujillo') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_estado;
  IF v_estado IS NULL THEN SELECT id INTO v_estado FROM departamentos WHERE pais_id = v_pais_id AND nombre='Trujillo'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_estado, 'Trujillo'), (v_estado, 'Valera') ON CONFLICT DO NOTHING;

  -- Yaracuy
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Yaracuy') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_estado;
  IF v_estado IS NULL THEN SELECT id INTO v_estado FROM departamentos WHERE pais_id = v_pais_id AND nombre='Yaracuy'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_estado, 'San Felipe') ON CONFLICT DO NOTHING;

  -- Zulia
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Zulia') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_estado;
  IF v_estado IS NULL THEN SELECT id INTO v_estado FROM departamentos WHERE pais_id = v_pais_id AND nombre='Zulia'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_estado, 'Maracaibo'), (v_estado, 'Cabimas'), (v_estado, 'Ciudad Ojeda') ON CONFLICT DO NOTHING;

  -- Amazonas
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Amazonas') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_estado;
  IF v_estado IS NULL THEN SELECT id INTO v_estado FROM departamentos WHERE pais_id = v_pais_id AND nombre='Amazonas'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_estado, 'Puerto Ayacucho') ON CONFLICT DO NOTHING;

  -- La Guaira (antiguo Vargas)
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'La Guaira') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_estado;
  IF v_estado IS NULL THEN SELECT id INTO v_estado FROM departamentos WHERE pais_id = v_pais_id AND nombre='La Guaira'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_estado, 'La Guaira'), (v_estado, 'Catia La Mar') ON CONFLICT DO NOTHING;
END $$;