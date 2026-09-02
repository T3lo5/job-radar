import jobRadarConfig from '@job-radar/eslint-config/react'

export default [
  ...jobRadarConfig,
  {
    ignores: ['dist/**', 'node_modules/**', '*.d.ts', '*.tsbuildinfo'],
  },
]
