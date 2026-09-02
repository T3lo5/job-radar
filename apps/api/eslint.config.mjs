import jobRadarConfig from '@job-radar/eslint-config/node';

export default [
  ...jobRadarConfig,
  {
    ignores: ['dist/**', 'node_modules/**', 'src/generated/**'],
  },
];
