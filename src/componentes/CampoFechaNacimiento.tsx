import React from 'react';
import { Text, TextInput, View } from 'react-native';

import { C } from '@/theme/tokens';

type Props = {
  dia: string;
  mes: string;
  anio: string;
  onCambio: (parte: 'dia' | 'mes' | 'anio', valor: string) => void;
  error?: string;
  editable?: boolean;
};

/**
 * Tres campos numéricos en vez de un date picker nativo: el picker se abre por
 * defecto en la fecha de hoy y obliga a girar 30 años de rueda. Escribir la
 * fecha es más rápido y funciona igual en las dos plataformas.
 */
export function CampoFechaNacimiento({
  dia,
  mes,
  anio,
  onCambio,
  error,
  editable = true,
}: Props) {
  const base =
    'rounded-pieza border bg-superficie px-3 py-4 text-center font-mono text-cuerpoL text-tinta';
  const borde = error ? 'border-arcilla' : 'border-borde';

  return (
    <View className="mb-5">
      <Text className="mb-2 font-mono text-etiqueta uppercase text-apagado">
        Fecha de nacimiento
      </Text>

      <View className="flex-row gap-3">
        <TextInput
          value={dia}
          onChangeText={(t) => onCambio('dia', t.replace(/[^0-9]/g, '').slice(0, 2))}
          placeholder="DD"
          placeholderTextColor={C.apagado}
          selectionColor={C.ambar}
          keyboardType="number-pad"
          maxLength={2}
          editable={editable}
          accessibilityLabel="Día de nacimiento"
          className={`${base} ${borde} flex-[1]`}
        />
        <TextInput
          value={mes}
          onChangeText={(t) => onCambio('mes', t.replace(/[^0-9]/g, '').slice(0, 2))}
          placeholder="MM"
          placeholderTextColor={C.apagado}
          selectionColor={C.ambar}
          keyboardType="number-pad"
          maxLength={2}
          editable={editable}
          accessibilityLabel="Mes de nacimiento"
          className={`${base} ${borde} flex-[1]`}
        />
        <TextInput
          value={anio}
          onChangeText={(t) => onCambio('anio', t.replace(/[^0-9]/g, '').slice(0, 4))}
          placeholder="AAAA"
          placeholderTextColor={C.apagado}
          selectionColor={C.ambar}
          keyboardType="number-pad"
          maxLength={4}
          editable={editable}
          accessibilityLabel="Año de nacimiento"
          className={`${base} ${borde} flex-[1.6]`}
        />
      </View>

      {error ? (
        <Text className="mt-2 font-sans text-dato text-arcilla">{error}</Text>
      ) : (
        <Text className="mt-2 font-sans text-dato text-apagado">
          Solo para comprobar que eres mayor de edad. Se muestra tu edad, no la fecha.
        </Text>
      )}
    </View>
  );
}

/** Valida y normaliza a ISO. Devuelve null si la fecha no sirve. */
export function aIso(dia: string, mes: string, anio: string): string | null {
  const d = Number(dia);
  const m = Number(mes);
  const a = Number(anio);
  if (!d || !m || !a || anio.length !== 4) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;

  const fecha = new Date(Date.UTC(a, m - 1, d));
  // Rechaza 31 de febrero y similares: Date los desborda al mes siguiente.
  if (
    fecha.getUTCFullYear() !== a ||
    fecha.getUTCMonth() !== m - 1 ||
    fecha.getUTCDate() !== d
  ) {
    return null;
  }
  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function edadDe(iso: string): number {
  const nac = new Date(iso);
  const hoy = new Date();
  let edad = hoy.getFullYear() - nac.getFullYear();
  const mes = hoy.getMonth() - nac.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < nac.getDate())) edad -= 1;
  return edad;
}
