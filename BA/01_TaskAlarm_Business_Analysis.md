# Tài liệu Business Analysis – TaskAlarm

## 1. Giới thiệu dự án

### 1.1. Giới thiệu

TaskAlarm là ứng dụng quản lý thời gian và công việc cá nhân, hoạt động trên cả **Website** và **Mobile App** (Android/iOS), giúp người dùng lên kế hoạch, theo dõi và hoàn thành công việc đúng hạn. Điểm khác biệt cốt lõi của TaskAlarm so với các ứng dụng to-do thông thường là cơ chế **nhắc nhở kiểu báo thức**: khi đến thời điểm đã hẹn, hệ thống không chỉ gửi thông báo im lặng mà còn **đổ chuông, rung và hiển thị màn hình nhắc nhở toàn màn hình** giống như đồng hồ báo thức, buộc người dùng phải chủ động **Hoãn (Snooze)** hoặc **Tắt (Dismiss)** để xác nhận đã nhận biết công việc.

Ứng dụng hướng đến người dùng cá nhân (học sinh, sinh viên, người đi làm) cần một công cụ đơn giản, dễ dùng để không bỏ lỡ các công việc, deadline hoặc lịch trình quan trọng trong ngày.

### 1.2. Mục tiêu

- Giúp người dùng tạo, sắp xếp và theo dõi công việc theo ngày/tuần/tháng một cách trực quan.
- Đảm bảo người dùng **không bỏ lỡ** công việc quan trọng nhờ cơ chế nhắc nhở dạng báo thức (âm thanh, rung, màn hình nhắc nhở).
- Đồng bộ dữ liệu công việc giữa Website và Mobile App theo thời gian thực.
- Cung cấp giao diện đơn giản, thao tác nhanh, phù hợp sử dụng hằng ngày trên nhiều loại thiết bị.
- Làm cơ sở phân tích cho các bước thiết kế Use Case, ERD, cơ sở dữ liệu, UI/UX, Backend và Frontend/Mobile tiếp theo.

### 1.3. Phạm vi hệ thống

| Nhóm người dùng | Phạm vi chức năng |
|---|---|
| Guest | Xem trang giới thiệu ứng dụng; đăng ký, đăng nhập, quên mật khẩu. |
| User | Quản lý hồ sơ, mật khẩu; quản lý danh mục công việc; tạo/sửa/xóa công việc; thiết lập công việc lặp lại; thiết lập và nhận nhắc nhở kiểu báo thức (âm thanh, rung, snooze/dismiss); xem lịch, dashboard cá nhân, lịch sử thông báo; tùy chỉnh cài đặt thông báo. |
| Admin | Đăng nhập quản trị; xem dashboard hệ thống; quản lý (khóa/mở) tài khoản người dùng; xem thống kê sử dụng cơ bản. |

### 1.4. Ngoài phạm vi

- Cộng tác nhóm: giao việc cho người khác, chia sẻ công việc, bình luận, làm việc chung trên một công việc.
- Đồng bộ hai chiều với lịch bên thứ ba (Google Calendar, Outlook Calendar...).
- Trợ lý AI, chatbot hoặc gợi ý lịch trình tự động bằng AI.
- Gói trả phí, thanh toán trực tuyến, mua bán trong ứng dụng.
- Nhắn tin, gọi thoại, gọi video giữa người dùng.
- Quy tắc lặp lại phức tạp kiểu RRULE (ví dụ "thứ Ba thứ 2 của mỗi tháng"); chỉ hỗ trợ lặp Hằng ngày/Hằng tuần/Hằng tháng.
- Chế độ offline đầy đủ; ứng dụng cần kết nối mạng để đồng bộ, có thể xem dữ liệu đã tải trước đó ở chế độ chỉ đọc.
- Mô hình microservice, kiến trúc CQRS/Event Sourcing.

### 1.5. Đối tượng sử dụng

| Đối tượng | Nhu cầu chính |
|---|---|
| Khách vãng lai (Guest) | Tìm hiểu ứng dụng và tạo tài khoản để bắt đầu sử dụng. |
| Người dùng (User) | Quản lý công việc cá nhân, không bỏ lỡ deadline, được nhắc nhở đúng lúc và rõ ràng. |
| Quản trị viên (Admin) | Cần công cụ giám sát tài khoản người dùng và tình trạng hoạt động chung của hệ thống. |

### 1.6. Stakeholder

| Stakeholder | Vai trò/Mối quan tâm |
|---|---|
| Chủ sở hữu sản phẩm TaskAlarm | Mong muốn có một ứng dụng quản lý thời gian dễ dùng, đáng tin cậy về mặt nhắc nhở. |
| Người dùng | Mong muốn quản lý công việc đơn giản và được nhắc nhở chắc chắn, không bị bỏ sót. |
| Quản trị viên | Cần công cụ theo dõi tài khoản và tình trạng hoạt động hệ thống. |
| Nhóm thực hiện đồ án | Cần tài liệu nghiệp vụ thống nhất để thiết kế và phát triển hệ thống. |
| Giảng viên/Hội đồng đánh giá | Đánh giá tính hợp lý, đầy đủ và nhất quán của phân tích nghiệp vụ. |

