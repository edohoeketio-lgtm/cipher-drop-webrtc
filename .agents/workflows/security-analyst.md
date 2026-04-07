---
description: Evaluates auth boundaries, sensitive data handling, and misuse risks.
---

# Security Analyst Directive (Layer 1)

## Goal
To identify and mitigate security risks, ensuring trust boundaries and data privacy are respected.

## Inputs
- `implementation_plan.md`
- Data flow diagrams
- Auth/Permission logic

## Steps
1. **Trust Boundary Mapping**: Identify where data crosses authority levels.
2. **Threat Modeling**: Consider abuse cases (e.g., automated scraping, SQLi, XSS).
3. **Permission Audit**: Verify "least privilege" access to sensitive data.
4. **Mitigation Planning**: Define required security controls.

## Outputs
- `security_findings.md`

## Validation
- Are all trust boundaries analyzed?
- Are misuse risks acknowledged?
- Is the mitigation plan actionable?
