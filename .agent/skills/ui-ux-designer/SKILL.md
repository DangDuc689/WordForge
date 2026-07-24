---
name: ui-ux-designer
description: Usability research-backed design rules, heuristics (Jakob's Law, Fitts's Law, Hick's Law, Thumb Zones), and WCAG 2.2 accessibility verification guidelines.
when_to_use: "When reviewing UI/UX design, evaluating visual interfaces, auditing web components for usability issues, checking accessibility compliance, or critiquing design aesthetics."
---

# UI/UX Usability & Design Guidelines

> **Created by:** Madina Gbotoe (https://madinagbotoe.com/)
> **Purpose:** UI/UX Designer agent skill - Research-backed design critic providing evidence-based guidance and distinctive design direction.

---

## 🎯 Core Usability Heuristics & Research

### 1. User Attention Patterns (Nielsen Norman Group)

*   **F-Pattern Reading** (Eye-tracking studies):
    *   Users read in an F-shaped pattern on text-heavy pages.
    *   First two paragraphs are critical (highest attention).
    *   79% of users scan, only 16% read word-by-word.
    *   *Application:* Front-load important information, use meaningful subheadings.
*   **Left-Side Bias** (NN Group):
    *   Users spend 69% more time viewing the left half of screens.
    *   Left-aligned content receives more attention and engagement.
    *   Navigation on the left outperforms centered or right-aligned.
    *   *Anti-pattern:* Don't center-align body text or navigation.
*   **Banner Blindness**:
    *   Users ignore content that looks like ads.
    *   Keep critical CTAs away from typical banner/ad positions.

### 2. General Interaction Laws

*   **Recognition Over Recall** (Jakob's Law):
    *   Users spend most of their time on other sites. Follow standard conventions unless there is strong evidence to break them.
*   **Fitts's Law**:
    *   Touch targets should be at least 44×44px. Put related actions close together.
*   **Hick's Law** (Choice Overload):
    *   Decision time increases logarithmically with the number of options.
    *   Group related options and use progressive disclosure for >5-7 choices.

### 3. Mobile Behavior Research

*   **Thumb Zones**:
    *   49% of users hold phones with one hand. Bottom third of the screen is the easiest reach zone.
    *   Design for variable grip patterns. Bottom navigation is preferred for primary actions. Avoid putting critical actions in top corners.
*   **Mobile-First Design**:
    *   54%+ of global traffic is mobile. Design for mobile constraints first, then enhance for desktop.

---

## 🤖 AI Interface Patterns (Chat & Copilots)

### 1. Input UX (Prompt & Intent Design)
*   Use text areas that expand with content (auto-grow) rather than fixed single-line inputs.
*   Provide 3-4 contextual suggested prompts to reduce blank-page friction.
*   For complex workflows, visual node editors outperform prose prompts.

### 2. Output UX (Displaying Generative Content)
*   Stream results progressively. Do not display a blank loading state while generating.
*   Use skeleton loaders shaped like the expected output (paragraph skeletons for text, card skeletons for data).
*   Always include an "AI-generated" label with an edit/revision path. Treat outputs as drafts.

### 3. Refinement UX
*   Provide presets or sliders for quick changes (tone, length, formality).
*   Implement context-sensitive action menus when text is highlighted (e.g., Notion AI) instead of relying solely on a global input box.

### 4. Trust & Transparency
*   Show confidence signals when AI is uncertain.
*   Add friction/warnings for high-stakes actions ("Review before sending").
*   Explain the steps the AI took to generate the output (e.g., "Searching docs...").

---

## 🎨 Aesthetics & Design Guidelines

### 1. Typography Selection
*   **Avoid Generic Fonts:** Inter, Roboto, Open Sans, Lato, Montserrat, default system fonts.
*   **Use Monospace/Technical:** JetBrains Mono, Fira Code, Space Mono, IBM Plex Mono.
*   **Use Editorial/Editorial Serif:** Playfair Display, Crimson Pro, Fraunces, Lora.
*   **Use Modern Sans/Startup:** Clash Display, Satoshi, Cabinet Grotesk, Bricolage Grotesque.
*   **Principles:** Use weight extremes (100/200 vs 800/900), make dramatic size jumps (3x+), pair high-contrast fonts (serif + geometric sans).

### 2. Color & Atmospheres
*   **Avoid:** Purple gradients on white (generic SaaS), oversaturated primary blues (like `#0066FF`), timid/flat palettes.
*   **Create Depth:** Use CSS variables for a cohesive theme, commit to dark/light/brutalist modes.
*   **Dark Mode Rules:** Avoid pure black (`#000000`) and pure white (`#FFFFFF`). Use off-white (e.g., `#f0f0f0`) and dark grey surfaces (e.g., `#121212` or `#16213e`) for comfortable reading. Use colored shadows for depth.

### 3. Motion & Transitions
*   Use CSS transitions for states (hover, focus: `transform + box-shadow 0.2s ease-out`).
*   Implement staggered animations for page-load reveals.
*   Respect user preferences: Always wrap animations with the `prefers-reduced-motion` media query.

---

## ♿ Accessibility (WCAG 2.1 & 2.2 AA Compliance)

*   **Keyboard Navigation:** All interactive elements must be accessible via `Tab` / `Enter` / `Esc`.
*   **Color Contrast:** Minimum 4.5:1 for text, 3:1 for UI elements.
*   **Touch Targets:** Minimum 24×24px with spacing, preferred 44×44px.
*   **Focus Visibility (WCAG 2.2 SC 2.4.11):** Focus indicators must not be obscured by sticky headers or popups.
*   **Dragging Alternatives (WCAG 2.2 SC 2.5.7):** Provide click/button options for any drag-and-drop actions.
*   **Accessible Auth (WCAG 2.2 SC 3.3.8):** No cognitive-function tests for login. Allow pasting/password managers.
*   **Redundant Entry (WCAG 2.2 SC 3.3.7):** Auto-populate previously entered data in multi-step forms.

---

## 🔍 Assessment & Critique Methodology

When reviewing a design, structure recommendations in this exact format:

```markdown
**[Issue Name]**
- **What's wrong**: [Specific problem]
- **Why it matters**: [User impact + metric/conversion effect]
- **Research backing**: [NN Group link, usability study, or law]
- **Fix**: [Specific CSS/HTML code or design solution]
- **Priority**: [Critical / High / Medium / Low]
```
