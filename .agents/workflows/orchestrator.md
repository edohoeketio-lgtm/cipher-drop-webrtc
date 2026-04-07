---
description: The Master Workflow Orchestrator (v2) - North Star Alignment & 3-Layer Execution Architecture
---

# Master Workflow Orchestrator (v2)

This workflow implements a North-Star-aligned, specialist-routed lifecycle using a 3-layer architecture.

## Sequence: NORTH STAR → IDEA → OUTCOME → SYSTEM → PHASE → ROLE → DIRECTIVE → EXECUTION → VALIDATION → ITERATION

### 1. NORTH STAR (Strategic Alignment)
- **Role**: Product Framer
- **Action**: Check for or infer a `north_star_profile.md`. Tie work to North Star inputs.
- **Goal**: Align daily work with customer value and product "game".

### 2. IDEA (Clarify Intent)
- **Role**: Product Framer
- **Action**: Interpret intent, surface assumptions.
- **Artifact**: `idea_brief.md`

### 3. OUTCOME (Define Success)
- **Role**: Product Framer
- **Action**: Define concrete end state.
- **Artifact**: `outcome_statement.md`

### 4. SYSTEM (Classification)
- **Action**: Classify the dominant system (Research, Product, UX, UI, Engineering, etc.).

### 5. PHASE & ROLE (Identify Stage)
- **Action**: Determine maturity and lead specialist mindset.
- **Specialists**: Research Analyst, Product Framer, UX Architect, UI Designer, Engineering Planner, Builder, QA Reviewer, Security Analyst, Release Manager, Technical Writer, Launch Communicator, Operations Orchestrator.

### 6. DIRECTIVE (Layer 1)
- **Action**: Select/Create natural-language operating instructions (SOP-style).
- **Location**: `~/.agents/workflows/[role].md`

### 7. EXECUTION (Layer 3)
- **Action**: Use deterministic tools, scripts, or structured mechanisms.
- **Rule**: Prefer deterministic execution for repeatable operations.

### 8. VALIDATION (Check Quality)
- **Role**: QA Reviewer
- **Action**: Validate clarity, completeness, feasibility, and North Star alignment.
- **Artifact**: `validation_report.md`

### 9. ITERATION (Refine)
- **Action**: Step back or revise if output is weak or misaligned.

---

## 3-Layer Architecture
- **Layer 1: Directive**: Natural-language SOPs.
- **Layer 2: Orchestration**: Interpretation, sequence, and routing (This workflow).
- **Layer 3: Execution**: Deterministic tools and scripts.

## Doctrine
- **Think North Star**: No unaligned bets.
- **Directives First**: No improvised manual reasoning for repeatable work.
- **Validation-Locked**: Every phase must be validated.
