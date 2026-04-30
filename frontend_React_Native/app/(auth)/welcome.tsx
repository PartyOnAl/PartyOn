import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, Image, Dimensions,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'

const { width: SCREEN_W } = Dimensions.get('window')
const BALL_SIZE = Math.min(SCREEN_W * 0.62, 260)

export default function WelcomeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + SPACING.lg }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Brand top-left */}
      <View style={styles.brand}>
        <Text style={styles.brandParty}>Party</Text>
        <Text style={styles.brandOn}>On</Text>
      </View>

      {/* Disco ball hero */}
      <View style={styles.heroWrap}>
        {/* Outer ring — power-button ring */}
        <View style={styles.outerRing}>
          <View style={styles.innerRing}>
            {/* GIF clipped in a circle */}
            <Image
              source={require('../../assets/images/discoball.gif')}
              style={styles.gif}
              resizeMode="cover"
            />
          </View>
        </View>
      </View>

      {/* Tagline */}
      <View style={styles.taglineWrap}>
        <Text style={styles.tagline}>
          Turn the night <Text style={styles.taglineOn}>ON</Text>
        </Text>
      </View>

      {/* Bottom buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.loginBtn}
          onPress={() => router.push('/(auth)/login')}
          activeOpacity={0.85}
        >
          <Text style={styles.loginBtnText}>Log in / Sign up</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.browseBtn}
          onPress={() => router.push('/(tabs)')}
          activeOpacity={0.85}
        >
          <Text style={styles.browseBtnText}>Browse events</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  brand: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  brandParty: {
    color: COLORS.white,
    fontSize: FONT.md,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  brandOn: {
    color: COLORS.purple,
    fontSize: FONT.md,
    fontWeight: '700',
    letterSpacing: -0.3,
  },

  // Disco ball
  heroWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    width: BALL_SIZE + 36,
    height: BALL_SIZE + 36,
    borderRadius: (BALL_SIZE + 36) / 2,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    // Subtle outer glow
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
  },
  innerRing: {
    width: BALL_SIZE + 10,
    height: BALL_SIZE + 10,
    borderRadius: (BALL_SIZE + 10) / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gif: {
    width: BALL_SIZE,
    height: BALL_SIZE,
    borderRadius: BALL_SIZE / 2,
  },

  // Tagline
  taglineWrap: {
    marginBottom: SPACING.xxl,
    alignItems: 'center',
  },
  tagline: {
    color: COLORS.white,
    fontSize: FONT.xxl + 4,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  taglineOn: {
    color: COLORS.purple,
  },

  // Buttons
  actions: {
    width: '100%',
    gap: SPACING.sm,
  },
  loginBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: RADIUS.pill,
    paddingVertical: SPACING.md + 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  loginBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: FONT.base,
  },
  browseBtn: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: RADIUS.pill,
    paddingVertical: SPACING.md + 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  browseBtnText: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    fontSize: FONT.base,
  },
})
