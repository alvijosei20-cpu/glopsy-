import { useRef, useCallback } from 'react';
import { Animated } from 'react-native';

export default function useShake() {
  const anim = useRef(new Animated.Value(0)).current;

  const shake = useCallback(() => {
    anim.setValue(0);
    Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0.6, duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -0.6, duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [anim]);

  return {
    shake,
    style: {
      transform: [
        {
          translateX: anim.interpolate({ inputRange: [-1, 1], outputRange: [-12, 12] }),
        },
      ],
    },
  };
}
