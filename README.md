# Loop Jumper: Code Break

**Loop Jumper: Code Break** is a Doodle Jump–style mini game that runs in the **sidebar** of **Visual Studio Code** and **Cursor**—a quick break between coding sessions. Climb code-themed platforms, dodge bug enemies, and rack up your score.

---

## Install

### From the Marketplace (recommended)

1. Open **Visual Studio Code** or **Cursor**.
2. Open the **Extensions** view (`Ctrl+Shift+X` / `Cmd+Shift+X`).
3. Search for **Loop Jumper: Code Break** (or **CodeLoop** / **loop jumper**).
4. Click **Install** on the extension published by **StudioCodeLoop**.
5. Reload the editor if prompted.

After installation, look for the **Loop Jumper** icon in the **Activity Bar** (left). Hover shows **Code Break**—click it to open the game panel.

### From a `.vsix` file

1. Download the packaged extension (`loop-jumper-<version>.vsix`).
2. In VS Code / Cursor: **Extensions** → **⋯** (Views and More Actions) → **Install from VSIX…**.
3. Select the `.vsix` file and confirm.
4. Reload if asked, then use the Activity Bar icon as above.

### Run from source (developers)

```bash
npm install
npm run compile
```

Press **F5** in VS Code with **Run Extension** to debug locally. To build a package:

```bash
npx @vscode/vsce package
```

The output filename is `loop-jumper-<version>.vsix` (version comes from `package.json`).

---

## How to play

### Open the game

1. Click the **Loop Jumper** icon in the **Activity Bar** (left side).
2. The **Loop Jumper · Code Break** view opens in the sidebar.

### Start a run

1. **Scroll** the skin list if needed (mouse wheel).
2. **Click a skin** to select it — **Play** appears.
3. Click **Play**, or press **Enter** when Play is focused.

### Controls

| Action | Input |
|--------|--------|
| Move left / right | **A** / **D** or **←** / **→** |
| Shoot | **Space** |
| Rocket boost | **Save** the active file (**Ctrl+S** / **Cmd+S**) while playing |

Click the game canvas once if keys don’t respond (focus).

### Rules & tips

- Land on platforms to **jump**; **springs** bounce higher; some platforms **move** sideways.
- **Cracked** platforms collapse shortly after you land—plan the next jump.
- **Bugs** (e.g. NullPointer, Merge Conflict) **end the run** on contact—avoid or **shoot** them.
- The view **only follows you upward**—if you **fall too far** below the screen, it’s **Game Over**.
- Shooting bugs adds **bonus** points to your score.

### After Game Over

- **Play again** — same skin, new run.
- **Main menu** — change skin or return to the title screen.

---

## Features

- Arcade climbing with **syntax-themed** platforms and **bug** enemies  
- **Skins** — Android, Apple, Swift, Flutter, Python, JS, Kotlin, Rust  
- **Rocket boost** when you **save** a file (fits the “save often” habit)  
- **Shoot** enemies with semicolon shots  
- Audio feedback for jumps, shots, and game over  

---

## About CodeLoop

We are a **team of passionate developers and designers**.

**CodeLoop** is a software development agency specializing in **exceptional digital experiences**. We combine **technical expertise** with **creative design** to deliver solutions that **drive business growth**—from **mobile apps** and **websites** to **dashboards** and **AI-integrated** software.

| | |
|---|---|
| **Studio** | [CodeLoop](https://codeloop.ba) |
| **Extension** | Loop Jumper: Code Break |
| **Publisher** | StudioCodeLoop |

**[Learn more →](https://codeloop.ba)**

---

## License

Copyright © CodeLoop.
