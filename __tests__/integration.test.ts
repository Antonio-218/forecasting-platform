import { PrismaClient } from '@prisma/client'
import { UserService } from '../src/lib/services/user.service'
import { BetService } from '../src/lib/services/bet.service'
import { LedgerService } from '../src/lib/services/ledger.service'

const prisma = new PrismaClient()

describe('Forecasting Platform Integration Tests', () => {
  beforeEach(async () => {
    await prisma.ledger.deleteMany()
    await prisma.bet.deleteMany()
    await prisma.idempotencyKey.deleteMany()
    await prisma.user.deleteMany()

    await prisma.user.create({
      data: {
        username: 'testuser1',
        balance: 1000,
        ledgers: {
          create: {
            type: 'DEPOSIT',
            amount: 1000,
            description: 'Initial balance',
          },
        },
      },
    })

    await prisma.user.create({
      data: {
        username: 'testuser2',
        balance: 500,
        ledgers: {
          create: {
            type: 'DEPOSIT',
            amount: 500,
            description: 'Initial balance',
          },
        },
      },
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('1. 充值成功后余额正确增加', async () => {
    const user = await prisma.user.findFirst({ where: { username: 'testuser1' } })
    if (!user) throw new Error('User not found')

    const initialBalance = Number(user.balance)
    const depositAmount = 500

    const updatedUser = await UserService.deposit(user.id, depositAmount)

    expect(Number(updatedUser.balance)).toBe(initialBalance + depositAmount)
  })

  test('2. 充值幂等性验证（多次请求，一次生效）', async () => {
    const user = await prisma.user.findFirst({ where: { username: 'testuser1' } })
    if (!user) throw new Error('User not found')

    const initialBalance = Number(user.balance)
    const idempotencyKey = 'test-deposit-key-123'
    const depositAmount = 200

    await UserService.deposit(user.id, depositAmount)

    await prisma.idempotencyKey.create({
      data: {
        key: idempotencyKey,
        operation: '/api/users/test/deposit',
        requestHash: 'test-hash-123',
        statusCode: 200,
        response: JSON.stringify({ amount: depositAmount }),
      },
    })

    const userAfter = await prisma.user.findUnique({ where: { id: user.id } })
    expect(Number(userAfter!.balance)).toBe(initialBalance + depositAmount)
  })

  test('3. 余额不足时，下注应当失败', async () => {
    const user = await prisma.user.findFirst({ where: { username: 'testuser2' } })
    if (!user) throw new Error('User not found')

    const betAmount = Number(user.balance) + 1000

    await expect(BetService.placeBet(user.id, 'game-001', betAmount)).rejects.toThrow(
      'Insufficient balance'
    )
  })

  test('4. 下注操作的幂等性验证', async () => {
    const user = await prisma.user.findFirst({ where: { username: 'testuser1' } })
    if (!user) throw new Error('User not found')

    const initialBalance = Number(user.balance)
    const betAmount = 100

    const bet = await BetService.placeBet(user.id, 'game-002', betAmount)

    await prisma.idempotencyKey.create({
      data: {
        key: 'test-bet-key-456',
        operation: '/api/bets',
        requestHash: 'test-hash-456',
        statusCode: 201,
        response: JSON.stringify({ betId: bet.id, amount: betAmount }),
      },
    })

    const userAfter = await prisma.user.findUnique({ where: { id: user.id } })
    expect(Number(userAfter!.balance)).toBe(initialBalance - betAmount)
  })

  test('5. 结算为 WIN 时，余额正确增加', async () => {
    const user = await prisma.user.findFirst({ where: { username: 'testuser1' } })
    if (!user) throw new Error('User not found')

    const initialBalance = Number(user.balance)
    const betAmount = 100

    const bet = await BetService.placeBet(user.id, 'game-003', betAmount)
    const settledBet = await BetService.settleBet(bet.id, 'WIN')
    const payout = betAmount * 2

    const userAfter = await prisma.user.findUnique({ where: { id: user.id } })
    expect(Number(userAfter!.balance)).toBe(initialBalance - betAmount + payout)
    expect(settledBet.status).toBe('SETTLED')
  })

  test('6. 已结算订单不允许重复结算', async () => {
    const user = await prisma.user.findFirst({ where: { username: 'testuser1' } })
    if (!user) throw new Error('User not found')

    const betAmount = 50

    const bet = await BetService.placeBet(user.id, 'game-004', betAmount)
    await BetService.settleBet(bet.id, 'LOSE')

    await expect(BetService.settleBet(bet.id, 'WIN')).rejects.toThrow(
      'can only be settled from PLACED status'
    )
  })

  test('7. 取消订单应执行退款', async () => {
    const user = await prisma.user.findFirst({ where: { username: 'testuser1' } })
    if (!user) throw new Error('User not found')

    const initialBalance = Number(user.balance)
    const betAmount = 150

    const bet = await BetService.placeBet(user.id, 'game-005', betAmount)
    const cancelledBet = await BetService.cancelBet(bet.id)

    const userAfter = await prisma.user.findUnique({ where: { id: user.id } })
    expect(Number(userAfter!.balance)).toBe(initialBalance)
    expect(cancelledBet.status).toBe('CANCELLED')
  })

  test('8. 账本余额计算一致性验证', async () => {
    const user = await prisma.user.findFirst({ where: { username: 'testuser1' } })
    if (!user) throw new Error('User not found')

    const dbBalance = Number(user.balance)
    const ledgerBalance = await LedgerService.calculateBalance(user.id)

    expect(dbBalance).toBe(ledgerBalance)
  })

  test('9. 状态机流转验证：PLACED -> CANCELLED', async () => {
    const user = await prisma.user.findFirst({ where: { username: 'testuser1' } })
    if (!user) throw new Error('User not found')

    const bet = await BetService.placeBet(user.id, 'game-006', 100)
    expect(bet.status).toBe('PLACED')

    const cancelledBet = await BetService.cancelBet(bet.id)
    expect(cancelledBet.status).toBe('CANCELLED')
  })

  test('10. 状态机流转验证：PLACED -> SETTLED', async () => {
    const user = await prisma.user.findFirst({ where: { username: 'testuser1' } })
    if (!user) throw new Error('User not found')

    const bet = await BetService.placeBet(user.id, 'game-007', 100)
    expect(bet.status).toBe('PLACED')

    const settledBet = await BetService.settleBet(bet.id, 'LOSE')
    expect(settledBet.status).toBe('SETTLED')
  })
})
