# ⛰️ Sơn Tinh – Thủy Tinh — Đại Chiến Núi và Nước (3D)

Game lớp học tương tác 3D dựa trên truyền thuyết Việt Nam **Sơn Tinh – Thủy Tinh**: một phe điều khiển sức mạnh **Núi Rừng** (nâng núi, dựng đê, trồng rừng bảo vệ 5 bản làng cổ), phe còn lại điều khiển sức mạnh **Sông Nước** (dâng nước, tạo xoáy xuyên đê, gọi Đại Hồng Thủy vượt tuyến phòng thủ).

Chạy hoàn toàn trên trình duyệt — không cần máy chủ, không cần Internet, tích hợp đẩy đề Word (`.docx`) & hiển thị công thức KaTeX offline.

## Điểm nổi bật & Cách chơi

- **Chiến trường địa hình 3D sống động biến đổi sau từng lượt** (mặc định **3D Three.js**, hỗ trợ chuyển nóng **3D ↔ 2D** bằng phím `T` & **3 góc nhìn camera** bằng phím `V`, kéo chuột xoay 360° & cuộn zoom tự do):
  - **Nâng núi (`⛰️`):** cột địa hình 3D nhô cao từng tầng, chuyển từ đồng bằng sang đỉnh núi Tản Viên và đẩy lùi nước ngập.
  - **Dựng đê (`🧱`):** tường đê đá – cọc gỗ – chòi canh 3D dựng lên chặn dòng nước.
  - **Trồng rừng (`🌲`/`🌳`):** cụm cây xanh 3D đung đưa theo gió, tăng sức phòng thủ & chống ngập.
  - **Dâng nước & Sóng thần (`🌊`/`⚡`/`🌀`):** mực nước 3D xanh lam gợn sóng dâng cao, phá đê và tràn sâu về phía 5 bản làng cổ (*Phong Châu, Bạch Hạc, Cổ Loa, Tản Viên, Lạc Việt*).
- **Chọn hành động theo độ khó câu hỏi:**
  - **⭐ Cơ bản (+100đ):** Trồng rừng / Đắp đê nhỏ / Dâng nước lấn đất.
  - **⭐⭐ Trung bình (+150đ):** Nâng núi cao / Đại ngàn 2 ô / Xoáy nước xuyên đê.
  - **⭐⭐⭐ Nâng cao (+220đ — Tuyệt chiêu):** Dãy Trường Sơn Hộ Đê 3 ô dọc / Thần Rừng dựng Khiên cứu làng / Đại Hồng Thủy quét 3 ô!
  - Hệ thống tự nhận diện thẻ `[Cơ bản]`, `[Trung bình]`, `[Nâng cao]` (hoặc `[NB]`, `[TH]`, `[VD]`) trong đề Word, hoặc tự chia đều 3 bậc độ khó nếu file Word không gắn thẻ.
- **2 chế độ chơi linh hoạt (5 / 6 / 7 vòng):**
  - **2 đội (1 vs 1):** Phe Sơn Tinh đấu trực tiếp Phe Thủy Tinh.
  - **4 đội (2 vs 2 chuyên biệt):**
    - *Sơn Tinh 1* (**🧱 Xây Đê & Nâng Núi**) + *Sơn Tinh 2* (**🌲 Trồng Rừng & Hộ Làng**).
    - *Thủy Tinh 1* (**🌊 Dòng Nước Bắc — Hàng 1–3**) + *Thủy Tinh 2* (**🌊 Dòng Nước Nam — Hàng 4–6**).
  - Cuối trận công bố **cả kết quả chung 2 phe** (số khu dân cư bảo vệ được, độ tiến sâu & số ô nước nhấn chìm) lẫn **bảng xếp hạng điểm cá nhân từng đội + MVP**!
- **Hỗ trợ nhập đề Word (`.docx`) & KaTeX offline:** Đủ 3 dạng đề 2025 (Trắc nghiệm, Đúng/Sai, Trả lời ngắn), nhận diện MathType / Equation 3.0 / OMML, hình ảnh minh họa, đáp án gạch chân & tô đỏ.

## Phím tắt giáo viên

- Chọn hành động: `1` (⭐ Cơ bản) · `2` (⭐⭐ Trung bình) · `3` (⭐⭐⭐ Nâng cao)
- Chọn ô mục tiêu: `← ↑ → ↓` di chuyển · `Enter` / `Space` mở câu hỏi
- Trả lời: `A`–`D` / `1`–`4` · Đúng/Sai: `1`/`2` · Trả lời ngắn: `Enter` xem đáp án, `1` đúng, `2` sai
- Phản công (cướp lượt): `1`–`2` chọn đội · `0` bỏ qua
- 3D & Trình chiếu: `T` đổi **3D ↔ 2D** · `V` đổi góc nhìn camera 3D · `E` mở khung soạn/nhập `.docx` · `F` toàn màn hình · `M` tắt tiếng

> Dữ liệu câu hỏi, ảnh và cài đặt được lưu riêng trong trình duyệt (`localStorage` key `son-tinh-thuy-tinh.v1` + `IndexedDB` `son-tinh-thuy-tinh`).

## Cấu trúc thư mục

```text
son-tinh-thuy-tinh/
├── index.html              # giao diện + luật chơi Sơn Tinh – Thủy Tinh (3D & 2D)
├── favicon.svg
├── assets/
│   ├── gioi-thieu.jpg      # ảnh bìa sử thi Sơn Tinh – Thủy Tinh
│   └── logo-giaovienai.png # logo GIAOVIENAI
├── lib/three.min.js        # Three.js r147 (chạy 3D offline)
├── lib/world3d.js          # engine địa hình 3D biến đổi theo từng lượt
├── lib/qbank.js            # ngân hàng câu hỏi, khung soạn đề, âm thanh, FX
├── lib/mtef2tex.js         # đọc công thức MathType / Equation 3.0 -> LaTeX
├── lib/docx-import.js      # đọc đề Word (.docx)
├── lib/jszip.min.js        # giải nén .docx
├── lib/cfb.min.js          # đọc đối tượng OLE (MathType)
├── katex/                  # KaTeX + phông chữ (offline)
├── licenses/               # giấy phép thư viện bên thứ ba
├── THIRD_PARTY_NOTICES.md
├── vercel.json
└── .gitignore
```
