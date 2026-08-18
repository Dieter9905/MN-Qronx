-- TaskAlarm - Database schema for Microsoft SQL Server 2019+
-- Based on TaskAlarm_ERD.md. Run this script on a new/empty database.

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'taskalarm')
    EXEC(N'CREATE SCHEMA taskalarm');
GO

CREATE TABLE taskalarm.roles (
    role_id SMALLINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_roles PRIMARY KEY,
    role_name VARCHAR(20) NOT NULL CONSTRAINT UQ_roles_role_name UNIQUE,
    description NVARCHAR(255) NULL,
    CONSTRAINT CK_roles_role_name CHECK (role_name IN ('USER', 'ADMIN'))
);
GO

CREATE TABLE taskalarm.app_users (
    user_id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_app_users PRIMARY KEY,
    role_id SMALLINT NOT NULL,
    full_name NVARCHAR(150) NOT NULL,
    email VARCHAR(254) NOT NULL,
    email_normalized AS LOWER(email) PERSISTED,
    password_hash VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NULL,
    is_active BIT NOT NULL CONSTRAINT DF_app_users_is_active DEFAULT (1),
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_app_users_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_app_users_updated_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_app_users_roles FOREIGN KEY (role_id) REFERENCES taskalarm.roles(role_id),
    CONSTRAINT CK_app_users_full_name CHECK (LEN(LTRIM(RTRIM(full_name))) > 0),
    CONSTRAINT CK_app_users_email_not_blank CHECK (LEN(LTRIM(RTRIM(email))) > 0)
);
GO

CREATE UNIQUE INDEX UX_app_users_email_lower ON taskalarm.app_users (email_normalized);
GO

CREATE TABLE taskalarm.password_reset_requests (
    reset_request_id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_password_reset_requests PRIMARY KEY,
    user_id BIGINT NOT NULL,
    reset_token VARCHAR(255) NOT NULL CONSTRAINT UQ_password_reset_requests_reset_token UNIQUE,
    expires_at DATETIME2(0) NOT NULL,
    used_at DATETIME2(0) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_password_reset_requests_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_password_reset_requests_app_users FOREIGN KEY (user_id) REFERENCES taskalarm.app_users(user_id),
    CONSTRAINT CK_password_reset_requests_token CHECK (LEN(LTRIM(RTRIM(reset_token))) > 0),
    CONSTRAINT CK_password_reset_requests_expiry CHECK (expires_at > created_at)
);
GO

CREATE INDEX IX_password_reset_requests_user_id ON taskalarm.password_reset_requests (user_id);
GO

CREATE TABLE taskalarm.categories (
    category_id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_categories PRIMARY KEY,
    user_id BIGINT NOT NULL,
    category_name NVARCHAR(100) NOT NULL,
    color_code VARCHAR(20) NULL,
    is_active BIT NOT NULL CONSTRAINT DF_categories_is_active DEFAULT (1),
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_categories_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_categories_updated_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_categories_app_users FOREIGN KEY (user_id) REFERENCES taskalarm.app_users(user_id),
    CONSTRAINT UQ_categories_user_name UNIQUE (user_id, category_name),
    CONSTRAINT CK_categories_name CHECK (LEN(LTRIM(RTRIM(category_name))) > 0)
);
GO

CREATE INDEX IX_categories_user_id ON taskalarm.categories (user_id, is_active);
GO

