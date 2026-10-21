// What a question is, which files it may come from, and how a model's reply
// becomes one.

export type Quiz = {
  topic: string
  question: string
  code?: string
  options: string[]
  correct: number
  explanation: string
  hint?: string
  // The file the question is about, and a short exact line in it to jump to
  path?: string
  anchor?: string
}

// The files a project's questions may come from: its source, not its data,
// lockfiles or vendored packages
const SOURCE = /\.(py|ts|tsx|js|jsx|mjs|cjs|go|rs|java|rb|swift|kt|cs|cpp|cc|c|h|php|scala|sql)$/
const SKIPPED = /(^|\/)(node_modules|vendor|dist|build|\.venv|venv|__pycache__|migrations)\//

export function isSourceFile(path: string) {
  return SOURCE.test(path) && !SKIPPED.test(path) && !/\.(min|d)\.[a-z]+$/.test(path)
}

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
    (q.hint === undefined || typeof q.hint === 'string') &&
    (q.path === undefined || typeof q.path === 'string') &&
    (q.anchor === undefined || typeof q.anchor === 'string')
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

export const SYSTEM = `You write one multiple-choice quiz question that tests whether a person understands their own code, using the code below from their project.

Ask about one of these, and nothing else:
- the language itself, as used in this code (for example: what initialises this dict, what this comprehension returns, why this is a generator)
- what a specific function, class, step or module in the code does
- how the code connects to things outside it (an API, a broker, a database, a file, storage), as the code shows

Never ask about the AI assistant, its process, planning, tools, prompts, agents, tasks, handoffs, documents, or what it should do next. Never ask about anything the code does not show.

Rules:
- Name the real function, variable or file, in backticks, so the person knows where to look ("In \`load_prices\`, ...").
- Exactly 3 options, one correct, the wrong ones plausible. Each option under 60 characters.
- The question under 140 characters.
- "code" is optional: at most 6 short lines copied from the code below, only when the question is about that snippet.
- "explanation" is 1-2 plain sentences on why the answer is right.
- "topic" is one or two lowercase words naming the concept or the function.
- "path" is the file the question is about, copied exactly from a "Code from" heading below.
- "anchor" is one short line copied exactly from that file's code, where the answer can be seen.

Reply with JSON only, no prose and no fence:
{"topic": "...", "question": "...", "code": "...", "options": ["...", "...", "..."], "correct": 0, "explanation": "...", "hint": "...", "path": "...", "anchor": "..."}`
