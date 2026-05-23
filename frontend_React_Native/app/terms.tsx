import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'

type Section = { title: string; body: string }

const SECTIONS: Section[] = [
  {
    title: '1. Acceptance of Terms',
    body: 'By downloading or using PartyOn you agree to be bound by these Terms and Conditions. If you do not agree, please do not use the app. We may update these terms at any time; continued use of the app constitutes acceptance of the revised terms.',
  },
  {
    title: '2. Eligibility',
    body: 'You must be at least 18 years old to create an account and purchase tickets or make reservations through PartyOn. By using the app you confirm that you meet this age requirement. We reserve the right to terminate accounts that we believe belong to minors.',
  },
  {
    title: '3. Account Registration',
    body: 'You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. Notify us immediately at support@partyon.app if you suspect unauthorised use. We are not liable for losses resulting from unauthorised access to your account.',
  },
  {
    title: '4. Bookings & Tickets',
    body: 'All ticket purchases and table reservations made through PartyOn are subject to availability and confirmation by the venue. A booking is not confirmed until you receive a confirmation notification. PartyOn acts as an intermediary between you and the venue; the venue is solely responsible for the event and any services provided on the night.',
  },
  {
    title: '5. Payment & Refunds',
    body: 'Payments are processed securely through our payment provider. Prices displayed include any applicable taxes unless otherwise stated. Refund eligibility is determined by the venue\'s own cancellation policy, which will be shown at the time of booking. PartyOn is not responsible for refunds resulting from venue cancellations or changes beyond our control; in such cases, we will work with the venue on your behalf.',
  },
  {
    title: '6. Promotions & Offers',
    body: 'Promotions displayed in the app are provided by venues and are subject to the terms set by each individual venue. PartyOn does not guarantee the availability, accuracy, or continued validity of any promotion. Claimed promotions must be presented at the venue within the stated validity window.',
  },
  {
    title: '7. Disputes',
    body: 'If you experience a problem related to a booking or event, you may raise a dispute through the app. PartyOn will forward your dispute to the relevant venue manager. While we will make reasonable efforts to facilitate a resolution, ultimate responsibility lies with the venue. PartyOn reserves the right to close disputes that are fraudulent, abusive, or submitted in bad faith.',
  },
  {
    title: '8. User Conduct',
    body: 'You agree not to use PartyOn for any unlawful purpose, to submit false information, to attempt to gain unauthorised access to our systems, or to engage in any conduct that could damage, disable, or impair the app or its users. Violations may result in immediate account suspension.',
  },
  {
    title: '9. Intellectual Property',
    body: 'All content in the app including text, graphics, logos, and software is the property of PartyOn or its licensors and is protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works without our express written permission.',
  },
  {
    title: '10. Privacy',
    body: 'Your use of PartyOn is also governed by our Privacy Policy, which is incorporated into these Terms by reference. By using the app you consent to the collection and use of your data as described in the Privacy Policy, accessible from the Settings screen.',
  },
  {
    title: '11. Limitation of Liability',
    body: 'To the fullest extent permitted by law, PartyOn shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the app or attendance at any event. Our total liability to you for any claim shall not exceed the amount you paid for the relevant booking.',
  },
  {
    title: '12. Governing Law',
    body: 'These Terms are governed by the laws of Albania. Any dispute arising from these Terms shall be subject to the exclusive jurisdiction of the courts of Tirana, Albania.',
  },
  {
    title: '13. Contact',
    body: 'If you have any questions about these Terms and Conditions please contact us at legal@partyon.app or write to us at PartyOn, Tirana, Albania.',
  },
]

export default function TermsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Terms & Conditions</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        {/* Intro banner */}
        <View style={s.banner}>
          <Ionicons name="document-text-outline" size={22} color={COLORS.purple} />
          <Text style={s.bannerText}>
            Please read these terms carefully before using PartyOn. Last updated May 2026.
          </Text>
        </View>

        {/* Sections */}
        {SECTIONS.map((sec, i) => (
          <View key={i} style={s.section}>
            <Text style={s.sectionTitle}>{sec.title}</Text>
            <Text style={s.sectionBody}>{sec.body}</Text>
          </View>
        ))}

        <Text style={s.footnote}>
          © 2026 PartyOn. All rights reserved.
        </Text>
      </ScrollView>
    </View>
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

  scroll: {
    padding: SPACING.md,
    paddingBottom: 48,
    gap: SPACING.sm,
  },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(167,139,250,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(167,139,250,0.25)',
    marginBottom: SPACING.sm,
  },
  bannerText: { flex: 1, color: COLORS.muted, fontSize: FONT.sm, lineHeight: 18 },

  section: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  sectionTitle: {
    color: COLORS.white,
    fontSize: FONT.base,
    fontWeight: '700',
  },
  sectionBody: {
    color: COLORS.muted,
    fontSize: FONT.sm,
    lineHeight: 20,
  },

  footnote: {
    color: COLORS.mutedDark,
    fontSize: 12,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
})
