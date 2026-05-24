import { prisma } from './prisma'
import { createHash } from 'crypto'

/**
 * 检查幂等键是否存在
 * @param idempotencyKey - 幂等键，由客户端生成
 * @param operation - 操作类型/端点路径
 * @param requestHash - 请求内容的哈希值，用于验证请求一致性
 * @returns 如果幂等键存在，返回缓存的响应；否则返回不存在
 */
export async function checkIdempotency(
  idempotencyKey: string,
  operation: string,
  requestHash: string
): Promise<{ exists: boolean; response?: any; statusCode?: number }> {
  const record = await prisma.idempotencyKey.findUnique({
    where: {
      operation_key: {
        operation,
        key: idempotencyKey,
      },
    },
  })

  if (record) {
    // 验证请求哈希是否一致
    if (record.requestHash !== requestHash) {
      throw new Error('Idempotency key already used with different request content')
    }

    return {
      exists: true,
      response: JSON.parse(record.response),
      statusCode: record.statusCode,
    }
  }

  return { exists: false }
}

/**
 * 保存幂等键和响应
 * @param idempotencyKey - 幂等键
 * @param operation - 操作类型/端点路径
 * @param requestHash - 请求内容的哈希值
 * @param statusCode - HTTP 状态码
 * @param response - 要缓存的响应对象
 */
export async function saveIdempotency(
  idempotencyKey: string,
  operation: string,
  requestHash: string,
  statusCode: number,
  response: any
): Promise<void> {
  await prisma.idempotencyKey.create({
    data: {
      key: idempotencyKey,
      operation,
      requestHash,
      statusCode,
      response: JSON.stringify(response),
    },
  })
}

/**
 * 验证幂等键的金额一致性
 * 防止客户端使用相同的幂等键但不同的金额进行请求
 * @param idempotencyKey - 幂等键
 * @param operation - 操作类型/端点路径
 * @param requestHash - 请求内容的哈希值
 * @param newAmount - 新请求的金额
 * @returns 如果金额一致或幂等键不存在，返回有效；否则返回无效
 */
export async function validateIdempotencyAmount(
  idempotencyKey: string,
  operation: string,
  requestHash: string,
  newAmount: number
): Promise<{ valid: boolean; error?: string }> {
  const record = await prisma.idempotencyKey.findUnique({
    where: {
      operation_key: {
        operation,
        key: idempotencyKey,
      },
    },
  })

  if (!record) {
    return { valid: true }
  }

  // 验证请求哈希是否一致
  if (record.requestHash !== requestHash) {
    return {
      valid: false,
      error: 'Idempotency key already used with different request content',
    }
  }

  const previousResponse = JSON.parse(record.response)
  const previousAmount = previousResponse.amount || previousResponse.bet?.amount

  if (previousAmount !== undefined && previousAmount !== newAmount) {
    return {
      valid: false,
      error: 'Idempotency key already used with different amount',
    }
  }

  return { valid: true }
}

/**
 * 生成请求内容的哈希值
 * @param requestBody - 请求体对象
 * @returns SHA-256 哈希值的十六进制字符串
 */
export function generateRequestHash(requestBody: any): string {
  const jsonString = JSON.stringify(requestBody)
  return createHash('sha256').update(jsonString).digest('hex')
}
