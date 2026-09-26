/**
 * Danh mục nhà cung cấp API ngân hàng — nguồn duy nhất cho cả service lẫn giao diện.
 *
 * Tách ra file riêng để `billingService` (cấu hình) và `bankApiService` (gọi API)
 * dùng chung mà không import vòng lẫn nhau.
 *
 *  - SEPAY: API Giao dịch của SePay. Dùng được ngay; SePay là đối tác chính thức
 *    của ACB nên đọc được đúng tài khoản ACB của bạn.
 *  - ACB: Open API của ngân hàng (ACB ONE CONNECT, developer.acb.com.vn). Môi
 *    trường production cần hợp đồng đã ký với ACB, ACB sẽ cấp Token URL, Client
 *    ID/Secret và đường dẫn lịch sử giao dịch + đường dẫn tạo QR động.
 */
export const API_PROVIDERS = [
  {
    id: 'SEPAY',
    name: 'SePay API Giao dịch',
    defaultBaseUrl: 'https://my.sepay.vn/userapi',
    fields: ['token'],
    hint:
      'my.sepay.vn → Cấu hình Công ty → API Access → thêm API → copy API Token. Liên kết tài khoản ACB ở mục Tài khoản ngân hàng.',
    docs: 'https://developer.sepay.vn/vi/sepay-api/v1/api-giao-dich',
  },
  {
    id: 'ACB',
    name: 'ACB ONE CONNECT (Open API của ACB)',
    defaultBaseUrl: '',
    fields: ['tokenUrl', 'clientId', 'clientSecret', 'historyPath'],
    hint:
      'developer.acb.com.vn → đăng ký ứng dụng để nhận Client ID/Secret ID → đăng ký sản phẩm “Thông tin tài khoản / lịch sử giao dịch” → sau khi ký hợp đồng, ACB gửi thông số kỹ thuật (token URL, đường dẫn lịch sử giao dịch, đường dẫn tạo QR động) để dán vào đây.',
    docs: 'https://developer.acb.com.vn/acb/open/vi/getting-started',
  },
]

export function apiProviderInfo(id) {
  return API_PROVIDERS.find((p) => p.id === String(id || '').toUpperCase()) || null
}

/** Base URL mặc định khi đổi nhà cung cấp mà không nhập gì. */
export function defaultBaseUrlOf(provider) {
  return apiProviderInfo(provider)?.defaultBaseUrl || ''
}

export default { API_PROVIDERS, apiProviderInfo, defaultBaseUrlOf }
