const DEFAULT_PAGE_SIZE = 20
// 200 để khớp với nhu cầu thật của app: lịch tháng, lệnh trong chat AI và
// thống kê thông báo của admin đều xin một cửa sổ lớn trong 1 request. Trước đây
// trần là 100 nên các chỗ đó bị cắt âm thầm (lịch thiếu việc, admin ra biểu đồ 0).
const MAX_PAGE_SIZE = 200

/**
 * Parse pagination query params and return Prisma-compatible skip/take
 * plus a meta object for the response envelope.
 *
 * @param {object} query  req.query
 * @returns {{ skip: number, take: number, page: number, pageSize: number, meta: object }}
 */
export function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(query.pageSize, 10) || DEFAULT_PAGE_SIZE))
  const skip = (page - 1) * pageSize

  return { skip, take: pageSize, page, pageSize }
}

/**
 * Build pagination meta object to include in response.
 *
 * @param {number} total      Total number of records matching the query
 * @param {number} page       Current page (1-based)
 * @param {number} pageSize   Page size
 * @returns {object}
 */
export function paginationMeta(total, page, pageSize) {
  const totalPages = Math.ceil(total / pageSize)
  return {
    total,
    page,
    pageSize,
    totalPages,
  }
}
