import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';

import { Boton } from './Boton';
import { Campo } from './Campo';
import { AvisoError } from './Estados';
import { useModeracion } from '@/hooks/useModeracion';
import { MOTIVOS, type MotivoReporte } from '@/types/modelos';
import { C } from '@/theme/tokens';

const MAX_DETALLE = 1000;

type Props = {
  visible: boolean;
  usuarioId: string;
  nombre: string;
  onCerrar: () => void;
  /** Se llama tras un reporte con bloqueo: la pantalla debe sacar a esa persona. */
  onBloqueado: () => void;
};

export function ModalReporte({ visible, usuarioId, nombre, onCerrar, onBloqueado }: Props) {
  const [motivo, setMotivo] = useState<MotivoReporte | null>(null);
  const [detalle, setDetalle] = useState('');
  const [bloquear, setBloquear] = useState(true);
  const { reportar, ocupado, error, limpiarError } = useModeracion();

  const reiniciar = () => {
    setMotivo(null);
    setDetalle('');
    setBloquear(true);
    limpiarError();
  };

  const cerrar = () => {
    reiniciar();
    onCerrar();
  };

  const enviar = async () => {
    if (!motivo) return;
    const ok = await reportar(usuarioId, motivo, detalle.trim() || null, bloquear);
    if (!ok) return;
    reiniciar();
    if (bloquear) onBloqueado();
    else onCerrar();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={cerrar}>
      <View className="flex-1 justify-end bg-base/95">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View className="max-h-[88%] rounded-t-tarjeta border-t border-borde2 bg-superficie">
            <View className="h-[3px] bg-arcilla" />

            <ScrollView
              contentContainerClassName="px-gutter pb-8 pt-6"
              keyboardShouldPersistTaps="handled"
            >
              <Text className="font-mono text-etiqueta uppercase tracking-[3px] text-arcilla">
                Reportar
              </Text>
              <Text className="mt-3 font-display text-titulo text-tinta">{nombre}</Text>
              <Text className="mb-6 mt-2 font-sans text-dato text-apagado">
                Lo revisa una persona. No se avisa a quien reportas.
              </Text>

              {error ? <AvisoError mensaje={error} /> : null}

              <Text className="mb-3 font-mono text-etiqueta uppercase text-apagado">
                Qué ha pasado
              </Text>

              <View className="mb-6 gap-2">
                {MOTIVOS.map((m) => {
                  const activo = motivo === m.valor;
                  return (
                    <Pressable
                      key={m.valor}
                      onPress={() => setMotivo(m.valor)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: activo }}
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    >
                      <View
                        className={`rounded-pieza border px-4 py-3 ${
                          activo ? 'border-arcilla bg-elevado' : 'border-borde bg-base'
                        }`}
                      >
                        <Text
                          className={`font-sansMedia text-cuerpo ${
                            activo ? 'text-tinta' : 'text-tinta2'
                          }`}
                        >
                          {m.etiqueta}
                        </Text>
                        <Text className="mt-1 font-sans text-dato text-apagado">
                          {m.ayuda}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <Campo
                etiqueta="Detalle (opcional)"
                value={detalle}
                onChangeText={setDetalle}
                placeholder="Qué pasó y cuándo, si quieres concretar."
                multiline
                maxLength={MAX_DETALLE}
                contador={{ actual: detalle.length, maximo: MAX_DETALLE }}
                editable={!ocupado}
                style={{ minHeight: 100, textAlignVertical: 'top' }}
              />

              <View className="mb-6 flex-row items-center justify-between rounded-pieza border border-borde bg-base px-4 py-4">
                <View className="mr-4 flex-1">
                  <Text className="font-sansMedia text-cuerpo text-tinta">
                    Bloquear también
                  </Text>
                  <Text className="mt-1 font-sans text-dato text-apagado">
                    Dejaréis de veros y no podrá escribirte.
                  </Text>
                </View>
                <Switch
                  value={bloquear}
                  onValueChange={setBloquear}
                  disabled={ocupado}
                  trackColor={{ false: C.borde, true: C.ambarProfundo }}
                  thumbColor={bloquear ? C.ambar : C.apagado}
                  accessibilityLabel="Bloquear también"
                />
              </View>

              <Boton
                titulo="Enviar reporte"
                onPress={() => void enviar()}
                cargando={ocupado}
                deshabilitado={!motivo}
              />

              <View className="mt-3">
                <Boton titulo="Cancelar" onPress={cerrar} variante="fantasma" />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
