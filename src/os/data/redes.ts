import type { RedSocial } from './types';

// DEMO: datos de muestra — conectar a LinkedIn API e Instagram API pendiente
export const redes: RedSocial[] = [
  {
    red: 'linkedin',
    seguidores: 4820,
    alcance_semana: 12400,
    publicaciones_semana: 2,
    tendencia: 'up',
    ultimo_post: 'El error mas comun al usar IA en tu negocio',
  },
  {
    red: 'instagram',
    seguidores: 1340,
    alcance_semana: 2800,
    publicaciones_semana: 1,
    tendencia: 'flat',
    ultimo_post: 'Semana Maker: asi se ve mi Miercoles',
  },
];
