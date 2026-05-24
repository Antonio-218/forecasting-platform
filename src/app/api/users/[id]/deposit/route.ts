import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/services/user.service'
import { checkIdempotency, saveIdempotency, validateIdempotencyAmount } from '@/lib/idempotency'

/**
 * 用户充值接口
 * POST /api/users/:id/deposit
 * 
 * 功能：向用户余额添加资金
 * 需要 Idempotency-Key 请求头支持幂等性
 * 额外验证：相同幂等键的金额必须一致
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = parseInt(params.id)
    const body = await request.json()
    const { amount } = body

    // 验证金额参数
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      )
    }

    const idempotencyKey = request.headers.get('Idempotency-Key')
    const endpoint = `/api/users/${userId}/deposit`

    // 验证幂等键
    if (!idempotencyKey) {
      return NextResponse.json(
        { error: 'Idempotency-Key header is required' },
        { status: 400 }
      )
    }

    // 检查幂等键是否已存在
    const idempotencyCheck = await checkIdempotency(idempotencyKey, endpoint)
    if (idempotencyCheck.exists) {
      // 如果已存在，验证金额是否一致
      const previousResponse = idempotencyCheck.response
      const previousAmount = previousResponse.amount || previousResponse.bet?.amount

      if (previousAmount !== undefined && previousAmount !== amount) {
        return NextResponse.json(
          { error: 'Idempotency key already used with different amount' },
          { status: 409 }
        )
      }

      // 金额一致，返回缓存的响应
      return NextResponse.json(previousResponse)
    }

    // 调用服务层执行充值
    const user = await UserService.deposit(userId, amount)
    const response = {
      id: user.id,
      username: user.username,
      balance: Number(user.balance),
      amount, // 包含金额用于幂等性验证
    }

    // 保存幂等键和响应
    await saveIdempotency(idempotencyKey, endpoint, response)

    return NextResponse.json(response)
  } catch (error) {
    console.error('Deposit error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
