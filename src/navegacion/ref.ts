import { createNavigationContainerRef } from '@react-navigation/native';

import type { ParamsRaiz } from './tipos';

/**
 * Referencia al navegador para poder abrir una pantalla desde fuera de React:
 * al tocar un aviso push no hay ningún componente de por medio.
 */
export const refNavegacion = createNavigationContainerRef<ParamsRaiz>();
