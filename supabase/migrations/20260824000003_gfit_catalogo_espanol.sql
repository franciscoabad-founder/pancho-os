-- ============================================================
-- GFIT: nombres e instrucciones en español para los ejercicios
-- que de verdad están en las rutinas.
--
-- Contexto: el catálogo tiene 888 ejercicios importados de
-- free-exercise-db, en inglés. De esos, solo 33 están usados en
-- rutinas reales (gfit_dia_ejercicios) y apenas 2 tenían pasos en
-- español. El OS es español por defecto, así que leer "Stiff-Legged
-- Dumbbell Deadlift" a media serie no sirve.
--
-- Por qué escritos a mano y no importados: se evaluó el dataset MIT
-- hasaneyldrm/exercises-dataset (1.324 ejercicios con español). Solo
-- 9 de los 33 calzaban con confianza, y varios de esos "calces" eran
-- en realidad variantes distintas (incline dumbbell press contra
-- incline hammer press). Instrucciones del ejercicio equivocado son
-- peores que instrucciones en inglés, así que se descartó el cruce
-- automático. El dataset sigue siendo buena opción si algún día se
-- quiere reemplazar el catálogo completo, no para parchar este.
--
-- Idempotente: se puede correr varias veces sin duplicar.
-- ============================================================

BEGIN;

-- Sube nombre e instrucciones en español por slug. Solo toca las
-- filas que existen; un slug ausente no rompe la migración.
CREATE TEMP TABLE _es (
  slug text PRIMARY KEY,
  nombre_es text NOT NULL,
  pasos text[] NOT NULL
) ON COMMIT DROP;

INSERT INTO _es (slug, nombre_es, pasos) VALUES

('barbell-guillotine-bench-press', 'Press de banca guillotina con barra', ARRAY[
  'Acuéstate en el banco plano con los pies firmes en el suelo y toma la barra un poco más ancho que los hombros.',
  'Baja la barra de forma controlada hacia la parte alta del pecho, casi a la altura del cuello, con los codos abiertos.',
  'Detente justo antes de tocar y empuja la barra hacia arriba hasta estirar los brazos.',
  'Usa peso bajo: esta variante estresa mucho el hombro y no perdona el descuido.']),

('bench-dips', 'Fondos en banco', ARRAY[
  'Siéntate al borde de un banco y apoya las manos a los costados de la cadera, con los dedos hacia adelante.',
  'Desliza la cadera hacia afuera del banco y estira las piernas al frente, con los talones apoyados.',
  'Baja el cuerpo doblando los codos hacia atrás hasta que formen unos 90 grados.',
  'Empuja con los tríceps hasta volver arriba, sin bloquear los codos de golpe.']),

('bodyweight-hip-thrust', 'Empuje de cadera sin peso', ARRAY[
  'Apoya la parte alta de la espalda en un banco, con los pies planos en el suelo y las rodillas dobladas.',
  'Aprieta los glúteos y sube la cadera hasta que el tronco y los muslos queden en línea recta.',
  'Mantén arriba un segundo sin arquear la espalda baja.',
  'Baja la cadera despacio hasta casi tocar el suelo y repite.']),

('bodyweight-squat', 'Sentadilla sin peso', ARRAY[
  'Párate con los pies al ancho de los hombros y las puntas ligeramente hacia afuera.',
  'Baja llevando la cadera atrás y abajo, como si te sentaras en una silla, con el pecho arriba.',
  'Desciende hasta que los muslos queden paralelos al suelo o hasta donde tu movilidad lo permita sin perder la espalda recta.',
  'Empuja con los talones para volver a subir y aprieta los glúteos al final.']),

('bulgarian-split-squat', 'Sentadilla búlgara', ARRAY[
  'Párate de espaldas a un banco y apoya el empeine del pie de atrás sobre él.',
  'Adelanta el pie de apoyo lo suficiente para que la rodilla no se pase de la punta al bajar.',
  'Baja doblando la rodilla delantera hasta que el muslo quede casi paralelo al suelo.',
  'Empuja con el talón delantero para subir. Completa todas las repeticiones antes de cambiar de pierna.']),