### 1.7. Giả định

- Mỗi tài khoản người dùng sử dụng một email duy nhất, dùng chung cho Website và Mobile App.
- TaskAlarm là ứng dụng cá nhân (single-user); một công việc chỉ thuộc về đúng một User, không có khái niệm giao việc/chia sẻ.
- Thời gian hệ thống hiển thị và lưu trữ theo múi giờ của thiết bị người dùng; máy chủ lưu thời điểm theo UTC.
- Người dùng có thể đăng ký nhận thông báo trên nhiều thiết bị (nhiều trình duyệt/điện thoại) cho cùng một tài khoản.
- Ứng dụng cần quyền gửi thông báo đẩy (push notification) và quyền phát âm thanh/rung trên thiết bị để cơ chế báo thức hoạt động; nếu người dùng từ chối quyền, hệ thống chỉ hiển thị nhắc nhở trong ứng dụng khi đang mở.
- Admin là vai trò quản trị duy nhất trong phạm vi đồ án, được tạo bằng seed data hoặc thao tác trực tiếp trong cơ sở dữ liệu.
- Backup dữ liệu, logging hạ tầng và giám sát hệ thống là trách nhiệm của cấu hình hạ tầng/framework; không yêu cầu entity hoặc API nghiệp vụ riêng trong phạm vi này.

### 1.8. Thuật ngữ

| Thuật ngữ | Diễn giải |
|---|---|
| Guest | Người truy cập ứng dụng nhưng chưa đăng nhập. |
| User | Người dùng đã đăng ký, đăng nhập và quản lý công việc cá nhân. |
| Admin | Người dùng có quyền quản trị hệ thống. |
| Công việc (Task) | Một mục công việc/nhiệm vụ mà User cần thực hiện, có thời hạn (due date/time). |
| Danh mục (Category) | Nhóm phân loại công việc theo lĩnh vực, ví dụ: Học tập, Công việc, Cá nhân. |
| Việc con (Subtask) | Mục nhỏ (checklist item) nằm trong một Task. |
| Nhắc nhở (Reminder) | Một thời điểm được hẹn trước để hệ thống thông báo cho User về một Task sắp đến hạn. |
| Báo thức (Alarm) | Trạng thái khi một Reminder được kích hoạt đúng giờ: hệ thống phát âm thanh, rung và hiển thị màn hình nhắc nhở. |
| Hoãn (Snooze) | Thao tác của User để dời thời điểm báo thức sang một khoảng thời gian sau đó. |
| Tắt (Dismiss) | Thao tác của User để tắt hẳn báo thức đang kêu, xác nhận đã tiếp nhận nhắc nhở. |
| Công việc lặp lại (Repeat Task) | Task được tự động tạo lại theo chu kỳ Hằng ngày/Hằng tuần/Hằng tháng. |
| Thiết bị (Device) | Trình duyệt hoặc điện thoại đã đăng ký nhận thông báo đẩy cho một tài khoản. |
| Quá hạn (Overdue) | Trạng thái hiển thị cho Task đã qua thời điểm đến hạn nhưng chưa hoàn thành. |
| Dashboard | Màn hình tổng quan cho User hoặc Admin về dữ liệu vận hành cơ bản. |

## 2. Phân tích nghiệp vụ

### 2.1. Quy trình tạo và quản lý công việc

1. Guest đăng ký hoặc đăng nhập để trở thành User.
2. User tạo danh mục công việc (tùy chọn) để nhóm các công việc liên quan, ví dụ: Học tập, Công việc, Cá nhân.
3. User tạo một công việc mới với tiêu đề, mô tả, danh mục, mức độ ưu tiên và thời điểm đến hạn (due date/time).
4. User có thể thêm các việc con (checklist) để chia nhỏ công việc.
5. User có thể thiết lập công việc lặp lại (Hằng ngày/Hằng tuần/Hằng tháng) nếu công việc mang tính định kỳ.
6. User thiết lập một hoặc nhiều nhắc nhở cho công việc (ví dụ: đúng giờ, trước 10 phút, trước 1 giờ).
7. User theo dõi danh sách công việc theo ngày, theo trạng thái hoặc theo danh mục; có thể chỉnh sửa hoặc xóa công việc khi cần.
8. User đánh dấu công việc là hoàn thành khi đã thực hiện xong; nếu là công việc lặp lại, hệ thống tự tạo bản sao tiếp theo theo chu kỳ.

### 2.2. Quy trình nhắc nhở & báo thức

