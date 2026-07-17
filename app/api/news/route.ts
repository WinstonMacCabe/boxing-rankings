import { readUpcomingFights } from '@/lib/storage'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await readUpcomingFights()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ lastUpdated: '', fights: [] })
  }
}
