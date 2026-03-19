# Announcements System Documentation

## Overview
公告系統讓 Admin 可以快速發佈系統公告給所有用戶。公告會顯示在公開頁面，並且活躍公告會在首頁以橫幅形式提示用戶。

## Features

✅ **Admin 管理页面** - 创建、编辑、删除和发布公告
✅ **公告展示页面** - 所有用户可以查看所有活跃公告
✅ **草稿支持** - 公告可以先保存为草稿，后续发布
✅ **自动排序** - 按创建时间倒序显示最新公告
✅ **橫幅提示** - 首頁顯示最新公告橫幅
✅ **权限保护** - 非 Admin 用户无法管理公告

## How to Use

### 1. Access Admin Announcements Panel
作為 Admin 用戶，進入以下頁面：
```
/admin/announcements
```

### 2. Create New Announcement
- 點擊「New Announcement」按鈕
- 輸入標題和內容
- 勾選「Publish now」以立即發布，或留空保存為草稿
- 點擊「Create Announcement」

### 3. Edit or Delete
- 在公告列表中找到要編輯的公告
- 點擊「Edit」進行修改
- 點擊「Delete」刪除公告

### 4. View All Announcements
用户可以訪問：
```
/announcements
```
查看所有活躍公告

## API Endpoints

### Public Endpoints

#### GET /api/announcements
獲取所有活躍公告

**Response:**
```json
{
  "success": true,
  "announcements": [
    {
      "id": "uuid",
      "title": "Announcement Title",
      "content": "Announcement content...",
      "created_at": "2024-03-20T10:30:00Z",
      "updated_at": "2024-03-20T10:30:00Z"
    }
  ]
}
```

### Admin Endpoints

#### GET /api/admin/announcements?userId={userId}
獲取所有公告（包括草稿）

**Headers:**
```
userId: {userId}
```

**Response:**
```json
{
  "success": true,
  "announcements": [
    {
      "id": "uuid",
      "title": "Announcement Title",
      "content": "Announcement content...",
      "is_active": true,
      "created_at": "2024-03-20T10:30:00Z",
      "updated_at": "2024-03-20T10:30:00Z",
      "created_by": "admin_user_id"
    }
  ]
}
```

#### POST /api/admin/announcements?userId={userId}
創建新公告

**Body:**
```json
{
  "title": "New Announcement",
  "content": "Announcement content...",
  "is_active": true
}
```

#### PUT /api/admin/announcements?userId={userId}&id={announcementId}
更新公告

**Body:**
```json
{
  "title": "Updated Title",
  "content": "Updated content...",
  "is_active": true
}
```

#### DELETE /api/admin/announcements?userId={userId}&id={announcementId}
刪除公告

## Database Setup

### 1. Create Table
執行以下 SQL 語句：
```sql
-- Create announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  CONSTRAINT announcements_pkey PRIMARY KEY (id),
  CONSTRAINT announcements_title_check CHECK ((char_length(title) > 0)),
  CONSTRAINT announcements_content_check CHECK ((char_length(content) > 0))
) TABLESPACE pg_default;

-- Create trigger function to update updated_at timestamp
DROP TRIGGER IF EXISTS trg_announcements_updated_at ON announcements;
CREATE TRIGGER trg_announcements_updated_at
BEFORE UPDATE ON announcements
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
```

### 2. Run Migration
```bash
# SQL 文件位置：
# database/migrations/create_announcements.sql
```

## File Structure

```
src/
├── app/
│   ├── announcements/
│   │   └── page.js                 # 公告展示頁面
│   ├── admin/
│   │   └── announcements/
│   │       └── page.js             # Admin 管理公告頁面
│   └── api/
│       ├── announcements/
│       │   └── route.js            # 公開公告 API
│       └── admin/
│           └── announcements/
│               └── route.js        # Admin 公告管理 API
└── components/
    └── AnnouncementBanner.js       # 首頁公告橫幅 Hook
database/
└── migrations/
    └── create_announcements.sql    # 數據庫遷移
```

## How to Display Announcement Banner on Home Page

### 1. Import the Hook/Component
在主頁 (home/page.js) 中：

```javascript
import { AnnouncementBanner } from '@/components/AnnouncementBanner';

export default function HomePage() {
  return (
    <div>
      <AnnouncementBanner />
      {/* Your page content */}
    </div>
  );
}
```

### 2. Or Use the Hook Directly
```javascript
'use client';

import { useAnnouncementBanner } from '@/components/AnnouncementBanner';

export default function HomePage() {
  const announcementBanner = useAnnouncementBanner();

  return (
    <div>
      {announcementBanner}
      {/* Your page content */}
    </div>
  );
}
```

## Features Explained

### Draft Mode
- 創建公告時，可以先不發布（不勾選「Publish now」）
- 公告將保存為草稿，不會在 /announcements 頁面顯示
- 只有 Admin 可以在管理頁面看到草稿公告

### Auto-sorted
- 公告按創建時間倒序排列
- 最新的公告顯示在最前

### Timestamp Tracking
- `created_at` - 公告創建時間
- `updated_at` - 公告最後更新時間（自動更新）

## Testing

### 1. Create an Announcement
```bash
# As admin user with userId
curl -X POST 'http://localhost:3000/api/admin/announcements?userId=YOUR_USER_ID' \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Test Announcement",
    "content": "This is a test announcement",
    "is_active": true
  }'
```

### 2. View Public Announcements
```bash
curl http://localhost:3000/api/announcements
```

### 3. Access Pages
- Admin Page: `http://localhost:3000/admin/announcements`
- Public Page: `http://localhost:3000/announcements`

## Security

- 🔒 Admin 檢查在所有 Admin 端點上進行
- 🔒 非 Admin 用戶只能獲取活躍公告
- 🔒 只有公開的公告信息可以被非 Admin 用戶訪問

## Performance

- **索引** - 使用 `is_active` 和 `created_at` 索引加快查詢
- **緩存** - 可以在客戶端實現 ISR (Incremental Static Regeneration)
- **查詢優化** - 公開 API 只返回必要字段

## Admin Can Access Everything

Admin 用戶不會被維護模式擋掉，可以：
✅ 訪問 `/admin/announcements` 創建/編輯/刪除公告
✅ 訪問 `/admin/maintenance` 管理維護模式  
✅ 訪問所有其他 Admin 頁面
✅ 在系統維護時繼續進行管理任務

## Future Enhancements

- [ ] 公告排序（置頂功能）
- [ ] 公告分類（系統、維護、活動等）
- [ ] 定時發布（自動在指定時間發布）
- [ ] 過期公告自動隱藏
- [ ] 公告圖片/富文本支持
- [ ] 用戶已讀機制
- [ ] 公告搜索功能
