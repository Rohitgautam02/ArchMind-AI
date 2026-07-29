# Policy Framework Specification

## Policy Interfaces

- PrivacyPolicy
- RetryPolicy
- ProviderSelectionPolicy
- SecurityPolicy
- ReviewPolicy
- ExecutionPolicy

## Policy Design Rules

- policies must be injectable
- policies must be versioned
- policies must be composable
- policies must not depend on concrete runtime services

## Failure Cases

- conflicting policy decisions
- missing policy binding
- invalid policy version

## Retry Strategy

- re-evaluate when runtime context changes
- fallback to stricter policy when ambiguity exists