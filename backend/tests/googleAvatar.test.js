import { describe, it, expect } from 'vitest'
import { toGoogleAvatarUrl } from '../src/services/googleAuthService.js'

describe('toGoogleAvatarUrl', () => {
  it('đổi ảnh 96px mặc định của Google sang 256px cho khỏi mờ', () => {
    const input = 'https://lh3.googleusercontent.com/a/ACg8ocL=s96-c'
    expect(toGoogleAvatarUrl(input)).toBe('https://lh3.googleusercontent.com/a/ACg8ocL=s256-c')
  })

  it('đổi được cả hậu tố không có -c', () => {
    expect(toGoogleAvatarUrl('https://lh3.googleusercontent.com/a/ABC=s512')).toBe(
      'https://lh3.googleusercontent.com/a/ABC=s256-c'
    )
  })

  it('giữ nguyên URL Google không có hậu tố kích thước', () => {
    const url = 'https://lh3.googleusercontent.com/a/ABC'
    expect(toGoogleAvatarUrl(url)).toBe(url)
  })

  it('giữ nguyên URL không phải Google (ảnh người dùng tự đặt)', () => {
    const url = 'https://cdn.example.com/avatar.png'
    expect(toGoogleAvatarUrl(url)).toBe(url)
  })

  it('trả null khi không có ảnh', () => {
    expect(toGoogleAvatarUrl(null)).toBeNull()
    expect(toGoogleAvatarUrl('')).toBeNull()
    expect(toGoogleAvatarUrl(undefined)).toBeNull()
  })
})
