/*
 * @Author: your name
 * @Date: 2020-11-05 15:06:19
 * @LastEditTime: 2021-01-07 14:22:39
 * @LastEditors: your name
 * @Description: In User Settings Edit
 * @FilePath: \vue-2.1.7\src\compiler\index.js
 */
/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'

/**
 * Compile a template.
 * 编译
 */
export function compile (
  template: string,
  options: CompilerOptions
): CompiledResult {
  const ast = parse(template.trim(), options)
  optimize(ast, options)
  const code = generate(ast, options)
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
}