1. Hệ thống theo dõi các Reminder đã lên lịch cho từng Task của User.
2. Khi đến đúng thời điểm nhắc nhở, hệ thống kích hoạt báo thức: gửi thông báo đẩy tới các thiết bị đã đăng ký của User, kèm âm thanh chuông báo và rung (trên mobile).
3. Nếu ứng dụng đang mở, hệ thống hiển thị màn hình nhắc nhở toàn màn hình với thông tin công việc và hai lựa chọn: **Hoãn (Snooze)** hoặc **Tắt (Dismiss)**.
4. Nếu User chọn Hoãn, hệ thống tạo lại thời điểm báo thức mới sau một khoảng thời gian mặc định (hoặc tùy chỉnh), tối đa một số lần hoãn nhất định.
5. Nếu User chọn Tắt, báo thức dừng lại và được ghi nhận vào lịch sử thông báo.
6. Nếu công việc chuyển sang trạng thái Hoàn thành hoặc Đã hủy trước khi đến giờ nhắc, các Reminder chưa kích hoạt của công việc đó bị hủy, không gửi thông báo nữa.
7. Mọi lần gửi thông báo đều được ghi lại trong lịch sử thông báo để User có thể xem lại.

### 2.3. Quy trình công việc lặp lại

1. Khi tạo Task, User có thể chọn quy tắc lặp: Không lặp, Hằng ngày, Hằng tuần hoặc Hằng tháng.
2. Task lặp lại giữ nguyên cấu hình nhắc nhở, danh mục và mức độ ưu tiên cho mỗi lần lặp.
3. Khi một lần lặp được đánh dấu Hoàn thành, hệ thống tự động tạo bản ghi Task tiếp theo với thời điểm đến hạn được tính theo chu kỳ đã chọn.
4. User có thể dừng lặp lại bất kỳ lúc nào; các lần lặp trước đó không bị ảnh hưởng.

### 2.4. Giá trị hệ thống mang lại

| Đối tượng | Giá trị |
|---|---|
| User | Quản lý công việc cá nhân tập trung, được nhắc nhở chắc chắn kiểu báo thức nên khó bỏ lỡ deadline, dùng được cả trên Web và Mobile. |
| Admin | Có công cụ giám sát tài khoản và tình trạng hoạt động chung, giảm việc theo dõi thủ công. |
| Nhóm phát triển | Có quy trình nghiệp vụ và yêu cầu thống nhất làm căn cứ thiết kế, xây dựng và kiểm thử hệ thống. |

## 3. Actor

### 3.1. Guest

| Nội dung | Mô tả |
|---|---|
| Vai trò | Người truy cập ứng dụng nhưng chưa đăng nhập. |
| Quyền hạn | Xem nội dung công khai và thực hiện các chức năng xác thực cơ bản. |
| Mục tiêu | Tìm hiểu ứng dụng và tạo/đăng nhập tài khoản để bắt đầu quản lý công việc. |
| Chức năng chính | Xem trang giới thiệu; đăng ký; đăng nhập; quên mật khẩu. |

### 3.2. User

| Nội dung | Mô tả |
|---|---|
| Vai trò | Người dùng đã đăng ký và đăng nhập vào ứng dụng. |
| Quyền hạn | Sử dụng toàn bộ chức năng của Guest và các chức năng quản lý công việc cá nhân. |
| Mục tiêu | Lên kế hoạch, theo dõi và hoàn thành công việc đúng hạn nhờ nhắc nhở kiểu báo thức. |
| Chức năng chính | Quản lý hồ sơ, mật khẩu; quản lý danh mục; tạo/sửa/xóa công việc và việc con; thiết lập lặp lại; thiết lập và nhận nhắc nhở; hoãn/tắt báo thức; xem lịch, dashboard, lịch sử thông báo; cài đặt thông báo; quản lý thiết bị nhận thông báo. |

### 3.3. Admin

| Nội dung | Mô tả |
|---|---|
| Vai trò | Người quản trị vận hành hệ thống TaskAlarm. |
| Quyền hạn | Truy cập khu vực quản trị và quản lý tài khoản người dùng. |
| Mục tiêu | Đảm bảo hệ thống hoạt động ổn định và tài khoản người dùng được kiểm soát. |
| Chức năng chính | Đăng nhập quản trị, xem dashboard hệ thống, quản lý (khóa/mở) tài khoản người dùng, xem thống kê sử dụng cơ bản. |

## 4. Functional Requirements

