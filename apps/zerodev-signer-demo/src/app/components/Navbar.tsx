/* eslint-disable @next/next/no-img-element */

export function Navbar() {
  return (
    <header className="border-b border-gray-200 bg-white shadow-sm">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <img src="/images/zerodev-logo.png" alt="ZeroDev Logo" className="h-10 w-10" />
              <span className="text-2xl font-semibold leading-none tracking-tight text-gray-900">
                ZeroDev
              </span>
            </div>
            <span className="text-sm px-3 py-1.5 bg-blue-50 text-blue-500 rounded-full font-medium border border-blue-100">
              Wallet Demo
            </span>
          </div>

          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-6 md:flex"
          >
            <a
              href="https://docs.zerodev.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-950"
            >
              Documentation
            </a>
            <a
              href="https://dashboard.zerodev.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-950"
            >
              Get your API keys
            </a>
            <a
              href="https://zerodev.app/book-a-demo"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center rounded-full bg-gray-950 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gray-800"
            >
              Contact sales
            </a>
          </nav>
        </div>
      </div>
    </header>
  )
}
