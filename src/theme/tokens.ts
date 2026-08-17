/**
 * Espejo en JS de tailwind.config.js.
 * Necesario para props nativas que no aceptan className:
 * tintColor, placeholderTextColor, barStyle, sombras.
 */
export const C = {
  base: '#14110E',
  superficie: '#1E1A15',
  elevado: '#292219',
  borde: '#3A3128',
  borde2: '#4A3F32',

  tinta: '#F3EDE1',
  tinta2: '#C9BDA8',
  apagado: '#8E836F',

  ambar: '#D99B3C',
  ambarProfundo: '#8A5A18',
  ambarSuave: '#2E2213',

  arcilla: '#B4553F',
  salvia: '#7C8A5E',
} as const;

export const FUENTES = {
  display: 'Spectral_600SemiBold',
  displayItalic: 'Spectral_400Regular_Italic',
  sans: 'IBMPlexSans_400Regular',
  sansMedia: 'IBMPlexSans_500Medium',
  sansFuerte: 'IBMPlexSans_600SemiBold',
  mono: 'IBMPlexMono_400Regular',
  monoMedia: 'IBMPlexMono_500Medium',
} as const;