('burpees', 'Burpees', ARRAY[
  'Parte de pie, con los pies al ancho de los hombros.',
  'Baja a cuclillas, apoya las manos en el suelo y lanza los pies hacia atrás hasta quedar en plancha.',
  'Haz una flexión completa si tu nivel lo permite, o baja el pecho al suelo.',
  'Regresa los pies bajo el cuerpo de un salto y termina con un salto vertical con los brazos arriba.']),

('c-rculos-de-brazos', 'Círculos de brazos', ARRAY[
  'Párate derecho con los brazos extendidos a los lados, a la altura de los hombros.',
  'Haz círculos pequeños hacia adelante, controlando el movimiento desde el hombro y no desde la muñeca.',
  'Aumenta el diámetro de los círculos poco a poco.',
  'Invierte el sentido y repite hacia atrás la misma cantidad de tiempo.']),

('dead-bug', 'Bicho muerto', ARRAY[
  'Acuéstate boca arriba con los brazos estirados hacia el techo y las rodillas dobladas a 90 grados.',
  'Aplana la espalda baja contra el suelo y mantenla así todo el ejercicio.',
  'Estira despacio la pierna derecha y el brazo izquierdo hasta casi tocar el suelo.',
  'Regresa al centro sin perder la posición de la espalda y alterna al otro lado.']),

('dumbbell-bicep-curl', 'Curl de bíceps con mancuernas', ARRAY[
  'Párate con una mancuerna en cada mano, brazos estirados y palmas hacia adelante.',
  'Sube el peso doblando el codo, sin mover el hombro ni balancear el tronco.',
  'Aprieta el bíceps arriba durante un instante.',
  'Baja de forma controlada hasta estirar el brazo por completo.']),

('dumbbell-floor-press', 'Press de pecho en el suelo con mancuernas', ARRAY[
  'Acuéstate boca arriba en el suelo con las rodillas dobladas y una mancuerna en cada mano.',
  'Parte con los brazos estirados sobre el pecho y las palmas hacia los pies.',
  'Baja hasta que los tríceps toquen el suelo, con los codos a unos 45 grados del tronco.',
  'Haz una pausa breve en el suelo y empuja hacia arriba hasta estirar los brazos.']),

('dumbbell-flyes', 'Aperturas con mancuernas', ARRAY[
  'Acuéstate en un banco plano con una mancuerna en cada mano, brazos extendidos sobre el pecho.',
  'Mantén un codo ligeramente doblado y fijo durante todo el movimiento.',
  'Abre los brazos en arco hacia los lados hasta sentir el estiramiento en el pecho.',
  'Cierra el arco juntando las mancuernas arriba, sin chocarlas.']),

('dumbbell-lunges', 'Zancadas con mancuernas', ARRAY[
  'Párate derecho con una mancuerna en cada mano, brazos a los costados.',
  'Da un paso largo al frente y baja la cadera hasta que ambas rodillas queden a 90 grados.',
  'La rodilla de atrás baja hasta casi rozar el suelo, sin apoyarla.',
  'Empuja con el talón delantero para volver de pie y alterna la pierna.']),

('dumbbell-shoulder-press', 'Press de hombros con mancuernas', ARRAY[
  'Sentado o de pie, sube las mancuernas a la altura de los hombros con las palmas hacia adelante.',
  'Aprieta el abdomen para no arquear la espalda baja.',
  'Empuja las mancuernas hacia arriba hasta estirar los brazos, sin chocarlas.',
  'Baja de forma controlada hasta la altura de las orejas y repite.']),

('estiramiento-cu-driceps', 'Estiramiento de cuádriceps', ARRAY[
  'Párate derecho y apóyate en una pared si necesitas equilibrio.',
  'Dobla una rodilla y toma el tobillo con la mano del mismo lado.',
  'Lleva el talón hacia el glúteo manteniendo las rodillas juntas y la cadera al frente.',
  'Sostén de 20 a 30 segundos y cambia de pierna.']),

