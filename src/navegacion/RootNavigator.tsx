import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { Text, View } from 'react-native';

import { Cargando } from '@/componentes/Estados';
import { useSesion } from '@/contexts/SesionContext';
import { useAvisos } from '@/hooks/useAvisos';
import { useEsModerador } from '@/hooks/useModeracionPanel';
import { AuthScreen } from '@/pantallas/AuthScreen';
import { ChatScreen } from '@/pantallas/ChatScreen';
import { DescubrirScreen } from '@/pantallas/DescubrirScreen';
import { MatchesScreen } from '@/pantallas/MatchesScreen';
import { ModeracionScreen } from '@/pantallas/ModeracionScreen';
import { ConsentimientoScreen } from '@/pantallas/ConsentimientoScreen';
import { OnboardingScreen } from '@/pantallas/OnboardingScreen';
import { PerfilScreen } from '@/pantallas/PerfilScreen';
import { SuspensionScreen } from '@/pantallas/SuspensionScreen';
import { C, FUENTES } from '@/theme/tokens';
import { refNavegacion } from './ref';
import type { ParamsRaiz, ParamsTabs } from './tipos';

const Tabs = createBottomTabNavigator<ParamsTabs>();
const Stack = createNativeStackNavigator<ParamsRaiz>();

const TEMA: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: C.ambar,
    background: C.base,
    card: C.base,
    text: C.tinta,
    border: C.borde,
    notification: C.ambar,
  },
};

/** Sin librería de iconos: la pestaña activa se marca con una regla ámbar. */
function IconoTab({ etiqueta, activo }: { etiqueta: string; activo: boolean }) {
  return (
    <View className="items-center gap-1.5 pt-1">
      <View className={`h-[2px] w-6 ${activo ? 'bg-ambar' : 'bg-transparent'}`} />
      <Text
        className={`font-mono text-[10px] uppercase tracking-[1.5px] ${
          activo ? 'text-ambar' : 'text-apagado'
        }`}
      >
        {etiqueta}
      </Text>
    </View>
  );
}

function NavegadorTabs() {
  const { esModerador } = useEsModerador();

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: C.base,
          borderTopColor: C.borde,
          borderTopWidth: 1,
          height: 68,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="Descubrir"
        component={DescubrirScreen}
        options={{
          tabBarIcon: ({ focused }) => <IconoTab etiqueta="Ver" activo={focused} />,
          tabBarAccessibilityLabel: 'Descubrir perfiles',
        }}
      />
      <Tabs.Screen
        name="Chats"
        component={MatchesScreen}
        options={{
          tabBarIcon: ({ focused }) => <IconoTab etiqueta="Chats" activo={focused} />,
          tabBarAccessibilityLabel: 'Chats',
        }}
      />
      <Tabs.Screen
        name="Perfil"
        component={PerfilScreen}
        options={{
          tabBarIcon: ({ focused }) => <IconoTab etiqueta="Perfil" activo={focused} />,
          tabBarAccessibilityLabel: 'Tu perfil',
        }}
      />
      {/* La pestaña solo se monta para moderadores. El backend vuelve a
          comprobarlo en cada RPC: esto es comodidad, no seguridad. */}
      {esModerador ? (
        <Tabs.Screen
          name="Moderacion"
          component={ModeracionScreen}
          options={{
            tabBarIcon: ({ focused }) => <IconoTab etiqueta="Mod" activo={focused} />,
            tabBarAccessibilityLabel: 'Panel de moderación',
          }}
        />
      ) : null}
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const {
    cargando,
    sesion,
    perfil,
    necesitaOnboarding,
    necesitaConsentimiento,
    marcarConsentimiento,
  } = useSesion();

  useAvisos();

  const suspendido =
    !!perfil?.suspendido_hasta && new Date(perfil.suspendido_hasta) > new Date();

  if (cargando) return <Cargando texto="MATCH" />;

  return (
    <NavigationContainer theme={TEMA} ref={refNavegacion}>
      {!sesion ? (
        <AuthScreen />
      ) : necesitaConsentimiento ? (
        <ConsentimientoScreen onAceptado={marcarConsentimiento} />
      ) : necesitaOnboarding ? (
        <OnboardingScreen />
      ) : suspendido ? (
        <SuspensionScreen />
      ) : (
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: C.base },
            headerTintColor: C.ambar,
            headerTitleStyle: { fontFamily: FUENTES.display, fontSize: 20, color: C.tinta },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: C.base },
          }}
        >
          <Stack.Screen
            name="Tabs"
            component={NavegadorTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={({ route }) => ({
              title: route.params.nombre,
              headerBackTitle: 'Chats',
            })}
          />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
