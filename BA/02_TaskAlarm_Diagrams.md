# Use Case Diagram và Activity Diagram – TaskAlarm

## 1. Quy ước

- Actor gồm: `Guest`, `User`, `Admin`.
- User có toàn bộ khả năng xem trang giới thiệu của Guest sau khi đăng nhập.
- Trạng thái công việc: **Chưa làm**, **Đang làm**, **Hoàn thành**, **Đã hủy**. "Quá hạn" là trạng thái hiển thị tính toán, không lưu riêng.
- Cơ chế nhắc nhở hoạt động như báo thức: kích hoạt kèm âm thanh/rung, cho phép Hoãn (tối đa 3 lần) hoặc Tắt.

## 2. Use Case Diagram

```mermaid
flowchart LR
    G[Guest]
    U[User]
    A[Admin]

    subgraph TA[Hệ thống TaskAlarm]
        direction TB

        subgraph Public[Chức năng công khai]
            UC01([Xem trang giới thiệu])
            UC02([Đăng ký])
            UC03([Đăng nhập])
            UC04([Quên mật khẩu])
        end

        subgraph UserFeature[Chức năng User]
            UC05([Quản lý hồ sơ cá nhân])
            UC06([Đổi mật khẩu])
            UC07([Quản lý danh mục công việc])
            UC08([Tạo công việc])
            UC09([Xem danh sách/chi tiết công việc])
            UC10([Cập nhật công việc])
            UC11([Đánh dấu hoàn thành công việc])
            UC12([Xóa công việc])
            UC13([Quản lý việc con])
            UC14([Thiết lập lặp lại])
            UC15([Thiết lập nhắc nhở])
            UC16([Nhận báo thức])
            UC17([Hoãn báo thức])
            UC18([Tắt báo thức])
            UC19([Cài đặt thông báo])
            UC20([Quản lý thiết bị])
            UC21([Tìm kiếm/lọc công việc])
            UC22([Xem lịch])
            UC23([Xem dashboard cá nhân])
            UC24([Xem lịch sử thông báo])
        end

        subgraph AdminFeature[Chức năng Admin]
            UC25([Xem dashboard hệ thống])
            UC26([Quản lý người dùng])
        end

        subgraph Included[Use Case được bao gồm]
            UC27([Kích hoạt báo thức])
            UC28([Ghi lịch sử thông báo])
            UC29([Tự động tạo công việc lặp kế tiếp])
            UC30([Hủy nhắc nhở chưa kích hoạt])
        end
    end

    G --- UC01
    G --- UC02
    G --- UC03
    G --- UC04

    U --- UC01
    U --- UC05
    U --- UC06
    U --- UC07
    U --- UC08
    U --- UC09
    U --- UC10
    U --- UC11
    U --- UC12
    U --- UC13
    U --- UC14
    U --- UC15
    U --- UC16
    U --- UC17
    U --- UC18
    U --- UC19
    U --- UC20
    U --- UC21
    U --- UC22
    U --- UC23
    U --- UC24

    A --- UC03
    A --- UC25
    A --- UC26

    UC16 -. "<<include>>" .-> UC27
    UC16 -. "<<include>>" .-> UC28
    UC17 -. "<<include>>" .-> UC28
    UC18 -. "<<include>>" .-> UC28
    UC11 -. "<<include>>" .-> UC29
    UC11 -. "<<include>>" .-> UC30
    UC12 -. "<<include>>" .-> UC30
```

### 2.1. Ghi chú Use Case

- `Nhận báo thức` bao gồm việc hệ thống tự động kích hoạt báo thức đúng giờ và ghi lại vào lịch sử thông báo.
- `Hoãn báo thức` và `Tắt báo thức` đều được ghi vào lịch sử thông báo để User tra cứu lại.
- `Đánh dấu hoàn thành công việc` bao gồm việc tự động tạo công việc lặp kế tiếp (nếu công việc có lặp lại) và hủy các nhắc nhở chưa kích hoạt của công việc đó.
- `Xóa công việc` cũng kéo theo việc hủy toàn bộ nhắc nhở chưa kích hoạt liên quan.
- User chỉ hủy được nhắc nhở bằng cách hoàn thành, hủy hoặc xóa công việc chứa nhắc nhở đó, hoặc chỉnh sửa/xóa trực tiếp nhắc nhở khi công việc chưa đến giờ báo.

## 3. Activity Diagram – Quy trình tạo công việc và thiết lập nhắc nhở

```mermaid
flowchart TD
    Start([Bắt đầu]) --> Login{Đã đăng nhập?}
    Login -- Không --> Auth[Đăng nhập hoặc đăng ký]
    Auth --> AuthOK{Xác thực thành công?}
    AuthOK -- Không --> Auth
    AuthOK -- Có --> CreateTask
    Login -- Có --> CreateTask[Tạo công việc mới]

    CreateTask --> InputInfo[Nhập tiêu đề, mô tả, danh mục, ưu tiên, thời hạn]
    InputInfo --> Valid{Thông tin hợp lệ?<br/>Tiêu đề không rỗng}
    Valid -- Không --> InputInfo
    Valid -- Có --> Repeat{Có lặp lại?}

    Repeat -- Có --> SetRepeat[Chọn chu kỳ: Hằng ngày/Hằng tuần/Hằng tháng]
    SetRepeat --> SetReminder
    Repeat -- Không --> SetReminder[Thiết lập một hoặc nhiều nhắc nhở]

    SetReminder --> ReminderValid{Thời điểm nhắc <= thời hạn<br/>và tối đa 5 nhắc nhở?}
    ReminderValid -- Không --> SetReminder
    ReminderValid -- Có --> SaveTask[Lưu công việc và lên lịch nhắc nhở]
    SaveTask --> Success[Thông báo tạo công việc thành công]
    Success --> End([Kết thúc])
```

