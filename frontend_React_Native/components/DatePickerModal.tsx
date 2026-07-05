import { useState } from 'react'
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS, FONT } from '@/lib/theme'

const DAYS   = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

type Props = {
  visible:   boolean
  value:     string          // DD/MM/YYYY or ''
  onClose:   () => void
  onSelect:  (date: string) => void  // returns DD/MM/YYYY
  label?:    string
}

function parseDisplay(s: string): Date | null {
  if (!s) return null
  const [d, m, y] = s.split('/')
  if (!d || !m || !y) return null
  const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
  return isNaN(dt.getTime()) ? null : dt
}

function toDisplay(dt: Date) {
  return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`
}

export default function DatePickerModal({ visible, value, onClose, onSelect, label }: Props) {
  const today     = new Date()
  const parsed    = parseDisplay(value)
  const initMonth = parsed ?? today

  const [viewYear,  setViewYear]  = useState(initMonth.getFullYear())
  const [viewMonth, setViewMonth] = useState(initMonth.getMonth())
  const [selected,  setSelected]  = useState<Date | null>(parsed)

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  function buildGrid() {
    const first = new Date(viewYear, viewMonth, 1).getDay()
    const days  = new Date(viewYear, viewMonth + 1, 0).getDate()
    const cells: (number | null)[] = Array(first).fill(null)
    for (let d = 1; d <= days; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }

  function isSelected(d: number | null) {
    if (!d || !selected) return false
    return selected.getDate() === d && selected.getMonth() === viewMonth && selected.getFullYear() === viewYear
  }

  function isToday(d: number | null) {
    if (!d) return false
    return today.getDate() === d && today.getMonth() === viewMonth && today.getFullYear() === viewYear
  }

  function handleDay(d: number | null) {
    if (!d) return
    const dt = new Date(viewYear, viewMonth, d)
    setSelected(dt)
    onSelect(toDisplay(dt))
    onClose()
  }

  const grid = buildGrid()

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={s.centeredWrap}>
        <View style={s.card}>
          {label && <Text style={s.label}>{label}</Text>}

          {/* Month navigation */}
          <View style={s.navRow}>
            <TouchableOpacity onPress={prevMonth} style={s.navBtn}>
              <Ionicons name="chevron-back" size={18} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={s.monthTitle}>{MONTHS[viewMonth]} {viewYear}</Text>
            <TouchableOpacity onPress={nextMonth} style={s.navBtn}>
              <Ionicons name="chevron-forward" size={18} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={s.weekRow}>
            {DAYS.map(d => <Text key={d} style={s.weekDay}>{d}</Text>)}
          </View>

          {/* Day grid */}
          <View style={s.grid}>
            {grid.map((d, i) => {
              const sel   = isSelected(d)
              const todayD = isToday(d)
              return (
                <TouchableOpacity
                  key={i}
                  style={[s.cell, sel && s.cellSelected, todayD && !sel && s.cellToday]}
                  onPress={() => handleDay(d)}
                  activeOpacity={d ? 0.7 : 1}
                >
                  <Text style={[s.cellText, sel && s.cellTextSelected, todayD && !sel && s.cellTextToday]}>
                    {d ?? ''}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Footer */}
          <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  centeredWrap:{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  card:        { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: SPACING.lg, width: 320, borderWidth: 1, borderColor: COLORS.border },
  label:       { color: COLORS.mutedDark, fontSize: FONT.sm, fontWeight: '600', marginBottom: SPACING.md, textAlign: 'center' },

  navRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  navBtn:      { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.bgCard2, alignItems: 'center', justifyContent: 'center' },
  monthTitle:  { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },

  weekRow:     { flexDirection: 'row', marginBottom: SPACING.xs },
  weekDay:     { flex: 1, textAlign: 'center', color: COLORS.mutedDark, fontSize: 11, fontWeight: '600' },

  grid:        { flexDirection: 'row', flexWrap: 'wrap' },
  cell:        { width: `${100/7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.sm },
  cellSelected:{ backgroundColor: COLORS.purpleDark },
  cellToday:   { borderWidth: 1, borderColor: COLORS.purple },
  cellText:    { color: COLORS.muted, fontSize: FONT.sm },
  cellTextSelected: { color: '#fff', fontWeight: '700' },
  cellTextToday:    { color: COLORS.purple, fontWeight: '700' },

  cancelBtn:   { marginTop: SPACING.md, alignItems: 'center', paddingVertical: SPACING.sm },
  cancelText:  { color: COLORS.mutedDark, fontSize: FONT.sm, fontWeight: '500' },
})
