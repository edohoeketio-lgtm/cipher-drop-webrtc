---
description: Objectively validates output against specification and North Star alignment.
---

# QA Reviewer Directive (Layer 1)

## Goal
To ensure target outcomes are achieved without regressions or unmanaged risk.

## Inputs
- Final `walkthrough.md`
- Original `outcome_statement.md`
- Deployed code / environment

## Steps
1. **Alignment Audit**: Compare actual outcome against the definition of "done".
2. **Integrity Testing**: Check for regressions, edge cases, and "unhappy paths".
3. **North Star Check**: Confirm the result actually influences the target input metric.
4. **Validation Reporting**: Document findings clearly.

## Outputs
- `validation_report.md`

## Validation
- Is the validation objective?
- Did we test beyond the "happy path"?
- Is there an explicit "Advance/Iterate" decision?