('estiramiento-isquiotibiales', 'Estiramiento de isquiotibiales', ARRAY[
  'Sentado en el suelo, estira una pierna al frente y dobla la otra hacia adentro.',
  'Mantén la espalda recta y lleva el pecho hacia la rodilla de la pierna estirada.',
  'Baja hasta sentir tensión en la parte de atrás del muslo, sin rebotar.',
  'Sostén de 20 a 30 segundos y cambia de pierna.']),

('estiramiento-pecho', 'Estiramiento de pecho', ARRAY[
  'Párate junto a una pared o el marco de una puerta.',
  'Apoya el antebrazo en la superficie con el codo a la altura del hombro.',
  'Gira el tronco despacio en dirección contraria hasta sentir el estiramiento en el pecho.',
  'Sostén de 20 a 30 segundos y cambia de lado.']),

('goblet-squat', 'Sentadilla goblet', ARRAY[
  'Sostén una mancuerna o pesa rusa con ambas manos a la altura del pecho, pegada al cuerpo.',
  'Párate con los pies un poco más abiertos que los hombros.',
  'Baja manteniendo el pecho arriba y los codos por dentro de las rodillas.',
  'Empuja con los talones para subir y mantén el peso pegado al pecho todo el tiempo.']),

('hammer-curls', 'Curl martillo', ARRAY[
  'Párate con una mancuerna en cada mano y las palmas mirándose entre sí.',
  'Sube el peso doblando el codo, sin girar la muñeca: el agarre se mantiene neutro.',
  'Detente cuando la mancuerna llegue a la altura del hombro.',
  'Baja despacio hasta estirar el brazo por completo.']),

('incline-dumbbell-press', 'Press inclinado con mancuernas', ARRAY[
  'Ajusta el banco entre 30 y 45 grados y siéntate con una mancuerna en cada mano.',
  'Sube las mancuernas a la altura del pecho con las palmas hacia adelante.',
  'Empuja hacia arriba hasta estirar los brazos, llevando las mancuernas ligeramente hacia el centro.',
  'Baja de forma controlada hasta sentir el estiramiento en la parte alta del pecho.']),

('inverted-row', 'Remo invertido', ARRAY[
  'Coloca una barra a la altura de la cadera y acuéstate debajo de ella.',
  'Toma la barra un poco más ancho que los hombros y estira el cuerpo en línea recta desde los talones.',
  'Jala el pecho hacia la barra apretando las escápulas.',
  'Baja de forma controlada hasta estirar los brazos sin dejar caer la cadera.']),

('jumping-jacks', 'Saltos de tijera', ARRAY[
  'Párate derecho con los pies juntos y los brazos a los costados.',
  'Salta abriendo las piernas al ancho de los hombros mientras subes los brazos sobre la cabeza.',
  'Salta de nuevo para volver a la posición inicial.',
  'Mantén un ritmo constante y aterriza con las rodillas suaves.']),

('kettlebell-one-legged-deadlift', 'Peso muerto a una pierna con pesa rusa', ARRAY[
  'Sostén una pesa rusa en una mano y párate sobre la pierna contraria.',
  'Con la rodilla de apoyo ligeramente doblada, inclina el tronco al frente llevando la pierna libre hacia atrás.',
  'Baja la pesa cerca de la pierna hasta sentir el estiramiento en el isquiotibial, con la espalda recta.',
  'Sube apretando el glúteo hasta quedar erguido. Completa el lado antes de cambiar.']),

('one-arm-dumbbell-row', 'Remo a una mano con mancuerna', ARRAY[
  'Apoya una rodilla y la mano del mismo lado en un banco, con la espalda plana y paralela al suelo.',
  'Sostén la mancuerna con el brazo libre, colgando y estirado.',
  'Jala la mancuerna hacia la cadera pegando el codo al cuerpo y apretando la escápula.',
  'Baja de forma controlada hasta estirar el brazo. Completa el lado antes de cambiar.']),

('plank', 'Plancha', ARRAY[
  'Apoya los antebrazos en el suelo con los codos justo debajo de los hombros.',
  'Estira las piernas atrás y apóyate en las puntas de los pies.',
  'Alinea cabeza, espalda y cadera en una sola línea, sin subir ni hundir la cadera.',
  'Aprieta abdomen y glúteos y sostén el tiempo objetivo respirando normal.']),

