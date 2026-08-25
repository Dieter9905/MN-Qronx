import swaggerJsdoc from 'swagger-jsdoc'

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TaskAlarm API',
      version: '1.0.0',
      description: 'REST API cho ứng dụng quản lý thời gian & công việc với nhắc nhở kiểu báo thức',
      contact: {
        name: 'TaskAlarm Team',
      },
    },
    servers: [
      {
        url: '/api/v1',
        description: 'API v1',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Thao tác thành công' },
            data: { type: 'object' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Thông tin đầu vào không hợp lệ' },
            errors: {
              type: 'object',
              additionalProperties: { type: 'string' },
              example: { title: 'Tiêu đề không được để trống' },
            },
          },
        },
        RegisterRequest: {
          type: 'object',
          required: ['fullName', 'email', 'password'],
          properties: {
            fullName: { type: 'string', example: 'Nguyen Van A' },
            email: { type: 'string', format: 'email', example: 'a@example.com' },
            password: { type: 'string', minLength: 6, maxLength: 50, example: 'Passw0rd!' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'a@example.com' },
            password: { type: 'string', example: 'Passw0rd!' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            accessToken: { type: 'string', example: 'eyJhbGciOi...' },
            user: {
              type: 'object',
              properties: {
                userId: { type: 'integer', example: 12 },
                fullName: { type: 'string', example: 'Nguyen Van A' },
                email: { type: 'string', example: 'a@example.com' },
                role: { type: 'string', enum: ['USER', 'ADMIN'], example: 'USER' },
              },
            },
          },
        },
        TaskRequest: {
          type: 'object',
          required: ['title', 'dueAt', 'priority'],
          properties: {
            title: { type: 'string', maxLength: 255, example: 'Ôn tập môn Toán' },
            description: { type: 'string', example: 'Chương 3 - Đạo hàm' },
            categoryId: { type: 'integer', example: 3 },
            priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], example: 'HIGH' },
            dueAt: { type: 'string', format: 'date-time', example: '2026-08-20T20:00:00+07:00' },
            repeatType: { type: 'string', enum: ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'], default: 'NONE' },
            reminders: {
              type: 'array',
              maxItems: 5,
              items: {
                type: 'object',
                properties: {
                  remindAt: { type: 'string', format: 'date-time', example: '2026-08-20T19:00:00+07:00' },
                },
              },
            },
          },
        },
        TaskResponse: {
          type: 'object',
          properties: {
            taskId: { type: 'integer', example: 101 },
            title: { type: 'string', example: 'Ôn tập môn Toán' },
            status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] },
            priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
            dueAt: { type: 'string', format: 'date-time' },
            repeatType: { type: 'string', enum: ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'] },
            categoryId: { type: 'integer', nullable: true },
            reminders: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  reminderId: { type: 'integer' },
                  remindAt: { type: 'string', format: 'date-time' },
                  status: { type: 'string', enum: ['SCHEDULED', 'TRIGGERED', 'SNOOZED', 'DISMISSED', 'CANCELLED'] },
                },
              },
            },
          },
        },
        CategoryRequest: {
          type: 'object',
          required: ['categoryName'],
          properties: {
            categoryName: { type: 'string', maxLength: 100, example: 'Học tập' },
            colorCode: { type: 'string', example: '#2563EB' },
          },
        },
        ReminderRequest: {
          type: 'object',
          required: ['remindAt'],
          properties: {
            remindAt: { type: 'string', format: 'date-time', example: '2026-08-20T19:00:00+07:00' },
          },
        },
        SnoozeRequest: {
          type: 'object',
          properties: {
            snoozeMinutes: { type: 'integer', minimum: 1, maximum: 60, example: 10 },
          },
        },
        DeviceRequest: {
          type: 'object',
          required: ['deviceToken', 'platform'],
          properties: {
            deviceToken: { type: 'string', example: 'push-subscription-endpoint...' },
            platform: { type: 'string', enum: ['WEB', 'ANDROID', 'IOS'], example: 'WEB' },
          },
        },
        NotificationSettingsRequest: {
          type: 'object',
          properties: {
            alarmSound: { type: 'string', example: 'classic' },
            defaultSnoozeMinutes: { type: 'integer', example: 10 },
            vibrationEnabled: { type: 'boolean', example: true },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.js'],
}

const swaggerSpec = swaggerJsdoc(options)

export default swaggerSpec
