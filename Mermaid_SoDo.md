# Bộ sơ đồ Mermaid cho báo cáo

Ghi chú:
- Các sơ đồ được sắp đúng thứ tự chèn ảnh trong báo cáo LaTeX.
- Xuất lần lượt thành `web1.png`, `web2.png`, ... `web21.png`.
- Các sơ đồ dạng luồng/use case/activity dùng `LR` để trải ngang.

## web1 - Use case tổng quan hệ thống
```mermaid
flowchart LR
    A[Admin]
    M[Manager]
    O[Officer]

    subgraph S[Hệ thống quản lý lịch công tác và lịch trực ban]
        direction LR
        U1((Đăng nhập / Khôi phục phiên))
        U2((Dashboard tổng quan))
        U3((Quản lý cán bộ))
        U4((Lập lịch công tác))
        U5((Lập lịch trực ban))
        U6((Lịch của tôi))
        U7((Ý kiến trực ban))
        U8((Thông báo))
        U9((Xuất/In lịch))
        U10((Quản trị tài khoản nội bộ))
        U11((Tra cứu lịch))

        U1 ~~~ U2
        U2 ~~~ U3
        U3 ~~~ U4
        U4 ~~~ U5
        U5 ~~~ U6
        U6 ~~~ U7
        U7 ~~~ U8
        U8 ~~~ U9
        U9 ~~~ U10
        U10 ~~~ U11
    end

    A --- U1
    A --- U2
    A --- U3
    A --- U4
    A --- U5
    A --- U6
    A --- U7
    A --- U8
    A --- U9
    A --- U10
    A --- U11

    M --- U1
    M --- U2
    M --- U3
    M --- U4
    M --- U5
    M --- U6
    M --- U7
    M --- U8
    M --- U9
    M --- U10
    M --- U11

    O --- U1
    O --- U2
    O --- U3
    O --- U6
    O --- U7
    O --- U8
    O --- U9
    O --- U11
```

## web2 - Use case phân rã nhóm xác thực
```mermaid
flowchart LR
    U[Người dùng]

    subgraph AUTH[Xác thực và phiên đăng nhập]
        direction LR
        A1((Đăng nhập))
        A2((Khôi phục phiên))
        A3((Đăng xuất))
        A4((Xác thực JWT))

        A1 ~~~ A2
        A2 ~~~ A3
        A3 ~~~ A4
    end

    U --- A1
    U --- A2
    U --- A3

    A1 -. include .-> A4
    A2 -. include .-> A4
```

## web3 - Use case phân rã nhóm quản lý cán bộ
```mermaid
flowchart LR
    A[Admin]
    M[Manager]
    O[Officer]

    subgraph OFC[Quản lý cán bộ]
        direction LR
        O1((Xem danh sách cán bộ))
        O2((Xem chi tiết cán bộ))
        O3((Thêm cán bộ))
        O4((Cập nhật cán bộ))
        O5((Xóa cán bộ))

        O1 ~~~ O2
        O2 ~~~ O3
        O3 ~~~ O4
        O4 ~~~ O5
    end

    A --- O1
    A --- O2
    A --- O3
    A --- O4
    A --- O5

    M --- O1
    M --- O2

    O --- O1
    O --- O2
```

## web4 - Use case phân rã nhóm lịch công tác
```mermaid
flowchart LR
    A[Admin]
    M[Manager]
    O[Officer]

    subgraph W[Quản lý lịch công tác]
        direction LR
        W1((Xem lịch công tác))
        W2((Tạo lịch công tác))
        W3((Cập nhật lịch công tác))
        W4((Xóa lịch công tác))
        W5((Gửi thông báo mục tiêu))

        W1 ~~~ W2
        W2 ~~~ W3
        W3 ~~~ W4
        W4 ~~~ W5
    end

    A --- W1
    A --- W2
    A --- W3
    A --- W4

    M --- W1
    M --- W2
    M --- W3
    M --- W4

    O --- W1

    W2 -. include .-> W5
    W3 -. include .-> W5
```

## web5 - Use case phân rã nhóm lịch trực ban
```mermaid
flowchart LR
    A[Admin]
    M[Manager]
    O[Officer]

    subgraph D[Quản lý lịch trực ban]
        direction LR
        D1((Xem lịch trực ban))
        D2((Tạo lịch trực ban))
        D3((Cập nhật lịch trực ban))
        D4((Xóa lịch trực ban))
        D5((Gửi thông báo mục tiêu))

        D1 ~~~ D2
        D2 ~~~ D3
        D3 ~~~ D4
        D4 ~~~ D5
    end

    A --- D1
    A --- D2
    A --- D3
    A --- D4

    M --- D1
    M --- D2
    M --- D3
    M --- D4

    O --- D1

    D2 -. include .-> D5
    D3 -. include .-> D5
```

