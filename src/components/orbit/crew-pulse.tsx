
import { useEffect, useState } from 'react'
import { HeartHandshake, ThumbsUp, ThumbsDown, CheckCircle2 } from 'lucide-react'
import { MISSION_DAY } from '@/lib/orbit/crew'
import { useOrbit } from './orbit-provider'

type PulseVote = {
  from_id?: string
  fromId?: string
  target_id?: string
  targetId?: string
  seems_like_themselves?: number | boolean
  seemsLikeThemselves?: boolean
}

export function CrewPulse() {
  const { astronaut, crew } = useOrbit()

  const [votes, setVotes] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadVotes() {
      try {
        const response = await fetch(`/api/crew-pulse?missionDay=${MISSION_DAY}`)

        if (!response.ok) {
          throw new Error('Could not load crew pulse.')
        }

        const data = await response.json()
        const rows: PulseVote[] = Array.isArray(data)
          ? data
          : Array.isArray(data.votes)
            ? data.votes
            : []

        const myVotes: Record<string, boolean> = {}

        rows.forEach((vote) => {
          const fromId = vote.from_id ?? vote.fromId
          const targetId = vote.target_id ?? vote.targetId
          const value = vote.seems_like_themselves ?? vote.seemsLikeThemselves

          if (fromId === astronaut.id && targetId) {
            myVotes[targetId] = Boolean(value)
          }
        })

        if (!cancelled) setVotes(myVotes)
      } catch {
        if (!cancelled) {
          setMessage('Could not load saved votes. Check that the server is running.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadVotes()

    return () => {
      cancelled = true
    }
  }, [astronaut.id])

  async function submitVote(targetId: string, seemsLikeThemselves: boolean) {
    setSaving(targetId)
    setMessage('')

    try {
      const response = await fetch('/api/crew-pulse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          missionDay: MISSION_DAY,
          fromId: astronaut.id,
          targetId,
          seemsLikeThemselves,
        }),
      })

      if (!response.ok) {
        throw new Error('Could not save vote.')
      }

      setVotes((current) => ({
        ...current,
        [targetId]: seemsLikeThemselves,
      }))

      setMessage('Your crew pulse vote has been saved.')
    } catch {
      setMessage('Could not save your vote. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  const teammates = crew.filter((member) => member.id !== astronaut.id)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <HeartHandshake className="size-6" />
        </div>

        <div>
          <h1 className="text-2xl font-semibold">Crew Pulse</h1>
          <p className="text-sm text-muted-foreground">
            Check in on your teammates and notice changes in their wellbeing.
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold">Mission Day {MISSION_DAY}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Do your teammates seem like themselves today? Your answers help the crew
          stay aware of one another during the mission.
        </p>
      </section>

      {message && (
        <p className="rounded-lg border border-border bg-muted p-3 text-sm" role="status">
          {message}
        </p>
      )}

      {loading ? (
        <p className="py-8 text-center text-muted-foreground">Loading crew pulse…</p>
      ) : teammates.length === 0 ? (
        <div className="rounded-xl border border-border p-8 text-center">
          <HeartHandshake className="mx-auto size-10 text-muted-foreground" />
          <h2 className="mt-3 font-semibold">No teammates available</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add crew members to start checking in on your team.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {teammates.map((member) => {
            const hasVoted = Object.prototype.hasOwnProperty.call(votes, member.id)

            return (
              <article
                key={member.id}
                className="rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{member.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      Crew member
                    </p>
                  </div>

                  {hasVoted && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-status-normal/15 px-3 py-1 text-xs font-medium text-status-normal">
                      <CheckCircle2 className="size-3" />
                      Voted
                    </span>
                  )}
                </div>

                <p className="mt-4 text-sm">
                  Does this crew member seem like themselves today?
                </p>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={saving === member.id}
                    onClick={() => submitVote(member.id, true)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      votes[member.id] === true
                        ? 'border-status-normal bg-status-normal/15 text-status-normal'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <ThumbsUp className="size-4" />
                    Yes
                  </button>

                  <button
                    type="button"
                    disabled={saving === member.id}
                    onClick={() => submitVote(member.id, false)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      votes[member.id] === false
                        ? 'border-status-watch bg-status-watch/15 text-status-watch'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <ThumbsDown className="size-4" />
                    Not sure
                  </button>
                </div>

                {saving === member.id && (
                  <p className="mt-2 text-xs text-muted-foreground">Saving vote…</p>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
