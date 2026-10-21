// quizwhile: a multiple-choice question in the band above the prompt while
// Claude works, about the code Claude is reading and writing. It steps aside when Claude needs
// you and keeps an unanswered question for the next turn.

import type { EngineInterface, Register } from 'claude-code'

import { SYSTEM, bankFor, parseQuiz, type Quiz } from './quiz'

const DROP_IN_DELAY_MS = 2000
const GENERATE_TIMEOUT_MS = 15000
const MAX_FILES = 10
const MAX_SNIPPETS = 4
const MAX_SNIPPET_CHARS = 1200
const MAX_MISSED = 20
// How often a missed question comes back in place of a new one
const REVIEW_CHANCE = 0.3

// Where the band stands:
//   hidden     nothing drawn
//   asking     a question with its options
//   right      answered correctly, one line
//   wrong      answered wrongly, with the explanation
//   collapsed  a one-line reminder that a question waits
//   paused     Claude needs the person, so the band steps aside
type Phase = 'hidden' | 'asking' | 'right' | 'wrong' | 'collapsed' | 'paused'

// Kept for the session; the missed questions and the on/off switch live in $.store
let isOn = true
let phase: Phase = 'hidden'
let pausedFrom: Phase = 'hidden'
let isTurnRunning = false
let current: Quiz | null = null
let isReview = false
// Set when the person answered right and asked why, so the explanation reads as such
let wasRight = false
let upcoming: Promise<Quiz | null> | null = null
let dropIn: { cancel: () => void } | null = null

// The code Claude has read or written this session, for the model that
// writes questions: kept across prompts so a new turn starts with context
let files: string[] = []
let snippets: { path: string; code: string }[] = []
let missed: Quiz[] = []
const recentTopics: string[] = []

// A reload or a new session starts from nothing but what $.store kept
function reset() {
  dropIn?.cancel()
  phase = 'hidden'
  pausedFrom = 'hidden'
  isTurnRunning = false
  current = null
  isReview = false
  wasRight = false
  upcoming = null
  dropIn = null
  files = []
  snippets = []
  recentTopics.length = 0
}

function show($: EngineInterface, next: Phase) {
  phase = next
  $.ui.invalidate('ui.render')
}

function noteFile(path: string) {
  files = [...files.filter((f) => f !== path), path].slice(-MAX_FILES)
}

function noteCode(path: string, code: string) {
  const trimmed = code.trim()
  if (!trimmed) return
  const snippet = { path, code: trimmed.slice(0, MAX_SNIPPET_CHARS) }
  snippets = [...snippets.filter((s) => s.path !== path), snippet].slice(-MAX_SNIPPETS)
}

