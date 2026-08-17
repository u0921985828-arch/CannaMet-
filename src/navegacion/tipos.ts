import type { NavigatorScreenParams } from '@react-navigation/native';

export type ParamsTabs = {
  Descubrir: undefined;
  Chats: undefined;
  Perfil: undefined;
  Moderacion: undefined;
};

export type ParamsRaiz = {
  Tabs: NavigatorScreenParams<ParamsTabs>;
  Chat: { matchId: string; nombre: string; otroId: string };
};

declare global {
  namespace ReactNavigation {
    // La interfaz vacía es el modo de ampliación que pide React Navigation.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends ParamsRaiz {}
  }
}
