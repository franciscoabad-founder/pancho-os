-- Seed: rutinas del programa de entrenamiento en casa (deep research 2026-08)
-- Fuente: docs/programa-entrenamiento-casa.md (plantillas A) + docs/catalogo_ejercicios.md
-- Idempotente: si ya existe una rutina con el mismo nombre, se salta completa.
-- Sustituciones por catalogo (no existen variantes exactas):
--   RDL con mancuernas -> stiff-legged-dumbbell-deadlift
--   RDL a una pierna -> kettlebell-one-legged-deadlift (hacer con mancuerna)
--   Face pull con banda / pajaros -> reverse-flyes
--   Zancada caminando con mancuernas -> dumbbell-lunges
--   Push-up lastrado / con deficit -> pushups (nota en el ejercicio)
--   Hip thrust con mancuerna -> bodyweight-hip-thrust (nota: mancuerna sobre cadera)

DO $$
DECLARE
  spec jsonb := $spec$
  [
    {
      "nombre": "Full Body 3 dias (casa)",
      "descripcion": "Plantilla full body 3 dias (research 2026-08). RIR 3 semanas 1-2, luego RIR 2; tempo 2110 en compuestos; deload semana 5 (-50% series, RIR 3-4). Regla de sueno: si dormiste <5.5h corta la ultima serie de cada ejercicio y no pases de RIR 2. Semaforo D gobierna: amarillo -30% volumen, rojo movilidad o -50%.",
      "dias": [
        {"nombre": "Dia 1 - Full Body A", "ejercicios": [
          {"slug": "goblet-squat", "warmup": true, "sets": 3, "reps": 8, "descanso": 150, "notas": "3x8-12 @ RIR 2, pausa 2s abajo"},
          {"slug": "dumbbell-floor-press", "sets": 3, "reps": 8, "descanso": 150, "notas": "3x8-12 @ RIR 2"},
          {"slug": "one-arm-dumbbell-row", "sets": 3, "reps": 10, "descanso": 120, "notas": "3x10-15/lado @ RIR 2"},
          {"slug": "stiff-legged-dumbbell-deadlift", "sets": 3, "reps": 10, "descanso": 150, "notas": "RDL mancuernas 3x10-12 @ RIR 2"},
          {"slug": "plank", "sets": 3, "duracion": 40, "descanso": 60, "notas": "3x30-45s"}
        ]},
        {"nombre": "Dia 2 - Full Body B", "ejercicios": [
          {"slug": "bulgarian-split-squat", "warmup": true, "sets": 3, "reps": 8, "descanso": 150, "notas": "3x8-12/pierna @ RIR 2 (o zancada caminando)"},
          {"slug": "bench-dips", "sets": 3, "reps": 8, "descanso": 120, "notas": "3x8-15 @ RIR 1-2"},
          {"slug": "inverted-row", "sets": 3, "reps": 10, "descanso": 120, "notas": "3x10-15 @ RIR 1-2 (bajo mesa, o remo con pausa)"},
          {"slug": "dumbbell-shoulder-press", "sets": 3, "reps": 8, "descanso": 150, "notas": "3x8-12 @ RIR 2"},
          {"slug": "dumbbell-bicep-curl", "sets": 2, "reps": 10, "descanso": 90, "notas": "2x10-15 @ RIR 1-2"},
          {"slug": "standing-dumbbell-triceps-extension", "sets": 2, "reps": 12, "descanso": 90, "notas": "Extension tras nuca 2x12-15 @ RIR 1-2"}
        ]},
        {"nombre": "Dia 3 - Full Body C", "ejercicios": [
          {"slug": "bodyweight-hip-thrust", "warmup": true, "sets": 3, "reps": 10, "descanso": 120, "notas": "3x10-15 @ RIR 2, mancuerna sobre la cadera"},
          {"slug": "pushups", "sets": 3, "reps": 10, "descanso": 120, "notas": "3x10-15 @ RIR 1-2, lastradas (mochila) o con deficit"},
          {"slug": "pullups", "sets": 3, "reps": 6, "descanso": 150, "notas": "3x6-12 @ RIR 2 (o remo mancuerna pesado si no hay barra)"},
          {"slug": "goblet-squat", "sets": 2, "reps": 10, "descanso": 120, "notas": "1.5 reps 2x10-12 @ RIR 2 (o bulgara)"},
          {"slug": "side-lateral-raise", "sets": 3, "reps": 12, "descanso": 90, "notas": "3x12-20 @ RIR 1-2"},
          {"slug": "dumbbell-bicep-curl", "ss": 1, "sets": 2, "reps": 12, "descanso": 30, "notas": "Superserie con triceps: 2x12-15 @ RIR 1-2"},
          {"slug": "standing-dumbbell-triceps-extension", "ss": 1, "sets": 2, "reps": 12, "descanso": 90, "notas": "Superserie con curl: 2x12-15 @ RIR 1-2"}
        ]}
      ]
    },
    {
      "nombre": "Torso/Pierna 4 dias (casa)",
      "descripcion": "Upper/Lower 4 dias (research 2026-08). RIR 3 semanas 1-2, luego RIR 2; tempo 2110 en compuestos (3-1-1 en goblet desde semana 3); deload semana 5 (-50% series, RIR 3-4). Regla de sueno: si dormiste <5.5h corta la ultima serie de cada ejercicio y no pases de RIR 2.",
      "dias": [
        {"nombre": "Dia 1 - Upper A", "ejercicios": [
          {"slug": "dumbbell-floor-press", "warmup": true, "sets": 3, "reps": 8, "descanso": 150, "notas": "3x8-12 @ RIR 2"},
          {"slug": "one-arm-dumbbell-row", "sets": 3, "reps": 10, "descanso": 120, "notas": "3x10-12/lado @ RIR 2"},
          {"slug": "dumbbell-shoulder-press", "sets": 3, "reps": 8, "descanso": 150, "notas": "3x8-12 @ RIR 2"},
          {"slug": "inverted-row", "sets": 2, "reps": 8, "descanso": 120, "notas": "2x8-15 @ RIR 1-2 (o dominadas)"},
          {"slug": "dumbbell-bicep-curl", "sets": 2, "reps": 10, "descanso": 90, "notas": "2x10-15 @ RIR 1-2"}
        ]},
        {"nombre": "Dia 2 - Lower A", "ejercicios": [
          {"slug": "bulgarian-split-squat", "warmup": true, "sets": 3, "reps": 8, "descanso": 150, "notas": "3x8-12/pierna @ RIR 2"},
          {"slug": "stiff-legged-dumbbell-deadlift", "sets": 3, "reps": 10, "descanso": 150, "notas": "RDL mancuernas 3x10-12 @ RIR 2"},
          {"slug": "bodyweight-hip-thrust", "sets": 3, "reps": 10, "descanso": 120, "notas": "3x10-15 @ RIR 1-2, mancuerna sobre la cadera"},
          {"slug": "standing-dumbbell-calf-raise", "sets": 3, "reps": 12, "descanso": 90, "notas": "3x12-20 @ RIR 1-2, pausa abajo"},
          {"slug": "plank", "sets": 3, "duracion": 40, "descanso": 60, "notas": "3x30-45s"}
        ]},
        {"nombre": "Dia 3 - Upper B", "ejercicios": [
          {"slug": "bench-dips", "warmup": true, "sets": 3, "reps": 8, "descanso": 120, "notas": "3x8-15 @ RIR 1-2"},
          {"slug": "pullups", "sets": 3, "reps": 6, "descanso": 150, "notas": "3x6-12 @ RIR 1-2 (o remo con pausa)"},
          {"slug": "dumbbell-flyes", "sets": 2, "reps": 12, "descanso": 90, "notas": "Aperturas en suelo 2x12-15 @ RIR 1-2"},
          {"slug": "side-lateral-raise", "sets": 3, "reps": 12, "descanso": 90, "notas": "3x12-20 @ RIR 1-2"},
          {"slug": "standing-dumbbell-triceps-extension", "sets": 2, "reps": 12, "descanso": 90, "notas": "Extension tras nuca 2x12-15 @ RIR 1-2"},
          {"slug": "hammer-curls", "sets": 2, "reps": 10, "descanso": 90, "notas": "2x10-15 @ RIR 1-2"}
        ]},
        {"nombre": "Dia 4 - Lower B", "ejercicios": [
          {"slug": "goblet-squat", "warmup": true, "sets": 3, "reps": 10, "descanso": 150, "notas": "3x10-15 @ RIR 2, tempo 3-1-1 desde semana 3"},
          {"slug": "dumbbell-lunges", "sets": 3, "reps": 10, "descanso": 120, "notas": "Zancada caminando 3x10-12/pierna @ RIR 2"},
          {"slug": "kettlebell-one-legged-deadlift", "sets": 2, "reps": 10, "descanso": 120, "notas": "RDL a una pierna con mancuerna 2x10-12/pierna @ RIR 2"},
          {"slug": "single-leg-glute-bridge", "sets": 2, "reps": 12, "descanso": 90, "notas": "2x12-15/pierna @ RIR 1-2"},
          {"slug": "dead-bug", "sets": 3, "reps": 10, "descanso": 60, "notas": "3x10-15 controladas"}
        ]}
      ]
    },
    {
      "nombre": "PPL+Upper/Lower 5 dias (casa)",
      "descripcion": "PPL + Upper/Lower 5 dias (research 2026-08), solo para semanas verdes de sueno (>=49h). RIR 3 semanas 1-2, luego RIR 2; tempo 2110 en compuestos; deload semana 5 (-50% series, RIR 3-4). Regla de sueno: si dormiste <5.5h corta la ultima serie de cada ejercicio y no pases de RIR 2.",
      "dias": [
        {"nombre": "Dia 1 - Push", "ejercicios": [
          {"slug": "dumbbell-floor-press", "warmup": true, "sets": 3, "reps": 8, "descanso": 150, "notas": "3x8-12 @ RIR 2"},
          {"slug": "dumbbell-shoulder-press", "sets": 3, "reps": 8, "descanso": 150, "notas": "3x8-12 @ RIR 2"},
          {"slug": "bench-dips", "sets": 3, "reps": 8, "descanso": 120, "notas": "3x8-15 @ RIR 1-2"},
          {"slug": "side-lateral-raise", "sets": 3, "reps": 12, "descanso": 90, "notas": "3x12-20 @ RIR 1-2"},
          {"slug": "standing-dumbbell-triceps-extension", "sets": 3, "reps": 12, "descanso": 90, "notas": "Extension tras nuca 3x12-15 @ RIR 1-2"}
        ]},
        {"nombre": "Dia 2 - Pull", "ejercicios": [
          {"slug": "pullups", "warmup": true, "sets": 4, "reps": 6, "descanso": 150, "notas": "4x6-12 @ RIR 1-2 (o remo invertido)"},
          {"slug": "one-arm-dumbbell-row", "sets": 3, "reps": 10, "descanso": 120, "notas": "3x10-12/lado @ RIR 2"},
          {"slug": "reverse-flyes", "sets": 3, "reps": 12, "descanso": 90, "notas": "Pajaros / face pull con banda 3x12-20 @ RIR 1-2"},
          {"slug": "dumbbell-bicep-curl", "sets": 3, "reps": 10, "descanso": 90, "notas": "3x10-15 @ RIR 1-2"},
          {"slug": "hammer-curls", "sets": 2, "reps": 10, "descanso": 90, "notas": "2x10-15 @ RIR 1-2"}
        ]},
        {"nombre": "Dia 3 - Legs", "ejercicios": [
          {"slug": "goblet-squat", "warmup": true, "sets": 3, "reps": 10, "descanso": 150, "notas": "3x10-15 @ RIR 2"},
          {"slug": "stiff-legged-dumbbell-deadlift", "sets": 3, "reps": 10, "descanso": 150, "notas": "RDL mancuernas 3x10-12 @ RIR 2"},
          {"slug": "bulgarian-split-squat", "sets": 3, "reps": 8, "descanso": 120, "notas": "3x8-12/pierna @ RIR 2"},
          {"slug": "bodyweight-hip-thrust", "sets": 2, "reps": 12, "descanso": 120, "notas": "2x12-15 @ RIR 1-2, mancuerna sobre la cadera"},
          {"slug": "standing-dumbbell-calf-raise", "sets": 3, "reps": 12, "descanso": 90, "notas": "3x12-20 @ RIR 1-2"},
          {"slug": "plank", "sets": 3, "duracion": 40, "descanso": 60, "notas": "3x30-45s"}
        ]},
        {"nombre": "Dia 4 - Upper", "ejercicios": [
          {"slug": "incline-dumbbell-press", "warmup": true, "sets": 3, "reps": 10, "descanso": 150, "notas": "3x10-15 @ RIR 1-2 (o push-ups lastrados si no hay banco)"},
          {"slug": "inverted-row", "sets": 3, "reps": 10, "descanso": 120, "notas": "3x10-15 @ RIR 1-2 (o remo con pausa)"},
          {"slug": "dumbbell-shoulder-press", "sets": 2, "reps": 10, "descanso": 120, "notas": "Rango alto 2x10-15 @ RIR 2"},
          {"slug": "dumbbell-flyes", "sets": 2, "reps": 12, "descanso": 90, "notas": "Aperturas 2x12-15 @ RIR 1-2"},
          {"slug": "dumbbell-bicep-curl", "sets": 2, "reps": 10, "descanso": 90, "notas": "2x10-15 @ RIR 1-2"},
          {"slug": "standing-dumbbell-triceps-extension", "sets": 2, "reps": 12, "descanso": 90, "notas": "2x12-15 @ RIR 1-2"}
        ]},
        {"nombre": "Dia 5 - Lower", "ejercicios": [
          {"slug": "dumbbell-lunges", "warmup": true, "sets": 3, "reps": 10, "descanso": 150, "notas": "Zancada caminando 3x10-12/pierna @ RIR 2"},
          {"slug": "kettlebell-one-legged-deadlift", "sets": 3, "reps": 10, "descanso": 120, "notas": "RDL a una pierna con mancuerna 3x10-12/pierna @ RIR 2"},
          {"slug": "goblet-squat", "sets": 2, "reps": 10, "descanso": 120, "notas": "1.5 reps 2x10-12 @ RIR 2"},
          {"slug": "single-leg-glute-bridge", "sets": 2, "reps": 12, "descanso": 90, "notas": "2x12-15/pierna @ RIR 1-2"},
          {"slug": "standing-dumbbell-calf-raise", "sets": 3, "reps": 15, "descanso": 90, "notas": "3x15-20 @ RIR 1-2"},
          {"slug": "dead-bug", "sets": 3, "duracion": null, "reps": 10, "descanso": 60, "notas": "3x10-12 controladas"}
        ]}
      ]
    }
  ]
  $spec$;
  r jsonb; d jsonb; e jsonb;
  v_rutina uuid; v_dia uuid; v_de uuid; v_ej uuid;
  v_dia_orden int; v_ej_orden int; v_serie_orden int; s int;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(spec) LOOP
    IF EXISTS (SELECT 1 FROM gfit_rutinas WHERE nombre = r->>'nombre') THEN
      RAISE NOTICE 'Rutina "%" ya existe, se salta', r->>'nombre';
      CONTINUE;
    END IF;

    INSERT INTO gfit_rutinas (nombre, descripcion, objetivo, estado)
    VALUES (r->>'nombre', r->>'descripcion', 'hipertrofia', 'activa')
    RETURNING id INTO v_rutina;

    v_dia_orden := 0;
    FOR d IN SELECT * FROM jsonb_array_elements(r->'dias') LOOP
      v_dia_orden := v_dia_orden + 1;
      INSERT INTO gfit_dias (rutina_id, nombre, tipo, orden)
      VALUES (v_rutina, d->>'nombre', 'orden', v_dia_orden)
      RETURNING id INTO v_dia;

      v_ej_orden := -1;
      FOR e IN SELECT * FROM jsonb_array_elements(d->'ejercicios') LOOP
        v_ej_orden := v_ej_orden + 1;
        SELECT id INTO v_ej FROM ejercicios_catalogo WHERE slug = e->>'slug';
        IF v_ej IS NULL THEN
          RAISE EXCEPTION 'Slug no encontrado en ejercicios_catalogo: %', e->>'slug';
        END IF;

        INSERT INTO gfit_dia_ejercicios (dia_id, ejercicio_id, orden, superset_grupo, notas)
        VALUES (v_dia, v_ej, v_ej_orden, (e->>'ss')::smallint, e->>'notas')
        RETURNING id INTO v_de;

        v_serie_orden := 0;
        IF coalesce((e->>'warmup')::boolean, false) THEN
          INSERT INTO gfit_series_plan (dia_ejercicio_id, orden, tipo, reps, duracion_s, descanso_s)
          VALUES (v_de, v_serie_orden, 'warmup',
                  CASE WHEN e ? 'reps' THEN (e->>'reps')::smallint ELSE NULL END,
                  (e->>'duracion')::int, 60);
          v_serie_orden := v_serie_orden + 1;
        END IF;

        FOR s IN 1..(e->>'sets')::int LOOP
          INSERT INTO gfit_series_plan (dia_ejercicio_id, orden, tipo, reps, duracion_s, descanso_s)
          VALUES (v_de, v_serie_orden, 'working',
                  CASE WHEN e ? 'reps' AND e->>'reps' IS NOT NULL THEN (e->>'reps')::smallint ELSE NULL END,
                  (e->>'duracion')::int,
                  (e->>'descanso')::smallint);
          v_serie_orden := v_serie_orden + 1;
        END LOOP;
      END LOOP;
    END LOOP;

    RAISE NOTICE 'Rutina "%" creada', r->>'nombre';
  END LOOP;
END $$;