// Questions are only about code, so with none seen yet the bank answers
async function generate($: EngineInterface): Promise<Quiz | null> {
  if (snippets.length === 0) return null
  const prompt = [
    `Files in this project: ${files.join(', ')}`,
    ...snippets.map((s) => `Code from ${s.path}:\n${s.code}`),
    recentTopics.length ? `Avoid these topics, already asked: ${recentTopics.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
  try {
    const r = await $.model.complete({
      model: 'haiku',
      system: SYSTEM,
      prompt,
      maxTokens: 600,
      effort: 'low',
      timeoutMs: GENERATE_TIMEOUT_MS,
    })
    return r.isAnswered ? parseQuiz(r.text) : null
  } catch (error) {
    $.ui.log('quizwhile could not write a question: ' + String(error), { to: 'debug' })
    return null
  }
}

function fromBank(): Quiz {
  const bank = bankFor(files)
  const fresh = bank.filter((q) => !recentTopics.includes(q.topic))
  const pool = fresh.length ? fresh : bank
  return pool[Math.floor(Math.random() * pool.length)]!
}

// One that comes back empty is dropped, so a later call can try again with
// the code seen since
function prefetch($: EngineInterface) {
  upcoming ??= generate($).then((quiz) => {
    if (!quiz) upcoming = null
    return quiz
  })
}

async function nextQuestion($: EngineInterface): Promise<Quiz> {
  if (missed.length && Math.random() < REVIEW_CHANCE) {
    const [first, ...rest] = missed
    missed = rest
    await $.store.set('missed', missed)
    isReview = true
    return first!
  }
  isReview = false
  const pending = upcoming ?? generate($)
  upcoming = null
  const made = await pending
  return made ?? fromBank()
}

async function ask($: EngineInterface) {
  current = await nextQuestion($)
  recentTopics.push(current.topic)
  if (recentTopics.length > 6) recentTopics.shift()
  // Claude may have finished or needed the person while the question was written
  if (!isTurnRunning || phase === 'paused') return
  show($, 'asking')
  prefetch($)
}

async function answer($: EngineInterface, choice: number) {
  if (!current || phase !== 'asking') return
  wasRight = choice === current.correct
  if (wasRight) {
    show($, 'right')
  } else {
    show($, 'wrong')
    if (!isReview) {
      missed = [...missed, current].slice(-MAX_MISSED)
      await $.store.set('missed', missed)
    }
  }
}

async function moveOn($: EngineInterface) {
  current = null
  if (isTurnRunning) {
    show($, 'hidden')
    await ask($)
  } else {
    show($, 'hidden')
  }
}

function needsYou($: EngineInterface) {
  dropIn?.cancel()
  dropIn = null
  if (phase === 'hidden' || phase === 'paused') return
  pausedFrom = phase
  show($, 'paused')
}

function carryOn($: EngineInterface) {
  if (phase !== 'paused') return
  show($, pausedFrom)
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    reset()
    isOn = (await $.store.get('isOff')) !== true
    const stored = await $.store.get('missed')
    missed = Array.isArray(stored) ? (stored as Quiz[]) : []
    await $.command.register({
      name: 'quizwhile',
      description: 'Quiz yourself above the prompt while Claude works',
      argumentHint: '[off]',
    })
    return next(e)
  })

  on('command.run', { command: 'quizwhile' }, async ($, e) => {
    if (e.args.trim() === 'off') {
      isOn = false
      await $.store.set('isOff', true)
      dropIn?.cancel()
      dropIn = null
      show($, 'hidden')
      return { text: 'quizwhile is off. /quizwhile turns it back on.' }
    }
    isOn = true
    await $.store.set('isOff', false)
    return { text: 'quizwhile is on: a question appears above the prompt while Claude works.' }
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId) return next(e)
    isTurnRunning = true
    if (!isOn) return next(e)
    if (phase === 'right' || phase === 'wrong') current = null
    if (current && (phase === 'hidden' || phase === 'collapsed')) {
      // The question left unanswered last turn comes back
      dropIn = $.clock.after(DROP_IN_DELAY_MS, () => {
        dropIn = null
        if (isTurnRunning && phase !== 'paused') show($, 'asking')
      })
    } else if (!current) {
      show($, 'hidden')
      // Written during the delay, so it is usually ready when the band opens
      prefetch($)
      dropIn = $.clock.after(DROP_IN_DELAY_MS, () => {
        dropIn = null
        void ask($)
      })
    }
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (!e.agentId) {
      if (e.tool === 'AskUserQuestion') needsYou($)
    }
    const input = e as unknown as Record<string, unknown>
    const path = !e.agentId && typeof input.file_path === 'string' ? input.file_path : null
    const result = await next(e)
    if (path) {
      noteFile(path)
      // What Claude wrote, else what it read: either is the person's own code
      const written = typeof input.new_string === 'string' ? input.new_string : typeof input.content === 'string' ? input.content : null
      // Read numbers each line ("   12\t..."); the numbers are not code
      const read = e.tool === 'Read' && !result.isError ? result.text?.replace(/^ *\d+\t/gm, '') : undefined
      const code = written ?? read
      if (code) {
        noteCode(path, code)
        // The first question may have gone to the bank for want of code
        if (isTurnRunning) prefetch($)
      }
    }
    // An answered prompt lets Claude carry on
    carryOn($)
    return result
  })

  // Fires only when a permission dialog is put to the person. A tool.check
  // verdict of ask is not enough: in auto mode the classifier answers most of
  // those, and pausing then sent the band away while Claude kept working
  on('classic.PermissionRequest', async ($, e, next) => {
    needsYou($)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId) return next(e)
    isTurnRunning = false
    dropIn?.cancel()
    dropIn = null
    // An unanswered question waits for the next turn; feedback stays until read
    if (phase === 'asking' || phase === 'collapsed' || phase === 'paused') show($, 'hidden')
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'desktop' || !isOn || e.props.hasSurvey || phase === 'hidden' || !current) return next(e)
    const { Box, Text, Button, Markdown, Code } = $.ui.resolve(e)
    const quiz = current
    const others = await next(e)
    const withOthers = (tree: ReturnType<typeof Box>) =>
      others ? <Box flexDirection="column" gap={1}>{tree}{others}</Box> : tree

    if (phase === 'paused') {
      return withOthers(
        <Text dimColor>Quiz paused · Claude needs you · it comes back after you answer</Text>,
      )
    }

    if (phase === 'collapsed') {
      return withOthers(
        <Button key="expand" label={`Quiz waiting · ${quiz.topic} · expand`} plain onPress={() => show($, 'asking')} />,
      )
    }

    if (phase === 'right') {
      return withOthers(
        <Box borderStyle="round" borderColor="success" paddingX={1} justifyContent="space-between" alignItems="center">
          <Text color="success" bold>✓ Correct</Text>
          <Box gap={1}>
            <Button key="why" label="Why?" plain onPress={() => show($, 'wrong')} />
            <Button key="next" label="Next question" plain onPress={() => void moveOn($)} />
          </Box>
        </Box>,
      )
    }

    const header = (
      <Box justifyContent="space-between" alignItems="center">
        <Text dimColor>{`${isReview ? 'Review' : 'Quiz'} · ${quiz.topic}`}</Text>
        <Box gap={1}>
          {phase === 'asking' ? <Button key="skip" label="Skip" plain onPress={() => void moveOn($)} /> : null}
          <Button key="collapse" label="–" plain onPress={() => show($, 'collapsed')} />
        </Box>
      </Box>
    )

    if (phase === 'wrong') {
      return withOthers(
        <Box borderStyle="round" borderColor="subtle" paddingX={1} flexDirection="column" gap={1}>
          {header}
          <Text color={wasRight ? 'success' : 'warning'} bold>
            {`${wasRight ? '✓ ' : 'Not quite. '}The answer: ${quiz.options[quiz.correct]}`}
          </Text>
          <Markdown text={quiz.explanation} />
          <Box justifyContent="space-between" alignItems="center">
            <Text dimColor>{wasRight || isReview ? '' : "You'll see this one again later"}</Text>
            <Button key="next" label="Next question" plain onPress={() => void moveOn($)} />
          </Box>
        </Box>,
      )
    }

    return withOthers(
      <Box borderStyle="round" borderColor="subtle" paddingX={1} flexDirection="column" gap={1}>
        {header}
        <Markdown text={quiz.question} />
        {quiz.code ? <Code source={quiz.code} /> : null}
        <Box flexDirection="column" alignItems="stretch" gap={1}>
          {quiz.options.map((option, i) => (
            <Button
              key={`option-${i}`}
              label={option}
              hotkey={String(i + 1)}
              variant="secondary"
              onPress={() => void answer($, i)}
            />
          ))}
        </Box>
        <Text dimColor>
          Press 1–{quiz.options.length} to answer{quiz.hint ? ` · Hint: ${quiz.hint}` : ''}
        </Text>
      </Box>,
    )
  })
}