## web6 - Use case phân rã nhóm Lịch của tôi
```mermaid
flowchart LR
    A[Admin]
    M[Manager]
    O[Officer]

    subgraph MY[Lịch của tôi]
        direction LR
        M1((Xem lịch của tôi))
        M2((Đối chiếu theo người dùng hiện tại))
        M3((Lọc theo tháng))
        M4((Lọc theo loại lịch))
        M5((Lọc theo trạng thái))

        M1 ~~~ M2
        M2 ~~~ M3
        M3 ~~~ M4
        M4 ~~~ M5
    end

    A --- M1
    M --- M1
    O --- M1

    M1 -. include .-> M2
    M1 -. extend .-> M3
    M1 -. extend .-> M4
    M1 -. extend .-> M5
```

## web7 - Use case phân rã nhóm ý kiến trực ban
```mermaid
flowchart LR
    O[Officer]
    A[Admin]
    M[Manager]

    subgraph OP[Ý kiến trực ban]
        direction LR
        P1((Gửi ý kiến))
        P2((Xem danh sách ý kiến))
        P3((Duyệt ý kiến))
        P4((Từ chối ý kiến))
        P5((Xóa ý kiến))
        P6((Thông báo kết quả xử lý))

        P1 ~~~ P2
        P2 ~~~ P3
        P3 ~~~ P4
        P4 ~~~ P5
        P5 ~~~ P6
    end

    O --- P1
    O --- P2

    A --- P2
    A --- P3
    A --- P4
    A --- P5

    M --- P2
    M --- P3
    M --- P4

    P1 -. include .-> P6
    P3 -. include .-> P6
    P4 -. include .-> P6
```

## web8 - Use case phân rã nhóm thông báo và xuất dữ liệu
```mermaid
flowchart LR
    A[Admin]
    M[Manager]
    O[Officer]

    subgraph NX[Thông báo và xuất dữ liệu]
        direction LR
        N1((Xem thông báo))
        N2((Đánh dấu đã đọc))
        N3((Đánh dấu tất cả đã đọc))
        E1((Xem trước dữ liệu xuất))
        E2((Tải file xuất))
        E3((Xem lịch sử xuất))

        N1 ~~~ N2
        N2 ~~~ N3
        N3 ~~~ E1
        E1 ~~~ E2
        E2 ~~~ E3
    end

    A --- N1
    A --- N2
    A --- N3
    A --- E1
    A --- E2
    A --- E3

    M --- N1
    M --- N2
    M --- N3
    M --- E1
    M --- E2
    M --- E3

    O --- N1
    O --- N2
    O --- N3
    O --- E1
    O --- E2
    O --- E3
```

## web9 - Activity quy trình đăng nhập (trải ngang)
```mermaid
flowchart LR
    S((Bắt đầu)) --> A[Nhập tên đăng nhập và mật khẩu]
    A --> B[Gửi yêu cầu đăng nhập]
    B --> C{Hợp lệ?}
    C -- Không --> D[Thông báo lỗi đăng nhập]
    D --> E((Kết thúc))
    C -- Có --> F[Tạo JWT và trả hồ sơ người dùng]
    F --> G[Lưu token phiên]
    G --> H[Điều hướng vào Dashboard]
    H --> E
```

## web10 - Activity quy trình quản lý cán bộ (trải ngang)
```mermaid
flowchart LR
    S((Bắt đầu)) --> A[Tìm kiếm cán bộ]
    A --> B{Chọn thao tác}
    B -- Xem --> C[Xem thông tin cán bộ]
    C --> D[Cập nhật thông tin]
    D --> Z((Kết thúc))

    B -- Thêm mới --> E[Nhập thông tin cán bộ mới]
    E --> F[Lưu cán bộ]
    F --> Z

    B -- Xóa --> G[Chọn cán bộ cần xóa]
    G --> H[Xác nhận xóa]
    H --> I[Thực hiện xóa]
    I --> Z
```