| ID | Chức năng | Mô tả | Actor |
|---|---|---|---|
| FR-01 | Xem trang giới thiệu | Hiển thị giới thiệu tổng quan về TaskAlarm. | Guest |
| FR-02 | Đăng ký | Cho phép Guest tạo tài khoản User bằng thông tin hợp lệ. | Guest |
| FR-03 | Đăng nhập | Cho phép người dùng đăng nhập bằng email và mật khẩu. | Guest, User, Admin |
| FR-04 | Quên mật khẩu | Cho phép Guest hoặc User yêu cầu đặt lại mật khẩu qua email đã đăng ký. | Guest, User |
| FR-05 | Xem/cập nhật hồ sơ cá nhân | Hiển thị và cho phép cập nhật thông tin hồ sơ của User đang đăng nhập. | User |
| FR-06 | Đổi mật khẩu | Cho phép User thay đổi mật khẩu sau khi xác thực mật khẩu hiện tại. | User |
| FR-07 | Quản lý danh mục công việc | Cho phép User thêm, sửa, ẩn/xóa danh mục và chọn màu cho danh mục. | User |
| FR-08 | Tạo công việc | Cho phép User tạo công việc mới với tiêu đề, mô tả, danh mục, mức độ ưu tiên và thời điểm đến hạn. | User |
| FR-09 | Xem danh sách công việc | Hiển thị công việc theo ngày, trạng thái hoặc danh mục. | User |
| FR-10 | Xem chi tiết công việc | Hiển thị đầy đủ thông tin, việc con và nhắc nhở của một công việc. | User |
| FR-11 | Cập nhật công việc | Cho phép User chỉnh sửa thông tin công việc thuộc sở hữu của mình. | User |
| FR-12 | Đánh dấu hoàn thành công việc | Cho phép User chuyển trạng thái công việc sang Hoàn thành hoặc quay lại Chưa hoàn thành. | User |
| FR-13 | Xóa công việc | Cho phép User xóa công việc không còn cần thiết. | User |
| FR-14 | Quản lý việc con (Subtask) | Cho phép User thêm, đánh dấu hoàn thành và xóa việc con trong một công việc. | User |
| FR-15 | Thiết lập công việc lặp lại | Cho phép User chọn chu kỳ lặp Hằng ngày/Hằng tuần/Hằng tháng cho công việc. | User |
| FR-16 | Thiết lập nhắc nhở | Cho phép User thêm một hoặc nhiều thời điểm nhắc nhở cho một công việc. | User |
| FR-17 | Xóa/sửa nhắc nhở | Cho phép User chỉnh sửa hoặc xóa nhắc nhở đã thiết lập khi công việc chưa đến giờ báo. | User |
| FR-18 | Kích hoạt báo thức | Hệ thống tự động gửi thông báo kèm âm thanh chuông báo và rung khi đến thời điểm nhắc nhở đã lên lịch. | Hệ thống |
| FR-19 | Hiển thị màn hình nhắc nhở | Hệ thống hiển thị màn hình báo thức toàn màn hình khi ứng dụng đang mở tại thời điểm nhắc nhở. | Hệ thống |
| FR-20 | Hoãn báo thức (Snooze) | Cho phép User dời thời điểm báo thức sang một khoảng thời gian sau đó. | User |
| FR-21 | Tắt báo thức (Dismiss) | Cho phép User tắt hẳn báo thức đang kêu. | User |
| FR-22 | Cài đặt thông báo | Cho phép User tùy chỉnh âm thanh báo thức, thời gian hoãn mặc định và bật/tắt rung. | User |
| FR-23 | Đăng ký thiết bị nhận thông báo | Cho phép hệ thống lưu token thiết bị (web/mobile) để gửi thông báo đẩy. | Hệ thống |
| FR-24 | Quản lý thiết bị đã đăng ký | Cho phép User xem và gỡ các thiết bị đang nhận thông báo cho tài khoản của mình. | User |
| FR-25 | Tìm kiếm công việc | Cho phép User tìm công việc theo từ khóa tiêu đề. | User |
| FR-26 | Lọc công việc | Cho phép User lọc công việc theo trạng thái, mức độ ưu tiên, danh mục hoặc khoảng thời gian. | User |
| FR-27 | Xem lịch (Calendar View) | Hiển thị công việc theo dạng lịch ngày/tuần/tháng. | User |
| FR-28 | Xem dashboard cá nhân | Hiển thị số công việc hôm nay, quá hạn, hoàn thành và sắp tới. | User |
| FR-29 | Xem lịch sử thông báo | Cho phép User xem lại các thông báo/báo thức đã được gửi. | User |
| FR-30 | Xem dashboard hệ thống | Hiển thị số liệu tổng quan về số lượng người dùng, công việc và thông báo đã gửi. | Admin |
| FR-31 | Quản lý người dùng | Cho phép Admin xem danh sách, tìm kiếm và khóa/mở tài khoản User. | Admin |

## 5. Non-functional Requirements

