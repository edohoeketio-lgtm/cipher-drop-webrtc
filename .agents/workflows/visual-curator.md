---
description: Visual Curator - Hybrid ChatGPT + Nano Banana Orchestration
---

# Visual Curator Workflow

This workflow orchestrates high-fidelity visual curation by combining the semantic reasoning of **ChatGPT (DALL-E)** with the precision editing and character consistency of **Nano Banana**.

## Objectives
1.  **Extract Hooks**: Identify visual opportunities (quotes, data points, thematic shifts) in the transcript/draft.
2.  **Prompt Engineering**: Use ChatGPT to generate high-context, descriptive prompts for each hook.
3.  **Hybrid Asset Generation**:
    *   **ChatGPT (DALL-E)**: Used for wide-context hero images and complex atmospheric scenes.
    *   **Nano Banana**: Used for consistent character portraits, technical diagrams with text, and high-precision UI/product mockups.
4.  **Curation & Placement**: Final review of generated assets against the content narrative.

## Step-by-Step Logic

### Phase 1: Analytical Mapping (ChatGPT)
1.  Load the `[source_id]_draft.json`.
2.  Analyze the narrative structure for 3-5 "Visual Moments":
    *   Hero (Overall Theme)
    *   Framework (Structural)
    *   Quote (Engagement)
3.  Output a `visual_manifest.json` with specific prompt hints for each.

### Phase 2: High-Fidelity Generation (Hybrid)
// turbo
1.  **For Hero/Atmospheric Assets**: Dispatch to ChatGPT/DALL-E with the context-rich prompt.
2.  **For Character/Text-Heavy Assets**: Dispatch to Nano Banana.
    *   *Note: Use Nano Banana's strength in text rendering for "Concept Diagrams".*
3.  Monitor execution status in the pipeline.

### Phase 3: Final Integration
1.  Update the pipeline metadata with the resulting asset URIs.
2.  Verify visual/text alignment in the `SourceMissionControl` UI.

## Compliance Checklist
- [ ] Assets must maintain thematic consistency.
- [ ] Text in diagrams must be accurate (leverage Nano Banana 2+).
- [ ] All assets must be stored in `.tmp/visual_assets/` for pipeline stability.
