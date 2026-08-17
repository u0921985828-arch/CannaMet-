import './global.css';

import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
} from '@expo-google-fonts/ibm-plex-mono';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans';
import {
  Spectral_400Regular_Italic,
  Spectral_600SemiBold,
  useFonts,
} from '@expo-google-fonts/spectral';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

import { ProveedorSesion } from '@/contexts/SesionContext';
import { RootNavigator } from '@/navegacion/RootNavigator';

void SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fuentesListas, errorFuentes] = useFonts({
    Spectral_600SemiBold,
    Spectral_400Regular_Italic,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });

  useEffect(() => {
    if (errorFuentes) console.error('[fuentes] no se pudieron cargar', errorFuentes);
  }, [errorFuentes]);

  const alRenderizar = useCallback(() => {
    // Un fallo de fuentes no debe dejar la app en el splash para siempre.
    if (fuentesListas || errorFuentes) void SplashScreen.hideAsync();
  }, [fuentesListas, errorFuentes]);

  if (!fuentesListas && !errorFuentes) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View className="flex-1 bg-base" onLayout={alRenderizar}>
          <StatusBar style="light" backgroundColor="#14110E" />
          <ProveedorSesion>
            <RootNavigator />
          </ProveedorSesion>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
