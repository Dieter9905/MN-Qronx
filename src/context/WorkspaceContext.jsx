import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import {
  listWorkspaces,
  createWorkspace as createWorkspaceApi,
} from '../services/workspaceService'
import { setActiveWorkspaceId } from '../services/apiClient'

// ─── Ngữ cảnh không gian: 3 chế độ sống chung trong 1 tài khoản ────────────
// Cá nhân (PERSONAL) luôn có; Lớp học (STUDENT) và Nhóm (TEAM) do người dùng
// tạo thêm. Chọn chế độ nào thì mọi request mang X-Workspace của không gian
// đó, và nội dung trang được remount để tải lại dữ liệu đúng ngữ cảnh.
const WorkspaceContext = createContext(null)

const STORAGE_KEY = 'mnq:workspaceId'

export function WorkspaceProvider({ children }) {
  const { user } = useAuth()
  const [workspaces, setWorkspaces] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [loading, setLoading] = useState(true)

  const applyActive = useCallback((id, list) => {
    const numeric = Number(id)
    const found = list.find((w) => w.workspace.workspaceId === numeric)
    const chosen = found || list.find((w) => w.workspace.type === 'PERSONAL') || list[0]
    const chosenId = chosen?.workspace?.workspaceId ?? null
    setActiveId(chosenId)
    setActiveWorkspaceId(chosenId)
    if (chosenId) localStorage.setItem(STORAGE_KEY, String(chosenId))
    return chosenId
  }, [])

  const reload = useCallback(async () => {
    if (!user) {
      setWorkspaces([])
      setActiveId(null)
      setActiveWorkspaceId(null)
      setLoading(false)
      return []
    }
    setLoading(true)
    const res = await listWorkspaces()
    const list = res.success ? res.data || [] : []
    setWorkspaces(list)
    // Ưu tiên không gian đã chọn lần trước; nếu đã bị xoá/rời thì về Cá nhân
    applyActive(localStorage.getItem(STORAGE_KEY), list)
    setLoading(false)
    return list
  }, [user, applyActive])

  useEffect(() => {
    reload().catch(() => setLoading(false))
  }, [reload])

  const select = useCallback((workspaceId) => {
    // Không truyền danh sách mới → vẫn kiểm tra sự tồn tại qua state hiện tại
    setActiveId((prev) => {
      const target = Number(workspaceId)
      setActiveWorkspaceId(target)
      localStorage.setItem(STORAGE_KEY, String(target))
      return target === prev ? prev : target
    })
  }, [])

  const createWorkspace = useCallback(
    async (type, name) => {
      const res = await createWorkspaceApi(type, name)
      if (res.success) {
        const list = await reload()
        const created = list.find((w) => w.workspace.workspaceId === res.data?.workspace?.workspaceId)
        if (created) select(created.workspace.workspaceId)
      }
      return res
    },
    [reload, select],
  )

  const value = useMemo(() => {
    const personal = workspaces.find((w) => w.workspace.type === 'PERSONAL') || null
    const classes = workspaces.filter((w) => w.workspace.type === 'STUDENT')
    const teams = workspaces.filter((w) => w.workspace.type === 'TEAM')
    const active = workspaces.find((w) => w.workspace.workspaceId === activeId) || personal || null
    return {
      workspaces,
      personal,
      classes,
      teams,
      active,
      activeId,
      loading,
      select,
      createWorkspace,
      reload,
    }
  }, [workspaces, activeId, loading, select, createWorkspace, reload])

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace phải nằm trong WorkspaceProvider')
  return ctx
}
