# Changing the intake questions (for Sarah)

The questions a client answers when they first activate, and the rules that decide which version of the hub they see, are kept in 1 settings file: `public/config/intake.json`. Changing that file changes the hub. No other code needs touching.

## The questions

Each question has:

- `text`: the question as the client sees it.
- `hint`: optional smaller text under the question.
- `type`: `single` for one choice from a list, `text` for a typed answer.
- `options`: for single choice questions, the answers offered. `label` is what the client sees; `value` is a short name the rules use.
- `required`: whether the client must answer.
- `enabled`: set to `false` to stop asking a question without deleting it.

## The rules

Rules are read from the top, and the first rule that fits decides the client type. For example, this rule says that anyone who answers "Managing my health or energy alongside work" sees the health version:

```
{ "when": { "reason": "health" }, "type": "health" }
```

A rule can list more than 1 answer, in square brackets, and it then fits any of them. A rule can also name more than 1 question, and it then fits only when every one matches.

If no rule fits, the client is given no type and you set it from your practitioner page.

## The activation code wins

When you issue a code you can choose the client type. That choice always takes priority over the intake answers while `codeTypeTakesPriority` is `true`. For the ADHD pilot, setting the type on the code is the simplest approach.

## Before a change goes live

Charlotte runs `npm run test:unit`, which checks that every rule points to a real question, a real answer and a real client type.
