import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Linking, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'

const SUPPORT_EMAIL = 'support@partyon.app'
const SUPPORT_PHONE = '+355692000000'

const FAQS: { q: string; a: string }[] = [
  {
    q: 'How do I get my ticket QR code?',
    a: 'After a successful purchase your QR code is generated instantly. Find it in My Nights, or tap any past booking there to view it again.',
  },
  {
    q: 'Can I cancel or refund a ticket?',
    a: 'Refund eligibility depends on the club\'s policy and how close the event is. Open the ticket and tap "Request refund" to start the process – a manager will review your request.',
  },
  {
    q: 'How do table reservations work?',
    a: 'Table reservations are free to book. Once a club manager confirms, you\'ll receive a notification and the table is held for you. Arrive before the expected time noted on the booking.',
  },
  {
    q: 'I have an issue with an event or club – what do I do?',
    a: 'Open the booking and tap "Raise dispute". Add a clear subject and description; the club\'s manager will respond, and you\'ll see updates in My Disputes.',
  },
  {
    q: 'How do I change my email or password?',
    a: 'Email changes can be requested by contacting support. To reset your password, log out and use "Forgot password" on the login screen.',
  },
  {
    q: 'Where can I see promotions I\'ve claimed?',
    a: 'Open Settings → Saved Promotions, or tap the Promotions tab. Each claimed promotion shows a redemption code to present at the club.',
  },
]

export default function SupportScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  async function openUrl(url: string, fallbackMessage: string) {
    try {
      const can = await Linking.canOpenURL(url)
      if (!can) throw new Error('cannot open')
      await Linking.openURL(url)
    } catch {
      Alert.alert('Unable to open', fallbackMessage)
    }
  }

  function emailSupport() {
    const subject = encodeURIComponent('PartyOn – Support request')
    const body = encodeURIComponent(
      'Hi PartyOn team,\n\nI need help with the following:\n\n— Please describe your issue —\n\nThanks!\n',
    )
    openUrl(
      `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`,
      `Send an email to ${SUPPORT_EMAIL} from your mail app.`,
    )
  }

  function callSupport() {
    openUrl(`tel:${SUPPORT_PHONE}`, `Call us at ${SUPPORT_PHONE}.`)
  }

  function whatsappSupport() {
    const phone = SUPPORT_PHONE.replace(/[^\d]/g, '')
    const text = encodeURIComponent('Hi PartyOn team, I need help with…')
    openUrl(
      `https://wa.me/${phone}?text=${text}`,
      `Message us on WhatsApp at ${SUPPORT_PHONE}.`,
    )
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Support</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroIcon}>
            <Ionicons name="help-buoy-outline" size={26} color={COLORS.purple} />
          </View>
          <Text style={s.heroTitle}>How can we help?</Text>
          <Text style={s.heroSubtitle}>
            We typically reply within a few hours during business days.
          </Text>
        </View>

        {/* Contact actions */}
        <Group title="CONTACT US">
          <ContactRow
            icon="mail-outline"
            label="Email support"
            subtitle={SUPPORT_EMAIL}
            onPress={emailSupport}
          />
          <ContactRow
            icon="logo-whatsapp"
            label="WhatsApp"
            subtitle="Chat with us"
            onPress={whatsappSupport}
          />
          <ContactRow
            icon="call-outline"
            label="Call us"
            subtitle={SUPPORT_PHONE}
            onPress={callSupport}
            isLast
          />
        </Group>

        {/* FAQ */}
        <Group title="FREQUENTLY ASKED">
          {FAQS.map((f, i) => {
            const isLast = i === FAQS.length - 1
            const open = openIdx === i
            return (
              <View key={i} style={[s.faqRow, !isLast && s.faqBorder]}>
                <TouchableOpacity
                  style={s.faqHeader}
                  onPress={() => setOpenIdx(open ? null : i)}
                  activeOpacity={0.7}
                >
                  <Text style={s.faqQ} numberOfLines={2}>{f.q}</Text>
                  <Ionicons
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={17}
                    color={COLORS.mutedDark}
                  />
                </TouchableOpacity>
                {open && <Text style={s.faqA}>{f.a}</Text>}
              </View>
            )
          })}
        </Group>

        <Text style={s.footnote}>
          PartyOn Support · Tirana, Albania
        </Text>
      </ScrollView>
    </View>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.groupWrap}>
      <Text style={s.groupTitle}>{title}</Text>
      <View style={s.groupCard}>{children}</View>
    </View>
  )
}

function ContactRow({
  icon, label, subtitle, onPress, isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  subtitle: string
  onPress: () => void
  isLast?: boolean
}) {
  return (
    <TouchableOpacity
      style={[s.contactRow, !isLast && s.rowBorder]}
      onPress={onPress}
      activeOpacity={0.65}
    >
      <View style={s.iconWrap}>
        <Ionicons name={icon} size={18} color={COLORS.white} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.contactLabel}>{label}</Text>
        <Text style={s.contactSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1, textAlign: 'center',
    color: COLORS.white, fontSize: FONT.lg, fontWeight: '700',
  },

  hero: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.md,
    gap: SPACING.xs,
  },
  heroIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(167,139,250,0.3)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  heroTitle: { color: COLORS.white, fontSize: FONT.lg, fontWeight: '700' },
  heroSubtitle: {
    color: COLORS.mutedDark, fontSize: FONT.sm,
    textAlign: 'center', paddingHorizontal: SPACING.lg, marginTop: 2,
  },

  groupWrap: { marginBottom: SPACING.sm },
  groupTitle: {
    color: COLORS.mutedDark,
    fontSize: 11, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.xs,
  },
  groupCard: {
    marginHorizontal: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },

  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + 2,
    paddingVertical: 13,
    paddingHorizontal: SPACING.md,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  iconWrap: {
    width: 34, height: 34, borderRadius: 9,
    backgroundColor: '#1c1c1e',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  contactLabel: { color: COLORS.white, fontSize: FONT.base, fontWeight: '500' },
  contactSubtitle: { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },

  faqRow: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
  },
  faqBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 14,
  },
  faqQ: { flex: 1, color: COLORS.white, fontSize: FONT.base, fontWeight: '600' },
  faqA: {
    color: COLORS.muted, fontSize: FONT.sm,
    lineHeight: 20, paddingBottom: 14, paddingRight: SPACING.sm,
  },

  footnote: {
    color: COLORS.mutedDark,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.md,
  },
})
