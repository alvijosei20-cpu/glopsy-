-- Creación de tablas geográficas relacionales (Paises, Departamentos, Ciudades)

CREATE TABLE IF NOT EXISTS paises (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  codigo_iso VARCHAR(10)
);

CREATE TABLE IF NOT EXISTS departamentos (
  id SERIAL PRIMARY KEY,
  pais_id INTEGER NOT NULL REFERENCES paises(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  CONSTRAINT unique_departamento_pais UNIQUE (pais_id, nombre)
);

CREATE TABLE IF NOT EXISTS ciudades (
  id SERIAL PRIMARY KEY,
  departamento_id INTEGER NOT NULL REFERENCES departamentos(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  codigo_postal VARCHAR(20),
  CONSTRAINT unique_ciudad_departamento UNIQUE (departamento_id, nombre)
);

-- Índices para búsqueda eficiente
CREATE INDEX IF NOT EXISTS idx_departamentos_pais_id ON departamentos(pais_id);
CREATE INDEX IF NOT EXISTS idx_ciudades_departamento_id ON ciudades(departamento_id);
CREATE INDEX IF NOT EXISTS idx_paises_nombre ON paises(nombre);
CREATE INDEX IF NOT EXISTS idx_departamentos_nombre ON departamentos(nombre);
CREATE INDEX IF NOT EXISTS idx_ciudades_nombre ON ciudades(nombre);

-- Inserción de Colombia y sus departamentos con ciudades principales (usando DO block para inserción limpia y relacional)
DO $$
DECLARE
  v_pais_id INT;
  v_dep_id INT;
BEGIN
  -- Insertar País
  INSERT INTO paises (nombre, codigo_iso) 
  VALUES ('Colombia', 'CO') 
  ON CONFLICT (nombre) DO UPDATE SET codigo_iso = EXCLUDED.codigo_iso
  RETURNING id INTO v_pais_id;

  IF v_pais_id IS NULL THEN
    SELECT id INTO v_pais_id FROM paises WHERE nombre = 'Colombia';
  END IF;

  -- 1. Amazonas
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Amazonas') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'Amazonas'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_dep_id, 'Leticia'), (v_dep_id, 'Puerto Nariño') ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 2. Antioquia
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Antioquia') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'Antioquia'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES 
    (v_dep_id, 'Medellín'), (v_dep_id, 'Bello'), (v_dep_id, 'Itagüí'), (v_dep_id, 'Envigado'), 
    (v_dep_id, 'Rionegro'), (v_dep_id, 'Apartadó'), (v_dep_id, 'Turbo'), (v_dep_id, 'Sabaneta') 
  ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 3. Arauca
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Arauca') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'Arauca'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_dep_id, 'Arauca'), (v_dep_id, 'Saravena'), (v_dep_id, 'Tame'), (v_dep_id, 'Arauquita') ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 4. Atlántico
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Atlántico') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'Atlántico'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES 
    (v_dep_id, 'Barranquilla'), (v_dep_id, 'Soledad'), (v_dep_id, 'Malambo'), (v_dep_id, 'Puerto Colombia'), (v_dep_id, 'Sabanalarga') 
  ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 5. Bolívar
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Bolívar') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'Bolívar'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES 
    (v_dep_id, 'Cartagena de Indias'), (v_dep_id, 'Magangué'), (v_dep_id, 'Turbaco'), (v_dep_id, 'Arjona'), (v_dep_id, 'El Carmen de Bolívar') 
  ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 6. Boyacá
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Boyacá') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'Boyacá'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES 
    (v_dep_id, 'Tunja'), (v_dep_id, 'Duitama'), (v_dep_id, 'Sogamoso'), (v_dep_id, 'Chiquinquirá'), (v_dep_id, 'Puerto Boyacá') 
  ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 7. Caldas
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Caldas') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'Caldas'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES 
    (v_dep_id, 'Manizales'), (v_dep_id, 'La Dorada'), (v_dep_id, 'Chinchiná'), (v_dep_id, 'Villamaría'), (v_dep_id, 'Riosucio') 
  ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 8. Caquetá
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Caquetá') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'Caquetá'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_dep_id, 'Florencia'), (v_dep_id, 'San Vicente del Caguán'), (v_dep_id, 'Puerto Rico') ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 9. Casanare
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Casanare') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'Casanare'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_dep_id, 'Yopal'), (v_dep_id, 'Aguazul'), (v_dep_id, 'Villanueva'), (v_dep_id, 'Pore') ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 10. Cauca
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Cauca') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'Cauca'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES 
    (v_dep_id, 'Popayán'), (v_dep_id, 'Santander de Quilichao'), (v_dep_id, 'Puerto Tejada'), (v_dep_id, 'Patía') 
  ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 11. Cesar
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Cesar') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'Cesar'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES 
    (v_dep_id, 'Valledupar'), (v_dep_id, 'Aguachica'), (v_dep_id, 'Codazzi'), (v_dep_id, 'Bosconia') 
  ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 12. Chocó
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Chocó') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'Chocó'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_dep_id, 'Quibdó'), (v_dep_id, 'Istmina'), (v_dep_id, 'Tadó'), (v_dep_id, 'Acandí') ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 13. Córdoba
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Córdoba') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'Córdoba'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES 
    (v_dep_id, 'Montería'), (v_dep_id, 'Cereté'), (v_dep_id, 'Sahagún'), (v_dep_id, 'Lorica'), (v_dep_id, 'Montelíbano') 
  ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 14. Cundinamarca
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Cundinamarca') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'Cundinamarca'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES 
    (v_dep_id, 'Bogotá D.C.'), (v_dep_id, 'Soacha'), (v_dep_id, 'Fusagasugá'), (v_dep_id, 'Facatativá'), 
    (v_dep_id, 'Chía'), (v_dep_id, 'Zipaquirá'), (v_dep_id, 'Girardot'), (v_dep_id, 'Mosquera'), (v_dep_id, 'Madrid') 
  ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 15. Guainía
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Guainía') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'Guainía'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_dep_id, 'Puerto Inírida') ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 16. Guaviare
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Guaviare') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'Guaviare'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_dep_id, 'San José del Guaviare'), (v_dep_id, 'Calamar') ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 17. Huila
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Huila') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'Huila'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES 
    (v_dep_id, 'Neiva'), (v_dep_id, 'Pitalito'), (v_dep_id, 'Garzón'), (v_dep_id, 'La Plata') 
  ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 18. La Guajira
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'La Guajira') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'La Guajira'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES 
    (v_dep_id, 'Riohacha'), (v_dep_id, 'Maicao'), (v_dep_id, 'Uribia'), (v_dep_id, 'Fonseca') 
  ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 19. Magdalena
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Magdalena') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'Magdalena'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES 
    (v_dep_id, 'Santa Marta'), (v_dep_id, 'Ciénaga'), (v_dep_id, 'Fundación'), (v_dep_id, 'El Banco') 
  ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 20. Meta
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Meta') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'Meta'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES 
    (v_dep_id, 'Villavicencio'), (v_dep_id, 'Acacías'), (v_dep_id, 'Granada'), (v_dep_id, 'Puerto López') 
  ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 21. Nariño
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Nariño') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'Nariño'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES 
    (v_dep_id, 'Pasto'), (v_dep_id, 'Tumaco'), (v_dep_id, 'Ipiales'), (v_dep_id, 'Túquerres') 
  ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 22. Norte de Santander
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Norte de Santander') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'Norte de Santander'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES 
    (v_dep_id, 'Cúcuta'), (v_dep_id, 'Ocaña'), (v_dep_id, 'Pamplona'), (v_dep_id, 'Villa del Rosario'), (v_dep_id, 'Los Patios') 
  ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 23. Putumayo
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Putumayo') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'Putumayo'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_dep_id, 'Mocoa'), (v_dep_id, 'Puerto Asís'), (v_dep_id, 'Orito') ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 24. Quindío
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Quindío') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'Quindío'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES 
    (v_dep_id, 'Armenia'), (v_dep_id, 'Calarcá'), (v_dep_id, 'Tebaida'), (v_dep_id, 'Montenegro') 
  ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 25. Risaralda
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Risaralda') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'Risaralda'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES 
    (v_dep_id, 'Pereira'), (v_dep_id, 'Dosquebradas'), (v_dep_id, 'Santa Rosa de Cabal'), (v_dep_id, 'La Virginia') 
  ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 26. San Andrés y Providencia
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'San Andrés y Providencia') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'San Andrés y Providencia'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_dep_id, 'San Andrés'), (v_dep_id, 'Providencia') ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 27. Santander
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Santander') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'Santander'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES 
    (v_dep_id, 'Bucaramanga'), (v_dep_id, 'Floridablanca'), (v_dep_id, 'Girón'), (v_dep_id, 'Piedecuesta'), 
    (v_dep_id, 'Barrancabermeja'), (v_dep_id, 'San Gil') 
  ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 28. Sucre
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Sucre') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'Sucre'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES 
    (v_dep_id, 'Sincelejo'), (v_dep_id, 'Corozal'), (v_dep_id, 'San Marcos'), (v_dep_id, 'Tolú') 
  ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 29. Tolima
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Tolima') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'Tolima'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES 
    (v_dep_id, 'Ibagué'), (v_dep_id, 'Espinal'), (v_dep_id, 'Melgar'), (v_dep_id, 'Lérida') 
  ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 30. Valle del Cauca
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Valle del Cauca') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'Valle del Cauca'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES 
    (v_dep_id, 'Cali'), (v_dep_id, 'Palmira'), (v_dep_id, 'Buenaventura'), (v_dep_id, 'Tuluá'), 
    (v_dep_id, 'Buga'), (v_dep_id, 'Cartago'), (v_dep_id, 'Jamundí'), (v_dep_id, 'Yumbo') 
  ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 31. Vaupés
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Vaupés') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'Vaupés'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_dep_id, 'Mitú') ON CONFLICT (departamento_id, nombre) DO NOTHING;

  -- 32. Vichada
  INSERT INTO departamentos (pais_id, nombre) VALUES (v_pais_id, 'Vichada') ON CONFLICT (pais_id, nombre) DO NOTHING RETURNING id INTO v_dep_id;
  IF v_dep_id IS NULL THEN SELECT id INTO v_dep_id FROM departamentos WHERE pais_id = v_pais_id AND nombre = 'Vichada'; END IF;
  INSERT INTO ciudades (departamento_id, nombre) VALUES (v_dep_id, 'Puerto Carreño'), (v_dep_id, 'La Primavera') ON CONFLICT (departamento_id, nombre) DO NOTHING;

END $$;
