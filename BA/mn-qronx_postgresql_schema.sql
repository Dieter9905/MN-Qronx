-- ============================================================================
-- MN-Qronx – PostgreSQL schema (bản tham chiếu)
-- ============================================================================
-- NGUỒN SỰ THẬT là backend/prisma/schema.prisma (Prisma được đồng bộ bằng
-- `npx prisma db push`). Tệp này chỉ là bản DDL tương đương để đọc thiết kế hoặc
-- dựng cơ sở dữ liệu trên công cụ khác. Sửa cấu trúc thì sửa Prisma trước.
--
-- Yêu cầu: PostgreSQL 15+
-- Số bảng: 27 | Enum: 15
-- Mọi cột thời gian lưu UTC (timestamptz); ngày nghiệp vụ (báo cáo, điểm thưởng,
-- hạn mức AI) được tính theo múi giờ Asia/Ho_Chi_Minh ở tầng ứng dụng.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- ENUM
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TYPE role_name             AS ENUM ('USER', 'ADMIN');
CREATE TYPE task_status           AS ENUM ('TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE task_priority         AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE repeat_type           AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY');
CREATE TYPE reminder_status       AS ENUM ('SCHEDULED', 'TRIGGERED', 'SNOOZED', 'DISMISSED', 'CANCELLED');
CREATE TYPE notification_action   AS ENUM ('SENT', 'SNOOZED', 'DISMISSED');
CREATE TYPE platform              AS ENUM ('WEB', 'ANDROID', 'IOS');
CREATE TYPE plan                  AS ENUM ('FREE', 'PLUS', 'PRO', 'FAMILY');
CREATE TYPE billing_provider      AS ENUM ('VIETQR', 'WEBHOOK', 'MOMO', 'PLAY', 'ADMIN', 'TRIAL', 'REWARD', 'FAMILY');
CREATE TYPE billing_cycle         AS ENUM ('MONTHLY', 'YEARLY');
CREATE TYPE order_status          AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'EXPIRED');
CREATE TYPE subscription_status   AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');
CREATE TYPE invitation_status     AS ENUM ('PENDING', 'CREDITED', 'REJECTED');
CREATE TYPE support_status        AS ENUM ('OPEN', 'RESOLVED');
CREATE TYPE support_sender        AS ENUM ('USER', 'ADMIN');

-- ─────────────────────────────────────────────────────────────────────────────
-- TÀI KHOẢN
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE roles (
    role_id     SERIAL PRIMARY KEY,
    role_name   role_name    NOT NULL UNIQUE,
    description VARCHAR(255)
);