| Nhóm | ID | Yêu cầu |
|---|---|---|
| Security | NFR-01 | Mật khẩu phải được lưu trữ dưới dạng mã hóa; không lưu mật khẩu gốc. |
| Security | NFR-02 | Chức năng theo vai trò phải được kiểm soát: Guest, User và Admin chỉ truy cập được dữ liệu/chức năng được cấp quyền. |
| Security | NFR-03 | User chỉ được xem, sửa hoặc xóa dữ liệu thuộc sở hữu của chính mình, như công việc, danh mục, nhắc nhở và thiết bị. |
| Security | NFR-04 | Admin phải đăng nhập mới được truy cập khu vực quản trị. |
| Security | NFR-05 | Dữ liệu nhập từ người dùng phải được kiểm tra tính hợp lệ trước khi lưu. |
| Notification Reliability | NFR-06 | Nhắc nhở phải được kích hoạt đúng thời điểm đã lên lịch, sai lệch không vượt quá vài giây trong điều kiện mạng ổn định. |
| Notification Reliability | NFR-07 | Nếu thiết bị mất kết nối tại thời điểm nhắc nhở, hệ thống phải gửi lại thông báo khi thiết bị kết nối trở lại, không được bỏ sót. |
| Notification Reliability | NFR-08 | Mobile App cần lên lịch báo thức cục bộ (local notification) để nhắc nhở vẫn hoạt động khi mất kết nối mạng tạm thời. |
| Performance | NFR-09 | Danh sách công việc, lịch và dashboard nên phản hồi trong vòng 3 giây ở điều kiện sử dụng bình thường. |
| Performance | NFR-10 | Danh sách công việc và lịch sử thông báo phải hỗ trợ phân trang hoặc tải theo khoảng thời gian để tránh tải quá nhiều dữ liệu cùng lúc. |
| Availability | NFR-11 | Hệ thống cần hoạt động ổn định trong thời gian trình diễn và kiểm thử đồ án, trừ thời gian bảo trì đã thông báo. |
| Availability | NFR-12 | Khi xảy ra lỗi xử lý, hệ thống phải thông báo lỗi thân thiện và không để người dùng tiếp tục thao tác trên dữ liệu không hợp lệ. |
| Maintainability | NFR-13 | Chức năng cần được phân chia theo các module nghiệp vụ rõ ràng để thuận tiện bảo trì và mở rộng trong phạm vi đồ án. |
| Maintainability | NFR-14 | Các thông báo, trạng thái công việc và quy tắc nghiệp vụ dùng thuật ngữ nhất quán trên Web và Mobile. |
| Responsive | NFR-15 | Giao diện Website phải sử dụng được trên máy tính, máy tính bảng và điện thoại di động. |
| Responsive | NFR-16 | Các thao tác quan trọng như tạo công việc, thiết lập nhắc nhở và hoãn/tắt báo thức phải dễ thực hiện trên màn hình nhỏ. |
| Usability | NFR-17 | Giao diện phải đơn giản, tối thiểu số bước để tạo một công việc kèm nhắc nhở. |
| Backup dữ liệu | NFR-18 | Dữ liệu nghiệp vụ quan trọng gồm người dùng, công việc, danh mục và nhắc nhở cần được sao lưu định kỳ. |
| Logging cơ bản | NFR-19 | Hệ thống cần ghi nhận lỗi hệ thống và lịch sử gửi thông báo để hỗ trợ kiểm tra và xử lý sự cố. |

## 6. Use Case List

### 6.1. Use Case của Guest

| ID | Use Case | Mô tả ngắn |
|---|---|---|
| UC-G-01 | Xem trang giới thiệu | Xem nội dung tổng quan về ứng dụng. |
| UC-G-02 | Đăng ký | Tạo tài khoản User. |
| UC-G-03 | Đăng nhập | Đăng nhập vào hệ thống. |
| UC-G-04 | Quên mật khẩu | Yêu cầu đặt lại mật khẩu. |

### 6.2. Use Case của User

| ID | Use Case | Mô tả ngắn |
|---|---|---|
| UC-U-01 | Xem/cập nhật hồ sơ cá nhân | Xem và chỉnh sửa thông tin cá nhân. |
| UC-U-02 | Đổi mật khẩu | Thay đổi mật khẩu tài khoản. |
| UC-U-03 | Quản lý danh mục công việc | Thêm, sửa, ẩn/xóa danh mục công việc. |
| UC-U-04 | Tạo công việc | Tạo một công việc mới. |
| UC-U-05 | Xem danh sách/chi tiết công việc | Xem công việc theo ngày, trạng thái hoặc danh mục. |
| UC-U-06 | Cập nhật công việc | Chỉnh sửa thông tin công việc. |
| UC-U-07 | Đánh dấu hoàn thành công việc | Chuyển trạng thái công việc sang Hoàn thành. |
| UC-U-08 | Xóa công việc | Xóa công việc không còn cần thiết. |
| UC-U-09 | Quản lý việc con | Thêm, đánh dấu hoàn thành, xóa việc con. |
| UC-U-10 | Thiết lập lặp lại | Chọn chu kỳ lặp cho công việc. |
| UC-U-11 | Thiết lập nhắc nhở | Thêm, sửa, xóa nhắc nhở cho công việc. |
| UC-U-12 | Nhận báo thức | Nhận thông báo kèm âm thanh khi đến giờ nhắc nhở. |
| UC-U-13 | Hoãn báo thức | Dời thời điểm báo thức sang sau. |
| UC-U-14 | Tắt báo thức | Tắt hẳn báo thức đang kêu. |
| UC-U-15 | Cài đặt thông báo | Tùy chỉnh âm thanh, thời gian hoãn mặc định, rung. |
| UC-U-16 | Quản lý thiết bị | Xem và gỡ thiết bị nhận thông báo. |
| UC-U-17 | Tìm kiếm/lọc công việc | Tìm và lọc công việc theo nhiều tiêu chí. |
| UC-U-18 | Xem lịch | Xem công việc theo dạng lịch ngày/tuần/tháng. |
| UC-U-19 | Xem dashboard cá nhân | Xem số liệu tổng quan công việc của bản thân. |
| UC-U-20 | Xem lịch sử thông báo | Xem lại các thông báo đã được gửi. |

### 6.3. Use Case của Admin

| ID | Use Case | Mô tả ngắn |
|---|---|---|
| UC-A-01 | Đăng nhập quản trị | Đăng nhập vào khu vực quản trị. |
| UC-A-02 | Xem dashboard hệ thống | Xem số liệu tổng quan của hệ thống. |
| UC-A-03 | Quản lý người dùng | Xem, tìm kiếm và khóa/mở tài khoản User. |

