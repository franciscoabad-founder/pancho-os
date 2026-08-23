-- Seed: alimentos macros Ecuador (research Kimi), 24-ago-2026. Idempotente por nombre.
DO $$
DECLARE v_id uuid;
BEGIN

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Atún en lata en aceite escurrido') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Atún en lata en aceite escurrido', 'latam', 198.0, 29.1, 0.0, 8.2, 0.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 lata escurrida', 120, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 146, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Atún en lata en agua escurrido') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Atún en lata en agua escurrido', 'latam', 86.0, 19.4, 0.0, 1.0, 0.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 lata escurrida', 112, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 146, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Carne molida de res 90/10 cocida') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Carne molida de res 90/10 cocida', 'latam', 217.0, 26.1, 0.0, 11.8, 0.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 85, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza cocida', 140, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Chorizo de cerdo') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Chorizo de cerdo', 'latam', 301.0, 24.1, 1.9, 21.3, 0.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 unidad mediana', 70, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 rebanada', 15, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Clara de huevo cruda') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Clara de huevo cruda', 'latam', 52.0, 10.9, 0.7, 0.2, 0.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 clara grande', 33, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 243, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Corvina cruda') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Corvina cruda', 'latam', 97.0, 17.8, 0.0, 2.4, 0.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 filete mediano', 150, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 100, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Huevo frito') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Huevo frito', 'latam', 196.0, 13.6, 0.8, 14.8, 0.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 huevo grande', 46, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '2 huevos', 92, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Huevo revuelto') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Huevo revuelto', 'latam', 149.0, 10.0, 1.6, 11.0, 0.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 65, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 220, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Lomo de cerdo cocido') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Lomo de cerdo cocido', 'latam', 196.0, 29.4, 0.0, 7.9, 0.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 85, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 filete', 150, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Lomo de res magro cocido') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Lomo de res magro cocido', 'latam', 202.0, 29.8, 0.0, 8.4, 0.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 filete mediano', 150, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 100, 2);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza picada', 140, 3);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Muslo de pollo cocido con piel') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Muslo de pollo cocido con piel', 'latam', 229.0, 26.0, 0.0, 13.3, 0.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 muslo mediano', 90, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza picada', 140, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Muslo de pollo cocido sin piel') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Muslo de pollo cocido sin piel', 'latam', 173.0, 28.2, 0.0, 5.7, 0.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 muslo mediano', 70, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza picada', 140, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Pechuga de pavo asada') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Pechuga de pavo asada', 'latam', 147.0, 30.1, 0.0, 2.1, 0.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 85, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 rebanada', 28, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Pechuga de pollo cocida sin piel') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Pechuga de pollo cocida sin piel', 'latam', 165.0, 31.0, 0.0, 3.6, 0.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 pechuga mediana', 120, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza picada', 140, 2);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 85, 3);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Pescado blanco frito') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Pescado blanco frito', 'latam', 215.0, 18.5, 6.0, 12.5, 0.3)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 filete frito', 120, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 100, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Salmón atlántico cocido') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Salmón atlántico cocido', 'latam', 206.0, 22.1, 0.0, 12.3, 0.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 filete mediano', 154, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 100, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Sardina en lata en aceite') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Sardina en lata en aceite', 'latam', 208.0, 24.6, 0.0, 11.5, 0.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 lata escurrida', 92, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 unidad', 12, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Tilapia cruda') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Tilapia cruda', 'latam', 96.0, 20.1, 0.0, 1.7, 0.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 filete', 115, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 100, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Trucha arcoíris cocida') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Trucha arcoíris cocida', 'latam', 168.0, 23.8, 0.0, 7.4, 0.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 filete', 125, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 100, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Whey protein en polvo') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Whey protein en polvo', 'latam', 375.0, 75.0, 10.0, 6.0, 2.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 scoop', 30, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 32, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'chochos (lupino) cocidos') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('chochos (lupino) cocidos', 'latam', 119.0, 15.6, 9.9, 2.9, 2.8)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 166, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 100, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'lentejas cocidas') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('lentejas cocidas', 'latam', 116.0, 9.0, 20.1, 0.4, 7.9)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza cocida', 198, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 150, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Avena en hojuelas seca') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Avena en hojuelas seca', 'latam', 379.0, 13.2, 67.7, 6.5, 10.1)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1/2 taza', 40, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 81, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Cereal de maíz') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Cereal de maíz', 'latam', 357.0, 7.5, 84.1, 0.4, 3.3)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 28, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 1/2 tazas', 42, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'arepa') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('arepa', 'latam', 210.0, 5.0, 36.0, 5.0, 2.5)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 unidad', 100, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 120, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'camote cocido') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('camote cocido', 'latam', 76.0, 1.4, 17.7, 0.1, 2.5)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 200, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 unidad mediana', 130, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'choclo cocido') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('choclo cocido', 'latam', 108.0, 3.5, 23.0, 1.3, 2.5)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza granos', 149, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 mazorca', 90, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'fideo/pasta cocida') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('fideo/pasta cocida', 'latam', 158.0, 5.8, 30.9, 0.9, 1.8)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza cocida', 140, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 180, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'harina de maíz precocida') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('harina de maíz precocida', 'latam', 363.0, 7.0, 76.9, 3.5, 7.3)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 114, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 50, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'morocho cocido') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('morocho cocido', 'latam', 92.0, 2.5, 19.0, 0.8, 2.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza cocida', 160, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 180, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'mote cocido') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('mote cocido', 'latam', 110.0, 3.0, 22.5, 1.1, 2.8)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza cocida', 166, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 200, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'olluco cocido') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('olluco cocido', 'latam', 72.0, 1.5, 16.0, 0.2, 1.5)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 150, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 180, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'patacones/tostones') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('patacones/tostones', 'latam', 205.0, 1.4, 33.0, 7.5, 2.3)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '4 unidades', 100, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 120, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'plátano maduro frito (maduros)') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('plátano maduro frito (maduros)', 'latam', 168.0, 1.1, 29.3, 5.8, 1.8)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 unidad frito', 120, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 100, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'plátano verde hervido') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('plátano verde hervido', 'latam', 115.0, 1.2, 29.6, 0.3, 2.2)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 unidad hervida', 140, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 150, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'sémola de maíz cocida') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('sémola de maíz cocida', 'latam', 85.0, 2.0, 18.0, 0.4, 1.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza cocida', 233, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 180, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'trigo pelado cocido') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('trigo pelado cocido', 'latam', 126.0, 4.5, 26.5, 0.6, 3.8)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza cocida', 172, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 150, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'yuca frita') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('yuca frita', 'latam', 225.0, 1.3, 35.0, 9.0, 1.8)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 140, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 150, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'yuca hervida') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('yuca hervida', 'latam', 142.0, 1.2, 34.4, 0.2, 1.8)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 137, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 200, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Aguacate (palta)') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Aguacate (palta)', 'latam', 160.0, 2.0, 8.5, 14.7, 6.7)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 unidad mediana', 150, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1/2 unidad', 75, 2);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza en cubos', 150, 3);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Almendras') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Almendras', 'latam', 579.0, 21.2, 21.6, 49.9, 12.5)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 puñado', 28, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 143, 2);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '23 almendras', 28, 3);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Coco rallado') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Coco rallado', 'latam', 660.0, 6.9, 23.7, 64.5, 16.3)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 cucharada', 5, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 93, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Linaza molida') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Linaza molida', 'latam', 534.0, 18.3, 28.9, 42.2, 27.3)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 cucharada', 10, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 30, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Nueces mixtas') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Nueces mixtas', 'latam', 607.0, 20.0, 21.3, 54.0, 6.5)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 puñado', 28, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 137, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Semillas de chía') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Semillas de chía', 'latam', 486.0, 16.5, 42.1, 30.7, 34.4)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 cucharada', 12, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 28, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Tocino frito') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Tocino frito', 'latam', 541.0, 37.0, 1.4, 41.8, 0.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 tira', 8, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '3 tiras', 24, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Kéfir natural') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Kéfir natural', 'latam', 55.0, 3.3, 4.0, 3.5, 0.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 vaso', 245, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 245, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Queso tipo Manaba (semi-seco ecuatoriano)') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Queso tipo Manaba (semi-seco ecuatoriano)', 'latam', 330.0, 24.0, 2.0, 25.0, 0.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 40, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza rallado', 110, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Yogurt griego natural descremado') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Yogurt griego natural descremado', 'latam', 59.0, 10.2, 3.6, 0.4, 0.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 envase', 170, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 245, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Yogurt griego natural entero') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Yogurt griego natural entero', 'latam', 97.0, 9.0, 3.6, 5.0, 0.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 envase', 170, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 245, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Yogurt natural entero') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Yogurt natural entero', 'latam', 61.0, 3.5, 4.7, 3.3, 0.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 envase', 170, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 245, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'queso fresco ecuatoriano') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('queso fresco ecuatoriano', 'latam', 264.0, 18.0, 3.0, 20.0, 0.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 40, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 rodaja', 28, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Fresas') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Fresas', 'latam', 32.0, 0.7, 7.7, 0.3, 2.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 152, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '5 unidades grandes', 90, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Naranjilla') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Naranjilla', 'latam', 25.0, 0.4, 5.9, 0.1, 0.5)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 unidad mediana', 60, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza de pulpa', 150, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Uvas') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Uvas', 'latam', 69.0, 0.7, 18.1, 0.2, 0.9)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 151, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '10 unidades', 49, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'plátano verde crudo') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('plátano verde crudo', 'latam', 122.0, 1.3, 31.9, 0.4, 2.3)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 unidad', 150, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza en rodajas', 148, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Brócoli') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Brócoli', 'latam', 34.0, 2.8, 6.6, 0.4, 2.6)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza picado', 91, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 rama', 151, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Calabacín') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Calabacín', 'latam', 17.0, 1.2, 3.1, 0.3, 1.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 unidad mediana', 196, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza en rodajas', 113, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Champiñones') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Champiñones', 'latam', 22.0, 3.1, 3.3, 0.3, 1.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza en láminas', 70, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza cocida', 156, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Col') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Col', 'latam', 25.0, 1.3, 5.8, 0.1, 2.5)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza picada', 89, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza cocida', 150, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Espinaca') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Espinaca', 'latam', 23.0, 2.9, 3.6, 0.4, 2.2)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza cruda', 30, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza cocida', 180, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Pimiento') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Pimiento', 'latam', 31.0, 1.0, 6.0, 0.3, 2.1)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 unidad mediana', 119, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza picado', 149, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Zanahoria') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Zanahoria', 'latam', 41.0, 0.9, 9.6, 0.2, 2.8)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 unidad mediana', 61, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza rallada', 110, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'arvejas cocidas') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('arvejas cocidas', 'latam', 84.0, 5.4, 15.6, 0.2, 5.5)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza cocida', 160, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 120, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'arroz con menestra y carne') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('arroz con menestra y carne', 'latam', 155.0, 9.0, 20.5, 4.2, 2.8)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 plato', 350, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 220, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'arroz moro') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('arroz moro', 'latam', 150.0, 6.0, 25.0, 3.0, 4.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 180, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 250, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'ceviche de camarón ecuatoriano') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('ceviche de camarón ecuatoriano', 'latam', 85.0, 11.0, 8.0, 1.2, 0.8)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 240, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 300, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'chaulafán') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('chaulafán', 'latam', 168.0, 8.5, 21.0, 5.0, 1.2)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 200, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 plato', 300, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'encebollado de pescado') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('encebollado de pescado', 'latam', 95.0, 12.5, 8.0, 2.0, 1.0)
    RETURNING id INTO v_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'fanesca (estimada)') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('fanesca (estimada)', 'latam', 110.0, 5.5, 11.5, 4.8, 2.5)
    RETURNING id INTO v_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'hornado con mote') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('hornado con mote', 'latam', 205.0, 13.5, 15.5, 9.8, 1.5)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 plato', 300, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 350, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'llapingachos') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('llapingachos', 'latam', 210.0, 5.5, 24.0, 10.0, 2.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '2 unidades', 120, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 150, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'locro de papas') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('locro de papas', 'latam', 105.0, 3.8, 12.5, 4.5, 1.2)
    RETURNING id INTO v_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'menestra de fréjol negro') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('menestra de fréjol negro', 'latam', 112.0, 7.2, 16.5, 2.6, 6.5)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 240, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 300, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'menestra de lentejas') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('menestra de lentejas', 'latam', 118.0, 8.3, 16.9, 2.8, 5.1)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 240, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 300, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'menestra de porotos') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('menestra de porotos', 'latam', 108.0, 6.8, 15.9, 2.4, 5.8)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 240, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 300, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'sango de camarón') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('sango de camarón', 'latam', 145.0, 9.5, 17.5, 4.0, 1.8)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 plato', 300, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 220, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'tamales ecuatorianos') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('tamales ecuatorianos', 'latam', 178.0, 6.5, 21.0, 7.5, 1.8)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 unidad', 150, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción', 200, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Chifles de plátano') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Chifles de plátano', 'latam', 519.0, 2.3, 63.8, 29.6, 5.5)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 bolsa pequeña', 28, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1/2 taza', 30, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Galletas maría') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Galletas maría', 'latam', 440.0, 6.5, 76.8, 12.0, 2.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '4 unidades', 28, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 paquete', 100, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Galletas saladas') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Galletas saladas', 'latam', 502.0, 7.0, 64.5, 24.1, 2.6)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '5 unidades', 16, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 paquete', 150, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Maní salado') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Maní salado', 'latam', 567.0, 25.8, 16.1, 49.2, 8.5)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 puñado', 28, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 146, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Papas fritas de bolsa') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Papas fritas de bolsa', 'latam', 536.0, 7.0, 53.5, 34.6, 4.8)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 bolsa pequeña', 28, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 bolsa mediana', 50, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'empanadas de verde') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('empanadas de verde', 'latam', 235.0, 4.0, 30.0, 11.0, 2.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 unidad', 90, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 porción = 2 unidades', 180, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'habitas fritas (snack)') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('habitas fritas (snack)', 'latam', 446.0, 20.0, 45.0, 20.0, 12.0)
    RETURNING id INTO v_id;
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 puñado', 30, 1);
    INSERT INTO alimento_porciones (alimento_id, nombre, gramos, orden) VALUES (v_id, '1 taza', 110, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Avena bebible') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Avena bebible', 'latam', 50.0, 1.2, 8.5, 1.0, 0.8)
    RETURNING id INTO v_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Café negro') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Café negro', 'latam', 1.0, 0.1, 0.0, 0.0, 0.0)
    RETURNING id INTO v_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Cerveza') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Cerveza', 'latam', 43.0, 0.5, 3.6, 0.0, 0.0)
    RETURNING id INTO v_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Cola regular') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Cola regular', 'latam', 41.0, 0.0, 10.6, 0.0, 0.0)
    RETURNING id INTO v_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Jugo de mora') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Jugo de mora', 'latam', 38.0, 0.5, 9.0, 0.1, 0.3)
    RETURNING id INTO v_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'Té sin azúcar') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('Té sin azúcar', 'latam', 1.0, 0.0, 0.3, 0.0, 0.0)
    RETURNING id INTO v_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM alimentos WHERE nombre = 'morocho con leche (bebida)') THEN
    INSERT INTO alimentos (nombre, fuente, kcal, proteina_g, carbos_g, grasa_g, fibra_g)
    VALUES ('morocho con leche (bebida)', 'latam', 85.0, 3.2, 13.5, 2.0, 0.5)
    RETURNING id INTO v_id;
  END IF;
END $$;