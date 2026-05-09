# Native Theme Sync Test

This file helps verify native panel theme behavior.

Expected:
- In native preview with nativeFollowVsCodeTheme=true, theme follows VS Code.
- If nativeLockThemeToggle=true, preview theme toggle is disabled.
- If nativeLockThemeToggle=false, preview theme toggle can be used.

## Light and dark visual anchors

> Light anchor: this callout should remain readable in light mode.

> Dark anchor: switch VS Code theme and confirm contrast remains readable.

## Mermaid color check

:::mermaid
flowchart LR
    L[Light Theme] --> S[Switch VS Code Theme]
    S --> D[Dark Theme]
:::

## Math check

Inline math: $E = mc^2$

Block math:

$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$
