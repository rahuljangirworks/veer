// Veer names are canonical; Orca names remain accepted for mixed-version peers.
export const ORCHESTRATION_CLI_COMMANDS = [
  'veer',
  'veer-ide',
  'veer-dev',
  'orca',
  'orca-ide',
  'orca-dev'
] as const

export type OrchestrationCliCommand = (typeof ORCHESTRATION_CLI_COMMANDS)[number]

export const ORCHESTRATION_WINDOWS_CLI_COMMANDS = ['veer', 'veer-ide', 'orca', 'orca-ide'] as const

export type OrchestrationWindowsCliCommand = (typeof ORCHESTRATION_WINDOWS_CLI_COMMANDS)[number]
