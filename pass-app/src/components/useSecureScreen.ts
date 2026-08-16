import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { secureScreen } from '../lib/secureScreen';

/**
 * Mantiene FLAG_SECURE activo mientras la pantalla está enfocada (impide
 * capturas y recents). Solo aplica en pantallas sensibles de la bóveda;
 * login/registro/autofill no lo usan para no bloquear autofill externo.
 */
export function useSecureScreen() {
  useFocusEffect(
    useCallback(() => {
      secureScreen(true);
      return () => secureScreen(false);
    }, [])
  );
}