CREATE TABLE app_users (
    user_id                SERIAL PRIMARY KEY,
    role_id                INTEGER      NOT NULL REFERENCES roles (role_id),
    full_name              VARCHAR(150) NOT NULL,
    email                  VARCHAR(254) NOT NULL UNIQUE,
    password_hash          VARCHAR(255) NOT NULL,
    phone_number           VARCHAR(20),
    avatar_url             VARCHAR(500),
    google_id              VARCHAR(255) UNIQUE,
    plan                   plan         NOT NULL DEFAULT 'FREE',
    plan_started_at        TIMESTAMPTZ,
    plan_expires_at        TIMESTAMPTZ,
    points                 INTEGER      NOT NULL DEFAULT 0,
    login_streak           INTEGER      NOT NULL DEFAULT 0,
    last_login_date        TIMESTAMPTZ,
    invite_code            VARCHAR(16)  UNIQUE,
    referrer_id            INTEGER,
    trial_started_at       TIMESTAMPTZ,
    weekly_report_enabled  BOOLEAN      NOT NULL DEFAULT TRUE,
    weekly_report_sent_at  TIMESTAMPTZ,
    weekly_report_test_at  TIMESTAMPTZ,
    is_active              BOOLEAN      NOT NULL DEFAULT TRUE,
    ics_key                VARCHAR(64),
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_app_users_role_id  ON app_users (role_id);
CREATE INDEX ix_app_users_referrer ON app_users (referrer_id);
CREATE INDEX ix_app_users_ics_key  ON app_users (ics_key);

CREATE TABLE refresh_tokens (
    token_id   SERIAL PRIMARY KEY,
    user_id    INTEGER      NOT NULL REFERENCES app_users (user_id),
    token      VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ  NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_refresh_tokens_user ON refresh_tokens (user_id);

CREATE TABLE password_reset_requests (
    reset_request_id SERIAL PRIMARY KEY,
    user_id          INTEGER      NOT NULL REFERENCES app_users (user_id),
    reset_token      VARCHAR(255) NOT NULL UNIQUE,
    expires_at       TIMESTAMPTZ  NOT NULL,
    used_at          TIMESTAMPTZ,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_password_reset_user ON password_reset_requests (user_id);

CREATE TABLE email_verification_codes (
    email_verification_id SERIAL PRIMARY KEY,
    email                 VARCHAR(254) NOT NULL,
    code                  VARCHAR(6)   NOT NULL,
    expires_at            TIMESTAMPTZ  NOT NULL,
    used_at               TIMESTAMPTZ,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_email_verification_email ON email_verification_codes (email);

-- ─────────────────────────────────────────────────────────────────────────────
-- CÔNG VIỆC
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE categories (
    category_id   SERIAL PRIMARY KEY,
    user_id       INTEGER      NOT NULL REFERENCES app_users (user_id),
    category_name VARCHAR(100) NOT NULL,
    color_code    VARCHAR(20),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT ux_categories_user_name UNIQUE (user_id, category_name)
);
CREATE INDEX ix_categories_user_id ON categories (user_id, is_active);

CREATE TABLE tasks (
    task_id           SERIAL PRIMARY KEY,
    user_id           INTEGER      NOT NULL REFERENCES app_users (user_id),
    category_id       INTEGER      REFERENCES categories (category_id),
    parent_task_id    INTEGER      REFERENCES tasks (task_id),
    title             VARCHAR(255) NOT NULL,
    description       TEXT,
    priority          task_priority NOT NULL DEFAULT 'MEDIUM',
    status            task_status   NOT NULL DEFAULT 'TODO',
    due_at            TIMESTAMPTZ   NOT NULL,
    repeat_type       repeat_type   NOT NULL DEFAULT 'NONE',
    repeat_days       VARCHAR(20),                 -- ISO 8601, vd "1,3,5"
    completed_at      TIMESTAMPTZ,
    nag_every_minutes INTEGER,                     -- 1..30, NULL = tắt nhắc dai
    rotate_enabled    BOOLEAN       NOT NULL DEFAULT FALSE,
    turn_assignee_id  INTEGER,                     -- "trần", đối chiếu lại task_shares khi đọc
    deleted_at        TIMESTAMPTZ,                 -- thùng rác: giữ 30 ngày
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_tasks_repeat_days CHECK (repeat_days IS NULL OR repeat_days ~ '^[1-7](,[1-7])*$')
);
CREATE INDEX ix_tasks_user_due        ON tasks (user_id, due_at);
CREATE INDEX ix_tasks_user_status     ON tasks (user_id, status);
CREATE INDEX ix_tasks_user_deleted    ON tasks (user_id, deleted_at);
CREATE INDEX ix_tasks_category_id     ON tasks (category_id);
CREATE INDEX ix_tasks_parent_task_id  ON tasks (parent_task_id);

CREATE TABLE subtasks (
    subtask_id    SERIAL PRIMARY KEY,
    task_id       INTEGER      NOT NULL REFERENCES tasks (task_id) ON DELETE CASCADE,
    content       VARCHAR(255) NOT NULL,
    is_completed  BOOLEAN      NOT NULL DEFAULT FALSE,
    display_order INTEGER      NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_subtasks_task_order ON subtasks (task_id, display_order);

CREATE TABLE reminders (
    reminder_id  SERIAL PRIMARY KEY,
    task_id      INTEGER          NOT NULL REFERENCES tasks (task_id) ON DELETE CASCADE,
    remind_at    TIMESTAMPTZ      NOT NULL,
    status       reminder_status  NOT NULL DEFAULT 'SCHEDULED',
    snooze_count INTEGER          NOT NULL DEFAULT 0,   -- trần 3 (kiểm ở tầng ứng dụng)
    nag_count    INTEGER          NOT NULL DEFAULT 0,   -- trần 10 (kiểm ở tầng ứng dụng)
    created_at   TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_reminders_status_remind_at ON reminders (status, remind_at);  -- scheduler quét mỗi phút
CREATE INDEX ix_reminders_task_id          ON reminders (task_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- CỘNG TÁC (giao việc + gói gia đình)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE task_shares (
    share_id     SERIAL PRIMARY KEY,
    task_id      INTEGER      NOT NULL REFERENCES tasks (task_id) ON DELETE CASCADE,
    assignee_id  INTEGER      NOT NULL REFERENCES app_users (user_id) ON DELETE CASCADE,
    shared_by_id INTEGER      NOT NULL REFERENCES app_users (user_id) ON DELETE CASCADE,
    note         VARCHAR(255),
    done_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT ux_task_shares_task_assignee UNIQUE (task_id, assignee_id)
);
CREATE INDEX ix_task_shares_assignee  ON task_shares (assignee_id, done_at);
CREATE INDEX ix_task_shares_shared_by ON task_shares (shared_by_id);

CREATE TABLE family_members (
    family_member_id SERIAL PRIMARY KEY,
    owner_id         INTEGER      NOT NULL REFERENCES app_users (user_id) ON DELETE CASCADE,
    member_id        INTEGER      NOT NULL UNIQUE REFERENCES app_users (user_id) ON DELETE CASCADE,
    note             VARCHAR(255),
    share_progress   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT ux_family_members_owner_member UNIQUE (owner_id, member_id)
);
CREATE INDEX ix_family_members_owner ON family_members (owner_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- THÔNG BÁO
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE devices (
    device_id    SERIAL PRIMARY KEY,
    user_id      INTEGER      NOT NULL REFERENCES app_users (user_id),
    device_token VARCHAR(500) NOT NULL UNIQUE,
    platform     platform     NOT NULL,
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_devices_user_id ON devices (user_id, is_active);

CREATE TABLE web_push_subscriptions (
    subscription_id SERIAL PRIMARY KEY,
    user_id         INTEGER      NOT NULL REFERENCES app_users (user_id) ON DELETE CASCADE,
    endpoint        VARCHAR(500) NOT NULL UNIQUE,
    p256dh          VARCHAR(200) NOT NULL,
    auth            VARCHAR(100) NOT NULL,
    user_agent      VARCHAR(300),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_used_at    TIMESTAMPTZ
);
CREATE INDEX ix_web_push_user ON web_push_subscriptions (user_id);

CREATE TABLE app_settings (
    key        VARCHAR(60) PRIMARY KEY,
    value      TEXT        NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notification_logs (
    notification_log_id SERIAL PRIMARY KEY,
    reminder_id         INTEGER             NOT NULL REFERENCES reminders (reminder_id),
    device_id           INTEGER             REFERENCES devices (device_id),
    action              notification_action NOT NULL,
    sent_at             TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_notification_logs_reminder ON notification_logs (reminder_id, sent_at);
CREATE INDEX ix_notification_logs_device   ON notification_logs (device_id);

CREATE TABLE custom_sounds (
    custom_sound_id SERIAL PRIMARY KEY,
    user_id         INTEGER      NOT NULL REFERENCES app_users (user_id) ON DELETE CASCADE,
    name            VARCHAR(120) NOT NULL,
    mime_type       VARCHAR(60)  NOT NULL DEFAULT 'audio/mpeg',
    size_bytes      INTEGER      NOT NULL DEFAULT 0,
    data            BYTEA        NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_custom_sounds_user ON custom_sounds (user_id);

CREATE TABLE notification_settings (
    notification_setting_id SERIAL PRIMARY KEY,
    user_id                 INTEGER      NOT NULL UNIQUE REFERENCES app_users (user_id),
    alarm_sound             VARCHAR(50)  NOT NULL DEFAULT 'DEFAULT',
    default_snooze_minutes  INTEGER      NOT NULL DEFAULT 5,
    vibration_enabled       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- THƯƠNG MẠI (gói, đơn, webhook, cấu hình nhận tiền)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE subscriptions (
    subscription_id  SERIAL PRIMARY KEY,
    user_id          INTEGER             NOT NULL REFERENCES app_users (user_id) ON DELETE CASCADE,
    plan             plan                NOT NULL,
    cycle            billing_cycle       NOT NULL DEFAULT 'MONTHLY',
    provider         billing_provider    NOT NULL,
    status           subscription_status NOT NULL DEFAULT 'ACTIVE',
    provider_ref     VARCHAR(190),
    started_at       TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    expires_at       TIMESTAMPTZ         NOT NULL,
    auto_renew       BOOLEAN             NOT NULL DEFAULT FALSE,
    cancelled_at     TIMESTAMPTZ,
    reminder_sent_at TIMESTAMPTZ,
    note             VARCHAR(255),
    created_at       TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_subscriptions_user_status ON subscriptions (user_id, status);

CREATE TABLE payment_orders (
    order_id         SERIAL PRIMARY KEY,
    order_code       VARCHAR(32)      NOT NULL UNIQUE,
    user_id          INTEGER          NOT NULL REFERENCES app_users (user_id) ON DELETE CASCADE,
    plan             plan             NOT NULL,
    cycle            billing_cycle    NOT NULL DEFAULT 'MONTHLY',
    amount           INTEGER          NOT NULL,
    status           order_status     NOT NULL DEFAULT 'PENDING',
    provider         billing_provider NOT NULL DEFAULT 'VIETQR',
    provider_ref     VARCHAR(190),
    transfer_content VARCHAR(120)     NOT NULL,
    qr_payload       TEXT,
    qr_image_url     TEXT,
    qr_source        VARCHAR(10),
    qr_created_at    TIMESTAMPTZ,
    paid_at          TIMESTAMPTZ,
    expires_at       TIMESTAMPTZ      NOT NULL,
    confirmed_by     INTEGER,
    note             VARCHAR(255),
    created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_payment_orders_user_status ON payment_orders (user_id, status);

CREATE TABLE billing_events (
    billing_event_id SERIAL PRIMARY KEY,
    provider         billing_provider NOT NULL,
    event_type       VARCHAR(40)      NOT NULL,
    external_id      VARCHAR(190)     NOT NULL UNIQUE,   -- chống xử lý trùng webhook
    order_id         INTEGER,
    amount           INTEGER,
    payload          JSONB,
    created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- Bảng chỉ có đúng một dòng (setting_id = 1). Giá trị ở đây ĐÈ biến môi trường.
CREATE TABLE billing_settings (
    setting_id              INTEGER PRIMARY KEY DEFAULT 1,
    bank_id                 VARCHAR(20),
    bank_account            VARCHAR(40),
    bank_account_name       VARCHAR(80),
    qr_template             VARCHAR(20),
    webhook_secret          VARCHAR(120),
    bank_api_provider       VARCHAR(20),
    bank_api_base_url       VARCHAR(190),
    bank_api_token          VARCHAR(255),
    bank_api_client_id      VARCHAR(190),
    bank_api_client_secret  VARCHAR(255),
    bank_api_token_url      VARCHAR(190),
    bank_api_history_path   VARCHAR(190),
    bank_api_account        VARCHAR(40),
    bank_api_qr_path        VARCHAR(190),
    sync_enabled            BOOLEAN NOT NULL DEFAULT FALSE,
    sync_interval_minutes   INTEGER,
    last_sync_at            TIMESTAMPTZ,
    last_sync_status        VARCHAR(20),
    last_sync_message       VARCHAR(255),
    last_sync_cursor        VARCHAR(60),
    last_webhook_at         TIMESTAMPTZ,
    last_webhook_status     VARCHAR(20),
    last_webhook_auth       VARCHAR(80),
    last_webhook_message    VARCHAR(255),
    updated_by              INTEGER,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TĂNG TRƯỞNG (điểm thưởng, mời bạn, hạn mức AI)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE point_transactions (
    point_transaction_id SERIAL PRIMARY KEY,
    user_id              INTEGER      NOT NULL REFERENCES app_users (user_id),
    amount               INTEGER      NOT NULL,   -- dương: cộng; âm: trừ
    reason               VARCHAR(30)  NOT NULL,   -- DAILY_LOGIN|STREAK_BONUS|INVITE|REDEEM_REWARD
    note                 VARCHAR(255),
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_point_transactions_user ON point_transactions (user_id);

CREATE TABLE invitations (
    invitation_id SERIAL PRIMARY KEY,
    inviter_id    INTEGER           NOT NULL REFERENCES app_users (user_id),
    invitee_id    INTEGER           NOT NULL REFERENCES app_users (user_id),
    invite_code   VARCHAR(16)       NOT NULL,
    ip_address    VARCHAR(64),
    device_id     VARCHAR(128),
    status        invitation_status NOT NULL DEFAULT 'PENDING',
    credited_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_invitations_inviter ON invitations (inviter_id);
CREATE INDEX ix_invitations_invitee ON invitations (invitee_id);

CREATE TABLE ai_usage (
    ai_usage_id SERIAL PRIMARY KEY,
    user_id     INTEGER      NOT NULL REFERENCES app_users (user_id) ON DELETE CASCADE,
    usage_date  VARCHAR(10)  NOT NULL,   -- YYYY-MM-DD theo giờ VN
    count       INTEGER      NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT ux_ai_usage_user_date UNIQUE (user_id, usage_date)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- HỖ TRỢ (CSKH)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE support_conversations (
    support_conversation_id SERIAL PRIMARY KEY,
    user_id                 INTEGER        NOT NULL UNIQUE REFERENCES app_users (user_id) ON DELETE CASCADE,
    status                  support_status NOT NULL DEFAULT 'OPEN',
    last_message_preview    VARCHAR(160),
    last_message_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    unread_for_admin        INTEGER        NOT NULL DEFAULT 0,
    unread_for_user         INTEGER        NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_support_conversations_last_message ON support_conversations (last_message_at);
CREATE INDEX ix_support_conversations_unread_admin ON support_conversations (unread_for_admin);

CREATE TABLE support_messages (
    support_message_id SERIAL PRIMARY KEY,
    conversation_id    INTEGER        NOT NULL REFERENCES support_conversations (support_conversation_id) ON DELETE CASCADE,
    sender_role        support_sender NOT NULL,
    author_id          INTEGER        REFERENCES app_users (user_id) ON DELETE SET NULL,
    body               TEXT           NOT NULL,
    read_by_user_at    TIMESTAMPTZ,
    read_by_admin_at   TIMESTAMPTZ,
    created_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_support_messages_conversation ON support_messages (conversation_id, created_at);

CREATE TABLE support_attachments (
    support_attachment_id SERIAL PRIMARY KEY,
    message_id            INTEGER     NOT NULL REFERENCES support_messages (support_message_id) ON DELETE CASCADE,
    mime_type             VARCHAR(80) NOT NULL,
    size_bytes            INTEGER     NOT NULL DEFAULT 0,
    data                  BYTEA       NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_support_attachments_message ON support_attachments (message_id);

-- ============================================================================
-- DỮ LIỆU KHỞI TẠO TỐI THIỂU
-- ============================================================================
INSERT INTO roles (role_name, description) VALUES
    ('USER',  'Nguoi dung quan ly cong viec ca nhan'),
    ('ADMIN', 'Quan tri vien he thong')
ON CONFLICT (role_name) DO NOTHING;

-- ============================================================================
-- GHI CHÚ NGHIỆP VỤ CẦN ÁP Ở TẦNG ỨNG DỤNG (không dùng trigger để tránh phức tạp)
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
