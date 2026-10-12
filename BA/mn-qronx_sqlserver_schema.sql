-- ============================================================================
-- MN-Qronx – SQL Server schema (bản tham chiếu)
-- ============================================================================
-- NGUỒN SỰ THẬT là backend/prisma/schema.prisma (PostgreSQL). Tệp này là bản
-- chuyển tương đương cho Microsoft SQL Server để đọc thiết kế / dựng lại DB.
-- Sửa cấu trúc thì sửa Prisma trước.
--
-- Yêu cầu: SQL Server 2019+
-- Số bảng: 27
-- Enum của PostgreSQL được biểu diễn bằng NVARCHAR + CHECK constraint.
-- Thời gian dùng DATETIME2 (lưu UTC); ngày nghiệp vụ tính theo Asia/Ho_Chi_Minh
-- ở tầng ứng dụng. Dữ liệu nhị phân dùng VARBINARY(MAX).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TÀI KHOẢN
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE roles (
    role_id     INT IDENTITY(1,1) PRIMARY KEY,
    role_name   NVARCHAR(20)  NOT NULL UNIQUE
        CHECK (role_name IN ('USER', 'ADMIN')),
    description NVARCHAR(255)
);
GO

CREATE TABLE app_users (
    user_id                INT IDENTITY(1,1) PRIMARY KEY,
    role_id                INT            NOT NULL,
    full_name              NVARCHAR(150)  NOT NULL,
    email                  NVARCHAR(254)  NOT NULL UNIQUE,
    password_hash          NVARCHAR(255)  NOT NULL,
    phone_number           NVARCHAR(20),
    avatar_url             NVARCHAR(500),
    google_id              NVARCHAR(255)  UNIQUE,
    plan                   NVARCHAR(10)   NOT NULL DEFAULT 'FREE'
        CHECK (plan IN ('FREE', 'PLUS', 'PRO', 'FAMILY')),
    plan_started_at        DATETIME2,
    plan_expires_at        DATETIME2,
    points                 INT            NOT NULL DEFAULT 0,
    login_streak           INT            NOT NULL DEFAULT 0,
    last_login_date        DATETIME2,
    invite_code            NVARCHAR(16)   UNIQUE,
    referrer_id            INT,
    trial_started_at       DATETIME2,
    weekly_report_enabled  BIT            NOT NULL DEFAULT 1,
    weekly_report_sent_at  DATETIME2,
    weekly_report_test_at  DATETIME2,
    is_active              BIT            NOT NULL DEFAULT 1,
    ics_key                NVARCHAR(64),
    created_at             DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at             DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_app_users_role FOREIGN KEY (role_id) REFERENCES roles (role_id)
);
CREATE INDEX ix_app_users_role_id  ON app_users (role_id);
CREATE INDEX ix_app_users_referrer ON app_users (referrer_id);
CREATE INDEX ix_app_users_ics_key  ON app_users (ics_key);
GO

CREATE TABLE refresh_tokens (
    token_id   INT IDENTITY(1,1) PRIMARY KEY,
    user_id    INT           NOT NULL,
    token      NVARCHAR(500) NOT NULL UNIQUE,
    expires_at DATETIME2     NOT NULL,
    created_at DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES app_users (user_id)
);
CREATE INDEX ix_refresh_tokens_user ON refresh_tokens (user_id);
GO

CREATE TABLE password_reset_requests (
    reset_request_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id          INT           NOT NULL,
    reset_token      NVARCHAR(255) NOT NULL UNIQUE,
    expires_at       DATETIME2     NOT NULL,
    used_at          DATETIME2,
    created_at       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES app_users (user_id)
);
CREATE INDEX ix_password_reset_user ON password_reset_requests (user_id);
GO