CREATE TABLE taskalarm.tasks (
    task_id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_tasks PRIMARY KEY,
    user_id BIGINT NOT NULL,
    category_id BIGINT NULL,
    parent_task_id BIGINT NULL,
    title NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX) NULL,
    priority VARCHAR(10) NOT NULL CONSTRAINT DF_tasks_priority DEFAULT ('MEDIUM'),
    status VARCHAR(20) NOT NULL CONSTRAINT DF_tasks_status DEFAULT ('TODO'),
    due_at DATETIME2(0) NOT NULL,
    repeat_type VARCHAR(10) NOT NULL CONSTRAINT DF_tasks_repeat_type DEFAULT ('NONE'),
    completed_at DATETIME2(0) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_tasks_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_tasks_updated_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_tasks_app_users FOREIGN KEY (user_id) REFERENCES taskalarm.app_users(user_id),
    CONSTRAINT FK_tasks_categories FOREIGN KEY (category_id) REFERENCES taskalarm.categories(category_id),
    CONSTRAINT FK_tasks_parent_task FOREIGN KEY (parent_task_id) REFERENCES taskalarm.tasks(task_id),
    CONSTRAINT CK_tasks_title CHECK (LEN(LTRIM(RTRIM(title))) > 0),
    CONSTRAINT CK_tasks_priority CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    CONSTRAINT CK_tasks_status CHECK (status IN ('TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT CK_tasks_repeat_type CHECK (repeat_type IN ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY')),
    CONSTRAINT CK_tasks_not_self_parent CHECK (parent_task_id IS NULL OR parent_task_id <> task_id),
    CONSTRAINT CK_tasks_completed_data CHECK (
        (status = 'COMPLETED' AND completed_at IS NOT NULL)
        OR (status <> 'COMPLETED' AND completed_at IS NULL)
    )
);
GO

CREATE INDEX IX_tasks_user_due ON taskalarm.tasks (user_id, due_at);
CREATE INDEX IX_tasks_user_status ON taskalarm.tasks (user_id, status);
CREATE INDEX IX_tasks_category_id ON taskalarm.tasks (category_id);
CREATE INDEX IX_tasks_parent_task_id ON taskalarm.tasks (parent_task_id);
GO

CREATE TABLE taskalarm.subtasks (
    subtask_id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_subtasks PRIMARY KEY,
    task_id BIGINT NOT NULL,
    content NVARCHAR(255) NOT NULL,
    is_completed BIT NOT NULL CONSTRAINT DF_subtasks_is_completed DEFAULT (0),
    display_order INT NOT NULL CONSTRAINT DF_subtasks_display_order DEFAULT (0),
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_subtasks_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_subtasks_updated_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_subtasks_tasks FOREIGN KEY (task_id) REFERENCES taskalarm.tasks(task_id),
    CONSTRAINT CK_subtasks_content CHECK (LEN(LTRIM(RTRIM(content))) > 0),
    CONSTRAINT CK_subtasks_display_order CHECK (display_order >= 0)
);
GO

CREATE INDEX IX_subtasks_task_order ON taskalarm.subtasks (task_id, display_order);
GO

CREATE TABLE taskalarm.reminders (
    reminder_id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_reminders PRIMARY KEY,
    task_id BIGINT NOT NULL,
    remind_at DATETIME2(0) NOT NULL,
    status VARCHAR(20) NOT NULL CONSTRAINT DF_reminders_status DEFAULT ('SCHEDULED'),
    snooze_count SMALLINT NOT NULL CONSTRAINT DF_reminders_snooze_count DEFAULT (0),
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_reminders_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_reminders_updated_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_reminders_tasks FOREIGN KEY (task_id) REFERENCES taskalarm.tasks(task_id),
    CONSTRAINT CK_reminders_status CHECK (status IN ('SCHEDULED', 'TRIGGERED', 'SNOOZED', 'DISMISSED', 'CANCELLED')),
    CONSTRAINT CK_reminders_snooze_count CHECK (snooze_count BETWEEN 0 AND 3)
);
GO

-- Index chính phục vụ scheduler quét các reminder đến hạn kích hoạt.
CREATE INDEX IX_reminders_status_remind_at ON taskalarm.reminders (status, remind_at);
CREATE INDEX IX_reminders_task_id ON taskalarm.reminders (task_id);
GO

CREATE TABLE taskalarm.devices (
    device_id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_devices PRIMARY KEY,
    user_id BIGINT NOT NULL,
    device_token VARCHAR(500) NOT NULL CONSTRAINT UQ_devices_device_token UNIQUE,
    platform VARCHAR(10) NOT NULL,
    is_active BIT NOT NULL CONSTRAINT DF_devices_is_active DEFAULT (1),
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_devices_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_devices_updated_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_devices_app_users FOREIGN KEY (user_id) REFERENCES taskalarm.app_users(user_id),
    CONSTRAINT CK_devices_platform CHECK (platform IN ('WEB', 'ANDROID', 'IOS')),
    CONSTRAINT CK_devices_token CHECK (LEN(LTRIM(RTRIM(device_token))) > 0)
);
GO

