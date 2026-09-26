import type { Metadata } from 'next'
import CalendarView from './CalendarView'

export const metadata: Metadata = {
  title: 'Fight Calendar',
  description: 'Scheduled fights and bouts across every pugilism sport, from the boxing and MMA rankings.',
}

export default function CalendarPage() {
  return <CalendarView />
}
