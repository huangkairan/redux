import { AnyAction, Action } from './types/actions'
import {
  ActionFromReducersMapObject,
  Reducer,
  ReducersMapObject,
  StateFromReducersMapObject
} from './types/reducers'
import { CombinedState } from './types/store'

import ActionTypes from './utils/actionTypes'
import isPlainObject from './utils/isPlainObject'
import warning from './utils/warning'
// 未定义报错
function getUndefinedStateErrorMessage(key: string, action: Action) {
  const actionType = action && action.type
  const actionDescription =
    (actionType && `action "${String(actionType)}"`) || 'an action'

  return (
    `Given ${actionDescription}, reducer "${key}" returned undefined. ` +
    `To ignore an action, you must explicitly return the previous state. ` +
    `If you want this reducer to hold no value, you can return null instead of undefined.`
  )
}

function getUnexpectedStateShapeWarningMessage(
  inputState: object,
  reducers: ReducersMapObject,
  action: Action,
  unexpectedKeyCache: { [key: string]: true }
) {
  // 拿reducer的key
  const reducerKeys = Object.keys(reducers)
  // 判断是否在初始化
  const argumentName =
    action && action.type === ActionTypes.INIT
      ? 'preloadedState argument passed to createStore'
      : 'previous state received by the reducer'
  // 没传reducer报错
  if (reducerKeys.length === 0) {
    return (
      'Store does not have a valid reducer. Make sure the argument passed ' +
      'to combineReducers is an object whose values are reducers.'
    )
  }
  // 判断是否普通对象
  if (!isPlainObject(inputState)) {
    const match = Object.prototype.toString
      .call(inputState)
      .match(/\s([a-z|A-Z]+)/)
    const matchType = match ? match[1] : ''
    return (
      `The ${argumentName} has unexpected type of "` +
      matchType +
      `". Expected argument to be an object with the following ` +
      `keys: "${reducerKeys.join('", "')}"`
    )
  }
  // 拿inputState中有，reducer中没有的key
  const unexpectedKeys = Object.keys(inputState).filter(
    key => !reducers.hasOwnProperty(key) && !unexpectedKeyCache[key]
  )
  // 给这些key一个值
  unexpectedKeys.forEach(key => {
    unexpectedKeyCache[key] = true
  })
  // 判断actiontype是否为了重置
  if (action && action.type === ActionTypes.REPLACE) return
  // 再次判断有没有漏掉的inputState中有，reducer中无的key
  if (unexpectedKeys.length > 0) {
    return (
      `Unexpected ${unexpectedKeys.length > 1 ? 'keys' : 'key'} ` +
      `"${unexpectedKeys.join('", "')}" found in ${argumentName}. ` +
      `Expected to find one of the known reducer keys instead: ` +
      `"${reducerKeys.join('", "')}". Unexpected keys will be ignored.`
    )
  }
}

// 初始化reducer 判断传入的reducers是否合法
function assertReducerShape(reducers: ReducersMapObject) {
  Object.keys(reducers).forEach(key => {
    // 拿到每个reducer，并初始化
    const reducer = reducers[key]
    const initialState = reducer(undefined, { type: ActionTypes.INIT })
    // 如果返回值是undefined报错
    if (typeof initialState === 'undefined') {
      throw new Error(
        `Reducer "${key}" returned undefined during initialization. ` +
          `If the state passed to the reducer is undefined, you must ` +
          `explicitly return the initial state. The initial state may ` +
          `not be undefined. If you don't want to set a value for this reducer, ` +
          `you can use null instead of undefined.`
      )
    }
    // 如果reducer返回的值是undefined报错
    // 和这句作用一样 const initialState = reducer(undefined, { type: ActionTypes.INIT })
    if (
      typeof reducer(undefined, {
        type: ActionTypes.PROBE_UNKNOWN_ACTION()
      }) === 'undefined'
    ) {
      throw new Error(
        `Reducer "${key}" returned undefined when probed with a random type. ` +
          `Don't try to handle ${ActionTypes.INIT} or other actions in "redux/*" ` +
          `namespace. They are considered private. Instead, you must return the ` +
          `current state for any unknown actions, unless it is undefined, ` +
          `in which case you must return the initial state, regardless of the ` +
          `action type. The initial state may not be undefined, but can be null.`
      )
    }
  })
}

