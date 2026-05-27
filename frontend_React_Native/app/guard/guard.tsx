import { type ComponentType, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Animated,
  Easing,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { CameraView, scanFromURLAsync, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ImageUp,
  ListChecks,
  QrCode,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react-native'
import { API_BASE } from '@/lib/apiBase'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'
import { useAuth } from '@/lib/AuthContext'

type ScanMode = 'camera' | 'photo' | 'queue'
type ScanState = 'idle' | 'checking' | 'valid' | 'warning'
type ScanFeedback = {
  title: string
  detail: string
  code?: string
}

const YELLOW = '#f5c518'

const queue = [
  { id: 'A-1048', name: 'Maya Chen', pass: 'VIP Table', time: '22:14', status: 'ready' },
  { id: 'B-2210', name: 'Jonas Keller', pass: 'General Entry', time: '22:18', status: 'ready' },
  { id: 'C-7719', name: 'Rina Sol', pass: 'Guest List', time: '22:21', status: 'hold' },
]

const metrics = [
  { label: 'Checked in', value: '186', accent: COLORS.green },
  { label: 'In queue', value: '24', accent: YELLOW },
  { label: 'Flagged', value: '3', accent: COLORS.red },
]

const FEEDBACK_TONE = {
  checking: {
    accent: YELLOW,
    glow: 'rgba(245,197,24,0.16)',
    surface: 'rgba(245,197,24,0.14)',
    ring: 'rgba(253,224,71,0.9)',
  },
  valid: {
    accent: COLORS.green,
    glow: 'rgba(16,185,129,0.22)',
    surface: 'rgba(16,185,129,0.18)',
    ring: 'rgba(110,231,183,0.95)',
  },
  warning: {
    accent: COLORS.red,
    glow: 'rgba(239,68,68,0.22)',
    surface: 'rgba(239,68,68,0.18)',
    ring: 'rgba(251,113,133,0.95)',
  },
} as const

export default function GuardScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const [permission, requestPermission] = useCameraPermissions()
  const [mode, setMode] = useState<ScanMode>('camera')
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [scannerActive, setScannerActive] = useState(false)
  const [scanFeedback, setScanFeedback] = useState<ScanFeedback | null>(null)
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [photoScanning, setPhotoScanning] = useState(false)
  const scanLock = useRef(false)
  const cameraReveal = useRef(new Animated.Value(0)).current
  const photoReveal = useRef(new Animated.Value(0)).current
  const resultReveal = useRef(new Animated.Value(0)).current
  const resultBurst = useRef(new Animated.Value(0)).current
  const resultShake = useRef(new Animated.Value(0)).current
  const feedbackAnimation = useRef<Animated.CompositeAnimation | null>(null)

  useEffect(() => {
    Animated.timing(cameraReveal, {
      toValue: scannerActive ? 1 : 0,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [cameraReveal, scannerActive])

  useEffect(() => {
    Animated.timing(photoReveal, {
      toValue: mode === 'photo' ? 1 : 0,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [mode, photoReveal])

  useEffect(() => {
    feedbackAnimation.current?.stop()

    if (scanState === 'idle') {
      resultReveal.setValue(0)
      resultBurst.setValue(0)
      resultShake.setValue(0)
      return
    }

    resultReveal.setValue(0)
    resultBurst.setValue(0)
    resultShake.setValue(0)

    const entrance = Animated.spring(resultReveal, {
      toValue: 1,
      tension: scanState === 'warning' ? 98 : 88,
      friction: 7,
      useNativeDriver: true,
    })

    if (scanState === 'valid') {
      feedbackAnimation.current = Animated.parallel([
        entrance,
        Animated.sequence([
          Animated.timing(resultBurst, {
            toValue: 1,
            duration: 560,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(resultBurst, {
            toValue: 0,
            duration: 230,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ])
    } else if (scanState === 'warning') {
      feedbackAnimation.current = Animated.parallel([
        entrance,
        Animated.sequence([
          Animated.timing(resultBurst, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(resultBurst, {
            toValue: 0,
            duration: 200,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(resultShake, { toValue: -1, duration: 46, useNativeDriver: true }),
          Animated.timing(resultShake, { toValue: 1, duration: 90, useNativeDriver: true }),
          Animated.timing(resultShake, { toValue: -0.72, duration: 74, useNativeDriver: true }),
          Animated.timing(resultShake, { toValue: 0.48, duration: 62, useNativeDriver: true }),
          Animated.timing(resultShake, { toValue: 0, duration: 54, useNativeDriver: true }),
        ]),
      ])
    } else {
      feedbackAnimation.current = entrance
    }

    feedbackAnimation.current.start()

    return () => {
      feedbackAnimation.current?.stop()
    }
  }, [resultBurst, resultReveal, resultShake, scanState])

  const status = useMemo(() => {
    if (photoScanning) {
      return {
        icon: ImageUp,
        title: scanFeedback?.title ?? 'Reading photo QR',
        detail: scanFeedback?.detail ?? 'Checking the uploaded ticket image',
        color: YELLOW,
        bg: 'rgba(245,197,24,0.12)',
      }
    }
    if (mode === 'photo' && photoUri && scanState === 'idle') {
      return {
        icon: ImageUp,
        title: 'Photo loaded',
        detail: 'Ready to read QR from image',
        color: COLORS.pink,
        bg: 'rgba(236,72,153,0.12)',
      }
    }
    if (mode === 'photo' && scanState === 'idle') {
      return {
        icon: ImageUp,
        title: 'Upload QR photo',
        detail: 'Choose a saved ticket screenshot',
        color: COLORS.pink,
        bg: 'rgba(236,72,153,0.12)',
      }
    }
    if (scannerActive) {
      return {
        icon: Camera,
        title: 'Live camera active',
        detail: 'Align the ticket QR inside the frame',
        color: YELLOW,
        bg: 'rgba(245,197,24,0.12)',
      }
    }
    if (scanState === 'checking') {
      return {
        icon: ShieldCheck,
        title: scanFeedback?.title ?? 'Checking QR',
        detail: scanFeedback?.detail ?? 'Validating ticket against the event gate rules.',
        color: YELLOW,
        bg: 'rgba(245,197,24,0.12)',
      }
    }
    if (scanState === 'valid') {
      return {
        icon: CheckCircle2,
        title: scanFeedback?.title ?? (mode === 'photo' ? 'Photo QR verified' : 'Ticket verified'),
        detail: scanFeedback?.detail ?? (mode === 'photo' ? 'QR code decoded from upload' : 'Ticket is valid for entry'),
        color: COLORS.green,
        bg: 'rgba(16,185,129,0.12)',
      }
    }
    if (scanState === 'warning') {
      return {
        icon: XCircle,
        title: scanFeedback?.title ?? 'Needs review',
        detail: scanFeedback?.detail ?? 'Ticket could not be verified',
        color: COLORS.red,
        bg: 'rgba(239,68,68,0.12)',
      }
    }
    return {
      icon: ShieldCheck,
      title: 'Ready to scan',
      detail: 'Door access console',
      color: YELLOW,
      bg: 'rgba(245,197,24,0.12)',
    }
  }, [mode, photoScanning, photoUri, scanFeedback, scanState, scannerActive])

  const StatusIcon = status.icon
  const cameraOpacity = cameraReveal
  const cameraScale = cameraReveal.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] })
  const frameScale = cameraReveal.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] })
  const photoOpacity = photoReveal
  const photoScale = photoReveal.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] })
  const feedbackTone =
    scanState === 'valid'
      ? FEEDBACK_TONE.valid
      : scanState === 'warning'
        ? FEEDBACK_TONE.warning
        : FEEDBACK_TONE.checking
  const resultBoardOpacity = resultReveal.interpolate({ inputRange: [0, 1], outputRange: [0, 1] })
  const resultBoardScale = resultReveal.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] })
  const resultBoardTranslateY = resultReveal.interpolate({ inputRange: [0, 1], outputRange: [24, 0] })
  const resultBoardShakeX = resultShake.interpolate({ inputRange: [-1, 0, 1], outputRange: [-14, 0, 14] })
  const resultIconRevealScale = resultReveal.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] })
  const resultIconBurstScale = resultBurst.interpolate({ inputRange: [0, 0.55, 1], outputRange: [1, 1.22, 1.08] })
  const resultHaloScale = resultBurst.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.85] })
  const resultHaloOpacity = resultBurst.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0, 0.88, 0] })
  const resultHaloScaleSecondary = resultBurst.interpolate({ inputRange: [0, 1], outputRange: [0.88, 2.3] })
  const resultHaloOpacitySecondary = resultBurst.interpolate({ inputRange: [0, 0.28, 1], outputRange: [0, 0.52, 0] })
  const resultToneOpacity = resultBurst.interpolate({ inputRange: [0, 0.22, 1], outputRange: [0.12, 0.4, 0.16] })

  async function handlePrimaryScan() {
    setMode('camera')
    setScanState('checking')
    setScanFeedback(null)
    scanLock.current = false

    if (!permission?.granted) {
      const response = await requestPermission()
      if (!response.granted) {
        Alert.alert('Camera permission needed', 'Allow camera access to scan QR codes at the door.')
        return
      }
    }

    setScannerActive(true)
  }

  function enterPhotoMode() {
    setMode('photo')
    setScanState('idle')
    setScanFeedback(null)
    setScannerActive(false)
    scanLock.current = false
  }

  async function handlePhotoUpload() {
    enterPhotoMode()

    let permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo access to scan QR codes from saved ticket screenshots.')
      permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    })

    if (result.canceled || !result.assets[0]?.uri) return

    const uri = result.assets[0].uri
    setPhotoUri(uri)
    setPhotoScanning(true)
    setScanState('checking')
    setScanFeedback({
      title: 'Reading photo QR',
      detail: 'Scanning the uploaded ticket image.',
    })

    try {
      const scanned = await scanFromURLAsync(uri, ['qr'])
      const data = scanned[0]?.data
      if (!data) {
        setScanState('warning')
        setScanFeedback({
          title: 'No QR found',
          detail: 'Use a clearer ticket screenshot with the full QR code visible.',
        })
        Alert.alert('No QR found', 'Try a clearer ticket screenshot with the QR code visible.')
        return
      }

      setScanFeedback({
        title: 'QR found',
        detail: 'Validating ticket against the event gate rules.',
        code: data,
      })
      await validateTicketQr(data)
    } catch {
      setScanState('warning')
      setScanFeedback({
        title: 'Could not read photo',
        detail: 'Try another image where the QR is sharp, bright, and fully visible.',
      })
      Alert.alert('Could not read photo', 'Try another image where the QR code is bright, sharp, and fully visible.')
    } finally {
      setPhotoScanning(false)
    }
  }

  function handleQueueScan() {
    setMode('queue')
    setScanState('idle')
    setScanFeedback(null)
    setScannerActive(false)
    scanLock.current = false
  }

  function toMinutes(time: string) {
    const [h, m] = time.split(':').map(Number)
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
  }

  function parseGateQr(qrText: string): { source: string | null; id: string } {
    const t = qrText.trim()
    const idx = t.indexOf(':')
    if (idx === -1) return { source: null, id: t }
    const rawSource = t.slice(0, idx).trim().toLowerCase()
    const id = t.slice(idx + 1).trim()
    return { source: rawSource.length ? rawSource : null, id }
  }

  function isReservationSource(source: string | null): boolean {
    if (!source) return false
    return (
      source === 'reservation' ||
      source === 'reseravtion' ||
      source === 'rservation'
    )
  }

  function resolveEventEndDate(startingIso: string, endingIso: string | null | undefined): Date {
    const start = new Date(startingIso)
    if (endingIso) {
      const e = new Date(endingIso)
      if (!Number.isNaN(e.getTime())) return e
    }
    return new Date(start.getTime() + 24 * 60 * 60 * 1000)
  }

  function parseHoursRange(raw: string | null | undefined): { startStr: string; endStr: string } {
    const h = (raw ?? '00:00-23:59').trim()
    const idx = h.indexOf('-')
    if (idx === -1) return { startStr: '00:00', endStr: '23:59' }
    return { startStr: h.slice(0, idx).trim(), endStr: h.slice(idx + 1).trim() }
  }

  function isWithinEventHours(now: number, start: number, end: number) {
    // normal case (e.g. 10:00 - 18:00)
    if (start <= end) {
      return now >= start && now <= end
    }

    // overnight case (e.g. 22:00 - 07:00)
    return now >= start || now <= end
  }

  function showValidationResult(state: Exclude<ScanState, 'idle' | 'checking'>, feedback: ScanFeedback) {
    setScanState(state)
    setScanFeedback(feedback)
  }

  async function validateTicketQr(data: string) {
    const trimmed = data.trim()
    const { source, id } = parseGateQr(trimmed)
    const displayCode = trimmed

    setScanFeedback({
      title: 'Checking QR',
      detail: 'Validating against the event gate rules.',
      code: displayCode,
    })

    if (!id) {
      showValidationResult('warning', {
        title: 'Invalid QR',
        detail: 'This QR code does not contain a valid entry id.',
        code: displayCode,
      })
      return
    }

    if (isReservationSource(source)) {
      await validateReservationGate(id, displayCode)
      return
    }

    // Paid tickets: legacy bare payment id (no ":" → source null), or e.g. `tickets:<payment_id>`.
    await validatePaymentTicket(id, displayCode)
  }

  async function validatePaymentTicket(ticketId: string, displayCode: string) {
    try {
      const res = await fetch(`${API_BASE}/payment/${ticketId}`)
      let result: Record<string, unknown> | null = null
      try {
        result = (await res.json()) as Record<string, unknown>
      } catch {
        result = null
      }

      if (!res.ok || !result) {
        showValidationResult('warning', {
          title: 'Ticket not found',
          detail: 'The scanned QR did not match a known ticket.',
          code: displayCode,
        })
        return
      }

      if (String(result.status) !== 'completed') {
        showValidationResult('warning', {
          title: 'Payment incomplete',
          detail: 'This ticket has not been paid or confirmed.',
          code: displayCode,
        })
        return
      }

      if (Number(result.times_used) !== 0) {
        showValidationResult('warning', {
          title: 'Already used',
          detail: 'This QR code has already been checked in.',
          code: displayCode,
        })
        return
      }

      const startDate = new Date(String(result.event_starting_date))
      const endDate = resolveEventEndDate(
        String(result.event_starting_date),
        result.event_ending_date != null ? String(result.event_ending_date) : null,
      )
      const nowDate = new Date()
      if (!(startDate < nowDate && endDate > nowDate)) {
        showValidationResult('warning', {
          title: 'Event not active',
          detail: 'This ticket is not valid for entry at the current date.',
          code: displayCode,
        })
        return
      }

      const { startStr, endStr } = parseHoursRange(
        result.event_hours != null ? String(result.event_hours) : null,
      )
      const nows = new Date()
      const currentTime = `${String(nows.getHours()).padStart(2, '0')}:${String(
        nows.getMinutes(),
      ).padStart(2, '0')}`
      const start = toMinutes(startStr)
      const end = toMinutes(endStr)
      const now = toMinutes(currentTime)

      if (!isWithinEventHours(now, start, end)) {
        showValidationResult('warning', {
          title: 'Outside event hours',
          detail: `Entry is only active during ${result.event_hours ?? 'event hours'}.`,
          code: displayCode,
        })
        return
      }

      showValidationResult('valid', {
        title: 'Ticket verified',
        detail: 'Payment complete, unused ticket, and event time is active.',
        code: displayCode,
      })

      const patchRes = await fetch(`${API_BASE}/payment/ticket-uses/${ticketId}`, {
        method: 'PATCH',
      })
      let patchBody: Record<string, unknown> | null = null
      try {
        patchBody = (await patchRes.json()) as Record<string, unknown>
      } catch {
        patchBody = null
      }
      if (!patchRes.ok || !patchBody) {
        showValidationResult('warning', {
          title: 'Ticket could not be updated',
          detail: 'The ticket was not marked as checked in on the server.',
          code: displayCode,
        })
      }
    } catch {
      showValidationResult('warning', {
        title: 'Verification failed',
        detail: 'Could not validate this QR. Check network/backend and scan again.',
        code: displayCode,
      })
    }
  }

  async function validateReservationGate(reservationId: string, displayCode: string) {
    try {
      const res = await fetch(`${API_BASE}/payment/reservation/${reservationId}`)
      let result: Record<string, unknown> | null = null
      try {
        result = (await res.json()) as Record<string, unknown>
      } catch {
        result = null
      }

      if (!res.ok || !result) {
        showValidationResult('warning', {
          title: 'Reservation not found',
          detail: 'The scanned QR did not match a known reservation.',
          code: displayCode,
        })
        return
      }

      const st = String(result.status ?? '')
        .toLowerCase()
        .trim()

      const alreadyDone = ['completed', 'arrived', 'checked_in', 'checked-in', 'used', 'seated'].includes(
        st,
      )
      if (alreadyDone) {
        showValidationResult('warning', {
          title: 'Already checked in',
          detail:
            st === 'completed'
              ? 'This reservation has already been completed at the door.'
              : 'This reservation QR has already been used at the door.',
          code: displayCode,
        })
        return
      }

      if (!['confirmed', 'pending'].includes(st)) {
        showValidationResult('warning', {
          title: 'Reservation not valid',
          detail: 'This reservation is not active for entry.',
          code: displayCode,
        })
        return
      }

      const startDate = new Date(String(result.event_starting_date))
      const endDate = resolveEventEndDate(
        String(result.event_starting_date),
        result.event_ending_date != null ? String(result.event_ending_date) : null,
      )
      const nowDate = new Date()
      if (!(startDate < nowDate && endDate > nowDate)) {
        showValidationResult('warning', {
          title: 'Event not active',
          detail: 'This reservation is not valid for entry at the current date.',
          code: displayCode,
        })
        return
      }

      const { startStr, endStr } = parseHoursRange(
        result.event_hours != null ? String(result.event_hours) : null,
      )
      const nows = new Date()
      const currentTime = `${String(nows.getHours()).padStart(2, '0')}:${String(
        nows.getMinutes(),
      ).padStart(2, '0')}`
      const start = toMinutes(startStr)
      const end = toMinutes(endStr)
      const now = toMinutes(currentTime)

      if (!isWithinEventHours(now, start, end)) {
        showValidationResult('warning', {
          title: 'Outside event hours',
          detail: `Entry is only active during ${result.event_hours ?? 'event hours'}.`,
          code: displayCode,
        })
        return
      }

      showValidationResult('valid', {
        title: 'Reservation verified',
        detail: 'Reservation is active, and event time allows entry.',
        code: displayCode,
      })

      const patchRes = await fetch(
        `${API_BASE}/payment/reservation/${reservationId}/check-in`,
        { method: 'PATCH' },
      )
      let patchBody: Record<string, unknown> | null = null
      try {
        patchBody = (await patchRes.json()) as Record<string, unknown>
      } catch {
        patchBody = null
      }
      if (!patchRes.ok || !patchBody) {
        showValidationResult('warning', {
          title: 'Check-in failed',
          detail: 'The reservation was not marked as completed on the server.',
          code: displayCode,
        })
      }
    } catch {
      showValidationResult('warning', {
        title: 'Verification failed',
        detail: 'Could not validate this QR. Check network/backend and scan again.',
        code: displayCode,
      })
    }
  }

  async function handleBarcodeScanned({ data }: { data: string }) {
    if (scanLock.current) return
    scanLock.current = true
    setScannerActive(false)
    setScanState('checking')
    try {
      await validateTicketQr(data)
    } finally {
      scanLock.current = false
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Guard Console</Text>
            <Text style={styles.title}>Entry Scanner</Text>
          </View>
          <View style={styles.headerBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.headerBadgeText}>Live</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <LinearGradient
            colors={['rgba(245,197,24,0.22)', 'rgba(236,72,153,0.13)', 'rgba(17,17,17,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <QrCode size={25} color={YELLOW} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroLabel}>Tonight at Pulse Room</Text>
              <Text style={styles.heroTitle}>Fast QR validation for the door team</Text>
            </View>
          </View>

          <Animated.View style={[styles.scanPanel, { transform: [{ scale: mode === 'photo' ? photoScale : frameScale }] }]}>
            <View style={styles.scanGlow} />
            <View style={[styles.scanFrame, mode === 'photo' && styles.photoFrame]}>
              {scannerActive && permission?.granted && (
                <Animated.View
                  style={[
                    styles.cameraLayer,
                    {
                      opacity: cameraOpacity,
                      transform: [{ scale: cameraScale }],
                    },
                  ]}
                >
                  <CameraView
                    style={StyleSheet.absoluteFillObject}
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    onBarcodeScanned={handleBarcodeScanned}
                  />
                </Animated.View>
              )}
              {mode === 'photo' && (
                <Animated.View
                  style={[
                    styles.photoBoard,
                    {
                      opacity: photoOpacity,
                      transform: [{ scale: photoScale }],
                    },
                  ]}
                >
                  {photoUri ? (
                    <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
                  ) : (
                    <View style={styles.photoEmpty}>
                      <View style={styles.photoEmptyIcon}>
                        <ImageUp size={34} color={COLORS.pink} />
                      </View>
                      <Text style={styles.photoEmptyTitle}>Upload ticket photo</Text>
                      <Text style={styles.photoEmptyText}>Use a saved screenshot with the QR code visible.</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.boardUploadButton} activeOpacity={0.85} onPress={handlePhotoUpload}>
                    <ImageUp size={17} color="#050505" />
                    <Text style={styles.boardUploadText}>{photoUri ? 'Choose another' : 'Upload photo'}</Text>
                  </TouchableOpacity>
                </Animated.View>
              )}
              {mode !== 'photo' && <View pointerEvents="none" style={[styles.cameraScrim, scannerActive && styles.cameraScrimLive]} />}
              {!scannerActive && mode !== 'queue' && scanState !== 'idle' && (
                <>
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.feedbackFieldGlow,
                      {
                        backgroundColor: feedbackTone.glow,
                        opacity: scanState === 'checking' ? 0.22 : resultHaloOpacitySecondary,
                        transform: [{ scale: scanState === 'checking' ? 1.2 : resultHaloScaleSecondary }],
                      },
                    ]}
                  />
                  {scanState !== 'checking' && (
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.feedbackFieldRing,
                        {
                          borderColor: feedbackTone.ring,
                          opacity: resultHaloOpacity,
                          transform: [{ scale: resultHaloScale }],
                        },
                      ]}
                    />
                  )}
                </>
              )}
              <View style={[styles.corner, styles.cornerTopLeft, mode === 'photo' && styles.photoCorner]} />
              <View style={[styles.corner, styles.cornerTopRight, mode === 'photo' && styles.photoCorner]} />
              <View style={[styles.corner, styles.cornerBottomLeft, mode === 'photo' && styles.photoCorner]} />
              <View style={[styles.corner, styles.cornerBottomRight, mode === 'photo' && styles.photoCorner]} />
              {!scannerActive && mode !== 'photo' && scanState === 'idle' && <QrCode size={74} color="rgba(255,255,255,0.86)" />}
              {!scannerActive && mode !== 'queue' && scanState !== 'idle' && scanFeedback && (
                <Animated.View
                  style={[
                    styles.resultBoard,
                    {
                      opacity: resultBoardOpacity,
                      transform: [
                        { translateX: resultBoardShakeX },
                        { translateY: resultBoardTranslateY },
                        { scale: resultBoardScale },
                      ],
                    },
                  ]}
                >
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.resultBoardTone,
                      {
                        backgroundColor: feedbackTone.surface,
                        opacity: scanState === 'checking' ? 0.14 : resultToneOpacity,
                      },
                    ]}
                  />
                  <View style={styles.resultIconWrap}>
                    {scanState !== 'checking' && (
                      <>
                        <Animated.View
                          pointerEvents="none"
                          style={[
                            styles.resultIconHalo,
                            {
                              backgroundColor: feedbackTone.glow,
                              opacity: resultHaloOpacitySecondary,
                              transform: [{ scale: resultHaloScaleSecondary }],
                            },
                          ]}
                        />
                        <Animated.View
                          pointerEvents="none"
                          style={[
                            styles.resultIconRing,
                            {
                              borderColor: feedbackTone.ring,
                              opacity: resultHaloOpacity,
                              transform: [{ scale: resultHaloScale }],
                            },
                          ]}
                        />
                      </>
                    )}
                    <Animated.View
                      style={{
                        transform: [{ scale: resultIconRevealScale }, { scale: resultIconBurstScale }],
                      }}
                    >
                      <View
                        style={[
                          styles.resultIcon,
                          scanState === 'valid' && styles.resultIconValid,
                          scanState === 'warning' && styles.resultIconWarning,
                          scanState === 'checking' && styles.resultIconChecking,
                        ]}
                      >
                        {scanState === 'valid' ? (
                          <CheckCircle2 size={42} color="#050505" />
                        ) : scanState === 'checking' ? (
                          <ShieldCheck size={42} color="#050505" />
                        ) : (
                          <XCircle size={42} color="#050505" />
                        )}
                      </View>
                    </Animated.View>
                  </View>
                  <Text style={styles.resultTitle}>{scanFeedback.title}</Text>
                  <Text style={styles.resultDetail}>{scanFeedback.detail}</Text>
                  {scanFeedback.code && (
                    <Text style={styles.resultCode} numberOfLines={1}>{scanFeedback.code}</Text>
                  )}
                </Animated.View>
              )}
              {scannerActive && (
                <View style={styles.liveCameraHud}>
                  <View style={styles.livePill}>
                    <View style={styles.liveDot} />
                    <Text style={styles.livePillText}>Scanning</Text>
                  </View>
                </View>
              )}
              {(scannerActive || scanState === 'idle') && (
                <View style={[styles.scanLine, scannerActive && styles.scanLineLive, mode === 'photo' && styles.scanLinePhoto]} />
              )}
            </View>
          </Animated.View>

          <View style={[styles.statusCard, { backgroundColor: status.bg }]}>
            <View style={[styles.statusIcon, { backgroundColor: status.color }]}>
              <StatusIcon size={18} color="#050505" />
            </View>
            <View style={styles.statusTextWrap}>
              <Text style={styles.statusTitle}>{status.title}</Text>
              <Text style={styles.statusDetail}>{status.detail}</Text>
            </View>
            <ChevronRight size={18} color="rgba(255,255,255,0.36)" />
          </View>
        </View>

        <View style={styles.modeTabs}>
          <ModeTab label="Scanner" icon={Camera} active={mode === 'camera'} onPress={() => setMode('camera')} />
          <ModeTab label="Photo" icon={ImageUp} active={mode === 'photo'} onPress={enterPhotoMode} />
          <ModeTab label="Queue" icon={ListChecks} active={mode === 'queue'} onPress={handleQueueScan} />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryAction}
            activeOpacity={0.86}
            onPress={mode === 'photo' ? handlePhotoUpload : handlePrimaryScan}
          >
            {mode === 'photo' ? (
              <ImageUp size={20} color="#050505" />
            ) : scannerActive ? (
              <Camera size={20} color="#050505" />
            ) : (
              <Search size={20} color="#050505" />
            )}
            <Text style={styles.primaryActionText}>
              {mode === 'photo' ? 'Upload QR Photo' : scannerActive ? 'Scanning Live' : 'Start QR Scan'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryAction} activeOpacity={0.86} onPress={handlePhotoUpload}>
            <ImageUp size={19} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.hostessLink}
          activeOpacity={0.84}
          onPress={() => router.push({ pathname: '/hostess', params: user?.id ? { id: user.id } : {} })}
        >
          <View style={styles.hostessLinkIcon}>
            <Users size={18} color="#050505" />
          </View>
          <View style={styles.hostessLinkCopy}>
            <Text style={styles.hostessLinkTitle}>Open Hostess Desk</Text>
            <Text style={styles.hostessLinkText}>Hand validated guests over to PR for arrivals, tables, and finalisation.</Text>
          </View>
          <ChevronRight size={18} color="rgba(255,255,255,0.42)" />
        </TouchableOpacity>

        <View style={styles.metricsGrid}>
          {metrics.map((item) => (
            <View key={item.label} style={styles.metricCard}>
              <View style={[styles.metricDot, { backgroundColor: item.accent }]} />
              <Text style={styles.metricValue}>{item.value}</Text>
              <Text style={styles.metricLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{mode === 'queue' ? 'Queue Scan' : 'Recent Scans'}</Text>
          <TouchableOpacity style={styles.sectionAction} activeOpacity={0.75} onPress={handleQueueScan}>
            <Text style={styles.sectionActionText}>Open queue</Text>
            <ChevronRight size={14} color={YELLOW} />
          </TouchableOpacity>
        </View>

        <View style={styles.queueCard}>
          {queue.map((guest, index) => (
            <View key={guest.id}>
              <TouchableOpacity style={styles.queueRow} activeOpacity={0.8}>
                <View style={[styles.avatar, guest.status === 'hold' && styles.avatarHold]}>
                  {guest.status === 'hold' ? (
                    <Clock3 size={18} color={YELLOW} />
                  ) : (
                    <UserCheck size={18} color={COLORS.green} />
                  )}
                </View>
                <View style={styles.queueInfo}>
                  <Text style={styles.queueName}>{guest.name}</Text>
                  <Text style={styles.queueMeta}>{guest.pass} - {guest.id}</Text>
                </View>
                <View style={styles.queueRight}>
                  <Text style={styles.queueTime}>{guest.time}</Text>
                  <Text style={[styles.queueStatus, guest.status === 'hold' && styles.queueStatusHold]}>
                    {guest.status === 'hold' ? 'Hold' : 'Ready'}
                  </Text>
                </View>
              </TouchableOpacity>
              {index < queue.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        <View style={styles.photoCard}>
          <View style={styles.photoIcon}>
            <Sparkles size={18} color={COLORS.pink} />
          </View>
          <View style={styles.photoCopy}>
            <Text style={styles.photoTitle}>Photo QR backup</Text>
            <Text style={styles.photoText}>Scan saved screenshots when guests arrive without network access.</Text>
          </View>
          <TouchableOpacity style={styles.photoButton} activeOpacity={0.8} onPress={handlePhotoUpload}>
            <ImageUp size={17} color="#050505" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

function ModeTab({
  active,
  icon: Icon,
  label,
  onPress,
}: {
  active: boolean
  icon: ComponentType<{ size: number; color: string }>
  label: string
  onPress: () => void
}) {
  return (
    <TouchableOpacity style={[styles.modeTab, active && styles.modeTabActive]} activeOpacity={0.8} onPress={onPress}>
      <Icon size={16} color={active ? '#050505' : COLORS.muted} />
      <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>{label}</Text>
    </TouchableOpacity>
  )
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.md, gap: SPACING.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.sm,
  },
  eyebrow: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '600' },
  title: { color: COLORS.white, fontSize: FONT.xxl, fontWeight: '900', marginTop: 2 },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 7,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.green },
  headerBadgeText: { color: COLORS.white, fontSize: 12, fontWeight: '800' },
  hero: {
    minHeight: 430,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    padding: SPACING.md,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,197,24,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.25)',
  },
  heroCopy: { flex: 1 },
  heroLabel: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  heroTitle: { color: COLORS.white, fontSize: FONT.lg, fontWeight: '800', marginTop: 3, lineHeight: 26 },
  scanPanel: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 228,
    marginBottom: SPACING.md,
  },
  scanGlow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(245,197,24,0.08)',
  },
  scanFrame: {
    width: 218,
    height: 218,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  photoFrame: {
    width: 250,
    height: 250,
    backgroundColor: 'rgba(12,12,14,0.82)',
  },
  cameraLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050505',
  },
  cameraScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  cameraScrimLive: {
    backgroundColor: 'rgba(0,0,0,0.14)',
  },
  feedbackFieldGlow: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
  },
  feedbackFieldRing: {
    position: 'absolute',
    width: 126,
    height: 126,
    borderRadius: 63,
    borderWidth: 2,
  },
  corner: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderColor: YELLOW,
  },
  photoCorner: { borderColor: COLORS.pink },
  cornerTopLeft: { top: 16, left: 16, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 12 },
  cornerTopRight: { top: 16, right: 16, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 12 },
  cornerBottomLeft: { bottom: 16, left: 16, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 12 },
  cornerBottomRight: { bottom: 16, right: 16, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 12 },
  scanLine: {
    position: 'absolute',
    left: 28,
    right: 28,
    top: 104,
    height: 2,
    borderRadius: 1,
    backgroundColor: COLORS.pink,
  },
  scanLineLive: {
    backgroundColor: YELLOW,
    shadowColor: YELLOW,
    shadowOpacity: 0.55,
    shadowRadius: 10,
  },
  scanLinePhoto: {
    opacity: 0,
  },
  photoBoard: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    zIndex: 1,
  },
  photoPreview: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  photoEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  photoEmptyIcon: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(236,72,153,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.24)',
    marginBottom: SPACING.md,
  },
  photoEmptyTitle: {
    color: COLORS.white,
    fontSize: FONT.base,
    fontWeight: '900',
    textAlign: 'center',
  },
  photoEmptyText: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
    textAlign: 'center',
  },
  boardUploadButton: {
    position: 'absolute',
    bottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: YELLOW,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
  },
  boardUploadText: {
    color: '#050505',
    fontSize: 12,
    fontWeight: '900',
  },
  liveCameraHud: {
    position: 'absolute',
    top: 18,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  livePillText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '900',
  },
  resultBoard: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    backgroundColor: 'rgba(5,5,5,0.74)',
    zIndex: 2,
  },
  resultBoardTone: {
    ...StyleSheet.absoluteFillObject,
  },
  resultIconWrap: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  resultIconHalo: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  resultIconRing: {
    position: 'absolute',
    width: 98,
    height: 98,
    borderRadius: 49,
    borderWidth: 2,
  },
  resultIcon: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  resultIconValid: { backgroundColor: COLORS.green },
  resultIconWarning: { backgroundColor: COLORS.red },
  resultIconChecking: { backgroundColor: YELLOW },
  resultTitle: {
    color: COLORS.white,
    fontSize: FONT.md,
    fontWeight: '900',
    textAlign: 'center',
  },
  resultDetail: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 7,
    textAlign: 'center',
    maxWidth: 188,
  },
  resultCode: {
    maxWidth: 168,
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: SPACING.md,
  },
  statusIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTextWrap: { flex: 1 },
  statusTitle: { color: COLORS.white, fontSize: FONT.base, fontWeight: '800' },
  statusDetail: { color: COLORS.muted, fontSize: FONT.sm, marginTop: 2 },
  modeTabs: {
    flexDirection: 'row',
    gap: SPACING.xs,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 5,
  },
  modeTab: {
    flex: 1,
    height: 40,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modeTabActive: { backgroundColor: YELLOW },
  modeTabText: { color: COLORS.muted, fontSize: 12, fontWeight: '800' },
  modeTabTextActive: { color: '#050505' },
  actions: { flexDirection: 'row', gap: SPACING.sm },
  primaryAction: {
    flex: 1,
    height: 54,
    borderRadius: RADIUS.pill,
    backgroundColor: YELLOW,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  primaryActionText: { color: '#050505', fontSize: FONT.base, fontWeight: '900' },
  secondaryAction: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.bgCard2,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostessLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  hostessLinkIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: YELLOW,
  },
  hostessLinkCopy: { flex: 1 },
  hostessLinkTitle: { color: COLORS.white, fontSize: FONT.base, fontWeight: '800' },
  hostessLinkText: { color: COLORS.mutedDark, fontSize: 12, lineHeight: 17, marginTop: 2 },
  metricsGrid: { flexDirection: 'row', gap: SPACING.sm },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    minHeight: 96,
  },
  metricDot: { width: 8, height: 8, borderRadius: 4, marginBottom: SPACING.sm },
  metricValue: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '900' },
  metricLabel: { color: COLORS.mutedDark, fontSize: 12, fontWeight: '700', marginTop: 2 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  sectionTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '800' },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { color: YELLOW, fontSize: FONT.sm, fontWeight: '800' },
  queueCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(16,185,129,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHold: { backgroundColor: 'rgba(245,197,24,0.12)' },
  queueInfo: { flex: 1 },
  queueName: { color: COLORS.white, fontSize: FONT.base, fontWeight: '800' },
  queueMeta: { color: COLORS.mutedDark, fontSize: 12, fontWeight: '600', marginTop: 3 },
  queueRight: { alignItems: 'flex-end' },
  queueTime: { color: COLORS.mutedDark, fontSize: 12, fontWeight: '700' },
  queueStatus: { color: COLORS.green, fontSize: 12, fontWeight: '900', marginTop: 4 },
  queueStatusHold: { color: YELLOW },
  divider: { height: 1, backgroundColor: COLORS.border, marginLeft: 72 },
  photoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  photoIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(236,72,153,0.12)',
  },
  photoCopy: { flex: 1 },
  photoTitle: { color: COLORS.white, fontSize: FONT.base, fontWeight: '800' },
  photoText: { color: COLORS.mutedDark, fontSize: 12, lineHeight: 17, marginTop: 2 },
  photoButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: YELLOW,
  },
})
