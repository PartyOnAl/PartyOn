import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  ScrollView, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native'
import { COLORS, SPACING, RADIUS, FONT } from '@/lib/theme'

type Props = {
  visible:  boolean
  value:    string             // 'HH:MM' or ''
  onClose:  () => void
  onSelect: (time: string) => void  // returns 'HH:MM'
  label?:   string
  minuteStep?: number          // default 5
}

const ROW_H = 40

function pad(n: number) { return String(n).padStart(2, '0') }

function parse(s: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(s)
  if (!match) return null
  const h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return { h, m }
}

export default function TimePickerModal({
  visible, value, onClose, onSelect, label, minuteStep = 5,
}: Props) {
  const init = parse(value) ?? { h: 22, m: 0 }
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep)
  const hours   = Array.from({ length: 24 }, (_, i) => i)

  const [h, setH] = useState(init.h)
  const [m, setM] = useState(minutes.reduce((acc, v) => Math.abs(v - init.m) < Math.abs(acc - init.m) ? v : acc, minutes[0]))

  const hourRef   = useRef<ScrollView>(null)
  const minuteRef = useRef<ScrollView>(null)

  useEffect(() => {
    if (!visible) return
    const initial = parse(value) ?? { h: 22, m: 0 }
    setH(initial.h)
    const snappedM = minutes.reduce((acc, v) => Math.abs(v - initial.m) < Math.abs(acc - initial.m) ? v : acc, minutes[0])
    setM(snappedM)
    setTimeout(() => {
      hourRef.current?.scrollTo({ y: initial.h * ROW_H, animated: false })
      minuteRef.current?.scrollTo({ y: minutes.indexOf(snappedM) * ROW_H, animated: false })
    }, 20)
  }, [visible])

  function onHourScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ROW_H)
    setH(Math.max(0, Math.min(23, idx)))
  }
  function onMinuteScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ROW_H)
    setM(minutes[Math.max(0, Math.min(minutes.length - 1, idx))])
  }

  function confirm() {
    onSelect(`${pad(h)}:${pad(m)}`)
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={s.centeredWrap}>
        <View style={s.card}>
          {label && <Text style={s.label}>{label}</Text>}

          <View style={s.pickerRow}>
            <ScrollView
              ref={hourRef}
              showsVerticalScrollIndicator={false}
              snapToInterval={ROW_H}
              decelerationRate="fast"
              onMomentumScrollEnd={onHourScroll}
              contentContainerStyle={{ paddingVertical: ROW_H }}
              style={s.col}
            >
              {hours.map(hh => (
                <View key={hh} style={s.row}>
                  <Text style={[s.cellText, hh === h && s.cellTextActive]}>{pad(hh)}</Text>
                </View>
              ))}
            </ScrollView>

            <Text style={s.colon}>:</Text>

            <ScrollView
              ref={minuteRef}
              showsVerticalScrollIndicator={false}
              snapToInterval={ROW_H}
              decelerationRate="fast"
              onMomentumScrollEnd={onMinuteScroll}
              contentContainerStyle={{ paddingVertical: ROW_H }}
              style={s.col}
            >
              {minutes.map(mm => (
                <View key={mm} style={s.row}>
                  <Text style={[s.cellText, mm === m && s.cellTextActive]}>{pad(mm)}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
          <View style={s.selectionLine} pointerEvents="none" />

          <View style={s.actions}>
            <TouchableOpacity onPress={onClose} style={[s.btn, s.btnGhost]}>
              <Text style={s.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirm} style={[s.btn, s.btnPrimary]}>
              <Text style={s.btnPrimaryText}>Set {pad(h)}:{pad(m)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  centeredWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  card:         { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: SPACING.lg, width: 280, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  label:        { color: COLORS.mutedDark, fontSize: FONT.sm, fontWeight: '600', marginBottom: SPACING.md, textAlign: 'center' },

  pickerRow:    { flexDirection: 'row', alignItems: 'center', height: ROW_H * 3, marginBottom: SPACING.md, position: 'relative' },
  col:          { width: 70, height: ROW_H * 3 },
  row:          { height: ROW_H, alignItems: 'center', justifyContent: 'center' },
  cellText:     { color: COLORS.mutedDark, fontSize: FONT.xl, fontWeight: '500' },
  cellTextActive:{ color: COLORS.white, fontWeight: '800' },
  colon:        { color: COLORS.white, fontSize: FONT.xl, fontWeight: '800', marginHorizontal: SPACING.sm },
  selectionLine:{
    position: 'absolute', left: SPACING.lg, right: SPACING.lg, top: SPACING.lg + ROW_H + ROW_H - 1,
    height: 0, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.purple + '55',
    pointerEvents: 'none',
  },

  actions: { flexDirection: 'row', gap: SPACING.sm, width: '100%' },
  btn:     { flex: 1, paddingVertical: SPACING.sm + 4, borderRadius: RADIUS.md, alignItems: 'center' },
  btnGhost:{ backgroundColor: COLORS.bgCard2, borderWidth: 1, borderColor: COLORS.border },
  btnGhostText: { color: COLORS.mutedDark, fontSize: FONT.sm, fontWeight: '600' },
  btnPrimary: { backgroundColor: COLORS.purpleDark },
  btnPrimaryText: { color: '#fff', fontSize: FONT.sm, fontWeight: '700' },
})
