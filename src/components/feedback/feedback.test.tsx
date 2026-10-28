import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { ErrorState } from './ErrorState'
import { NotFoundState } from './NotFoundState'
import { PageLoader } from './PageLoader'

describe('ErrorState', () => {
  it('shows the connection message and retries', async () => {
    const onRetry = vi.fn()
    render(<ErrorState error={new ApiError({ status: 0, code: 'NETWORK_ERROR' })} onRetry={onRetry} />)

    expect(screen.getByText(/Can't reach the FlowDesk server/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it("never shows a 500's server text", () => {
    render(<ErrorState error={new ApiError({ status: 500, serverMessage: 'boom' })} />)
    expect(screen.queryByText('boom')).not.toBeInTheDocument()
    expect(screen.getByText('Something went wrong on our side. Try again.')).toBeInTheDocument()
  })

  it('disables Retry while retrying', () => {
    render(<ErrorState error={new ApiError({ status: 503 })} onRetry={() => {}} retrying />)
    expect(screen.getByRole('button', { name: 'Retrying…' })).toBeDisabled()
  })
})

describe('NotFoundState', () => {
  it('links home', () => {
    render(
      <MemoryRouter>
        <NotFoundState />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/')
  })
})

describe('PageLoader', () => {
  it('is a polite status with its label', () => {
    render(<PageLoader label="Checking your session…" />)
    expect(screen.getByRole('status')).toHaveTextContent('Checking your session…')
  })
})