('pullups', 'Dominadas', ARRAY[
  'Cuélgate de la barra con las palmas hacia adelante, manos un poco más anchas que los hombros.',
  'Parte con los brazos estirados y el cuerpo firme, sin balanceo.',
  'Jala hasta pasar la barbilla sobre la barra, llevando los codos hacia abajo y atrás.',
  'Baja de forma controlada hasta estirar los brazos por completo.']),

('pushups', 'Flexiones', ARRAY[
  'Apoya las manos en el suelo un poco más anchas que los hombros, cuerpo en línea recta.',
  'Aprieta abdomen y glúteos para no hundir la cadera.',
  'Baja el pecho hasta casi tocar el suelo, con los codos a unos 45 grados del tronco.',
  'Empuja hasta estirar los brazos sin bloquear los codos de golpe.']),

('reverse-flyes', 'Aperturas invertidas', ARRAY[
  'Con una mancuerna en cada mano, inclina el tronco al frente con la espalda recta.',
  'Deja los brazos colgando con un codo ligeramente doblado y las palmas mirándose.',
  'Abre los brazos hacia los lados apretando las escápulas, sin encoger los hombros.',
  'Baja despacio hasta la posición inicial.']),

('sentadillas-lentas', 'Sentadillas lentas', ARRAY[
  'Párate con los pies al ancho de los hombros y los brazos al frente para equilibrio.',
  'Baja contando cuatro segundos, llevando la cadera atrás y manteniendo el pecho arriba.',
  'Detente un segundo abajo, con los muslos cerca del paralelo.',
  'Sube contando dos segundos. El control es el objetivo, no la cantidad.']),

('side-lateral-raise', 'Elevaciones laterales', ARRAY[
  'Párate con una mancuerna en cada mano a los costados y los codos ligeramente doblados.',
  'Sube los brazos hacia los lados hasta la altura de los hombros, no más.',
  'Guía el movimiento con los codos, no con las manos, y no encojas los hombros.',
  'Baja de forma controlada resistiendo el peso.']),

('single-leg-glute-bridge', 'Puente de glúteo a una pierna', ARRAY[
  'Acuéstate boca arriba con las rodillas dobladas y los pies planos en el suelo.',
  'Estira una pierna hacia arriba manteniendo los muslos alineados.',
  'Empuja con el talón de la pierna apoyada y sube la cadera apretando el glúteo.',
  'Baja despacio sin tocar el suelo y repite. Completa el lado antes de cambiar.']),

('standing-dumbbell-calf-raise', 'Elevación de talones de pie con mancuernas', ARRAY[
  'Párate derecho con una mancuerna en cada mano, brazos a los costados.',
  'Si tienes un escalón, apoya la punta de los pies dejando los talones al aire.',
  'Sube sobre las puntas lo más alto que puedas y aprieta el gemelo un segundo.',
  'Baja despacio hasta sentir el estiramiento y repite.']),

('standing-dumbbell-triceps-extension', 'Extensión de tríceps de pie con mancuerna', ARRAY[
  'Sostén una mancuerna con ambas manos y súbela sobre la cabeza con los brazos estirados.',
  'Mantén los codos apuntando al frente y pegados a la cabeza.',
  'Baja la mancuerna por detrás de la nuca doblando solo los codos.',
  'Estira los brazos apretando el tríceps, sin abrir los codos hacia los lados.']),

('stiff-legged-dumbbell-deadlift', 'Peso muerto piernas rígidas con mancuernas', ARRAY[
  'Párate con una mancuerna en cada mano al frente de los muslos, pies al ancho de la cadera.',
  'Con las rodillas casi estiradas pero no bloqueadas, lleva la cadera atrás e inclina el tronco.',
  'Baja las mancuernas cerca de las piernas hasta sentir el estiramiento en los isquiotibiales.',
  'Sube empujando la cadera al frente y apretando los glúteos, con la espalda siempre recta.']);

UPDATE ejercicios_catalogo c
SET nombre_es = e.nombre_es,
    instrucciones_es = e.pasos
FROM _es e
WHERE c.slug = e.slug;

COMMIT;
