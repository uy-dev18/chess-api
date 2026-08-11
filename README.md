# chess-stockfish-api

API Node.js/Express dùng engine Stockfish (WASM) để trả về nước đi tốt nhất từ một thế cờ (FEN).

## Cài đặt & chạy

```bash
npm install
npm start
```

Server mặc định chạy ở `http://localhost:3000` (đổi bằng biến môi trường `PORT`).

## Endpoint

### `GET /api/health`
Kiểm tra server còn sống.

### `POST /api/best-move`

Body (JSON):

| Field       | Kiểu   | Bắt buộc | Mô tả                                                          |
|-------------|--------|----------|------------------------------------------------------------------|
| `fen`       | string | có       | Chuỗi FEN của thế cờ                                             |
| `depth`     | number | không    | Độ sâu tìm kiếm (mặc định 15, tối đa 25). Bỏ qua nếu có `movetimeMs` |
| `movetimeMs`| number | không    | Thời gian nghĩ (ms), 100–15000. Nếu có sẽ dùng thay cho `depth`  |

Ví dụ:

```bash
curl -X POST http://localhost:3000/api/best-move \
  -H "Content-Type: application/json" \
  -d '{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","depth":15}'
```

Response:

```json
{
  "bestMove": "e2e4",
  "ponder": "e7e5",
  "depth": 15,
  "evaluationCp": 37,
  "principalVariation": ["e2e4", "e7e5", "g1f3", "..."]
}
```

- `evaluationCp`: điểm đánh giá theo centipawn (dương = bên đi tốt hơn). Nếu có nước chiếu hết thì trả `mateIn` thay vào đó (số nước đến chiếu hết).
- `bestMove`/`ponder`: nước đi theo định dạng UCI (ví dụ `e2e4`).
- FEN không hợp lệ trả về lỗi `400`.

## Ghi chú kỹ thuật

- Dùng package `stockfish` (bản lite single-threaded, cấu hình qua biến môi trường `STOCKFISH_ENGINE`: `lite-single` | `lite` | `single` | `full` | `asm`).
- Engine được khởi tạo một lần và xử lý tuần tự (hàng đợi) để tránh xung đột giao thức UCI khi có nhiều request đồng thời.
