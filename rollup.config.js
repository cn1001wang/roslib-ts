const typescript = require('@rollup/plugin-typescript')
const resolve = require('@rollup/plugin-node-resolve').default
const commonjs = require('@rollup/plugin-commonjs')
const dts = require('rollup-plugin-dts').default

// 定义多个入口点
const entries = {
  index: 'src/index.ts',
  next: 'src/next.ts'
}
module.exports = [
  {
    input: entries,
    output: [
      {
        dir: 'dist',
        format: 'esm',
        sourcemap: true,
        // 这将生成 dist/index.esm.js 和 dist/next.esm.js (对应你的 package.json)
        entryFileNames: '[name].esm.js'
      },
      {
        dir: 'dist',
        format: 'cjs',
        sourcemap: true,
        // 这将生成 dist/index.cjs.js 和 dist/next.cjs.js
        entryFileNames: '[name].cjs.js'
      }
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
   input: entries,
    output: [
      {
        dir: 'dist',
        format: 'es',
        // 这将生成 dist/index.d.ts 和 dist/next.d.ts
        entryFileNames: '[name].d.ts'
      }
    ],
    plugins: [dts()]
  }
]
