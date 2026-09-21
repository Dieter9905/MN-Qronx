import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Prisma giả: ghi lại mọi lời gọi để kiểm tra thứ tự xoá dữ liệu con ───
// Test này KHÔNG cần database, nhờ vậy chạy được ở mọi máy/CI.
const state = vi.hoisted(() => ({
  calls: [],
  user: null,
  taskIds: [],
  reminderIds: [],
  deviceIds: [],
  counts: {},
  reset() {
    this.calls = []
    this.user = null
    this.taskIds = []
    this.reminderIds = []
    this.deviceIds = []
    this.counts = {}
  },
}))

vi.mock('../src/config/prisma.js', () => {
  const push = (name) => (args) => state.calls.push({ name, args })
  const del = (name, key) => async (args) => {
    push(name)(args)
    return { count: state.counts[key] ?? 0 }
  }

  const tx = {
    task: {
      findMany: async (args) => {
        push('task.findMany')(args)
        return state.taskIds.map((taskId) => ({ taskId }))
      },
      deleteMany: del('task.deleteMany', 'tasks'),
    },
    reminder: {
      findMany: async (args) => {
        push('reminder.findMany')(args)
        return state.reminderIds.map((reminderId) => ({ reminderId }))
      },
      deleteMany: del('reminder.deleteMany', 'reminders'),
    },
    device: {
      findMany: async (args) => {
        push('device.findMany')(args)
        return state.deviceIds.map((deviceId) => ({ deviceId }))
      },
      deleteMany: del('device.deleteMany', 'devices'),
    },
    category: { deleteMany: del('category.deleteMany', 'categories') },
    notificationLog: { deleteMany: del('notificationLog.deleteMany', 'notificationLogs') },
    invitation: { deleteMany: del('invitation.deleteMany', 'invitations') },
    pointTransaction: { deleteMany: del('pointTransaction.deleteMany', 'pointTransactions') },
    passwordResetRequest: { deleteMany: del('passwordResetRequest.deleteMany', 'passwordResetRequests') },
    refreshToken: { deleteMany: del('refreshToken.deleteMany', 'refreshTokens') },
    customSound: { deleteMany: del('customSound.deleteMany', 'customSounds') },
    notificationSetting: { deleteMany: del('notificationSetting.deleteMany', 'notificationSettings') },
    subtask: { deleteMany: del('subtask.deleteMany', 'subtasks') },
    emailVerificationCode: { deleteMany: del('emailVerificationCode.deleteMany', 'verificationCodes') },
    user: {
      delete: async (args) => {
        push('user.delete')(args)
        return {}
      },
    },
  }

  return {
    default: {
      user: {
        findUnique: async (args) => {
          push('user.findUnique')(args)
          return state.user
        },
      },
      $transaction: async (fn) => fn(tx),
    },
  }
})

const { deleteUser } = await import('../src/services/adminService.js')

const targetUser = {
  userId: 7,
  fullName: 'Nguyễn Văn A',
  email: 'a@example.com',
  role: { roleName: 'USER' },
}

function names() {
  return state.calls.map((c) => c.name)
}

function argsOf(name) {
  return state.calls.find((c) => c.name === name)?.args
}

beforeEach(() => {
  state.reset()
})

describe('adminService.deleteUser', () => {
  it('không cho xoá tài khoản đang đăng nhập', async () => {
    await expect(deleteUser(7, 7)).rejects.toMatchObject({ statusCode: 400 })
    expect(state.calls).toHaveLength(0) // chặn trước khi chạm database
  })

  it('không cho xoá tài khoản Admin khác', async () => {
    state.user = { ...targetUser, role: { roleName: 'ADMIN' } }
    await expect(deleteUser(7, 1)).rejects.toMatchObject({ statusCode: 400 })
    expect(names()).not.toContain('user.delete')
  })

  it('báo 404 khi không tìm thấy người dùng', async () => {
    state.user = null
    await expect(deleteUser(999, 1)).rejects.toMatchObject({ statusCode: 404 })
    expect(names()).not.toContain('user.delete')
  })

  it('xoá toàn bộ dữ liệu con rồi mới xoá tài khoản', async () => {
    state.user = targetUser
    state.taskIds = [11, 12]
    state.reminderIds = [21]
    state.deviceIds = [31]
    state.counts = {
      tasks: 2,
      categories: 3,
      reminders: 1,
      subtasks: 4,
      devices: 1,
      notificationLogs: 2,
      invitations: 1,
      pointTransactions: 5,
      customSounds: 0,
      notificationSettings: 1,
      passwordResetRequests: 1,
      refreshTokens: 2,
      verificationCodes: 3,
    }

    const result = await deleteUser(7, 1)

    expect(result).toMatchObject({ userId: 7, fullName: 'Nguyễn Văn A', email: 'a@example.com' })
    expect(result.deleted).toEqual({
      tasks: 2,
      categories: 3,
      reminders: 1,
      subtasks: 4,
      devices: 1,
      notificationLogs: 2,
      invitations: 1,
      pointTransactions: 5,
      customSounds: 0,
      notificationSettings: 1,
      passwordResetRequests: 1,
      refreshTokens: 2,
      verificationCodes: 3,
    })

    // Tài khoản là bản ghi được xoá CUỐI CÙNG (sau mọi dữ liệu con)
    expect(names().at(-1)).toBe('user.delete')
    expect(argsOf('user.delete')).toEqual({ where: { userId: 7 } })

    // Nhật ký thông báo phải xoá theo cả nhắc nhở lẫn thiết bị của người dùng
    expect(argsOf('notificationLog.deleteMany')).toEqual({
      where: { OR: [{ reminderId: { in: [21] } }, { deviceId: { in: [31] } }] },
    })

    // Lời mời ở cả hai phía (người mời và người được mời)
    expect(argsOf('invitation.deleteMany')).toEqual({
      where: { OR: [{ inviterId: 7 }, { inviteeId: 7 }] },
    })

    // Công việc/danh mục/thiết bị đều giới hạn đúng theo người dùng này
    expect(argsOf('task.deleteMany')).toEqual({ where: { userId: 7 } })
    expect(argsOf('category.deleteMany')).toEqual({ where: { userId: 7 } })
    expect(argsOf('device.deleteMany')).toEqual({ where: { userId: 7 } })

    // Mã xác minh email còn sót → xoá theo email để email đăng ký lại được từ đầu
    expect(argsOf('emailVerificationCode.deleteMany')).toEqual({ where: { email: 'a@example.com' } })

    // Thứ tự: con trước, cha sau
    const order = names()
    expect(order.indexOf('subtask.deleteMany')).toBeLessThan(order.indexOf('task.deleteMany'))
    expect(order.indexOf('reminder.deleteMany')).toBeLessThan(order.indexOf('task.deleteMany'))
    expect(order.indexOf('task.deleteMany')).toBeLessThan(order.indexOf('category.deleteMany'))
    expect(order.indexOf('notificationLog.deleteMany')).toBeLessThan(order.indexOf('user.delete'))
  })

  it('người dùng không có công việc nào vẫn xoá được tài khoản', async () => {
    state.user = targetUser
    state.taskIds = []
    state.reminderIds = []
    state.deviceIds = []

    const result = await deleteUser(7, 1)

    // Không có task/thiết bị → bỏ qua truy vấn theo danh sách rỗng
    expect(names()).not.toContain('notificationLog.deleteMany')
    expect(names()).not.toContain('subtask.deleteMany')
    expect(names().at(-1)).toBe('user.delete')
    expect(result.deleted.notificationLogs).toBe(0)
  })
})
