import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { api, janeDoe, renderSignedIn } from '@/test/renderApp'
import { server } from '@/test/server'

// The contract's 201 example.
const invite = {
  id: '5f0c2b1e-8f5a-4c1d-9a63-2b7e0d4c9f11',
  emailId: 'jane.doe@saajha.org',
  name: 'Jane Doe',
  role: 'MEMBER',
  status: 'PENDING',
  expiresAt: '2026-10-18T10:00:00.000Z',
  createdAt: '2026-10-15T10:00:00.000Z',
}

beforeEach(() => {
  server.use(http.get(api('/employees'), () => HttpResponse.json({ data: [janeDoe], meta: { total: 1, limit: 20, offset: 0 } })))
})

async function openDialog() {
  renderSignedIn('/people')
  await userEvent.click(await screen.findByRole('button', { name: 'Invite member' }))
  return screen.findByRole('dialog', { name: 'Invite a member' })
}

async function fillAndSend(dialog: HTMLElement, email = '  Jane.Doe@SAAJHA.ORG ', name = ' Jane Doe ') {
  await userEvent.type(within(dialog).getByLabelText('Email'), email)
  await userEvent.type(within(dialog).getByLabelText('Name'), name)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Send invite' }))
}

// Answers POST /invites with `respond` and records the last request body.
function mockInvite(respond: () => Response | Promise<Response>) {
  const create = { calls: 0, body: undefined as unknown }
  server.use(
    http.post(api('/invites'), async ({ request }) => {
      create.calls += 1
      create.body = await request.json()
      return respond()
    }),
  )
  return create
}

describe('InviteMemberDialog', () => {
  it('validates required fields without calling the API', async () => {
    const create = mockInvite(() => HttpResponse.json({ data: invite }, { status: 201 }))
    const dialog = await openDialog()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send invite' }))

    expect(await within(dialog).findByText('Enter an email address.')).toBeInTheDocument()
    expect(within(dialog).getByText('Enter a name.')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Email')).toHaveFocus()
    expect(create.calls).toBe(0)
  })

  it('sends the trimmed invite, closes and confirms', async () => {
    const create = mockInvite(() => HttpResponse.json({ data: invite }, { status: 201 }))
    const dialog = await openDialog()
    await fillAndSend(dialog)

    expect(await screen.findByText('Invite sent to jane.doe@saajha.org')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // The backend lowercases the email; the frontend only trims.
    expect(create.body).toEqual({ email: 'Jane.Doe@SAAJHA.ORG', name: 'Jane Doe', role: 'MEMBER' })
  })

  it('sends the chosen role', async () => {
    const create = mockInvite(() => HttpResponse.json({ data: { ...invite, role: 'MANAGER' } }, { status: 201 }))
    const dialog = await openDialog()
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Role' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Manager' }))
    await fillAndSend(dialog)
    await screen.findByText('Invite sent to jane.doe@saajha.org')
    expect(create.body).toMatchObject({ role: 'MANAGER' })
  })

  it('stays open and busy while sending', async () => {
    let release!: () => void
    const released = new Promise<void>((resolve) => (release = resolve))
    mockInvite(async () => {
      await released
      return HttpResponse.json({ data: invite }, { status: 201 })
    })
    const dialog = await openDialog()
    await fillAndSend(dialog)

    expect(await within(dialog).findByRole('button', { name: 'Sending invite…' })).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    release()
    expect(await screen.findByText('Invite sent to jane.doe@saajha.org')).toBeInTheDocument()
  })

  it('puts a server validation error on its field and keeps the values', async () => {
    mockInvite(() =>
      HttpResponse.json(
        { error: 'Validation failed', details: [{ path: 'email', message: 'Invalid email: must be an @saajha.org address' }] },
        { status: 400 },
      ),
    )
    const dialog = await openDialog()
    await fillAndSend(dialog, 'jane@gmail.com')

    expect(await within(dialog).findByText('Invalid email: must be an @saajha.org address')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Email')).toHaveValue('jane@gmail.com')
    expect(within(dialog).getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows EMPLOYEE_EXISTS under the email field', async () => {
    mockInvite(() =>
      HttpResponse.json({ error: 'Employee with email jane.doe@saajha.org already exists', code: 'EMPLOYEE_EXISTS' }, { status: 409 }),
    )
    const dialog = await openDialog()
    await fillAndSend(dialog)
    expect(await within(dialog).findByText('An employee with this email already exists.')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  it.each([
    [409, 'INVITE_PENDING', 'An invite for this email is already being created. Try again in a moment.'],
    [502, 'EMAIL_DELIVERY_FAILED', "The invite email couldn't be sent, so the invite was cancelled. Try again."],
    [403, 'FORBIDDEN', "You don't have permission to do that."],
    [500, undefined, 'Something went wrong on our side. Try again.'],
  ])('shows %i %s as a form-level alert and stays open', async (status, code, message) => {
    mockInvite(() => HttpResponse.json({ error: 'x', ...(code && { code }) }, { status }))
    const dialog = await openDialog()
    await fillAndSend(dialog)

    expect(await within(dialog).findByText(message)).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Name')).toHaveValue(' Jane Doe ')
  })
})