## web11 - Activity quy trình lịch công tác (trải ngang)
```mermaid
flowchart LR
    S((Bắt đầu)) --> A[Mở module lịch công tác]
    A --> B{Chọn thao tác}

    B -- Xem --> C[Lọc theo tuần/ngày/loại]
    C --> D[Hiển thị danh sách]
    D --> Z((Kết thúc))

    B -- Tạo/Cập nhật --> E[Nhập thông tin lịch]
    E --> F{Dữ liệu hợp lệ?}
    F -- Không --> G[Thông báo lỗi dữ liệu]
    G --> E
    F -- Có --> H[Lưu vào cơ sở dữ liệu]
    H --> I[Tạo thông báo mục tiêu]
    I --> Z

    B -- Xóa --> J[Chọn lịch cần xóa]
    J --> K[Xác nhận xóa]
    K --> L[Xóa bản ghi]
    L --> Z
```

## web12 - Activity quy trình ý kiến trực ban (trải ngang)
```mermaid
flowchart LR
    S((Bắt đầu)) --> A[Officer nhập nội dung ý kiến]
    A --> B[Gửi ý kiến]
    B --> C{Nội dung hợp lệ?}
    C -- Không --> D[Thông báo nhập lại]
    D --> A
    C -- Có --> E[Lưu ý kiến trạng thái chờ duyệt]
    E --> F[Thông báo cho Admin/Manager]
    F --> G[Admin/Manager mở danh sách ý kiến]
    G --> H{Chọn xử lý}
    H -- Duyệt --> I[Cập nhật Approved + phản hồi]
    H -- Từ chối --> J[Cập nhật Rejected + phản hồi]
    I --> K[Gửi thông báo kết quả cho Officer]
    J --> K
    K --> Z((Kết thúc))
```

## web13 - Activity quy trình xuất dữ liệu (trải ngang)
```mermaid
flowchart LR
    S((Bắt đầu)) --> A[Chọn điều kiện xuất]
    A --> B[Xem trước dữ liệu]
    B --> C{Có dữ liệu?}
    C -- Không --> D[Thông báo không có dữ liệu]
    D --> Z((Kết thúc))
    C -- Có --> E{Xác nhận tải file?}
    E -- Không --> A
    E -- Có --> F[Tạo file CSV/JSON]
    F --> G[Ghi lịch sử xuất]
    G --> H[Trả file về frontend]
    H --> Z
```

## web14 - Biểu đồ kiến trúc tổng thể
```mermaid
flowchart LR
    U[Người dùng] --> FE[Frontend React + Vite]
    FE --> API[Backend API Node.js + Express]
    API --> DB[(MySQL/MariaDB)]

    FE --> LS[(LocalStorage Token)]
    API --> NTF[Notification Targeting\n(targetUserId / targetRole)]
    API --> LOG[(activity_logs / export_logs)]
```

## web15 - Biểu đồ thành phần frontend
```mermaid
flowchart LR
    subgraph F[Frontend]
        APP[App.jsx\nRole Routing]
        LAYOUT[Layout\nSidebar + Topbar]
        DASH[Dashboard]
        CB[Quản lý cán bộ]
        LCT[Lịch công tác]
        LTB[Lịch trực ban]
        LCTOI[Lịch của tôi]
        YK[Ý kiến trực ban]
        XL[Xuất/In lịch]
        TC[Tra cứu]
        API[services/api.js]
    end

    APP --> LAYOUT
    APP --> DASH
    APP --> CB
    APP --> LCT
    APP --> LTB
    APP --> LCTOI
    APP --> YK
    APP --> XL
    APP --> TC

    DASH --> API
    CB --> API
    LCT --> API
    LTB --> API
    LCTOI --> API
    YK --> API
    XL --> API
    TC --> API
```

## web16 - Biểu đồ thành phần backend
```mermaid
flowchart LR
    subgraph B[Backend Express]
        APP[app.js]
        MW1[verifyToken]
        MW2[requireRole]
        R1[routes/auth]
        R2[routes/officers]
        R3[routes/work-schedules]
        R4[routes/duty-schedules]
        R5[routes/opinions]
        R6[routes/notifications]
        R7[routes/dashboard]
        R8[routes/exports]
        C[Controllers]
        U[utils/notificationTargeting.js]
    end

    APP --> MW1
    APP --> MW2
    APP --> R1
    APP --> R2
    APP --> R3
    APP --> R4
    APP --> R5
    APP --> R6
    APP --> R7
    APP --> R8

    R1 --> C
    R2 --> C
    R3 --> C
    R4 --> C
    R5 --> C
    R6 --> C
    R7 --> C
    R8 --> C

    C --> U
    C --> DB[(MySQL)]
```

## web17 - Sequence use case đăng nhập
```mermaid
sequenceDiagram
    actor User as Người dùng
    participant FE as Frontend
    participant BE as Backend
    participant DB as MySQL

    User->>FE: Nhập username/password
    FE->>BE: POST /api/auth/login
    BE->>DB: SELECT user by username
    DB-->>BE: user + password hash
    BE->>BE: bcrypt.compare + sign JWT
    BE-->>FE: 200 token + profile
    FE->>FE: Lưu localStorage(hvktcnan_token)
    FE-->>User: Điều hướng dashboard
```

