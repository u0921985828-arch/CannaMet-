import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Boton } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { AvisoError } from '@/componentes/Estados';
import { iniciarSesion, registrarse } from '@/lib/api';
import { mensajeDeError } from '@/lib/supabaseClient';

type Modo = 'entrar' | 'crear';

export function AuthScreen() {
  const [modo, setModo] = useState<Modo>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const validar = (): boolean => {
    if (!email.includes('@')) {
      setError('Escribe un email válido.');
      return false;
    }
    if (password.length < 6) {
      setError('La contraseña necesita 6 caracteres como mínimo.');
      return false;
    }
    return true;
  };

  const enviar = async () => {
    setError(null);
    setAviso(null);
    if (!validar()) return;

    setOcupado(true);
    try {
      if (modo === 'entrar') {
        await iniciarSesion(email.trim(), password);
        // El resto lo hace onAuthStateChange en SesionContext.
      } else {
        const { requiereConfirmacion } = await registrarse(email.trim(), password);
        if (requiereConfirmacion) {
          setAviso(
            'Cuenta creada. Confirma el enlace que te hemos enviado por email y vuelve a entrar.',
          );
          setModo('entrar');
        }
      }
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };

  const cambiarModo = () => {
    setModo((m) => (m === 'entrar' ? 'crear' : 'entrar'));
    setError(null);
    setAviso(null);
  };

  return (
    <SafeAreaView className="flex-1 bg-base" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-gutter py-10"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-12">
            <View className="h-[3px] w-14 bg-ambar" />
            <Text className="mt-6 font-display text-display tracking-tight text-tinta">
              MATCH
            </Text>
            <Text className="mt-2 font-mono text-etiqueta uppercase text-apagado">
              Gente cerca, sin postureo
            </Text>
          </View>

          {error ? <AvisoError mensaje={error} /> : null}

          {aviso ? (
            <View className="mb-4 rounded-pieza border border-ambarProfundo bg-ambarSuave px-4 py-3">
              <Text className="font-sans text-dato text-tinta2">{aviso}</Text>
            </View>
          ) : null}

          <Campo
            etiqueta="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="tu@email.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!ocupado}
          />

          <Campo
            etiqueta="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder="6 caracteres o más"
            secureTextEntry
            autoCapitalize="none"
            textContentType={modo === 'crear' ? 'newPassword' : 'password'}
            editable={!ocupado}
            onSubmitEditing={() => void enviar()}
            returnKeyType="go"
          />

          <View className="mt-2">
            <Boton
              titulo={modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}
              onPress={() => void enviar()}
              cargando={ocupado}
            />
          </View>

          <Pressable
            onPress={cambiarModo}
            disabled={ocupado}
            className="mt-6 self-center py-2"
            accessibilityRole="button"
          >
            <Text className="font-sans text-dato text-apagado">
              {modo === 'entrar' ? '¿Aún no tienes cuenta? ' : '¿Ya tienes cuenta? '}
              <Text className="font-sansFuerte text-ambar">
                {modo === 'entrar' ? 'Créala' : 'Entra'}
              </Text>
            </Text>
          </Pressable>

          <Text className="mt-10 text-center font-mono text-[10px] uppercase leading-4 text-apagado">
            Solo para mayores de 18 años
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
