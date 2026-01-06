const typescript = require('@rollup/plugin-typescript')
const resolve = require('@rollup/plugin-node-resolve').default
const commonjs = require('@rollup/plugin-commonjs')
const dts = require('rollup-plugin-dts').default

module.exports = [
  {
    input: 'src/index.ts',
    output: [
      { file: 'dist/index.esm.js', format: 'esm', sourcemap: true },
      { file: 'dist/index.cjs.js', format: 'cjs', sourcemap: true }
    ],
    plugins: [
      resolve(), 
      commonjs(), 
      typescript({
        tsconfig: './tsconfig.json',
        sourceMap: true,
        declaration: true,
        declarationDir: 'dist/types'
      })
    ]
  },
  {
    input: 'src/index.ts',
    output: [{ file: 'dist/index.d.ts', format: 'es' }],
    plugins: [dts()]
  }
]
