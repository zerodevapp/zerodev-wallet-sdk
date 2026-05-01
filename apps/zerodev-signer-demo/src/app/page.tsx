/* eslint-disable @next/next/no-img-element */
'use client'

import {
  OAUTH_PROVIDERS,
  useAuthenticateOAuth,
  useLoginPasskey,
  useRegisterPasskey,
  useSendMagicLink,
  useSendOTP,
  useVerifyOTP,
} from '@zerodev/wallet-react'
import { KeyRound, Loader2, Mail } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { cn } from './lib/utils'

export const dynamic = 'force-dynamic'

type OTPStep = 'send' | 'verify'

export default function LandingPage() {
  return (
    <Suspense>
      <LandingPageInner />
    </Suspense>
  )
}

function LandingPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionExpired = searchParams.get('session_expired') === 'true'
  const [email, setEmail] = useState('')
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [error, setError] = useState('')

  // OTP specific state
  const [otpStep, setOtpStep] = useState<OTPStep>('send')
  const [otpCode, setOtpCode] = useState('')
  const [otpData, setOtpData] = useState<{ otpId: string } | null>(null)

  const registerPasskey = useRegisterPasskey()
  const loginPasskey = useLoginPasskey()
  const authenticateOAuth = useAuthenticateOAuth()
  const sendMagicLink = useSendMagicLink()
  const sendOTP = useSendOTP()
  const verifyOTP = useVerifyOTP()

  const handlePasskeyRegister = async () => {
    setLoadingAction('passkey-register')
    setError('')

    try {
      await registerPasskey.mutateAsync()
      router.push('/dashboard')
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Passkey registration failed',
      )
    } finally {
      setLoadingAction(null)
    }
  }

  const handlePasskeyLogin = async () => {
    setLoadingAction('passkey-login')
    setError('')

    try {
      await loginPasskey.mutateAsync()
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Passkey login failed')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleEmailAuth = async () => {
    if (!email.trim()) return
    setLoadingAction('email')
    setError('')

    try {
      const data = await sendMagicLink.mutateAsync({
        email,
        redirectURL: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/verify`,
        otpCodeCustomization: { length: 6, alphanumeric: false },
      })
      console.log('data', data)
      localStorage.setItem('otpId', data.otpId)
      setError('Magic link sent! Check your email.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send magic link')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleOTPSend = async () => {
    if (!email.trim()) return
    setLoadingAction('otp-send')
    setError('')

    try {
      const data = await sendOTP.mutateAsync({
        email,
        otpCodeCustomization: { length: 6, alphanumeric: false },
      })
      setOtpData(data)
      setOtpStep('verify')
      setError('OTP code sent to your email')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleOTPVerify = async () => {
    if (!otpCode.trim() || !otpData) return
    setLoadingAction('otp-verify')
    setError('')

    try {
      await verifyOTP.mutateAsync({
        code: otpCode,
        otpId: otpData.otpId,
      })
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid OTP code')
    } finally {
      setLoadingAction(null)
    }
  }

  const resetOTP = () => {
    setOtpStep('send')
    setOtpCode('')
    setError('')
  }

  const handleGoogleOAuth = async () => {
    setLoadingAction('oauth')
    setError('')

    try {
      await authenticateOAuth.mutateAsync({ provider: OAUTH_PROVIDERS.GOOGLE })
      router.push('/dashboard')
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'OAuth authentication failed',
      )
    } finally {
      setLoadingAction(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-[450px]">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Logo/Brand - Inside Card */}
          <div className="px-8 pt-10 pb-6 text-center space-y-4 relative">
            {/* Logo */}
            <div className="inline-flex items-center justify-center">
              <img
                src="/images/zerodev-logo.png"
                alt="ZeroDev Logo"
                className="w-16 h-16"
              />
            </div>

            {/* Brand Name & Subtitle */}
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                ZeroDev Wallet Demo
              </h1>
              <p className="text-xs text-gray-500 mt-1">By Offchain Labs</p>
              <p className="text-base text-gray-600 mt-3 font-medium">
                Log in or sign up
              </p>
            </div>
          </div>

          {/* Session expired message */}
          {sessionExpired && !error && (
            <div className="mx-8 mb-2 px-4 py-3 rounded-lg text-sm text-center bg-yellow-50 text-yellow-700 border border-yellow-200">
              Your session has expired. Please log in again.
            </div>
          )}

          {/* Auth Form */}
          <div className="px-8 pb-8 space-y-4">
            {/* OTP Code Input (verify step) */}
            {otpStep === 'verify' && (
              <>
                <div className="px-4 py-3 bg-blue-50 border border-blue-100 rounded-lg">
                  <p className="text-sm text-blue-700">
                    Enter the code sent to{' '}
                    <span className="font-semibold">{email}</span>
                  </p>
                </div>
                <input
                  type="text"
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleOTPVerify()}
                  maxLength={6}
                  autoFocus
                  className={cn(
                    'w-full px-4 py-3 rounded-lg border border-gray-200 text-center font-mono text-xl tracking-[0.5em]',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                    'text-gray-900 placeholder:text-gray-300',
                  )}
                />
                <button
                  onClick={resetOTP}
                  className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
                >
                  &larr; Use a different email
                </button>

                <button
                  onClick={handleOTPVerify}
                  disabled={!otpCode.trim() || loadingAction !== null}
                  style={{
                    background:
                      'linear-gradient(white, white) padding-box, linear-gradient(to right, #22d3ee, #2563eb) border-box',
                  }}
                  className={cn(
                    'w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer',
                    'border-2 border-transparent text-blue-500',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'flex items-center justify-center gap-2',
                  )}
                >
                  {loadingAction === 'otp-verify' ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>Verify and continue</>
                  )}
                </button>
              </>
            )}

            {/* Main auth UI (send step) */}
            {otpStep === 'send' && (
              <>
                {/* Passkey Section */}
                <button
                  onClick={handlePasskeyRegister}
                  disabled={loadingAction !== null}
                  style={{
                    background:
                      'linear-gradient(white, white) padding-box, linear-gradient(to right, #22d3ee, #2563eb) border-box',
                  }}
                  className={cn(
                    'w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer',
                    'border-2 border-transparent text-blue-500',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'flex items-center justify-center gap-2',
                  )}
                >
                  {loadingAction === 'passkey-register' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Registering...
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" />
                      Register with passkey
                    </>
                  )}
                </button>

                <button
                  onClick={handlePasskeyLogin}
                  disabled={loadingAction !== null}
                  style={{
                    background:
                      'linear-gradient(white, white) padding-box, linear-gradient(to right, #22d3ee, #2563eb) border-box',
                  }}
                  className={cn(
                    'w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer',
                    'border-2 border-transparent text-blue-500',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'flex items-center justify-center gap-2',
                  )}
                >
                  {loadingAction === 'passkey-login' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" />
                      Login with existing passkey
                    </>
                  )}
                </button>

                {/* OR Divider */}
                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-4 bg-white text-gray-400 text-sm font-medium">
                      OR
                    </span>
                  </div>
                </div>

                {/* Email Section */}
                <div className="relative">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loadingAction !== null}
                    className={cn(
                      'w-full px-4 py-3 rounded-lg border border-gray-200',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                      'text-gray-900 placeholder:text-gray-400 text-[15px]',
                      'transition-all duration-200',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                  />
                </div>

                <button
                  onClick={handleEmailAuth}
                  disabled={!email.trim() || loadingAction !== null}
                  style={{
                    background:
                      'linear-gradient(white, white) padding-box, linear-gradient(to right, #22d3ee, #2563eb) border-box',
                  }}
                  className={cn(
                    'w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer',
                    'border-2 border-transparent text-blue-500',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'flex items-center justify-center gap-2',
                  )}
                >
                  {loadingAction === 'email' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      Continue with email magic link
                    </>
                  )}
                </button>

                <button
                  onClick={handleOTPSend}
                  disabled={!email.trim() || loadingAction !== null}
                  style={{
                    background:
                      'linear-gradient(white, white) padding-box, linear-gradient(to right, #22d3ee, #2563eb) border-box',
                  }}
                  className={cn(
                    'w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer',
                    'border-2 border-transparent text-blue-500',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'flex items-center justify-center gap-2',
                  )}
                >
                  {loadingAction === 'otp-send' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      Continue with email OTP code
                    </>
                  )}
                </button>

                {/* OR Divider */}
                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-4 bg-white text-gray-400 text-sm font-medium">
                      OR
                    </span>
                  </div>
                </div>

                {/* Google OAuth */}
                <button
                  onClick={handleGoogleOAuth}
                  disabled={loadingAction !== null}
                  style={{
                    background:
                      'linear-gradient(white, white) padding-box, linear-gradient(to right, #22d3ee, #2563eb) border-box',
                  }}
                  className={cn(
                    'w-full py-3.5 px-4 rounded-lg font-semibold text-[15px] transition-all duration-200 cursor-pointer',
                    'border-2 border-transparent text-blue-500',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'flex items-center justify-center gap-2.5',
                  )}
                >
                  {loadingAction === 'oauth' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Continue with Google
                    </>
                  )}
                </button>

                {/* Terms */}
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 text-left">
                    By continuing, you agree to our{' '}
                    <a
                      href="https://zerodev.app/terms-of-service"
                      className="text-blue-500 hover:text-blue-700 underline"
                    >
                      Terms of Service
                    </a>{' '}
                    and{' '}
                    <a
                      href="https://zerodev.app/privacy-policy"
                      className="text-blue-500 hover:text-blue-700 underline"
                    >
                      ZeroDev Privacy Policy
                    </a>
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Error/Success Messages - Outside card, below */}
          {error && (
            <div
              className={cn(
                'mx-8 mb-6 px-4 py-3 rounded-lg text-sm text-center',
                error.includes('sent') || error.includes('Magic link')
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200',
              )}
            >
              {error}
            </div>
          )}
        </div>

        {/* GitHub Footer */}
        <div className="mt-4 text-center">
          <a
            href="https://github.com/zerodevapp/zerodev-signer-demo"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            View source on GitHub
          </a>
        </div>
      </div>
    </div>
  )
}
