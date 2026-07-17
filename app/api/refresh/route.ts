import { readRankings } from '@/lib/storage'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await readRankings()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to read rankings' },
      { status: 500 }
    )
  }
}