## 7. User Story

### 7.1. User Story của Guest

| ID | User Story |
|---|---|
| US-G-01 | As a Guest, I want to xem trang giới thiệu, so that I can hiểu TaskAlarm giúp ích gì cho tôi trước khi đăng ký. |
| US-G-02 | As a Guest, I want to đăng ký tài khoản, so that I can bắt đầu quản lý công việc của mình. |
| US-G-03 | As a Guest, I want to đăng nhập, so that I can sử dụng các chức năng dành cho User. |
| US-G-04 | As a Guest, I want to yêu cầu đặt lại mật khẩu, so that I can lấy lại quyền truy cập khi quên mật khẩu. |

### 7.2. User Story của User

| ID | User Story |
|---|---|
| US-U-01 | As a User, I want to tạo công việc kèm thời hạn, so that tôi ghi nhớ những gì cần làm và khi nào cần hoàn thành. |
| US-U-02 | As a User, I want to phân loại công việc theo danh mục, so that tôi dễ dàng theo dõi từng mảng công việc. |
| US-U-03 | As a User, I want to thiết lập nhiều nhắc nhở cho một công việc, so that tôi có đủ thời gian chuẩn bị trước khi đến hạn. |
| US-U-04 | As a User, I want to được báo thức bằng âm thanh và rung khi đến giờ, so that tôi không bỏ lỡ công việc quan trọng dù không mở ứng dụng. |
| US-U-05 | As a User, I want to hoãn báo thức, so that tôi có thể dời nhắc nhở sang vài phút sau khi đang bận. |
| US-U-06 | As a User, I want to tắt báo thức khi đã biết, so that ứng dụng không tiếp tục làm phiền tôi cho công việc đó. |
| US-U-07 | As a User, I want to thiết lập công việc lặp lại, so that tôi không phải tạo lại các công việc định kỳ mỗi lần. |
| US-U-08 | As a User, I want to xem lịch theo tuần/tháng, so that tôi hình dung được khối lượng công việc sắp tới. |
| US-U-09 | As a User, I want to xem dashboard cá nhân, so that tôi biết ngay hôm nay có gì cần làm và có gì đang quá hạn. |
| US-U-10 | As a User, I want to tùy chỉnh âm thanh và thời gian hoãn mặc định, so that trải nghiệm nhắc nhở phù hợp với thói quen của tôi. |
| US-U-11 | As a User, I want to xem lịch sử thông báo, so that tôi có thể kiểm tra lại các nhắc nhở đã bỏ lỡ hoặc đã xử lý. |

### 7.3. User Story của Admin

| ID | User Story |
|---|---|
| US-A-01 | As an Admin, I want to xem dashboard hệ thống, so that tôi nắm được tình hình sử dụng chung của ứng dụng. |
| US-A-02 | As an Admin, I want to quản lý tài khoản người dùng, so that tôi có thể khóa các tài khoản vi phạm hoặc bất thường. |

## 8. Business Rules

| ID | Business Rule |
|---|---|
| BR-01 | Mỗi tài khoản phải có một email duy nhất trong hệ thống. |
| BR-02 | Email đăng ký phải đúng định dạng email hợp lệ. |
| BR-03 | Mật khẩu không được lưu dưới dạng văn bản gốc. |
| BR-04 | Guest phải đăng ký và đăng nhập thành công trước khi tạo hoặc quản lý công việc, danh mục, nhắc nhở. |
| BR-05 | User chỉ được xem, sửa hoặc xóa công việc, danh mục, việc con, nhắc nhở và thiết bị thuộc sở hữu của chính mình. |
| BR-06 | Tiêu đề công việc không được để trống. |
| BR-07 | Mỗi công việc chỉ nhận một trong các trạng thái: Chưa làm, Đang làm, Hoàn thành, Đã hủy. |
| BR-08 | "Quá hạn" là trạng thái hiển thị được tính toán từ thời điểm đến hạn nhỏ hơn hiện tại và trạng thái khác Hoàn thành/Đã hủy; không lưu thành một giá trị trạng thái riêng trong dữ liệu. |
| BR-09 | Một công việc có thể có nhiều nhắc nhở nhưng tối đa 5 nhắc nhở cho mỗi công việc để tránh gây phiền và giữ hệ thống đơn giản. |
| BR-10 | Thời điểm của mỗi nhắc nhở phải nhỏ hơn hoặc bằng thời điểm đến hạn của công việc. |
| BR-11 | Khi công việc chuyển sang trạng thái Hoàn thành hoặc Đã hủy, mọi nhắc nhở chưa kích hoạt của công việc đó phải được hủy, không gửi thông báo nữa. |
| BR-12 | Khi User hoãn (Snooze) một báo thức, hệ thống tạo thời điểm nhắc mới bằng thời điểm hiện tại cộng thời gian hoãn mặc định hoặc tùy chỉnh. |
| BR-13 | Mỗi báo thức chỉ được hoãn tối đa 3 lần liên tiếp; sau đó hệ thống giữ nguyên nhắc nhở cho đến khi User tắt (Dismiss). |
| BR-14 | Công việc lặp lại chỉ hỗ trợ chu kỳ Hằng ngày, Hằng tuần hoặc Hằng tháng. |
| BR-15 | Khi một lần lặp của công việc được đánh dấu Hoàn thành, hệ thống phải tự động tạo bản ghi công việc kế tiếp theo đúng chu kỳ đã chọn, giữ nguyên danh mục, mức ưu tiên và cấu hình nhắc nhở. |
| BR-16 | Mỗi thiết bị đăng ký nhận thông báo phải gắn với đúng một tài khoản User tại một thời điểm. |
| BR-17 | Danh mục bị ẩn/xóa không được xóa cứng các công việc đã gán vào danh mục đó; công việc được chuyển hiển thị dưới dạng "Không phân loại". |
| BR-18 | Tài khoản bị khóa (is_active = false) không được đăng nhập hoặc nhận thông báo mới. |
| BR-19 | Admin chỉ được quản lý trạng thái hoạt động của tài khoản User, không được xem nội dung chi tiết công việc cá nhân của User. |
| BR-20 | Mọi lần hệ thống kích hoạt một nhắc nhở đều phải được ghi lại vào lịch sử thông báo, kèm trạng thái đã gửi, đã hoãn hoặc đã tắt. |