### 3.1. Kết quả của quy trình tạo công việc

- Công việc mới được tạo với trạng thái **Chưa làm**.
- Mỗi nhắc nhở hợp lệ được đưa vào hàng đợi lên lịch để hệ thống kích hoạt đúng giờ.
- Nếu công việc có lặp lại, chu kỳ được lưu cùng công việc để tái sử dụng khi hoàn thành lần đầu.

## 4. Activity Diagram – Quy trình báo thức (Reminder Lifecycle)

```mermaid
flowchart TD
    Start([Bắt đầu]) --> Scheduled[Nhắc nhở: Đã lên lịch]
    Scheduled --> TimeUp{Đến đúng thời điểm nhắc?}
    TimeUp -- Chưa --> TaskChanged{Công việc bị hoàn thành/<br/>hủy/xóa trước giờ?}
    TaskChanged -- Có --> Cancelled[Nhắc nhở: Đã hủy]
    Cancelled --> End([Kết thúc])
    TaskChanged -- Không --> TimeUp

    TimeUp -- Rồi --> Trigger[Kích hoạt báo thức: âm thanh, rung, thông báo đẩy]
    Trigger --> LogSent[Ghi lịch sử thông báo: Đã gửi]
    LogSent --> AppOpen{Ứng dụng đang mở?}

    AppOpen -- Có --> ShowAlarm[Hiển thị màn hình báo thức toàn màn hình]
    ShowAlarm --> UserAction{User chọn?}

    UserAction -- Hoãn --> SnoozeCount{Đã hoãn < 3 lần?}
    SnoozeCount -- Có --> Reschedule[Tạo thời điểm nhắc mới = hiện tại + thời gian hoãn]
    Reschedule --> LogSnooze[Ghi lịch sử thông báo: Đã hoãn]
    LogSnooze --> Scheduled

    SnoozeCount -- Không --> ForceHold[Giữ nguyên báo thức, không cho hoãn thêm]
    ForceHold --> UserAction

    UserAction -- Tắt --> Dismissed[Nhắc nhở: Đã tắt]
    Dismissed --> LogDismiss[Ghi lịch sử thông báo: Đã tắt]
    LogDismiss --> End

    AppOpen -- Không --> WaitOpen[Chờ User mở ứng dụng hoặc tương tác từ thông báo đẩy]
    WaitOpen --> UserAction
```

### 4.1. Quy tắc chuyển trạng thái nhắc nhở

| Trạng thái hiện tại | Sự kiện | Trạng thái sau xử lý | Ghi chú |
|---|---|---|---|
| Đã lên lịch | Đến giờ nhắc | Đã kích hoạt | Gửi thông báo kèm âm thanh, rung; ghi log "Đã gửi". |
| Đã lên lịch | Công việc Hoàn thành/Đã hủy/Xóa trước giờ | Đã hủy | Không gửi thông báo. |
| Đã kích hoạt | User chọn Hoãn (số lần hoãn < 3) | Đã lên lịch (thời điểm mới) | Ghi log "Đã hoãn". |
| Đã kích hoạt | User chọn Hoãn (đã đủ 3 lần) | Đã kích hoạt (giữ nguyên) | Không cho hoãn thêm, chỉ có thể Tắt. |
| Đã kích hoạt | User chọn Tắt | Đã tắt | Ghi log "Đã tắt"; kết thúc vòng đời nhắc nhở. |

## 5. Kiểm tra nhất quán với tài liệu BA

| Nội dung | Thể hiện trong sơ đồ |
|---|---|
| Cơ chế báo thức | Kích hoạt kèm âm thanh/rung, không phải thông báo im lặng thông thường. |
| Giới hạn hoãn | Tối đa 3 lần hoãn liên tiếp trước khi bắt buộc Tắt. |
| Hủy nhắc nhở khi công việc kết thúc sớm | Thể hiện trong nhánh `TaskChanged` của Activity Diagram báo thức. |
| Công việc lặp lại | Chu kỳ được chọn ngay khi tạo công việc, tái sử dụng khi hoàn thành. |
| Ghi log thông báo | Mọi nhánh Gửi/Hoãn/Tắt đều có bước ghi lịch sử thông báo tương ứng. |

### 5.1. Đối chiếu mã sơ đồ với Business Analysis

| Mã sơ đồ | Mã Use Case trong BA |
|---|---|
| `UC01`–`UC04` | `UC-G-01` đến `UC-G-04`. |
| `UC05`–`UC24` | `UC-U-01` đến `UC-U-20`. |
| `UC25`–`UC26` | `UC-A-02`, `UC-A-03` (`UC-A-01` Đăng nhập quản trị dùng chung `UC03`). |
| `UC27`–`UC30` | Hành động con được bao gồm trong `UC-U-12` (Nhận báo thức), `UC-U-13` (Hoãn báo thức), `UC-U-14` (Tắt báo thức), `UC-U-07`/`UC-U-08` (Đánh dấu hoàn thành/Xóa công việc); không có mã Use Case độc lập trong BA. |
