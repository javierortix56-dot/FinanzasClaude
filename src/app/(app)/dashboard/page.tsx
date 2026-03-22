'use client'

import { useAuthStore } from '@/store/useAuthStore'

export default function DashboardPage() {
  const { user } = useAuthStore()

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
      <p className="text-gray-500 text-sm mt-1">Bienvenido, {user?.email}</p>
    </div>
  )
}
