import { describe, expect, it } from 'vitest'
import type { CommandSpec } from './args'
import { formatCommandHelp } from './help'

describe('CLI command help', () => {
  it('uses Veer branding and treats orchestration check format as a boolean', () => {
    const spec: CommandSpec = {
      path: ['orchestration', 'check'],
      summary: 'Check messages for a terminal',
      usage: 'veer orchestration check [--format]',
      allowedFlags: ['format']
    }

    const help = formatCommandHelp(spec)

    expect(help).toContain('veer orchestration check')
    expect(help).toContain('--format              Render returned rows as local text')
    expect(help).not.toContain('--format <png|jpeg>')
    expect(help).not.toContain('orca orchestration')
  })
})
