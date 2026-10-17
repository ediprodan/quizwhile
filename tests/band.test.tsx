import type { On } from 'claude-code'
import { expect, mock, test, type Engine } from 'claude-code/testing'

type Clock = ReturnType<typeof mock.clock>

const QUIZ = {
  topic: 'middleware',
  question: 'What does `express.json()` do?',
  options: ['Encrypts the response', 'Turns the request body into an object', 'Logs every request'],
  correct: 1,
  explanation: 'It parses the raw JSON text so `req.body` is an object.',
}

const BAND = {
  plugin: 'quizwhile',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: true, maxRows: 20, bodyColumns: 80 } as never,
} as const

// Stands in for the engine beneath the plugin, then starts a session and a
// turn and lets the drop-in delay pass
async function startTurn($: Engine, on: On, reply: string, logs: string[] = []): Promise<Clock> {
  const clock = mock.clock(on)
  mock.store(on)
  on('ui.render', ($, e) => $.ui.resolve(e).Box({}))
  on('ui.log', (_, e) => (logs.push(JSON.stringify(e)), { value: {} }) as never)
  on('command.register', () => ({ value: {} }) as never)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('classic.PermissionRequest', () => ({}) as never)
  on('model.complete', () => ({ value: { isAnswered: true, text: reply, usage: {} } }) as never)

  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true } as never)
  await $.prompt.submit({ text: 'Add a login route' } as never)
  await $.turn.start({ text: 'Add a login route', turnId: 't1' } as never)
  await clock.advance(2100)
  return clock
}

// The question is written after the delay, so wait for it to be drawn
async function mountAsked($: Engine, clock: Clock, surface: 'desktop' | 'terminal') {
  const ui = await $.ui.mount({ ...BAND, surface })
  for (let i = 0; i < 50 && !(await ui.find({ key: 'option-0' })); i++) {
    await clock.advance(10)
  }
  return ui
}

test('asks a question about the work and marks a right answer', async ($, on) => {
  const logs: string[] = []
  const clock = await startTurn($, on, JSON.stringify(QUIZ), logs)
  const ui = await mountAsked($, clock, 'desktop')
  expect(await ui.find({ type: 'Text', text: /middleware/ }), logs.join('\n')).toBeDefined()
  await ui.press({ key: 'option-1' })
  expect(await ui.find({ type: 'Text', text: /Correct/ })).toBeDefined()
  await ui.unmount()
})

test('a wrong answer shows the right one and says it comes back', async ($, on) => {
  const clock = await startTurn($, on, JSON.stringify(QUIZ))
  const ui = await mountAsked($, clock, 'desktop')
  await ui.press({ key: 'option-0' })
  expect(await ui.find({ type: 'Text', text: /Turns the request body/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /see this one again/ })).toBeDefined()
  await ui.unmount()
})

test('falls back to the built-in bank when the model gives no question', async ($, on) => {
  const clock = await startTurn($, on, 'not json')
  const ui = await mountAsked($, clock, 'desktop')
  expect(await ui.find({ key: 'option-0' })).toBeDefined()
  await ui.unmount()
})

test('draws nothing on the terminal in this first version', async ($, on) => {
  const clock = await startTurn($, on, JSON.stringify(QUIZ))
  const ui = await mountAsked($, clock, 'terminal')
  expect(await ui.find({ key: 'option-0' })).toBeUndefined()
  await ui.unmount()
})

test('a permission dialog pauses the quiz', async ($, on) => {
  const clock = await startTurn($, on, JSON.stringify(QUIZ))
  const ui = await mountAsked($, clock, 'desktop')
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'npm install' } } as never)
  expect(await ui.find({ type: 'Text', text: /Claude needs you/ })).toBeDefined()
  expect(await ui.find({ key: 'option-0' })).toBeUndefined()
  await ui.unmount()
})
