# quizwhile

A Claude Code mod that quizzes you while Claude works. A few seconds into a
turn, a multiple-choice question appears in the band above the prompt, about
what Claude is building right now. Answer it, skip it or collapse it; it steps
aside when Claude needs you and keeps an unanswered question for the next turn.

![quizwhile in Claude Code Desktop](docs/preview.png)

Questions are written by Haiku from your request and Claude's recent tool
calls. When none is ready in time, one comes from a small built-in bank.
Questions you miss come back later.

This first version draws in Claude Code Desktop only.

## Install

In Claude Code, run:

```
/plugin install quizwhile --marketplace ediprodan/quizwhile
```

Then start a new session. The quiz is on by default.

## Commands

- `/quizwhile off` turns it off
- `/quizwhile` turns it back on

## Requirements

- Claude Code Desktop, recent enough to load mods (function hooks)
- Each generated question is a small Haiku call on your account

## Layout

- `hooks/register.tsx`: the hooks module (turn timing, the band, the command)
- `hooks/quiz.ts`: the question type, the built-in bank and the prompt for Haiku
- `tests/band.test.tsx`: tests run by `claude plugin test`
- `.claude-plugin/marketplace.json`: lets `/plugin install` find it in this repository
