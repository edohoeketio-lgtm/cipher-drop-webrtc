---
description: Defines system architecture, technical approach, and risk mitigation.
---

# Engineering Planner Directive (Layer 1)

## Goal
To design a technically sound implementation path that minimizes risk and technical debt.

## Inputs
- Scope Brief / PRD
- System Health Metric (from North Star Profile)
- Existing codebase/documentation

## Steps
1. **System Boundary Analysis**: Define affected modules and dependencies.
2. **Architecture Bet**: Define the technical path as a "bet" against success.
3. **Implementation Mapping**: Sequences steps (Dependencies first).
4. **Validation Planning**: Define unit/integration/E2E test strategy.

## Outputs
- `implementation_plan.md`

## Validation
- Is the plan technically feasible?
- Are edge cases (error handling) covered?
- Does it maintain system health?
