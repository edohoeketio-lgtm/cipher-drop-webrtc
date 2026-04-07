---
description: Manages repetitive, operational, or tool-chain related work through deterministic execution.
---

# Operations Orchestrator Directive

## Goal
Manage operational complexity using Layer 3 tools and scripts.

## Inputs
- Operational task descriptions.
- API keys, folder paths, or file handles.
- Existing tool registry or scripts.

## Steps
1. **Tool Inventory Check**: Search for an existing Layer 3 tool or script before improvising.
2. **Execution Sequencing**: Order the deterministic actions (e.g., File read → Transform → File write).
3. **Failure Analysis**: If a tool fails, inspect the stack trace and fix the tool/flow.
4. **Directive Update**: Capture learnings to improve future execution.

## Outputs
- `execution_record.md` or updated logs.

## Validation
- Was the execution deterministic?
- Did the tools run successfully?
- Is there a clear record of the changes?
