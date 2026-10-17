// What a question is, the questions shipped with the mod, and how a model's
// reply becomes one.

export type Quiz = {
  topic: string
  question: string
  code?: string
  options: string[]
  correct: number
  explanation: string
  hint?: string
}

// Asked when no question about Claude's own work is ready in time
export const BANK: Quiz[] = [
  {
    topic: 'variables',
    question: 'What does `const` promise about a variable?',
    options: ['Its value is copied on every read', 'It can never be reassigned', 'It is visible in every file'],
    correct: 1,
    explanation: '`const` stops the name from being pointed at a new value. An object it holds can still change inside.',
  },
  {
    topic: 'http',
    question: 'A server answers `404`. What does that mean?',
    options: ['The server crashed', 'You are not logged in', 'Nothing exists at that address'],
    correct: 2,
    explanation: '404 is "not found". A crash is a 5xx, and a missing login is usually 401.',
  },
  {
    topic: 'git',
    question: 'What does `git commit` do?',
    options: ['Saves a snapshot of staged changes locally', 'Uploads your code to GitHub', 'Deletes untracked files'],
    correct: 0,
    explanation: 'A commit is a local snapshot. `git push` is what sends commits to a remote like GitHub.',
  },
  {
    topic: 'packages',
    question: 'Why does a project have a lockfile like `package-lock.json`?',
    options: ['To stop others editing the code', 'To pin the exact versions that get installed', 'To speed up the build'],
    correct: 1,
    explanation: 'The lockfile records exact versions, so everyone who installs gets the same dependencies.',
  },
  {
    topic: 'async',
    question: 'What does `await` do inside an async function?',
    options: ['Runs the call on another CPU core', 'Retries the call until it succeeds', 'Pauses the function until the promise settles'],
    correct: 2,
    explanation: '`await` pauses only that function until the promise resolves or rejects; the rest of the program keeps running.',
  },
  {
    topic: 'secrets',
    question: 'Why are API keys kept in `.env` instead of in the code?',
    options: ['So they stay out of git and can differ per machine', 'Because code files cannot hold strings', 'So the app runs faster'],
    correct: 0,
    explanation: '`.env` is usually git-ignored, so secrets never get committed, and each environment can set its own.',
  },
  {
    topic: 'json',
    question: 'What does `JSON.parse` turn its input into?',
    options: ['A string', 'A JavaScript value like an object or array', 'A file on disk'],
    correct: 1,
    explanation: 'JSON arrives as text. `JSON.parse` reads that text and builds the object, array or value it describes.',
  },
  {
    topic: 'testing',
    question: 'What is a unit test for?',
    options: ['Measuring how fast the app loads', 'Checking one small piece of code on its own', 'Testing the whole app in a browser'],
    correct: 1,
    explanation: 'A unit test checks one function or module in isolation, so a failure points at exactly what broke.',
  },
  {
    topic: 'terminal',
    question: 'What does `cd ..` do?',
    options: ['Moves up one folder', 'Deletes the current folder', 'Lists hidden files'],
    correct: 0,
    explanation: '`..` means the parent folder, so `cd ..` moves you up one level.',
  },
  {
    topic: 'css',
    question: 'What does `display: flex` on a container do?',
    options: ['Hides its children', 'Makes it scrollable', 'Lays its children out in a row or column'],
    correct: 2,
    explanation: 'Flexbox arranges a container’s children along one axis and controls their spacing and alignment.',
  },
  {
    topic: 'databases',
    question: 'What is a primary key in a database table?',
    options: ['The password to the database', 'A column that uniquely identifies each row', 'The first column alphabetically'],
    correct: 1,
    explanation: 'A primary key is unique per row, so every record can be found and referenced exactly.',
  },
  {
    topic: 'errors',
    question: 'What does wrapping code in `try { } catch { }` do?',
    options: ['Lets you handle an error instead of crashing', 'Makes the code run twice', 'Hides the code from the browser'],
    correct: 0,
    explanation: 'If anything inside `try` throws, control jumps to `catch`, where you can recover or report it.',
  },
]

export function isQuiz(value: unknown): value is Quiz {
  if (!value || typeof value !== 'object') return false
  const q = value as Record<string, unknown>
  return (
    typeof q.topic === 'string' &&
    typeof q.question === 'string' &&
    typeof q.explanation === 'string' &&
    Array.isArray(q.options) &&
    q.options.length >= 2 &&
    q.options.length <= 4 &&
    q.options.every((o) => typeof o === 'string' && o.length > 0) &&
    typeof q.correct === 'number' &&
    Number.isInteger(q.correct) &&
    q.correct >= 0 &&
    q.correct < q.options.length &&
    (q.code === undefined || typeof q.code === 'string') &&
    (q.hint === undefined || typeof q.hint === 'string')
  )
}

// The model is asked for bare JSON, but may still wrap it in prose or a fence
export function parseQuiz(text: string): Quiz | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const value: unknown = JSON.parse(text.slice(start, end + 1))
    if (!isQuiz(value)) return null
    const code = value.code?.trim()
    return { ...value, code: code ? code : undefined }
  } catch {
    return null
  }
}

export const SYSTEM = `You write one multiple-choice quiz question that helps a person understand the code an AI assistant is writing for them right now.

Rules:
- Ask about a concept, a reason or a consequence in what the assistant is doing, never about syntax trivia.
- Exactly 3 options, one correct, the wrong ones plausible. Each option under 60 characters.
- The question under 140 characters. Use backticks for code names.
- "code" is optional: at most 6 short lines from the work, only when the question is about that snippet.
- "explanation" is 1-2 plain sentences on why the answer is right.
- "topic" is one or two lowercase words.

Reply with JSON only, no prose and no fence:
{"topic": "...", "question": "...", "code": "...", "options": ["...", "...", "..."], "correct": 0, "explanation": "...", "hint": "..."}`