CREATE TABLE email_verification_codes (
    email_verification_id INT IDENTITY(1,1) PRIMARY KEY,
    email                 NVARCHAR(254) NOT NULL,
    code                  NVARCHAR(6)   NOT NULL,
    expires_at            DATETIME2     NOT NULL,
    used_at               DATETIME2,
    created_at            DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX ix_email_verification_email ON email_verification_codes (email);
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- CÔNG VIỆC
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE categories (
    category_id   INT IDENTITY(1,1) PRIMARY KEY,
    user_id       INT           NOT NULL,
    category_name NVARCHAR(100) NOT NULL,
    color_code    NVARCHAR(20),
    is_active     BIT           NOT NULL DEFAULT 1,
    created_at    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_categories_user FOREIGN KEY (user_id) REFERENCES app_users (user_id),
    CONSTRAINT ux_categories_user_name UNIQUE (user_id, category_name)
);
CREATE INDEX ix_categories_user_id ON categories (user_id, is_active);
GO

CREATE TABLE tasks (
    task_id           INT IDENTITY(1,1) PRIMARY KEY,
    user_id           INT           NOT NULL,
    category_id       INT,
    parent_task_id    INT,
    title             NVARCHAR(255) NOT NULL,
    description       NVARCHAR(MAX),
    priority          NVARCHAR(10)  NOT NULL DEFAULT 'MEDIUM'
        CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    status            NVARCHAR(15)  NOT NULL DEFAULT 'TODO'
        CHECK (status IN ('TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    due_at            DATETIME2     NOT NULL,
    repeat_type       NVARCHAR(10)  NOT NULL DEFAULT 'NONE'
        CHECK (repeat_type IN ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY')),
    repeat_days       NVARCHAR(20),   -- ISO 8601, vd '1,3,5'
    completed_at      DATETIME2,
    nag_every_minutes INT,            -- 1..30, NULL = tắt nhắc dai
    rotate_enabled    BIT           NOT NULL DEFAULT 0,
    turn_assignee_id  INT,            -- "trần", đối chiếu lại task_shares khi đọc
    deleted_at        DATETIME2,      -- thùng rác: giữ 30 ngày
    created_at        DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at        DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_tasks_user     FOREIGN KEY (user_id) REFERENCES app_users (user_id),
    CONSTRAINT fk_tasks_category FOREIGN KEY (category_id) REFERENCES categories (category_id),
    CONSTRAINT fk_tasks_parent   FOREIGN KEY (parent_task_id) REFERENCES tasks (task_id)
);
CREATE INDEX ix_tasks_user_due       ON tasks (user_id, due_at);
CREATE INDEX ix_tasks_user_status    ON tasks (user_id, status);
CREATE INDEX ix_tasks_user_deleted   ON tasks (user_id, deleted_at);
CREATE INDEX ix_tasks_category_id    ON tasks (category_id);
CREATE INDEX ix_tasks_parent_task_id ON tasks (parent_task_id);
GO

CREATE TABLE subtasks (
    subtask_id    INT IDENTITY(1,1) PRIMARY KEY,
    task_id       INT           NOT NULL,
    content       NVARCHAR(255) NOT NULL,
    is_completed  BIT           NOT NULL DEFAULT 0,
    display_order INT           NOT NULL DEFAULT 0,
    created_at    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_subtasks_task FOREIGN KEY (task_id) REFERENCES tasks (task_id) ON DELETE CASCADE
);
CREATE INDEX ix_subtasks_task_order ON subtasks (task_id, display_order);
GO

CREATE TABLE reminders (
    reminder_id  INT IDENTITY(1,1) PRIMARY KEY,
    task_id      INT           NOT NULL,
    remind_at    DATETIME2     NOT NULL,
    status       NVARCHAR(15)  NOT NULL DEFAULT 'SCHEDULED'
        CHECK (status IN ('SCHEDULED', 'TRIGGERED', 'SNOOZED', 'DISMISSED', 'CANCELLED')),
    snooze_count INT           NOT NULL DEFAULT 0,   -- trần 3 (kiểm ở tầng ứng dụng)
    nag_count    INT           NOT NULL DEFAULT 0,   -- trần 10 (kiểm ở tầng ứng dụng)
    created_at   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_reminders_task FOREIGN KEY (task_id) REFERENCES tasks (task_id) ON DELETE CASCADE
);
CREATE INDEX ix_reminders_status_remind_at ON reminders (status, remind_at);  -- scheduler quét mỗi phút
CREATE INDEX ix_reminders_task_id          ON reminders (task_id);
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- CỘNG TÁC (giao việc + gói gia đình)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE task_shares (
    share_id     INT IDENTITY(1,1) PRIMARY KEY,
    task_id      INT           NOT NULL,
    assignee_id  INT           NOT NULL,
    shared_by_id INT           NOT NULL,
    note         NVARCHAR(255),
    done_at      DATETIME2,
    created_at   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_task_shares_task      FOREIGN KEY (task_id)      REFERENCES tasks (task_id)       ON DELETE CASCADE,
    CONSTRAINT fk_task_shares_assignee  FOREIGN KEY (assignee_id)  REFERENCES app_users (user_id)   ON DELETE CASCADE,
    CONSTRAINT fk_task_shares_shared_by FOREIGN KEY (shared_by_id) REFERENCES app_users (user_id)   ON DELETE CASCADE,
    CONSTRAINT ux_task_shares_task_assignee UNIQUE (task_id, assignee_id)
);
CREATE INDEX ix_task_shares_assignee  ON task_shares (assignee_id, done_at);
CREATE INDEX ix_task_shares_shared_by ON task_shares (shared_by_id);
GO

CREATE TABLE family_members (
    family_member_id INT IDENTITY(1,1) PRIMARY KEY,
    owner_id         INT           NOT NULL,
    member_id        INT           NOT NULL UNIQUE,
    note             NVARCHAR(255),
    share_progress   BIT           NOT NULL DEFAULT 1,
    created_at       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_family_members_owner  FOREIGN KEY (owner_id)  REFERENCES app_users (user_id) ON DELETE CASCADE,
    CONSTRAINT fk_family_members_member FOREIGN KEY (member_id) REFERENCES app_users (user_id) ON DELETE CASCADE,
    CONSTRAINT ux_family_members_owner_member UNIQUE (owner_id, member_id)
);
CREATE INDEX ix_family_members_owner ON family_members (owner_id);
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- THÔNG BÁO
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE devices (
    device_id    INT IDENTITY(1,1) PRIMARY KEY,
    user_id      INT           NOT NULL,
    device_token NVARCHAR(500) NOT NULL UNIQUE,
    platform     NVARCHAR(10)  NOT NULL CHECK (platform IN ('WEB', 'ANDROID', 'IOS')),
    is_active    BIT           NOT NULL DEFAULT 1,
    created_at   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_devices_user FOREIGN KEY (user_id) REFERENCES app_users (user_id)
);
CREATE INDEX ix_devices_user_id ON devices (user_id, is_active);
GO

CREATE TABLE web_push_subscriptions (
    subscription_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id         INT           NOT NULL,
    endpoint        NVARCHAR(500) NOT NULL UNIQUE,
    p256dh          NVARCHAR(200) NOT NULL,
    auth            NVARCHAR(100) NOT NULL,
    user_agent      NVARCHAR(300),
    created_at      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    last_used_at    DATETIME2,
    CONSTRAINT fk_web_push_user FOREIGN KEY (user_id) REFERENCES app_users (user_id) ON DELETE CASCADE
);
CREATE INDEX ix_web_push_user ON web_push_subscriptions (user_id);
GO

CREATE TABLE app_settings (
    [key]      NVARCHAR(60) PRIMARY KEY,
    value      NVARCHAR(MAX) NOT NULL,
    updated_at DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE notification_logs (
    notification_log_id INT IDENTITY(1,1) PRIMARY KEY,
    reminder_id         INT           NOT NULL,
    device_id           INT,
    action              NVARCHAR(10)  NOT NULL CHECK (action IN ('SENT', 'SNOOZED', 'DISMISSED')),
    sent_at             DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    created_at          DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_notification_logs_reminder FOREIGN KEY (reminder_id) REFERENCES reminders (reminder_id),
    CONSTRAINT fk_notification_logs_device   FOREIGN KEY (device_id)   REFERENCES devices (device_id)
);
CREATE INDEX ix_notification_logs_reminder ON notification_logs (reminder_id, sent_at);
CREATE INDEX ix_notification_logs_device   ON notification_logs (device_id);
GO

CREATE TABLE custom_sounds (
    custom_sound_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id         INT            NOT NULL,
    name            NVARCHAR(120)  NOT NULL,
    mime_type       NVARCHAR(60)   NOT NULL DEFAULT 'audio/mpeg',
    size_bytes      INT            NOT NULL DEFAULT 0,
    data            VARBINARY(MAX) NOT NULL,
    created_at      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_custom_sounds_user FOREIGN KEY (user_id) REFERENCES app_users (user_id) ON DELETE CASCADE
);
CREATE INDEX ix_custom_sounds_user ON custom_sounds (user_id);
GO

CREATE TABLE notification_settings (
    notification_setting_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id                 INT           NOT NULL UNIQUE,
    alarm_sound             NVARCHAR(50)  NOT NULL DEFAULT 'DEFAULT',
    default_snooze_minutes  INT           NOT NULL DEFAULT 5,
    vibration_enabled       BIT           NOT NULL DEFAULT 1,
    created_at              DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at              DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_notification_settings_user FOREIGN KEY (user_id) REFERENCES app_users (user_id)
);
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- THƯƠNG MẠI
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE subscriptions (
    subscription_id  INT IDENTITY(1,1) PRIMARY KEY,
    user_id          INT           NOT NULL,
    plan             NVARCHAR(10)  NOT NULL CHECK (plan IN ('FREE', 'PLUS', 'PRO', 'FAMILY')),
    cycle            NVARCHAR(10)  NOT NULL DEFAULT 'MONTHLY' CHECK (cycle IN ('MONTHLY', 'YEARLY')),
    provider         NVARCHAR(10)  NOT NULL
        CHECK (provider IN ('VIETQR', 'WEBHOOK', 'MOMO', 'PLAY', 'ADMIN', 'TRIAL', 'REWARD', 'FAMILY')),
    status           NVARCHAR(10)  NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELLED')),
    provider_ref     NVARCHAR(190),
    started_at       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    expires_at       DATETIME2     NOT NULL,
    auto_renew       BIT           NOT NULL DEFAULT 0,
    cancelled_at     DATETIME2,
    reminder_sent_at DATETIME2,
    note             NVARCHAR(255),
    created_at       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_subscriptions_user FOREIGN KEY (user_id) REFERENCES app_users (user_id) ON DELETE CASCADE
);
CREATE INDEX ix_subscriptions_user_status ON subscriptions (user_id, status);
GO

CREATE TABLE payment_orders (
    order_id         INT IDENTITY(1,1) PRIMARY KEY,
    order_code       NVARCHAR(32)  NOT NULL UNIQUE,
    user_id          INT           NOT NULL,
    plan             NVARCHAR(10)  NOT NULL CHECK (plan IN ('FREE', 'PLUS', 'PRO', 'FAMILY')),
    cycle            NVARCHAR(10)  NOT NULL DEFAULT 'MONTHLY' CHECK (cycle IN ('MONTHLY', 'YEARLY')),
    amount           INT           NOT NULL,
    status           NVARCHAR(10)  NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PAID', 'CANCELLED', 'EXPIRED')),
    provider         NVARCHAR(10)  NOT NULL DEFAULT 'VIETQR'
        CHECK (provider IN ('VIETQR', 'WEBHOOK', 'MOMO', 'PLAY', 'ADMIN', 'TRIAL', 'REWARD', 'FAMILY')),
    provider_ref     NVARCHAR(190),
    transfer_content NVARCHAR(120) NOT NULL,
    qr_payload       NVARCHAR(MAX),
    qr_image_url     NVARCHAR(MAX),
    qr_source        NVARCHAR(10),
    qr_created_at    DATETIME2,
    paid_at          DATETIME2,
    expires_at       DATETIME2     NOT NULL,
    confirmed_by     INT,
    note             NVARCHAR(255),
    created_at       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_payment_orders_user FOREIGN KEY (user_id) REFERENCES app_users (user_id) ON DELETE CASCADE
);
CREATE INDEX ix_payment_orders_user_status ON payment_orders (user_id, status);
GO

CREATE TABLE billing_events (
    billing_event_id INT IDENTITY(1,1) PRIMARY KEY,
    provider         NVARCHAR(10)  NOT NULL
        CHECK (provider IN ('VIETQR', 'WEBHOOK', 'MOMO', 'PLAY', 'ADMIN', 'TRIAL', 'REWARD', 'FAMILY')),
    event_type       NVARCHAR(40)  NOT NULL,
    external_id      NVARCHAR(190) NOT NULL UNIQUE,   -- chống xử lý trùng webhook
    order_id         INT,
    amount           INT,
    payload          NVARCHAR(MAX),                   -- JSON
    created_at       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE billing_settings (
    setting_id              INT PRIMARY KEY DEFAULT 1,
    bank_id                 NVARCHAR(20),
    bank_account            NVARCHAR(40),
    bank_account_name       NVARCHAR(80),
    qr_template             NVARCHAR(20),
    webhook_secret          NVARCHAR(120),
    bank_api_provider       NVARCHAR(20),
    bank_api_base_url       NVARCHAR(190),
    bank_api_token          NVARCHAR(255),
    bank_api_client_id      NVARCHAR(190),
    bank_api_client_secret  NVARCHAR(255),
    bank_api_token_url      NVARCHAR(190),
    bank_api_history_path   NVARCHAR(190),
    bank_api_account        NVARCHAR(40),
    bank_api_qr_path        NVARCHAR(190),
    sync_enabled            BIT           NOT NULL DEFAULT 0,
    sync_interval_minutes   INT,
    last_sync_at            DATETIME2,
    last_sync_status        NVARCHAR(20),
    last_sync_message       NVARCHAR(255),
    last_sync_cursor        NVARCHAR(60),
    last_webhook_at         DATETIME2,
    last_webhook_status     NVARCHAR(20),
    last_webhook_auth       NVARCHAR(80),
    last_webhook_message    NVARCHAR(255),
    updated_by              INT,
    updated_at              DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT ck_billing_settings_single CHECK (setting_id = 1)
);
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- TĂNG TRƯỞNG
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE point_transactions (
    point_transaction_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id              INT           NOT NULL,
    amount               INT           NOT NULL,
    reason               NVARCHAR(30)  NOT NULL
        CHECK (reason IN ('DAILY_LOGIN', 'STREAK_BONUS', 'INVITE', 'REDEEM_REWARD')),
    note                 NVARCHAR(255),
    created_at           DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_point_transactions_user FOREIGN KEY (user_id) REFERENCES app_users (user_id)
);
CREATE INDEX ix_point_transactions_user ON point_transactions (user_id);
GO

CREATE TABLE invitations (
    invitation_id INT IDENTITY(1,1) PRIMARY KEY,
    inviter_id    INT           NOT NULL,
    invitee_id    INT           NOT NULL,
    invite_code   NVARCHAR(16)  NOT NULL,
    ip_address    NVARCHAR(64),
    device_id     NVARCHAR(128),
    status        NVARCHAR(10)  NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'CREDITED', 'REJECTED')),
    credited_at   DATETIME2,
    created_at    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_invitations_inviter FOREIGN KEY (inviter_id) REFERENCES app_users (user_id),
    CONSTRAINT fk_invitations_invitee FOREIGN KEY (invitee_id) REFERENCES app_users (user_id)
);
CREATE INDEX ix_invitations_inviter ON invitations (inviter_id);
CREATE INDEX ix_invitations_invitee ON invitations (invitee_id);
GO

CREATE TABLE ai_usage (
    ai_usage_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id     INT           NOT NULL,
    usage_date  NVARCHAR(10)  NOT NULL,   -- YYYY-MM-DD theo giờ VN
    count       INT           NOT NULL DEFAULT 0,
    updated_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_ai_usage_user FOREIGN KEY (user_id) REFERENCES app_users (user_id) ON DELETE CASCADE,
    CONSTRAINT ux_ai_usage_user_date UNIQUE (user_id, usage_date)
);
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- HỖ TRỢ (CSKH)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE support_conversations (
    support_conversation_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id                 INT           NOT NULL UNIQUE,
    status                  NVARCHAR(10)  NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED')),
    last_message_preview    NVARCHAR(160),
    last_message_at         DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    unread_for_admin        INT           NOT NULL DEFAULT 0,
    unread_for_user         INT           NOT NULL DEFAULT 0,
    created_at              DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at              DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_support_conversations_user FOREIGN KEY (user_id) REFERENCES app_users (user_id) ON DELETE CASCADE
);
CREATE INDEX ix_support_conversations_last_message ON support_conversations (last_message_at);
CREATE INDEX ix_support_conversations_unread_admin ON support_conversations (unread_for_admin);
GO

CREATE TABLE support_messages (
    support_message_id INT IDENTITY(1,1) PRIMARY KEY,
    conversation_id    INT           NOT NULL,
    sender_role        NVARCHAR(10)  NOT NULL CHECK (sender_role IN ('USER', 'ADMIN')),
    author_id          INT,
    body               NVARCHAR(MAX) NOT NULL,
    read_by_user_at    DATETIME2,
    read_by_admin_at   DATETIME2,
    created_at         DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_support_messages_conversation FOREIGN KEY (conversation_id)
        REFERENCES support_conversations (support_conversation_id) ON DELETE CASCADE,
    CONSTRAINT fk_support_messages_author FOREIGN KEY (author_id)
        REFERENCES app_users (user_id) ON DELETE SET NULL
);
CREATE INDEX ix_support_messages_conversation ON support_messages (conversation_id, created_at);
GO

CREATE TABLE support_attachments (
    support_attachment_id INT IDENTITY(1,1) PRIMARY KEY,
    message_id            INT            NOT NULL,
    mime_type             NVARCHAR(80)   NOT NULL,
    size_bytes            INT            NOT NULL DEFAULT 0,
    data                  VARBINARY(MAX) NOT NULL,
    created_at            DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_support_attachments_message FOREIGN KEY (message_id)
        REFERENCES support_messages (support_message_id) ON DELETE CASCADE
);
CREATE INDEX ix_support_attachments_message ON support_attachments (message_id);
GO

-- ============================================================================
-- DỮ LIỆU KHỞI TẠO TỐI THIỂU
-- ============================================================================
INSERT INTO roles (role_name, description)
SELECT 'USER', N'Nguoi dung quan ly cong viec ca nhan'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE role_name = 'USER');

INSERT INTO roles (role_name, description)
SELECT 'ADMIN', N'Quan tri vien he thong'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE role_name = 'ADMIN');
GO

-- ============================================================================
-- GHI CHÚ NGHIỆP VỤ CẦN ÁP Ở TẦNG ỨNG DỤNG
-- ============================================================================
-- 1. Hủy reminder của task khi task chuyển COMPLETED/CANCELLED (cùng transaction).
-- 2. Sinh task lặp kế tiếp khi task repeat hoàn thành (cùng transaction).
-- 3. remind_at <= tasks.due_at; số reminder mỗi task theo gói.
-- 4. snooze_count <= 3; nag_count <= 10 (chỉ gói Pro).
-- 5. Xóa task = đặt deleted_at; dọn vĩnh viễn sau 30 ngày (kèm task_shares cascade).
-- 6. Giới hạn theo gói: số việc đang mở, danh mục, việc con, thiết bị, AI/ngày.
-- 7. Chống lạm dụng mời bạn: cùng inviter + ip_address + device_id chỉ tính 1.
-- 8. Webhook: xác thực webhook_secret + chèn billing_events.external_id để chống trùng.
-- 9. Ghế gói gia đình: giữ users.plan/plan_expires_at khớp hạn của chủ gói.
-- 10. Mọi truy vấn dữ liệu người dùng phải lọc theo user_id (ownership).
-- 11. Enum của PostgreSQL được biểu diễn bằng NVARCHAR + CHECK; nếu cần tối ưu,
--     có thể tách thành bảng tra cứu và dùng khóa ngoại.