## web18 - Sequence use case tạo lịch công tác
```mermaid
sequenceDiagram
    actor Manager as Admin/Manager
    participant FE as Frontend
    participant BE as Backend
    participant DB as MySQL

    Manager->>FE: Nhập thông tin lịch công tác
    FE->>BE: POST /api/work-schedules
    BE->>BE: verifyToken + requireRole
    BE->>DB: INSERT work_schedules
    DB-->>BE: id lịch mới
    BE->>DB: INSERT notifications(targetUserId/targetRole)
    DB-->>BE: OK
    BE-->>FE: 201 Created
    FE-->>Manager: Cập nhật danh sách lịch
```

## web19 - Sequence use case ý kiến trực ban
```mermaid
sequenceDiagram
    actor Officer
    actor Admin as Admin/Manager
    participant FE as Frontend
    participant BE as Backend
    participant DB as MySQL

    Officer->>FE: Gửi ý kiến trực ban
    FE->>BE: POST /api/opinions
    BE->>DB: INSERT opinions(status=pending)
    BE->>DB: INSERT notifications cho quản lý
    BE-->>FE: 201 Created

    Admin->>FE: Duyệt/Từ chối ý kiến
    FE->>BE: PUT /api/opinions/:id
    BE->>BE: requireRole(admin,manager)
    BE->>DB: UPDATE opinions(status,adminFeedback)
    BE->>DB: INSERT notifications cho officer
    BE-->>FE: 200 Updated
```

## web20 - Sequence use case xuất dữ liệu
```mermaid
sequenceDiagram
    actor User as Người dùng
    participant FE as Frontend
    participant BE as Backend
    participant DB as MySQL

    User->>FE: Chọn bộ lọc xuất dữ liệu
    FE->>BE: GET /api/exports/preview
    BE->>DB: Query dữ liệu theo điều kiện
    DB-->>BE: Dataset preview
    BE-->>FE: 200 preview

    User->>FE: Xác nhận tải file
    FE->>BE: GET /api/exports/download
    BE->>DB: Query dataset xuất
    BE->>BE: Tạo file CSV/JSON
    BE->>DB: INSERT export_logs
    BE-->>FE: File blob + filename
    FE-->>User: Tải file hoàn tất
```

## web21 - ERD hệ thống
```mermaid
erDiagram
    USERS ||--o{ OFFICERS : has_profile
    USERS ||--o{ WORK_SCHEDULES : creates
    USERS ||--o{ DUTY_SCHEDULES : creates
    USERS ||--o{ OPINIONS : reviews
    USERS ||--o{ NOTIFICATIONS : creates
    USERS ||--o{ NOTIFICATION_READS : reads
    USERS ||--o{ ACTIVITY_LOGS : writes
    USERS ||--o{ EXPORT_LOGS : exports

    OFFICERS ||--o{ DUTY_SCHEDULES : assigned_to
    OFFICERS ||--o{ OPINIONS : submits
    OFFICERS ||--o{ WORK_SCHEDULES : responsible_for

    DUTY_SCHEDULES ||--o{ OPINIONS : receives
    NOTIFICATIONS ||--o{ NOTIFICATION_READS : tracked_by

    USERS {
      int id PK
      string username
      string password
      string full_name
      string email
      string role
      string status
    }

    OFFICERS {
      int id PK
      string officer_code
      string full_name
      string department
      int user_id FK
    }

    WORK_SCHEDULES {
      int id PK
      string title
      date work_date
      int week_no
      int responsible_officer_id FK
      int created_by FK
      string status
    }

    DUTY_SCHEDULES {
      int id PK
      int officer_id FK
      datetime start_time
      datetime end_time
      int week_no
      int created_by FK
      string status
    }

    OPINIONS {
      int id PK
      int duty_schedule_id FK
      int officer_id FK
      string status
      text content
      int reviewed_by FK
    }

    NOTIFICATIONS {
      int id PK
      string title
      text message
      int target_user_id FK
      string target_role
      int created_by FK
    }

    NOTIFICATION_READS {
      int id PK
      int notification_id FK
      int user_id FK
      datetime read_at
    }

    ACTIVITY_LOGS {
      int id PK
      int user_id FK
      string action
      string module
      datetime created_at
    }

    EXPORT_LOGS {
      int id PK
      int user_id FK
      string export_type
      string format
      datetime created_at
    }
```
