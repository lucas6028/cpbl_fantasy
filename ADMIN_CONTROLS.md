# Admin Controls Quick Reference

## 🛠️ Admin Control Panel Access Points

### 首頁導航
進入 `/admin` 查看所有管理選項

### 快速訪問菜單
- **維護模式管理** - `/admin/maintenance`
- **公告管理** - `/admin/announcements`

---

## 🔧 Maintenance Mode (維護模式)

### 啟用維護模式
```
1. 進入 /admin/maintenance
2. 點擊「Enable Maintenance Mode」
3. 所有非 Admin 用戶立即被重定向到 /maintenance
4. Draft 頁面的所有 polling 立即停止
```

### 禁用維護模式
```
1. 進入 /admin/maintenance
2. 點擊「Disable Maintenance Mode」  
3. 非 Admin 用戶在 30 秒內自動返回之前的頁面
```

### 特點
- ✅ **立即生效** - 無需刷新，立即停止所有數據抓取
- ✅ **自動恢復** - 用戶無需手動返回
- ✅ **零服務器負擔** - 維護時沒有無謂的 API 調用
- ✅ **Admin 無影響** - Admin 用戶可以正常工作

---

## 📢 Announcements (公告系統)

### 創建公告
```
1. 進入 /admin/announcements
2. 點擊「New Announcement」
3. 輸入標題和內容
4. 勾選「Publish now」立即發布（或保存為草稿）
5. 點擊「Create Announcement」
```

### 編輯/刪除公告
```
1. 進入 /admin/announcements  
2. 找到要編輯的公告
3. 點擊「Edit」修改或「Delete」刪除
```

### 公告在系統中的顯示位置
- **首頁** - 最新公告顯示為橫幅提示
- **/announcements** - 所有活躍公告列表
- **維護中** - `/maintenance` 頁面

### 特點
- ✅ **草稿支持** - 先寫後發布
- ✅ **自動排序** - 最新的顯示在前
- ✅ **實時生效** - 發布後立即所有用戶可見
- ✅ **權限保護** - 只有 Admin 可以管理

---

## 📊 Admin 豁免權限

**Admin 用戶永遠不會被以下限制阻擋：**
1. ✅ 維護模式 - Admin 在維護期間可正常訪問所有頁面
2. ✅ 公告發布 - 即使系統維護，也可以創建和更新公告
3. ✅ 管理功能 - 所有 Admin 頁面始終可用

---

## 🔐 API 端點總覽

### 維護模式 APIs
```
GET  /api/system-settings/maintenance
POST /api/system-settings/maintenance?userId={id}
```

### 公告 APIs  
```
GET  /api/announcements                          # 公開 (所有用戶)
GET  /api/admin/announcements?userId={id}       # Admin 查看
POST /api/admin/announcements?userId={id}       # Admin 創建
PUT  /api/admin/announcements?userId={id}&id={announcementId}
DELETE /api/admin/announcements?userId={id}&id={announcementId}
```

---

## 📝 常見操作流程

### 場景 1：系統維護前準備
```
1. 創建維護公告
   - /admin/announcements
   - 輸入維護信息
   - 發布

2. 啟用維護模式
   - /admin/maintenance
   - 點擊「Enable Maintenance Mode」
   
3. Draft 自動停止所有 polling ✓
```

### 場景 2：維護完成恢復
```
1. 禁用維護模式
   - /admin/maintenance
   - 點擊「Disable Maintenance Mode」
   
2. 所有數據恢復正常 ✓
   - 用戶 30 秒內自動返回
   - API polling 恢復
   
3. 發布恢復公告（可選）
   - /admin/announcements
   - 創建「系統恢復」公告
```

### 場景 3：緊急通知
```
1. /admin/announcements
2. 點擊「New Announcement」
3. 輸入緊急通知信息
4. 勾選「Publish now」
5. 用戶在首頁立即看到提醒 ✓
```

---

## ⚙️ 配置說明

### 維護檢查間隔
- **Global Check** - 每 30 秒
- **Maintenance Page** - 每 10 秒
  
可在相應代碼中調整

### 公告顯示範圍
- **公開可見** - 只有 `is_active = true` 的公告
- **Admin 可見** - 所有公告（包括草稿）

---

## 📖 詳細文檔

- **維護模式**: [MAINTENANCE_MODE.md](MAINTENANCE_MODE.md)
- **公告系統**: [ANNOUNCEMENTS.md](ANNOUNCEMENTS.md)

---

## 🆘 故障排除

### 維護模式無法啟用
- 檢查用戶是否為 Admin
- 檢查數據庫表 `system_settings` 是否存在

### 公告無法發布
- 檢查 `announcements` 表是否存在
- 確認用戶 Admin 權限

### Admin 被擋掉了
- 檢查 `/api/admin/check` 是否工作正常
- 查看瀏覽器 console 日誌
- 清除 cookies 重新登入

---

## 📞 Support

如有問題，請參考完整文檔或檢查：
1. 數據庫表是否正確創建
2. Admin 用戶權限設置
3. API 路由註冊
4. 瀏覽器控制台錯誤信息
