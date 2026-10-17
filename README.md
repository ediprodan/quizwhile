# quizwhile

A Claude Code mod that quizzes you while Claude works. A few seconds into a
turn, a multiple-choice question appears in the band above the prompt, about
what Claude is building right now. Answer it, skip it or collapse it; it steps
aside when Claude needs you and keeps an unanswered question for the next turn.

Questions are written by Haiku from your request and Claude's recent tool
calls. When none is ready in time, one comes from a small built-in bank.
Questions you miss come back later.

This first version draws in Claude Code Desktop only.

## Commands

- `/quizwhile off` turns it off
- `/quizwhile` turns it back on

## Developing

Load it from this folder by naming it in `CLAUDE_CODE_PLUGIN_DIRS` (in the
`env` block of `~/.claude/settings.json`), then:

```bash
claude plugin validate .
```

```bash
claude plugin test .
```

## Layout

- `hooks/register.tsx`: the hooks module (turn timing, the band, the command)
- `hooks/quiz.ts`: the question type, the built-in bank and the prompt for Haiku
- `tests/band.test.tsx`: tests run by `claude plugin test`
# quizwhile
