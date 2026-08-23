-- Seed 2026-08-24: rutinas guiadas de estiramiento.
-- Idempotente: WHERE NOT EXISTS por nombre. Formato de pasos igual al existente:
-- [{"nombre": text, "detalle": text, "por_lado": bool, "duracion_seg": int}]

INSERT INTO rutinas_estiramiento (nombre, descripcion, pasos)
SELECT v.nombre, v.descripcion, v.pasos::jsonb
FROM (VALUES
  ('Manana express (5 min)',
   'Despertar el cuerpo en 5 minutos, sin equipo, de pie y en el piso.',
   '[
     {"nombre":"Respiracion de pie con brazos arriba","detalle":"Inhala subiendo brazos, exhala bajando. Ritmo lento.","por_lado":false,"duracion_seg":30},
     {"nombre":"Flexion lateral de pie","detalle":"Brazo arriba, inclina el torso al lado contrario sin girar.","por_lado":true,"duracion_seg":20},
     {"nombre":"Gato-camello","detalle":"En cuatro apoyos, alterna arquear y redondear con la respiracion.","por_lado":false,"duracion_seg":40},
     {"nombre":"Perro boca abajo","detalle":"Talones buscando el piso, pedalea las rodillas.","por_lado":false,"duracion_seg":40},
     {"nombre":"Zancada baja con brazos arriba","detalle":"Rodilla trasera al piso, cadera al frente, pecho abierto.","por_lado":true,"duracion_seg":30},
     {"nombre":"Flexion al frente de pie","detalle":"Rodillas suaves, deja colgar cabeza y brazos.","por_lado":false,"duracion_seg":40}
   ]'),
  ('Post-entreno tren inferior',
   'Despues de piernas o circuito: cuadriceps, isquios, gluteos, aductores y pantorrillas.',
   '[
     {"nombre":"Cuadriceps de pie","detalle":"Talon al gluteo, rodillas juntas, cadera al frente.","por_lado":true,"duracion_seg":30},
     {"nombre":"Isquiotibiales sentado","detalle":"Pierna estirada, inclinate desde la cadera con espalda recta.","por_lado":true,"duracion_seg":30},
     {"nombre":"Paloma (gluteo)","detalle":"Espinilla al frente en el piso, torso hacia adelante.","por_lado":true,"duracion_seg":40},
     {"nombre":"Mariposa (aductores)","detalle":"Plantas de los pies juntas, rodillas hacia el piso.","por_lado":false,"duracion_seg":40},
     {"nombre":"Pantorrilla contra pared","detalle":"Pierna trasera estirada, talon clavado al piso.","por_lado":true,"duracion_seg":30},
     {"nombre":"Flexor de cadera en zancada baja","detalle":"Aprieta el gluteo trasero y lleva la cadera al frente.","por_lado":true,"duracion_seg":30}
   ]'),
  ('Cuello y hombros (escritorio)',
   'Pausa de pantalla: se puede hacer sentado, en ropa de trabajo.',
   '[
     {"nombre":"Inclinacion lateral de cuello","detalle":"Oreja al hombro, ayuda suave con la mano, hombros abajo.","por_lado":true,"duracion_seg":25},
     {"nombre":"Menton al pecho","detalle":"Manos entrelazadas en la nuca, deja caer el peso sin empujar.","por_lado":false,"duracion_seg":30},
     {"nombre":"Rotacion de cuello","detalle":"Mira por encima del hombro sin mover el torso.","por_lado":true,"duracion_seg":20},
     {"nombre":"Circulos de hombros","detalle":"Hacia atras, amplios y lentos.","por_lado":false,"duracion_seg":30},
     {"nombre":"Estiramiento de pecho en silla","detalle":"Manos en la nuca, abre codos y mira al techo.","por_lado":false,"duracion_seg":30},
     {"nombre":"Brazo cruzado al pecho","detalle":"Jala el codo con la otra mano, hombro relajado.","por_lado":true,"duracion_seg":25},
     {"nombre":"Estiramiento de trapecio con mano en la espalda","detalle":"Mano tras la espalda baja, inclina la cabeza al lado contrario.","por_lado":true,"duracion_seg":25}
   ]'),
  ('Caderas (estar sentado)',
   'Antidoto para horas de silla: flexores, gluteos, aductores y rotacion de cadera.',
   '[
     {"nombre":"Zancada baja (flexor de cadera)","detalle":"Rodilla al piso, gluteo apretado, cadera al frente.","por_lado":true,"duracion_seg":40},
     {"nombre":"Figura 4 tumbado","detalle":"Tobillo sobre rodilla opuesta, jala el muslo al pecho.","por_lado":true,"duracion_seg":40},
     {"nombre":"Sentadilla profunda sostenida","detalle":"Abre rodillas con los codos, pecho arriba, respira.","por_lado":false,"duracion_seg":45},
     {"nombre":"90-90 en el piso","detalle":"Ambas piernas a 90 grados, torso hacia la espinilla delantera.","por_lado":true,"duracion_seg":40},
     {"nombre":"Rana (aductores)","detalle":"Rodillas abiertas en el piso, cadera hacia atras lentamente.","por_lado":false,"duracion_seg":45},
     {"nombre":"Rodillas al pecho","detalle":"Tumbado, abraza ambas rodillas y balancea suave.","por_lado":false,"duracion_seg":30}
   ]'),
  ('Noche para dormir',
   'Ritmo lento y respiracion larga. Ideal en la cama o alfombra, luz baja.',
   '[
     {"nombre":"Respiracion 4-6 tumbado","detalle":"Inhala 4 segundos, exhala 6. Mano en el abdomen.","por_lado":false,"duracion_seg":60},
     {"nombre":"Rodillas al pecho","detalle":"Abraza las rodillas, mece suavemente a los lados.","por_lado":false,"duracion_seg":40},
     {"nombre":"Torsion tumbado","detalle":"Rodillas a un lado, brazos en cruz, mira al lado contrario.","por_lado":true,"duracion_seg":40},
     {"nombre":"Piernas contra la pared","detalle":"Gluteos cerca de la pared, piernas arriba, brazos sueltos.","por_lado":false,"duracion_seg":90},
     {"nombre":"Postura del nino","detalle":"Rodillas abiertas, frente al piso, brazos largos o al costado.","por_lado":false,"duracion_seg":60},
     {"nombre":"Cuello suave tumbado","detalle":"Gira la cabeza lentamente de lado a lado con exhalaciones largas.","por_lado":false,"duracion_seg":40}
   ]')
) AS v(nombre, descripcion, pasos)
WHERE NOT EXISTS (
  SELECT 1 FROM rutinas_estiramiento r WHERE r.nombre = v.nombre
);