CREATE INDEX IX_devices_user_id ON taskalarm.devices (user_id, is_active);
GO

CREATE TABLE taskalarm.notification_logs (
    notification_log_id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_notification_logs PRIMARY KEY,
    reminder_id BIGINT NOT NULL,
    device_id BIGINT NULL,
    action VARCHAR(10) NOT NULL,
    sent_at DATETIME2(0) NOT NULL CONSTRAINT DF_notification_logs_sent_at DEFAULT (SYSUTCDATETIME()),
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_notification_logs_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_notification_logs_reminders FOREIGN KEY (reminder_id) REFERENCES taskalarm.reminders(reminder_id),
    CONSTRAINT FK_notification_logs_devices FOREIGN KEY (device_id) REFERENCES taskalarm.devices(device_id),
    CONSTRAINT CK_notification_logs_action CHECK (action IN ('SENT', 'SNOOZED', 'DISMISSED'))
);
GO

CREATE INDEX IX_notification_logs_reminder_id ON taskalarm.notification_logs (reminder_id, sent_at DESC);
CREATE INDEX IX_notification_logs_device_id ON taskalarm.notification_logs (device_id);
GO

CREATE TABLE taskalarm.notification_settings (
    notification_setting_id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_notification_settings PRIMARY KEY,
    user_id BIGINT NOT NULL CONSTRAINT UQ_notification_settings_user_id UNIQUE,
    alarm_sound VARCHAR(50) NOT NULL CONSTRAINT DF_notification_settings_alarm_sound DEFAULT ('DEFAULT'),
    default_snooze_minutes SMALLINT NOT NULL CONSTRAINT DF_notification_settings_snooze_minutes DEFAULT (5),
    vibration_enabled BIT NOT NULL CONSTRAINT DF_notification_settings_vibration DEFAULT (1),
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_notification_settings_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_notification_settings_updated_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_notification_settings_app_users FOREIGN KEY (user_id) REFERENCES taskalarm.app_users(user_id),
    CONSTRAINT CK_notification_settings_snooze_minutes CHECK (default_snooze_minutes > 0)
);
GO

-- A reminder's remind_at must not be later than its task's due_at,
-- and a task may not have more than 5 non-cancelled reminders.
CREATE OR ALTER TRIGGER taskalarm.trg_reminders_validate
ON taskalarm.reminders
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT (UPDATE(task_id) OR UPDATE(remind_at) OR UPDATE(status))
        RETURN;

    IF EXISTS (
        SELECT 1
        FROM inserted AS i
        INNER JOIN taskalarm.tasks AS t ON t.task_id = i.task_id
        WHERE i.remind_at > t.due_at
    )
    BEGIN
        THROW 51001, 'Thời điểm nhắc nhở phải nhỏ hơn hoặc bằng thời hạn công việc.', 1;
    END;

    IF EXISTS (
        SELECT i.task_id
        FROM inserted AS i
        WHERE (
            SELECT COUNT(*)
            FROM taskalarm.reminders AS r
            WHERE r.task_id = i.task_id
              AND r.status <> 'CANCELLED'
        ) > 5
    )
    BEGIN
        THROW 51002, 'Mỗi công việc chỉ được có tối đa 5 nhắc nhở đang hoạt động.', 1;
    END;
END;
GO

-- A task's parent_task_id, if set, must reference another task owned by the same user.
CREATE OR ALTER TRIGGER taskalarm.trg_tasks_validate_parent
ON taskalarm.tasks
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT (UPDATE(parent_task_id) OR UPDATE(user_id))
        RETURN;

    IF EXISTS (
        SELECT 1
        FROM inserted AS i
        INNER JOIN taskalarm.tasks AS p ON p.task_id = i.parent_task_id
        WHERE i.parent_task_id IS NOT NULL
          AND p.user_id <> i.user_id
    )
    BEGIN
        THROW 51003, 'Task cha phải thuộc cùng User với Task hiện tại.', 1;
    END;
END;
GO

INSERT INTO taskalarm.roles (role_name, description)
VALUES
    ('USER', N'Người dùng quản lý công việc cá nhân'),
    ('ADMIN', N'Quản trị viên hệ thống');
GO
