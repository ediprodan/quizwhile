import type { On } from 'claude-code'
import { expect, mock, test, type Engine } from 'claude-code/testing'

type Clock = ReturnType<typeof mock.clock>

const ROOT = '/project'
const FILE = 'def load_prices(path):\n    prices = {}\n    return prices\n'

const QUIZ = {
  topic: 'dict',
  question: 'In `load_prices`, what does `prices` start as?',
  options: ['A list', 'An empty dict', 'None'],
  correct: 1,
  explanation: '`{}` makes an empty dict.',
  path: '/project/prices.py',
  anchor: 'prices = {}',
}

// What Read hands back: each line numbered
const READ = '     1\tdef load_prices(path):\n     2\t    prices = {}\n     3\t    return prices'

// Every prompt sent to the model, and every command run, newest last
const prompts: string[] = []
const runs: string[][] = []

const BAND = {
  plugin: 'quizwhile',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: true, maxRows: 20, bodyColumns: 80 } as never,
} as const

type Setup = {
  // What the model replies with
  reply?: string
  // A file Claude reads before the turn starts, if any
  read?: string | null
  // What `git ls-files` lists in the project
  tracked?: string
}

// Stands in for the engine beneath the plugin, then starts a session, lets
// Claude read a file when given one, starts a turn and lets the drop-in
// delay pass
async function startTurn($: Engine, on: On, setup: Setup = {}): Promise<Clock> {
  const { reply = JSON.stringify(QUIZ), read = '/project/prices.py', tracked = '' } = setup
  const clock = mock.clock(on)
  mock.store(on)
  on('ui.render', ($, e) => $.ui.resolve(e).Box({}))
  on('ui.log', () => ({ value: {} }) as never)
  on('ui.toast', () => ({ value: {} }) as never)
  on('command.register', () => ({ value: {} }) as never)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.root', () => ({ value: ROOT }) as never)
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('classic.PermissionRequest', () => ({}) as never)
  on('tool.call', () => ({ result: {}, text: READ }) as never)
  on('fs.read', () => ({ value: FILE }) as never)
  on('process.run', (_, e) => {
    runs.push([...e.argv])
    const stdout = e.argv[0] === 'git' ? tracked : ''
    return { value: { exitCode: 0, stdout, stderr: '' } } as never
  })
  on('model.complete', (_, e) => {
    prompts.push(String(e.prompt))
    return { value: { isAnswered: true, text: reply, usage: {} } } as never
  })

  await $.session.start({ cwd: ROOT, surface: 'desktop', isInteractive: true } as never)
  if (read) await $.tool.call({ tool: 'Read', file_path: read } as never)
  await $.turn.start({ text: 'Add a login route', turnId: 't1' } as never)
  await clock.advance(2100)
  return clock
}

// The question is written after the delay, so wait for it to be drawn
async function mountAsked($: Engine, clock: Clock, surface: 'desktop' | 'terminal' = 'desktop') {
  const ui = await $.ui.mount({ ...BAND, surface })
  for (let i = 0; i < 50 && !(await ui.find({ key: 'option-0' })); i++) {
    await clock.advance(10)
  }
  return ui
}

test('asks about the project code Claude read and marks a right answer', async ($, on) => {
  const clock = await startTurn($, on)
  const ui = await mountAsked($, clock)
  expect(await ui.find({ type: 'Text', text: /dict/ })).toBeDefined()
  await ui.press({ key: 'option-1' })
  expect(await ui.find({ type: 'Text', text: /Correct/ })).toBeDefined()
  await ui.unmount()
})

test('a wrong answer shows the right one and says it comes back', async ($, on) => {
  const clock = await startTurn($, on)
  const ui = await mountAsked($, clock)
  await ui.press({ key: 'option-0' })
  expect(await ui.find({ type: 'Text', text: /An empty dict/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /see this one again/ })).toBeDefined()
  await ui.unmount()
})

test('a wrong answer offers to open the file in Zed at the line', async ($, on) => {
  const clock = await startTurn($, on)
  const ui = await mountAsked($, clock)
  await ui.press({ key: 'option-0' })
  await ui.press({ key: 'open' })
  expect(runs.at(-1)).toEqual(['zed', '/project/prices.py:2'])
  await ui.unmount()
})

test('sends the model the code Claude read, without Read\'s line numbers', async ($, on) => {
  const clock = await startTurn($, on)
  const ui = await mountAsked($, clock)
  const prompt = prompts.at(-1) ?? ''
  expect(prompt).toContain('def load_prices(path):')
  expect(prompt).toContain('/project/prices.py')
  expect(prompt).not.toContain('1\tdef')
  await ui.unmount()
})

test('picks a file from the project when Claude has read none', async ($, on) => {
  const clock = await startTurn($, on, { read: null, tracked: 'README.md\nprices.py\n' })
  const ui = await mountAsked($, clock)
  expect(await ui.find({ key: 'option-0' })).toBeDefined()
  expect(prompts.at(-1)).toContain('Code from /project/prices.py')
  await ui.unmount()
})

test('ignores code read outside the project and asks nothing', async ($, on) => {
  const clock = await startTurn($, on, { read: '/tmp/scratch/prices.py' })
  const ui = await mountAsked($, clock)
  expect(await ui.find({ key: 'option-0' })).toBeUndefined()
  await ui.unmount()
})

test('asks nothing when the model gives no question', async ($, on) => {
  const clock = await startTurn($, on, { reply: 'not json' })
  const ui = await mountAsked($, clock)
  expect(await ui.find({ key: 'option-0' })).toBeUndefined()
  await ui.unmount()
})

test('draws nothing on the terminal in this first version', async ($, on) => {
  const clock = await startTurn($, on)
  const ui = await mountAsked($, clock, 'terminal')
  expect(await ui.find({ key: 'option-0' })).toBeUndefined()
  await ui.unmount()
})

test('a permission dialog pauses the quiz', async ($, on) => {
  const clock = await startTurn($, on)
  const ui = await mountAsked($, clock)
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'npm install' } } as never)
  expect(await ui.find({ type: 'Text', text: /Claude needs you/ })).toBeDefined()
  expect(await ui.find({ key: 'option-0' })).toBeUndefined()
  await ui.unmount()
})
