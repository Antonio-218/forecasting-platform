import { z } from 'zod'
import { BetResult } from '../types'

// 金额验证：正整数
export const amountSchema = z.number().int().positive()

// 充值请求验证
export const depositSchema = z.object({
  amount: amountSchema,
})

// 下注请求验证
export const betSchema = z.object({
  userId: z.number().int().positive(),
  gameId: z.string().min(1),
  amount: amountSchema,
})

// 结算请求验证
export const settleSchema = z.object({
  result: z.enum([BetResult.WIN, BetResult.LOSE]),
})
