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

// Asked when no question about the project's code is ready, in a project
// that is not Python
const GENERAL_BANK: Quiz[] = [
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

// Asked in a Python project when no question about its code is ready
const PYTHON_BANK: Quiz[] = [
  {
    topic: 'dict',
    question: 'Which line makes an empty dictionary?',
    options: ['`x = []`', '`x = {}`', '`x = ()`'],
    correct: 1,
    explanation: '`{}` is an empty dict. `[]` is an empty list and `()` an empty tuple. `dict()` also works.',
  },
  {
    topic: 'dict get',
    question: 'What does `prices.get("BTC", 0)` return when "BTC" is not a key?',
    options: ['It raises `KeyError`', '`None`', '`0`'],
    correct: 2,
    explanation: '`.get` returns its second argument when the key is missing. `prices["BTC"]` would raise `KeyError`.',
  },
  {
    topic: 'set',
    question: 'What does `set()` give you that a list does not?',
    options: ['Each value at most once, with fast `in` checks', 'Values kept in sorted order', 'Values that can never change'],
    correct: 0,
    explanation: 'A set drops duplicates and checks membership in constant time. It keeps no order.',
  },
  {
    topic: 'mutable default',
    question: 'Why is `def add(item, items=[])` a known trap?',
    options: ['Lists cannot be default values', 'The same list is shared by every call', 'It makes `items` read-only'],
    correct: 1,
    explanation: 'Defaults are made once, when the function is defined, so every call appends to the same list. Use `items=None` and create the list inside.',
  },
  {
    topic: 'list comprehension',
    question: 'What is `[p * 2 for p in prices if p > 10]`?',
    options: ['Every price doubled', 'The prices over 10, doubled', 'The count of prices over 10'],
    correct: 1,
    explanation: 'The `if` filters first, then `p * 2` is applied to each item that passed.',
  },
  {
    topic: 'with',
    question: 'What does `with open(path) as f:` guarantee?',
    options: ['The file is closed when the block ends, even on an error', 'The file is opened faster', 'The file is locked for other programs'],
    correct: 0,
    explanation: 'A `with` block calls the context manager’s exit code on the way out, so the file closes even if something raises.',
  },
  {
    topic: 'exceptions',
    question: 'Why is a bare `except:` usually a bad idea?',
    options: ['It is a syntax error in Python 3', 'It only catches `ValueError`', 'It swallows every error, even Ctrl+C and typos'],
    correct: 2,
    explanation: 'A bare `except` catches everything, including `KeyboardInterrupt` and bugs you would want to see. Catch the specific error instead.',
  },
  {
    topic: 'imports',
    question: 'What does `if __name__ == "__main__":` do?',
    options: ['Runs the block only when the file is run directly', 'Runs the block only once per day', 'Makes the file importable'],
    correct: 0,
    explanation: 'When the file is imported, `__name__` is the module name, so the block is skipped. It runs only for `python file.py`.',
  },
  {
    topic: 'f-strings',
    question: 'What does `f"{price:.2f}"` print for `price = 3.14159`?',
    options: ['`3.14159`', '`3.14`', '`3.1`'],
    correct: 1,
    explanation: '`.2f` formats the number as fixed-point with two decimals.',
  },
  {
    topic: 'none',
    question: 'Why write `if x is None:` instead of `if not x:`?',
    options: ['`is` is faster to type', '`not x` is also true for `0`, `""` and `[]`', '`not x` raises an error on `None`'],
    correct: 1,
    explanation: '`not x` treats every falsy value the same. `is None` checks for exactly `None`, so a real `0` is not mistaken for missing.',
  },
  {
    topic: 'async',
    question: 'In Python, what does `await` need to be inside of?',
    options: ['A `class`', 'A `with` block', 'An `async def` function'],
    correct: 2,
    explanation: '`await` only works inside a coroutine, which is a function defined with `async def`.',
  },
  {
    topic: 'type hints',
    question: 'What happens at run time if you pass a string to `def f(n: int)`?',
    options: ['Python raises `TypeError` right away', 'Nothing: hints are not checked when the code runs', 'Python converts it to an int'],
    correct: 1,
    explanation: 'Type hints are for readers and tools like mypy. Python itself does not enforce them.',
  },
  {
    topic: 'slicing',
    question: 'What is `candles[-3:]`?',
    options: ['The last three items', 'Everything except the last three', 'The third item from the end'],
    correct: 0,
    explanation: 'A negative start counts from the end, and an empty stop goes to the end of the list.',
  },
  {
    topic: 'venv',
    question: 'Why use a virtual environment (`venv`)?',
    options: ['It makes Python run faster', 'It gives the project its own installed packages', 'It hides the code from git'],
    correct: 1,
    explanation: 'A venv keeps this project’s packages and versions apart from other projects and the system Python.',
  },
]

// Python unless the files seen so far are all in some other language
export function bankFor(files: readonly string[]): Quiz[] {
  const code = files.filter((f) => /\.(py|ts|tsx|js|jsx|mjs|go|rs|java|rb|swift|kt|cs|cpp|c|php)$/.test(f))
  const isPython = code.length === 0 || code.some((f) => f.endsWith('.py'))
  return isPython ? PYTHON_BANK : GENERAL_BANK
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

Reply with JSON only, no prose and no fence:
{"topic": "...", "question": "...", "code": "...", "options": ["...", "...", "..."], "correct": 0, "explanation": "...", "hint": "..."}`
