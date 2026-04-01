import { NextResponse } from 'next/server'
import supabase from '@/lib/supabaseServer'
import bcrypt from 'bcrypt'
import { sendTradeNotificationEmail } from '@/lib/email'

function makeSixDigit() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function POST(request) {
  try {
    const { email } = await request.json()
    console.log('📥 Forgot password request for email:', email)
    
    if (!email) {
      console.log('❌ Missing email')
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    console.log('🔍 Searching by email:', email)
    const { data, error } = await supabase
      .from('managers')
      .select('manager_id,email_address,name')
      .eq('email_address', email)
      .single()
    
    console.log('📊 Query result:', { 
      found: !!data, 
      error: error?.message,
      data: data ? { manager_id: data.manager_id, email: data.email_address, name: data.name } : null 
    })
    
    if (error || !data) {
      console.log('❌ User not found - Error:', error)
      return NextResponse.json({ error: 'Email not found' }, { status: 404 })
    }

    const newPass = makeSixDigit()
    console.log('🔑 Generated new password (6 digits)')
    
    // Hash the new password
    const saltRounds = 10
    const hashedPassword = await bcrypt.hash(newPass, saltRounds)
    console.log('🔒 Password hashed successfully')

    const { error: updErr } = await supabase
      .from('managers')
      .update({ password: hashedPassword, must_change_password: true })
      .eq('manager_id', data.manager_id)

    if (updErr) {
      console.error('❌ Password update error:', updErr)
      return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
    }
    
    console.log('✅ Password updated for manager_id:', data.manager_id)

    // send email if available
    if (data.email_address) {
      console.log('📧 Preparing to send email to:', data.email_address)
      const subject = 'CPBL Fantasy - Password Reset'
      const message = `<p>Your password has been reset to <strong>${newPass}</strong></p><p>Please change your password immediately after logging in.</p>`
      try {
        await sendTradeNotificationEmail(data.email_address, subject, message)
        console.log('✅ Password reset email sent successfully to:', data.email_address)
      } catch (e) {
        // log but don't fail the whole request
        console.error('❌ Email sending failed:', e)
      }
    } else {
      console.log('⚠️ No email address found for user')
    }

    console.log('✅ Forgot password process completed successfully')
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('❌ Forgot password error:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
