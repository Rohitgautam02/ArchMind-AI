# Evidence Graph Specification

## Canonical Runtime Graph

The evidence graph is the canonical state model for all analysis runs.

## Core Types

- EvidenceNode
- EvidenceEdge
- Confidence
- Provenance
- DerivedFact
- Conflict
- Hypothesis
- GraphUpdate
- GraphSnapshot

## Merge Strategy

- Merge by stable identifiers first.
- Merge by provenance equivalence second.
- Preserve all conflicting provenance rather than overwriting it.
- Prefer higher-confidence derived facts only when provenance is not lost.

## Conflict Resolution

- Conflicts should be represented explicitly.
- Conflicts must not be silently dropped.
- The reviewer may accept a conflict when uncertainty is the correct answer.
- The planner may request more evidence when a conflict blocks confidence.

## Confidence Propagation

- Confidence propagates from source facts to derived facts through typed relationships.
- Derived confidence should decay when evidence is indirect or incomplete.
- Confident tool output should be distinguishable from model inference.

## Provenance Tracking

- Every node and edge must store origin metadata.
- Provenance should include source type, tool source, model source, timestamp, and run identifier.
- Provenance must remain attached through merges and snapshots.