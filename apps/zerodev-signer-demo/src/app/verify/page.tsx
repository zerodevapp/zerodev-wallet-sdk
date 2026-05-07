'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useVerifyMagicLink } from '@zerodev/wallet-react';

function VerifyContent() {
  const searchParams = useSearchParams();
  const verifyMagicLink = useVerifyMagicLink();
  const [verificationState, setVerificationState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    async function tryLoginWithBundle() {
      const code = searchParams.get('code')
      console.log('code', code)
      const otpId = localStorage.getItem("otpId");
      const otpEncryptionTargetBundle = localStorage.getItem(
        "otpEncryptionTargetBundle",
      );
      if (!otpId) {
        setVerificationState('error');
        setErrorMessage('No OTP ID found');
        return;
      }

      if (!otpEncryptionTargetBundle) {
        setVerificationState('error');
        setErrorMessage('No OTP encryption bundle found');
        return;
      }

      if (!code) {
        setVerificationState('error');
        setErrorMessage('No code found in URL');
        return;
      }

      // Small delay to ensure SDK is fully ready
      await new Promise(resolve => setTimeout(resolve, 500));

      try {
        await verifyMagicLink.mutateAsync({
          code,
          otpId,
          otpEncryptionTargetBundle,
        });

        setVerificationState('success');

        setTimeout(() => {
          location.href = '/dashboard';
        }, 2000);
      } catch (error) {
        console.log(error);
        setVerificationState('error');
        setErrorMessage(error instanceof Error ? error.message : 'Authentication failed');
      }
    }

    tryLoginWithBundle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        {verificationState === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Verifying Magic Link</h2>
            <p className="text-gray-600">Processing your authentication...</p>
          </>
        )}

        {verificationState === 'success' && (
          <>
            <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Successful!</h2>
            <p className="text-gray-600 mb-4">Redirecting you to the dashboard...</p>
            <div className="text-sm text-gray-500">You will be redirected automatically in 2 seconds</div>
          </>
        )}

        {verificationState === 'error' && (
          <>
            <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Verification Failed</h2>
            <p className="text-gray-600 mb-4">{errorMessage}</p>
            <button
              onClick={() => location.href = '/dashboard'}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Return to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function EmailAuthVerify() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}