## 9. Entity nghiệp vụ

> Các entity dưới đây là đối tượng nghiệp vụ dự kiến, dùng làm cơ sở cho bước thiết kế ERD và cơ sở dữ liệu. Phần này không phải thiết kế Database.

| Entity | Chức năng nghiệp vụ |
|---|---|
| User | Lưu thông tin tài khoản, gồm thông tin đăng nhập, thông tin cá nhân, trạng thái hoạt động và vai trò. |
| Role | Xác định vai trò của User trong hệ thống: User hoặc Admin. |
| PasswordResetRequest | Lưu thông tin yêu cầu đặt lại mật khẩu của User, phục vụ chức năng quên mật khẩu. |
| Category | Lưu thông tin danh mục công việc do User tự tạo, gồm tên và màu hiển thị. |
| Task | Lưu thông tin một công việc: tiêu đề, mô tả, danh mục, mức độ ưu tiên, thời điểm đến hạn, trạng thái và quy tắc lặp lại. |
| Subtask | Lưu từng việc con (checklist item) thuộc một Task, gồm nội dung và trạng thái hoàn thành. |
| Reminder | Lưu từng thời điểm nhắc nhở được thiết lập cho một Task và trạng thái đã kích hoạt hay chưa. |
| Device | Lưu thông tin thiết bị (trình duyệt/điện thoại) đã đăng ký nhận thông báo đẩy cho một User. |
| NotificationLog | Lưu lịch sử mỗi lần hệ thống gửi thông báo/báo thức, gồm thời điểm gửi và kết quả xử lý (đã gửi/đã hoãn/đã tắt). |
| NotificationSetting | Lưu tùy chọn thông báo của từng User: âm thanh báo thức, thời gian hoãn mặc định, bật/tắt rung. |

### 9.1. Quan hệ nghiệp vụ chính

- Một `Role` có thể được gán cho nhiều `User`; mỗi `User` thuộc một `Role`.
- Một `User` có thể tạo nhiều `Category`, nhiều `Task` và đăng ký nhiều `Device`.
- Một `Category` có thể có nhiều `Task`; một `Task` thuộc một `Category` hoặc không có danh mục.
- Một `Task` có thể có nhiều `Subtask` và nhiều `Reminder`.
- Một `Reminder` khi được kích hoạt sẽ sinh ra một hoặc nhiều bản ghi `NotificationLog` (mỗi lần gửi tới từng `Device`).
- Một `User` có đúng một `NotificationSetting`.
- Một `Task` lặp lại, khi hoàn thành, sinh ra một `Task` mới cùng thuộc về `User` đó.

## 10. Module hệ thống

| Module | Trách nhiệm |
|---|---|
| Authentication | Đăng ký, đăng nhập, quên mật khẩu, đặt lại mật khẩu, xác thực người dùng và phân quyền theo vai trò. |
| User | Quản lý hồ sơ cá nhân, đổi mật khẩu, trạng thái tài khoản và quản lý người dùng từ khu vực Admin. |
| Category | Quản lý danh mục công việc cá nhân của User. |
| Task | Tạo, xem, cập nhật, xóa công việc; quản lý việc con; thiết lập lặp lại; tìm kiếm và lọc công việc. |
| Reminder & Notification | Lên lịch, kích hoạt, gửi thông báo/báo thức; xử lý hoãn/tắt; ghi lịch sử thông báo. |
| Device | Đăng ký, quản lý và gỡ thiết bị nhận thông báo đẩy. |
| Calendar | Hiển thị công việc theo dạng lịch ngày/tuần/tháng. |
| Dashboard | Tổng hợp số liệu công việc cá nhân cho User và số liệu vận hành cơ bản cho Admin. |

## 11. Danh sách màn hình

### 11.1. Màn hình Guest

