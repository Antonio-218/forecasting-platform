import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * 数据库种子文件
 * 用于初始化数据库的测试数据
 */
async function main() {
  // 使用 upsert 创建或更新用户数据
  // 如果用户名已存在则不更新，不存在则创建
  // 指定固定 ID 确保每次运行后 ID 一致
  const users = await Promise.all([
    prisma.user.upsert({
      where: { username: 'user1' },
      update: {},
      create: {
        id: 1,
        username: 'user1',
        balance: 1000,
      },
    }),
    prisma.user.upsert({
      where: { username: 'user2' },
      update: {},
      create: {
        id: 2,
        username: 'user2',
        balance: 500,
      },
    }),
    prisma.user.upsert({
      where: { username: 'user3' },
      update: {},
      create: {
        id: 3,
        username: 'user3',
        balance: 2000,
      },
    }),
  ])

  console.log('Created users:', users)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
