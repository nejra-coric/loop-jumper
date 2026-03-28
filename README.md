# Loop Jumper

**Loop Jumper** is a Doodle Jump–style mini game that runs inside **Visual Studio Code**, in the sidebar—a quick **Developer Break** between coding sessions.

---

## CodeLoop

**[CodeLoop](https://codeloop.ba)** is a mobile development studio. We also build **websites**, **dashboards**, and **integrate software with AI**—end-to-end products for real-world use.

| | |
|---|---|
| **Studio** | [CodeLoop](https://codeloop.ba) |
| **Game** | Loop Jumper |
| **Version** | See `package.json` |

---

## Features

- Arcade climbing game with code-themed platforms and **bug enemies** (NullPointer, Merge Conflict, Memory Leak, …)
- **Skins** — pick a tech mascot before you play (Android, Apple, Swift, Flutter, Python, JS, Kotlin, Rust)
- **Rocket boost** — save any file in the editor while the game is running to get a temporary speed boost
- **Shooting** — clear bugs with your semicolon shots

---

## How to play

### 1. Open the game

1. Install or run this extension in VS Code (see [Development](#development) below).
2. Click the **rocket** icon in the **Activity Bar** on the left.
3. The **Loop Jumper** view opens in the sidebar.

### 2. Start a run

1. On the **Developer Break** menu, **scroll** (mouse wheel) if needed to see all skins.
2. **Click a skin** to select it — the **Play** button appears.
3. Click **Play** (or press **Enter** when Play is available) to start.

### 3. Controls (during play)

| Action | Keys |
|--------|------|
| Move left / right | **A** / **D** or **←** / **→** |
| Shoot | **Space** |
| Rocket boost | **Save** any file (`Cmd+S` / `Ctrl+S`) — works while the game is active |

### 4. Rules & tips

- **Jump** by landing on platforms. Springs bounce you higher; some platforms **move** horizontally.
- **Cracked** platforms break shortly after you land — plan your next jump.
- **Avoid the bugs** — touching one ends the run.
- The camera **only follows you upward**. If you **fall too far** below the view, it’s **Game Over**.
- **Shoot** bugs to score fragment bonus points.

### 5. After Game Over

- **Play again** — restart with the same skin.
- **Main menu** — return to skin selection.

---

## Development

From the project folder:

```bash
npm install
npm run compile
```

Then in VS Code: **Run → Start Debugging** (or **F5**) with **“Run Extension”** to launch an Extension Development Host and test the sidebar game.

To build a `.vsix` for manual install:

```bash
npm install -g @vscode/vsce
vsce package
```

Install the generated `.vsix` via **Extensions → … → Install from VSIX…**.

---

## License

Copyright © CodeLoop. All rights reserved.