/**
 * Turns an object whose values are different reducer functions, into a single
 * reducer function. It will call every child reducer, and gather their results
 * into a single state object, whose keys correspond to the keys of the passed
 * reducer functions.
 *
 * @template S Combined state object type.
 *
 * @param reducers An object whose values correspond to different reducer
 *   functions that need to be combined into one. One handy way to obtain it
 *   is to use ES6 `import * as reducers` syntax. The reducers may never
 *   return undefined for any action. Instead, they should return their
 *   initial state if the state passed to them was undefined, and the current
 *   state for any unrecognized action.
 *
 * @returns A reducer function that invokes every reducer inside the passed
 *   object, and builds a state object with the same shape.
 */
export default function combineReducers<S>(
  reducers: ReducersMapObject<S, any>
): Reducer<CombinedState<S>>
export default function combineReducers<S, A extends Action = AnyAction>(
  reducers: ReducersMapObject<S, A>
): Reducer<CombinedState<S>, A>
export default function combineReducers<M extends ReducersMapObject>(
  reducers: M
): Reducer<
  CombinedState<StateFromReducersMapObject<M>>,
  ActionFromReducersMapObject<M>
>
// 组合所有reducer
export default function combineReducers(reducers: ReducersMapObject) {
  // 拿到所有reducer的key
  const reducerKeys = Object.keys(reducers)
  // 用一个对象来存储最终的reducer
  const finalReducers: ReducersMapObject = {}
  // 遍历
  for (let i = 0; i < reducerKeys.length; i++) {
    // 拿key
    const key = reducerKeys[i]
    // 判断是否生产环境，如果不是有报错警告
    if (process.env.NODE_ENV !== 'production') {
      if (typeof reducers[key] === 'undefined') {
        warning(`No reducer provided for key "${key}"`)
      }
    }
    // 是function（dispatch）就存入最终的reducer
    if (typeof reducers[key] === 'function') {
      finalReducers[key] = reducers[key]
    }
  }
  // 拿到处理后的reducer的key
  const finalReducerKeys = Object.keys(finalReducers)

  // This is used to make sure we don't warn about the same
  // keys multiple times.
  let unexpectedKeyCache: { [key: string]: true }
  // 判断是否生产环境，不是就赋值为空对象
  if (process.env.NODE_ENV !== 'production') {
    unexpectedKeyCache = {}
  }
  // 报错
  let shapeAssertionError: Error
  try {
    // 初始化reducer，判断是否合法
    assertReducerShape(finalReducers)
  } catch (e) {
    // 捕获error
    shapeAssertionError = e
  }

  return function combination(
    state: StateFromReducersMapObject<typeof reducers> = {},
    action: AnyAction
  ) {
    // 如果有error 抛出
    if (shapeAssertionError) {
      throw shapeAssertionError
    }
    // 判断是否生产环境，警告信息
    if (process.env.NODE_ENV !== 'production') {
      const warningMessage = getUnexpectedStateShapeWarningMessage(
        state,
        finalReducers,
        action,
        unexpectedKeyCache
      )
      if (warningMessage) {
        warning(warningMessage)
      }
    }
    // 是否改变boolean，两个state
    let hasChanged = false
    const nextState: StateFromReducersMapObject<typeof reducers> = {}
    // 遍历最终的reducer的
    for (let i = 0; i < finalReducerKeys.length; i++) {
      // 拿key
      const key = finalReducerKeys[i]
      // 拿每个reducer
      const reducer = finalReducers[key]
      // 拿state中对应的key
      const previousStateForKey = state[key]
      // 对state中的key做dispatch
      const nextStateForKey = reducer(previousStateForKey, action)
      // 如果取到空值 error
      if (typeof nextStateForKey === 'undefined') {
        const errorMessage = getUndefinedStateErrorMessage(key, action)
        throw new Error(errorMessage)
      }
      // 如果没取到空值就存入新state
      nextState[key] = nextStateForKey
      // 重新赋值是否改变boolean，判断两个state的key是否相等
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey
    }
    // 再次赋值是否改变boolean，根据最终reducer的key的长度和新state的key长度是否相等
    hasChanged =
      hasChanged || finalReducerKeys.length !== Object.keys(state).length
    // 根据是否改变boolean来选择返回新旧state
    return hasChanged ? nextState : state
  }
}
