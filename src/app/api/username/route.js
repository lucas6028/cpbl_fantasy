import { cookies } from 'next/headers'
import supabase from '@/lib/supabaseServer'

async function getUsernamePayload() {
  const cookieStore = await cookies()
  const user_id = cookieStore.get('user_id')?.value

  if (!user_id) {
    return Response.json({ error: '未登入' }, { status: 401 })
  }

  const [managerRes, adminRes] = await Promise.all([
    supabase
      .from('managers')
      .select('name, email_verified')
      .eq('manager_id', user_id)
      .single(),
    supabase
      .from('admin')
      .select('manager_id')
      .eq('manager_id', user_id)
      .maybeSingle(),
  ])

  const { data, error } = managerRes

  if (error || !data) {
    return Response.json({ error: '找不到帳號' }, { status: 404 })
  }

  const { data: adminData, error: adminError } = adminRes
  if (adminError) {
    return Response.json({ error: '權限檢查失敗' }, { status: 500 })
  }

  const is_admin = !!adminData

  return Response.json({
    name: data.name,
    email_verified: data.email_verified,
    is_admin,
    isAdmin: is_admin,
  })
}

export async function GET() {
  return getUsernamePayload()
}

export async function POST() {
  return getUsernamePayload()
}