| ID | Màn hình | Nội dung chính |
|---|---|---|
| SCR-G-01 | Trang giới thiệu | Giới thiệu tổng quan về TaskAlarm và các tính năng nổi bật. |
| SCR-G-02 | Đăng ký | Form tạo tài khoản User. |
| SCR-G-03 | Đăng nhập | Form đăng nhập cho User và Admin. |
| SCR-G-04 | Quên mật khẩu | Form nhập email để yêu cầu đặt lại mật khẩu. |
| SCR-G-05 | Đặt lại mật khẩu | Form thiết lập mật khẩu mới sau khi yêu cầu hợp lệ. |

### 11.2. Màn hình User

| ID | Màn hình | Nội dung chính |
|---|---|---|
| SCR-U-01 | Dashboard cá nhân | Tổng quan công việc hôm nay, quá hạn, hoàn thành và sắp tới. |
| SCR-U-02 | Danh sách công việc | Danh sách công việc theo ngày/trạng thái/danh mục, hỗ trợ tìm kiếm và lọc. |
| SCR-U-03 | Chi tiết công việc | Hiển thị đầy đủ thông tin, việc con và nhắc nhở của công việc. |
| SCR-U-04 | Thêm/Sửa công việc | Nhập tiêu đề, mô tả, danh mục, ưu tiên, thời hạn, quy tắc lặp lại và nhắc nhở. |
| SCR-U-05 | Lịch (Calendar) | Xem công việc theo dạng lịch ngày/tuần/tháng. |
| SCR-U-06 | Quản lý danh mục | Danh sách, thêm, sửa, ẩn/xóa danh mục công việc. |
| SCR-U-07 | Màn hình báo thức | Hiển thị toàn màn hình khi nhắc nhở kích hoạt, kèm nút Hoãn và Tắt. |
| SCR-U-08 | Lịch sử thông báo | Danh sách các thông báo/báo thức đã được gửi. |
| SCR-U-09 | Hồ sơ cá nhân | Xem và cập nhật thông tin cá nhân. |
| SCR-U-10 | Đổi mật khẩu | Nhập mật khẩu hiện tại và mật khẩu mới. |
| SCR-U-11 | Cài đặt thông báo | Tùy chỉnh âm thanh báo thức, thời gian hoãn mặc định, bật/tắt rung. |
| SCR-U-12 | Quản lý thiết bị | Danh sách thiết bị đang nhận thông báo, cho phép gỡ thiết bị. |

### 11.3. Màn hình Admin

| ID | Màn hình | Nội dung chính |
|---|---|---|
| SCR-A-01 | Đăng nhập quản trị | Đăng nhập vào khu vực quản trị. |
| SCR-A-02 | Dashboard hệ thống | Số liệu tổng quan về người dùng, công việc và thông báo đã gửi. |
| SCR-A-03 | Quản lý người dùng | Danh sách User, tìm kiếm và cập nhật trạng thái hoạt động. |

## 12. Kết luận

Tài liệu Business Analysis cho TaskAlarm đã xác định phạm vi ứng dụng quản lý thời gian và công việc cá nhân trên cả Website và Mobile App, với điểm khác biệt cốt lõi là cơ chế nhắc nhở kiểu báo thức. Tài liệu mô tả các đối tượng sử dụng, quy trình nghiệp vụ, yêu cầu chức năng và phi chức năng, Use Case, User Story, Business Rules, entity nghiệp vụ, module và danh sách màn hình cần thiết.

Các quy tắc trọng tâm đã được thống nhất xuyên suốt tài liệu:

- Mỗi công việc chỉ thuộc về một User; không có cộng tác nhóm trong phạm vi đồ án.
- Nhắc nhở phải được kích hoạt đúng giờ, kèm âm thanh và rung, kèm khả năng Hoãn (tối đa 3 lần) hoặc Tắt.
- Công việc chuyển sang Hoàn thành/Đã hủy sẽ hủy toàn bộ nhắc nhở chưa kích hoạt.
- Công việc lặp lại chỉ hỗ trợ ba chu kỳ đơn giản: Hằng ngày, Hằng tuần, Hằng tháng.
- Mọi lần gửi thông báo đều được ghi log để phục vụ tra cứu và khắc phục sự cố.

Các bước tiếp theo được đề xuất:

1. Xây dựng Use Case Diagram và Activity Diagram cho quy trình tạo công việc và quy trình nhắc nhở/báo thức.
2. Xây dựng ERD từ các entity nghiệp vụ đã xác định.
3. Thiết kế cơ sở dữ liệu, đặc biệt là cơ chế lưu và truy vấn Reminder theo thời gian thực.
4. Thiết kế UI/UX theo danh sách màn hình, chú trọng màn hình báo thức (SCR-U-07).
5. Lựa chọn công nghệ và thiết kế cơ chế gửi thông báo đẩy (Web Push cho Website, Local/Push Notification cho Mobile App).
6. Phát triển Backend theo các module nghiệp vụ.
7. Phát triển Frontend (Website) và Mobile App, kiểm thử các luồng chức năng chính, đặc biệt độ chính xác của thời gian nhắc nhở.
