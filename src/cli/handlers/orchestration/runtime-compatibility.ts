import { RuntimeClientError } from '../../runtime-client'
import {
  ORCHESTRATION_CLI_COMMANDS,
  ORCHESTRATION_WINDOWS_CLI_COMMANDS,
  type OrchestrationCliCommand,
  type OrchestrationWindowsCliCommand
} from '../../../shared/orchestration-cli-command'

export function resolveCompatibilityCliCommand(): OrchestrationCliCommand {
  const configured = (process.env.VEER_CLI_COMMAND ?? process.env.ORCA_CLI_COMMAND)?.trim()
  if (configured && ORCHESTRATION_CLI_COMMANDS.includes(configured as OrchestrationCliCommand)) {
    return configured as OrchestrationCliCommand
  }
  return 'veer'
}

export function resolvePackagedWindowsCompatibilityCommand():
  | OrchestrationWindowsCliCommand
  | undefined {
  if (process.env.ORCA_WINDOWS_PACKAGED_CLI_LAUNCHER !== '1') {
    return undefined
  }
  const command = (process.env.VEER_CLI_COMMAND ?? process.env.ORCA_CLI_COMMAND)?.trim()
  if (
    command &&
    ORCHESTRATION_WINDOWS_CLI_COMMANDS.includes(command as OrchestrationWindowsCliCommand)
  ) {
    return command as OrchestrationWindowsCliCommand
  }
  throw new RuntimeClientError(
    'invalid_argument',
    'The packaged Veer launcher did not provide a valid resume command. No question was created.'
  )
}

export async function flushOrchestrationStdout(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    process.stdout.write('', (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

export function isDevCliInvocation(): boolean {
  return (
    process.env.ORCA_DEV_CLI_INVOCATION === '1' ||
    (process.env.ORCA_USER_DATA_PATH?.includes('orca-dev') ?? false)
  )
}
