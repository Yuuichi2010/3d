# Hướng dẫn chạy Project

Để chạy project này, bạn cần thực hiện các bước sau:

## 1. Cài đặt Dependencies

Mở terminal trong thư mục gốc của project và chạy lệnh sau để cài đặt tất cả các dependencies cần thiết:

```bash
npm install
```

## 2. Tải và sử dụng tài nguyên (Assets)

Project này sử dụng một số tài nguyên (như fonts, textures, và các file SVG) được lưu trữ trên Google Drive. Bạn cần tải chúng về và đặt vào thư mục `public` trong project của mình.

1.  **Truy cập đường dẫn Google Drive**: Mở trình duyệt và truy cập đường dẫn sau:
    `https://drive.google.com/drive/folders/16h-moMhggHPGcqOPRk4wf-Jsh2YUFl2A?usp=drive_link`

2.  **Tải xuống các file**: Tải xuống toàn bộ nội dung trong thư mục này (bao gồm `fonts`, `textures`, và các file `.svg`).

3.  **Đặt vào thư mục `public`**: Sau khi tải về, giải nén (nếu cần) và sao chép tất cả các thư mục và file đã tải xuống vào thư mục `public` trong thư mục gốc của project của bạn (ví dụ: `d:\source\public`).

    Đảm bảo cấu trúc thư mục của bạn trông giống như sau:
    ```
    source/
    │   ├── .next/
    │   ├── node_modules/
    │   ├── app/
    │   ├── public/
    │   │   ├── fonts/
    │   │   ├── textures/
    │   │   ├── file.svg
    │   │   ├── globe.svg
    │   │   ├── next.svg
    │   │   ├── vercel.svg
    │   │   └── window.svg
    │   ├── ... (các file và thư mục khác của project)
    │   └── README.md
    └── ...
    ```

Sau khi hoàn thành các bước trên, project của bạn sẽ có đầy đủ tài nguyên cần thiết để chạy đúng cách.

## 3. Khởi động ứng dụng

Sau khi cài đặt xong các dependencies, bạn có thể khởi động ứng dụng bằng lệnh:

```bash
npm run dev
```

Thao tác này sẽ khởi động máy chủ phát triển và mở ứng dụng trong trình duyệt mặc định của bạn. Nếu không tự động mở, bạn có thể truy cập ứng dụng tại `http://localhost:3000` (hoặc cổng khác nếu được cấu hình).
