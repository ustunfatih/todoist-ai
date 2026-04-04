import { NextResponse, type NextRequest } from 'next/server'

const API_KEY = process.env.TODOIST_API_KEY!
const REST_BASE = 'https://api.todoist.com/api/v1'

export async function POST(req: NextRequest) {
  try {
    const { tasks }: { tasks: Array<{ content: string; urgency: 'high' | 'medium' | 'low' }> } = await req.json()

    const created: string[] = []
    const errors: string[] = []

    for (const task of tasks) {
      // Map urgency to Todoist due date
      const due = task.urgency === 'high' ? 'today'
        : task.urgency === 'medium' ? 'this week'
        : undefined

      const body: Record<string, unknown> = { content: task.content }
      if (due) body.dueString = due

      const res = await fetch(`${REST_BASE}/tasks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        created.push(task.content)
      } else {
        errors.push(task.content)
      }
    }

    return NextResponse.json({ created: created.length, errors })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create tasks' },
      { status: 500 },
    )
  }
}
