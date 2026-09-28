import { describe, expect, it } from 'vitest'
import { AskParams, CheckParams } from './orchestration/schemas'

const veerCommands = ['veer', 'veer-ide', 'veer-dev'] as const

describe('orchestration CLI command compatibility', () => {
  it.each(veerCommands)('accepts the Veer command %s for check', (command) => {
    expect(CheckParams.parse({ compatibilityCliCommand: command })).toMatchObject({
      compatibilityCliCommand: command
    })
  })

  it.each(veerCommands)('accepts the Veer command %s for ask', (command) => {
    expect(
      AskParams.parse({ question: 'Proceed?', compatibilityCliCommand: command })
    ).toMatchObject({ compatibilityCliCommand: command })
  })

  it('continues accepting legacy Orca command identities', () => {
    expect(CheckParams.parse({ compatibilityCliCommand: 'orca-ide' })).toMatchObject({
      compatibilityCliCommand: 'orca-ide'
    })
  })
})
