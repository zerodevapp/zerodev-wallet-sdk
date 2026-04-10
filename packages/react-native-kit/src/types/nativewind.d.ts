/**
 * NativeWind type augmentation.
 *
 * Adds the `className` prop to core React Native components so that
 * TypeScript accepts Tailwind class strings on View, Text, Pressable, etc.
 *
 * At runtime the consuming app must have NativeWind configured for
 * className to be transformed into StyleSheet styles.
 */
import 'react-native'

declare module 'react-native' {
  interface ViewProps {
    className?: string
  }
  interface TextProps {
    className?: string
  }
  interface PressableProps {
    className?: string
  }
  interface ImageProps {
    className?: string
  }
  interface ScrollViewProps {
    className?: string
  }
  interface TouchableOpacityProps {
    className?: string
  }
}
