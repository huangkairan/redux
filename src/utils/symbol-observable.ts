declare global {
  interface SymbolConstructor {
    readonly observable: symbol
  }
}
// 调用完函数返回的接口
const $$observable = /* #__PURE__ */ (() =>
  (typeof Symbol === 'function' && Symbol.observable) || '@@observable')()

export default $$observable
