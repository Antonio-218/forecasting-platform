/**
 * 充值请求接口
 */
export interface DepositRequest {
  amount: number
}

/**
 * 下注请求接口
 */
export interface BetRequest {
  userId: number
  gameId: string
  amount: number
}

/**
 * 结算请求接口
 */
export interface SettleRequest {
  result: 'WIN' | 'LOSE'
}

/**
 * 对账响应接口
 * 用于管理员对账功能，验证余额一致性
 */
export interface ReconciliationResponse {
  userId: number
  currentBalance: string        // 数据库中的当前余额
  calculatedBalance: string     // 根据账本计算得出的余额
  isConsistent: boolean         // 余额是否一致
  betStats: {
    placed: number              // 已下注数量
    settled: number             // 已结算数量
    cancelled: number           // 已取消数量
  }
  anomalies: string[]           // 异常列表
}

// 下注状态常量
export const BetStatus = {
  PLACED: 'PLACED',
  SETTLED: 'SETTLED',
  CANCELLED: 'CANCELLED',
} as const

export type BetStatus = (typeof BetStatus)[keyof typeof BetStatus]

// 下注结果常量
export const BetResult = {
  WIN: 'WIN',
  LOSE: 'LOSE',
} as const

export type BetResult = (typeof BetResult)[keyof typeof BetResult]

// 账本类型常量
export const LedgerType = {
  BET_DEBIT: 'BET_DEBIT',
  BET_CREDIT: 'BET_CREDIT',
  BET_REFUND: 'BET_REFUND',
  DEPOSIT: 'DEPOSIT',
} as const

export type LedgerType = (typeof LedgerType)[keyof typeof LedgerType]

