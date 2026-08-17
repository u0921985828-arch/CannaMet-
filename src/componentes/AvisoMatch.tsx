import React from 'react';
import { Modal, Text, View } from 'react-native';

import { Boton } from './Boton';

type Props = {
  nombre: string | null;
  onSeguir: () => void;
  onAbrirChats: () => void;
};

export function AvisoMatch({ nombre, onSeguir, onAbrirChats }: Props) {
  return (
    <Modal visible={!!nombre} transparent animationType="fade" onRequestClose={onSeguir}>
      <View className="flex-1 items-center justify-center bg-base/95 px-gutter">
        <View className="w-full rounded-tarjeta border border-ambarProfundo bg-superficie">
          <View className="h-[3px] bg-ambar" />

          <View className="px-6 py-8">
            <Text className="font-mono text-etiqueta uppercase tracking-[3px] text-ambar">
              Interés mutuo
            </Text>

            <Text className="mt-4 font-display text-display text-tinta">{nombre}</Text>

            <Text className="mt-3 font-sans text-cuerpo text-tinta2">
              También te ha dado al sí. Ya podéis escribiros.
            </Text>

            <View className="mt-8 gap-3">
              <Boton titulo="Abrir el chat" onPress={onAbrirChats} />
              <Boton
                titulo="Seguir viendo perfiles"
                onPress={onSeguir}
                variante="secundario"
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
