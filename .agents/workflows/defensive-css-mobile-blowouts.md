---
description: How to engineer defensive CSS to prevent mobile viewport blowouts
---
# Defensive CSS Mobile Layout Rules

To ensure we **NEVER** spend time fixing a mobile viewport blowout again, all layout architecture must strictly adhere to these defensive rules before being deployed to production.

## 1. Global Viewport Clamps
The ultimate parent wrappers (e.g. `html`, `body`, and the main `.layout-container`) MUST enforce strict multidimensional boundaries:
```css
html, body {
  overflow-x: hidden;
  width: 100%;
  max-width: 100vw;
  box-sizing: border-box;
}

.main-layout-container {
  width: 100%;             /* CRITICAL: Must be explicitly 100% to prevent scaling beyond body */
  max-width: 800px;        /* Or whatever your desktop bound is */
  box-sizing: border-box;  /* CRITICAL: Prevents padding from inflating width */
  overflow-x: hidden;      /* Prevents nested nodes from causing horizontal scroll */
}
```

## 2. Flex & Grid Child Wrapping
Flex containers are the leading cause of mobile blowouts. If a component uses `display: flex;`:
- Do NOT use hardcoded `min-width: 250px` or rigid boundaries on children without `flex-wrap: wrap;`.
- Use `flex-basis: 100%;` with `min-width: 0;` on inputs or cards to force them to fluidly shrink inside their parent, rather than breaking the container.

## 3. Explicit Padding Instead of Fragile Shorthand
CSS engines can silently drop complex `padding` shorthands containing `clamp()` functions during media query transitions. 
Always define bounding padding explicitly on mobile components:
```css
/* DO THIS: */
padding-left: clamp(1rem, 5vw, 2rem);
padding-right: clamp(1rem, 5vw, 2rem);

/* AVOID THIS ON SCROLL-SENSITIVE CONTAINERS: */
padding: 2rem clamp(1rem, 5vw, 2rem);
```

## 4. Forced Break Words
Text elements containing URLs, massive technical names, or long inline `<code>` blocks will refuse to line-break, blowing out the container:
```css
.article-content {
  overflow-wrap: break-word; /* Prevents long unbreakable strings from expanding the box */
  word-wrap: break-word;
  max-width: 100%;
}
```

By enforcing these constraints during the `agency-ui-ux-architect` phase, mobile layouts are mathematically guaranteed to fluidly shrink and bound their children without triggering horizontal overflow.
