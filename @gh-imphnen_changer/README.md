# CMUD 

CMUD is a lightweight command-driven text manipulation engine.  
It allows users to edit, transform, and process text using simple command syntax through CLI or embedded environments (browser playground, UI wrapper, etc).

CMUD focuses on:
- Minimal architecture
- Deterministic command execution
- Extensible command system
- Zero unnecessary abstraction

---

## Philosophy

CMUD is built around one idea:

> Text is state. Commands mutate state.

Instead of procedural editing, CMUD treats text as a persistent state object that can be transformed via commands. Every command produces a new output state.

No hidden magic.  
No implicit side effects.  
Only explicit transformations.

---

## Core Features

- Single text state
- Command parser
- Replace / transform operations
- Deterministic output
- CLI-friendly architecture
- Playground-ready

---

## Architecture Overview

Input Text ↓ Command Parser ↓ Command Executor ↓ Updated Text State ↓ Output

CMUD Core consists of:

1. State Manager
2. Command Parser
3. Command Executor
4. Output Renderer

---

## Basic Example (CLI Version)

When the program starts:

Sample text: Hello world

Enter command:

User types:

replace world universe

Output:

Hello universe

---

## Command Concept

Commands follow a simple structure:
```
<command> <arg1> <arg2> ...
```
Example:

replace hello hi upper lower trim append !!! clear

Each command transforms the internal state.

---

## Minimal CLI Example (Node.js)

```javascript
const readline = require("readline");

let state = "Hello world";

console.log("Text:");
console.log(state);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on("line", (input) => {
  const [cmd, ...args] = input.split(" ");

  if (cmd === "replace") {
    const [from, to] = args;
    state = state.replaceAll(from, to);
  }

  if (cmd === "upper") {
    state = state.toUpperCase();
  }

  console.log("\nUpdated Text:");
  console.log(state);
});

```
---

Extending CMUD

To add a new command:

1. Register command name


2. Define handler


3. Mutate state


4. Return updated state



Example structure:
```javascript
commands["reverse"] = (text) => {
  return text.split("").reverse().join("");
};
```

---

Design Principles

Stateless command execution logic

Clear input → output transformation

No framework dependency

Easy to embed in UI or CLI

Designed to scale into scripting engine



---

Future Roadmap

Persistent state history

Undo / redo

Regex engine

Script mode

Plugin command system

WebAssembly core

Object-based command DSL



---

License

MIT

