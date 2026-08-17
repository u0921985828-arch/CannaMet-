/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Base: tinta de tabaco curado, no negro puro. Menos fatiga en pantalla.
        base: '#14110E',
        superficie: '#1E1A15',
        elevado: '#292219',
        borde: '#3A3128',
        borde2: '#4A3F32',

        // Texto: papel sin blanquear
        tinta: '#F3EDE1',
        tinta2: '#C9BDA8',
        apagado: '#8E836F',

        // Acento: vidrio ambar de tarro de curado
        ambar: '#D99B3C',
        ambarProfundo: '#8A5A18',
        ambarSuave: '#2E2213',

        // Estados
        arcilla: '#B4553F',
        salvia: '#7C8A5E',
      },
      fontFamily: {
        display: ['Spectral_600SemiBold'],
        displayItalic: ['Spectral_400Regular_Italic'],
        sans: ['IBMPlexSans_400Regular'],
        sansMedia: ['IBMPlexSans_500Medium'],
        sansFuerte: ['IBMPlexSans_600SemiBold'],
        mono: ['IBMPlexMono_400Regular'],
        monoMedia: ['IBMPlexMono_500Medium'],
      },
      fontSize: {
        // Escala generosa: la app la usa gente de 20 y de 55
        etiqueta: ['11px', { lineHeight: '14px', letterSpacing: '1.6px' }],
        dato: ['13px', { lineHeight: '18px' }],
        cuerpo: ['16px', { lineHeight: '24px' }],
        cuerpoL: ['18px', { lineHeight: '27px' }],
        titulo: ['26px', { lineHeight: '32px' }],
        display: ['40px', { lineHeight: '44px' }],
      },
      borderRadius: {
        tarjeta: '4px',
        pieza: '10px',
        pastilla: '999px',
      },
      spacing: {
        gutter: '20px',
      },
    },
  },
  plugins: [],
};
